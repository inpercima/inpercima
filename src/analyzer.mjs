/**
 * Repository analyzer: extracts version info and calculates health scores.
 */

import { fetchFileContent, fetchLanguages } from './api.mjs';

/**
 * Central policy for version-based scoring. Each entry is an ordered list of
 * `[minimumVersion, score]` pairs (checked from highest to lowest). Adjust
 * these thresholds to tune scoring without touching the scoring logic.
 */
const VERSION_POLICIES = {
  node: [
    [24, 100],
    [22, 90],
    [20, 75],
    [18, 50],
  ],
  pnpm: [
    [9, 100],
    [8, 90],
    [7, 75],
    [6, 50],
  ],
  angular: [
    [20, 100],
    [18, 85],
    [16, 70],
  ],
  php: [
    [8.2, 100],
    [8.1, 90],
    [8.0, 75],
    [7.4, 50],
  ],
  maven: [
    [3.9, 100],
    [3.8, 85],
    [3.6, 70],
  ],
  java: [
    [21, 100],
    [17, 85],
    [11, 70],
  ],
};

/**
 * Score a version string against a named version policy.
 * Distinguishes an absent version (no version supplied) from a present but
 * unparsable/malformed one, so callers can tell the two situations apart.
 * @param {string|null|undefined} version
 * @param {keyof typeof VERSION_POLICIES} policyKey
 * @param {{missingScore?: number, invalidScore?: number, fallbackScore?: number}} [options]
 * @returns {number} 0-100
 */
function scoreVersion(version, policyKey, options = {}) {
  const { missingScore = 0, invalidScore = 40, fallbackScore = 25 } = options;

  if (!version) return missingScore;

  const match = String(version).match(/\d+(?:\.\d+)?/);
  const parsed = match ? parseFloat(match[0]) : NaN;
  if (Number.isNaN(parsed)) return invalidScore;

  const thresholds = VERSION_POLICIES[policyKey] ?? [];
  for (const [min, score] of thresholds) {
    if (parsed >= min) return score;
  }
  return fallbackScore;
}

/**
 * Extract Angular version from package.json content.
 * @param {object} pkg
 * @returns {string|null}
 */
function detectAngular(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const version = deps?.['@angular/core'];
  if (!version) return null;
  return version.replace(/[\^~>=<]/g, '').trim();
}

/**
 * Detect whether Angular CLI/build tooling is configured in package.json.
 * @param {object} pkg
 * @returns {boolean}
 */
function detectAngularTooling(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  return Boolean(deps?.['@angular/cli'] || deps?.['@angular-devkit/build-angular']);
}

/**
 * Extract Node.js engine requirement from package.json content.
 * @param {object} pkg
 * @returns {string|null}
 */
function detectNodeVersion(pkg) {
  const version = pkg?.engines?.node;
  if (!version) return null;
  return version.replace(/[\^~>=<]/g, '').replace('>=', '').trim();
}

/**
 * Detect whether package.json declares any useful npm scripts.
 * @param {object} pkg
 * @returns {boolean}
 */
function detectPackageScripts(pkg) {
  return Boolean(pkg?.scripts && Object.keys(pkg.scripts).length > 0);
}

/**
 * Extract pnpm version from README content by looking for a line like:
 *   npm install -g pnpm@10.32.0
 * @param {string} readmeText
 * @returns {string|null}
 */
function detectPnpmVersion(readmeText) {
  const match = readmeText.match(/pnpm@([\d.]+)/);
  if (match) return match[1].trim();
  return null;
}

/**
 * Extract PHP version from docker-compose.yml content by looking for webdevops images.
 * Searches for lines like:
 *   image: webdevops/php-apache:8.2-alpine
 * @param {string} dockerComposeContent
 * @returns {string|null}
 */
function detectPhpVersionFromDockerCompose(dockerComposeContent) {
  const match = dockerComposeContent.match(/webdevops\/php-\w+:([\d.]+)/);
  if (match) return match[1].trim();
  return null;
}

/**
 * Extract Maven version from .mvn/wrapper/maven-wrapper.properties content.
 * Searches for a line like:
 *   distributionUrl=https://repo.maven.apache.org/maven2/org/apache/maven/apache-maven/3.9.3/apache-maven-3.9.3-bin.zip
 * @param {string} wrapperProps
 * @returns {string|null}
 */
function detectMavenVersionFromWrapper(wrapperProps) {
  const match = wrapperProps.match(/distributionUrl=[^\r\n]*apache-maven-([\d.]+)-bin/);
  if (match) return match[1].trim();
  return null;
}

/**
 * Extract Maven version from pom.xml content.
 * @param {string} pomXml
 * @returns {string|null}
 */
function detectMavenVersion(pomXml) {
  const match = pomXml.match(/<maven\.version>(.*?)<\/maven\.version>/);
  if (match) return match[1].trim();
  return null;
}

/**
 * Detect Java framework from pom.xml or build.gradle content.
 * @param {string} content
 * @returns {string|null}
 */
function detectJavaFramework(content) {
  if (/spring-boot/i.test(content)) return 'Spring Boot';
  if (/quarkus/i.test(content)) return 'Quarkus';
  if (/micronaut/i.test(content)) return 'Micronaut';
  if (/helidon/i.test(content)) return 'Helidon';
  return null;
}

/**
 * Extract the configured Java language level from pom.xml content.
 * @param {string} pomXml
 * @returns {string|null}
 */
function detectJavaVersion(pomXml) {
  const match =
    pomXml.match(/<java\.version>(.*?)<\/java\.version>/) ||
    pomXml.match(/<maven\.compiler\.release>(.*?)<\/maven\.compiler\.release>/) ||
    pomXml.match(/<maven\.compiler\.source>(.*?)<\/maven\.compiler\.source>/);
  if (match) return match[1].trim();
  return null;
}

/**
 * Detect whether pom.xml defines a <dependencyManagement> section.
 * @param {string} pomXml
 * @returns {boolean}
 */
function detectDependencyManagement(pomXml) {
  return /<dependencyManagement>/.test(pomXml);
}

/**
 * Calculate the weighted average score for a list of criteria.
 * Only criteria marked `applicable` contribute to the result. Each
 * criterion's `contribution` (score * weight) is recorded for transparency.
 * @param {Array<object>} criteria
 * @returns {number} 0-100 integer
 */
function calculateWeightedScore(criteria) {
  const applicableCriteria = criteria.filter(criterion => criterion.applicable);
  const totalWeight = applicableCriteria.reduce((sum, criterion) => sum + criterion.weight, 0);

  if (totalWeight === 0) return 0;

  const weightedScore = applicableCriteria.reduce((sum, criterion) => sum + criterion.score * criterion.weight, 0);

  const score = weightedScore / totalWeight;
  return Math.min(100, Math.max(0, Math.round(score)));
}

/**
 * Build the criteria that apply to (almost) every repository, regardless of
 * technology stack.
 * @param {object} repo
 * @param {object} meta
 * @returns {Array<object>}
 */
function buildGeneralCriteria(repo, meta) {
  const daysSinceUpdate = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
  let activityScore = 0;
  if (daysSinceUpdate < 30) activityScore = 100;
  else if (daysSinceUpdate < 90) activityScore = 70;
  else if (daysSinceUpdate < 180) activityScore = 40;
  else if (daysSinceUpdate < 365) activityScore = 15;

  return [
    {
      id: 'activity',
      category: 'general',
      label: 'Recent activity',
      applicable: true,
      score: activityScore,
      weight: 25,
    },
    {
      id: 'description',
      category: 'general',
      label: 'Description',
      applicable: true,
      score: repo.description ? 100 : 0,
      weight: 10,
    },
    {
      id: 'readme',
      category: 'general',
      label: 'README',
      applicable: true,
      score: meta.hasReadme ? 100 : 0,
      weight: 10,
    },
    {
      id: 'ci',
      category: 'general',
      label: 'CI/CD',
      applicable: true,
      score: meta.hasCI ? 100 : 0,
      weight: 20,
    },
    {
      id: 'license',
      category: 'general',
      label: 'License',
      applicable: true,
      score: repo.license ? 100 : 0,
      weight: 10,
    },
    {
      id: 'topics',
      category: 'general',
      label: 'Topics',
      applicable: true,
      score: repo.topics && repo.topics.length > 0 ? 100 : 0,
      weight: 10,
    },
    {
      id: 'community',
      category: 'general',
      label: 'Community signal (stars)',
      applicable: true,
      score: Math.min(100, (repo.stargazers_count ?? 0) * 10),
      weight: 5,
    },
  ];
}

/**
 * Build the criteria for technologies actually detected in the repository.
 * A criterion is only included (marked `applicable`) when its technology was
 * detected; otherwise it is entirely excluded from the score calculation.
 * @param {object} meta
 * @returns {Array<object>}
 */
function buildTechnologyCriteria(meta) {
  const { technologies } = meta;

  return [
    {
      id: 'node-version',
      category: 'node',
      label: 'Node.js version',
      applicable: technologies.node,
      score: technologies.node ? scoreVersion(meta.nodeVersion, 'node') : null,
      weight: 15,
    },
    {
      id: 'node-scripts',
      category: 'node',
      label: 'npm scripts configured',
      applicable: technologies.node,
      score: technologies.node ? (meta.hasPackageScripts ? 100 : 0) : null,
      weight: 5,
    },
    {
      id: 'pnpm-version',
      category: 'pnpm',
      label: 'pnpm version',
      applicable: technologies.pnpm,
      score: technologies.pnpm ? scoreVersion(meta.pnpmVersion, 'pnpm') : null,
      weight: 10,
    },
    {
      id: 'angular-version',
      category: 'angular',
      label: 'Angular version',
      applicable: technologies.angular,
      score: technologies.angular ? scoreVersion(meta.angular, 'angular') : null,
      weight: 15,
    },
    {
      id: 'angular-tooling',
      category: 'angular',
      label: 'Angular CLI/build tooling',
      applicable: technologies.angular,
      score: technologies.angular ? (meta.hasAngularTooling ? 100 : 0) : null,
      weight: 5,
    },
    {
      id: 'php-version',
      category: 'php',
      label: 'PHP version',
      applicable: technologies.php,
      score: technologies.php ? scoreVersion(meta.phpVersion, 'php') : null,
      weight: 15,
    },
    {
      id: 'php-config',
      category: 'php',
      label: 'PHP configuration',
      applicable: technologies.php,
      score: technologies.php ? (meta.hasPhpConfig ? 100 : 0) : null,
      weight: 5,
    },
    {
      id: 'maven-version',
      category: 'maven',
      label: 'Maven version',
      applicable: technologies.maven,
      score: technologies.maven ? scoreVersion(meta.mavenVersion, 'maven') : null,
      weight: 15,
    },
    {
      id: 'maven-dependency-management',
      category: 'maven',
      label: 'Dependency management configured',
      applicable: technologies.maven,
      score: technologies.maven ? (meta.hasDependencyManagement ? 100 : 0) : null,
      weight: 5,
    },
    {
      id: 'java-version',
      category: 'java',
      label: 'Java version',
      applicable: technologies.java,
      score: technologies.java ? scoreVersion(meta.javaVersion, 'java') : null,
      weight: 15,
    },
    {
      id: 'java-build-config',
      category: 'java',
      label: 'Java build configuration',
      applicable: technologies.java,
      score: technologies.java ? (meta.hasJavaCI || meta.otherFramework ? 100 : 0) : null,
      weight: 5,
    },
  ];
}

/**
 * Detect which technologies are actually present in the repository, based on
 * metadata gathered from already-fetched files. Only technologies detected
 * here contribute technology-specific criteria to the health score – absent
 * technologies never penalize the score.
 * @param {object} meta
 * @returns {Record<string, boolean>}
 */
function detectTechnologies(meta) {
  return {
    node: meta.hasPackageJson,
    pnpm: meta.pnpmVersion !== null,
    angular: meta.angular !== null,
    php: meta.phpVersion !== null,
    maven: meta.hasMavenConfig,
    java: meta.hasMavenConfig, // Java is currently detected via Maven build files (pom.xml)
  };
}

/**
 * Calculate a health score (0–100) for a repository based on several
 * signals. Only criteria relevant to the technologies actually present in
 * the repository are considered, so e.g. a pure JavaScript project is not
 * penalized for lacking Angular, Maven or Java.
 * @param {object} repo  Raw GitHub repo object
 * @param {object} meta  Derived metadata (hasCI, hasReadme, etc.)
 * @returns {{score: number, technologies: Record<string, boolean>, criteria: Array<object>}}
 */
export function calculateHealthScore(repo, meta) {
  const technologies = detectTechnologies(meta);

  const criteria = [...buildGeneralCriteria(repo, meta), ...buildTechnologyCriteria({ ...meta, technologies })].map(
    criterion => ({
      ...criterion,
      contribution: criterion.applicable ? criterion.score * criterion.weight : 0,
    }),
  );

  const score = calculateWeightedScore(criteria);

  return { score, technologies, criteria };
}

/**
 * Analyze a single repository: fetch config files and extract metadata.
 * @param {string} username
 * @param {object} repo  Raw GitHub repo object
 * @param {string|undefined} token
 * @returns {Promise<object>}
 */
export async function analyzeRepo(username, repo, token) {
  const name = repo.name;
  const meta = {
    hasReadme: false,
    hasCI: false,
    hasJavaCI: false,
    hasPackageJson: false,
    hasPackageScripts: false,
    hasAngularTooling: false,
    hasMavenConfig: false,
    hasDependencyManagement: false,
    hasPhpConfig: false,
    angular: null,
    nodeVersion: null,
    pnpmVersion: null,
    phpVersion: null,
    mavenVersion: null,
    javaVersion: null,
    otherFramework: null,
    languages: [],
    languagePercentages: {},
  };

  // Fetch files in parallel where possible
  const [
    rootPackageJson,
    frontendPackageJson,
    rootPomXml,
    backendPomXml,
    rootMavenWrapperProps,
    backendMavenWrapperProps,
    readmeText,
    nodeCi,
    javaCi,
    phpConfig,
    dockerCompose,
    languagesData,
  ] = await Promise.all([
    fetchFileContent(username, name, 'package.json', token),
    fetchFileContent(username, name, 'frontend/package.json', token),
    fetchFileContent(username, name, 'pom.xml', token),
    fetchFileContent(username, name, 'backend/pom.xml', token),
    fetchFileContent(username, name, '.mvn/wrapper/maven-wrapper.properties', token),
    fetchFileContent(username, name, 'backend/.mvn/wrapper/maven-wrapper.properties', token),
    fetchFileContent(username, name, 'README.md', token),
    fetchFileContent(username, name, '.github/workflows/node_ci.yml', token),
    fetchFileContent(username, name, '.github/workflows/java_ci.yaml', token),
    fetchFileContent(username, name, 'api/config/config.default.php', token),
    fetchFileContent(username, name, 'docker-compose.yml', token),
    fetchLanguages(username, name, token),
  ]);

  meta.hasReadme = readmeText !== null;
  meta.hasCI = nodeCi !== null || javaCi !== null;
  meta.hasJavaCI = javaCi !== null;
  meta.languages = Object.keys(languagesData).sort((a, b) => languagesData[b] - languagesData[a]);
  const totalBytes = Object.values(languagesData).reduce((sum, b) => sum + b, 0);
  meta.languagePercentages = {};
  if (totalBytes > 0) {
    for (const [lang, bytes] of Object.entries(languagesData)) {
      meta.languagePercentages[lang] = Math.round((bytes / totalBytes) * 100);
    }
  }

  const packageJson = rootPackageJson || frontendPackageJson;
  meta.hasPackageJson = packageJson !== null && packageJson !== undefined;
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      meta.angular = detectAngular(pkg);
      meta.nodeVersion = detectNodeVersion(pkg);
      meta.hasPackageScripts = detectPackageScripts(pkg);
      meta.hasAngularTooling = detectAngularTooling(pkg);

      if (meta.angular === null && frontendPackageJson !== null) {
        // If root package.json doesn't have Angular, check frontend one
        const frontendPkg = JSON.parse(frontendPackageJson);
        meta.angular = detectAngular(frontendPkg);
        meta.hasAngularTooling = meta.hasAngularTooling || detectAngularTooling(frontendPkg);
      }
    } catch {
      // Malformed package.json – skip
    }
  }

  if (meta.hasReadme) {
    meta.pnpmVersion = detectPnpmVersion(readmeText);
  }

  const mavenWrapperProps = rootMavenWrapperProps || backendMavenWrapperProps;
  if (mavenWrapperProps) {
    const wrapperVersion = detectMavenVersionFromWrapper(mavenWrapperProps);
    if (wrapperVersion) meta.mavenVersion = wrapperVersion;
  }

  const pomXml = rootPomXml || backendPomXml;
  meta.hasMavenConfig = pomXml !== null && pomXml !== undefined || mavenWrapperProps !== null && mavenWrapperProps !== undefined;
  if (pomXml) {
    if (!meta.mavenVersion) {
      meta.mavenVersion = detectMavenVersion(pomXml);
    }
    meta.javaVersion = detectJavaVersion(pomXml);
    meta.hasDependencyManagement = detectDependencyManagement(pomXml);
    meta.otherFramework = detectJavaFramework(pomXml);
  }

  // PHP detection: check docker-compose.yml first, then fallback to config file
  if (dockerCompose !== null) {
    meta.phpVersion = detectPhpVersionFromDockerCompose(dockerCompose);
  }
  meta.hasPhpConfig = phpConfig !== null;
  if (meta.hasPhpConfig && !meta.phpVersion) {
    // If we have PHP config but no version from docker-compose, mark as PHP detected
    meta.phpVersion = 'unknown';
  }

  const health = calculateHealthScore(repo, meta);
  meta.healthScore = health.score;
  meta.health = health;

  return { repo, meta };
}

/**
 * Aggregate KPI statistics across all analyzed repositories.
 * @param {Array<{repo: object, meta: object}>} analyzed
 * @returns {object}
 */
export function aggregateStats(analyzed) {
  const totalRepos = analyzed.length;
  const totalStars = analyzed.reduce((sum, { repo }) => sum + repo.stargazers_count, 0);
  const avgHealth = totalRepos > 0 ? Math.round(analyzed.reduce((sum, { meta }) => sum + meta.healthScore, 0) / totalRepos) : 0;

  // Tally language counts: primary language only (for "Top Languages" card)
  const primaryLangCounts = {};
  // Tally language counts: all languages per repo (for "% Usage of Languages" card)
  const allLangCounts = {};
  for (const { repo, meta } of analyzed) {
    const primaryLang = (meta.languages && meta.languages.length > 0) ? meta.languages[0] : repo.language;
    if (primaryLang) {
      primaryLangCounts[primaryLang] = (primaryLangCounts[primaryLang] ?? 0) + 1;
    }
    const allLangs = (meta.languages && meta.languages.length > 0) ? meta.languages : (repo.language ? [repo.language] : []);
    for (const lang of allLangs) {
      allLangCounts[lang] = (allLangCounts[lang] ?? 0) + 1;
    }
  }
  const topPrimaryLanguages = Object.entries(primaryLangCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => ({ lang, count }));
  const topLanguages = Object.entries(allLangCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => ({ lang, count }));

  return { totalRepos, totalStars, avgHealth, topPrimaryLanguages, topLanguages };
}
