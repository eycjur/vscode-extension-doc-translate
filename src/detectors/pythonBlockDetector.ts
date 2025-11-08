import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { TextBlock } from './base/blockDetector';
import { BaseBlockDetector } from './base/baseDetector';

export class PythonBlockDetector extends BaseBlockDetector {
    /**
     * Extract translatable text block at the given position using LSP
     * Only detects docstrings via LSP
     */
    async extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        logger.debug(`Extracting block at position: line ${position.line}, char ${position.character}`);

        // Try to detect docstring using LSP
        const docstring = await this.extractDocstringLSP(document, position);
        if (docstring) {
            logger.info(`Detected docstring via LSP (${docstring.range.start.line}-${docstring.range.end.line})`);
            logger.debug('Docstring content:', { text: docstring.text.substring(0, 50) + '...' });
            return docstring;
        }

        logger.debug('No translatable block found at this position');
        return null;
    }

    /**
     * Extract docstring using LSP (Language Server Protocol)
     */
    private async extractDocstringLSP(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null> {
        const symbols = await this.getSymbolsFromLSP(document);
        if (!symbols) {
            return null;
        }

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
            return { ...docstring, type: 'docstring' as const };
        }

        return null;
    }

    /**
     * Extract docstring starting from a specific line
     */
    public extractDocstringFromLine(document: vscode.TextDocument, startLine: number): Omit<TextBlock, 'type'> | null {
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
    ): Omit<TextBlock, 'type'> | null {
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
     * Extract inline comment from a line
     */
    public extractInlineComment(document: vscode.TextDocument, lineNumber: number): Omit<TextBlock, 'type'> | null {
        if (lineNumber >= document.lineCount) {
            return null;
        }

        const line = document.lineAt(lineNumber);
        const text = line.text;

        // Find # that is not inside a string
        const hashIndex = this.findCommentStart(text);
        if (hashIndex === -1) {
            return null;
        }

        // Extract comment text
        const commentText = text.substring(hashIndex + 1).trim();
        if (commentText === '') {
            return null;
        }

        const range = new vscode.Range(
            lineNumber,
            hashIndex,
            lineNumber,
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

    /**
     * Extract module-level docstring (top-level docstring at the beginning of file)
     */
    public extractModuleDocstring(document: vscode.TextDocument): Omit<TextBlock, 'type'> | null {
        // Look for docstring at the beginning of the file
        // Skip initial comments and blank lines
        for (let lineNum = 0; lineNum < Math.min(50, document.lineCount); lineNum++) {
            const line = document.lineAt(lineNum);
            const trimmedText = line.text.trim();

            // Skip blank lines and comments
            if (trimmedText === '' || trimmedText.startsWith('#')) {
                continue;
            }

            // Check if this line starts with triple quotes (module docstring)
            if (trimmedText.startsWith('"""') || trimmedText.startsWith("'''")) {
                const docstring = this.extractDocstringFromLine(document, lineNum);
                if (docstring) {
                    logger.debug(`Found module docstring at line ${lineNum}`);
                    return docstring;
                }
            }

            // If we encounter import or other code, stop searching
            if (trimmedText.startsWith('import ') ||
                trimmedText.startsWith('from ') ||
                trimmedText.startsWith('class ') ||
                trimmedText.startsWith('def ') ||
                trimmedText.startsWith('@')) {
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

        // 1. Extract module-level docstring (file top-level)
        const moduleDocstring = this.extractModuleDocstring(document);
        if (moduleDocstring && moduleDocstring.text.trim()) {
            blocks.push({ ...moduleDocstring, type: 'docstring' });
            logger.debug(`Extracted module docstring: ${moduleDocstring.text.substring(0, 30)}...`);
        }

        // 2. Extract docstrings via LSP
        try {
            const symbols = await vscode.commands.executeCommand<vscode.DocumentSymbol[]>(
                'vscode.executeDocumentSymbolProvider',
                document.uri
            );

            if (symbols && symbols.length > 0) {
                await this.extractDocstringsFromSymbols(document, symbols, blocks);
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
     * Recursively extract docstrings from symbols
     */
    private async extractDocstringsFromSymbols(
        document: vscode.TextDocument,
        symbols: vscode.DocumentSymbol[],
        blocks: TextBlock[]
    ): Promise<void> {
        for (const symbol of symbols) {
            // Try to extract docstring for this symbol
            const symbolBodyStart = symbol.selectionRange.end.line + 1;
            if (symbolBodyStart < document.lineCount) {
                const docstring = this.extractDocstringFromLine(document, symbolBodyStart);
                if (docstring && docstring.text.trim()) {
                    blocks.push({ ...docstring, type: 'docstring' });
                    logger.debug(`Extracted docstring from ${symbol.name}: ${docstring.text.substring(0, 30)}...`);
                }
            }

            // Recursively process children
            if (symbol.children && symbol.children.length > 0) {
                await this.extractDocstringsFromSymbols(document, symbol.children, blocks);
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

}
