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

    repos.push(...data.filter(r => !r.fork));
    if (data.length < 100) break;
    page++;
  }

  return repos;
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
