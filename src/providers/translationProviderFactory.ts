import { BaseProvider } from './base/baseProvider';
import { AnthropicProvider } from './anthropicProvider';
import { OpenAIProvider } from './openaiProvider';
import { GeminiProvider } from './geminiProvider';
import { AzureOpenAIProvider } from './azureOpenaiProvider';
import { logger } from '../utils/logger';
import { ConfigManager } from '../utils/config';
import { LLMProvider } from '../utils/constants';

/**
 * Factory for creating translation providers based on configuration
 */
export class TranslationProviderFactory {
    private static cachedProvider: BaseProvider | null = null;
    private static cachedProviderType: LLMProvider | null = null;

    /**
     * Get the translation provider based on current configuration
     */
    static getProvider(): BaseProvider {
        const provider = ConfigManager.getProvider();

        // Return cached provider if same type
        if (this.cachedProvider && this.cachedProviderType === provider) {
            return this.cachedProvider;
        }

        // Create new provider
        logger.info(`Creating translation provider: ${provider}`);

        switch (provider) {
            case 'anthropic':
                this.cachedProvider = new AnthropicProvider();
                break;
            case 'openai':
                this.cachedProvider = new OpenAIProvider();
                break;
            case 'gemini':
                this.cachedProvider = new GeminiProvider();
                break;
            case 'azure-openai':
                this.cachedProvider = new AzureOpenAIProvider();
                break;
            default:
                logger.warn(`Unknown provider: ${provider}, falling back to Anthropic`);
                this.cachedProvider = new AnthropicProvider();
        }

        this.cachedProviderType = provider;
        return this.cachedProvider;
    }

    /**
     * Clear cached provider (useful when configuration changes)
     */
    static clearCache(): void {
        this.cachedProvider = null;
        this.cachedProviderType = null;
        logger.debug('Provider cache cleared');
    }

    /**
     * Update provider configuration
     */
    static updateConfiguration(): void {
        if (this.cachedProvider) {
            this.cachedProvider.updateConfiguration();
        }
    }
}
