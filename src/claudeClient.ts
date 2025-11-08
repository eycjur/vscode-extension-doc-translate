import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { logger } from './logger';

export class ClaudeClient {
    private client: Anthropic | null = null;
    private readonly translationPromptTemplate = `You are a translation assistant specialized in software engineering context.
Translate the given text from English into natural Japanese.

Rules:

Preserve technical terms (library names, function names, class names, variable names) as they are.

Prefer natural Japanese rather than literal translation.

Output ONLY the translated Japanese text. No explanation, no English.

Translate this text:
{{COMMENT_TEXT}}`;

    constructor() {
        this.initializeClient();
    }

    private initializeClient(): void {
        const apiKey = this.getApiKey();
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
            logger.info('Claude client initialized successfully');
        } else {
            logger.warn('No API key found. Client not initialized.');
        }
    }

    private getApiKey(): string | undefined {
        // Environment variable takes precedence
        const envKey = process.env.ANTHROPIC_API_KEY;
        if (envKey) {
            logger.debug('Using API key from environment variable ANTHROPIC_API_KEY');
            return envKey;
        }

        // Fall back to VSCode configuration
        const config = vscode.workspace.getConfiguration('docTranslate');
        const configKey = config.get<string>('anthropicApiKey');
        if (configKey && configKey.trim() !== '') {
            logger.debug('Using API key from VSCode settings');
            return configKey;
        }

        logger.warn('No API key found in environment variable or settings');
        return undefined;
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<string>('model') || 'claude-3-5-sonnet-20241022';
    }

    private getTimeout(): number {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<number>('timeout') || 30000;
    }

    async translate(text: string): Promise<string> {
        logger.info(`Translation request received (text length: ${text.length} chars)`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        if (!this.client) {
            // Re-initialize in case API key was added after extension activation
            logger.info('Client not initialized, attempting re-initialization');
            this.initializeClient();
            if (!this.client) {
                const errorMsg = 'API key not configured. Please set ANTHROPIC_API_KEY environment variable or configure docTranslate.anthropicApiKey in settings.';
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.translationPromptTemplate.replace('{{COMMENT_TEXT}}', text);
        const model = this.getModel();
        const timeout = this.getTimeout();

        logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('LLM REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            logger.info('Sending request to Claude API...');
            const startTime = Date.now();

            const response = await this.client.messages.create(
                {
                    model,
                    max_tokens: 1024,
                    messages: [
                        {
                            role: 'user',
                            content: prompt,
                        },
                    ],
                },
                {
                    signal: controller.signal as AbortSignal,
                }
            );

            clearTimeout(timeoutId);
            const duration = Date.now() - startTime;
            logger.info(`Claude API response received (${duration}ms)`);

            if (response.content.length === 0) {
                throw new Error('Empty response from Claude API');
            }

            const content = response.content[0];
            if (content.type !== 'text') {
                throw new Error('Unexpected response type from Claude API');
            }

            const translation = content.text.trim();
            logger.info('Translation successful');
            logger.info('='.repeat(60));
            logger.info('LLM RESPONSE:');
            logger.info('-'.repeat(60));
            logger.info(translation);
            logger.info('='.repeat(60));

            return translation;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                const errorMsg = `Translation request timed out after ${timeout}ms`;
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
            logger.error('Translation failed', error);
            throw new Error(`Translation failed: ${error.message}`);
        }
    }

    // Re-initialize client when configuration changes
    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing client');
        this.initializeClient();
    }
}
