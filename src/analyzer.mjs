/**
 * Repository analyzer: extracts version info and calculates health scores.
 */

import { fetchFileContent, fetchLanguages, fetchWorkflowRuns, fetchLatestCheckoutMajor } from './api.mjs';

/** Fallback major version of `actions/checkout` if the latest release cannot be fetched. */
export const FALLBACK_CHECKOUT_MAJOR = 5;

/**
 * Central policy for version-based scoring. Each entry is an ordered list of
 * `[minimumVersion, score]` pairs (checked from highest to lowest). Adjust
 * these thresholds to tune scoring without touching the scoring logic.
 */
const VERSION_POLICIES = {
  node: [
    [26, 100],
    [24, 90],
    [22, 80],
    [20, 70],
    [18, 50],
  ],
  pnpm: [
    [12, 100],
    [11, 90],
    [9, 80],
    [7, 70],
    [6, 50],
  ],
  angular: [
    [22, 100],
    [20, 90],
    [18, 80],
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
    [27, 100],
    [25, 90],
    [21, 80],
    [17, 70],
    [11, 50],
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
 * Extract PHP version from docker-compose.yml content by looking for PHP images.
 * Searches for lines like:
 *   image: webdevops/php-apache:8.2-alpine
 *   image: php:8.2-fpm
 *   image: registry.example.com/php:8.3
 * @param {string} dockerComposeContent
 * @returns {string|null}
 */
function detectPhpVersionFromDockerCompose(dockerComposeContent) {
  const patterns = [
    /webdevops\/php-\w+:([\d.]+)/i,
    /(?:^|[\s/"'])php:([\d.]+)/im,
  ];
  for (const pattern of patterns) {
    const match = dockerComposeContent.match(pattern);
    if (match) return match[1].trim();
  }
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
  return null;
}

/**
 * Detect the Java framework version from pom.xml content (Spring Boot only).
 * @param {string} pomXml
 * @param {string} framework
 * @returns {string|null}
 */
export function detectJavaFrameworkVersion(pomXml, framework) {
  if (framework !== 'Spring Boot') return null;
  const match =
    pomXml.match(/<parent>[\s\S]*?<artifactId>spring-boot-starter-parent<\/artifactId>\s*<version>(.*?)<\/version>/) ||
    pomXml.match(/<spring-boot\.version>(.*?)<\/spring-boot\.version>/);
  return match ? match[1].trim() : null;
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
 * Extract the (latest) copyright year from the text of a LICENSE file.
 * A range like `2021-2026` yields its end year.
 * @param {string|null} licenseText
 * @returns {number|null}
 */
export function detectLicenseYear(licenseText) {
  if (!licenseText) return null;
  const line = licenseText.split(/\r?\n/).find(l => /copyright|\(c\)|©/i.test(l) && /(?:19|20)\d{2}/.test(l));
  if (!line) return null;
  const years = line.match(/(?:19|20)\d{2}/g).map(Number);
  return Math.max(...years);
}

/**
 * Parse the major versions of all `uses: actions/checkout@<ref>` entries.
 * Refs that are no version tag (branch, SHA) are ignored.
 * @param {string} workflowText
 * @returns {number[]}
 */
export function detectCheckoutMajors(workflowText) {
  const majors = [];
  for (const match of workflowText.matchAll(/uses:\s*['"]?actions\/checkout@v(\d+)/g)) {
    majors.push(Number(match[1]));
  }
  return majors;
}

/**
 * Score for `actions/checkout`: share of usages on the current major version
 * (or newer). No detectable usage means nothing is outdated: 100.
 * @param {number[]|undefined} majors
 * @param {number|undefined} latestMajor
 * @returns {number}
 */
function scoreCheckout(majors, latestMajor) {
  if (!majors || majors.length === 0) return 100;
  const latest = latestMajor ?? FALLBACK_CHECKOUT_MAJOR;
  const current = majors.filter(major => major >= latest).length;
  return Math.round((current / majors.length) * 100);
}

/**
 * Score for the license: absent 0; present with current-year copyright 100;
 * present with an older or undetectable year 50.
 * @param {object} repo
 * @param {object} meta
 * @param {number} currentYear
 * @returns {number}
 */
function scoreLicense(repo, meta, currentYear) {
  if (!repo.license) return 0;
  return meta.licenseYear === currentYear ? 100 : 50;
}

/**
 * Build the criteria that apply to (almost) every repository, regardless of
 * technology stack.
 * @param {object} repo
 * @param {object} meta
 * @returns {Array<object>}
 */
function buildGeneralCriteria(repo, meta, currentYear) {
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
      weight: 30,
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
      id: 'license',
      category: 'general',
      label: 'License',
      applicable: true,
      score: scoreLicense(repo, meta, currentYear),
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
      id: 'php-version',
      category: 'php',
      label: 'PHP version',
      applicable: technologies.php,
      score: technologies.php ? scoreVersion(meta.phpVersion, 'php') : null,
      weight: 15,
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
      score: technologies.java ? (meta.hasJavaCI || hasJavaFramework(meta) ? 100 : 0) : null,
      weight: 5,
    },
    {
      id: 'ci-runs',
      category: 'cicd',
      label: 'CI/CD runs successful',
      applicable: technologies.cicd,
      score: technologies.cicd ? Math.round((meta.ciRunSuccessRate ?? 0) * 100) : null,
      weight: 10,
    },
    {
      id: 'ci-checkout',
      category: 'cicd',
      label: 'actions/checkout up to date',
      applicable: technologies.cicd,
      score: technologies.cicd ? scoreCheckout(meta.checkoutMajors, meta.latestCheckoutMajor) : null,
      weight: 10,
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
    cicd: Boolean(meta.hasCI),
  };
}

/**
 * Calculate a health score (0–100) for a repository based on several
 * signals. Only criteria relevant to the technologies actually present in
 * the repository are considered, so e.g. a pure JavaScript project is not
 * penalized for lacking Angular, Maven or Java.
 * @param {object} repo  Raw GitHub repo object
 * @param {object} meta  Derived metadata (hasCI, hasReadme, etc.)
 * @param {{currentYear?: number}} [options]  `currentYear` can be injected for testing
 * @returns {{score: number, technologies: Record<string, boolean>, criteria: Array<object>}}
 */
export function calculateHealthScore(repo, meta, options = {}) {
  const currentYear = options.currentYear ?? new Date().getFullYear();
  const technologies = detectTechnologies(meta);

  const criteria = [...buildGeneralCriteria(repo, meta, currentYear), ...buildTechnologyCriteria({ ...meta, technologies })].map(
    criterion => ({
      ...criterion,
      contribution: criterion.applicable ? criterion.score * criterion.weight : 0,
    }),
  );

  const score = calculateWeightedScore(criteria);

  return { score, technologies, criteria };
}

let latestCheckoutMajorPromise = null;

/**
 * Latest `actions/checkout` major version (fetched once, with fallback).
 * @param {string|undefined} token
 * @returns {Promise<number>}
 */
function getLatestCheckoutMajor(token) {
  latestCheckoutMajorPromise ??= fetchLatestCheckoutMajor(token).then(major => major ?? FALLBACK_CHECKOUT_MAJOR);
  return latestCheckoutMajorPromise;
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
    ciRunSuccessRate: null,
    checkoutMajors: [],
    latestCheckoutMajor: null,
    licenseYear: null,
    hasJavaCI: false,
    hasPackageJson: false,
    hasPackageScripts: false,
    hasMavenConfig: false,
    angular: null,
    nodeVersion: null,
    pnpmVersion: null,
    phpVersion: null,
    mavenVersion: null,
    javaVersion: null,
    hasAngular: false,
    frameworks: [],
    frameworksLabel: '',
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
    dockerCompose,
    languagesData,
    workflowRuns,
    latestCheckoutMajor,
    licenseFiles,
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
    fetchFileContent(username, name, 'docker-compose.yml', token),
    fetchLanguages(username, name, token),
    fetchWorkflowRuns(username, name, token),
    getLatestCheckoutMajor(token),
    Promise.all(['LICENSE', 'LICENSE.md', 'LICENSE.txt'].map(file => fetchFileContent(username, name, file, token))),
  ]);

  meta.hasReadme = readmeText !== null;
  meta.hasCI = nodeCi !== null || javaCi !== null;
  meta.checkoutMajors = [nodeCi, javaCi].filter(Boolean).flatMap(detectCheckoutMajors);
  meta.latestCheckoutMajor = latestCheckoutMajor;
  const latestRunPerWorkflow = new Map();
  for (const run of [...workflowRuns].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))) {
    if (!latestRunPerWorkflow.has(run.workflow_id)) latestRunPerWorkflow.set(run.workflow_id, run);
  }
  if (latestRunPerWorkflow.size > 0) {
    const successful = [...latestRunPerWorkflow.values()].filter(run => run.conclusion === 'success').length;
    meta.ciRunSuccessRate = successful / latestRunPerWorkflow.size;
  }
  meta.licenseYear = detectLicenseYear(licenseFiles.find(text => text !== null) ?? null);
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

      if (meta.angular === null && frontendPackageJson !== null) {
        // If root package.json doesn't have Angular, check frontend one
        const frontendPkg = JSON.parse(frontendPackageJson);
        meta.angular = detectAngular(frontendPkg);
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
  const javaFrameworks = [];
  if (pomXml) {
    if (!meta.mavenVersion) {
      meta.mavenVersion = detectMavenVersion(pomXml);
    }
    meta.javaVersion = detectJavaVersion(pomXml);
    const javaFramework = detectJavaFramework(pomXml);
    if (javaFramework) {
      javaFrameworks.push({ name: javaFramework, version: detectJavaFrameworkVersion(pomXml, javaFramework), runtime: 'Java' });
    }
    if (meta.javaVersion) {
      javaFrameworks.push({ name: 'Java', version: meta.javaVersion });
    }
  }

  // PHP detection: only via a PHP image in docker-compose.yml
  if (dockerCompose !== null) {
    meta.phpVersion = detectPhpVersionFromDockerCompose(dockerCompose);
  }

  meta.hasAngular = meta.angular !== null;
  if (meta.hasAngular) {
    meta.frameworks.push({ name: 'Angular', version: meta.angular });
  }
  meta.frameworks.push(...javaFrameworks);
  if (meta.phpVersion) {
    meta.frameworks.push({ name: 'PHP', version: meta.phpVersion });
  }
  meta.frameworksLabel = formatFrameworksLabel(meta.frameworks);

  const health = calculateHealthScore(repo, meta);
  meta.healthScore = health.score;
  meta.health = health;

  return { repo, meta };
}

/**
 * Whether a Java framework is present in meta.frameworks.
 * @param {object} meta
 * @returns {boolean}
 */
function hasJavaFramework(meta) {
  return Array.isArray(meta.frameworks) && meta.frameworks.some(fw => fw.runtime === 'Java');
}

/**
 * Build the display label for a list of frameworks, e.g. "Spring Boot (4.1.2), Java (21)".
 * @param {Array<{name: string, version: string|null, runtime?: string}>} frameworks
 * @returns {string}
 */
export function formatFrameworksLabel(frameworks) {
  return frameworks
    .map(fw => (fw.version ? `${fw.name} (${fw.version})` : fw.name))
    .join(', ');
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
