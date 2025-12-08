import * as vscode from 'vscode';
import { logger } from '../../utils/logger';
import { isTranslationNeeded } from '../../utils/languageDetector';
import { LANGUAGE_NAMES } from '../../utils/constants';
import { withRetry } from '../../utils/retryHelper';
import { ConfigManager } from '../../utils/config';

/**
 * Base class for translation providers
 */
export abstract class BaseProvider {
  /**
   * Log translation start
   */
  protected logTranslationStart(
    providerName: string,
    text: string,
    targetLang: string
  ): void {
    logger.info(
      `${providerName} translation request received (text length: ${text.length} chars, target: ${targetLang})`
    );
    logger.debug('Text to translate:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });
  }

  /**
   * Log batch translation start
   */
  protected logBatchTranslationStart(
    providerName: string,
    count: number,
    targetLang: string
  ): void {
    logger.info(
      `${providerName} batch translation request received (count: ${count}, target: ${targetLang})`
    );
  }

  /**
   * Log prompt with borders
   */
  protected logPrompt(providerName: string, prompt: string): void {
    logger.info('='.repeat(60));
    logger.info(`${providerName.toUpperCase()} REQUEST PROMPT:`);
    logger.info('-'.repeat(60));
    logger.info(prompt);
    logger.info('='.repeat(60));
  }

  /**
   * Log batch prompt with borders
   */
  protected logBatchPrompt(providerName: string, prompt: string): void {
    logger.info('='.repeat(60));
    logger.info(`${providerName.toUpperCase()} BATCH REQUEST PROMPT:`);
    logger.info('-'.repeat(60));
    logger.info(prompt);
    logger.info('='.repeat(60));
  }

  /**
   * Log translation success with borders
   */
  protected logTranslationSuccess(
    providerName: string,
    translatedText: string
  ): void {
    logger.info('Translation successful');
    logger.info('='.repeat(60));
    logger.info(`${providerName.toUpperCase()} RESPONSE:`);
    logger.info('-'.repeat(60));
    logger.info(translatedText);
    logger.info('='.repeat(60));
  }

  /**
   * Log batch translation success with borders
   */
  protected logBatchTranslationSuccess(
    providerName: string,
    results: string[]
  ): void {
    logger.info('Batch translation successful');
    logger.info('='.repeat(60));
    logger.info(`${providerName.toUpperCase()} BATCH RESPONSE:`);
    logger.info('-'.repeat(60));
    logger.info(JSON.stringify(results, null, 2));
    logger.info('='.repeat(60));
  }

  /**
   * Handle translation errors uniformly
   * Returns never (always throws)
   */
  protected handleTranslationError(
    providerName: string,
    error: any,
    timeout: number
  ): never {
    if (error.name === 'AbortError' || error.message === 'timeout') {
      const errorMsg = vscode.l10n.t('error.translation.timeout', timeout);
      logger.notifyError(errorMsg);
      throw new Error(errorMsg);
    }
    const errorMsg = vscode.l10n.t(
      'error.translation.failed',
      error.message || 'Unknown error'
    );
    logger.notifyError(errorMsg, error);
    throw new Error(`${providerName} translation failed: ${error.message}`);
  }

  /**
   * Build translation prompt
   */
  protected buildPrompt(text: string, targetLang: string): string {
    const targetLanguage = LANGUAGE_NAMES[targetLang] || targetLang;

    return `You are a translation assistant specialized in software engineering context.
Translate the given text into natural ${targetLanguage}.

Rules:

Preserve technical terms (library names, function names, class names, variable names) as they are.

Prefer natural ${targetLanguage} rather than literal translation.

Output ONLY the translated ${targetLanguage} text. No explanation.

Translate this text:
${text}`;
  }

  /**
   * Build batch translation prompt
   */
  protected buildBatchPrompt(texts: string[], targetLang: string): string {
    const targetLanguage = LANGUAGE_NAMES[targetLang] || targetLang;

    return `You are a translation assistant specialized in software engineering context.
Translate the following array of texts into natural ${targetLanguage}.

Rules:
1. Preserve technical terms (library names, function names, class names, variable names) as they are.
2. Prefer natural ${targetLanguage} rather than literal translation.
3. Return ONLY a JSON array of strings. No markdown formatting, no explanation.
4. The output array must have exactly the same number of elements as the input.

Input:
${JSON.stringify(texts, null, 2)}`;
  }

  /**
   * Check if translation is needed and return original text if not
   * Also checks if text contains only symbols
   */
  protected async checkTranslationNeeded(
    text: string,
    targetLang: string
  ): Promise<string | null> {
    // Check if text contains only symbols
    if (this.isSymbolOnly(text)) {
      logger.info('Text contains only symbols, skipping translation');
      return text;
    }

    // Check if translation is needed (language detection)
    if (!(await isTranslationNeeded(text, targetLang))) {
      logger.info('Translation not needed, returning original text');
      return text;
    }
    return null;
  }

  /**
   * Check if text contains only symbols/punctuation
   */
  protected isSymbolOnly(text: string): boolean {
    // Remove whitespace and check if remaining characters are only symbols/punctuation
    const cleaned = text.replace(/\s/g, '');
    // Check if text contains at least one letter or number
    return !/[a-zA-Z0-9\u4e00-\u9fff\u3040-\u309f\u30a0-\u30ff\uac00-\ud7af]/.test(cleaned);
  }

  /**
   * Abstract method to be implemented by concrete providers
   */
  abstract translate(text: string, targetLang: string): Promise<string>;

  /**
   * Batch translation method
   *
   * Default fallback: translate one by one if not implemented.
   * But we want to enforce batching, so each provider should override this method
   * to use buildBatchPrompt() and send multiple texts in a single API request.
   *
   * This default implementation calls translate() sequentially as a fallback.
   * It's used when:
   * - Provider's batch translation fails and falls back to sequential processing
   * - New provider doesn't implement batch translation yet
   *
   * All existing providers (Anthropic, OpenAI, Gemini, Azure OpenAI) override this
   * to use the actual batch prompt with JSON array strategy.
   */
  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    const results: string[] = [];
    for (const text of texts) {
      try {
        results.push(await this.translate(text, targetLang));
      } catch (error) {
        logger.error(
          `Batch translation fallback failed for text: ${text.substring(
            0,
            20
          )}...`,
          error
        );
        results.push(text); // Return original on failure
      }
    }
    return results;
  }

  /**
   * Abstract method to update configuration
   */
  abstract updateConfiguration(): void;
}
