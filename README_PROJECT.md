# Developer Dashboard

A comprehensive developer dashboard that displays analytics and information about all public repositories.

## Features

- **KPI Section**: Total repos, total stars, average health score, and top 5 languages
- **Repository Table**: Name, description, language, stars, topics, Angular/Maven/Node.js/pnpm versions, Java framework, and health score
- **Interactive Filtering**: Filter by repository name or topic
- **Sortable Columns**: Click any column header to sort
- **Responsive Design**: Works on mobile and desktop
- **Dark/Light Theme**: Follows system preference

## File Structure

```none
dashboard.mjs          – Main entry point (generates dist/index.html)
src/api.mjs            – GitHub API client
src/analyzer.mjs       – Technology detection and health scoring
src/generator.mjs      – HTML/CSS/JS generation
test/                  – node:test unit tests
.github/workflows/     – CI/CD pipeline (deploys to gh-pages)
```

### Local Development

```bash
# Without a token (lower rate limit)
node dashboard.mjs

# With a GitHub token (recommended)
GITHUB_TOKEN=ghp_your_token_here node dashboard.mjs
```

The generated dashboard is written to `dist/index.html`. Open it in any browser.

### Tests

```bash
npm test
```

Runs the `node:test` suite in `test/`, focused on the health-scoring logic in `src/analyzer.mjs`.

### Health scoring model

Each repository's health score is computed from a list of **criteria**, not from fixed additive points. Every criterion looks like:

```js
{
  id: 'angular-version',
  category: 'angular',
  label: 'Angular version',
  applicable: true,   // false when the technology isn't used by this repo
  score: 100,          // 0-100, or null when not applicable
  weight: 15,
  contribution: 1500,  // score * weight, 0 when not applicable
}
```

The final score is the **weighted average of applicable criteria only**:

```
score = round( sum(score * weight for applicable criteria) / sum(weight for applicable criteria) )
```

clamped to the 0-100 range (0 if there are no applicable criteria at all).

Two groups of criteria exist:

- **General criteria** – applicable to (almost) every repository: recent activity, description, README, CI/CD, license, topics, community signal (stars).
- **Technology criteria** – only added when the corresponding technology is actually detected (via already-fetched files, no extra API calls): Node.js (`package.json`), Angular (`@angular/core` dependency), Maven/Java (`pom.xml` / Maven wrapper), and PHP (framework config marker).

A technology that is **absent** is excluded entirely (`applicable: false`, `score: null`) and never lowers the score. A technology that is **present but missing a required value** (e.g. a `pom.xml` without a discoverable Maven version) stays `applicable: true` with a low/zero score, so it is scored differently from "not used at all". This means a JavaScript-only repository can reach the same maximum score (100) as a Java/Maven/Angular repository, as long as it satisfies the criteria that are actually relevant to it.

Version-based criteria (Node.js, Angular, Maven, Java) are scored via centralized policy thresholds in `VERSION_POLICIES` (in `src/analyzer.mjs`), so thresholds can be tuned in one place. Malformed/unparsable version strings are handled safely and scored distinctly from a missing version.

`analyzeRepo()` exposes both the existing flat `meta.healthScore` (for backward compatibility) and the full structured result at `meta.health = { score, technologies, criteria }`.

### CI/CD

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Runs on every push to `main`
2. Generates the dashboard using the `GITHUB_TOKEN` secret
3. Deploys `dist/index.html` to the `gh-pages` branch

<!--
**inpercima/inpercima** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.
-->
