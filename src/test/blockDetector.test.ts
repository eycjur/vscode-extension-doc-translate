import * as assert from 'assert';
import * as vscode from 'vscode';
import * as path from 'path';
import { PythonBlockDetector } from '../pythonBlockDetector';
import { JavaScriptBlockDetector } from '../javascriptBlockDetector';
import { GoBlockDetector } from '../goBlockDetector';

suite('Block Detector Test Suite', () => {
    const fixturesPath = path.join(__dirname, '..', '..', 'src', 'test', 'fixtures');

    suite('PythonBlockDetector', () => {
        let detector: PythonBlockDetector;

        setup(() => {
            detector = new PythonBlockDetector();
        });

        test('should extract blocks from Python sample', async () => {
            const samplePath = path.join(fixturesPath, 'sample.py');
            const uri = vscode.Uri.file(samplePath);
            const document = await vscode.workspace.openTextDocument(uri);

            const blocks = await detector.extractAllBlocks(document);

            // Should find module docstring, class docstrings, method docstrings, and comments
            assert.ok(blocks.length > 0, 'Should extract at least one block');

            // Check for module docstring
            const moduleDocstrings = blocks.filter(b =>
                b.type === 'docstring' &&
                b.text.includes('Sample Python file')
            );
            assert.ok(moduleDocstrings.length > 0, 'Should find module docstring');

            // Check for class docstrings
            const classDocstrings = blocks.filter(b =>
                b.type === 'docstring' &&
                (b.text.includes('Represents a user') || b.text.includes('managing user data'))
            );
            assert.ok(classDocstrings.length > 0, 'Should find class docstrings');

            // Check for inline comments
            const comments = blocks.filter(b => b.type === 'comment');
            assert.ok(comments.length > 0, 'Should find inline comments');
        });
    });

    suite('JavaScriptBlockDetector', () => {
        let detector: JavaScriptBlockDetector;

        setup(() => {
            detector = new JavaScriptBlockDetector();
        });

        test('should extract blocks from JavaScript sample', async () => {
            const samplePath = path.join(fixturesPath, 'sample.js');
            const uri = vscode.Uri.file(samplePath);
            const document = await vscode.workspace.openTextDocument(uri);

            const blocks = await detector.extractAllBlocks(document);

            // Should find JSDoc comments and inline comments
            assert.ok(blocks.length > 0, 'Should extract at least one block');

            // Check for file-level JSDoc
            const fileDoc = blocks.filter(b =>
                b.type === 'docstring' &&
                b.text.includes('Sample JavaScript file')
            );
            assert.ok(fileDoc.length > 0, 'Should find file-level JSDoc');

            // Check for class JSDoc
            const classDoc = blocks.filter(b =>
                b.type === 'docstring' &&
                b.text.includes('managing user data')
            );
            assert.ok(classDoc.length > 0, 'Should find class JSDoc');

            // Check for inline comments
            const comments = blocks.filter(b => b.type === 'comment');
            assert.ok(comments.length > 0, 'Should find inline comments');
        });

        test('should extract blocks from TypeScript sample', async () => {
            const samplePath = path.join(fixturesPath, 'sample.ts');
            const uri = vscode.Uri.file(samplePath);
            const document = await vscode.workspace.openTextDocument(uri);

            const blocks = await detector.extractAllBlocks(document);

            // Should find JSDoc comments and inline comments
            assert.ok(blocks.length > 0, 'Should extract at least one block');

            // Check for interface documentation
            const interfaceDoc = blocks.filter(b =>
                b.type === 'docstring' &&
                b.text.includes('Represents a user')
            );
            assert.ok(interfaceDoc.length > 0, 'Should find interface documentation');
        });
    });

    suite('GoBlockDetector', () => {
        let detector: GoBlockDetector;

        setup(() => {
            detector = new GoBlockDetector();
        });

        test('should extract blocks from Go sample', async () => {
            const samplePath = path.join(fixturesPath, 'sample.go');
            const uri = vscode.Uri.file(samplePath);
            const document = await vscode.workspace.openTextDocument(uri);

            const blocks = await detector.extractAllBlocks(document);

            // Should find package doc, struct comments, function comments
            assert.ok(blocks.length > 0, 'Should extract at least one block');

            // Check for package documentation
            const packageDoc = blocks.filter(b =>
                b.type === 'docstring' &&
                b.text.includes('demonstrates the Doc Translate extension')
            );
            assert.ok(packageDoc.length > 0, 'Should find package documentation');

            // Check for struct documentation
            const structDoc = blocks.filter(b =>
                b.type === 'docstring' &&
                (b.text.includes('represents a user') || b.text.includes('manages a collection'))
            );
            assert.ok(structDoc.length > 0, 'Should find struct documentation');

            // Check for inline comments
            const comments = blocks.filter(b => b.type === 'comment');
            assert.ok(comments.length > 0, 'Should find inline comments');
        });
    });
});
