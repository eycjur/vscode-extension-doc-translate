import * as vscode from 'vscode';

export interface TextBlock {
    text: string;
    range: vscode.Range;
}

export class PythonBlockDetector {
    /**
     * Extract translatable text block at the given position
     * Priority: 1) docstring, 2) comment block, 3) inline comment
     */
    extractBlock(document: vscode.TextDocument, position: vscode.Position): TextBlock | null {
        // First, try to detect docstring
        const docstring = this.extractDocstring(document, position);
        if (docstring) {
            return docstring;
        }

        // Second, try to detect comment block
        const commentBlock = this.extractCommentBlock(document, position);
        if (commentBlock) {
            return commentBlock;
        }

        // Third, try to detect inline comment
        const inlineComment = this.extractInlineComment(document, position);
        if (inlineComment) {
            return inlineComment;
        }

        return null;
    }

    /**
     * Extract docstring (""" ... """ or ''' ... ''')
     */
    private extractDocstring(document: vscode.TextDocument, position: vscode.Position): TextBlock | null {
        const line = document.lineAt(position.line);
        const text = line.text;

        // Check if cursor is on a line containing """ or '''
        const tripleDoubleQuote = '"""';
        const tripleSingleQuote = "'''";

        // Try both quote types
        for (const quote of [tripleDoubleQuote, tripleSingleQuote]) {
            const block = this.extractDocstringWithQuote(document, position, quote);
            if (block) {
                return block;
            }
        }

        return null;
    }

    private extractDocstringWithQuote(
        document: vscode.TextDocument,
        position: vscode.Position,
        quote: string
    ): TextBlock | null {
        // Search for opening quote
        let startLine = position.line;
        let startCol = 0;
        let foundStart = false;

        // Search upward for opening quote
        for (let line = position.line; line >= 0; line--) {
            const lineText = document.lineAt(line).text;
            const quoteIndex = lineText.indexOf(quote);
            if (quoteIndex !== -1) {
                startLine = line;
                startCol = quoteIndex;
                foundStart = true;
                break;
            }
        }

        if (!foundStart) {
            return null;
        }

        // Search for closing quote (must be different from opening)
        let endLine = startLine;
        let endCol = startCol + quote.length;
        let foundEnd = false;

        // Start searching from after the opening quote
        const startLineText = document.lineAt(startLine).text;
        const nextQuoteIndex = startLineText.indexOf(quote, startCol + quote.length);

        if (nextQuoteIndex !== -1) {
            // Closing quote on the same line
            endLine = startLine;
            endCol = nextQuoteIndex + quote.length;
            foundEnd = true;
        } else {
            // Search downward for closing quote
            for (let line = startLine + 1; line < document.lineCount; line++) {
                const lineText = document.lineAt(line).text;
                const quoteIndex = lineText.indexOf(quote);
                if (quoteIndex !== -1) {
                    endLine = line;
                    endCol = quoteIndex + quote.length;
                    foundEnd = true;
                    break;
                }
            }
        }

        if (!foundEnd) {
            return null;
        }

        // Check if position is within the docstring range
        const range = new vscode.Range(startLine, startCol, endLine, endCol);
        if (!range.contains(position)) {
            return null;
        }

        // Extract text between quotes
        const fullText = document.getText(range);
        const content = fullText.substring(quote.length, fullText.length - quote.length).trim();

        return { text: content, range };
    }

    /**
     * Extract comment block (consecutive lines starting with #)
     */
    private extractCommentBlock(document: vscode.TextDocument, position: vscode.Position): TextBlock | null {
        const line = document.lineAt(position.line);
        const trimmedText = line.text.trim();

        // Check if the current line is a comment line
        if (!trimmedText.startsWith('#')) {
            return null;
        }

        // Find the start of the comment block (search upward)
        let startLine = position.line;
        for (let i = position.line - 1; i >= 0; i--) {
            const lineText = document.lineAt(i).text.trim();
            if (lineText.startsWith('#')) {
                startLine = i;
            } else if (lineText === '') {
                // Empty line separates comment blocks
                break;
            } else {
                // Non-comment, non-empty line
                break;
            }
        }

        // Find the end of the comment block (search downward)
        let endLine = position.line;
        for (let i = position.line + 1; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text.trim();
            if (lineText.startsWith('#')) {
                endLine = i;
            } else if (lineText === '') {
                // Empty line separates comment blocks
                break;
            } else {
                // Non-comment, non-empty line
                break;
            }
        }

        // Extract comment text
        const lines: string[] = [];
        for (let i = startLine; i <= endLine; i++) {
            const lineText = document.lineAt(i).text.trim();
            // Remove leading # and whitespace
            const commentText = lineText.replace(/^#\s?/, '');
            lines.push(commentText);
        }

        const text = lines.join('\n').trim();
        const range = new vscode.Range(
            startLine,
            0,
            endLine,
            document.lineAt(endLine).text.length
        );

        return { text, range };
    }

    /**
     * Extract inline comment (# ... at the end of a line)
     */
    private extractInlineComment(document: vscode.TextDocument, position: vscode.Position): TextBlock | null {
        const line = document.lineAt(position.line);
        const text = line.text;

        // Find # that is not inside a string
        const hashIndex = this.findCommentStart(text);
        if (hashIndex === -1) {
            return null;
        }

        // Check if cursor is after the #
        if (position.character < hashIndex) {
            return null;
        }

        // Extract comment text
        const commentText = text.substring(hashIndex + 1).trim();
        if (commentText === '') {
            return null;
        }

        const range = new vscode.Range(
            position.line,
            hashIndex,
            position.line,
            text.length
        );

        return { text: commentText, range };
    }

    /**
     * Find the start position of a comment (#) that is not inside a string
     */
    private findCommentStart(line: string): number {
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let prevChar = '';

        for (let i = 0; i < line.length; i++) {
            const char = line[i];

            // Toggle quote states
            if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            } else if (char === '#' && !inSingleQuote && !inDoubleQuote) {
                return i;
            }

            prevChar = char;
        }

        return -1;
    }
}
