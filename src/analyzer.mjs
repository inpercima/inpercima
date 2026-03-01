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
 * Extract pnpm version from packageManager field in package.json.
 * @param {object} pkg
 * @returns {string|null}
 */
function detectPnpmVersion(pkg) {
  const pm = pkg?.packageManager ?? "";
  if (!pm.startsWith("pnpm@")) return null;
  return pm.replace("pnpm@", "").trim();
}

/**
 * Extract Maven version from pom.xml content.
 * @param {string} pomXml
 * @returns {string|null}
 */
function detectMavenVersion(pomXml) {
  const match = pomXml.match(/<maven\.version>(.*?)<\/maven\.version>/);
  if (match) return match[1].trim();
  const wrapperMatch = pomXml.match(/<distributionUrl>[^<]*apache-maven-([\d.]+)-bin/);
  if (wrapperMatch) return wrapperMatch[1].trim();
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
  };

  // Fetch files in parallel where possible
  const [packageJson, pomXml, readmeText, ciYml, ciYaml] = await Promise.all([
    fetchFileContent(username, name, "package.json", token),
    fetchFileContent(username, name, "pom.xml", token),
    fetchFileContent(username, name, "README.md", token),
    fetchFileContent(username, name, ".github/workflows/ci.yml", token),
    fetchFileContent(username, name, ".github/workflows/ci.yaml", token),
  ]);

  meta.hasReadme = readmeText !== null;
  meta.hasCI = ciYml !== null || ciYaml !== null;

  if (packageJson) {
    try {
      const pkg = JSON.parse(packageJson);
      meta.angular = detectAngular(pkg);
      meta.nodeVersion = detectNodeVersion(pkg);
      meta.pnpmVersion = detectPnpmVersion(pkg);
    } catch {
      // Malformed package.json – skip
    }
  }

  if (pomXml) {
    meta.mavenVersion = detectMavenVersion(pomXml);
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
