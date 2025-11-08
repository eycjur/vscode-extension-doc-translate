import * as vscode from 'vscode';
import { logger } from './logger';
import { ITranslationProvider } from './translationProvider';

// OpenAI SDK types (will be installed later)
interface OpenAIClient {
    chat: {
        completions: {
            create(params: any, options?: any): Promise<any>;
        };
    };
}

export class OpenAIProvider implements ITranslationProvider {
    private client: OpenAIClient | null = null;

    constructor() {
        this.initializeClient();
    }

    private async initializeClient(): Promise<void> {
        const apiKey = this.getApiKey();
        if (apiKey) {
            try {
                // Dynamic import of OpenAI SDK
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

    private getApiKey(): string | undefined {
        // Environment variable takes precedence
        const envKey = process.env.OPENAI_API_KEY;
        if (envKey) {
            logger.debug('Using OpenAI API key from environment variable OPENAI_API_KEY');
            return envKey;
        }

        // Fall back to VSCode configuration
        const config = vscode.workspace.getConfiguration('docTranslate');
        const configKey = config.get<string>('openaiApiKey');
        if (configKey && configKey.trim() !== '') {
            logger.debug('Using OpenAI API key from VSCode settings');
            return configKey;
        }

        logger.warn('No OpenAI API key found in environment variable or settings');
        return undefined;
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<string>('openaiModel') || 'gpt-4o-mini';
    }

    private getTimeout(): number {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<number>('timeout') || 30000;
    }

    private buildPrompt(text: string, sourceLang: string, targetLang: string): string {
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

        const sourceLanguage = langMap[sourceLang] || sourceLang;
        const targetLanguage = langMap[targetLang] || targetLang;

        return `You are a translation assistant specialized in software engineering context.
Translate the given text from ${sourceLanguage} into natural ${targetLanguage}.

Rules:

Preserve technical terms (library names, function names, class names, variable names) as they are.

Prefer natural ${targetLanguage} rather than literal translation.

Output ONLY the translated ${targetLanguage} text. No explanation, no ${sourceLanguage}.

Translate this text:
${text}`;
    }

    async translate(text: string, sourceLang: string, targetLang: string): Promise<string> {
        logger.info(`OpenAI translation request received (text length: ${text.length} chars, ${sourceLang} -> ${targetLang})`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        if (!this.client) {
            // Re-initialize in case API key was added after extension activation
            logger.info('Client not initialized, attempting re-initialization');
            await this.initializeClient();
            if (!this.client) {
                const errorMsg = 'OpenAI API key not configured. Please set OPENAI_API_KEY environment variable or configure docTranslate.openaiApiKey in settings.';
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.buildPrompt(text, sourceLang, targetLang);
        const model = this.getModel();
        const timeout = this.getTimeout();

        logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('OPENAI REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), timeout);

            logger.info('Sending request to OpenAI API...');
            const startTime = Date.now();

            const response = await this.client.chat.completions.create(
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

            const translation = content.trim();
            logger.info('Translation successful');
            logger.info('='.repeat(60));
            logger.info('OPENAI RESPONSE:');
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
            logger.error('OpenAI translation failed', error);
            throw new Error(`OpenAI translation failed: ${error.message}`);
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing OpenAI client');
        this.initializeClient();
    }
}
