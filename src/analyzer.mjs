/**
 * Repository analyzer: extracts version info and calculates health scores.
 */

import { fetchFileContent, fetchLanguages } from './api.mjs';

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
 * Calculate a health score (0–100) for a repository based on several signals.
 * @param {object} repo  Raw GitHub repo object
 * @param {object} meta  Derived metadata (hasCI, hasReadme, etc.)
 * @returns {number}
 */
export function calculateHealthScore(repo, meta) {
  let score = 0;

  // Recent activity (up to 30 points)
  const daysSinceUpdate = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
  if (daysSinceUpdate < 30) score += 30;
  else if (daysSinceUpdate < 90) score += 20;
  else if (daysSinceUpdate < 180) score += 10;
  else if (daysSinceUpdate < 365) score += 5;

  // Description present (10 points)
  if (repo.description) score += 10;

  // README present (10 points)
  if (meta.hasReadme) score += 10;

  // CI/CD setup (20 points)
  if (meta.hasCI) score += 20;

  // node version >= 24 (2 points)
  if (meta.nodeVersion) {
    const major = parseInt(meta.nodeVersion.split('.')[0]);
    if (major >= 24) score += 2;
  }

  // angular version (up to 4 points)
  if (meta.angular) {
    const major = parseInt(meta.angular.split('.')[0]);
    if (major >= 21) score += 4;
    else if (major >= 20) score += 2;
  }

  // Has topics/tags (10 points)
  if (repo.topics && repo.topics.length > 0) score += 10;

  // Has license (10 points)
  if (repo.license) score += 10;

  // Stars as social proof (up to 10 points)
  score += Math.min(repo.stargazers_count, 10);

  return Math.min(score, 100);
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
    angular: null,
    nodeVersion: null,
    pnpmVersion: null,
    mavenVersion: null,
    javaFramework: null,
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
    fetchLanguages(username, name, token),
  ]);

  meta.hasReadme = readmeText !== null;
  meta.hasCI = nodeCi !== null || javaCi !== null;
  meta.languages = Object.keys(languagesData).sort((a, b) => languagesData[b] - languagesData[a]);
  const totalBytes = Object.values(languagesData).reduce((sum, b) => sum + b, 0);
  meta.languagePercentages = {};
  if (totalBytes > 0) {
    for (const [lang, bytes] of Object.entries(languagesData)) {
      meta.languagePercentages[lang] = Math.round((bytes / totalBytes) * 100);
    }
  }

  const packageJson = rootPackageJson || frontendPackageJson;
  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      meta.angular = detectAngular(pkg);
      meta.nodeVersion = detectNodeVersion(pkg);

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
  if (pomXml) {
    if (!meta.mavenVersion) {
      meta.mavenVersion = detectMavenVersion(pomXml);
    }
    meta.javaFramework = detectJavaFramework(pomXml);
  }

  meta.healthScore = calculateHealthScore(repo, meta);

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
