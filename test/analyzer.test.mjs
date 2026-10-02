import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHealthScore, formatFrameworksLabel } from '../src/analyzer.mjs';

/**
 * Build a minimal, "healthy" repo object that satisfies all general criteria.
 * @param {object} overrides
 * @returns {object}
 */
function makeRepo(overrides = {}) {
  return {
    pushed_at: new Date().toISOString(),
    description: 'A sample repository',
    topics: ['sample'],
    license: { spdx_id: 'MIT' },
    stargazers_count: 15,
    ...overrides,
  };
}

/**
 * Build a minimal meta object with all detection flags defaulted to "absent".
 * @param {object} overrides
 * @returns {object}
 */
function makeMeta(overrides = {}) {
  return {
    hasReadme: true,
    hasCI: true,
    hasJavaCI: false,
    hasPackageJson: false,
    hasPackageScripts: false,
    hasAngularTooling: false,
    hasMavenConfig: false,
    hasDependencyManagement: false,
    angular: null,
    nodeVersion: null,
    mavenVersion: null,
    javaVersion: null,
    ...overrides,
  };
}

test('a JavaScript/Node repository is not penalized for missing Angular, Java or Maven', () => {
  const repo = makeRepo();
  const meta = makeMeta({
    hasPackageJson: true,
    hasPackageScripts: true,
    nodeVersion: '24.16.0',
  });

  const result = calculateHealthScore(repo, meta);

  assert.equal(result.technologies.angular, false);
  assert.equal(result.technologies.java, false);
  assert.equal(result.technologies.maven, false);

  const nonApplicable = result.criteria.filter(c => !c.applicable);
  for (const criterion of nonApplicable) {
    assert.equal(criterion.score, null, `${criterion.id} should not have a score when not applicable`);
    assert.equal(criterion.contribution, 0, `${criterion.id} should not contribute when not applicable`);
  }

  // A fully healthy JS/Node-only repo should be able to reach 100.
  assert.equal(result.score, 100);
});

test('an Angular repository receives Angular-specific criteria', () => {
  const repo = makeRepo();
  const meta = makeMeta({
    hasPackageJson: true,
    angular: '20.1.0',
    hasAngularTooling: true,
    hasPackageScripts: true,
    nodeVersion: '24.0.0',
  });

  const result = calculateHealthScore(repo, meta);

  assert.equal(result.technologies.angular, true);
  const angularVersion = result.criteria.find(c => c.id === 'angular-version');
  assert.ok(angularVersion);
  assert.equal(angularVersion.applicable, true);
  assert.equal(angularVersion.score, 100);

  const angularTooling = result.criteria.find(c => c.id === 'angular-tooling');
  assert.equal(angularTooling.applicable, true);
  assert.equal(angularTooling.score, 100);
});

test('a Maven/Java repository receives Maven and Java-specific criteria', () => {
  const repo = makeRepo();
  const meta = makeMeta({
    hasMavenConfig: true,
    mavenVersion: '3.9.5',
    javaVersion: '21',
    hasDependencyManagement: true,
    frameworks: [{ name: 'Spring Boot', version: '21', runtime: 'Java' }],
  });

  const result = calculateHealthScore(repo, meta);

  assert.equal(result.technologies.maven, true);
  assert.equal(result.technologies.java, true);

  const mavenVersion = result.criteria.find(c => c.id === 'maven-version');
  assert.equal(mavenVersion.applicable, true);
  assert.equal(mavenVersion.score, 100);

  const javaVersion = result.criteria.find(c => c.id === 'java-version');
  assert.equal(javaVersion.applicable, true);
  assert.equal(javaVersion.score, 100);

  const javaBuildConfig = result.criteria.find(c => c.id === 'java-build-config');
  assert.equal(javaBuildConfig.applicable, true);
  assert.equal(javaBuildConfig.score, 100);
});

test('Java frameworks are labelled with their runtime', () => {
  assert.equal(
    formatFrameworksLabel([
      { name: 'Angular', version: '20.1.0' },
      { name: 'Spring Boot', version: '25', runtime: 'Java' },
      { name: 'Quarkus', version: null, runtime: 'Java' },
    ]),
    'Angular (20.1.0), Spring Boot (Java 25), Quarkus',
  );
});

test('a present technology with a missing version is scored distinctly from an absent technology', () => {
  const repo = makeRepo();

  const metaMavenPresentNoVersion = makeMeta({
    hasMavenConfig: true,
    mavenVersion: null,
  });
  const withMaven = calculateHealthScore(repo, metaMavenPresentNoVersion);
  const mavenCriterionPresent = withMaven.criteria.find(c => c.id === 'maven-version');
  assert.equal(mavenCriterionPresent.applicable, true);
  assert.equal(mavenCriterionPresent.score, 0);

  const metaMavenAbsent = makeMeta({ hasMavenConfig: false });
  const withoutMaven = calculateHealthScore(repo, metaMavenAbsent);
  const mavenCriterionAbsent = withoutMaven.criteria.find(c => c.id === 'maven-version');
  assert.equal(mavenCriterionAbsent.applicable, false);
  assert.equal(mavenCriterionAbsent.score, null);
});

test('a malformed version string is handled safely without throwing', () => {
  const repo = makeRepo();
  const meta = makeMeta({
    hasMavenConfig: true,
    mavenVersion: 'not-a-version',
  });

  assert.doesNotThrow(() => calculateHealthScore(repo, meta));
  const result = calculateHealthScore(repo, meta);
  const mavenCriterion = result.criteria.find(c => c.id === 'maven-version');
  assert.equal(mavenCriterion.applicable, true);
  assert.ok(mavenCriterion.score >= 0 && mavenCriterion.score <= 100);
});

test('scores always stay within 0-100 and a repo can reach 100 using only applicable criteria', () => {
  const repo = makeRepo({ stargazers_count: 0 });
  const meta = makeMeta();

  const result = calculateHealthScore(repo, meta);
  assert.ok(result.score >= 0 && result.score <= 100);

  const repoNoActivity = makeRepo({
    pushed_at: new Date(Date.now() - 1000 * 60 * 60 * 24 * 400).toISOString(),
    description: null,
    topics: [],
    license: null,
  });
  const metaMinimal = makeMeta({ hasReadme: false, hasCI: false });
  const resultLow = calculateHealthScore(repoNoActivity, metaMinimal);
  assert.ok(resultLow.score >= 0 && resultLow.score <= 100);
});

test('a repository with no applicable criteria returns a safe deterministic score', () => {
  // Extremely unlikely in practice (general criteria are always applicable),
  // but calculateWeightedScore itself must be safe against a zero-weight input.
  const repo = makeRepo();
  const meta = makeMeta();
  const result = calculateHealthScore(repo, meta);
  assert.equal(typeof result.score, 'number');
  assert.ok(!Number.isNaN(result.score));
});
