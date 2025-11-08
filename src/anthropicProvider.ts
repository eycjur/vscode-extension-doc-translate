import Anthropic from '@anthropic-ai/sdk';
import * as vscode from 'vscode';
import { logger } from './logger';
import { ITranslationProvider } from './translationProvider';
import { withRetry, DEFAULT_RETRY_CONFIG } from './retryHelper';

export class AnthropicProvider implements ITranslationProvider {
    private client: Anthropic | null = null;

    constructor() {
        this.initializeClient();
    }

    private initializeClient(): void {
        const apiKey = this.getApiKey();
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
            logger.info('Anthropic client initialized successfully');
        } else {
            logger.warn('No Anthropic API key found. Client not initialized.');
        }
    }

    private getApiKey(): string | undefined {
        // Environment variable takes precedence
        const envKey = process.env.ANTHROPIC_API_KEY;
        if (envKey) {
            logger.debug('Using Anthropic API key from environment variable ANTHROPIC_API_KEY');
            return envKey;
        }

        // Fall back to VSCode configuration
        const config = vscode.workspace.getConfiguration('docTranslate');
        const configKey = config.get<string>('anthropicApiKey');
        if (configKey && configKey.trim() !== '') {
            logger.debug('Using Anthropic API key from VSCode settings');
            return configKey;
        }

        logger.warn('No Anthropic API key found in environment variable or settings');
        return undefined;
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<string>('model') || 'claude-haiku-4-5-20251001';
    }

    private getTimeout(): number {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<number>('timeout') || 30000;
    }

    private buildPrompt(text: string, targetLang: string): string {
        const langMap: { [key: string]: string } = {
            'en': 'English',
            'ja': 'Japanese',
            'zh': 'Chinese',
            'ko': 'Korean',
            'fr': 'French',
            'de': 'German',
            'es': 'Spanish',
            'it': 'Italian',
            'pt': 'Portuguese',
            'ru': 'Russian'
        };

        const targetLanguage = langMap[targetLang] || targetLang;

        return `You are a translation assistant specialized in software engineering context.
Translate the given text into natural ${targetLanguage}.

Rules:

Preserve technical terms (library names, function names, class names, variable names) as they are.

Prefer natural ${targetLanguage} rather than literal translation.

Output ONLY the translated ${targetLanguage} text. No explanation.

Translate this text:
${text}`;
    }

    async translate(text: string, targetLang: string): Promise<string> {
        logger.info(`Anthropic translation request received (text length: ${text.length} chars, target: ${targetLang})`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        if (!this.client) {
            // Re-initialize in case API key was added after extension activation
            logger.info('Client not initialized, attempting re-initialization');
            this.initializeClient();
            if (!this.client) {
                const errorMsg = 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable or configure docTranslate.anthropicApiKey in settings.';
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.buildPrompt(text, targetLang);
        const model = this.getModel();
        const timeout = this.getTimeout();

        // Get retry configuration from settings
        const config = vscode.workspace.getConfiguration('docTranslate');
        const retryConfig = {
            maxRetries: config.get<number>('maxRetries') || DEFAULT_RETRY_CONFIG.maxRetries,
            initialDelayMs: config.get<number>('retryInitialDelay') || DEFAULT_RETRY_CONFIG.initialDelayMs,
            maxDelayMs: DEFAULT_RETRY_CONFIG.maxDelayMs,
            backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier
        };

        logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('ANTHROPIC REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
            // Use retry logic for rate limit handling
            const translation = await withRetry(
                async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    logger.info('Sending request to Anthropic API...');
                    const startTime = Date.now();

                    const response = await this.client!.messages.create(
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
                    logger.info(`Anthropic API response received (${duration}ms)`);

                    if (response.content.length === 0) {
                        throw new Error('Empty response from Anthropic API');
                    }

                    const content = response.content[0];
                    if (content.type !== 'text') {
                        throw new Error('Unexpected response type from Anthropic API');
                    }

                    const translatedText = content.text.trim();
                    logger.info('Translation successful');
                    logger.info('='.repeat(60));
                    logger.info('ANTHROPIC RESPONSE:');
                    logger.info('-'.repeat(60));
                    logger.info(translatedText);
                    logger.info('='.repeat(60));

                    return translatedText;
                },
                retryConfig,
                'Anthropic translation'
            );

            return translation;
        } catch (error: any) {
            if (error.name === 'AbortError') {
                const errorMsg = `Translation request timed out after ${timeout}ms`;
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
            logger.error('Anthropic translation failed', error);
            throw new Error(`Anthropic translation failed: ${error.message}`);
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing Anthropic client');
        this.initializeClient();
    }
}
