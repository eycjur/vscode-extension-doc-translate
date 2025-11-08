import * as vscode from 'vscode';
import { logger } from './logger';
import { IBlockDetector, TextBlock } from './blockDetector';

export class JavaScriptBlockDetector implements IBlockDetector {
    /**
     * Extract translatable text block at the given position using LSP
     */
    async extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        logger.debug(`Extracting JS/TS block at position: line ${position.line}, char ${position.character}`);

        // Try to detect JSDoc or multi-line comment using LSP
        const comment = await this.extractCommentLSP(document, position);
        if (comment) {
            logger.info(`Detected comment via LSP (${comment.range.start.line}-${comment.range.end.line})`);
            logger.debug('Comment content:', { text: comment.text.substring(0, 50) + '...' });
            return comment;
        }

        logger.debug('No translatable block found at this position');
        return null;
    }

    /**
     * Extract comment using LSP (Language Server Protocol)
     */
    private async extractCommentLSP(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
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

            // Check for JSDoc comment right before the symbol
            const symbolStartLine = symbol.range.start.line;
            const comment = this.extractJSDocBeforeLine(document, symbolStartLine);
            if (comment && comment.range.contains(position)) {
                return { ...comment, type: 'docstring' as const };
            }

            return null;
        } catch (error) {
            logger.error('Failed to use LSP for comment detection', error);
            return null;
        }
    }

    /**
     * Recursively find symbol at the given position
     */
    private findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | null {
        for (const symbol of symbols) {
            if (symbol.range.contains(position)) {
                if (symbol.children && symbol.children.length > 0) {
                    const childSymbol = this.findSymbolAtPosition(symbol.children, position);
                    if (childSymbol) {
                        return childSymbol;
                    }
                }
                return symbol;
            }
        }
        return null;
    }

    /**
     * Extract JSDoc comment right before a specific line
     */
    private extractJSDocBeforeLine(document: vscode.TextDocument, line: number): Omit<TextBlock, 'type'> | null {
        // Search backwards from the line for JSDoc comment
        for (let i = line - 1; i >= Math.max(0, line - 10); i--) {
            const lineText = document.lineAt(i).text.trim();

            // If we hit code, stop searching
            if (lineText && !lineText.startsWith('*') && !lineText.startsWith('/**') && !lineText.startsWith('*/') && !lineText.startsWith('//')) {
                break;
            }

            // Found end of JSDoc
            if (lineText.includes('*/')) {
                return this.extractJSDocEndingAtLine(document, i);
            }
        }

        return null;
    }

    /**
     * Extract JSDoc comment ending at a specific line
     */
    private extractJSDocEndingAtLine(document: vscode.TextDocument, endLine: number): Omit<TextBlock, 'type'> | null {
        const endLineText = document.lineAt(endLine).text;
        const endCol = endLineText.indexOf('*/') + 2;

        // Search backwards for the start
        for (let i = endLine; i >= 0; i--) {
            const lineText = document.lineAt(i).text;
            const startIndex = lineText.indexOf('/**');
            if (startIndex !== -1) {
                const startCol = startIndex;
                const range = new vscode.Range(i, startCol, endLine, endCol);
                const fullText = document.getText(range);

                // Extract content (remove /** and */)
                const content = fullText
                    .replace(/^\/\*\*/, '')
                    .replace(/\*\/$/, '')
                    .split('\n')
                    .map(line => line.trim().replace(/^\*\s?/, ''))
                    .join('\n')
                    .trim();

                return { text: content, range };
            }
        }

        return null;
    }

    /**
     * Extract docstring starting from a specific line (JSDoc or multi-line comment)
     */
    public extractDocstringFromLine(document: vscode.TextDocument, startLine: number): Omit<TextBlock, 'type'> | null {
        if (startLine >= document.lineCount) {
            return null;
        }

        const firstLine = document.lineAt(startLine).text.trim();

        // Check for JSDoc
        if (firstLine.startsWith('/**')) {
            return this.extractMultiLineComment(document, startLine, '/**', '*/');
        }

        // Check for multi-line comment
        if (firstLine.startsWith('/*')) {
            return this.extractMultiLineComment(document, startLine, '/*', '*/');
        }

        return null;
    }

    /**
     * Extract multi-line comment with specific delimiters
     */
    private extractMultiLineComment(
        document: vscode.TextDocument,
        startLine: number,
        startDelimiter: string,
        endDelimiter: string
    ): Omit<TextBlock, 'type'> | null {
        const firstLineText = document.lineAt(startLine).text;
        const startIndex = firstLineText.indexOf(startDelimiter);

        if (startIndex === -1) {
            return null;
        }

        const startCol = startIndex;
        let endLine = startLine;
        let endCol = startCol + startDelimiter.length;

        // Check if it's a single-line comment
        const closeIndex = firstLineText.indexOf(endDelimiter, startCol + startDelimiter.length);
        if (closeIndex !== -1) {
            endCol = closeIndex + endDelimiter.length;
        } else {
            // Multi-line comment - search for closing delimiter
            let foundEnd = false;
            for (let line = startLine + 1; line < document.lineCount; line++) {
                const lineText = document.lineAt(line).text;
                const closeIdx = lineText.indexOf(endDelimiter);
                if (closeIdx !== -1) {
                    endLine = line;
                    endCol = closeIdx + endDelimiter.length;
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

        // Extract content
        const content = fullText
            .replace(/^\/\*\*?/, '')
            .replace(/\*\/$/, '')
            .split('\n')
            .map(line => line.trim().replace(/^\*\s?/, ''))
            .join('\n')
            .trim();

        return { text: content, range };
    }

    /**
     * Extract inline comment from a line
     */
    public extractInlineComment(document: vscode.TextDocument, lineNumber: number): Omit<TextBlock, 'type'> | null {
        if (lineNumber >= document.lineCount) {
            return null;
        }

        const line = document.lineAt(lineNumber);
        const text = line.text;

        // Find // that is not inside a string
        const commentIndex = this.findCommentStart(text);
        if (commentIndex === -1) {
            return null;
        }

        // Extract comment text
        const commentText = text.substring(commentIndex + 2).trim();
        if (commentText === '') {
            return null;
        }

        const range = new vscode.Range(
            lineNumber,
            commentIndex,
            lineNumber,
            text.length
        );

        return { text: commentText, range };
    }

    /**
     * Find the start position of a comment (//) that is not inside a string
     */
    private findCommentStart(line: string): number {
        let inSingleQuote = false;
        let inDoubleQuote = false;
        let prevChar = '';

        for (let i = 0; i < line.length - 1; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            // Toggle quote states
            if (char === "'" && prevChar !== '\\' && !inDoubleQuote) {
                inSingleQuote = !inSingleQuote;
            } else if (char === '"' && prevChar !== '\\' && !inSingleQuote) {
                inDoubleQuote = !inDoubleQuote;
            } else if (char === '/' && nextChar === '/' && !inSingleQuote && !inDoubleQuote) {
                return i;
            }

            prevChar = char;
        }

        return -1;
    }

    /**
     * Extract module-level comment (file top-level)
     */
    public extractModuleDocstring(document: vscode.TextDocument): Omit<TextBlock, 'type'> | null {
        // Look for comment at the beginning of the file
        for (let lineNum = 0; lineNum < Math.min(50, document.lineCount); lineNum++) {
            const line = document.lineAt(lineNum);
            const trimmedText = line.text.trim();

            // Skip blank lines and single-line comments
            if (trimmedText === '' || trimmedText.startsWith('//')) {
                continue;
            }

            // Check if this line starts with JSDoc or multi-line comment
            if (trimmedText.startsWith('/**') || trimmedText.startsWith('/*')) {
                const comment = this.extractDocstringFromLine(document, lineNum);
                if (comment) {
                    logger.debug(`Found module comment at line ${lineNum}`);
                    return comment;
                }
            }

            // If we encounter import or other code, stop searching
            if (trimmedText.startsWith('import ') ||
                trimmedText.startsWith('export ') ||
                trimmedText.startsWith('class ') ||
                trimmedText.startsWith('function ') ||
                trimmedText.startsWith('const ') ||
                trimmedText.startsWith('let ') ||
                trimmedText.startsWith('var ')) {
                break;
            }
        }

        return null;
    }

    /**
     * Extract all translatable blocks from document (for pre-translation)
     */
    async extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]> {
        const blocks: TextBlock[] = [];

        // 1. Extract module-level comment (file top-level)
        const moduleComment = this.extractModuleDocstring(document);
        if (moduleComment && moduleComment.text.trim()) {
            blocks.push({ ...moduleComment, type: 'docstring' });
            logger.debug(`Extracted module comment: ${moduleComment.text.substring(0, 30)}...`);
        }

        // 2. Extract JSDoc comments via LSP
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (symbols && symbols.length > 0) {
                await this.extractJSDocsFromSymbols(document, symbols, blocks);
            }
        } catch (error) {
            logger.error('Failed to get symbols from LSP', error);
        }

        // 3. Extract inline comments
        this.extractInlineComments(document, blocks);

        // Deduplicate blocks by text
        const uniqueBlocks = this.deduplicateBlocks(blocks);
        logger.debug(`Extracted ${blocks.length} blocks (${uniqueBlocks.filter(b => b.type === 'docstring').length} docstrings, ${uniqueBlocks.filter(b => b.type === 'comment').length} comments), ${uniqueBlocks.length} unique`);

        return uniqueBlocks;
    }

    /**
     * Recursively extract JSDoc comments from symbols
     */
    private async extractJSDocsFromSymbols(
        document: vscode.TextDocument,
        symbols: vscode.DocumentSymbol[],
        blocks: TextBlock[]
    ): Promise<void> {
        for (const symbol of symbols) {
            // Try to extract JSDoc comment right before this symbol
            const symbolStartLine = symbol.range.start.line;
            const comment = this.extractJSDocBeforeLine(document, symbolStartLine);
            if (comment && comment.text.trim()) {
                blocks.push({ ...comment, type: 'docstring' });
                logger.debug(`Extracted JSDoc from ${symbol.name}: ${comment.text.substring(0, 30)}...`);
            }

            // Recursively process children
            if (symbol.children && symbol.children.length > 0) {
                await this.extractJSDocsFromSymbols(document, symbol.children, blocks);
            }
        }
    }

    /**
     * Extract all inline comments from document
     */
    private extractInlineComments(
        document: vscode.TextDocument,
        blocks: TextBlock[]
    ): void {
        for (let lineNum = 0; lineNum < document.lineCount; lineNum++) {
            const comment = this.extractInlineComment(document, lineNum);
            if (comment && comment.text.trim()) {
                blocks.push({ ...comment, type: 'comment' });
                logger.debug(`Extracted comment at line ${lineNum}: ${comment.text.substring(0, 30)}...`);
            }
        }
    }

    /**
     * Deduplicate blocks by text content
     */
    private deduplicateBlocks(blocks: TextBlock[]): TextBlock[] {
        const seen = new Map<string, TextBlock>();
        for (const block of blocks) {
            if (!seen.has(block.text)) {
                seen.set(block.text, block);
            }
        }
        return Array.from(seen.values());
    }
}
