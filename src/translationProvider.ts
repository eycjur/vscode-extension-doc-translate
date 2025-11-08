/**
 * Translation provider interface
 */
export interface ITranslationProvider {
    /**
     * Translate text to target language
     * @param text Text to translate
     * @param targetLang Target language code (e.g., "en", "ja")
     * @returns Translated text
     */
    translate(text: string, targetLang: string): Promise<string>;

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
    targetLang: string;
    apiKey?: string;
    model?: string;
    timeout?: number;
}
