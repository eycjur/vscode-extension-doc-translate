import { logger } from '../../utils/logger';
import { isTranslationNeeded } from '../../utils/languageDetector';
import { LANGUAGE_NAMES } from '../../utils/constants';

/**
 * Base class for translation providers
 */
export abstract class BaseProvider {
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
   * Check if translation is needed and return original text if not
   */
  protected async checkTranslationNeeded(
    text: string,
    targetLang: string
  ): Promise<string | null> {
    if (!(await isTranslationNeeded(text, targetLang))) {
      logger.info('Translation not needed, returning original text');
      return text;
    }
    return null;
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
   * Abstract method to be implemented by concrete providers
   */
  abstract translate(text: string, targetLang: string): Promise<string>;

  /**
   * Batch translation method (can be overridden by providers for optimization)
   * Default implementation uses JSON array strategy
   */
  async translateBatch(texts: string[], targetLang: string): Promise<string[]> {
    // Default fallback: translate one by one if not implemented
    // But we want to enforce batching, so let's throw if not implemented by subclass
    // or provide a default implementation using buildBatchPrompt if the provider supports it.
    // Since we are modifying all providers, we can make this abstract or provide a default implementation.
    // Let's provide a default implementation that calls translate() sequentially as a fallback,
    // but we will override it in all providers to use the actual batch prompt.

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
