/**
 * HTML/CSS/JS dashboard generator.
 * Styling uses Tailwind CSS (CDN) and daisyUI (CDN) utility classes and components.
 */

/**
 * Escape text for safe insertion into HTML content.
 * @param {string|null|undefined} str
 * @returns {string}
 */
function esc(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#x27;");
}

/**
 * Build the health-score badge HTML.
 * @param {number} score 0-100
 * @returns {string}
 */
function healthBadge(score) {
  let cls;
  if (score >= 75) cls = "badge badge-success";
  else if (score >= 50) cls = "badge badge-warning";
  else if (score >= 25) cls = "badge badge-error badge-outline";
  else cls = "badge badge-error";
  return `<span class="${cls}">${score}</span>`;
}

/**
 * Render a single table row.
 * @param {object} repo
 * @param {object} meta
 * @returns {string}
 */
function renderRow(repo, meta) {
  const topics = (repo.topics || [])
    .map(t => `<span class="badge badge-outline badge-info mb-0.5">${esc(t)}</span>`)
    .join(" ");

  const languagesHtml = (meta.languages && meta.languages.length > 0)
    ? meta.languages.map(l => {
        const pct = meta.languagePercentages?.[l];
        const label = pct != null ? `${esc(l)}/${pct}%` : esc(l);
        return `<span class="badge badge-neutral mb-0.5">${label}</span>`;
      }).join(" ")
    : repo.language
      ? `<span class="badge badge-neutral">${esc(repo.language)}</span>`
      : "–";

  const tdBase = "align-top group-hover:bg-base-200/50";
  const tdHidden = `hidden sm:table-cell ${tdBase}`;

  const cells = [
    `<td class="${tdBase}">
       <a href="${esc(repo.html_url)}" target="_blank" rel="noopener noreferrer" class="font-semibold link link-primary">${esc(repo.name)}</a>
       ${meta.angular ? `<div class="text-xs opacity-50 mt-0.5 sm:hidden">Angular ${esc(meta.angular)}</div>` : ""}
       ${meta.nodeVersion ? `<div class="text-xs opacity-50 mt-0.5 sm:hidden">Node.js ${esc(meta.nodeVersion)}</div>` : ""}
       ${repo.language ? `<div class="text-xs opacity-50 mt-0.5 sm:hidden" aria-hidden="true">${esc(repo.language)}</div>` : ""}
       ${repo.description ? `<div class="text-xs opacity-60 mt-0.5 max-w-xs hidden sm:block">${esc(repo.description)}</div>` : ""}
     </td>`,
    `<td class="${tdHidden}">${languagesHtml}</td>`,
    `<td class="${tdBase}">${repo.stargazers_count}</td>`,
    `<td class="${tdHidden}">${topics || "–"}</td>`,
    `<td class="${tdHidden}">${meta.angular ? esc(meta.angular) : "–"}</td>`,
    `<td class="${tdHidden}">${meta.mavenVersion ? esc(meta.mavenVersion) : "–"}</td>`,
    `<td class="${tdHidden}">${meta.nodeVersion ? esc(meta.nodeVersion) : "–"}</td>`,
    `<td class="${tdHidden}">${meta.pnpmVersion ? esc(meta.pnpmVersion) : "–"}</td>`,
    `<td class="${tdHidden}">${meta.javaFramework ? esc(meta.javaFramework) : "–"}</td>`,
    `<td class="${tdBase}">${healthBadge(meta.healthScore)}</td>`,
  ];

  return `<tr class="group" data-topics="${esc((repo.topics || []).join(","))}" data-name="${esc(repo.name)}">${cells.join("")}</tr>`;
}

/**
 * Render the KPI cards section.
 * @param {object} stats
 * @returns {string}
 */
function renderKpis(stats) {
  const primaryLangBars = stats.topPrimaryLanguages.map(({ lang, count }) => {
    const pct = stats.totalRepos > 0 ? Math.round((count / stats.totalRepos) * 100) : 0;
    return `
      <div class="flex items-center gap-2 mb-1.5">
        <span class="w-20 text-xs truncate">${esc(lang)}</span>
        <progress class="progress progress-secondary flex-1" value="${pct}" max="100"></progress>
        <span class="text-xs opacity-60 w-6 text-right">${count}</span>
      </div>`;
  }).join("");

  const langUsageBars = stats.topLanguages.map(({ lang, count }) => {
    const pct = stats.totalRepos > 0 ? Math.round((count / stats.totalRepos) * 100) : 0;
    return `
      <div class="flex items-center gap-2 mb-1.5">
        <span class="w-20 text-xs truncate">${esc(lang)}</span>
        <progress class="progress progress-primary flex-1" value="${pct}" max="100"></progress>
        <span class="text-xs opacity-60 whitespace-nowrap" aria-label="${count} of ${stats.totalRepos} repos">${count}/${stats.totalRepos}</span>
      </div>`;
  }).join("");

  const cardClass = "card bg-base-200 shadow-sm";
  const kpiLabel = "text-xs uppercase tracking-wider opacity-60";

  return `
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <div class="${cardClass}">
        <div class="card-body p-5">
          <div class="text-4xl font-bold leading-none mb-1">${stats.totalRepos}</div>
          <p class="${kpiLabel}">Repositories</p>
        </div>
      </div>
      <div class="${cardClass}">
        <div class="card-body p-5">
          <div class="text-4xl font-bold leading-none mb-1">${stats.totalStars}</div>
          <p class="${kpiLabel}">Total Stars</p>
        </div>
      </div>
      <div class="${cardClass}">
        <div class="card-body p-5">
          <div class="text-4xl font-bold leading-none mb-1">${stats.avgHealth}<span class="text-base font-normal opacity-60">/100</span></div>
          <p class="${kpiLabel}">Avg. Health Score</p>
        </div>
      </div>
      <div class="${cardClass}">
        <div class="card-body p-5">
          <p class="${kpiLabel} mb-3">🏷️ Primary Languages</p>
          ${primaryLangBars}
        </div>
      </div>
      <div class="${cardClass}">
        <div class="card-body p-5">
          <p class="${kpiLabel} mb-3">📊 Language Usage</p>
          ${langUsageBars}
        </div>
      </div>
    </div>`;
}

const TH_BASE = "whitespace-nowrap cursor-pointer select-none opacity-60 hover:opacity-100 transition-opacity";
const TH_SORTED = "whitespace-nowrap cursor-pointer select-none text-primary";
const TH_HIDDEN = `hidden sm:table-cell ${TH_BASE}`;
const TH_HIDDEN_SORTED = `hidden sm:table-cell ${TH_SORTED}`;

/**
 * Format a health score as an emoji + number string.
 * @param {number} score 0-100
 * @returns {string}
 */
function formatHealthScore(score) {
  if (score >= 75) return `🟢 ${score}`;
  if (score >= 50) return `🟡 ${score}`;
  return `🔴 ${score}`;
}

/**
 * Generate the README.md content with KPI info and top 5 repos by health score.
 * @param {Array<{repo: object, meta: object}>} analyzed
 * @param {object} stats  Aggregated KPI stats
 * @param {string} generatedAt  ISO date string
 * @returns {string}
 */
export function generateReadme(analyzed, stats, generatedAt) {
  const top5 = [...analyzed]
    .sort((a, b) => b.meta.healthScore - a.meta.healthScore)
    .slice(0, 5);

  const primaryLangTable = stats.topPrimaryLanguages
    .map(({ lang, count }) => {
      const filled = stats.totalRepos > 0 ? Math.min(20, Math.round((count / stats.totalRepos) * 20)) : 0;
      return `| ${lang} | ${count} | ${"█".repeat(filled)}${"░".repeat(20 - filled)} |`;
    })
    .join("\n");

  const langUsageTable = stats.topLanguages
    .map(({ lang, count }) => {
      const pct = stats.totalRepos > 0 ? Math.round((count / stats.totalRepos) * 100) : 0;
      const filled = Math.min(20, Math.round(pct / 5));
      return `| ${lang} | ${"█".repeat(filled)}${"░".repeat(20 - filled)} | ${count} of ${stats.totalRepos} repos (${pct}%) |`;
    })
    .join("\n");

  const top5Rows = top5
    .map(({ repo, meta }) => {
      const health = formatHealthScore(meta.healthScore);
      const lang = repo.language || "–";
      const stars = repo.stargazers_count;
      return `| [${repo.name}](${repo.html_url}) | ${lang} | ⭐ ${stars} | ${health} |`;
    })
    .join("\n");

  return `# 📊 Developer Dashboard

> 🤖 Auto-generated from GitHub API &nbsp;·&nbsp; 🗓️ Last updated: **${generatedAt}**
>
> 🔗 [View Full Dashboard](https://inpercima.github.io/inpercima)

## 🔢 KPIs

| 🗂️ Repositories | ⭐ Total Stars | 💚 Avg. Health Score |
| :-: | :-: | :-: |
| **${stats.totalRepos}** | **${stats.totalStars}** | **${stats.avgHealth} / 100** |

## 🏷️ Primary Languages

| Language | Repos | Distribution |
| -------- | :---: | ------------ |
${primaryLangTable}

## 📊 Language Usage

| Language | Distribution | Repos |
| -------- | ------------ | ----- |
${langUsageTable}

## 🏆 Top 5 by Health Score

| Repository | Language | Stars | Health |
| ---------- | -------- | :---: | :----: |
${top5Rows}
`;
}

/**
 * Generate the full standalone HTML dashboard.
 * @param {Array<{repo: object, meta: object}>} analyzed  Sorted list of repos + meta
 * @param {object} stats  Aggregated KPI stats
 * @param {string} generatedAt  ISO date string
 * @returns {string}
 */
export function generateDashboard(analyzed, stats, generatedAt) {
  const rows = analyzed.map(({ repo, meta }) => renderRow(repo, meta)).join("\n");

  return `<!DOCTYPE html>
<html lang="en" data-theme="dark">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inpercima – Developer Dashboard</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/daisyui@4/dist/full.min.css" />
  <script src="https://cdn.tailwindcss.com"><\/script>
</head>
<body class="bg-base-100 text-base-content min-h-screen text-sm">
<div class="max-w-screen-2xl mx-auto px-6 py-12">

  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-1">Inpercima</h1>
    <p class="opacity-60 text-sm">Developer Dashboard &mdash; Auto-generated from GitHub API &middot; ${esc(generatedAt)}</p>
  </header>

  ${renderKpis(stats)}

  <div class="flex gap-3 mb-5 flex-wrap">
    <input id="searchInput" type="text" placeholder="Filter by name or topic…" aria-label="Filter repositories"
      class="input input-bordered input-sm flex-1 min-w-[200px] max-w-sm" />
  </div>

  <div class="overflow-x-auto border border-base-300 rounded-xl">
    <table class="table">
      <thead>
        <tr>
          <th class="${TH_BASE}" data-col="0">Repository</th>
          <th class="${TH_HIDDEN}" data-col="1">Language</th>
          <th class="${TH_SORTED}" data-col="2">Stars ▼</th>
          <th class="${TH_HIDDEN}" data-col="3">Topics</th>
          <th class="${TH_HIDDEN}" data-col="4">Angular</th>
          <th class="${TH_HIDDEN}" data-col="5">Maven</th>
          <th class="${TH_HIDDEN}" data-col="6">Node.js</th>
          <th class="${TH_HIDDEN}" data-col="7">pnpm</th>
          <th class="${TH_HIDDEN}" data-col="8">Java FW</th>
          <th class="${TH_BASE}" data-col="9">Health</th>
        </tr>
      </thead>
      <tbody id="repoBody">
        ${rows}
      </tbody>
    </table>
    <div id="noResults" class="text-center py-12 opacity-60" style="display:none">No repositories match your filter.</div>
  </div>

  <footer class="mt-8 text-center text-xs opacity-60">
    Generated on ${esc(generatedAt)} &middot;
    <a href="https://github.com/inpercima" target="_blank" rel="noopener noreferrer" class="link link-primary">github.com/inpercima</a>
  </footer>

</div>

<script>
(function() {
  const TH_BASE = "${TH_BASE}";
  const TH_SORTED = "${TH_SORTED}";
  const TH_HIDDEN = "${TH_HIDDEN}";
  const TH_HIDDEN_SORTED = "${TH_HIDDEN_SORTED}";
  // Columns hidden on mobile (< sm breakpoint). Must match the th/td elements
  // that carry the "hidden sm:table-cell" class in the HTML template above.
  const MOBILE_HIDDEN_COLS = new Set([1, 3, 4, 5, 6, 7, 8]);

  const searchInput = document.getElementById("searchInput");
  const tbody = document.getElementById("repoBody");
  const noResults = document.getElementById("noResults");
  const rows = Array.from(tbody.querySelectorAll("tr"));
  const headers = Array.from(document.querySelectorAll("th[data-col]"));

  let sortCol = 2;
  let sortAsc = false;

  function getCell(row, col) {
    return row.cells[col]?.textContent.trim() ?? "";
  }

  function sortRows() {
    const visible = rows.filter(r => r.style.display !== "none");
    visible.sort((a, b) => {
      const av = getCell(a, sortCol);
      const bv = getCell(b, sortCol);
      const an = parseFloat(av);
      const bn = parseFloat(bv);
      if (!isNaN(an) && !isNaN(bn)) return sortAsc ? an - bn : bn - an;
      return sortAsc ? av.localeCompare(bv) : bv.localeCompare(av);
    });
    visible.forEach(r => tbody.appendChild(r));
  }

  function applyFilter() {
    const q = searchInput.value.toLowerCase();
    let visible = 0;
    rows.forEach(r => {
      const name = r.dataset.name ?? "";
      const topics = r.dataset.topics ?? "";
      const match = !q || name.toLowerCase().includes(q) || topics.toLowerCase().includes(q);
      r.style.display = match ? "" : "none";
      if (match) visible++;
    });
    noResults.style.display = visible === 0 ? "" : "none";
    sortRows();
  }

  headers.forEach(th => {
    th.addEventListener("click", () => {
      const col = parseInt(th.dataset.col, 10);
      if (sortCol === col) {
        sortAsc = !sortAsc;
      } else {
        sortCol = col;
        sortAsc = col !== 2; // stars default desc
      }
      headers.forEach(h => {
        const c = parseInt(h.dataset.col, 10);
        h.className = MOBILE_HIDDEN_COLS.has(c) ? TH_HIDDEN : TH_BASE;
        h.textContent = h.textContent.replace(/ [▲▼]$/, "");
      });
      th.className = MOBILE_HIDDEN_COLS.has(col) ? TH_HIDDEN_SORTED : TH_SORTED;
      th.textContent = th.textContent.replace(/ [▲▼]$/, "") + (sortAsc ? " ▲" : " ▼");
      sortRows();
    });
  });

  searchInput.addEventListener("input", applyFilter);

  // Initial sort
  sortRows();
})();
<\/script>
</body>
</html>`;
}
