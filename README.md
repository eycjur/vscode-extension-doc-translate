# Doc Translate

VSCode extension that translates English docstrings and comments in Python code to Japanese using Claude API.

## Features

- **Instant Hover Translation**: Hover over Python docstrings or comments to see Japanese translations instantly
- **Background Pre-Translation**: Automatically translates all docstrings and comments when you open a Python file
  - No waiting time when hovering (translations are already cached)
  - Progress indicator in status bar
  - Smart caching: only translates once per file
- **LSP-Powered Detection**: Uses VSCode's Language Server Protocol (Pylance) exclusively for accurate Python syntax analysis
- **Smart Block Detection**: Automatically detects and translates:
  - Docstrings (both `"""` and `'''` styles) - detected via LSP symbol analysis
  - Comment blocks (consecutive lines starting with `#`)
  - Inline comments (end-of-line comments)
- **Translation Cache**: Caches translations in memory to avoid redundant API calls
- **Loading Indicator**: Shows a spinning icon in the status bar while translating
- **Comprehensive Logging**: Detailed logs showing LSP queries, API requests, responses, and debugging info
- **Configurable**: Supports both environment variable and VSCode settings for API key configuration

## Requirements

- **Anthropic API Key**: You need a valid Anthropic API key to use this extension
  - Set `ANTHROPIC_API_KEY` environment variable (recommended), or
  - Configure `docTranslate.anthropicApiKey` in VSCode settings
- **Python Extension**: Requires VSCode's Python extension (with Pylance) for LSP-based docstring detection

## Extension Settings

This extension contributes the following settings:

* `docTranslate.anthropicApiKey`: Anthropic API Key for Claude translation (environment variable `ANTHROPIC_API_KEY` takes precedence)
* `docTranslate.model`: Claude model to use for translation (default: `claude-sonnet-4-5-20250929`)
* `docTranslate.timeout`: API request timeout in milliseconds (default: `30000`)

## Usage

1. Set your Anthropic API key:
   - **Option 1 (Recommended)**: Set environment variable `ANTHROPIC_API_KEY`
   - **Option 2**: Set `docTranslate.anthropicApiKey` in VSCode settings

2. Open a Python file
   - The extension automatically starts translating all docstrings and comments in the background
   - Watch the status bar for progress: `$(sync~spin) Translating X/Y blocks...`
   - When complete: `$(check) Translated X blocks`

3. Hover your cursor over any docstring or comment
   - The Japanese translation will appear **instantly** (already cached from step 2)

4. Edit the file
   - Changes invalidate the cache for that file
   - The file will be re-translated automatically

## Commands

* `Doc Translate: Clear Translation Cache`: Clear both translation cache and pre-translation cache (forces re-translation on next file open)
* `Doc Translate: Show Logs`: Open the output channel to view detailed logs

## Debugging

To view detailed logs:

1. Open Command Palette (`Cmd+Shift+P` or `Ctrl+Shift+P`)
2. Run `Doc Translate: Show Logs`
3. The "Doc Translate" output channel will show detailed logs including:
   - Extension activation status
   - API key detection
   - Pre-translation progress (when files are opened)
   - LSP symbol queries and results
   - Docstring detection via LSP
   - Translation requests and responses
   - Cache hits/misses
   - Error details

Alternatively, you can open the output panel manually:
- View → Output → Select "Doc Translate" from the dropdown

## Known Issues

None at this time.

## Release Notes

### 0.0.1

Initial MVP release:
- Hover provider for Python docstrings and comments
- Claude API integration
- Translation caching
- Configurable API key and model settings

---

## Following extension guidelines

Ensure that you've read through the extensions guidelines and follow the best practices for creating your extension.

* [Extension Guidelines](https://code.visualstudio.com/api/references/extension-guidelines)

## Working with Markdown

You can author your README using Visual Studio Code. Here are some useful editor keyboard shortcuts:

* Split the editor (`Cmd+\` on macOS or `Ctrl+\` on Windows and Linux).
* Toggle preview (`Shift+Cmd+V` on macOS or `Shift+Ctrl+V` on Windows and Linux).
* Press `Ctrl+Space` (Windows, Linux, macOS) to see a list of Markdown snippets.

## For more information

* [Visual Studio Code's Markdown Support](http://code.visualstudio.com/docs/languages/markdown)
* [Markdown Syntax Reference](https://help.github.com/articles/markdown-basics/)

**Enjoy!**
