/**
 * Language code mappings from ISO 639-1 to full language names
 */
export const LANGUAGE_NAMES: { [key: string]: string } = {
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

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
    TIMEOUT: 30000,
    MAX_RETRIES: 3,
    RETRY_INITIAL_DELAY: 1000,
    TARGET_LANG: 'ja',
    PROVIDER: 'anthropic' as const,
    ANTHROPIC_MODEL: 'claude-haiku-4-5-20251001',
    OPENAI_MODEL: 'gpt-4o-mini',
    GEMINI_MODEL: 'gemini-2.0-flash-exp',
    AZURE_OPENAI_API_VERSION: '2024-02-15-preview',
    AZURE_OPENAI_DEPLOYMENT_NAME: 'gpt-4o-mini'
};

/**
 * Supported LLM providers
 */
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'azure-openai';
