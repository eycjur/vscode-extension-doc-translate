import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { BaseProvider } from './base/baseProvider';
import { ConfigManager } from '../utils/config';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic | null = null;

  constructor() {
    super();
    this.initializeClient();
  }

  protected getProviderName(): string {
    return 'Anthropic';
  }

  protected getModel(): string {
    return ConfigManager.getAnthropicModel();
  }

  protected getApiKeyMissingError(): string {
    return vscode.l10n.t('error.anthropic.apiKeyMissing');
  }

  protected getSettingsKey(): string {
    return 'docTranslate.anthropicApiKey';
  }

  protected isClientInitialized(): boolean {
    return this.client !== null;
  }

  protected initializeClient(): void {
    const apiKey = ConfigManager.getAnthropicApiKey();
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      logger.info('Anthropic client initialized successfully');
    } else {
      logger.warn('No Anthropic API key found. Client not initialized.');
    }
  }

  protected async callTranslationAPI(
    prompt: string,
    timeout: number
  ): Promise<string> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeout);

    try {
      const response = await this.client!.messages.create(
        {
          model: this.getModel(),
          max_tokens: 1024,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          signal: controller.signal as AbortSignal
        }
      );

      clearTimeout(timeoutId);

      if (response.content.length === 0) {
        throw new Error(vscode.l10n.t('error.anthropic.emptyResponse'));
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error(vscode.l10n.t('error.anthropic.unexpectedType'));
      }

      return content.text.trim();
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
      const response = await this.client!.messages.create(
        {
          model: this.getModel(),
          max_tokens: 4096,
          messages: [
            {
              role: 'user',
              content: prompt
            }
          ]
        },
        {
          signal: controller.signal as AbortSignal
        }
      );

      clearTimeout(timeoutId);

      if (response.content.length === 0) {
        throw new Error(vscode.l10n.t('error.anthropic.emptyResponse'));
      }

      const content = response.content[0];
      if (content.type !== 'text') {
        throw new Error(vscode.l10n.t('error.anthropic.unexpectedType'));
      }

      return content.text.trim();
    } catch (error) {
      clearTimeout(timeoutId);
      throw error;
    }
  }

  updateConfiguration(): void {
    logger.info(
      `Configuration changed, re-initializing ${this.getProviderName()} client`
    );
    this.initializeClient();
  }
}
