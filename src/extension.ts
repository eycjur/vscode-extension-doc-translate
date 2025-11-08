import * as vscode from 'vscode';
import { TranslationHoverProvider } from './translationHoverProvider';

export function activate(context: vscode.ExtensionContext) {
	console.log('Doc Translate extension is now active!');

	// Create hover provider
	const hoverProvider = new TranslationHoverProvider();

	// Register hover provider for Python files
	const hoverDisposable = vscode.languages.registerHoverProvider(
		{ scheme: 'file', language: 'python' },
		hoverProvider
	);

	// Register command to clear translation cache
	const clearCacheCommand = vscode.commands.registerCommand('doc-translate.clearCache', () => {
		hoverProvider.clearCache();
		vscode.window.showInformationMessage('Translation cache cleared!');
	});

	// Watch for configuration changes
	const configDisposable = vscode.workspace.onDidChangeConfiguration((event) => {
		if (event.affectsConfiguration('docTranslate')) {
			hoverProvider.updateConfiguration();
		}
	});

	context.subscriptions.push(hoverDisposable, clearCacheCommand, configDisposable);
}

export function deactivate() {}
