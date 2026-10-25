/**
 * GitHub API client for fetching repository data.
 */

const BASE_URL = "https://api.github.com";

/**
 * Build request headers, including optional token auth.
 * @param {string|undefined} token
 * @returns {Record<string, string>}
 */
function buildHeaders(token) {
  const headers = { Accept: "application/vnd.github+json" };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

/**
 * Fetch all public (non-fork) repositories for the given user.
 * Handles pagination automatically.
 * @param {string} username
 * @param {string|undefined} token
 * @returns {Promise<object[]>}
 */
export async function fetchRepos(username, token) {
  const headers = buildHeaders(token);
  const repos = [];
  let page = 1;

  while (true) {
    const url = `${BASE_URL}/users/${username}/repos?per_page=100&page=${page}&type=public`;
    const res = await fetch(url, { headers });

    if (!res.ok) {
      throw new Error(`GitHub API error ${res.status}: ${await res.text()}`);
    }

    const data = await res.json();
    if (!Array.isArray(data) || data.length === 0) break;

    // Only include non-fork repositories
    repos.push(...data.filter(r => !r.fork));
    if (data.length < 100) break;
    page++;
  }

  return repos;
}

/**
 * Fetch the language breakdown (bytes per language) for a repository.
 * Returns an object like { JavaScript: 12345, TypeScript: 6789 }, or {} on error.
 * @param {string} username
 * @param {string} repoName
 * @param {string|undefined} token
 * @returns {Promise<Record<string, number>>}
 */
export async function fetchLanguages(username, repoName, token) {
  const headers = buildHeaders(token);
  const url = `${BASE_URL}/repos/${username}/${repoName}/languages`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return {};
    return await res.json();
  } catch {
    return {};
  }
}

/**
 * Fetch the raw content of a file from a repository.
 * Returns null if the file does not exist (404) or on error.
 * @param {string} username
 * @param {string} repoName
 * @param {string} filePath
 * @param {string|undefined} token
 * @returns {Promise<string|null>}
 */
export async function fetchFileContent(username, repoName, filePath, token) {
  const headers = buildHeaders(token);
  const url = `${BASE_URL}/repos/${username}/${repoName}/contents/${filePath}`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;

    const data = await res.json();
    if (data.encoding === "base64" && data.content) {
      return Buffer.from(data.content, "base64").toString("utf-8");
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Fetch the most recent completed GitHub Actions workflow runs of a repository.
 * Returns an empty array on error (e.g. 403/404 or missing Actions access).
 * @param {string} username
 * @param {string} repoName
 * @param {string|undefined} token
 * @param {number} [perPage=30]
 * @returns {Promise<object[]>}
 */
export async function fetchWorkflowRuns(username, repoName, token, perPage = 30) {
  const headers = buildHeaders(token);
  const url = `${BASE_URL}/repos/${username}/${repoName}/actions/runs?per_page=${perPage}&status=completed`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const data = await res.json();
    return Array.isArray(data.workflow_runs) ? data.workflow_runs : [];
  } catch {
    return [];
  }
}

/**
 * Fetch the workflow files (.yml/.yaml) in `.github/workflows` including their content.
 * Returns an empty array if the directory does not exist or on error.
 * @param {string} username
 * @param {string} repoName
 * @param {string|undefined} token
 * @returns {Promise<Array<{name: string, content: string|null}>>}
 */
export async function fetchWorkflowFiles(username, repoName, token) {
  const headers = buildHeaders(token);
  const url = `${BASE_URL}/repos/${username}/${repoName}/contents/.github/workflows`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return [];
    const entries = await res.json();
    if (!Array.isArray(entries)) return [];

    const files = entries.filter(e => e.type === "file" && /\.ya?ml$/i.test(e.name));
    return await Promise.all(
      files.map(async file => ({
        name: file.name,
        content: await fetchFileContent(username, repoName, `.github/workflows/${file.name}`, token),
      })),
    );
  } catch {
    return [];
  }
}

/**
 * Fetch the major version of the latest `actions/checkout` release.
 * Returns null if it cannot be determined.
 * @param {string|undefined} token
 * @returns {Promise<number|null>}
 */
export async function fetchLatestCheckoutMajor(token) {
  const headers = buildHeaders(token);
  const url = `${BASE_URL}/repos/actions/checkout/releases/latest`;

  try {
    const res = await fetch(url, { headers });
    if (!res.ok) return null;
    const data = await res.json();
    const match = /^v?(\d+)/.exec(data.tag_name || "");
    return match ? Number(match[1]) : null;
  } catch {
    return null;
  }
}
