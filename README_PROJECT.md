### Hi there 👋

[![GitHub stats](https://github-readme-stats.vercel.app/api?username=inpercima&show_icons=true&theme=radical)](https://github.com/anuraghazra/github-readme-stats)

[![Top Langs](https://github-readme-stats.vercel.app/api/top-langs/?username=inpercima&layout=compact&theme=radical)](https://github.com/anuraghazra/github-readme-stats)

---

## Developer Dashboard

A comprehensive developer dashboard that displays analytics and information about all public repositories.

### Features

- **KPI Section**: Total repos, total stars, average health score, and top 5 languages
- **Repository Table**: Name, description, language, stars, topics, Angular/Maven/Node.js/pnpm versions, Java framework, and health score
- **Interactive Filtering**: Filter by repository name or topic
- **Sortable Columns**: Click any column header to sort
- **Responsive Design**: Works on mobile and desktop
- **Dark/Light Theme**: Follows system preference

### File Structure

```
dashboard.mjs          – Main entry point (generates dist/index.html)
src/api.mjs            – GitHub API client
src/analyzer.mjs       – Version detection and health scoring
src/generator.mjs      – HTML/CSS/JS generation
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

### CI/CD

The GitHub Actions workflow (`.github/workflows/deploy.yml`) automatically:

1. Runs on every push to `main`
2. Generates the dashboard using the `GITHUB_TOKEN` secret
3. Deploys `dist/index.html` to the `gh-pages` branch

<!--
**inpercima/inpercima** is a ✨ _special_ ✨ repository because its `README.md` (this file) appears on your GitHub profile.
-->
