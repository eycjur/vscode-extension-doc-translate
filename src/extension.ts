import * as vscode from 'vscode';
import { ClaudeClient } from './claudeClient';
import { TranslationCache } from './translationCache';
import { PreTranslationService } from './preTranslationService';
import { InlineTranslationProvider } from './inlineTranslationProvider';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	logger.info('='.repeat(60));
	logger.info('Doc Translate extension is activating...');
	logger.info(`VSCode version: ${vscode.version}`);
	logger.info(`Extension path: ${context.extensionPath}`);

	// Create Claude client and cache
	const claudeClient = new ClaudeClient();
	const cache = new TranslationCache(context);
	logger.info('Claude client and cache created');

	// Create inline translation provider
	const inlineProvider = new InlineTranslationProvider(cache);
	logger.info('Inline translation provider created');

	// Create pre-translation service
	const preTranslationService = new PreTranslationService(
		claudeClient,
		cache,
		inlineProvider
	);
	logger.info('Pre-translation service created');

	// Register command to clear translation cache
	const clearCacheCommand = vscode.commands.registerCommand('doc-translate.clearCache', () => {
		logger.info('Clear cache command executed');
		cache.clear();
		preTranslationService.clearAllCaches();
		vscode.window.showInformationMessage('Translation cache cleared!');
	});
	logger.info('Clear cache command registered');

	// Register command to show output channel
	const showLogsCommand = vscode.commands.registerCommand('doc-translate.showLogs', () => {
		logger.show();
	});
	logger.info('Show logs command registered');

	// Watch for configuration changes
	const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('docTranslate')) {
			logger.info('Configuration changed, updating Claude client');
			claudeClient.updateConfiguration();
		}
	});
	logger.info('Configuration watcher registered');

	// Pre-translate currently open Python files
	logger.info('Pre-translating open Python files...');
	vscode.workspace.textDocuments.forEach(doc => {
		if (doc.languageId === 'python') {
			logger.info(`Queuing pre-translation for open file: ${doc.fileName}`);
			preTranslationService.preTranslateDocument(doc);
		}
	});

	// Watch for file open events
	const onOpenDisposable = vscode.workspace.onDidOpenTextDocument((document) => {
		if (document.languageId === 'python') {
			logger.info(`Python file opened: ${document.fileName}`);
			preTranslationService.preTranslateDocument(document);
		}
	});
	logger.info('File open watcher registered');

	// Watch for file changes (to invalidate pre-translation cache)
	const onChangeDisposable = vscode.workspace.onDidChangeTextDocument((event) => {
		if (event.document.languageId === 'python') {
			logger.debug(`Python file changed: ${event.document.fileName}, clearing pre-translation cache`);
			preTranslationService.clearFileCache(event.document.uri);
		}
	});
	logger.info('File change watcher registered');

	// Watch for file save events (to re-translate with cache)
	const onSaveDisposable = vscode.workspace.onDidSaveTextDocument((document) => {
		if (document.languageId === 'python') {
			logger.info(`Python file saved: ${document.fileName}, re-translating`);
			preTranslationService.preTranslateDocument(document);
		}
	});
	logger.info('File save watcher registered');

	// Watch for active editor changes (to refresh inline decorations)
	const onEditorChangeDisposable = vscode.window.onDidChangeActiveTextEditor(() => {
		inlineProvider.refreshVisibleEditors();
	});
	logger.info('Editor change watcher registered');

	// Watch for text selection changes (to hide translation when selecting docstrings)
	const onSelectionChangeDisposable = vscode.window.onDidChangeTextEditorSelection(() => {
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
