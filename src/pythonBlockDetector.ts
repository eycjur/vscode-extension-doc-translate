import * as vscode from 'vscode';
import { logger } from './logger';

export interface TextBlock {
    text: string;
    range: vscode.Range;
}

export class PythonBlockDetector {
    /**
     * Extract translatable text block at the given position using LSP
     * Priority: 1) docstring (via LSP), 2) comment block, 3) inline comment
     */
    async extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        logger.debug(`Extracting block at position: line ${position.line}, char ${position.character}`);

        // First, try to detect docstring using LSP
        const docstring = await this.extractDocstringLSP(document, position);
        if (docstring) {
            logger.info(`Detected docstring via LSP (${docstring.range.start.line}-${docstring.range.end.line})`);
            logger.debug('Docstring content:', { text: docstring.text.substring(0, 50) + '...' });
            return docstring;
        }

        // Fallback to regex-based docstring detection
        const docstringFallback = this.extractDocstring(document, position);
        if (docstringFallback) {
            logger.info(`Detected docstring via regex (${docstringFallback.range.start.line}-${docstringFallback.range.end.line})`);
            logger.debug('Docstring content:', { text: docstringFallback.text.substring(0, 50) + '...' });
            return docstringFallback;
        }

        // Second, try to detect comment block
        const commentBlock = this.extractCommentBlock(document, position);
        if (commentBlock) {
            logger.info(`Detected comment block (${commentBlock.range.start.line}-${commentBlock.range.end.line})`);
            logger.debug('Comment block content:', { text: commentBlock.text.substring(0, 50) + '...' });
            return commentBlock;
        }

        // Third, try to detect inline comment
        const inlineComment = this.extractInlineComment(document, position);
        if (inlineComment) {
            logger.info(`Detected inline comment at line ${inlineComment.range.start.line}`);
            logger.debug('Inline comment:', { text: inlineComment.text });
            return inlineComment;
        }

        logger.debug('No translatable block found at this position');
        return null;
    }

    /**
     * Extract docstring using LSP (Language Server Protocol)
     */
    private async extractDocstringLSP(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        try {
            logger.debug('Requesting document symbols from LSP');
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (!symbols || symbols.length === 0) {
                logger.debug('No symbols returned from LSP');
                return null;
            }

            logger.debug(`LSP returned ${symbols.length} top-level symbols`);

            // Find the symbol at the cursor position
            const symbol = this.findSymbolAtPosition(symbols, position);
            if (!symbol) {
                logger.debug('No symbol found at cursor position');
                return null;
            }

            logger.debug(`Found symbol: ${symbol.name} (${vscode.SymbolKind[symbol.kind]})`);

            // Check if cursor is within a potential docstring area
            // Docstring typically starts right after the symbol definition line
            const symbolStartLine = symbol.range.start.line;
            const symbolBodyStart = symbol.selectionRange.end.line + 1;

            // If cursor is not in the docstring area, return null
            if (position.line < symbolBodyStart || position.line > symbolBodyStart + 20) {
                logger.debug(`Cursor not in docstring area (symbol body starts at line ${symbolBodyStart})`);
                return null;
            }

            // Try to extract docstring starting from the first line after symbol definition
            const docstring = this.extractDocstringFromLine(document, symbolBodyStart);
            if (docstring && docstring.range.contains(position)) {
                return docstring;
            }

            return null;
        } catch (error) {
            logger.error('Failed to use LSP for docstring detection', error);
            return null;
        }
    }

    /**
     * Recursively find symbol at the given position
     */
    private findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | null {
        for (const symbol of symbols) {
            // Check if position is within this symbol's range
            if (symbol.range.contains(position)) {
                // Check children first (more specific)
                if (symbol.children && symbol.children.length > 0) {
                    const childSymbol = this.findSymbolAtPosition(symbol.children, position);
                    if (childSymbol) {
                        return childSymbol;
                    }
                }
                // Return this symbol if no child contains the position
                return symbol;
            }
        }
        return null;
    }

    /**
     * Extract docstring starting from a specific line
     */
    private extractDocstringFromLine(document: vscode.TextDocument, startLine: number): TextBlock | null {
        if (startLine >= document.lineCount) {
            return null;
        }

        const firstLine = document.lineAt(startLine).text.trim();

        // Check for triple quotes
        const tripleDoubleQuote = '"""';
        const tripleSingleQuote = "'''";

        for (const quote of [tripleDoubleQuote, tripleSingleQuote]) {
            if (firstLine.includes(quote)) {
                return this.extractDocstringWithQuoteFromLine(document, startLine, quote);
            }
        }

        return null;
    }

    /**
     * Extract docstring with specific quote type from a starting line
     */
    private extractDocstringWithQuoteFromLine(
        document: vscode.TextDocument,
        startLine: number,
        quote: string
    ): TextBlock | null {
        const firstLineText = document.lineAt(startLine).text;
        const quoteIndex = firstLineText.indexOf(quote);

        if (quoteIndex === -1) {
            return null;
        }

        const startCol = quoteIndex;
        let endLine = startLine;
        let endCol = startCol + quote.length;

        // Check if it's a single-line docstring
        const nextQuoteIndex = firstLineText.indexOf(quote, startCol + quote.length);
        if (nextQuoteIndex !== -1) {
            // Single line docstring
            endCol = nextQuoteIndex + quote.length;
        } else {
            // Multi-line docstring - search for closing quote
            let foundEnd = false;
            for (let line = startLine + 1; line < document.lineCount; line++) {
                const lineText = document.lineAt(line).text;
                const closeQuoteIndex = lineText.indexOf(quote);
                if (closeQuoteIndex !== -1) {
                    endLine = line;
                    endCol = closeQuoteIndex + quote.length;
                    foundEnd = true;
                    break;
                }
            }

            if (!foundEnd) {
                return null;
            }
        }

        const range = new vscode.Range(startLine, startCol, endLine, endCol);
        const fullText = document.getText(range);
        const content = fullText.substring(quote.length, fullText.length - quote.length).trim();

        return { text: content, range };
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
