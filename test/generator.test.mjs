import test from 'node:test';
import assert from 'node:assert/strict';
import { generateDashboard } from '../src/generator.mjs';

test('dashboard renders each repository health breakdown and its weighted formula', () => {
  const analyzed = [
    {
      repo: { name: 'first-repo', html_url: 'https://example.com/first', topics: [], stargazers_count: 3 },
      meta: {
        healthScore: 88,
        health: {
          criteria: [
            { id: 'description', category: 'general', label: 'Description', applicable: true, score: 100, weight: 10, contribution: 1000 },
            { id: 'node-version', category: 'node', label: 'Node.js version', applicable: true, score: 80, weight: 15, contribution: 1200 },
            { id: 'angular-version', category: 'angular', label: 'Angular version', applicable: false, score: null, weight: 15, contribution: 0 },
          ],
        },
      },
    },
    {
      repo: { name: 'second-repo', html_url: 'https://example.com/second', topics: [], stargazers_count: 4 },
      meta: {
        healthScore: 64,
        health: {
          criteria: [
            { id: 'activity', category: 'general', label: 'Recent activity', applicable: true, score: 40, weight: 30, contribution: 1200 },
            { id: 'ci', category: 'general', label: 'CI/CD', applicable: true, score: 100, weight: 20, contribution: 2000 },
          ],
        },
      },
    },
  ];
  const stats = { totalRepos: 2, totalStars: 7, avgHealth: 76, topPrimaryLanguages: [], topLanguages: [] };

  const html = generateDashboard(analyzed, stats, '2026-10-24');

  assert.equal((html.match(/class="detail-row hidden"/g) || []).length, analyzed.length);
  assert.match(html, /id="detail-0"/);
  assert.match(html, /id="detail-1"/);
  assert.match(html, /Description<\/td>/);
  assert.match(html, /Node\.js<\/td>/);
  assert.match(html, /Angular<\/td>[\s\S]*?nicht anwendbar/);
  assert.match(html, /totalScore = Σ\(score × weight\) = 2200;[\s\S]*?totalWeight = Σ\(weight\) = 25;[\s\S]*?healthScore = round\(2200 \/ 25\) = 88/);
  assert.match(html, /totalScore = Σ\(score × weight\) = 3200;[\s\S]*?totalWeight = Σ\(weight\) = 50;[\s\S]*?healthScore = round\(3200 \/ 50\) = 64/);
  assert.match(html, /text-amber-400/);
});

test('dashboard shows the consolidated Frameworks and Health columns', () => {
  const html = generateDashboard([
    {
      repo: { name: 'versions', html_url: 'https://example.com/versions', topics: [], stargazers_count: 1 },
      meta: {
        frameworksLabel: 'Node.js (22), pnpm (10.32.0), Maven (3.9.9), Maven Wrapper (3.3.2)',
        healthScore: 90,
        health: { criteria: [] },
      },
    },
  ], { totalRepos: 1, totalStars: 1, avgHealth: 90, topPrimaryLanguages: [], topLanguages: [] }, '2026-10-24');

  assert.match(html, /data-col="4">Frameworks<\/th>/);
  assert.match(html, /data-col="5">Health<\/th>/);
  assert.doesNotMatch(html, /data-col="[67]"/);
  assert.match(html, /colspan="6"/);
  assert.match(html, /new Set\(\[1, 3, 4\]\)/);
  assert.match(html, /Node\.js \(22\), pnpm \(10\.32\.0\), Maven \(3\.9\.9\), Maven Wrapper \(3\.3\.2\)/);
});
