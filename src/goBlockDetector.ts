import * as vscode from 'vscode';
import { logger } from './logger';
import { IBlockDetector, TextBlock } from './blockDetector';

export class GoBlockDetector implements IBlockDetector {
    /**
     * Extract translatable text block at the given position using LSP
     */
    async extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        logger.debug(`Extracting Go block at position: line ${position.line}, char ${position.character}`);

        // Try to detect godoc or comment using LSP
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

            // Check for godoc comment right before the symbol
            const symbolStartLine = symbol.range.start.line;
            const comment = this.extractGodocBeforeLine(document, symbolStartLine);
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
     * Extract godoc comment right before a specific line
     */
    private extractGodocBeforeLine(document: vscode.TextDocument, line: number): Omit<TextBlock, 'type'> | null {
        // Search backwards from the line for godoc comment
        const commentLines: { lineNum: number; text: string }[] = [];

        for (let i = line - 1; i >= Math.max(0, line - 50); i--) {
            const lineText = document.lineAt(i).text;
            const trimmed = lineText.trim();

            // Skip empty lines at the start of search
            if (commentLines.length === 0 && trimmed === '') {
                continue;
            }

            // Single-line comment
            if (trimmed.startsWith('//')) {
                commentLines.unshift({ lineNum: i, text: trimmed.substring(2).trim() });
                continue;
            }

            // Check for multi-line comment
            if (trimmed.includes('*/')) {
                const multiLine = this.extractMultiLineCommentEndingAtLine(document, i);
                if (multiLine) {
                    return multiLine;
                }
                break;
            }

            // If we hit code or non-comment, stop
            if (trimmed !== '') {
                break;
            }
        }

        // If we found consecutive // comments, return them
        if (commentLines.length > 0) {
            const firstLine = commentLines[0].lineNum;
            const lastLine = commentLines[commentLines.length - 1].lineNum;
            const text = commentLines.map(c => c.text).join('\n');

            const range = new vscode.Range(
                firstLine,
                document.lineAt(firstLine).text.indexOf('//'),
                lastLine,
                document.lineAt(lastLine).text.length
            );

            return { text, range };
        }

        return null;
    }

    /**
     * Extract multi-line comment ending at a specific line
     */
    private extractMultiLineCommentEndingAtLine(document: vscode.TextDocument, endLine: number): Omit<TextBlock, 'type'> | null {
        const endLineText = document.lineAt(endLine).text;
        const endIndex = endLineText.indexOf('*/');
        if (endIndex === -1) {
            return null;
        }

        const endCol = endIndex + 2;

        // Search backwards for the start
        for (let i = endLine; i >= 0; i--) {
            const lineText = document.lineAt(i).text;
            const startIndex = lineText.indexOf('/*');
            if (startIndex !== -1) {
                const startCol = startIndex;
                const range = new vscode.Range(i, startCol, endLine, endCol);
                const fullText = document.getText(range);

                // Extract content (remove /* and */)
                const content = fullText
                    .replace(/^\/\*/, '')
                    .replace(/\*\/$/, '')
                    .trim();

                return { text: content, range };
            }
        }

        return null;
    }

    /**
     * Extract docstring starting from a specific line (godoc comment)
     */
    public extractDocstringFromLine(document: vscode.TextDocument, startLine: number): Omit<TextBlock, 'type'> | null {
        if (startLine >= document.lineCount) {
            return null;
        }

        const firstLine = document.lineAt(startLine).text.trim();

        // Check for multi-line comment
        if (firstLine.startsWith('/*')) {
            return this.extractMultiLineComment(document, startLine);
        }

        // Check for single-line comment block
        if (firstLine.startsWith('//')) {
            return this.extractSingleLineCommentBlock(document, startLine);
        }

        return null;
    }

    /**
     * Extract multi-line comment starting from a specific line
     */
    private extractMultiLineComment(
        document: vscode.TextDocument,
        startLine: number
    ): Omit<TextBlock, 'type'> | null {
        const firstLineText = document.lineAt(startLine).text;
        const startIndex = firstLineText.indexOf('/*');

        if (startIndex === -1) {
            return null;
        }

        const startCol = startIndex;
        let endLine = startLine;
        let endCol = startCol + 2;

        // Check if it's a single-line comment
        const closeIndex = firstLineText.indexOf('*/', startCol + 2);
        if (closeIndex !== -1) {
            endCol = closeIndex + 2;
        } else {
            // Multi-line comment - search for closing */
            let foundEnd = false;
            for (let line = startLine + 1; line < document.lineCount; line++) {
                const lineText = document.lineAt(line).text;
                const closeIdx = lineText.indexOf('*/');
                if (closeIdx !== -1) {
                    endLine = line;
                    endCol = closeIdx + 2;
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
            .replace(/^\/\*/, '')
            .replace(/\*\/$/, '')
            .trim();

        return { text: content, range };
    }

    /**
     * Extract consecutive single-line comments
     */
    private extractSingleLineCommentBlock(
        document: vscode.TextDocument,
        startLine: number
    ): Omit<TextBlock, 'type'> | null {
        const comments: string[] = [];
        let endLine = startLine;

        for (let i = startLine; i < document.lineCount; i++) {
            const lineText = document.lineAt(i).text.trim();
            if (lineText.startsWith('//')) {
                comments.push(lineText.substring(2).trim());
                endLine = i;
            } else if (lineText === '') {
                // Allow empty lines within comment block
                continue;
            } else {
                break;
            }
        }

        if (comments.length === 0) {
            return null;
        }

        const text = comments.join('\n');
        const range = new vscode.Range(
            startLine,
            document.lineAt(startLine).text.indexOf('//'),
            endLine,
            document.lineAt(endLine).text.length
        );

        return { text, range };
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
        let inString = false;
        let inRawString = false;
        let prevChar = '';

        for (let i = 0; i < line.length - 1; i++) {
            const char = line[i];
            const nextChar = line[i + 1];

            // Toggle string states
            if (char === '`') {
                inRawString = !inRawString;
            } else if (char === '"' && prevChar !== '\\' && !inRawString) {
                inString = !inString;
            } else if (char === '/' && nextChar === '/' && !inString && !inRawString) {
                return i;
            }

            prevChar = char;
        }

        return -1;
    }

    /**
     * Extract package-level comment (file top-level)
     */
    public extractModuleDocstring(document: vscode.TextDocument): Omit<TextBlock, 'type'> | null {
        // Look for package doc at the beginning of the file
        const commentLines: { lineNum: number; text: string }[] = [];

        for (let lineNum = 0; lineNum < Math.min(100, document.lineCount); lineNum++) {
            const line = document.lineAt(lineNum);
            const trimmedText = line.text.trim();

            // Skip blank lines
            if (trimmedText === '') {
                if (commentLines.length === 0) {
                    continue;
                } else {
                    // Empty line after comments might separate them from package declaration
                    continue;
                }
            }

            // Check for single-line comments
            if (trimmedText.startsWith('//')) {
                commentLines.push({ lineNum, text: trimmedText.substring(2).trim() });
                continue;
            }

            // Check for multi-line comment
            if (trimmedText.startsWith('/*')) {
                const comment = this.extractDocstringFromLine(document, lineNum);
                if (comment) {
                    logger.debug(`Found package comment at line ${lineNum}`);
                    return comment;
                }
            }

            // If we encounter package declaration, combine preceding comments
            if (trimmedText.startsWith('package ')) {
                if (commentLines.length > 0) {
                    const firstLine = commentLines[0].lineNum;
                    const lastLine = commentLines[commentLines.length - 1].lineNum;
                    const text = commentLines.map(c => c.text).join('\n');

                    const range = new vscode.Range(
                        firstLine,
                        document.lineAt(firstLine).text.indexOf('//'),
                        lastLine,
                        document.lineAt(lastLine).text.length
                    );

                    logger.debug(`Found package comment at lines ${firstLine}-${lastLine}`);
                    return { text, range };
                }
                break;
            }

            // If we encounter other code before package declaration, stop
            if (!trimmedText.startsWith('//') && !trimmedText.startsWith('/*')) {
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

        // 1. Extract package-level comment (file top-level)
        const packageComment = this.extractModuleDocstring(document);
        if (packageComment && packageComment.text.trim()) {
            blocks.push({ ...packageComment, type: 'docstring' });
            logger.debug(`Extracted package comment: ${packageComment.text.substring(0, 30)}...`);
        }

        // 2. Extract godoc comments via LSP
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (symbols && symbols.length > 0) {
                await this.extractGodocsFromSymbols(document, symbols, blocks);
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
     * Recursively extract godoc comments from symbols
     */
    private async extractGodocsFromSymbols(
        document: vscode.TextDocument,
        symbols: vscode.DocumentSymbol[],
        blocks: TextBlock[]
    ): Promise<void> {
        for (const symbol of symbols) {
            // Try to extract godoc comment right before this symbol
            const symbolStartLine = symbol.range.start.line;
            const comment = this.extractGodocBeforeLine(document, symbolStartLine);
            if (comment && comment.text.trim()) {
                blocks.push({ ...comment, type: 'docstring' });
                logger.debug(`Extracted godoc from ${symbol.name}: ${comment.text.substring(0, 30)}...`);
            }

            // Recursively process children
            if (symbol.children && symbol.children.length > 0) {
                await this.extractGodocsFromSymbols(document, symbol.children, blocks);
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
