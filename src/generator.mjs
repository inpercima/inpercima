/**
 * HTML/CSS/JS dashboard generator.
 * Styling uses Tailwind CSS (CDN) utility classes.
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
  let color;
  if (score >= 75) color = "#22c55e";       // green
  else if (score >= 50) color = "#f59e0b";  // amber
  else if (score >= 25) color = "#f97316";  // orange
  else color = "#ef4444";                   // red

  return `<span class="inline-block rounded px-2 py-0.5 text-xs font-semibold" style="background:${color}20;color:${color};border:1px solid ${color}40">${score}</span>`;
}

/**
 * Render a single table row.
 * @param {object} repo
 * @param {object} meta
 * @returns {string}
 */
function renderRow(repo, meta) {
  const topics = (repo.topics || [])
    .map(t => `<span class="inline-block bg-blue-500/10 text-blue-400 border border-blue-500/20 rounded px-1.5 py-0.5 text-xs mb-0.5">${esc(t)}</span>`)
    .join(" ");

  const languagesHtml = (meta.languages && meta.languages.length > 0)
    ? meta.languages.map(l => {
        const pct = meta.languagePercentages?.[l];
        const label = pct != null ? `${esc(l)}/${pct}%` : esc(l);
        return `<span class="inline-block bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs mb-0.5">${label}</span>`;
      }).join(" ")
    : repo.language
      ? `<span class="inline-block bg-slate-700 border border-slate-600 rounded px-2 py-0.5 text-xs">${esc(repo.language)}</span>`
      : "–";

  const tdBase = "py-3 px-4 align-top border-t border-slate-700 group-hover:bg-slate-800/50";

  const cells = [
    `<td class="${tdBase}">
       <a href="${esc(repo.html_url)}" target="_blank" rel="noopener noreferrer" class="font-semibold text-blue-400 hover:underline">${esc(repo.name)}</a>
       ${repo.description ? `<div class="text-xs text-slate-400 mt-0.5 max-w-xs hidden sm:block">${esc(repo.description)}</div>` : ""}
     </td>`,
    `<td class="${tdBase}">${languagesHtml}</td>`,
    `<td class="${tdBase}">${repo.stargazers_count}</td>`,
    `<td class="${tdBase}">${topics || "–"}</td>`,
    `<td class="${tdBase}">${meta.angular ? esc(meta.angular) : "–"}</td>`,
    `<td class="${tdBase}">${meta.mavenVersion ? esc(meta.mavenVersion) : "–"}</td>`,
    `<td class="${tdBase}">${meta.nodeVersion ? esc(meta.nodeVersion) : "–"}</td>`,
    `<td class="${tdBase}">${meta.pnpmVersion ? esc(meta.pnpmVersion) : "–"}</td>`,
    `<td class="${tdBase}">${meta.javaFramework ? esc(meta.javaFramework) : "–"}</td>`,
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
  const langBars = stats.topLanguages.map(({ lang, count }) => {
    const pct = stats.totalRepos > 0 ? Math.round((count / stats.totalRepos) * 100) : 0;
    return `
      <div class="flex items-center gap-2 mb-1.5">
        <span class="w-20 text-xs">${esc(lang)}</span>
        <div class="flex-1 h-1.5 bg-slate-700 rounded-full overflow-hidden">
          <div class="h-full bg-gradient-to-r from-blue-500 to-indigo-500 rounded-full" style="width:${pct}%"></div>
        </div>
        <span class="text-xs text-slate-400 w-10 text-right">${pct}%</span>
      </div>`;
  }).join("");

  const langCounts = stats.topLanguages.map(({ lang, count }) => `
      <div class="flex items-center justify-between mb-1.5">
        <span class="text-xs">${esc(lang)}</span>
        <span class="text-xs text-slate-400">${count}</span>
      </div>`).join("");

  const cardClass = "bg-slate-800 border border-slate-700 rounded-xl p-5";

  return `
    <div class="grid grid-cols-2 lg:grid-cols-5 gap-4 mb-8">
      <div class="${cardClass}">
        <div class="text-4xl font-bold leading-none mb-1">${stats.totalRepos}</div>
        <div class="text-xs uppercase tracking-wider text-slate-400">Repositories</div>
      </div>
      <div class="${cardClass}">
        <div class="text-4xl font-bold leading-none mb-1">${stats.totalStars}</div>
        <div class="text-xs uppercase tracking-wider text-slate-400">Total Stars</div>
      </div>
      <div class="${cardClass}">
        <div class="text-4xl font-bold leading-none mb-1">${stats.avgHealth}<span class="text-base font-normal text-slate-400">/100</span></div>
        <div class="text-xs uppercase tracking-wider text-slate-400">Avg. Health Score</div>
      </div>
      <div class="${cardClass}">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-3">Top Languages</div>
        ${langCounts}
      </div>
      <div class="${cardClass}">
        <div class="text-xs uppercase tracking-wider text-slate-400 mb-3">% Usage of Languages</div>
        ${langBars}
      </div>
    </div>`;
}

const TH_BASE = "py-3 px-4 text-left text-xs uppercase tracking-wider text-slate-400 whitespace-nowrap cursor-pointer select-none hover:text-slate-200 transition-colors";
const TH_SORTED = "py-3 px-4 text-left text-xs uppercase tracking-wider text-blue-400 whitespace-nowrap cursor-pointer select-none hover:text-blue-300 transition-colors";

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

  const langTable = stats.topLanguages
    .map(({ lang, count }) => {
      const pct = stats.totalRepos > 0 ? Math.round((count / stats.totalRepos) * 100) : 0;
      const filled = Math.min(20, Math.round(pct / 5));
      return `| ${lang} | ${count} | ${"█".repeat(filled)}${"░".repeat(20 - filled)} ${pct}% |`;
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

## 🌐 Top Languages

| Language | Repos | Distribution |
| -------- | :---: | ------------ |
${langTable}

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
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Inpercima – Developer Dashboard</title>
  <script src="https://cdn.tailwindcss.com"><\/script>
  <script>
    tailwind.config = { darkMode: 'media' }
  <\/script>
</head>
<body class="bg-slate-950 text-slate-200 min-h-screen text-sm">
<div class="max-w-screen-2xl mx-auto px-6 py-12">

  <header class="mb-8">
    <h1 class="text-4xl font-bold mb-1">Inpercima</h1>
    <p class="text-slate-400 text-sm">Developer Dashboard &mdash; Auto-generated from GitHub API &middot; ${esc(generatedAt)}</p>
  </header>

  ${renderKpis(stats)}

  <div class="flex gap-3 mb-5 flex-wrap">
    <input id="searchInput" type="text" placeholder="Filter by name or topic…" aria-label="Filter repositories"
      class="flex-1 min-w-[200px] max-w-sm px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 transition-colors" />
  </div>

  <div class="overflow-x-auto border border-slate-700 rounded-xl">
    <table class="w-full border-collapse">
      <thead class="bg-slate-800/50">
        <tr>
          <th class="${TH_BASE}" data-col="0">Repository</th>
          <th class="${TH_BASE}" data-col="1">Language</th>
          <th class="${TH_SORTED}" data-col="2">Stars ▼</th>
          <th class="${TH_BASE}" data-col="3">Topics</th>
          <th class="${TH_BASE}" data-col="4">Angular</th>
          <th class="${TH_BASE}" data-col="5">Maven</th>
          <th class="${TH_BASE}" data-col="6">Node.js</th>
          <th class="${TH_BASE}" data-col="7">pnpm</th>
          <th class="${TH_BASE}" data-col="8">Java FW</th>
          <th class="${TH_BASE}" data-col="9">Health</th>
        </tr>
      </thead>
      <tbody id="repoBody">
        ${rows}
      </tbody>
    </table>
    <div id="noResults" class="text-center py-12 text-slate-400" style="display:none">No repositories match your filter.</div>
  </div>

  <footer class="mt-8 text-center text-xs text-slate-400">
    Generated on ${esc(generatedAt)} &middot;
    <a href="https://github.com/inpercima" target="_blank" rel="noopener noreferrer" class="text-blue-400 hover:underline">github.com/inpercima</a>
  </footer>

</div>

<script>
(function() {
  const TH_BASE = "${TH_BASE}";
  const TH_SORTED = "${TH_SORTED}";

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
        h.className = TH_BASE;
        h.textContent = h.textContent.replace(/ [▲▼]$/, "");
      });
      th.className = TH_SORTED;
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
