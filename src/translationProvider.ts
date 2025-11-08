/**
 * Translation provider interface
 */
export interface ITranslationProvider {
    /**
     * Translate text from source language to target language
     * @param text Text to translate
     * @param sourceLang Source language code (e.g., "en", "ja")
     * @param targetLang Target language code (e.g., "en", "ja")
     * @returns Translated text
     */
    translate(text: string, sourceLang: string, targetLang: string): Promise<string>;

    /**
     * Update configuration (API keys, model, etc.)
     */
    updateConfiguration(): void;
}

/**
 * Supported LLM providers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'gemini';

/**
 * Configuration for translation
 */
export interface TranslationConfig {
    provider: LLMProvider;
    sourceLang: string;
    targetLang: string;
    apiKey?: string;
    model?: string;
    timeout?: number;
}
