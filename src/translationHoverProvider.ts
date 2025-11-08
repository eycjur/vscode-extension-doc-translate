import * as vscode from 'vscode';
import { ClaudeClient } from './claudeClient';
import { TranslationCache } from './translationCache';
import { PythonBlockDetector } from './pythonBlockDetector';

export class TranslationHoverProvider implements vscode.HoverProvider {
    private claudeClient: ClaudeClient;
    private cache: TranslationCache;
    private detector: PythonBlockDetector;

    constructor() {
        this.claudeClient = new ClaudeClient();
        this.cache = new TranslationCache();
        this.detector = new PythonBlockDetector();
    }

    async provideHover(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Hover | null> {
        // Extract text block at cursor position
        const block = this.detector.extractBlock(document, position);
        if (!block || !block.text) {
            return null;
        }

        try {
            // Check cache first
            let translation = this.cache.get(block.text);

            if (!translation) {
                // Translate using Claude API
                translation = await this.claudeClient.translate(block.text);

                // Store in cache
                this.cache.set(block.text, translation);
            }

            // Create hover content
            const markdown = new vscode.MarkdownString();
            markdown.appendCodeblock(translation, 'plaintext');

            return new vscode.Hover(markdown, block.range);
        } catch (error: any) {
            // Show error in hover
            const markdown = new vscode.MarkdownString();
            markdown.appendText(`❌ ${error.message}`);
            return new vscode.Hover(markdown, block.range);
        }
    }

    // Update client configuration (called when settings change)
    updateConfiguration(): void {
        this.claudeClient.updateConfiguration();
    }

    // Clear translation cache
    clearCache(): void {
        this.cache.clear();
    }
}
