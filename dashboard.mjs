#!/usr/bin/env node
/**
 * Developer Dashboard Generator
 *
 * Fetches all public repositories for inpercima, analyses them,
 * and writes a self-contained HTML dashboard to dist/index.html.
 *
 * Usage:
 *   node dashboard.mjs
 *   GITHUB_TOKEN=ghp_... node dashboard.mjs
 */

import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fetchRepos } from "./src/api.mjs";
import { analyzeRepo, aggregateStats } from "./src/analyzer.mjs";
import { generateDashboard } from "./src/generator.mjs";

const USERNAME = "inpercima";
const OUT_DIR = "dist";
const OUT_FILE = join(OUT_DIR, "index.html");
const TOKEN = process.env.GITHUB_TOKEN;

async function main() {
  console.log(`Fetching repositories for ${USERNAME}…`);
  const repos = await fetchRepos(USERNAME, TOKEN);
  console.log(`Found ${repos.length} public repositories.`);

  console.log("Analyzing repositories (fetching config files)…");
  const analysisResults = await Promise.all(
    repos.map(repo => analyzeRepo(USERNAME, repo, TOKEN))
  );

  // Sort by stars descending by default
  analysisResults.sort((a, b) => b.repo.stargazers_count - a.repo.stargazers_count);

  const stats = aggregateStats(analysisResults);
  const generatedAt = new Date().toISOString().split("T")[0];

  console.log(`Generating dashboard…`);
  const html = generateDashboard(analysisResults, stats, generatedAt);

  await mkdir(OUT_DIR, { recursive: true });
  await writeFile(OUT_FILE, html, "utf-8");

  console.log(`Dashboard written to ${OUT_FILE}`);
  console.log(`Stats: ${stats.totalRepos} repos, ${stats.totalStars} stars, avg health ${stats.avgHealth}/100`);
}

main().catch(err => {
  console.error("Dashboard generation failed:", err);
  process.exit(1);
});
