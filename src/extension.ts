import * as vscode from 'vscode';
import { TranslationHoverProvider } from './translationHoverProvider';
import { PreTranslationService } from './preTranslationService';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	logger.info('='.repeat(60));
	logger.info('Doc Translate extension is activating...');
	logger.info(`VSCode version: ${vscode.version}`);
	logger.info(`Extension path: ${context.extensionPath}`);

	// Create hover provider
	const hoverProvider = new TranslationHoverProvider();
	logger.info('Hover provider created');

	// Create pre-translation service
	const preTranslationService = new PreTranslationService(
		hoverProvider.claudeClient,
		hoverProvider.cache
	);
	logger.info('Pre-translation service created');

	// Register hover provider for Python files (both saved and unsaved)
	const hoverDisposable = vscode.languages.registerHoverProvider(
		[
			{ scheme: 'file', language: 'python' },
			{ scheme: 'untitled', language: 'python' }
		],
		hoverProvider
	);
	logger.info('Hover provider registered for Python files (file and untitled schemes)');

	// Register command to clear translation cache
	const clearCacheCommand = vscode.commands.registerCommand('doc-translate.clearCache', () => {
		logger.info('Clear cache command executed');
		hoverProvider.clearCache();
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
			logger.info('Configuration changed, updating hover provider');
			hoverProvider.updateConfiguration();
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

	context.subscriptions.push(
		hoverDisposable,
		clearCacheCommand,
		showLogsCommand,
		configDisposable,
		onOpenDisposable,
		onChangeDisposable,
		onSaveDisposable,
		{ dispose: () => preTranslationService.dispose() }
	);

	logger.info('Doc Translate extension activated successfully!');
	logger.info('='.repeat(60));
}

export function deactivate() {
	logger.info('Doc Translate extension is deactivating...');
	logger.dispose();
}
