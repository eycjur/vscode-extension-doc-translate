import * as vscode from 'vscode';
import { logger } from '../../utils/logger';
import { IBlockDetector, TextBlock } from './blockDetector';

/**
 * Base class for block detectors with common functionality
 */
export abstract class BaseBlockDetector implements IBlockDetector {
    /**
     * Get symbols from LSP (Language Server Protocol)
     */
    protected async getSymbolsFromLSP(document: vscode.TextDocument): Promise<vscode.DocumentSymbol[] | null> {
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
            return symbols;
        } catch (error) {
            logger.error('Failed to get symbols from LSP', error);
            return null;
        }
    }

    /**
     * Recursively find symbol at the given position
     */
    protected findSymbolAtPosition(symbols: vscode.DocumentSymbol[], position: vscode.Position): vscode.DocumentSymbol | null {
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
     * Deduplicate blocks by text content
     */
    protected deduplicateBlocks(blocks: TextBlock[]): TextBlock[] {
        const seen = new Map<string, TextBlock>();
        for (const block of blocks) {
            if (!seen.has(block.text)) {
                seen.set(block.text, block);
            }
        }
        return Array.from(seen.values());
    }

    // Abstract methods to be implemented by concrete detectors
    abstract extractBlock(document: vscode.TextDocument, position: vscode.Position): Promise<TextBlock | null>;
    abstract extractDocstringFromLine(document: vscode.TextDocument, startLine: number): Omit<TextBlock, 'type'> | null;
    abstract extractInlineComment(document: vscode.TextDocument, lineNumber: number): Omit<TextBlock, 'type'> | null;
    abstract extractModuleDocstring(document: vscode.TextDocument): Omit<TextBlock, 'type'> | null;
    abstract extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]>;
}
