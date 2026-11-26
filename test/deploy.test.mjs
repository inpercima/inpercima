import test from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8');
const readmeStep = workflow.match(/- name: Commit updated README\n\s+run: \|\n((?: {10}.+\n)+)/);

test('README step pushes the current branch without an upstream', () => {
  assert.ok(readmeStep, 'README step exists in the deploy workflow');
  const script = readmeStep[1].replace(/^ {10}/gm, '');

  for (const [branch, changed] of [['main', false], ['main', true], ['feature', true]]) {
    const dir = mkdtempSync(join(tmpdir(), 'deploy-test-'));
    try {
      const remote = join(dir, 'remote.git');
      const work = join(dir, 'work');
      const run = (command, args, cwd = dir) =>
        execFileSync(command, args, { cwd, stdio: 'pipe', env: { ...process.env, GIT_CONFIG_NOSYSTEM: '1', GIT_CONFIG_GLOBAL: '/dev/null' } }).toString().trim();

      run('git', ['init', '--bare', remote]);
      run('git', ['init', '-b', branch, work]);
      run('git', ['config', 'user.name', 'test'], work);
      run('git', ['config', 'user.email', 'test@example.com'], work);
      writeFileSync(join(work, 'README.md'), 'before\n');
      run('git', ['add', 'README.md'], work);
      run('git', ['commit', '-m', 'initial'], work);
      run('git', ['remote', 'add', 'origin', remote], work);
      run('git', ['push', 'origin', 'HEAD'], work);
      const initial = run('git', ['rev-parse', 'HEAD'], work);

      if (changed) writeFileSync(join(work, 'README.md'), 'after\n');
      run('bash', ['-e', '-c', script], work);

      const pushed = run('git', ['--git-dir', remote, 'rev-parse', `refs/heads/${branch}`]);
      assert.equal(pushed, run('git', ['rev-parse', 'HEAD'], work));
      assert.equal(pushed !== initial, changed);
      assert.equal(run('git', ['--git-dir', remote, 'show', `${branch}:README.md`]), changed ? 'after' : 'before');
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});
