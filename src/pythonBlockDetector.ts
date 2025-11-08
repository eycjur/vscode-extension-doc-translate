import * as vscode from 'vscode';
import { logger } from './logger';

export interface TextBlock {
    text: string;
    range: vscode.Range;
}

export class PythonBlockDetector {
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
    public extractDocstringFromLine(document: vscode.TextDocument, startLine: number): TextBlock | null {
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
}
