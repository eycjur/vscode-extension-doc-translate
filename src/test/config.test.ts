import * as assert from 'assert';
import { ConfigManager } from '../utils/config';

suite('Config Manager Test Suite', () => {
    suite('Provider Configuration', () => {
        test('should return valid provider type', () => {
            const provider = ConfigManager.getProvider();

            assert.ok(['anthropic', 'openai', 'gemini'].includes(provider),
                'Should return a valid provider type');
        });

        test('should return default provider if not configured', () => {
            // The default is 'anthropic' as per package.json
            const provider = ConfigManager.getProvider();

            assert.ok(provider !== undefined, 'Should return a provider');
        });
    });

    suite('Language Configuration', () => {
        test('should return valid target language code', () => {
            const targetLang = ConfigManager.getTargetLang();

            assert.ok(typeof targetLang === 'string', 'Should return string');
            assert.ok(targetLang.length >= 2, 'Should be at least 2 characters');
        });

        test('should return supported languages array', () => {
            const languages = ConfigManager.getSupportedLanguages();

            assert.ok(Array.isArray(languages), 'Should return an array');
            assert.ok(languages.length > 0, 'Should have at least one supported language');

            // Check that default languages are included
            const expectedLanguages = ['python', 'javascript', 'typescript', 'go'];
            for (const lang of expectedLanguages) {
                assert.ok(languages.includes(lang), `Should include ${lang}`);
            }
        });
    });

    suite('Timeout and Retry Configuration', () => {
        test('should return valid timeout value', () => {
            const timeout = ConfigManager.getTimeout();

            assert.ok(typeof timeout === 'number', 'Should return a number');
            assert.ok(timeout > 0, 'Timeout should be positive');
        });

        test('should return valid retry configuration', () => {
            const retryConfig = ConfigManager.getRetryConfig();

            assert.ok(typeof retryConfig.maxRetries === 'number', 'maxRetries should be a number');
            assert.ok(retryConfig.maxRetries >= 0, 'maxRetries should be non-negative');

            assert.ok(typeof retryConfig.initialDelayMs === 'number', 'initialDelayMs should be a number');
            assert.ok(retryConfig.initialDelayMs > 0, 'initialDelayMs should be positive');
        });
    });

    suite('Anthropic Configuration', () => {
        test('should return model string', () => {
            const model = ConfigManager.getAnthropicModel();

            assert.ok(typeof model === 'string', 'Should return a string');
            assert.ok(model.length > 0, 'Model name should not be empty');
        });

        test('should handle missing API key gracefully', () => {
            const apiKey = ConfigManager.getAnthropicApiKey();

            // API key might be undefined if not configured
            assert.ok(apiKey === undefined || typeof apiKey === 'string',
                'Should return undefined or string');
        });
    });

    suite('OpenAI Configuration', () => {
        test('should return model string', () => {
            const model = ConfigManager.getOpenAIModel();

            assert.ok(typeof model === 'string', 'Should return a string');
            assert.ok(model.length > 0, 'Model name should not be empty');
        });

        test('should handle missing API key gracefully', () => {
            const apiKey = ConfigManager.getOpenAIApiKey();

            assert.ok(apiKey === undefined || typeof apiKey === 'string',
                'Should return undefined or string');
        });
    });

    suite('Gemini Configuration', () => {
        test('should return model string', () => {
            const model = ConfigManager.getGeminiModel();

            assert.ok(typeof model === 'string', 'Should return a string');
            assert.ok(model.length > 0, 'Model name should not be empty');
        });

        test('should handle missing API key gracefully', () => {
            const apiKey = ConfigManager.getGeminiApiKey();

            assert.ok(apiKey === undefined || typeof apiKey === 'string',
                'Should return undefined or string');
        });
    });

    suite('Default Values', () => {
        test('should have reasonable default timeout', () => {
            const timeout = ConfigManager.getTimeout();

            // Default is 30000ms (30 seconds) as per package.json
            assert.ok(timeout >= 10000, 'Timeout should be at least 10 seconds');
            assert.ok(timeout <= 120000, 'Timeout should be at most 2 minutes');
        });

        test('should have reasonable retry configuration', () => {
            const retryConfig = ConfigManager.getRetryConfig();

            // Default maxRetries is 3 as per package.json
            assert.ok(retryConfig.maxRetries <= 10, 'maxRetries should be reasonable');

            // Default initialDelayMs is 1000ms as per package.json
            assert.ok(retryConfig.initialDelayMs >= 100, 'initialDelayMs should be at least 100ms');
            assert.ok(retryConfig.initialDelayMs <= 5000, 'initialDelayMs should be at most 5 seconds');
        });

        test('should return default target language', () => {
            const targetLang = ConfigManager.getTargetLang();

            // Default is 'ja' as per package.json
            assert.ok(targetLang.length === 2 || targetLang.length === 3,
                'Should be a valid language code');
        });
    });

    suite('Type Safety', () => {
        test('all configuration methods should return defined values', () => {
            assert.ok(ConfigManager.getProvider() !== undefined, 'getProvider should be defined');
            assert.ok(ConfigManager.getTargetLang() !== undefined, 'getTargetLang should be defined');
            assert.ok(ConfigManager.getSupportedLanguages() !== undefined, 'getSupportedLanguages should be defined');
            assert.ok(ConfigManager.getTimeout() !== undefined, 'getTimeout should be defined');
            assert.ok(ConfigManager.getRetryConfig() !== undefined, 'getRetryConfig should be defined');
            assert.ok(ConfigManager.getAnthropicModel() !== undefined, 'getAnthropicModel should be defined');
            assert.ok(ConfigManager.getOpenAIModel() !== undefined, 'getOpenAIModel should be defined');
            assert.ok(ConfigManager.getGeminiModel() !== undefined, 'getGeminiModel should be defined');
        });

        test('retry config should have all required properties', () => {
            const retryConfig = ConfigManager.getRetryConfig();

            assert.ok('maxRetries' in retryConfig, 'Should have maxRetries property');
            assert.ok('initialDelayMs' in retryConfig, 'Should have initialDelayMs property');
        });
    });
});
