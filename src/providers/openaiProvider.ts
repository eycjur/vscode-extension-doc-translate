import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { BaseProvider } from './base/baseProvider';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

// OpenAI SDK types (will be installed later)
interface OpenAIClient {
  chat: {
    completions: {
      create(params: any, options?: any): Promise<any>;
    };
  };
}

export class OpenAIProvider extends BaseProvider {
  protected client: OpenAIClient | null = null;

  constructor() {
    super();
    this.initializeClient();
  }

  protected async initializeClient(): Promise<void> {
    const apiKey = ConfigManager.getOpenAIApiKey();
    if (apiKey) {
      try {
        const { default: OpenAI } = await import('openai');
        const baseURL = ConfigManager.getOpenAIBaseUrl();
        this.client = new OpenAI({ apiKey, baseURL }) as any;
        logger.info('OpenAI client initialized successfully');
      } catch (error) {
        logger.error(
          'Failed to import OpenAI SDK. Please install: npm install openai',
          error
        );
      }
    } else {
      logger.warn('No OpenAI API key found. Client not initialized.');
    }
  }

  protected getProviderName(): string {
    return 'OpenAI';
  }

  protected getModel(): string {
    return ConfigManager.getOpenAIModel();
  }

  protected getApiKeyMissingError(): string {
    return vscode.l10n.t('error.openai.apiKeyMissing');
  }

  protected getSettingsKey(): string {
    return 'docTranslate.openaiApiKey';
  }

  async translate(text: string, targetLang: string): Promise<string> {
    const providerName = this.getProviderName();
    this.logTranslationStart(providerName, text, targetLang);

    const skipResult = await this.checkTranslationNeeded(text, targetLang);
    if (skipResult !== null) {
      return skipResult;
    }

    if (!this.client) {
      logger.info('Client not initialized, attempting re-initialization');
      await this.initializeClient();
      if (!this.client) {
        const errorMsg = this.getApiKeyMissingError();
        logger.notifyCriticalError(errorMsg, undefined, [
          {
            label: vscode.l10n.t('action.openSettings'),
            callback: () =>
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                this.getSettingsKey()
              )
          }
        ]);
        throw new Error(errorMsg);
      }
    }

    const prompt = this.buildPrompt(text, targetLang);
    const model = this.getModel();
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
    this.logPrompt(providerName, prompt);

    try {
      const translation = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          logger.info('Sending request to OpenAI API...');
          const startTime = Date.now();

          const response = await this.client!.chat.completions.create(
            {
              model,
              max_tokens: 1024,
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a translation assistant specialized in software engineering context.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ]
            },
            {
              signal: controller.signal
            }
          );

          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          logger.info(`OpenAI API response received (${duration}ms)`);

          if (!response.choices || response.choices.length === 0) {
            throw new Error(vscode.l10n.t('error.openai.emptyResponse'));
          }

          const content = response.choices[0].message.content;
          if (!content) {
            throw new Error(vscode.l10n.t('error.openai.noContent'));
          }

          const translatedText = content.trim();
          this.logTranslationSuccess(providerName, translatedText);

          return translatedText;
        },
        retryConfig,
        `${providerName} translation`
      );

      return translation;
    } catch (error: any) {
      this.handleTranslationError(providerName, error, timeout);
    }
  }

  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    const providerName = this.getProviderName();
    this.logBatchTranslationStart(providerName, texts.length, targetLang);
    logger.debug('Texts to translate:', {
      texts: texts.map((t) => t.substring(0, 50) + (t.length > 50 ? '...' : ''))
    });

    if (!this.client) {
      logger.info(
        'Client not initialized, attempting re-initialization for batch'
      );
      await this.initializeClient();
      if (!this.client) {
        const errorMsg = this.getApiKeyMissingError();
        logger.notifyCriticalError(errorMsg, undefined, [
          {
            label: vscode.l10n.t('action.openSettings'),
            callback: () =>
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                this.getSettingsKey()
              )
          }
        ]);
        throw new Error(errorMsg);
      }
    }

    if (texts.length === 0) {
      return [];
    }

    const prompt = this.buildBatchPrompt(texts, targetLang);
    const model = this.getModel();
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(`Using model: ${model}, timeout: ${timeout}ms for batch`);
    this.logBatchPrompt(providerName, prompt);

    try {
      const translations = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          logger.info(`Sending batch request to ${providerName} API...`);
          const startTime = Date.now();

          const response = await this.client!.chat.completions.create(
            {
              model,
              max_tokens: 4096, // Increased max_tokens for batch
              messages: [
                {
                  role: 'system',
                  content:
                    'You are a translation assistant specialized in software engineering context. Your response MUST be a JSON array of strings, where each string is the translation of the corresponding input text. Do NOT include any other text or formatting outside the JSON array.'
                },
                {
                  role: 'user',
                  content: prompt
                }
              ],
              response_format: { type: 'json_object' } // Force JSON mode if supported
            },
            {
              signal: controller.signal
            }
          );

          clearTimeout(timeoutId);
          const duration = Date.now() - startTime;
          logger.info(`${providerName} API batch response received (${duration}ms)`);

          if (!response.choices || response.choices.length === 0) {
            throw new Error(vscode.l10n.t('error.openai.emptyResponse'));
          }

          const content = response.choices[0].message.content;
          if (!content) {
            throw new Error(vscode.l10n.t('error.openai.noContent'));
          }

          try {
            // Parse JSON response
            // The model might return { "translations": [...] } or just [...]
            const parsed = JSON.parse(content);
            let result: string[] = [];

            if (Array.isArray(parsed)) {
              result = parsed.map((item) => String(item).trim());
            } else if (
              parsed.translations &&
              Array.isArray(parsed.translations)
            ) {
              result = parsed.translations.map((item: any) =>
                String(item).trim()
              );
            } else if (typeof parsed === 'object') {
              // Try to find the first array property
              const arrayProp = Object.values(parsed).find((val) =>
                Array.isArray(val)
              );
              if (arrayProp) {
                result = (arrayProp as any[]).map((item) =>
                  String(item).trim()
                );
              }
            }

            if (result.length !== texts.length) {
              logger.warn(
                `${providerName} batch response count mismatch. Expected ${texts.length}, got ${result.length}. Falling back to sequential translation.`
              );
              throw new Error('Batch response count mismatch'); // Trigger retry or fallback
            }

            this.logBatchTranslationSuccess(providerName, result);

            return result;
          } catch (e) {
            logger.error(
              `Failed to parse ${providerName} batch response or response format invalid:`,
              e
            );
            throw new Error(
              `Failed to parse batch response: ${
                e instanceof Error ? e.message : String(e)
              }`
            );
          }
        },
        retryConfig,
        `${providerName} batch translation`
      );

      return translations;
    } catch (error: any) {
      if (error.name === 'AbortError') {
        const errorMsg = vscode.l10n.t('error.translation.timeout', timeout);
        logger.notifyError(errorMsg);
        // Fallback to sequential translation on timeout
        logger.warn(
          `${providerName} batch translation timed out, falling back to sequential translation.`
        );
        return super.translateBatch(texts, targetLang);
      }
      const errorMsg = vscode.l10n.t(
        'error.translation.failed',
        error.message || 'Unknown error'
      );
      logger.notifyError(errorMsg, error);
      logger.warn(
        `${providerName} batch translation failed, falling back to sequential translation.`
      );
      // Fallback to sequential translation on other errors
      return super.translateBatch(texts, targetLang);
    }
  }

  updateConfiguration(): void {
    logger.info(`Configuration changed, re-initializing ${this.getProviderName()} client`);
    this.initializeClient();
  }
}
