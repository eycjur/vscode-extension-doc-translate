import * as vscode from 'vscode';
import { logger } from '../utils/logger';
import { ITranslationProvider } from './base/translationProvider';
import { BaseProvider } from './base/baseProvider';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

// Google Generative AI SDK types (will be installed later)
interface GenerativeModel {
  generateContent(request: any): Promise<any>;
}

interface GoogleGenerativeAI {
  getGenerativeModel(params: { model: string }): GenerativeModel;
}

export class GeminiProvider
  extends BaseProvider
  implements ITranslationProvider
{
  private client: GoogleGenerativeAI | null = null;
  private model: GenerativeModel | null = null;

  constructor() {
    super();
    this.initializeClient();
  }

  private async initializeClient(): Promise<void> {
    const apiKey = ConfigManager.getGeminiApiKey();
    if (apiKey) {
      try {
        const { GoogleGenerativeAI } = await import('@google/generative-ai');
        this.client = new GoogleGenerativeAI(apiKey);
        const modelName = ConfigManager.getGeminiModel();
        this.model = this.client.getGenerativeModel({ model: modelName });
        logger.info('Gemini client initialized successfully');
      } catch (error) {
        logger.error(
          'Failed to import Google Generative AI SDK. Please install: npm install @google/generative-ai',
          error
        );
      }
    } else {
      logger.warn('No Gemini API key found. Client not initialized.');
    }
  }

  async translate(text: string, targetLang: string): Promise<string> {
    logger.info(
      `Gemini translation request received (text length: ${text.length} chars, target: ${targetLang})`
    );
    logger.debug('Text to translate:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    // Check if translation is needed (skip if already in target language)
    const skipResult = await this.checkTranslationNeeded(text, targetLang);
    if (skipResult !== null) {
      return skipResult;
    }

    if (!this.client || !this.model) {
      logger.info('Client not initialized, attempting re-initialization');
      await this.initializeClient();
      if (!this.client || !this.model) {
        const errorMsg = vscode.l10n.t('error.gemini.apiKeyMissing');
        logger.notifyCriticalError(errorMsg, undefined, [
          {
            label: vscode.l10n.t('action.openSettings'),
            callback: () =>
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'docTranslate.geminiApiKey'
              )
          }
        ]);
        throw new Error(errorMsg);
      }
    }

    const prompt = this.buildPrompt(text, targetLang);
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(
      `Using model: ${ConfigManager.getGeminiModel()}, timeout: ${timeout}ms`
    );
    logger.info('='.repeat(60));
    logger.info('GEMINI REQUEST PROMPT:');
    logger.info('-'.repeat(60));
    logger.info(prompt);
    logger.info('='.repeat(60));

    try {
      const translation = await withRetry(
        async () => {
          logger.info('Sending request to Gemini API...');
          const startTime = Date.now();

          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), timeout);
          });

          // Race between the API call and timeout
          const response = await Promise.race([
            this.model!.generateContent(prompt),
            timeoutPromise
          ]);

          const duration = Date.now() - startTime;
          logger.info(`Gemini API response received (${duration}ms)`);

          if (!response || !response.response) {
            throw new Error(vscode.l10n.t('error.gemini.emptyResponse'));
          }

          const text = response.response.text();
          if (!text) {
            throw new Error(vscode.l10n.t('error.gemini.noContent'));
          }

          const translatedText = text.trim();
          logger.info('Translation successful');
          logger.info('='.repeat(60));
          logger.info('GEMINI RESPONSE:');
          logger.info('-'.repeat(60));
          logger.info(translatedText);
          logger.info('='.repeat(60));

          return translatedText;
        },
        retryConfig,
        'Gemini translation'
      );

      return translation;
    } catch (error: any) {
      if (error.message === 'timeout') {
        const errorMsg = vscode.l10n.t('error.translation.timeout', timeout);
        logger.notifyError(errorMsg);
        throw new Error(errorMsg);
      }
      const errorMsg = vscode.l10n.t(
        'error.translation.failed',
        error.message || 'Unknown error'
      );
      logger.notifyError(errorMsg, error);
      throw new Error(`Gemini translation failed: ${error.message}`);
    }
  }

  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    logger.info(
      `Gemini batch translation request received (count: ${texts.length}, target: ${targetLang})`
    );
    logger.debug('Texts to translate:', {
      texts: texts.map((t) => t.substring(0, 50) + (t.length > 50 ? '...' : ''))
    });

    if (texts.length === 0) {
      return [];
    }

    if (!this.client || !this.model) {
      logger.info(
        'Client not initialized, attempting re-initialization for batch'
      );
      await this.initializeClient();
      if (!this.client || !this.model) {
        const errorMsg = vscode.l10n.t('error.gemini.apiKeyMissing');
        logger.notifyCriticalError(errorMsg, undefined, [
          {
            label: vscode.l10n.t('action.openSettings'),
            callback: () =>
              vscode.commands.executeCommand(
                'workbench.action.openSettings',
                'docTranslate.geminiApiKey'
              )
          }
        ]);
        throw new Error(errorMsg);
      }
    }

    // Check if translation is needed for each text
    const checkedTexts: {
      original: string;
      index: number;
      skipResult: string | null;
    }[] = await Promise.all(
      texts.map(async (text, index) => ({
        original: text,
        index,
        skipResult: await this.checkTranslationNeeded(text, targetLang)
      }))
    );

    const textsToTranslate = checkedTexts
      .filter((item) => item.skipResult === null)
      .map((item) => item.original);
    const originalIndices = checkedTexts
      .filter((item) => item.skipResult === null)
      .map((item) => item.index);

    if (textsToTranslate.length === 0) {
      const results: string[] = [];
      checkedTexts.forEach((item) => {
        if (item.skipResult !== null) {
          results[item.index] = item.skipResult;
        }
      });
      return results;
    }

    const prompt = this.buildBatchPrompt(textsToTranslate, targetLang);
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(
      `Using model: ${ConfigManager.getGeminiModel()}, timeout: ${timeout}ms for batch`
    );
    logger.info('='.repeat(60));
    logger.info('GEMINI BATCH REQUEST PROMPT:');
    logger.info('-'.repeat(60));
    logger.info(prompt);
    logger.info('='.repeat(60));

    try {
      const batchTranslation = await withRetry(
        async () => {
          logger.info('Sending batch request to Gemini API...');
          const startTime = Date.now();

          // Create a timeout promise
          const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('timeout')), timeout);
          });

          // Race between the API call and timeout
          const result = await Promise.race([
            this.model!.generateContent(prompt),
            timeoutPromise
          ]);

          const duration = Date.now() - startTime;
          logger.info(`Gemini batch API response received (${duration}ms)`);

          if (!result || !result.response) {
            throw new Error(vscode.l10n.t('error.gemini.emptyResponse'));
          }

          const content = result.response.text();
          if (!content) {
            throw new Error(vscode.l10n.t('error.gemini.noContent'));
          }

          logger.info('Gemini batch response received, attempting to parse...');
          logger.debug('Raw Gemini batch response:', content);

          try {
            // Attempt to parse JSON response
            const jsonMatch =
              content.match(/```json\n([\s\S]*?)\n```/) ||
              content.match(/```\n([\s\S]*?)\n```/);
            const jsonStr = jsonMatch ? jsonMatch[1] : content;

            const parsed = JSON.parse(jsonStr);
            let translatedItems: string[] = [];

            if (Array.isArray(parsed)) {
              translatedItems = parsed.map((item: any) => String(item).trim());
            } else if (
              parsed.translations &&
              Array.isArray(parsed.translations)
            ) {
              translatedItems = parsed.translations.map((item: any) =>
                String(item).trim()
              );
            } else {
              throw new Error('Unexpected JSON structure for batch response.');
            }

            if (translatedItems.length !== textsToTranslate.length) {
              logger.warn(
                `Gemini batch response count mismatch. Expected ${textsToTranslate.length}, got ${translatedItems.length}. Falling back to sequential translation.`
              );
              // If parsing fails or count mismatches, fall back to sequential translation for the untranslated items
              return super.translateBatch(textsToTranslate, targetLang);
            }

            logger.info('Batch translation successful');
            logger.info('='.repeat(60));
            logger.info('GEMINI BATCH RESPONSE:');
            logger.info('-'.repeat(60));
            translatedItems.forEach((item) => logger.info(item));
            logger.info('='.repeat(60));

            const finalResults: string[] = new Array(texts.length);
            let translatedIdx = 0;
            for (let i = 0; i < texts.length; i++) {
              const checkedItem = checkedTexts.find((item) => item.index === i);
              if (checkedItem && checkedItem.skipResult !== null) {
                finalResults[i] = checkedItem.skipResult;
              } else {
                finalResults[i] = translatedItems[translatedIdx++];
              }
            }
            return finalResults;
          } catch (e: any) {
            logger.error(
              'Failed to parse Gemini batch response as JSON, attempting fallback:',
              e
            );
            // If JSON parsing fails, try to split by lines or other heuristics, or fall back to sequential
            // For now, falling back to sequential for robustness
            logger.warn(
              'Falling back to sequential translation for batch due to parsing error.'
            );
            return super.translateBatch(textsToTranslate, targetLang);
          }
        },
        retryConfig,
        'Gemini batch translation'
      );

      const finalResults: string[] = new Array(texts.length);
      let translatedIdx = 0;
      for (let i = 0; i < texts.length; i++) {
        const checkedItem = checkedTexts.find((item) => item.index === i);
        if (checkedItem && checkedItem.skipResult !== null) {
          finalResults[i] = checkedItem.skipResult;
        } else {
          finalResults[i] = batchTranslation[translatedIdx++];
        }
      }
      return finalResults;
    } catch (error: any) {
      if (error.message === 'timeout') {
        const errorMsg = vscode.l10n.t('error.translation.timeout', timeout);
        logger.notifyError(errorMsg);
        throw new Error(errorMsg);
      }
      const errorMsg = vscode.l10n.t(
        'error.translation.failed',
        error.message || 'Unknown error'
      );
      logger.notifyError(errorMsg, error);
      // Fallback to sequential translation if batch fails
      logger.warn(
        `Gemini batch translation failed, falling back to sequential. Error: ${error}`
      );
      return super.translateBatch(textsToTranslate, targetLang);
    }
  }

  updateConfiguration(): void {
    logger.info('Configuration changed, re-initializing Gemini client');
    this.initializeClient();
  }
}
