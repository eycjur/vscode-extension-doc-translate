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
   * Get provider name for logging
   */
  protected abstract getProviderName(): string;

  /**
   * Get model name
   */
  protected abstract getModel(): string;

  /**
   * Get API key missing error message
   */
  protected abstract getApiKeyMissingError(): string;

  /**
   * Get settings key for opening settings
   */
  protected abstract getSettingsKey(): string;

  /**
   * Check if client is initialized
   */
  protected abstract isClientInitialized(): boolean;

  /**
   * Initialize or re-initialize the client
   */
  protected abstract initializeClient(): Promise<void> | void;

  /**
   * Call translation API with prompt and timeout
   * Returns the translated text
   */
  protected abstract callTranslationAPI(
    prompt: string,
    timeout: number
  ): Promise<string>;

  /**
   * Call batch translation API with prompt and timeout
   * Returns the raw response text (typically JSON string)
   */
  protected abstract callBatchTranslationAPI(
    prompt: string,
    timeout: number,
    textsCount: number
  ): Promise<string>;

  /**
   * Preprocess batch response text before JSON parsing
   * Override this in child classes if special preprocessing is needed (e.g., removing markdown code blocks)
   */
  protected preprocessBatchResponse(responseText: string): string {
    return responseText;
  }

  /**
   * Parse batch translation response JSON
   * Handles various JSON formats: [...], {"translations": [...]}, or any object with an array property
   */
  protected parseBatchResponse(responseText: string): string[] {
    try {
      // Apply provider-specific preprocessing
      const preprocessed = this.preprocessBatchResponse(responseText);

      // Parse JSON response
      const parsed = JSON.parse(preprocessed);
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

      if (result.length === 0) {
        throw new Error('No valid array found in response');
      }

      return result;
    } catch (e) {
      logger.error(
        `Failed to parse ${this.getProviderName()} batch response or response format invalid:`,
        e
      );
      throw new Error(
        `Failed to parse batch response: ${
          e instanceof Error ? e.message : String(e)
        }`
      );
    }
  }

  /**
   * Ensure client is initialized, re-initialize if needed
   * Throws error if initialization fails
   */
  protected async ensureClientInitialized(): Promise<void> {
    if (!this.isClientInitialized()) {
      logger.info('Client not initialized, attempting re-initialization');
      await this.initializeClient();
      if (!this.isClientInitialized()) {
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
    // Check if text contains at least one letter from any language
    // \p{L} matches any letter (Unicode property escape)
    return !/\p{L}/u.test(cleaned);
  }

  /**
   * Template method for translation
   * Defines the common translation flow, delegating provider-specific logic to abstract methods
   */
  async translate(text: string, targetLang: string): Promise<string> {
    const providerName = this.getProviderName();

    // Log translation start
    logger.info(
      `${providerName} translation request received (text length: ${text.length} chars, target: ${targetLang})`
    );
    logger.debug('Text to translate:', {
      text: text.substring(0, 100) + (text.length > 100 ? '...' : '')
    });

    const skipResult = await this.checkTranslationNeeded(text, targetLang);
    if (skipResult !== null) {
      return skipResult;
    }

    await this.ensureClientInitialized();

    const prompt = this.buildPrompt(text, targetLang);
    const model = this.getModel();
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(`Using model: ${model}, timeout: ${timeout}ms`);

    // Log prompt with borders
    logger.info('='.repeat(60));
    logger.info(`${providerName.toUpperCase()} REQUEST PROMPT:`);
    logger.info('-'.repeat(60));
    logger.info(prompt);
    logger.info('='.repeat(60));

    try {
      const translation = await withRetry(
        async () => {
          logger.info(`Sending request to ${providerName} API...`);
          const startTime = Date.now();

          const translatedText = await this.callTranslationAPI(prompt, timeout);

          const duration = Date.now() - startTime;
          logger.info(`${providerName} API response received (${duration}ms)`);

          // Log translation success with borders
          logger.info('Translation successful');
          logger.info('='.repeat(60));
          logger.info(`${providerName.toUpperCase()} RESPONSE:`);
          logger.info('-'.repeat(60));
          logger.info(translatedText);
          logger.info('='.repeat(60));

          return translatedText;
        },
        retryConfig,
        `${providerName} translation`
      );

      return translation;
    } catch (error: any) {
      // Handle translation errors
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
  }

  /**
   * Template method for batch translation
   * Defines the common batch translation flow, delegating provider-specific logic to abstract methods
   */
  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    const providerName = this.getProviderName();

    // Log batch translation start
    logger.info(
      `${providerName} batch translation request received (count: ${texts.length}, target: ${targetLang})`
    );
    logger.debug('Texts to translate:', {
      texts: texts.map((t) => t.substring(0, 50) + (t.length > 50 ? '...' : ''))
    });

    if (texts.length === 0) {
      return [];
    }

    await this.ensureClientInitialized();

    const prompt = this.buildBatchPrompt(texts, targetLang);
    const model = this.getModel();
    const timeout = ConfigManager.getTimeout();
    const retryConfig = ConfigManager.getRetryConfig();

    logger.debug(`Using model: ${model}, timeout: ${timeout}ms for batch`);

    // Log batch prompt with borders
    logger.info('='.repeat(60));
    logger.info(`${providerName.toUpperCase()} BATCH REQUEST PROMPT:`);
    logger.info('-'.repeat(60));
    logger.info(prompt);
    logger.info('='.repeat(60));

    try {
      const translations = await withRetry(
        async () => {
          logger.info(`Sending batch request to ${providerName} API...`);
          const startTime = Date.now();

          const responseText = await this.callBatchTranslationAPI(
            prompt,
            timeout,
            texts.length
          );

          const duration = Date.now() - startTime;
          logger.info(
            `${providerName} API batch response received (${duration}ms)`
          );

          logger.info(`${providerName} batch response received, attempting to parse...`);
          logger.debug(`Raw ${providerName} batch response:`, responseText);

          const result = this.parseBatchResponse(responseText);

          if (result.length !== texts.length) {
            logger.warn(
              `${providerName} batch response count mismatch. Expected ${texts.length}, got ${result.length}. Falling back to sequential translation.`
            );
            throw new Error('Batch response count mismatch');
          }

          // Log batch translation success with borders
          logger.info('Batch translation successful');
          logger.info('='.repeat(60));
          logger.info(`${providerName.toUpperCase()} BATCH RESPONSE:`);
          logger.info('-'.repeat(60));
          logger.info(JSON.stringify(result, null, 2));
          logger.info('='.repeat(60));

          return result;
        },
        retryConfig,
        `${providerName} batch translation`
      );

      return translations;
    } catch (error: any) {
      if (error.name === 'AbortError' || error.message === 'timeout') {
        const errorMsg = vscode.l10n.t('error.translation.timeout', timeout);
        logger.notifyError(errorMsg);
        logger.warn(
          `${providerName} batch translation timed out, falling back to sequential translation.`
        );
        return this.translateBatchSequentially(texts, targetLang);
      }
      const errorMsg = vscode.l10n.t(
        'error.translation.failed',
        error.message || 'Unknown error'
      );
      logger.notifyError(errorMsg, error);
      logger.warn(
        `${providerName} batch translation failed, falling back to sequential translation.`
      );
      return this.translateBatchSequentially(texts, targetLang);
    }
  }

  /**
   * Fallback method: translate texts one by one sequentially
   * Used when batch translation fails
   */
  protected async translateBatchSequentially(
    texts: string[],
    targetLang: string
  ): Promise<string[]> {
    const results: string[] = [];
    for (const text of texts) {
      try {
        results.push(await this.translate(text, targetLang));
      } catch (error) {
        logger.error(
          `Sequential translation fallback failed for text: ${text.substring(
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
