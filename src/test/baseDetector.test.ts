import * as assert from 'assert';
import * as vscode from 'vscode';
import { BaseBlockDetector } from '../detectors/base/baseDetector';
import { TextBlock } from '../detectors/base/blockDetector';

// Concrete implementation of BaseBlockDetector for testing
class TestDetector extends BaseBlockDetector {
    async extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        return null;
    }

    extractDocstringFromLine(document: vscode.TextDocument, startLine: number): Omit<TextBlock, 'type'> | null {
        return null;
    }

    extractInlineComment(document: vscode.TextDocument, lineNumber: number): Omit<TextBlock, 'type'> | null {
        return null;
    }

    extractModuleDocstring(document: vscode.TextDocument): Omit<TextBlock, 'type'> | null {
        return null;
    }

    async extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]> {
        return [];
    }

    // Expose protected methods for testing
    public testGetSymbolsFromLSP(document: vscode.TextDocument) {
        return this.getSymbolsFromLSP(document);
    }

    public testFindSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position) {
        return this.findSymbolAtPosition(symbols, position);
    }

    public testDeduplicateBlocks(blocks: TextBlock[]) {
        return this.deduplicateBlocks(blocks);
    }
}

suite('BaseBlockDetector Test Suite', () => {
    let detector: TestDetector;

    setup(() => {
        detector = new TestDetector();
    });

    suite('deduplicateBlocks', () => {
        test('should remove duplicate blocks with same text', () => {
            const blocks: TextBlock[] = [
                {
                    text: 'Hello World',
                    range: new vscode.Range(0, 0, 0, 10),
                    type: 'comment'
                },
                {
                    text: 'Goodbye',
                    range: new vscode.Range(1, 0, 1, 10),
                    type: 'comment'
                },
                {
                    text: 'Hello World',
                    range: new vscode.Range(2, 0, 2, 10),
                    type: 'docstring'
                }
            ];

            const result = detector.testDeduplicateBlocks(blocks);

            assert.strictEqual(result.length, 2, 'Should return 2 unique blocks');
            assert.ok(result.some(b => b.text === 'Hello World'), 'Should contain "Hello World"');
            assert.ok(result.some(b => b.text === 'Goodbye'), 'Should contain "Goodbye"');
        });

        test('should preserve first occurrence when duplicates exist', () => {
            const blocks: TextBlock[] = [
                {
                    text: 'Same text',
                    range: new vscode.Range(0, 0, 0, 10),
                    type: 'comment'
                },
                {
                    text: 'Same text',
                    range: new vscode.Range(5, 0, 5, 10),
                    type: 'docstring'
                }
            ];

            const result = detector.testDeduplicateBlocks(blocks);

            assert.strictEqual(result.length, 1, 'Should return 1 unique block');
            assert.strictEqual(result[0].type, 'comment', 'Should preserve first occurrence type');
            assert.strictEqual(result[0].range.start.line, 0, 'Should preserve first occurrence range');
        });

        test('should handle empty array', () => {
            const blocks: TextBlock[] = [];
            const result = detector.testDeduplicateBlocks(blocks);

            assert.strictEqual(result.length, 0, 'Should return empty array');
        });

        test('should handle array with one element', () => {
            const blocks: TextBlock[] = [
                {
                    text: 'Single block',
                    range: new vscode.Range(0, 0, 0, 10),
                    type: 'comment'
                }
            ];

            const result = detector.testDeduplicateBlocks(blocks);

            assert.strictEqual(result.length, 1, 'Should return array with one element');
            assert.strictEqual(result[0].text, 'Single block');
        });

        test('should treat different whitespace as different text', () => {
            const blocks: TextBlock[] = [
                {
                    text: 'Hello  World',
                    range: new vscode.Range(0, 0, 0, 10),
                    type: 'comment'
                },
                {
                    text: 'Hello World',
                    range: new vscode.Range(1, 0, 1, 10),
                    type: 'comment'
                }
            ];

            const result = detector.testDeduplicateBlocks(blocks);

            assert.strictEqual(result.length, 2, 'Should treat different whitespace as different');
        });
    });

    suite('findSymbolAtPosition', () => {
        test('should find top-level symbol', () => {
            const symbols: vscode.DocumentSymbol[] = [
                new vscode.DocumentSymbol(
                    'MyClass',
                    'A test class',
                    vscode.SymbolKind.Class,
                    new vscode.Range(0, 0, 10, 0),
                    new vscode.Range(0, 0, 0, 10)
                )
            ];

            const position = new vscode.Position(5, 0);
            const result = detector.testFindSymbolAtPosition(symbols, position);

            assert.ok(result, 'Should find symbol');
            assert.strictEqual(result!.name, 'MyClass', 'Should find correct symbol');
        });

        test('should find nested symbol', () => {
            const childSymbol = new vscode.DocumentSymbol(
                'myMethod',
                'A test method',
                vscode.SymbolKind.Method,
                new vscode.Range(2, 0, 5, 0),
                new vscode.Range(2, 0, 2, 10)
            );

            const parentSymbol = new vscode.DocumentSymbol(
                'MyClass',
                'A test class',
                vscode.SymbolKind.Class,
                new vscode.Range(0, 0, 10, 0),
                new vscode.Range(0, 0, 0, 10)
            );
            parentSymbol.children = [childSymbol];

            const symbols = [parentSymbol];
            const position = new vscode.Position(3, 0);
            const result = detector.testFindSymbolAtPosition(symbols, position);

            assert.ok(result, 'Should find symbol');
            assert.strictEqual(result!.name, 'myMethod', 'Should find nested method');
        });

        test('should return null when position is outside all symbols', () => {
            const symbols: vscode.DocumentSymbol[] = [
                new vscode.DocumentSymbol(
                    'MyClass',
                    'A test class',
                    vscode.SymbolKind.Class,
                    new vscode.Range(0, 0, 10, 0),
                    new vscode.Range(0, 0, 0, 10)
                )
            ];

            const position = new vscode.Position(20, 0);
            const result = detector.testFindSymbolAtPosition(symbols, position);

            assert.strictEqual(result, null, 'Should return null for position outside symbols');
        });

        test('should return parent when position is in parent but not in child', () => {
            const childSymbol = new vscode.DocumentSymbol(
                'myMethod',
                'A test method',
                vscode.SymbolKind.Method,
                new vscode.Range(2, 0, 5, 0),
                new vscode.Range(2, 0, 2, 10)
            );

            const parentSymbol = new vscode.DocumentSymbol(
                'MyClass',
                'A test class',
                vscode.SymbolKind.Class,
                new vscode.Range(0, 0, 10, 0),
                new vscode.Range(0, 0, 0, 10)
            );
            parentSymbol.children = [childSymbol];

            const symbols = [parentSymbol];
            const position = new vscode.Position(8, 0); // After method but inside class
            const result = detector.testFindSymbolAtPosition(symbols, position);

            assert.ok(result, 'Should find symbol');
            assert.strictEqual(result!.name, 'MyClass', 'Should return parent symbol');
        });

        test('should handle empty symbols array', () => {
            const symbols: vscode.DocumentSymbol[] = [];
            const position = new vscode.Position(5, 0);
            const result = detector.testFindSymbolAtPosition(symbols, position);

            assert.strictEqual(result, null, 'Should return null for empty symbols array');
        });
    });
});
