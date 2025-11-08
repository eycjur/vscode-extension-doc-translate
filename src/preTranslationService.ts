import * as vscode from 'vscode';
import { ClaudeClient } from './claudeClient';
import { TranslationCache } from './translationCache';
import { PythonBlockDetector } from './pythonBlockDetector';
import { logger } from './logger';

export class PreTranslationService {
    private claudeClient: ClaudeClient;
    private cache: TranslationCache;
    private detector: PythonBlockDetector;
    private statusBarItem: vscode.StatusBarItem;
    private isTranslating = false;
    private translatedFiles = new Set<string>();

    constructor(claudeClient: ClaudeClient, cache: TranslationCache) {
        this.claudeClient = claudeClient;
        this.cache = cache;
        this.detector = new PythonBlockDetector();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    }

    /**
     * Pre-translate all docstrings and comments in a document
     */
    async preTranslateDocument(document: vscode.TextDocument): Promise<void> {
        // Only process Python files
        if (document.languageId !== 'python') {
            return;
        }

        // Skip if already translated
        const fileKey = document.uri.toString();
        if (this.translatedFiles.has(fileKey)) {
            logger.info(`File already pre-translated: ${document.fileName}`);
            return;
        }

        // Skip if already translating
        if (this.isTranslating) {
            logger.debug('Pre-translation already in progress, skipping');
            return;
        }

        this.isTranslating = true;
        logger.info('='.repeat(60));
        logger.info(`Starting pre-translation for: ${document.fileName}`);
        logger.info('='.repeat(60));

        try {
            // Extract all translatable blocks
            const blocks = await this.extractAllBlocks(document);
            logger.info(`Found ${blocks.length} translatable blocks`);

            if (blocks.length === 0) {
                this.translatedFiles.add(fileKey);
                return;
            }

            // Show progress in status bar
            this.statusBarItem.text = `$(sync~spin) Translating ${blocks.length} blocks...`;
            this.statusBarItem.show();

            let translated = 0;
            const startTime = Date.now();

            // Translate each block
            for (const block of blocks) {
                // Check if already in cache
                if (this.cache.get(block.text)) {
                    logger.debug(`Block already cached, skipping: ${block.text.substring(0, 30)}...`);
                    translated++;
                    continue;
                }

                try {
                    logger.info(`Translating block ${translated + 1}/${blocks.length}`);
                    logger.debug(`Pre-translation block text (${block.text.length} chars): "${block.text.substring(0, 100)}..."`);
                    const translation = await this.claudeClient.translate(block.text);
                    this.cache.set(block.text, translation);
                    translated++;

                    // Update progress
                    this.statusBarItem.text = `$(sync~spin) Translating ${translated}/${blocks.length}...`;
                } catch (error) {
                    logger.error(`Failed to translate block: ${block.text.substring(0, 30)}...`, error);
                    // Continue with next block even if one fails
                }
            }

            const duration = Date.now() - startTime;
            logger.info(`Pre-translation completed: ${translated}/${blocks.length} blocks in ${duration}ms`);
            logger.info('='.repeat(60));

            // Mark as translated
            this.translatedFiles.add(fileKey);

            // Show completion message
            this.statusBarItem.text = `$(check) Translated ${translated} blocks`;
            setTimeout(() => this.statusBarItem.hide(), 3000);

        } catch (error) {
            logger.error('Pre-translation failed', error);
            this.statusBarItem.text = `$(error) Translation failed`;
            setTimeout(() => this.statusBarItem.hide(), 3000);
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * Extract all translatable blocks from document
     */
    private async extractAllBlocks(document: vscode.TextDocument): Promise<Array<{ text: string; range: vscode.Range }>> {
        const blocks: Array<{ text: string; range: vscode.Range }> = [];

        // Extract docstrings via LSP
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

        // Deduplicate blocks by text
        const uniqueBlocks = this.deduplicateBlocks(blocks);
        logger.debug(`Extracted ${blocks.length} blocks, ${uniqueBlocks.length} unique`);

        return uniqueBlocks;
    }

    /**
     * Recursively extract docstrings from symbols
     */
    private async extractDocstringsFromSymbols(
        document: vscode.TextDocument,
        symbols: vscode.DocumentSymbol[],
        blocks: Array<{ text: string; range: vscode.Range }>
    ): Promise<void> {
        for (const symbol of symbols) {
            // Try to extract docstring for this symbol
            const symbolBodyStart = symbol.selectionRange.end.line + 1;
            if (symbolBodyStart < document.lineCount) {
                const docstring = this.detector.extractDocstringFromLine(document, symbolBodyStart);
                if (docstring && docstring.text.trim()) {
                    blocks.push({ text: docstring.text, range: docstring.range });
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
     * Deduplicate blocks by text content
     */
    private deduplicateBlocks(blocks: Array<{ text: string; range: vscode.Range }>): Array<{ text: string; range: vscode.Range }> {
        const seen = new Map<string, { text: string; range: vscode.Range }>();
        for (const block of blocks) {
            if (!seen.has(block.text)) {
                seen.set(block.text, block);
            }
        }
        return Array.from(seen.values());
    }

    /**
     * Clear pre-translation cache for a file
     */
    clearFileCache(uri: vscode.Uri): void {
        const fileKey = uri.toString();
        this.translatedFiles.delete(fileKey);
        logger.info(`Cleared pre-translation cache for: ${uri.fsPath}`);
    }

    /**
     * Clear all pre-translation caches
     */
    clearAllCaches(): void {
        this.translatedFiles.clear();
        logger.info('Cleared all pre-translation caches');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}
