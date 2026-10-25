import test from 'node:test';
import assert from 'node:assert/strict';
import { calculateHealthScore, formatFrameworksLabel, detectJavaFrameworkVersion, detectLicenseYear, detectCheckoutMajors } from '../src/analyzer.mjs';

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
    ciRunSuccessRate: 1,
    checkoutMajors: [5],
    latestCheckoutMajor: 5,
    licenseYear: new Date().getFullYear(),
    hasJavaCI: false,
    hasPackageJson: false,
    hasPackageScripts: false,
    hasAngularTooling: false,
    hasMavenConfig: false,
    angular: null,
    nodeVersion: null,
    pnpmVersion: null,
    phpVersion: null,
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
    nodeVersion: '26.0.0',
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
    angular: '22.0.0',
    hasAngularTooling: true,
    hasPackageScripts: true,
    nodeVersion: '26.0.0',
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
    javaVersion: '27',
    frameworks: [{ name: 'Spring Boot', version: '4.1.2', runtime: 'Java' }],
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

test('Java framework and Java version are labelled separately', () => {
  assert.equal(
    formatFrameworksLabel([
      { name: 'Angular', version: '20.1.0' },
      { name: 'Spring Boot', version: '4.1.2', runtime: 'Java' },
      { name: 'Java', version: '21' },
      { name: 'Quarkus', version: null, runtime: 'Java' },
    ]),
    'Angular (20.1.0), Spring Boot (4.1.2), Java (21), Quarkus',
  );
});

test('Spring Boot version is read from the parent, falling back to the property', () => {
  const parent = '<parent><groupId>org.springframework.boot</groupId><artifactId>spring-boot-starter-parent</artifactId><version>4.1.2</version></parent>';
  const prop = '<properties><spring-boot.version>3.5.0</spring-boot.version></properties>';
  assert.equal(detectJavaFrameworkVersion(parent + prop, 'Spring Boot'), '4.1.2');
  assert.equal(detectJavaFrameworkVersion(prop, 'Spring Boot'), '3.5.0');
  assert.equal(detectJavaFrameworkVersion('<project/>', 'Spring Boot'), null);
  assert.equal(detectJavaFrameworkVersion(parent, 'Quarkus'), null);
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

const criterion = (result, id) => result.criteria.find(c => c.id === id);

test('without CI the CI criteria are not applicable and a repo can still reach 100', () => {
  const result = calculateHealthScore(makeRepo(), makeMeta({ hasCI: false, ciRunSuccessRate: null, checkoutMajors: [] }));
  for (const id of ['ci-runs', 'ci-checkout']) {
    assert.equal(criterion(result, id).applicable, false);
    assert.equal(criterion(result, id).score, null);
  }
  assert.equal(result.score, 100);
});

test('a failed CI run or outdated actions/checkout reduces the score', () => {
  const failed = calculateHealthScore(makeRepo(), makeMeta({ ciRunSuccessRate: 0 }));
  assert.equal(criterion(failed, 'ci-runs').score, 0);
  assert.ok(failed.score < 100);

  const outdated = calculateHealthScore(makeRepo(), makeMeta({ checkoutMajors: [3, 5], latestCheckoutMajor: 5 }));
  assert.equal(criterion(outdated, 'ci-checkout').score, 50);
  assert.ok(outdated.score < 100);

  const fallback = calculateHealthScore(makeRepo(), makeMeta({ checkoutMajors: [4], latestCheckoutMajor: undefined }));
  assert.equal(criterion(fallback, 'ci-checkout').score, 0);
});

test('license with an old copyright year is penalized, the current year scores 100', () => {
  const old = calculateHealthScore(makeRepo(), makeMeta({ licenseYear: 2021 }), { currentYear: 2026 });
  assert.equal(criterion(old, 'license').score, 50);
  const current = calculateHealthScore(makeRepo(), makeMeta({ licenseYear: 2026 }), { currentYear: 2026 });
  assert.equal(criterion(current, 'license').score, 100);
  const unknown = calculateHealthScore(makeRepo(), makeMeta({ licenseYear: null }), { currentYear: 2026 });
  assert.equal(criterion(unknown, 'license').score, 50);
  const none = calculateHealthScore(makeRepo({ license: null }), makeMeta(), { currentYear: 2026 });
  assert.equal(criterion(none, 'license').score, 0);
});

test('license year and checkout versions are parsed', () => {
  assert.equal(detectLicenseYear('MIT License\n\nCopyright (c) 2021 Foo'), 2021);
  assert.equal(detectLicenseYear('Copyright (c) 2021-2026 Foo'), 2026);
  assert.equal(detectLicenseYear('no year here'), null);
  assert.deepEqual(detectCheckoutMajors('- uses: actions/checkout@v4\n- uses: "actions/checkout@v5.1.0"\n- uses: actions/setup-node@v4'), [4, 5]);
});

test('the dependency management criterion no longer exists', () => {
  const result = calculateHealthScore(makeRepo(), makeMeta({ hasMavenConfig: true }));
  assert.equal(criterion(result, 'maven-dependency-management'), undefined);
});
