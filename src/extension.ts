import * as vscode from 'vscode';
import { TranslationHoverProvider } from './translationHoverProvider';
import { logger } from './logger';

export function activate(context: vscode.ExtensionContext) {
	logger.info('='.repeat(60));
	logger.info('Doc Translate extension is activating...');
	logger.info(`VSCode version: ${vscode.version}`);
	logger.info(`Extension path: ${context.extensionPath}`);

	// Create hover provider
	const hoverProvider = new TranslationHoverProvider();
	logger.info('Hover provider created');

	// Register hover provider for Python files
	const hoverDisposable = vscode.languages.registerHoverProvider(
		{ scheme: 'file', language: 'python' },
		hoverProvider
	);
	logger.info('Hover provider registered for Python files');

	// Register command to clear translation cache
	const clearCacheCommand = vscode.commands.registerCommand('doc-translate.clearCache', () => {
		logger.info('Clear cache command executed');
		hoverProvider.clearCache();
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

	context.subscriptions.push(
		hoverDisposable,
		clearCacheCommand,
		showLogsCommand,
		configDisposable,
		{ dispose: () => hoverProvider.dispose() }
	);

	logger.info('Doc Translate extension activated successfully!');
	logger.info('='.repeat(60));
}

export function deactivate() {
	logger.info('Doc Translate extension is deactivating...');
	logger.dispose();
}
