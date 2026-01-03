import * as vscode from 'vscode';
import { TranslationProviderFactory } from './providers/translationProviderFactory';
import { TranslationCache } from './services/translationCache';
import { PreTranslationService } from './services/preTranslationService';
import { InlineTranslationProvider } from './services/inlineTranslationProvider';
import { BlockDetectorFactory } from './detectors/blockDetectorFactory';
import { logger } from './utils/logger';
import { ConfigManager } from './utils/config';
import { isDocumentExcluded } from './utils/excludeMatcher';

export function activate(context: vscode.ExtensionContext) {
  logger.info('='.repeat(60));
  logger.info('Doc Translate extension is activating...');
  logger.info(`VSCode version: ${vscode.version}`);
  logger.info(`Extension path: ${context.extensionPath}`);

  // Create cache
  const cache = new TranslationCache(context);
  logger.info('Translation cache created');

  // Create inline translation provider
  const inlineProvider = new InlineTranslationProvider(cache);
  logger.info('Inline translation provider created');

  // Create pre-translation service
  const preTranslationService = new PreTranslationService(
    cache,
    inlineProvider
  );
  logger.info('Pre-translation service created');

  const refreshExcludeForOpenDocuments = () => {
    vscode.workspace.textDocuments.forEach((doc) => {
      if (!BlockDetectorFactory.isLanguageSupported(doc.languageId)) {
        return;
      }
      if (isDocumentExcluded(doc, ConfigManager.getExcludePatterns())) {
        preTranslationService.clearFileCache(doc.uri);
        return;
      }
      preTranslationService.preTranslateDocument(doc);
    });
  };

  // Register command to clear translation cache
  const clearCacheCommand = vscode.commands.registerCommand(
    'doc-translate.clearCache',
    () => {
      logger.info('Clear cache command executed');
      cache.clear();
      preTranslationService.clearAllCaches();
      vscode.window.showInformationMessage(
        vscode.l10n.t('extension.cacheCleared')
      );
    }
  );
  logger.info('Clear cache command registered');

  // Register command to show output channel
  const showLogsCommand = vscode.commands.registerCommand(
    'doc-translate.showLogs',
    () => {
      logger.show();
    }
  );
  logger.info('Show logs command registered');

  // Watch for configuration changes
  const configDisposable = vscode.workspace.onDidChangeConfiguration(
    (event) => {
      if (event.affectsConfiguration('docTranslate')) {
        logger.info('Configuration changed, updating translation provider');
        // Clear provider cache if provider type changed
        if (event.affectsConfiguration('docTranslate.provider')) {
          TranslationProviderFactory.clearCache();
        }
        TranslationProviderFactory.updateConfiguration();

        if (event.affectsConfiguration('docTranslate.exclude')) {
          logger.info('Exclude patterns changed, refreshing open documents');
          refreshExcludeForOpenDocuments();
        }
      }
    }
  );
  logger.info('Configuration watcher registered');

  // Pre-translate currently open supported files
  // Delay slightly to ensure editors are fully initialized
  logger.info('Pre-translating open supported files...');
  setTimeout(() => {
    vscode.workspace.textDocuments.forEach((doc) => {
      if (BlockDetectorFactory.isLanguageSupported(doc.languageId)) {
        logger.info(`Queuing pre-translation for open file: ${doc.fileName}`);
        preTranslationService.preTranslateDocument(doc);
      }
    });
  }, 200);

  // Watch for file open events
  const onOpenDisposable = vscode.workspace.onDidOpenTextDocument(
    (document) => {
      if (BlockDetectorFactory.isLanguageSupported(document.languageId)) {
        logger.info(
          `Supported file opened: ${document.fileName} (${document.languageId})`
        );
        preTranslationService.preTranslateDocument(document);
      }
    }
  );
  logger.info('File open watcher registered');

  // Watch for file changes (no action needed - decorations stay visible until save)
  const onChangeDisposable = vscode.workspace.onDidChangeTextDocument(
    (event) => {
      if (BlockDetectorFactory.isLanguageSupported(event.document.languageId)) {
        logger.debug(`Supported file changed: ${event.document.fileName}`);
        // Decorations remain visible during editing
        // Translation will update on save
      }
    }
  );
  logger.info('File change watcher registered');

  // Watch for file save events (to re-translate with cache)
  // Use debounce to prevent excessive API calls when auto-save is enabled
  let saveTimeout: NodeJS.Timeout | undefined;
  const onSaveDisposable = vscode.workspace.onDidSaveTextDocument(
    (document) => {
      if (BlockDetectorFactory.isLanguageSupported(document.languageId)) {
        // Clear previous timeout if exists
        if (saveTimeout) {
          clearTimeout(saveTimeout);
        }

        // Set new timeout (debounce)
        saveTimeout = setTimeout(() => {
          logger.info(
            `Supported file saved: ${document.fileName} (${document.languageId}), re-translating`
          );
          preTranslationService.preTranslateDocument(document);
          saveTimeout = undefined;
        }, 1500); // 1.5 seconds delay
      }
    }
  );
  logger.info('File save watcher registered');

  // Watch for active editor changes (to refresh inline decorations and trigger translation)
  const onEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(
    (editor) => {
      if (
        editor &&
        BlockDetectorFactory.isLanguageSupported(editor.document.languageId)
      ) {
        logger.info(
          `Active editor changed to: ${editor.document.fileName} (${editor.document.languageId})`
        );
        // Trigger pre-translation for this document
        preTranslationService.preTranslateDocument(editor.document);
      }
      inlineProvider.refreshVisibleEditors();
    }
  );
  logger.info('Editor change watcher registered');

  // Watch for text selection changes (to hide translation when selecting docstrings)
  const onSelectionChangeDisposable =
    vscode.window.onDidChangeTextEditorSelection(() => {
      inlineProvider.refreshVisibleEditors();
    });
  logger.info('Selection change watcher registered');

  context.subscriptions.push(
    clearCacheCommand,
    showLogsCommand,
    configDisposable,
    onOpenDisposable,
    onChangeDisposable,
    onSaveDisposable,
    onEditorChangeDisposable,
    onSelectionChangeDisposable,
    { dispose: () => preTranslationService.dispose() },
    { dispose: () => inlineProvider.dispose() }
  );

  logger.info('Doc Translate extension activated successfully!');
  logger.info('='.repeat(60));
}

export function deactivate() {
  logger.info('Doc Translate extension is deactivating...');
  logger.dispose();
}
