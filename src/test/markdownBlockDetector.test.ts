import * as assert from 'assert';
import * as vscode from 'vscode';
import { MarkdownBlockDetector } from '../detectors/markdownBlockDetector';

suite('MarkdownBlockDetector Test Suite', () => {
  let detector: MarkdownBlockDetector;

  setup(() => {
    detector = new MarkdownBlockDetector();
  });

  test('should extract headers', async () => {
    const document = await createMockDocument([
      '# Header 1',
      '## Header 2',
      '### Header 3'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 3);
    assert.strictEqual(blocks[0].text, '# Header 1');
    assert.strictEqual(blocks[1].text, '## Header 2');
    assert.strictEqual(blocks[2].text, '### Header 3');
  });

  test('should extract paragraphs', async () => {
    const document = await createMockDocument([
      'This is a paragraph.',
      '',
      'This is another paragraph.'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].text, 'This is a paragraph.');
    assert.strictEqual(blocks[1].text, 'This is another paragraph.');
  });

  test('should extract list items without markers', async () => {
    const document = await createMockDocument([
      '- Item 1',
      '* Item 2',
      '1. Item 3',
      '  - Nested Item'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 4);
    assert.strictEqual(blocks[0].text, 'Item 1');
    assert.strictEqual(blocks[1].text, 'Item 2');
    assert.strictEqual(blocks[2].text, 'Item 3');
    assert.strictEqual(blocks[3].text, 'Nested Item');
  });

  test('should extract blockquotes without markers', async () => {
    const document = await createMockDocument([
      '> Quote 1',
      '  > Nested Quote'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].text, 'Quote 1');
    assert.strictEqual(blocks[1].text, 'Nested Quote');
  });

  test('should ignore code blocks', async () => {
    const document = await createMockDocument([
      'Paragraph before',
      '```typescript',
      'const x = 1;',
      '```',
      'Paragraph after'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].text, 'Paragraph before');
    assert.strictEqual(blocks[1].text, 'Paragraph after');
  });

  test('should ignore HTML comments', async () => {
    const document = await createMockDocument([
      'Visible text',
      '<!-- Hidden comment -->',
      '<!--',
      'Multi-line comment',
      '-->'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].text, 'Visible text');
  });

  test('should ignore horizontal rules', async () => {
    const document = await createMockDocument([
      'Section 1',
      '---',
      '***',
      '___',
      'Section 2'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].text, 'Section 1');
    assert.strictEqual(blocks[1].text, 'Section 2');
  });

  test('should ignore images', async () => {
    const document = await createMockDocument([
      'Text',
      '![Alt text](image.png)',
      'More text'
    ]);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 2);
    assert.strictEqual(blocks[0].text, 'Text');
    assert.strictEqual(blocks[1].text, 'More text');
  });

  test('should calculate correct ranges for indented blocks', async () => {
    const document = await createMockDocument(['  - Indented Item']);
    const blocks = await detector.extractAllBlocks(document);
    assert.strictEqual(blocks.length, 1);
    assert.strictEqual(blocks[0].text, 'Indented Item');
    // Range should start after "  - " (4 chars)
    assert.strictEqual(blocks[0].range.start.character, 4);
    assert.strictEqual(blocks[0].range.end.character, 17);
  });

  test('should extract blocks from real Markdown file', async () => {
    const path = require('path');
    const fs = require('fs');
    const samplePath = path.join(__dirname, 'assets', 'sample.md');

    // Check if file exists
    if (!fs.existsSync(samplePath)) {
      assert.fail('sample.md not found in test/assets');
    }

    const uri = vscode.Uri.file(samplePath);
    const document = await vscode.workspace.openTextDocument(uri);
    const blocks = await detector.extractAllBlocks(document);

    // Verify we extracted meaningful blocks
    assert.ok(blocks.length > 0, 'Should extract at least some blocks');

    // Check that we extracted headers
    const headerBlocks = blocks.filter(b => b.text.startsWith('User Guide') || b.text.startsWith('Installation'));
    assert.ok(headerBlocks.length > 0, 'Should extract header blocks');

    // Check that we extracted paragraphs
    const paragraphBlocks = blocks.filter(b =>
      b.text.includes('comprehensive guide') ||
      b.text.includes('Install the extension')
    );
    assert.ok(paragraphBlocks.length > 0, 'Should extract paragraph blocks');

    // Check that we extracted list items
    const listBlocks = blocks.filter(b =>
      b.text.includes('Open VS Code') ||
      b.text.includes('Click Install')
    );
    assert.ok(listBlocks.length > 0, 'Should extract list item blocks');

    // Verify code blocks are ignored
    const codeBlocks = blocks.filter(b =>
      b.text.includes('export ANTHROPIC_API_KEY') ||
      b.text.includes('export OPENAI_API_KEY')
    );
    assert.strictEqual(codeBlocks.length, 0, 'Should not extract code blocks');

    // Verify HTML comments are ignored
    const commentBlocks = blocks.filter(b =>
      b.text.includes('This is a comment that should be ignored')
    );
    assert.strictEqual(commentBlocks.length, 0, 'Should not extract HTML comments');

    // Verify images are ignored
    const imageBlocks = blocks.filter(b =>
      b.text.includes('Extension Icon') || b.text.includes('icon.png')
    );
    assert.strictEqual(imageBlocks.length, 0, 'Should not extract image markers');

    // Verify horizontal rules are ignored
    const hrBlocks = blocks.filter(b => b.text === '---');
    assert.strictEqual(hrBlocks.length, 0, 'Should not extract horizontal rules');
  });
});

async function createMockDocument(
  lines: string[]
): Promise<vscode.TextDocument> {
  return {
    getText: () => lines.join('\n'),
    lineAt: (line: number) => ({
      text: lines[line],
      range: new vscode.Range(line, 0, line, lines[line].length),
      isEmptyOrWhitespace: lines[line].trim().length === 0
    }),
    lineCount: lines.length,
    uri: vscode.Uri.file('test.md'),
    fileName: 'test.md',
    isUntitled: false,
    version: 1,
    isDirty: false,
    isClosed: false,
    save: async () => true,
    eol: vscode.EndOfLine.LF,
    offsetAt: () => 0,
    positionAt: () => new vscode.Position(0, 0),
    validateRange: () => new vscode.Range(0, 0, 0, 0),
    getWordRangeAtPosition: () => undefined
  } as unknown as vscode.TextDocument;
}
