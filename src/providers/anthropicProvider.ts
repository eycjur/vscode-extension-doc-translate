import * as vscode from 'vscode';
import Anthropic from '@anthropic-ai/sdk';
import { logger } from '../utils/logger';
import { BaseProvider } from './base/baseProvider';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

export class AnthropicProvider extends BaseProvider {
  private client: Anthropic | null = null;

  constructor() {
    super();
    this.initializeClient();
  }

  private initializeClient(): void {
    const apiKey = ConfigManager.getAnthropicApiKey();
    if (apiKey) {
      this.client = new Anthropic({ apiKey });
      logger.info('Anthropic client initialized successfully');
    } else {
      logger.warn('No Anthropic API key found. Client not initialized.');
    }
  }

  async translate(text: string, targetLang: string): Promise<string> {
    this.logTranslationStart('Anthropic', text, targetLang);

    const skipResult = await this.checkTranslationNeeded(text, targetLang);
    if (skipResult !== null) {
      return skipResult;
    }

    if (!this.client) {
      logger.info('Client not initialized, attempting re-initialization');
      this.initializeClient();
      if (!this.client) {
        const errorMsg = vscode.l10n.t('error.anthropic.apiKeyMissing');
        logger.notifyCriticalError(errorMsg, undefined, [
          {
            label: vscode.l10n.t('action.openSettings'),
            callback: () =>
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'docTranslate.anthropicApiKey'
              )
          }
        ]);
        throw new Error(errorMsg);
      }
    }

    const prompt = this.buildPrompt(text, targetLang);
    const model = ConfigManager.getAnthropicModel();
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);
    this.logPrompt('Anthropic', prompt);

    try {
      const translation = await withRetry(
        async () => {
          const controller = new AbortController();
          const timeoutId = setTimeout(() => controller.abort(), timeout);

          logger.info('Sending request to Anthropic API...');
          const startTime = Date.now();

          const response = await this.client!.messages.create(
            {
              model,
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
          const duration = Date.now() - startTime;
          logger.info(`Anthropic API response received (${duration}ms)`);

          if (response.content.length === 0) {
            throw new Error(vscode.l10n.t('error.anthropic.emptyResponse'));
          }

          const content = response.content[0];
          if (content.type !== 'text') {
            throw new Error(vscode.l10n.t('error.anthropic.unexpectedType'));
          }

          const translatedText = content.text.trim();
          this.logTranslationSuccess('Anthropic', translatedText);

          return translatedText;
        },
        retryConfig,
        'Anthropic translation'
      );

      return translation;
    } catch (error: any) {
      this.handleTranslationError('Anthropic', error, timeout);
    }
  }

  updateConfiguration(): void {
    logger.info('Configuration changed, re-initializing Anthropic client');
    this.initializeClient();
  }
}
