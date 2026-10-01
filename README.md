# 📊 Developer Dashboard

> 🤖 Auto-generated from GitHub API &nbsp;·&nbsp; 🗓️ Last updated: **2026-10-01**
>
> 🔗 [View Full Dashboard](https://inpercima.github.io/inpercima)

## 🔢 KPIs

| 🗂️ Repositories | ⭐ Total Stars | 💚 Avg. Health Score |
| :-: | :-: | :-: |
| **24** | **21** | **67 / 100** |

## 🏷️ Primary Languages

| Language | Repos | Distribution |
| -------- | :---: | ------------ |
| TypeScript | 11 | █████████░░░░░░░░░░░ |
| Java | 4 | ███░░░░░░░░░░░░░░░░░ |
| JavaScript | 4 | ███░░░░░░░░░░░░░░░░░ |
| HTML | 2 | ██░░░░░░░░░░░░░░░░░░ |
| Dockerfile | 1 | █░░░░░░░░░░░░░░░░░░░ |

## 📊 Language Usage

| Language | Distribution | Repos |
| -------- | ------------ | ----- |
| JavaScript | ███████████████░░░░░ | 18 of 24 repos (75%) |
| HTML | ██████████████░░░░░░ | 17 of 24 repos (71%) |
| TypeScript | █████████████░░░░░░░ | 16 of 24 repos (67%) |
| CSS | █████████████░░░░░░░ | 16 of 24 repos (67%) |
| SCSS | ██████████░░░░░░░░░░ | 12 of 24 repos (50%) |

## 🏆 Top 5 by Health Score

| Repository | Language | Stars | Health |
| ---------- | -------- | :---: | :----: |
| [davengo-results](https://github.com/inpercima/davengo-results) | TypeScript | ⭐ 0 | 🟢 98 |
| [explore-tmdb](https://github.com/inpercima/explore-tmdb) | TypeScript | ⭐ 0 | 🟢 98 |
| [mc-status](https://github.com/inpercima/mc-status) | TypeScript | ⭐ 0 | 🟢 98 |
| [mdrza-ranking](https://github.com/inpercima/mdrza-ranking) | TypeScript | ⭐ 0 | 🟢 98 |
| [mittagstisch](https://github.com/inpercima/mittagstisch) | Java | ⭐ 3 | 🟢 95 |

## 💚 Health Score Calculation

The health score is a weighted average from 0 to 100. Every repository receives the general criteria below. Technology-specific criteria are included only when that technology is detected; criteria for technologies that are not detected do not affect the score.

### General Criteria

| Criterion | Scoring | Weight |
| --------- | ------- | :----: |
| Recent activity | Updated less than 30 days ago: 100; less than 90 days: 70; less than 180 days: 40; less than 365 days: 15; otherwise: 0 | 30 |
| CI/CD | Detected CI workflow: 100; otherwise: 0 | 20 |
| Description | Present: 100; absent: 0 | 10 |
| README | Present: 100; absent: 0 | 10 |
| License | Present: 100; absent: 0 | 10 |
| Topics | At least one: 100; none: 0 | 10 |

The general criteria have a total weight of 90.

### Technology-Specific Criteria

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
| Maven | Dependency management | `<dependencyManagement>` detected in `pom.xml`: 100; otherwise: 0 | 5 |
| Java | Java version | Version policy below | 15 |
| Java | Java build configuration | Java CI workflow or a recognized Java framework detected: 100; otherwise: 0 | 5 |

Detection is based on repository metadata and configuration files: Node.js uses a root or `frontend/package.json`; Angular uses `@angular/core` in either package file; pnpm requires a version match in the README; PHP uses a matching root `docker-compose.yml` image or the `api/config/config.default.php` fallback. Maven and Java are both detected from a root/backend `pom.xml` or Maven wrapper. For Java build configuration, recognized frameworks are Spring Boot, Quarkus, Micronaut, and Helidon. Technology-specific criteria are excluded when detection returns false. In particular, pnpm is included only when its version is found in the README.

Version policies award the score for the highest matching minimum version; a version below the lowest listed threshold scores 25:

| Technology | Minimum version → score |
| ---------- | ----------------------- |
| Node.js | 26 → 100; 24 → 90; 22 → 80; 20 → 70; 18 → 50 |
| pnpm | 12 → 100; 11 → 90; 9 → 80; 7 → 70; 6 → 50 |
| Angular | 22 → 100; 20 → 90; 18 → 80; 16 → 70 |
| PHP | 8.2 → 100; 8.1 → 90; 8.0 → 75; 7.4 → 50 |
| Maven | 3.9 → 100; 3.8 → 85; 3.6 → 70 |
| Java | 27 → 100; 25 → 90; 21 → 80; 17 → 70; 11 → 50 |

For a detected technology, a missing version scores 0 and an unparsable version scores 40. PHP's configuration-file fallback marks PHP as detected with an `unknown` version, so its version criterion receives the unparsable-version score of 40.

### Formula

Only applicable criteria contribute:

`totalScore = sum(score * weight)`

`totalWeight = sum(weight)`

`healthScore = min(100, max(0, round(totalScore / totalWeight)))`

If there are no applicable criteria, the score is 0. Since the criteria are selected per repository, total weight varies with the technologies detected; for example, Maven and Java each add 20, while Angular adds 20 and pnpm adds 10.

### Worked Examples

The following calculations use explicitly illustrative inputs to demonstrate the formula; they are not claims about the repositories' current metadata. On regeneration, detected criteria and their scores are calculated from the metadata available at that time.

**mittagstisch — illustrative scenario with Maven and Java detected**

| Criteria | Illustrative scores × weights | Contribution |
| -------- | ----------------------------- | :----------: |
| General | 70×25 + 100×20 + 100×10 + 100×10 + 100×10 + 0×10 + 20×5 | 6,850 |
| Maven | 100×15 + 100×5 | 2,000 |
| Java | 90×15 + 0×5 | 1,350 |
| **Total** | **Total weight: 90 + 20 + 20 = 130** | **10,200** |

`round(10,200 / 130) = 78`

**mdrza-ranking — illustrative scenario with Node.js, pnpm, and Angular detected**

| Criteria | Illustrative scores × weights | Contribution |
| -------- | ----------------------------- | :----------: |
| General | 100×25 + 100×20 + 100×10 + 100×10 + 100×10 + 100×10 + 0×5 | 8,500 |
| Node.js | 90×15 + 100×5 | 1,850 |
| pnpm | 80×10 | 800 |
| Angular | 90×15 + 100×5 | 1,850 |
| **Total** | **Total weight: 90 + 20 + 10 + 20 = 140** | **13,000** |

`round(13,000 / 140) = 93`
