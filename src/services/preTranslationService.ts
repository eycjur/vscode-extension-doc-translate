import * as path from 'path';
import * as vscode from 'vscode';
import { TranslationProviderFactory } from '../providers/translationProviderFactory';
import { TranslationCache } from './translationCache';
import { BlockDetectorFactory } from '../detectors/blockDetectorFactory';
import { InlineTranslationProvider } from './inlineTranslationProvider';
import { logger } from '../utils/logger';
import { ConfigManager } from '../utils/config';
import { TextBlock } from '../detectors/base/blockDetector';

// Maximum number of concurrent translation requests
const MAX_CONCURRENT_REQUESTS = 5;

export class PreTranslationService {
    private cache: TranslationCache;
    private inlineProvider: InlineTranslationProvider;
    private statusBarItem: vscode.StatusBarItem;
    private isTranslating = false;
    private translatedFiles = new Set<string>();

    constructor(cache: TranslationCache, inlineProvider: InlineTranslationProvider) {
        this.cache = cache;
        this.inlineProvider = inlineProvider;
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 90);
        this.statusBarItem.command = 'doc-translate.showLogs';
    }

    /**
     * Pre-translate all docstrings and comments in a document
     */
    async preTranslateDocument(document: vscode.TextDocument): Promise<void> {
        // Only process supported languages
        if (!BlockDetectorFactory.isLanguageSupported(document.languageId)) {
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
                this.statusBarItem.hide();
                return;
            }

            // Show progress in status bar
            this.statusBarItem.text = `$(sync~spin) Translating ${blocks.length} blocks...`;
            this.statusBarItem.show();

            let translated = 0;
            const startTime = Date.now();
            let translationSucceeded = false;

            // Filter out already cached blocks
            const blocksToTranslate = blocks.filter(block => !this.cache.get(block.text));
            const cachedCount = blocks.length - blocksToTranslate.length;

            if (cachedCount > 0) {
                logger.info(`${cachedCount} blocks already cached, skipping`);
                translated = cachedCount;
            }

            if (blocksToTranslate.length === 0) {
                logger.info('All blocks already cached, no translation needed');
                await this.inlineProvider.updateInlineTranslations(document, blocks);
                translationSucceeded = true;
                translated = blocks.length;
            } else {
                logger.info(`Translating ${blocksToTranslate.length} blocks with max ${MAX_CONCURRENT_REQUESTS} concurrent requests`);

                // Display cached translations first
                if (cachedCount > 0) {
                    await this.inlineProvider.updateInlineTranslations(document, blocks);
                }

                // Translate blocks in parallel with concurrency limit
                const failedBlocks = await this.translateBlocksConcurrently(
                    document,
                    blocksToTranslate,
                    blocks,
                    (current, total) => {
                        translated = cachedCount + current;
                        this.statusBarItem.text = `$(sync~spin) Translating ${translated}/${total}...`;
                    }
                );

                if (failedBlocks.length === 0) {
                    translationSucceeded = true;
                    translated = blocks.length;
                } else {
                    translationSucceeded = await this.handlePartialFailures(document, blocks, failedBlocks);
                    if (translationSucceeded) {
                        translated = blocks.length;
                    }
                }
            }

            const duration = Date.now() - startTime;
            if (translationSucceeded) {
                logger.info(`Pre-translation completed: ${translated}/${blocks.length} blocks in ${duration}ms`);
                this.translatedFiles.add(fileKey);
                this.statusBarItem.text = `$(check) Translated ${translated} blocks`;
                this.statusBarItem.tooltip = `Completed: ${path.basename(document.fileName)}`;
            } else {
                logger.warn(`Pre-translation finished with failures: ${translated}/${blocks.length} blocks in ${duration}ms`);
                this.statusBarItem.text = `$(warning) Translation incomplete`;
                this.statusBarItem.tooltip = `Some blocks failed in ${path.basename(document.fileName)}`;
            }
            logger.info('='.repeat(60));
            setTimeout(() => this.statusBarItem.hide(), 5000);

        } catch (error) {
            await this.handleFileTranslationError(document, error);
            this.statusBarItem.text = `$(error) Translation failed`;
            this.statusBarItem.tooltip = `Failed: ${path.basename(document.fileName)}`;
            setTimeout(() => this.statusBarItem.hide(), 5000);
        } finally {
            this.isTranslating = false;
        }
    }

    /**
     * Translate blocks concurrently with a limit on concurrent requests
     * Updates inline translations progressively as each block completes
     */
    private async translateBlocksConcurrently(
        document: vscode.TextDocument,
        blocksToTranslate: TextBlock[],
        allBlocks: TextBlock[],
        onProgress: (current: number, total: number) => void
    ): Promise<TextBlock[]> {
        let completed = 0;
        let index = 0;
        const failedBlocks: TextBlock[] = [];

        // Get translation provider and language settings
        const provider = TranslationProviderFactory.getProvider();
        const targetLang = ConfigManager.getTargetLang();

        // Process blocks in batches
        while (index < blocksToTranslate.length) {
            // Get next batch (up to MAX_CONCURRENT_REQUESTS)
            const batch = blocksToTranslate.slice(index, index + MAX_CONCURRENT_REQUESTS);
            index += batch.length;

            // Translate all blocks in this batch concurrently
            const promises = batch.map(async (block) => {
                try {
                    logger.debug(`Translating block text (${block.text.length} chars): "${block.text.substring(0, 100)}..."`);
                    const translation = await provider.translate(block.text, targetLang);
                    this.cache.set(block.text, translation);
                    completed++;
                    onProgress(completed, allBlocks.length);
                    logger.debug(`Completed ${completed}/${blocksToTranslate.length}`);

                    // Update inline translations progressively after each block completes
                    await this.inlineProvider.updateInlineTranslations(document, allBlocks);
                } catch (error) {
                    failedBlocks.push(block);
                    logger.error(`Failed to translate block: ${block.text.substring(0, 30)}...`, error);
                }
            });

            // Wait for all translations in this batch to complete
            await Promise.all(promises);
        }

        logger.info(`Concurrent translation completed: ${completed}/${blocksToTranslate.length} blocks translated`);
        return failedBlocks;
    }

    /**
     * Extract all translatable blocks from document
     */
    private async extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]> {
        // Get the appropriate detector for this language
        const detector = BlockDetectorFactory.getDetector(document.languageId);
        if (!detector) {
            logger.warn(`No detector available for language: ${document.languageId}`);
            return [];
        }

        // Use the detector to extract all blocks
        return await detector.extractAllBlocks(document);
    }

    private async handlePartialFailures(
        document: vscode.TextDocument,
        allBlocks: TextBlock[],
        failedBlocks: TextBlock[]
    ): Promise<boolean> {
        if (failedBlocks.length === 0) {
            return true;
        }

        const fileName = path.basename(document.fileName);
        const message = `${fileName}: ${failedBlocks.length} blocks failed to translate`;
        logger.notifyWarning(message);

        const retryLabel = 'Retry Failed Blocks';
        const selection = await vscode.window.showWarningMessage(
            `Doc Translate: ${message}`,
            retryLabel,
            'View Logs'
        );

        if (selection === 'View Logs') {
            logger.show();
            return false;
        }

        if (selection !== retryLabel) {
            return false;
        }

        this.statusBarItem.text = `$(sync~spin) Retrying ${failedBlocks.length} blocks...`;
        this.statusBarItem.tooltip = `${fileName} – retrying failed translations`;
        this.statusBarItem.show();

        const remainingFailures = await this.translateBlocksConcurrently(
            document,
            failedBlocks,
            allBlocks,
            (current, _total) => {
                this.statusBarItem.text = `$(sync~spin) Retrying ${current}/${failedBlocks.length} blocks...`;
            }
        );

        if (remainingFailures.length === 0) {
            return true;
        }

        logger.notifyError(`${fileName}: ${remainingFailures.length} blocks still failing after retry`);
        return false;
    }

    private async handleFileTranslationError(document: vscode.TextDocument, error: any): Promise<void> {
        const fileName = path.basename(document.fileName);
        const reason = error?.message || error?.toString() || 'Unknown error';
        const message = `${fileName} の翻訳に失敗しました (${reason})`;
        logger.notifyError(message, error);

        const retryLabel = 'Retry File';
        const selection = await vscode.window.showErrorMessage(
            `Doc Translate: ${message}`,
            retryLabel,
            'View Logs'
        );

        if (selection === 'View Logs') {
            logger.show();
            return;
        }

        if (selection === retryLabel) {
            this.scheduleRetry(document);
        }
    }

    private scheduleRetry(document: vscode.TextDocument): void {
        setTimeout(() => this.preTranslateDocument(document), 100);
    }

    /**
     * Clear pre-translation cache for a file
     */
    clearFileCache(uri: vscode.Uri): void {
        const fileKey = uri.toString();
        this.translatedFiles.delete(fileKey);
        this.inlineProvider.clearFileDecorations(uri);
        logger.info(`Cleared pre-translation cache for: ${uri.fsPath}`);
    }

    /**
     * Clear all pre-translation caches
     */
    clearAllCaches(): void {
        this.translatedFiles.clear();
        this.inlineProvider.clearAllDecorations();
        logger.info('Cleared all pre-translation caches');
    }

    /**
     * Dispose resources
     */
    dispose(): void {
        this.statusBarItem.dispose();
    }
}
