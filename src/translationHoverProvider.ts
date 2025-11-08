import * as vscode from 'vscode';
import { ClaudeClient } from './claudeClient';
import { TranslationCache } from './translationCache';
import { PythonBlockDetector } from './pythonBlockDetector';
import { logger } from './logger';

export class TranslationHoverProvider implements vscode.HoverProvider {
    public claudeClient: ClaudeClient;
    public cache: TranslationCache;
    private detector: PythonBlockDetector;
    private statusBarItem: vscode.StatusBarItem;

    constructor() {
        logger.info('Initializing TranslationHoverProvider');
        this.claudeClient = new ClaudeClient();
        this.cache = new TranslationCache();
        this.detector = new PythonBlockDetector();
        this.statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        logger.info(`Hover triggered at ${document.fileName}:${position.line}:${position.character}`);

        // Extract text block at cursor position (now async for LSP support)
        const block = await this.detector.extractBlock(document, position);
        if (!block || !block.text) {
            logger.debug('No translatable block found, skipping hover');
            return null;
        }

        try {
            // Check cache first
            let translation = this.cache.get(block.text);

            if (translation) {
                logger.info('Translation found in cache');
                logger.debug('Cached translation:', { translation: translation.substring(0, 50) + '...' });
            } else {
                // Show loading indicator
                this.statusBarItem.text = "$(sync~spin) Translating...";
                this.statusBarItem.show();
                logger.info('Showing loading indicator in status bar');

                try {
                    logger.info('Translation not in cache, requesting from Claude API');
                    // Translate using Claude API
                    translation = await this.claudeClient.translate(block.text);

                    // Store in cache
                    this.cache.set(block.text, translation);
                    logger.info(`Translation cached (cache size: ${this.cache.size})`);
                } finally {
                    // Hide loading indicator
                    this.statusBarItem.hide();
                    logger.info('Loading indicator hidden');
                }
            }

            // Create hover content
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(translation, 'plaintext');

            logger.info('Hover content created successfully');
            return new vscode.Hover(markdown, block.range);
        } catch (error: any) {
            logger.error('Error in provideHover', error);
            // Hide loading indicator on error
            this.statusBarItem.hide();
            // Show error in hover
            const markdown = new vscode.MarkdownString();
            markdown.appendText(`❌ ${error.message}`);
            return new vscode.Hover(markdown, block.range);
        }
    }

    // Update client configuration (called when settings change)
    updateConfiguration(): void {
        logger.info('Updating configuration');
        this.claudeClient.updateConfiguration();
    }

    // Clear translation cache
    clearCache(): void {
        logger.info(`Clearing translation cache (${this.cache.size} items)`);
        this.cache.clear();
        logger.info('Cache cleared');
    }

    // Dispose resources
    dispose(): void {
        this.statusBarItem.dispose();
    }
}
