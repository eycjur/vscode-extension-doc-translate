import * as vscode from 'vscode';
import { logger } from './logger';
import { ITranslationProvider } from './translationProvider';

// Google Generative AI SDK types (will be installed later)
interface GenerativeModel {
    generateContent(request: any): Promise<any>;
}

interface GoogleGenerativeAI {
    getGenerativeModel(params: { model: string }): GenerativeModel;
}

export class GeminiProvider implements ITranslationProvider {
    private client: GoogleGenerativeAI | null = null;
    private model: GenerativeModel | null = null;

    constructor() {
        this.initializeClient();
    }

    private async initializeClient(): Promise<void> {
        const apiKey = this.getApiKey();
        if (apiKey) {
            try {
                // Dynamic import of Google Generative AI SDK
                const { GoogleGenerativeAI } = await import('@google/generative-ai');
                this.client = new GoogleGenerativeAI(apiKey);
                const modelName = this.getModel();
                this.model = this.client.getGenerativeModel({ model: modelName });
                logger.info('Gemini client initialized successfully');
            } catch (error) {
                logger.error('Failed to import Google Generative AI SDK. Please install: npm install @google/generative-ai', error);
            }
        } else {
            logger.warn('No Gemini API key found. Client not initialized.');
        }
    }

    private getApiKey(): string | undefined {
        // Environment variable takes precedence
        const envKey = process.env.GEMINI_API_KEY;
        if (envKey) {
            logger.debug('Using Gemini API key from environment variable GEMINI_API_KEY');
            return envKey;
        }

        // Fall back to VSCode configuration
        const config = vscode.workspace.getConfiguration('docTranslate');
        const configKey = config.get<string>('geminiApiKey');
        if (configKey && configKey.trim() !== '') {
            logger.debug('Using Gemini API key from VSCode settings');
            return configKey;
        }

        logger.warn('No Gemini API key found in environment variable or settings');
        return undefined;
    }

    private getModel(): string {
        const config = vscode.workspace.getConfiguration('docTranslate');
        return config.get<string>('geminiModel') || 'gemini-2.0-flash-exp';
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
        logger.info(`Gemini translation request received (text length: ${text.length} chars, ${sourceLang} -> ${targetLang})`);
        logger.debug('Text to translate:', { text: text.substring(0, 100) + (text.length > 100 ? '...' : '') });

        if (!this.client || !this.model) {
            // Re-initialize in case API key was added after extension activation
            logger.info('Client not initialized, attempting re-initialization');
            await this.initializeClient();
            if (!this.client || !this.model) {
                const errorMsg = 'Gemini API key not configured. Please set GEMINI_API_KEY environment variable or configure docTranslate.geminiApiKey in settings.';
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
        }

        const prompt = this.buildPrompt(text, sourceLang, targetLang);
        const timeout = this.getTimeout();

        logger.debug(`Using model: ${this.getModel()}, timeout: ${timeout}ms`);
        logger.info('='.repeat(60));
        logger.info('GEMINI REQUEST PROMPT:');
        logger.info('-'.repeat(60));
        logger.info(prompt);
        logger.info('='.repeat(60));

        try {
            logger.info('Sending request to Gemini API...');
            const startTime = Date.now();

            // Create a timeout promise
            const timeoutPromise = new Promise<never>((_, reject) => {
                setTimeout(() => reject(new Error('timeout')), timeout);
            });

            // Race between the API call and timeout
            const response = await Promise.race([
                this.model.generateContent(prompt),
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

            const translation = text.trim();
            logger.info('Translation successful');
            logger.info('='.repeat(60));
            logger.info('GEMINI RESPONSE:');
            logger.info('-'.repeat(60));
            logger.info(translation);
            logger.info('='.repeat(60));

            return translation;
        } catch (error: any) {
            if (error.message === 'timeout') {
                const errorMsg = `Translation request timed out after ${timeout}ms`;
                logger.error(errorMsg);
                throw new Error(errorMsg);
            }
            logger.error('Gemini translation failed', error);
            throw new Error(`Gemini translation failed: ${error.message}`);
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing Gemini client');
        this.initializeClient();
    }
}
