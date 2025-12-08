import { logger } from '../utils/logger';
import { OpenAIProvider } from './openaiProvider';
import { ConfigManager } from '../utils/config';

export class AzureOpenAIProvider extends OpenAIProvider {
    constructor() {
        super();
    }

    protected async initializeClient(): Promise<void> {
        const apiKey = ConfigManager.getAzureOpenAIApiKey();
        const endpoint = ConfigManager.getAzureOpenAIEndpoint();

        if (apiKey && endpoint) {
            try {
                const { AzureOpenAI } = await import('openai');
                this.client = new AzureOpenAI({
                    apiKey,
                    endpoint,
                    apiVersion: ConfigManager.getAzureOpenAIApiVersion(),
                }) as any;
                logger.info('Azure OpenAI client initialized successfully');
            } catch (error) {
                logger.error('Failed to import OpenAI SDK for Azure. Please install: npm install openai', error);
            }
        } else {
            logger.warn('Azure OpenAI API key or endpoint not found. Client not initialized.');
        }
    }

    protected getProviderName(): string {
        return 'Azure OpenAI';
    }

    protected getModel(): string {
        return ConfigManager.getAzureOpenAIDeploymentName();
    }

    protected getApiKeyMissingError(): string {
        return 'Azure OpenAI API key or endpoint not configured. Please set AZURE_OPENAI_API_KEY and AZURE_OPENAI_ENDPOINT environment variables or configure docTranslate.azureOpenaiApiKey and docTranslate.azureOpenaiEndpoint in settings.';
    }

    protected getSettingsKey(): string {
        return 'docTranslate.azureOpenai';
    }
}
