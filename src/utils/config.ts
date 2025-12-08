import * as vscode from 'vscode';
import { DEFAULT_CONFIG, LLMProvider } from './constants';
import { DEFAULT_RETRY_CONFIG, RetryConfig } from './retryHelper';

/**
 * Centralized configuration manager
 */
export class ConfigManager {
  private static readonly CONFIG_SECTION = 'docTranslate';

  /**
   * Get VSCode configuration
   */
  private static getConfig(): vscode.WorkspaceConfiguration {
    return vscode.workspace.getConfiguration(ConfigManager.CONFIG_SECTION);
  }

  /**
   * Get current provider
   */
  static getProvider(): LLMProvider {
    return (
      this.getConfig().get<LLMProvider>('provider') || DEFAULT_CONFIG.PROVIDER
    );
  }

  /**
   * Get target language
   */
  static getTargetLang(): string {
    return (
      this.getConfig().get<string>('targetLang') || DEFAULT_CONFIG.TARGET_LANG
    );
  }

  /**
   * Get timeout value
   */
  static getTimeout(): number {
    return this.getConfig().get<number>('timeout') || DEFAULT_CONFIG.TIMEOUT;
  }

  /**
   * Get Anthropic API key
   * Priority: VSCode settings > Environment variable
   */
  static getAnthropicApiKey(): string | undefined {
    const configKey = this.getConfig().get<string>('anthropicApiKey');
    if (configKey && configKey.trim() !== '') {
      return configKey;
    }
    const envKey = process.env.ANTHROPIC_API_KEY;
    return envKey || undefined;
  }

  /**
   * Get Anthropic model
   */
  static getAnthropicModel(): string {
    return (
      this.getConfig().get<string>('model') || DEFAULT_CONFIG.ANTHROPIC_MODEL
    );
  }

  /**
   * Get OpenAI API key
   * Priority: VSCode settings > Environment variable
   */
  static getOpenAIApiKey(): string | undefined {
    const configKey = this.getConfig().get<string>('openaiApiKey');
    if (configKey && configKey.trim() !== '') {
      return configKey;
    }
    const envKey = process.env.OPENAI_API_KEY;
    return envKey || undefined;
  }

  /**
   * Get OpenAI model
   */
  static getOpenAIModel(): string {
    return (
      this.getConfig().get<string>('openaiModel') || DEFAULT_CONFIG.OPENAI_MODEL
    );
  }

  /**
   * Get OpenAI Base URL
   */
  static getOpenAIBaseUrl(): string | undefined {
    const configUrl = this.getConfig().get<string>('openaiBaseUrl');
    return configUrl && configUrl.trim() !== '' ? configUrl : undefined;
  }

  /**
   * Get Gemini API key
   * Priority: VSCode settings > Environment variable
   */
  static getGeminiApiKey(): string | undefined {
    const configKey = this.getConfig().get<string>('geminiApiKey');
    if (configKey && configKey.trim() !== '') {
      return configKey;
    }
    const envKey = process.env.GEMINI_API_KEY;
    return envKey || undefined;
  }

  /**
   * Get Gemini model
   */
  static getGeminiModel(): string {
    return (
      this.getConfig().get<string>('geminiModel') || DEFAULT_CONFIG.GEMINI_MODEL
    );
  }

  /**
   * Get retry configuration
   */
  static getRetryConfig(): RetryConfig {
    return {
      maxRetries:
        this.getConfig().get<number>('maxRetries') ||
        DEFAULT_RETRY_CONFIG.maxRetries,
      initialDelayMs:
        this.getConfig().get<number>('retryInitialDelay') ||
        DEFAULT_RETRY_CONFIG.initialDelayMs,
      maxDelayMs: DEFAULT_RETRY_CONFIG.maxDelayMs,
      backoffMultiplier: DEFAULT_RETRY_CONFIG.backoffMultiplier
    };
  }

  /**
   * Get supported languages
   */
  static getSupportedLanguages(): string[] {
    return (
      this.getConfig().get<string[]>('supportedLanguages') || [
        'python',
        'javascript',
        'typescript',
        'go'
      ]
    );
  }

  /**
   * Get Azure OpenAI API key
   * Priority: VSCode settings > Environment variable
   */
  static getAzureOpenAIApiKey(): string | undefined {
    const configKey = this.getConfig().get<string>('azureOpenaiApiKey');
    if (configKey && configKey.trim() !== '') {
      return configKey;
    }
    const envKey = process.env.AZURE_OPENAI_API_KEY;
    return envKey || undefined;
  }

  /**
   * Get Azure OpenAI endpoint
   * Priority: VSCode settings > Environment variable
   */
  static getAzureOpenAIEndpoint(): string | undefined {
    const configEndpoint = this.getConfig().get<string>('azureOpenaiEndpoint');
    if (configEndpoint && configEndpoint.trim() !== '') {
      return configEndpoint;
    }
    const envEndpoint = process.env.AZURE_OPENAI_ENDPOINT;
    return envEndpoint || undefined;
  }

  /**
   * Get Azure OpenAI API version
   */
  static getAzureOpenAIApiVersion(): string {
    return this.getConfig().get<string>('azureOpenaiApiVersion') || DEFAULT_CONFIG.AZURE_OPENAI_API_VERSION;
  }

  /**
   * Get Azure OpenAI deployment name
   */
  static getAzureOpenAIDeploymentName(): string {
    return this.getConfig().get<string>('azureOpenaiDeploymentName') || DEFAULT_CONFIG.AZURE_OPENAI_DEPLOYMENT_NAME;
  }
}
