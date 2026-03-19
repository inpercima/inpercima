/**
 * Repository analyzer: extracts version info and calculates health scores.
 */

import { fetchFileContent } from "./api.mjs";

/**
 * Extract Angular version from package.json content.
 * @param {object} pkg
 * @returns {string|null}
 */
function detectAngular(pkg) {
  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  const version = deps?.["@angular/core"];
  if (!version) return null;
  return version.replace(/[\^~>=<]/g, "").trim();
}

/**
 * Extract Node.js engine requirement from package.json content.
 * @param {object} pkg
 * @returns {string|null}
 */
function detectNodeVersion(pkg) {
  return pkg?.engines?.node ?? null;
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
  if (/spring-boot/i.test(content)) return "Spring Boot";
  if (/quarkus/i.test(content)) return "Quarkus";
  if (/micronaut/i.test(content)) return "Micronaut";
  if (/helidon/i.test(content)) return "Helidon";
  return null;
}

/**
 * Default weights for the health score calculation.
 * Each weight is a fraction of the total score (0–1), and all weights should sum to 1.0.
 *
 * @typedef {object} ActivityThreshold
 * @property {number} days        - Maximum age in days for this tier to apply.
 * @property {number} multiplier  - Fraction of the activity weight awarded (0–1).
 *
 * @typedef {object} ActivityWeightConfig
 * @property {number} weight                          - Fraction of total score (0–1).
 * @property {object} thresholds
 * @property {ActivityThreshold} thresholds.excellent
 * @property {ActivityThreshold} thresholds.good
 * @property {ActivityThreshold} thresholds.fair
 * @property {ActivityThreshold} thresholds.poor
 *
 * @typedef {object} SimpleWeightConfig
 * @property {number} weight  - Fraction of total score (0–1).
 *
 * @typedef {object} StarsWeightConfig
 * @property {number} weight    - Fraction of total score (0–1).
 * @property {number} maxStars  - Star count that earns the full weight.
 *
 * @typedef {object} HealthScoreWeights
 * @property {ActivityWeightConfig} recentActivity
 * @property {SimpleWeightConfig}   description
 * @property {SimpleWeightConfig}   readme
 * @property {SimpleWeightConfig}   cicd
 * @property {SimpleWeightConfig}   topics
 * @property {SimpleWeightConfig}   license
 * @property {StarsWeightConfig}    stars
 */

/** @type {HealthScoreWeights} */
export const defaultWeights = {
  recentActivity: {
    weight: 0.3,
    thresholds: {
      excellent: { days: 30, multiplier: 1.0 },
      good: { days: 90, multiplier: 0.67 },
      fair: { days: 180, multiplier: 0.33 },
      poor: { days: 365, multiplier: 0.17 },
    },
  },
  description: { weight: 0.1 },
  readme: { weight: 0.1 },
  cicd: { weight: 0.2 },
  topics: { weight: 0.1 },
  license: { weight: 0.1 },
  stars: { weight: 0.1, maxStars: 10 },
};

/**
 * Calculate a health score (0–100) for a repository based on several signals.
 * Weights control how much each factor contributes to the final score.
 * For best results, all weights should sum to 1.0; the caller is responsible
 * for ensuring this when providing custom weights.
 *
 * @param {object}             repo     Raw GitHub repo object
 * @param {object}             meta     Derived metadata (hasCI, hasReadme, etc.)
 * @param {HealthScoreWeights} [weights] Optional custom weights; defaults to {@link defaultWeights}
 * @returns {number}
 */
export function calculateHealthScore(repo, meta, weights = defaultWeights) {
  let score = 0;

  // Recent activity
  const daysSinceUpdate = (Date.now() - new Date(repo.pushed_at).getTime()) / (1000 * 60 * 60 * 24);
  const { thresholds } = weights.recentActivity;
  let activityMultiplier = 0;
  if (daysSinceUpdate < thresholds.excellent.days) activityMultiplier = thresholds.excellent.multiplier;
  else if (daysSinceUpdate < thresholds.good.days) activityMultiplier = thresholds.good.multiplier;
  else if (daysSinceUpdate < thresholds.fair.days) activityMultiplier = thresholds.fair.multiplier;
  else if (daysSinceUpdate < thresholds.poor.days) activityMultiplier = thresholds.poor.multiplier;
  score += weights.recentActivity.weight * activityMultiplier * 100;

  // Description present
  if (repo.description) score += weights.description.weight * 100;

  // README present
  if (meta.hasReadme) score += weights.readme.weight * 100;

  // CI/CD setup
  if (meta.hasCI) score += weights.cicd.weight * 100;

  // Has topics/tags
  if (repo.topics && repo.topics.length > 0) score += weights.topics.weight * 100;

  // Has license
  if (repo.license) score += weights.license.weight * 100;

  // Stars as social proof (guard against maxStars being 0)
  if (weights.stars.maxStars > 0) {
    const starFraction = Math.min(repo.stargazers_count, weights.stars.maxStars) / weights.stars.maxStars;
    score += weights.stars.weight * starFraction * 100;
  }

  return Math.round(Math.min(score, 100));
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
  };

  // Fetch files in parallel where possible
  const [rootPackageJson, frontendPackageJson, rootPomXml, backendPomXml, rootMavenWrapperProps, backendMavenWrapperProps, readmeText, nodeCi, javaCi] = await Promise.all([
    fetchFileContent(username, name, "package.json", token),
    fetchFileContent(username, name, "frontend/package.json", token),
    fetchFileContent(username, name, "pom.xml", token),
    fetchFileContent(username, name, "backend/pom.xml", token),
    fetchFileContent(username, name, ".mvn/wrapper/maven-wrapper.properties", token),
    fetchFileContent(username, name, "backend/.mvn/wrapper/maven-wrapper.properties", token),
    fetchFileContent(username, name, "README.md", token),
    fetchFileContent(username, name, ".github/workflows/node_ci.yml", token),
    fetchFileContent(username, name, ".github/workflows/java_ci.yaml", token),
  ]);

  meta.hasReadme = readmeText !== null;
  meta.hasCI = nodeCi !== null || javaCi !== null;

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
  const avgHealth = totalRepos > 0
    ? Math.round(analyzed.reduce((sum, { meta }) => sum + meta.healthScore, 0) / totalRepos)
    : 0;

  // Tally language counts
  const langCounts = {};
  for (const { repo } of analyzed) {
    if (repo.language) {
      langCounts[repo.language] = (langCounts[repo.language] ?? 0) + 1;
    }
  }
  const topLanguages = Object.entries(langCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([lang, count]) => ({ lang, count }));

  return { totalRepos, totalStars, avgHealth, topLanguages };
}
