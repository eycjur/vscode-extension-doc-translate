# Doc Translate

[![CI](https://github.com/eycjur/vscode-extension-doc-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/eycjur/vscode-extension-doc-translate/actions/workflows/ci.yml)
[![VS Code Marketplace](https://img.shields.io/visual-studio-marketplace/v/m-cube.doc-translate)](https://marketplace.visualstudio.com/items?itemName=m-cube.doc-translate)
[![Open VSX](https://img.shields.io/open-vsx/v/m-cube/doc-translate)](https://open-vsx.org/extension/m-cube/doc-translate)

Translate code docstrings and comments using multiple LLMs (Claude, OpenAI, Gemini, Azure OpenAI) in VSCode.

**[日本語README](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/README.ja.md)** | **[中文 README](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/README.zh-CN.md)**

## Features

- **Multiple LLM Providers**: Anthropic Claude, OpenAI, Google Gemini, Azure OpenAI
- **Multi-Language Support**: Python, JavaScript, TypeScript, Go, Markdown
- **Inline Translation Display**: Translations shown directly in code (comments on the right, docstrings as overlay)
- **Automatic Translation**: Translates on file open/save with smart caching and batch processing
- **Language Detection**: Automatically skips translation if text is already in target language
- **Persistent Cache**: Saves translations across sessions to minimize API calls
- **Error Handling**: Non-intrusive notifications with retry options
- **Configurable**: Environment variables and VSCode settings support

## Installation

### VS Code Marketplace
Install from the [VS Code Marketplace](https://marketplace.visualstudio.com/items?itemName=m-cube.doc-translate)

### Open VSX Registry
Install from the [Open VSX Registry](https://open-vsx.org/extension/m-cube/doc-translate)

### Requirements

- **LLM API Key**: You need an API key for at least one of the following LLM providers:
  - **Anthropic Claude**: `ANTHROPIC_API_KEY` environment variable or `docTranslate.anthropicApiKey` setting
  - **OpenAI**: `OPENAI_API_KEY` environment variable or `docTranslate.openaiApiKey` setting
  - **Google Gemini**: `GEMINI_API_KEY` environment variable or `docTranslate.geminiApiKey` setting
  - **Azure OpenAI**: `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT` environment variables or corresponding settings
- **Language Extensions**: LSP support required for each language
  - **Python**: Python extension (with Pylance)
  - **JavaScript/TypeScript**: Usually built into VSCode
  - **Go**: Go extension

## Quick Start (Usage)

1. Configure LLM provider and API key:
   - Select `docTranslate.provider` in VSCode settings (`anthropic`, `openai`, `gemini`, or `azure-openai`)
   - Set the API key for your chosen provider:
     - **Anthropic**: Setting `docTranslate.anthropicApiKey` or environment variable `ANTHROPIC_API_KEY`
     - **OpenAI**: Setting `docTranslate.openaiApiKey` or environment variable `OPENAI_API_KEY`
     - **Gemini**: Setting `docTranslate.geminiApiKey` or environment variable `GEMINI_API_KEY`
     - **Azure OpenAI**: Settings `docTranslate.azureOpenaiApiKey` and `docTranslate.azureOpenaiEndpoint` or environment variables `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT`

2. Set target language (optional):
   - `docTranslate.targetLang`: Target language (default: `ja`)
   - Source language is automatically detected (using franc library)
   - Automatically skipped if same language
   - Supported languages: `en`, `ja`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru`, etc.

3. Open a file in a supported language (Python, JavaScript, TypeScript, Go)
   - Extension automatically starts translating all docstrings and comments in the background
   - Check progress in status bar: `$(sync~spin) Translating X/Y blocks...`
   - On completion: `$(check) Translated X blocks`

4. View translations
   - **Comments**: Translation appears to the right of each line
     - Python: `# This is a comment → これはコメントです`
     - JavaScript/TypeScript/Go: `// This is a comment → これはコメントです`
   - **Docstrings/JSDoc**: Original text is hidden, translation overlaid
   - No hover required - always visible
   - Original code is never modified (visual only)

5. Edit and save files
   - File is automatically re-translated on save
   - Cache leveraged for fast processing of unchanged parts

## Extension Settings

This extension contributes the following settings:

### Basic Settings
* `docTranslate.provider`: LLM provider to use (`anthropic`, `openai`, `gemini`, `azure-openai`, default: `anthropic`)
* `docTranslate.targetLang`: Target language code (default: `ja`)
  - Source language is automatically detected
  - Supported languages: `en`, `ja`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru`, etc.
* `docTranslate.supportedLanguages`: Programming languages to translate (default: `["python", "javascript", "typescript", "go"]`)
* `docTranslate.exclude`: Glob patterns to exclude files (workspace-relative path or basename, e.g. `docs/**/*.md`, `*.md`)
* `docTranslate.timeout`: API request timeout in milliseconds (default: `30000`)
* `docTranslate.maxRetries`: Maximum retry count (default: `3`)
* `docTranslate.retryInitialDelay`: Initial retry delay in milliseconds (default: `1000`)

### Anthropic Claude Settings
* `docTranslate.anthropicApiKey`: Anthropic API key (this setting takes precedence over environment variable `ANTHROPIC_API_KEY`)
* `docTranslate.model`: Claude model to use (default: `claude-haiku-4-5-20251001`)

### OpenAI Settings
* `docTranslate.openaiApiKey`: OpenAI API key (this setting takes precedence over environment variable `OPENAI_API_KEY`)
* `docTranslate.openaiModel`: OpenAI model to use (default: `gpt-4o-mini`)

### Google Gemini Settings
* `docTranslate.geminiApiKey`: Gemini API key (this setting takes precedence over environment variable `GEMINI_API_KEY`)
* `docTranslate.geminiModel`: Gemini model to use (default: `gemini-2.0-flash-exp`)

### Azure OpenAI Settings
* `docTranslate.azureOpenaiApiKey`: Azure OpenAI API key (this setting takes precedence over environment variable `AZURE_OPENAI_API_KEY`)
* `docTranslate.azureOpenaiEndpoint`: Azure OpenAI endpoint URL (e.g., `https://your-resource.openai.azure.com/`, this setting takes precedence over environment variable `AZURE_OPENAI_ENDPOINT`)
* `docTranslate.azureOpenaiApiVersion`: Azure OpenAI API version (default: `2024-02-15-preview`)
* `docTranslate.azureOpenaiDeploymentName`: Azure OpenAI deployment name (default: `gpt-4o-mini`)

## Commands

* `Doc Translate: Clear Translation Cache`: Clear translation cache and pre-translation cache (re-translate on next file open)
* `Doc Translate: Show Logs`: Open output channel with detailed logs

## Documentation

- [Architecture](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/docs/ARCHITECTURE.md) - System architecture details
- [Contributing Guide](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/docs/CONTRIBUTING.md) - Developer guide

## Release Notes

See [CHANGELOG.md](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/CHANGELOG.md) for detailed change history.

## Debugging

To view detailed logs:

1. Open command palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Run `Doc Translate: Show Logs`
3. The "Doc Translate" output channel will show detailed logs including:
   - Extension activation state
   - API key detection
   - Pre-translation progress (when opening files)
   - LSP symbol queries and results
   - LSP docstring detection
   - Translation requests and responses
   - Cache hits/misses
   - Error details

Or manually open the output panel:
- View → Output → Select "Doc Translate" from dropdown

## Sample Files for Testing

Sample files are provided in `src/test/assets/` to test the extension:

- **`sample.py`**: Python sample code (docstrings, inline comments)
- **`sample.ts`**: TypeScript sample code (JSDoc, multi-line comments, single-line comments)
- **`sample.js`**: JavaScript sample code (JSDoc, multi-line comments, single-line comments)
- **`sample.go`**: Go sample code (godoc, package doc, multi-line/single-line comments)

Opening these files will automatically translate and display comments and docstrings inline.
These files are also referenced by test code as assets.
