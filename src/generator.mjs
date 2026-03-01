/**
 * HTML/CSS/JS dashboard generator.
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
  else color = "#ef4444";                    // red

  return `<span class="health-badge" style="background:${color}20;color:${color};border:1px solid ${color}40">${score}</span>`;
}

/**
 * Render a single table row.
 * @param {object} repo
 * @param {object} meta
 * @returns {string}
 */
function renderRow(repo, meta) {
  const topics = (repo.topics || [])
    .map(t => `<span class="tag">${esc(t)}</span>`)
    .join(" ");

  const languages = repo.language ? `<span class="lang-chip">${esc(repo.language)}</span>` : "–";

  const cells = [
    `<td class="repo-name"><a href="${esc(repo.html_url)}" target="_blank" rel="noopener noreferrer">${esc(repo.name)}</a>
      ${repo.description ? `<div class="repo-desc">${esc(repo.description)}</div>` : ""}
    </td>`,
    `<td>${languages}</td>`,
    `<td>${repo.stargazers_count}</td>`,
    `<td class="topics-cell">${topics || "–"}</td>`,
    `<td>${meta.angular ? esc(meta.angular) : "–"}</td>`,
    `<td>${meta.mavenVersion ? esc(meta.mavenVersion) : "–"}</td>`,
    `<td>${meta.nodeVersion ? esc(meta.nodeVersion) : "–"}</td>`,
    `<td>${meta.pnpmVersion ? esc(meta.pnpmVersion) : "–"}</td>`,
    `<td>${meta.javaFramework ? esc(meta.javaFramework) : "–"}</td>`,
    `<td class="health-cell">${healthBadge(meta.healthScore)}</td>`,
  ];

  return `<tr data-topics="${esc((repo.topics || []).join(","))}" data-name="${esc(repo.name)}">${cells.join("")}</tr>`;
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
      <div class="lang-row">
        <span class="lang-label">${esc(lang)}</span>
        <div class="lang-bar-track">
          <div class="lang-bar-fill" style="width:${pct}%"></div>
        </div>
        <span class="lang-count">${count}</span>
      </div>`;
  }).join("");

  return `
    <div class="kpi-grid">
      <div class="kpi-card">
        <div class="kpi-value">${stats.totalRepos}</div>
        <div class="kpi-label">Repositories</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${stats.totalStars}</div>
        <div class="kpi-label">Total Stars</div>
      </div>
      <div class="kpi-card">
        <div class="kpi-value">${stats.avgHealth}<span class="kpi-unit">/100</span></div>
        <div class="kpi-label">Avg. Health Score</div>
      </div>
      <div class="kpi-card kpi-langs">
        <div class="kpi-label kpi-langs-title">Top Languages</div>
        ${langBars}
      </div>
    </div>`;
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
  <style>
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

    :root {
      --bg: #0f172a;
      --surface: #1e293b;
      --surface2: #263349;
      --border: #334155;
      --text: #e2e8f0;
      --muted: #94a3b8;
      --accent: #3b82f6;
      --accent2: #6366f1;
      --green: #22c55e;
      --amber: #f59e0b;
    }

    @media (prefers-color-scheme: light) {
      :root {
        --bg: #f1f5f9;
        --surface: #ffffff;
        --surface2: #f8fafc;
        --border: #e2e8f0;
        --text: #0f172a;
        --muted: #64748b;
      }
    }

    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      background: var(--bg);
      color: var(--text);
      min-height: 100vh;
      font-size: 14px;
    }

    .container { max-width: 1400px; margin: 0 auto; padding: 2rem 1.5rem; }

    header { margin-bottom: 2rem; }
    header h1 { font-size: 2rem; font-weight: 700; margin-bottom: .25rem; }
    header p { color: var(--muted); font-size: .875rem; }

    /* KPI Grid */
    .kpi-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
      margin-bottom: 2rem;
    }

    .kpi-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: .75rem;
      padding: 1.25rem 1.5rem;
    }

    .kpi-value { font-size: 2rem; font-weight: 700; line-height: 1; margin-bottom: .25rem; }
    .kpi-unit { font-size: 1rem; font-weight: 400; color: var(--muted); }
    .kpi-label { font-size: .75rem; text-transform: uppercase; letter-spacing: .05em; color: var(--muted); }
    .kpi-langs-title { margin-bottom: .75rem; }

    .lang-row { display: flex; align-items: center; gap: .5rem; margin-bottom: .4rem; }
    .lang-label { width: 80px; font-size: .8rem; }
    .lang-bar-track { flex: 1; height: 6px; background: var(--border); border-radius: 99px; overflow: hidden; }
    .lang-bar-fill { height: 100%; background: linear-gradient(90deg, var(--accent), var(--accent2)); border-radius: 99px; }
    .lang-count { font-size: .75rem; color: var(--muted); width: 24px; text-align: right; }

    /* Filters */
    .filters { display: flex; gap: .75rem; margin-bottom: 1.25rem; flex-wrap: wrap; }
    .filter-input {
      flex: 1;
      min-width: 200px;
      max-width: 400px;
      padding: .5rem .75rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: .5rem;
      color: var(--text);
      font-size: .875rem;
      outline: none;
      transition: border-color .15s;
    }
    .filter-input:focus { border-color: var(--accent); }

    /* Table */
    .table-wrap { overflow-x: auto; border: 1px solid var(--border); border-radius: .75rem; }

    table { width: 100%; border-collapse: collapse; }
    thead { background: var(--surface2); }
    th {
      padding: .75rem 1rem;
      text-align: left;
      font-size: .75rem;
      text-transform: uppercase;
      letter-spacing: .05em;
      color: var(--muted);
      white-space: nowrap;
      cursor: pointer;
      user-select: none;
    }
    th:hover { color: var(--text); }
    th.sorted { color: var(--accent); }
    th .sort-arrow { margin-left: .25rem; opacity: .6; }

    td { padding: .75rem 1rem; border-top: 1px solid var(--border); vertical-align: top; }
    tr:hover td { background: var(--surface2); }

    .repo-name a { font-weight: 600; color: var(--accent); text-decoration: none; }
    .repo-name a:hover { text-decoration: underline; }
    .repo-desc { font-size: .8rem; color: var(--muted); margin-top: .2rem; max-width: 28ch; }

    .tag {
      display: inline-block;
      background: rgba(59,130,246,.15);
      color: #60a5fa;
      border: 1px solid rgba(59,130,246,.25);
      border-radius: .375rem;
      padding: .1rem .4rem;
      font-size: .7rem;
      margin-bottom: .2rem;
    }

    .lang-chip {
      display: inline-block;
      background: var(--surface2);
      border: 1px solid var(--border);
      border-radius: .375rem;
      padding: .1rem .5rem;
      font-size: .75rem;
    }

    .health-badge {
      display: inline-block;
      border-radius: .375rem;
      padding: .2rem .6rem;
      font-size: .75rem;
      font-weight: 600;
    }

    .no-results { text-align: center; padding: 3rem; color: var(--muted); }

    footer { margin-top: 2rem; text-align: center; font-size: .75rem; color: var(--muted); }

    @media (max-width: 768px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .repo-desc { display: none; }
    }
  </style>
</head>
<body>
<div class="container">

  <header>
    <h1>Inpercima</h1>
    <p>Developer Dashboard &mdash; Auto-generated from GitHub API &middot; ${esc(generatedAt)}</p>
  </header>

  ${renderKpis(stats)}

  <div class="filters">
    <input id="searchInput" class="filter-input" type="text" placeholder="Filter by name or topic…" aria-label="Filter repositories" />
  </div>

  <div class="table-wrap">
    <table id="repoTable">
      <thead>
        <tr>
          <th data-col="0">Repository</th>
          <th data-col="1">Language</th>
          <th data-col="2" class="sorted">Stars ▼</th>
          <th data-col="3">Topics</th>
          <th data-col="4">Angular</th>
          <th data-col="5">Maven</th>
          <th data-col="6">Node.js</th>
          <th data-col="7">pnpm</th>
          <th data-col="8">Java FW</th>
          <th data-col="9">Health</th>
        </tr>
      </thead>
      <tbody id="repoBody">
        ${rows}
      </tbody>
    </table>
    <div id="noResults" class="no-results" style="display:none">No repositories match your filter.</div>
  </div>

  <footer>
    Generated on ${esc(generatedAt)} &middot;
    <a href="https://github.com/inpercima" target="_blank" rel="noopener noreferrer" style="color:var(--accent)">github.com/inpercima</a>
  </footer>

</div>

<script>
(function() {
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
        h.classList.remove("sorted");
        // Remove trailing arrow from label
        h.textContent = h.textContent.replace(/ [▲▼]$/, "");
      });
      th.classList.add("sorted");
      th.textContent = th.textContent.replace(/ [▲▼]$/, "") + (sortAsc ? " ▲" : " ▼");
      sortRows();
    });
  });

  searchInput.addEventListener("input", applyFilter);

  // Initial sort
  sortRows();
})();
</script>
</body>
</html>`;
}
