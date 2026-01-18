import * as path from 'path';
import * as vscode from 'vscode';
import { TranslationProviderFactory } from '../providers/translationProviderFactory';
import { TranslationCache } from './translationCache';
import { BlockDetectorFactory } from '../detectors/blockDetectorFactory';
import { InlineTranslationProvider } from './inlineTranslationProvider';
import { logger } from '../utils/logger';
import { ConfigManager } from '../utils/config';
import { TextBlock } from '../detectors/base/blockDetector';
import { isDocumentExcluded } from '../utils/excludeMatcher';
import { GlobalSemaphore } from '../utils/globalSemaphore';

interface ITranslationProvider {
  translate(text: string, targetLang: string): Promise<string>;
  translateBatch(texts: string[], targetLang: string): Promise<string[]>;
}

export class PreTranslationService {
  private cache: TranslationCache;
  private inlineProvider: InlineTranslationProvider;
  private statusBarItem: vscode.StatusBarItem;
  private activeTranslations = new Map<string, Promise<void>>();
  private globalSemaphore: GlobalSemaphore;

  constructor(
    cache: TranslationCache,
    inlineProvider: InlineTranslationProvider
  ) {
    this.cache = cache;
    this.inlineProvider = inlineProvider;
    this.statusBarItem = vscode.window.createStatusBarItem(
      vscode.StatusBarAlignment.Right,
      90
    );
    this.statusBarItem.command = 'doc-translate.showLogs';
    // Initialize global semaphore with configured max concurrent requests
    this.globalSemaphore = GlobalSemaphore.getInstance(ConfigManager.getMaxConcurrentRequests());
  }

  /**
   * Update the global semaphore limit when configuration changes
   */
  updateConcurrencyLimit(): void {
    this.globalSemaphore.updateMaxConcurrent(ConfigManager.getMaxConcurrentRequests());
  }

  /**
   * Pre-translate all docstrings and comments in a document
   * Always runs - uses cache when available, translates when not
   */
  async preTranslateDocument(document: vscode.TextDocument): Promise<void> {
    // Only process supported languages
    if (!BlockDetectorFactory.isLanguageSupported(document.languageId)) {
      return;
    }

    const excludePatterns = ConfigManager.getExcludePatterns();
    if (isDocumentExcluded(document, excludePatterns)) {
      this.inlineProvider.clearFileDecorations(document.uri);
      logger.info(`Excluded from translation: ${document.fileName}`);
      return;
    }

    const fileKey = document.uri.toString();

    // If already translating this file, wait for it
    const existingTranslation = this.activeTranslations.get(fileKey);
    if (existingTranslation) {
      logger.debug(
        `Translation already in progress for: ${document.fileName}, waiting...`
      );
      await existingTranslation;
      return;
    }

    // Create translation promise
    const translationPromise = this.performTranslation(document);
    this.activeTranslations.set(fileKey, translationPromise);

    try {
      await translationPromise;
    } finally {
      this.activeTranslations.delete(fileKey);
    }
  }

  /**
   * Perform translation for a document
   */
  private async performTranslation(
    document: vscode.TextDocument
  ): Promise<void> {
    logger.info('='.repeat(60));
    logger.info(`Translating: ${document.fileName}`);
    logger.info('='.repeat(60));

    try {
      // Extract all translatable blocks
      const blocks = await this.extractAllBlocks(document);
      logger.info(`Found ${blocks.length} translatable blocks`);

      if (blocks.length === 0) {
        logger.info('No translatable blocks found');
        this.statusBarItem.hide();
        return;
      }

      // Show progress in status bar
      this.statusBarItem.text = `$(sync~spin) ${vscode.l10n.t(
        'status.translating',
        blocks.length
      )}`;
      this.statusBarItem.show();

      let translated = 0;
      const startTime = Date.now();
      let translationSucceeded = false;

      // Filter out already cached blocks
      const blocksToTranslate = blocks.filter(
        (block) => !this.cache.get(block.text, ConfigManager.getTargetLang())
      );
      const cachedCount = blocks.length - blocksToTranslate.length;

      if (cachedCount > 0) {
        logger.info(`${cachedCount} blocks already cached, skipping`);
        translated = cachedCount;
      }

      if (blocksToTranslate.length === 0) {
        logger.info('All blocks already cached, no translation needed');
        await this.inlineProvider.updateInlineTranslations(document, blocks);
        translationSucceeded = true;
        translated = blocks.length;
      } else {
        logger.info(
          `Translating ${blocksToTranslate.length} blocks with global max ${this.globalSemaphore.getMaxConcurrent()} concurrent requests`
        );

        // Display cached translations first
        if (cachedCount > 0) {
          await this.inlineProvider.updateInlineTranslations(document, blocks);
        }

        // Translate blocks in parallel with concurrency limit
        const failedBlocks = await this.translateBlocksConcurrently(
          document,
          blocksToTranslate,
          blocks,
          (current, total) => {
            translated = cachedCount + current;
            this.statusBarItem.text = `$(sync~spin) ${vscode.l10n.t(
              'status.translatingProgress',
              translated,
              total
            )}`;
          }
        );

        if (failedBlocks.length === 0) {
          translationSucceeded = true;
          translated = blocks.length;
        } else {
          translationSucceeded = await this.handlePartialFailures(
            document,
            blocks,
            failedBlocks
          );
          if (translationSucceeded) {
            translated = blocks.length;
          }
        }
      }

      const duration = Date.now() - startTime;
      if (translationSucceeded) {
        logger.info(
          `Translation completed: ${translated}/${blocks.length} blocks in ${duration}ms`
        );
        this.statusBarItem.text = `$(check) ${vscode.l10n.t(
          'status.translated',
          translated
        )}`;
        this.statusBarItem.tooltip = vscode.l10n.t(
          'status.tooltip.completed',
          path.basename(document.fileName)
        );
      } else {
        logger.warn(
          `Translation finished with failures: ${translated}/${blocks.length} blocks in ${duration}ms`
        );
        this.statusBarItem.text = `$(warning) ${vscode.l10n.t(
          'status.incomplete'
        )}`;
        this.statusBarItem.tooltip = vscode.l10n.t(
          'status.tooltip.incomplete',
          path.basename(document.fileName)
        );
      }
      logger.info('='.repeat(60));
      setTimeout(() => this.statusBarItem.hide(), 5000);
    } catch (error) {
      await this.handleFileTranslationError(document, error);
      this.statusBarItem.text = `$(error) ${vscode.l10n.t('status.failed')}`;
      this.statusBarItem.tooltip = vscode.l10n.t(
        'status.tooltip.failed',
        path.basename(document.fileName)
      );
      setTimeout(() => this.statusBarItem.hide(), 5000);
    }
  }

  /**
   * Translate blocks concurrently with a global limit on concurrent requests
   * Uses GlobalSemaphore to limit requests across all files
   * Updates inline translations progressively as each block completes
   */
  private async translateBlocksConcurrently(
    document: vscode.TextDocument,
    blocksToTranslate: TextBlock[],
    allBlocks: TextBlock[],
    onProgress: (current: number, total: number) => void
  ): Promise<TextBlock[]> {
    let completed = 0;
    const failedBlocks: TextBlock[] = [];

    // Get translation provider and language settings
    const provider = TranslationProviderFactory.getProvider();
    const targetLang = ConfigManager.getTargetLang();

    const BATCH_SIZE = 10;
    const MAX_BATCH_LENGTH = 2000;

    // Prepare all batches upfront
    const allBatches: TextBlock[][] = [];
    let index = 0;

    while (index < blocksToTranslate.length) {
      const batch: TextBlock[] = [];
      let currentBatchLength = 0;

      while (index < blocksToTranslate.length) {
        const block = blocksToTranslate[index];

        // Check limits for current batch
        if (
          batch.length > 0 &&
          (batch.length >= BATCH_SIZE ||
            currentBatchLength + block.text.length > MAX_BATCH_LENGTH)
        ) {
          break; // Batch full
        }

        batch.push(block);
        currentBatchLength += block.text.length;
        index++;
      }

      if (batch.length > 0) {
        allBatches.push(batch);
      }
    }

    logger.info(
      `Prepared ${allBatches.length} batches for translation (global semaphore limit: ${this.globalSemaphore.getMaxConcurrent()})`
    );

    // Process all batches with global semaphore control
    const promises = allBatches.map(async (batch) => {
      // Use global semaphore to limit concurrent API requests across all files
      return this.globalSemaphore.execute(async () => {
        try {
          const textsToTranslate = batch.map((b) => b.text);
          // Cast provider to ITranslationProvider to access translateBatch
          const batchProvider = provider as unknown as ITranslationProvider;

          let translations: string[] = [];
          if (typeof batchProvider.translateBatch === 'function') {
            translations = await batchProvider.translateBatch(
              textsToTranslate,
              targetLang
            );
          } else {
            // Fallback if provider doesn't support batching (shouldn't happen with our changes)
            translations = await Promise.all(
              textsToTranslate.map((t) => provider.translate(t, targetLang))
            );
          }

          // Store translations in cache and update progress
          for (let i = 0; i < batch.length; i++) {
            const block = batch[i];
            const translation = translations[i];
            if (translation) {
              this.cache.set(block.text, translation, targetLang);
              completed++;
              onProgress(completed, allBlocks.length);
            } else {
              failedBlocks.push(block);
              logger.error(
                `Failed to translate block in batch: ${block.text.substring(
                  0,
                  30
                )}...`
              );
            }
          }
          // Update inline translations progressively after each batch completes
          await this.inlineProvider.updateInlineTranslations(
            document,
            allBlocks
          );
        } catch (error) {
          // If batch fails completely, mark all blocks in it as failed
          for (const block of batch) {
            failedBlocks.push(block);
          }
          logger.error('Batch translation failed', error);
        }
      });
    });

    await Promise.all(promises);

    logger.info(
      `Concurrent translation completed: ${completed}/${blocksToTranslate.length} blocks translated`
    );
    return failedBlocks;
  }

  /**
   * Extract all translatable blocks from document
   */
  private async extractAllBlocks(
    document: vscode.TextDocument
  ): Promise<TextBlock[]> {
    // Get the appropriate detector for this language
    const detector = BlockDetectorFactory.getDetector(document.languageId);
    if (!detector) {
      logger.warn(`No detector available for language: ${document.languageId}`);
      return [];
    }

    // Use the detector to extract all blocks
    return await detector.extractAllBlocks(document);
  }

  private async handlePartialFailures(
    document: vscode.TextDocument,
    allBlocks: TextBlock[],
    failedBlocks: TextBlock[]
  ): Promise<boolean> {
    if (failedBlocks.length === 0) {
      return true;
    }

    const fileName = path.basename(document.fileName);
    const message = vscode.l10n.t(
      'message.failedBlocks',
      fileName,
      failedBlocks.length
    );
    logger.notifyWarning(message);

    const retryLabel = vscode.l10n.t('action.retryFailedBlocks');
    const selection = await vscode.window.showWarningMessage(
      `Doc Translate: ${message}`,
      retryLabel,
      vscode.l10n.t('action.viewLogs')
    );

    if (selection === vscode.l10n.t('action.viewLogs')) {
      logger.show();
      return false;
    }

    if (selection !== retryLabel) {
      return false;
    }

    this.statusBarItem.text = `$(sync~spin) ${vscode.l10n.t(
      'status.retrying',
      failedBlocks.length
    )}`;
    this.statusBarItem.tooltip = vscode.l10n.t(
      'status.tooltip.retrying',
      fileName
    );
    this.statusBarItem.show();

    const remainingFailures = await this.translateBlocksConcurrently(
      document,
      failedBlocks,
      allBlocks,
      (current, _total) => {
        this.statusBarItem.text = `$(sync~spin) ${vscode.l10n.t(
          'status.retryingProgress',
          current,
          failedBlocks.length
        )}`;
      }
    );

    if (remainingFailures.length === 0) {
      return true;
    }

    logger.notifyError(
      vscode.l10n.t('message.failedRetry', fileName, remainingFailures.length)
    );
    return false;
  }

  private async handleFileTranslationError(
    document: vscode.TextDocument,
    error: any
  ): Promise<void> {
    const fileName = path.basename(document.fileName);
    const reason = error?.message || error?.toString() || 'Unknown error';
    const message = vscode.l10n.t('message.failedFile', fileName, reason);
    logger.notifyError(message, error);

    const retryLabel = vscode.l10n.t('action.retryFile');
    const selection = await vscode.window.showErrorMessage(
      `Doc Translate: ${message}`,
      retryLabel,
      vscode.l10n.t('action.viewLogs')
    );

    if (selection === vscode.l10n.t('action.viewLogs')) {
      logger.show();
      return;
    }

    if (selection === retryLabel) {
      this.scheduleRetry(document);
    }
  }

  private scheduleRetry(document: vscode.TextDocument): void {
    setTimeout(() => this.preTranslateDocument(document), 100);
  }

  /**
   * Clear decorations for a file (called when explicitly clearing cache)
   */
  clearFileCache(uri: vscode.Uri): void {
    this.inlineProvider.clearFileDecorations(uri);
    logger.info(`Cleared decorations for: ${uri.fsPath}`);
  }

  /**
   * Clear all decorations
   */
  clearAllCaches(): void {
    this.inlineProvider.clearAllDecorations();
    logger.info('Cleared all decorations');
  }

  /**
   * Dispose resources
   */
  dispose(): void {
    this.statusBarItem.dispose();
  }
}
