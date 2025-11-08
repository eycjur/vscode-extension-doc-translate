import { logger } from '../utils/logger';
import { ITranslationProvider } from './base/translationProvider';
import { BaseProvider } from './base/baseProvider';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

// Google Generative AI SDK types (will be installed later)
interface GenerativeModel {
    generateContent(request: any): Promise<any>;
}

interface GoogleGenerativeAI {
    getGenerativeModel(params: { model: string }): GenerativeModel;
}

export class GeminiProvider extends BaseProvider implements ITranslationProvider {
    private client: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;

    constructor() {
        super();
        this.initializeClient();
    }

    private async initializeClient(): Promise<void> {
        const apiKey = ConfigManager.getGeminiApiKey();
        if (apiKey) {
            try {
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                this.client = new GoogleGenerativeAI(apiKey);
                const modelName = ConfigManager.getGeminiModel();
                this.model = this.client.getGenerativeModel({ model: modelName });
                logger.info('Gemini client initialized successfully');
            } catch (error) {
                logger.error('Failed to import Google Generative AI SDK. Please install: npm install @google/generative-ai', error);
            }
        } else {
            logger.warn('No Gemini API key found. Client not initialized.');
        }
    }

    async translate(text: string, targetLang: string): Promise<string> {
        logger.info(`Gemini translation request received (text length: ${text.length} chars, target: ${targetLang})`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        // Check if translation is needed (skip if already in target language)
        const skipResult = await this.checkTranslationNeeded(text, targetLang);
        if (skipResult !== null) {
            return skipResult;
        }

        if (!this.client || !this.model) {
            logger.info('Client not initialized, attempting re-initialization');
            await this.initializeClient();
            if (!this.client || !this.model) {
                const errorMsg = 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable or configure docTranslate.geminiApiKey in settings.';
                logger.notifyCriticalError(errorMsg);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.buildPrompt(text, targetLang);
        const timeout = ConfigManager.getTimeout();
        const retryConfig = ConfigManager.getRetryConfig();

        logger.debug(`Using model: ${ConfigManager.getGeminiModel()}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('GEMINI REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
            const translation = await withRetry(
                async () => {
                    logger.info('Sending request to Gemini API...');
                    const startTime = Date.now();

                    // Create a timeout promise
                    const timeoutPromise = new Promise<never>((_, reject) => {
                        setTimeout(() => reject(new Error('timeout')), timeout);
                    });

                    // Race between the API call and timeout
                    const response = await Promise.race([
                        this.model!.generateContent(prompt),
                        timeoutPromise
                    ]);

                    const duration = Date.now() - startTime;
                    logger.info(`Gemini API response received (${duration}ms)`);

                    if (!response || !response.response) {
                        throw new Error('Empty response from Gemini API');
                    }

                    const text = response.response.text();
                    if (!text) {
                        throw new Error('No text in Gemini API response');
                    }

                    const translatedText = text.trim();
                    logger.info('Translation successful');
                    logger.info('='.repeat(60));
                    logger.info('GEMINI RESPONSE:');
                    logger.info('-'.repeat(60));
                    logger.info(translatedText);
                    logger.info('='.repeat(60));

                    return translatedText;
                },
                retryConfig,
                'Gemini translation'
            );

            return translation;
        } catch (error: any) {
            if (error.message === 'timeout') {
                const errorMsg = `Translation timed out (${timeout}ms)`;
                logger.notifyError(errorMsg);
                throw new Error(errorMsg);
            }
            const errorMsg = `Translation failed: ${error.message || 'Unknown error'}`;
            logger.notifyError(errorMsg, error);
            throw new Error(`Gemini translation failed: ${error.message}`);
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing Gemini client');
        this.initializeClient();
    }
}
