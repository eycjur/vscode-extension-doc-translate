import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { BaseProvider } from './base/baseProvider';
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

  protected isClientInitialized(): boolean {
    return this.client !== null;
  }

  protected async callTranslationAPI(
    prompt: string,
    timeout: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client!.chat.completions.create(
        {
          model: this.getModel(),
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

      if (!response.choices || response.choices.length === 0) {
        throw new Error(vscode.l10n.t('error.openai.emptyResponse'));
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error(vscode.l10n.t('error.openai.noContent'));
      }

      return content.trim();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  protected async callBatchTranslationAPI(
    prompt: string,
    timeout: number,
    textsCount: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client!.chat.completions.create(
        {
          model: this.getModel(),
          max_tokens: 4096,
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

      if (!response.choices || response.choices.length === 0) {
        throw new Error(vscode.l10n.t('error.openai.emptyResponse'));
      }

      const content = response.choices[0].message.content;
      if (!content) {
        throw new Error(vscode.l10n.t('error.openai.noContent'));
      }

      return content.trim();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  updateConfiguration(): void {
    logger.info(`Configuration changed, re-initializing ${this.getProviderName()} client`);
    this.initializeClient();
  }
}
