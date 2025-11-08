import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { ITranslationProvider } from './base/translationProvider';
import { BaseProvider } from './base/baseProvider';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

export class AnthropicProvider extends BaseProvider implements ITranslationProvider {
    private client: Anthropic | null = null;

    constructor() {
        super();
        this.initializeClient();
    }

    private initializeClient(): void {
        const apiKey = ConfigManager.getAnthropicApiKey();
        if (apiKey) {
            this.client = new Anthropic({ apiKey });
            logger.info('Anthropic client initialized successfully');
        } else {
            logger.warn('No Anthropic API key found. Client not initialized.');
        }
    }

    async translate(text: string, targetLang: string): Promise<string> {
        logger.info(`Anthropic translation request received (text length: ${text.length} chars, target: ${targetLang})`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        // Check if translation is needed (skip if already in target language)
        const skipResult = await this.checkTranslationNeeded(text, targetLang);
        if (skipResult !== null) {
            return skipResult;
        }

        if (!this.client) {
            logger.info('Client not initialized, attempting re-initialization');
            this.initializeClient();
            if (!this.client) {
                const errorMsg = 'Anthropic API key not configured. Please set ANTHROPIC_API_KEY environment variable or configure docTranslate.anthropicApiKey in settings.';
                logger.notifyCriticalError(errorMsg);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.buildPrompt(text, targetLang);
        const model = ConfigManager.getAnthropicModel();
        const timeout = ConfigManager.getTimeout();
        const retryConfig = ConfigManager.getRetryConfig();

        logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('ANTHROPIC REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
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
                const errorMsg = `Translation timed out (${timeout}ms)`;
                logger.notifyError(errorMsg);
                throw new Error(errorMsg);
            }
            const errorMsg = `Translation failed: ${error.message || 'Unknown error'}`;
            logger.notifyError(errorMsg, error);
            throw new Error(`Anthropic translation failed: ${error.message}`);
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing Anthropic client');
        this.initializeClient();
    }
}
