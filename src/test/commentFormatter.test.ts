import * as assert from 'assert';
import { getCommentFormat, formatDocstring, formatComment } from '../utils/commentFormatter';

suite('Comment Formatter Test Suite', () => {
    suite('getCommentFormat', () => {
        test('should return correct format for Python', () => {
            const format = getCommentFormat('python');

            assert.strictEqual(format.docstringOpen, '"""', 'Python docstring should open with """');
            assert.strictEqual(format.docstringClose, '"""', 'Python docstring should close with """');
            assert.strictEqual(format.docstringLinePrefix, '', 'Python should have no line prefix');
            assert.strictEqual(format.commentPrefix, '# ', 'Python comments should start with #');
        });

        test('should return correct format for JavaScript', () => {
            const format = getCommentFormat('javascript');

            assert.strictEqual(format.docstringOpen, '/**', 'JS docstring should open with /**');
            assert.strictEqual(format.docstringClose, ' */', 'JS docstring should close with */');
            assert.strictEqual(format.docstringLinePrefix, ' * ', 'JS should have * line prefix');
            assert.strictEqual(format.commentPrefix, '// ', 'JS comments should start with //');
        });

        test('should return correct format for TypeScript', () => {
            const format = getCommentFormat('typescript');

            assert.strictEqual(format.docstringOpen, '/**', 'TS docstring should open with /**');
            assert.strictEqual(format.docstringClose, ' */', 'TS docstring should close with */');
            assert.strictEqual(format.docstringLinePrefix, ' * ', 'TS should have * line prefix');
            assert.strictEqual(format.commentPrefix, '// ', 'TS comments should start with //');
        });

        test('should return correct format for Go', () => {
            const format = getCommentFormat('go');

            assert.strictEqual(format.docstringOpen, '/*', 'Go docstring should open with /*');
            assert.strictEqual(format.docstringClose, ' */', 'Go docstring should close with */');
            assert.strictEqual(format.docstringLinePrefix, ' * ', 'Go should have * line prefix');
            assert.strictEqual(format.commentPrefix, '// ', 'Go comments should start with //');
        });

        test('should return default format for unknown language', () => {
            const format = getCommentFormat('unknown');

            assert.strictEqual(format.docstringOpen, '/*', 'Unknown language should use default /*');
            assert.strictEqual(format.docstringClose, ' */', 'Unknown language should use default */');
            assert.strictEqual(format.docstringLinePrefix, ' * ', 'Unknown language should use default * prefix');
            assert.strictEqual(format.commentPrefix, '// ', 'Unknown language should use default //');
        });

        test('should handle React variants', () => {
            const jsxFormat = getCommentFormat('javascriptreact');
            const tsxFormat = getCommentFormat('typescriptreact');

            assert.strictEqual(jsxFormat.docstringOpen, '/**', 'JSX should use JS format');
            assert.strictEqual(tsxFormat.docstringOpen, '/**', 'TSX should use TS format');
        });
    });

    suite('formatDocstring', () => {
        test('should format single-line Python docstring', () => {
            const translation = 'This is a test';
            const result = formatDocstring(translation, 'python');

            assert.strictEqual(result.length, 1, 'Should return single line');
            assert.strictEqual(result[0], '"""This is a test"""', 'Should format with Python quotes');
        });

        test('should format single-line JavaScript docstring', () => {
            const translation = 'This is a test';
            const result = formatDocstring(translation, 'javascript');

            assert.strictEqual(result.length, 1, 'Should return single line');
            assert.strictEqual(result[0], '/**This is a test */', 'Should format with JS comment syntax');
        });

        test('should format multi-line Python docstring', () => {
            const translation = 'Line 1\nLine 2\nLine 3';
            const result = formatDocstring(translation, 'python');

            assert.strictEqual(result.length, 5, 'Should have opening, 3 content lines, and closing');
            assert.strictEqual(result[0], '"""', 'First line should be opening quote');
            assert.strictEqual(result[1], 'Line 1', 'Content should not have prefix in Python');
            assert.strictEqual(result[2], 'Line 2', 'Content should not have prefix in Python');
            assert.strictEqual(result[3], 'Line 3', 'Content should not have prefix in Python');
            assert.strictEqual(result[4], '"""', 'Last line should be closing quote');
        });

        test('should format multi-line JavaScript docstring', () => {
            const translation = 'Line 1\nLine 2';
            const result = formatDocstring(translation, 'javascript');

            assert.strictEqual(result.length, 4, 'Should have opening, 2 content lines, and closing');
            assert.strictEqual(result[0], '/**', 'First line should be opening comment');
            assert.strictEqual(result[1], ' * Line 1', 'Content should have * prefix');
            assert.strictEqual(result[2], ' * Line 2', 'Content should have * prefix');
            assert.strictEqual(result[3], ' */', 'Last line should be closing comment');
        });

        test('should format multi-line Go docstring', () => {
            const translation = 'Line 1\nLine 2';
            const result = formatDocstring(translation, 'go');

            assert.strictEqual(result.length, 4, 'Should have opening, 2 content lines, and closing');
            assert.strictEqual(result[0], '/*', 'First line should be opening comment');
            assert.strictEqual(result[1], ' * Line 1', 'Content should have * prefix');
            assert.strictEqual(result[2], ' * Line 2', 'Content should have * prefix');
            assert.strictEqual(result[3], ' */', 'Last line should be closing comment');
        });

        test('should apply indentation to all lines', () => {
            const translation = 'Line 1\nLine 2';
            const indentation = '    ';
            const result = formatDocstring(translation, 'javascript', indentation);

            assert.strictEqual(result[0], '    /**', 'Opening should be indented');
            assert.strictEqual(result[1], '     * Line 1', 'Content should be indented');
            assert.strictEqual(result[2], '     * Line 2', 'Content should be indented');
            assert.strictEqual(result[3], '     */', 'Closing should be indented');
        });

        test('should handle empty translation', () => {
            const translation = '';
            const result = formatDocstring(translation, 'python');

            assert.strictEqual(result.length, 1, 'Should return single line for empty string');
            assert.strictEqual(result[0], '""""""', 'Should format empty docstring');
        });

        test('should handle translation with only newlines', () => {
            const translation = '\n\n';
            const result = formatDocstring(translation, 'python');

            // Split will create 3 elements: '', '', ''
            assert.strictEqual(result.length, 5, 'Should handle newlines');
        });
    });

    suite('formatComment', () => {
        test('should format single-line Python comment', () => {
            const translation = 'This is a comment';
            const result = formatComment(translation, 'python');

            assert.strictEqual(result, '# This is a comment', 'Should format with # prefix');
        });

        test('should format single-line JavaScript comment', () => {
            const translation = 'This is a comment';
            const result = formatComment(translation, 'javascript');

            assert.strictEqual(result, '// This is a comment', 'Should format with // prefix');
        });

        test('should format single-line TypeScript comment', () => {
            const translation = 'This is a comment';
            const result = formatComment(translation, 'typescript');

            assert.strictEqual(result, '// This is a comment', 'Should format with // prefix');
        });

        test('should format single-line Go comment', () => {
            const translation = 'This is a comment';
            const result = formatComment(translation, 'go');

            assert.strictEqual(result, '// This is a comment', 'Should format with // prefix');
        });

        test('should join multi-line translation into single line', () => {
            const translation = 'Line 1\nLine 2\nLine 3';
            const result = formatComment(translation, 'javascript');

            assert.strictEqual(result, '// Line 1 Line 2 Line 3', 'Should join lines with space');
        });

        test('should handle empty translation', () => {
            const translation = '';
            const result = formatComment(translation, 'python');

            assert.strictEqual(result, '# ', 'Should format empty comment');
        });

        test('should handle translation with only whitespace', () => {
            const translation = '   ';
            const result = formatComment(translation, 'javascript');

            assert.strictEqual(result, '//    ', 'Should preserve whitespace');
        });
    });
});
