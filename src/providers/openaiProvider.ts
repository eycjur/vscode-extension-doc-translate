import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { ITranslationProvider } from './base/translationProvider';
import { BaseProvider } from './base/baseProvider';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

// OpenAI SDK types (will be installed later)
interface OpenAIClient {
    chat: {
        completions: {
            create(params: any, options?: any): Promise<any>;
        };
    };
}

export class OpenAIProvider extends BaseProvider implements ITranslationProvider {
    private client: OpenAIClient | null = null;

    constructor() {
        super();
        this.initializeClient();
    }

    private async initializeClient(): Promise<void> {
        const apiKey = ConfigManager.getOpenAIApiKey();
        if (apiKey) {
            try {
                const { default: OpenAI } = await import('openai');
                this.client = new OpenAI({ apiKey }) as any;
                logger.info('OpenAI client initialized successfully');
            } catch (error) {
                logger.error('Failed to import OpenAI SDK. Please install: npm install openai', error);
            }
        } else {
            logger.warn('No OpenAI API key found. Client not initialized.');
        }
    }

    async translate(text: string, targetLang: string): Promise<string> {
        logger.info(`OpenAI translation request received (text length: ${text.length} chars, target: ${targetLang})`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        // Check if translation is needed (skip if already in target language)
        const skipResult = await this.checkTranslationNeeded(text, targetLang);
        if (skipResult !== null) {
            return skipResult;
        }

        if (!this.client) {
            logger.info('Client not initialized, attempting re-initialization');
            await this.initializeClient();
            if (!this.client) {
                const errorMsg = 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or configure docTranslate.openaiApiKey in settings.';
                logger.notifyCriticalError(errorMsg, undefined, [
                    {
                        label: 'Open Settings',
                        callback: () => vscode.commands.executeCommand('workbench.action.openSettings', 'docTranslate.openaiApiKey')
                    }
                ]);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.buildPrompt(text, targetLang);
        const model = ConfigManager.getOpenAIModel();
        const timeout = ConfigManager.getTimeout();
        const retryConfig = ConfigManager.getRetryConfig();

        logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('OPENAI REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
            const translation = await withRetry(
                async () => {
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), timeout);

                    logger.info('Sending request to OpenAI API...');
                    const startTime = Date.now();

                    const response = await this.client!.chat.completions.create(
                        {
                            model,
                            max_tokens: 1024,
                            messages: [
                                {
                                    role: 'system',
                                    content: 'You are a translation assistant specialized in software engineering context.'
                                },
                                {
                                    role: 'user',
                                    content: prompt,
                                },
                            ],
                        },
                        {
                            signal: controller.signal,
                        }
                    );

                    clearTimeout(timeoutId);
                    const duration = Date.now() - startTime;
                    logger.info(`OpenAI API response received (${duration}ms)`);

                    if (!response.choices || response.choices.length === 0) {
                        throw new Error('Empty response from OpenAI API');
                    }

                    const content = response.choices[0].message.content;
                    if (!content) {
                        throw new Error('No content in OpenAI API response');
                    }

                    const translatedText = content.trim();
                    logger.info('Translation successful');
                    logger.info('='.repeat(60));
                    logger.info('OPENAI RESPONSE:');
                    logger.info('-'.repeat(60));
                    logger.info(translatedText);
                    logger.info('='.repeat(60));

                    return translatedText;
                },
                retryConfig,
                'OpenAI translation'
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
            throw new Error(`OpenAI translation failed: ${error.message}`);
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing OpenAI client');
        this.initializeClient();
    }
}
