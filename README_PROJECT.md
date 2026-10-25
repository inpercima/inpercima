# Developer Dashboard

A comprehensive developer dashboard that displays analytics and information about all public repositories.

## Features

- **KPI Section**: Total repos, total stars, average health score, and top 5 languages
- **Repository Table**: Name, description, language, stars, topics, Angular/Maven/Node.js/pnpm versions, Java framework, and health score
- **Interactive Filtering**: Filter by repository name or topic
- **Sortable Columns**: Click any column header to sort
- **Health Score Details**: Expand a repository row to see its criteria and score calculation
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

## How dashboard values are calculated

### Dashboard KPIs and languages

- **Repositories** counts the public, non-fork repositories returned by GitHub.
- **Total stars** sums the repositories' GitHub star counts.
- **Average health score** is the rounded arithmetic mean of the individual repository scores.
- **Primary languages** counts each repository's leading language, based on its GitHub language data (falling back to the repository's declared language).
- **Language usage** counts every language reported for each repository. The percentage is the number of repositories using that language divided by the total repository count.

The dashboard shows the five most frequent entries in each language list. All displayed figures are recalculated when the dashboard is generated.

### Health score model

Each repository's health score is computed from criteria rather than fixed additive points. A criterion records its score, weight, whether it applies, and its weighted contribution. For example:

```js
{
  id: 'angular-version',
  category: 'angular',
  label: 'Angular version',
  applicable: true,
  score: 100,
  weight: 15,
  contribution: 1500,
}
```

General criteria apply to every repository. Technology-specific criteria apply only when that technology is detected. An absent technology does not affect the score; if a technology is detected but a required value is missing, its criterion still applies and receives the missing-value score.

#### General criteria

| Criterion | Scoring | Weight |
| --------- | ------- | :----: |
| Recent activity | Last push less than 30 days ago: 100; less than 90 days: 70; less than 180 days: 40; less than 365 days: 15; otherwise: 0 | 30 |
| Description | Present: 100; absent: 0 | 10 |
| README | Present: 100; absent: 0 | 10 |
| License | Absent: 0; present with the copyright year (from `LICENSE`, `LICENSE.md` or `LICENSE.txt`, end year of a range) equal to the current year: 100; present with an older or undetectable year: 50 | 10 |
| Topics | At least one: 100; none: 0 | 10 |

These criteria have a combined weight of 70.

CI/CD is optional. If the repository has CI workflows (files in `.github/workflows`, falling back to `node_ci.yml`/`java_ci.yaml`), two additional criteria apply; without CI they are not applicable and neither penalize nor count towards the weight:

| Criterion | Scoring | Weight |
| --------- | ------- | :----: |
| CI/CD runs successful | Share of workflows whose latest completed run has `conclusion === 'success'` (×100); no runs found: 0 | 10 |
| actions/checkout up to date | Share of `uses: actions/checkout@vX` entries on the latest major version (fetched from the `actions/checkout` latest release, fallback `FALLBACK_CHECKOUT_MAJOR`) (×100); no entries: 100 | 10 |

With CI the general criteria have a combined weight of 90.

#### Technology-specific criteria

| Detected technology | Criterion | Scoring | Weight |
| ------------------- | --------- | ------- | :----: |
| Node.js | Node.js version | Version policy below | 15 |
| Node.js | npm scripts | At least one script configured: 100; otherwise: 0 | 5 |
| pnpm | pnpm version | Version policy below | 10 |
| Angular | Angular version | Version policy below | 15 |
| Angular | Angular CLI/build tooling | `@angular/cli` or `@angular-devkit/build-angular` configured: 100; otherwise: 0 | 5 |
| PHP | PHP version | Version policy below | 15 |
| PHP | PHP configuration | PHP configuration file detected: 100; otherwise: 0 | 5 |
| Maven | Maven version | Version policy below | 15 |
| Java | Java version | Version policy below | 15 |
| Java | Java build configuration | Java CI workflow or a recognized Java framework detected: 100; otherwise: 0 | 5 |

Node.js is detected from a root or `frontend/package.json`; Angular is detected from `@angular/core` in either file; pnpm is detected when a `pnpm@<version>` string is present in the README. PHP is detected from a recognized PHP image in the root `docker-compose.yml`, the `api/config/config.default.php` file, or PHP among the repository's reported languages. Maven and Java are both detected from a root/backend `pom.xml` or Maven wrapper. Recognized Java frameworks are Spring Boot, Quarkus, Micronaut, and Helidon. For a detected technology, its criteria apply even when a value is missing.

#### Version policies

The highest matching minimum version determines the score. A version below the lowest listed threshold scores 25; a missing version scores 0; an unparsable version scores 40.

| Technology | Minimum version → score |
| ---------- | ----------------------- |
| Node.js | 26 → 100; 24 → 90; 22 → 80; 20 → 70; 18 → 50 |
| pnpm | 12 → 100; 11 → 90; 9 → 80; 7 → 70; 6 → 50 |
| Angular | 22 → 100; 20 → 90; 18 → 80; 16 → 70 |
| PHP | 8.2 → 100; 8.1 → 90; 8.0 → 75; 7.4 → 50 |
| Maven | 3.9 → 100; 3.8 → 85; 3.6 → 70 |
| Java | 27 → 100; 25 → 90; 21 → 80; 17 → 70; 11 → 50 |

Version thresholds are centralized in `VERSION_POLICIES` in `src/analyzer.mjs`. PHP detected from a configuration file or language data without a discoverable version is assigned `unknown`, which receives the unparsable-version score of 40.

#### Formula

Only applicable criteria contribute:

```text
totalScore = sum(score * weight)
totalWeight = sum(weight)
healthScore = min(100, max(0, round(totalScore / totalWeight)))
```

If no criteria apply, the score is 0. The total weight varies by repository: Maven adds 15, Java adds 20, CI/CD adds 20, Angular adds 20, Node.js adds 20, PHP adds 20, and pnpm adds 10. `analyzeRepo()` exposes the score as `meta.healthScore` and the detailed result as `meta.health = { score, technologies, criteria }`.

#### Worked examples

These illustrative inputs demonstrate the formula; they are not claims about current repository metadata.

**Example with Maven and Java detected**

| Criteria | Illustrative scores × weights | Contribution |
| -------- | ----------------------------- | :----------: |
| General (incl. CI) | 70×30 + 100×10 + 100×10 + 100×10 + 100×10 + 100×10 + 0×10 | 7,100 |
| Maven | 100×15 | 1,500 |
| Java | 90×15 + 0×5 | 1,350 |
| **Total** | **Total weight: 90 + 15 + 20 = 125** | **9,950** |

`round(9,950 / 125) = 80`

**Example with Node.js, pnpm, and Angular detected**

| Criteria | Illustrative scores × weights | Contribution |
| -------- | ----------------------------- | :----------: |
| General (no CI) | 100×30 + 100×10 + 100×10 + 100×10 + 100×10 | 7,000 |
| Node.js | 90×15 + 100×5 | 1,850 |
| pnpm | 80×10 | 800 |
| Angular | 90×15 + 100×5 | 1,850 |
| **Total** | **Total weight: 70 + 20 + 10 + 20 = 120** | **11,500** |

`round(11,500 / 120) = 96`

### CI/CD

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Runs on every push to `main`
2. Generates the dashboard using the `GITHUB_TOKEN` secret
3. Deploys `dist/index.html` to the `gh-pages` branch

<!--
**inpercima/inpercima** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.
-->
