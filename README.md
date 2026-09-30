# 📊 Developer Dashboard

> 🤖 Auto-generated from GitHub API &nbsp;·&nbsp; 🗓️ Last updated: **2026-09-30**
>
> 🔗 [View Full Dashboard](https://inpercima.github.io/inpercima)

## 🔢 KPIs

| 🗂️ Repositories | ⭐ Total Stars | 💚 Avg. Health Score |
| :-: | :-: | :-: |
| **24** | **21** | **66 / 100** |

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
| [davengo-results](https://github.com/inpercima/davengo-results) | TypeScript | ⭐ 0 | 🟢 96 |
| [explore-tmdb](https://github.com/inpercima/explore-tmdb) | TypeScript | ⭐ 0 | 🟢 96 |
| [mc-status](https://github.com/inpercima/mc-status) | TypeScript | ⭐ 0 | 🟢 96 |
| [mdrza-ranking](https://github.com/inpercima/mdrza-ranking) | TypeScript | ⭐ 0 | 🟢 96 |
| [mittagstisch](https://github.com/inpercima/mittagstisch) | Java | ⭐ 3 | 🟢 95 |

## 💚 Health Score Calculation

The health score is a **weighted average** (0–100) that evaluates repository quality based on signals that apply to all repositories plus technology-specific metrics detected in each repo.

### General Criteria (Technology-Agnostic)

Every repository is evaluated against these criteria:

| Criterion | Scoring Logic | Weight |
|-----------|---------------|--------|
| **Recent Activity** | < 30 days: 100, < 90 days: 70, < 180 days: 40, < 365 days: 15, else: 0 | 25 |
| **CI/CD Pipeline** | Present: 100, Absent: 0 | 20 |
| **Description** | Present: 100, Absent: 0 | 10 |
| **README** | Present: 100, Absent: 0 | 10 |
| **License** | Present: 100, Absent: 0 | 10 |
| **Topics** | ≥ 1 topic: 100, None: 0 | 10 |
| **Community Signal (Stars)** | `min(100, stargazers_count × 10)` | 5 |
| | **Total General Weight** | **90** |

### Technology-Specific Criteria

Additional criteria are only included if their technology is **actually detected** in the repository. This prevents penalizing projects for missing irrelevant tools.

**Node.js / TypeScript:**

| Criterion | Scoring Logic | Weight |
|-----------|---------------|--------|
| **Node.js Version** | 24+: 100, 22+: 90, 20+: 75, 18+: 50, else: 25 | 15 |
| **npm Scripts** | Configured: 100, Absent: 0 | 5 |
| | **Subtotal** | **20** |

**Java / Maven:**

| Criterion | Scoring Logic | Weight |
|-----------|---------------|--------|
| **Maven Version** | 3.9+: 100, 3.8+: 85, 3.6+: 70, else: 25 | 15 |
| **Java Version** | 21+: 100, 17+: 85, 11+: 70, else: 25 | 15 |
| **Dependency Management** | Configured: 100, Absent: 0 | 5 |
| **Java Build Config** | Present: 100, Absent: 0 | 5 |
| | **Subtotal** | **40** |

### Calculation Formula

```
Health Score = Σ(score × weight) / Σ(weight)
```

where only **applicable** criteria (technology-detected or general) contribute.

**Pseudocode:**
```javascript
applicableCriteria = criteria where applicable = true
totalWeight = sum of all applicable weights
totalScore = sum of (score × weight) for each applicable criterion
healthScore = round(totalScore / totalWeight)  // capped to 0–100
```

### Example 1: **mittagstisch** (Java + Spring Boot) → 96/100

**Repository Facts:**
- Language: Java
- Last push: 2026-09-03 (27 days ago)
- Stars: 3
- Has: Description ✅, README ✅, License (MIT) ✅, Topics ✅, CI/CD ✅
- Detected: Maven 3.9.3, Java 25, Dependency Management ✅

**Scoring Breakdown:**

| Criterion | Score | Weight | Contribution |
|-----------|-------|--------|--------------|
| Recent Activity (< 30d) | 100 | 25 | 2500 |
| CI/CD Pipeline | 100 | 20 | 2000 |
| Description | 100 | 10 | 1000 |
| README | 100 | 10 | 1000 |
| License | 100 | 10 | 1000 |
| Topics | 100 | 10 | 1000 |
| Community Signal (3 × 10) | 30 | 5 | 150 |
| Maven Version (3.9+) | 100 | 15 | 1500 |
| Java Version (21+) | 100 | 15 | 1500 |
| Dependency Management | 100 | 5 | 500 |
| Java Build Config | 100 | 5 | 500 |
| | | **Total Weight: 125** | **Total Score: 12,050** |

**Calculation:**
```
Health Score = 12,050 / 125 = 96.4 → rounded to 96
```

### Example 2: **mdrza-ranking** (TypeScript + Angular) → 96/100

**Repository Facts:**
- Language: TypeScript
- Last push: 2026-09-28 (1 day ago)
- Stars: 0
- Has: Description ✅, README ✅, License (MIT) ✅, Topics ✅, CI/CD ✅
- Detected: Node.js (engine configured), npm scripts ✅

**Scoring Breakdown:**

| Criterion | Score | Weight | Contribution |
|-----------|-------|--------|--------------|
| Recent Activity (< 30d) | 100 | 25 | 2500 |
| CI/CD Pipeline | 100 | 20 | 2000 |
| Description | 100 | 10 | 1000 |
| README | 100 | 10 | 1000 |
| License | 100 | 10 | 1000 |
| Topics | 100 | 10 | 1000 |
| Community Signal (0 × 10) | 0 | 5 | 0 |
| Node.js Version (configured) | 100 | 15 | 1500 |
| npm Scripts | 100 | 5 | 500 |
| | | **Total Weight: 110** | **Total Score: 10,500** |

**Calculation:**
```
Health Score = 10,500 / 110 = 95.45 → rounded to 96
```

### Why Different Total Weights?

- **mittagstisch (125):** General criteria (90) + Java/Maven criteria (35)
- **mdrza-ranking (110):** General criteria (90) + Node.js criteria (20)

*The weight difference reflects that Java projects have more technology-specific evaluation points (Maven, Java, Dependency Mgmt, Build Config) than Node.js projects (Node version, npm scripts).*

### Key Design Principles

1. **Only applicable criteria count:** A pure JavaScript project is not penalized for lacking Maven or Java criteria.
2. **Transparent weighting:** Each signal has an explicit weight reflecting its importance.
3. **Version policies:** Tech version scores are determined by a central policy (see `VERSION_POLICIES` in the analyzer).
4. **Normalized 0–100:** The final score is always a 0–100 integer, making health scores comparable across all repositories.
