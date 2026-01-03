import * as assert from 'assert';
import * as path from 'path';
import { isPathExcluded } from '../utils/excludeMatcher';

suite('Exclude Matcher Test Suite', () => {
  test('matches workspace-relative patterns', () => {
    const workspaceRoot = path.join('home', 'project');
    const filePath = path.join(workspaceRoot, 'docs', 'guide.md');

    assert.ok(
      isPathExcluded(filePath, workspaceRoot, ['docs/**/*.md']),
      'Should match workspace-relative glob'
    );
  });

  test('matches basename patterns', () => {
    const workspaceRoot = path.join('home', 'project');
    const filePath = path.join(workspaceRoot, 'README.md');

    assert.ok(
      isPathExcluded(filePath, workspaceRoot, ['*.md']),
      'Should match basename glob'
    );
  });

  test('returns false when no patterns match', () => {
    const workspaceRoot = path.join('home', 'project');
    const filePath = path.join(workspaceRoot, 'src', 'index.ts');

    assert.strictEqual(
      isPathExcluded(filePath, workspaceRoot, ['docs/**/*.md', '*.md']),
      false
    );
  });
});
