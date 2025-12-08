# User Guide

This is a comprehensive guide for using the Doc Translate extension.

## Installation

Install the extension from the VS Code Marketplace:

1. Open VS Code
2. Go to Extensions view (Ctrl+Shift+X)
3. Search for "Doc Translate"
4. Click Install

## Configuration

Configure your API key in settings:

- For Claude: Set `docTranslate.anthropicApiKey`
- For OpenAI: Set `docTranslate.openaiApiKey`
- For Gemini: Set `docTranslate.geminiApiKey`

### Environment Variables

You can also use environment variables:

```bash
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export GEMINI_API_KEY="your-key-here"
```

> **Note**: VSCode settings take precedence over environment variables.

## Features

The extension supports multiple programming languages:

- Python: docstrings and comments
- JavaScript/TypeScript: JSDoc and comments
- Go: godoc and comments
- Markdown: documentation files

## Usage

Simply open a file and the extension will:

1. Detect docstrings and comments
2. Translate them to your target language
3. Display translations inline

### Keyboard Shortcuts

- `Ctrl+Shift+P` → "Doc Translate: Clear Cache"
- `Ctrl+Shift+P` → "Doc Translate: Show Logs"

## Troubleshooting

If you encounter issues:

- Check your API key is configured correctly
- Verify your internet connection
- Review the extension logs

---

For more information, visit our [GitHub repository](https://github.com/eycjur/vscode-extension-doc-translate).

<!-- This is a comment that should be ignored -->

![Extension Icon](icon.png)
