# Contributing to Doc Translate

This document is a guide for contributing to the Doc Translate VSCode extension.

## Table of Contents

- [Development Environment Setup](#development-environment-setup)
- [Project Structure](#project-structure)
- [Development Workflow](#development-workflow)
- [Testing](#testing)
- [Coding Standards](#coding-standards)
- [Adding New Features](#adding-new-features)
  - [Supporting a New Programming Language](#supporting-a-new-programming-language)
  - [Supporting a New LLM Provider](#supporting-a-new-llm-provider)
- [Debugging](#debugging)
- [Release Process](#release-process)

## Development Environment Setup

### Requirements

- **Node.js**: v16 or higher
- **npm**: v7 or higher
- **VSCode**: v1.80 or higher
- **Git**: Latest version

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/vscode-extension-doc-translate.git
cd vscode-extension-doc-translate
```

2. Install dependencies:
```bash
npm install
```

3. Compile:
```bash
npm run compile
```

4. Set up API keys (for testing):
```bash
# Set at least one of the following
export ANTHROPIC_API_KEY="your-key-here"
export OPENAI_API_KEY="your-key-here"
export GEMINI_API_KEY="your-key-here"
```

## Project Structure

```
vscode-extension-doc-translate/
├── src/
│   ├── extension.ts                 # Entry point
│   ├── providers/                   # Translation providers
│   │   ├── base/
│   │   │   ├── translationProvider.ts
│   │   │   └── baseProvider.ts
│   │   ├── anthropicProvider.ts
│   │   ├── openaiProvider.ts
│   │   ├── geminiProvider.ts
│   │   └── translationProviderFactory.ts
│   ├── detectors/                   # Block detectors
│   │   ├── base/
│   │   │   ├── blockDetector.ts
│   │   │   └── baseDetector.ts
│   │   ├── pythonBlockDetector.ts
│   │   ├── javascriptBlockDetector.ts
│   │   ├── goBlockDetector.ts
│   │   └── blockDetectorFactory.ts
│   ├── services/                    # Core services
│   │   ├── preTranslationService.ts
│   │   ├── inlineTranslationProvider.ts
│   │   └── translationCache.ts
│   ├── utils/                       # Utilities
│   │   ├── logger.ts
│   │   ├── config.ts
│   │   ├── constants.ts
│   │   ├── retryHelper.ts
│   │   ├── languageDetector.ts
│   │   └── commentFormatter.ts
│   └── test/                        # Tests
│       ├── *.test.ts
│       └── assets/
├── docs/                            # Documentation
│   ├── ARCHITECTURE.md
│   └── CONTRIBUTING.md
├── package.json
├── tsconfig.json
└── README.md
```

For detailed architecture information, see [ARCHITECTURE.md](./ARCHITECTURE.md).

## Development Workflow

### 1. Create a Feature Branch

```bash
git checkout -b feature/your-feature-name
```

### 2. Make Code Changes

After making changes, it's helpful to enable auto-compilation:

```bash
npm run watch
```

This will automatically compile whenever you save a file.

### 3. Run Tests

```bash
npm test
```

Run a specific test file:

```bash
npm test -- --grep "LanguageDetector"
```

### 4. Debug the Extension

1. Open the project in VSCode
2. Press `F5` (or "Run" → "Start Debugging")
3. A new VSCode window will open with the extension loaded
4. Open a test Python/JS/TS/Go file to verify functionality

When debugging, it's helpful to use `src/utils/logger.ts` to output logs:

```typescript
import { logger } from './utils/logger';

logger.info('Info message');
logger.debug('Debug message');
logger.error('Error message', error);
```

Logs can be viewed in "View" → "Output" → "Doc Translate".

## Testing

### Test Structure

- **Unit Tests**: Unit tests for each component (87 tests)
  - `baseDetector.test.ts`: Common methods of BaseBlockDetector
  - `languageDetector.test.ts`: Language detection (10+ languages)
  - `commentFormatter.test.ts`: Language-specific formatting
  - `translationCache.test.ts`: Cache CRUD and persistence
  - `config.test.ts`: Configuration management

### Writing Tests

Place new tests in `src/test/`. Refer to existing tests:

```typescript
import * as assert from 'assert';
import { YourClass } from '../path/to/YourClass';

suite('YourClass Test Suite', () => {
    test('should do something', () => {
        const instance = new YourClass();
        const result = instance.method();
        assert.strictEqual(result, expectedValue);
    });
});
```

### Test Coverage

Please write tests for major components:
- New providers (e.g., anthropicProvider.ts)
- New detectors (e.g., pythonBlockDetector.ts)
- Utility functions (e.g., languageDetector.ts, commentFormatter.ts)

## CI/CD

### Continuous Integration

This project uses GitHub Actions for CI.

**CI Workflow** (`.github/workflows/ci.yml`):
- **Tests**: Run tests on Node.js 18.x and 20.x
- **Lint**: Check code quality with ESLint
- **Build**: Create extension package (.vsix)
- **TypeScript Check**: Check for type errors

### CI Execution Timing

- Push to `main` branch
- Create or update pull requests
- Manual execution (workflow_dispatch)

### Run the Same Checks Locally

It's recommended to run the same checks locally before pushing:

```bash
# Compile check
npm run compile

# Lint
npm run lint

# Tests
npm test

# TypeScript type check
npx tsc --noEmit

# Extension packaging (optional)
npx vsce package
```

### CI Status

Before merging a PR, ensure all CI checks pass:
- ✅ Test on Node.js 18.x
- ✅ Test on Node.js 20.x
- ✅ Lint Code
- ✅ Build Extension Package

CI status can be checked via the badge in the README:

[![CI](https://github.com/eycjur/vscode-extension-doc-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/eycjur/vscode-extension-doc-translate/actions/workflows/ci.yml)

## Coding Standards

### TypeScript

- **Indentation**: Tabs (follow project settings)
- **Naming Conventions**:
  - Classes: `PascalCase` (e.g., `AnthropicProvider`)
  - Methods/Variables: `camelCase` (e.g., `translateText`)
  - Constants: `UPPER_SNAKE_CASE` (e.g., `MAX_CONCURRENT_REQUESTS`)
  - Interfaces: `I` prefix (e.g., `ITranslationProvider`)
- **Types**: Explicitly type as much as possible
- **Async**: Use `async/await` (avoid Promise chains)

### Comments

- **JSDoc**: Always write JSDoc for public methods
- **Inline Comments**: Add explanatory comments for complex logic

Example:
```typescript
/**
 * Translate text from source language to target language
 * @param text - Text to translate
 * @param targetLang - Target language code (e.g., 'ja', 'en')
 * @returns Translated text
 */
async translate(text: string, targetLang: string): Promise<string> {
    // Implementation
}
```

### Error Handling

- Catch and handle expected errors appropriately
- Use `logger.notifyError()` or `logger.notifyCriticalError()` for user-facing errors
- Record debug information with `logger.debug()` or `logger.info()`

```typescript
try {
    const result = await riskyOperation();
} catch (error) {
    logger.error('Operation failed', error);
    logger.notifyError('Failed to process request');
    throw error;
}
```

## Adding New Features

### Supporting a New Programming Language

To support a new language (e.g., Rust):

#### 1. Create a Detector

Create `src/detectors/rustBlockDetector.ts`:

```typescript
import * as vscode from 'vscode';
import { BaseBlockDetector } from './base/baseDetector';
import { IBlockDetector, TextBlock } from './base/blockDetector';

export class RustBlockDetector extends BaseBlockDetector implements IBlockDetector {
    async extractBlock(
        document: vscode.TextDocument,
        position: vscode.Position
    ): Promise<TextBlock | null> {
        // Implement Rust-specific detection logic
        // 1. Get symbols from LSP
        const symbols = await this.getSymbolsFromLSP(document);
        if (!symbols) {
            return null;
        }

        // 2. Find symbol at cursor position
        const symbol = this.findSymbolAtPosition(symbols, position);
        if (!symbol) {
            return null;
        }

        // 3. Extract documentation comments
        // For Rust: /// or //! comments
        // Implementation...
    }

    async extractAllBlocks(document: vscode.TextDocument): Promise<TextBlock[]> {
        const blocks: TextBlock[] = [];

        // 1. Get symbols from LSP
        const symbols = await this.getSymbolsFromLSP(document);
        if (!symbols) {
            return blocks;
        }

        // 2. Extract documentation comments from all symbols
        // Implementation...

        // 3. Extract inline comments
        // Implementation...

        // 4. Remove duplicates
        return this.deduplicateBlocks(blocks);
    }
}
```

#### 2. Register in Factory

Add to `src/detectors/blockDetectorFactory.ts`:

```typescript
import { RustBlockDetector } from './rustBlockDetector';

export class BlockDetectorFactory {
    private static detectorCache: Map<string, IBlockDetector> = new Map();

    static getDetector(languageId: string): IBlockDetector | null {
        // ...existing code...

        switch (languageId) {
            // ...existing cases...
            case 'rust':
                detector = new RustBlockDetector();
                break;
            // ...
        }
    }

    static isLanguageSupported(languageId: string): boolean {
        const supportedLanguages = ConfigManager.getSupportedLanguages();
        return supportedLanguages.includes(languageId);
    }
}
```

#### 3. Add Comment Format

Add to `src/utils/commentFormatter.ts`:

```typescript
export function getCommentFormat(languageId: string): CommentFormat {
    switch (languageId) {
        // ...existing cases...
        case 'rust':
            return {
                docstringOpen: '///',
                docstringClose: '',
                lineComment: '//',
                multiLineCommentOpen: '/*',
                multiLineCommentClose: '*/'
            };
        // ...
    }
}
```

#### 4. Update Configuration

Add to `package.json` `configuration`:

```json
{
    "docTranslate.supportedLanguages": {
        "type": "array",
        "default": ["python", "javascript", "typescript", "go", "rust"],
        "description": "Programming languages to translate"
    }
}
```

#### 5. Add Tests

Create `src/test/rustBlockDetector.test.ts` and add tests.

#### 6. Create Sample File

Create `src/test/assets/sample.rs` and add sample code for testing.

### Supporting a New LLM Provider

To support a new LLM (e.g., Cohere):

#### 1. Create Provider

Create `src/providers/cohereProvider.ts`:

```typescript
import { BaseProvider } from './base/baseProvider';
import { ITranslationProvider } from './base/translationProvider';
import { logger } from '../utils/logger';
import { withRetry } from '../utils/retryHelper';
import { ConfigManager } from '../utils/config';

export class CohereProvider extends BaseProvider implements ITranslationProvider {
    private client: any | null = null;

    constructor() {
        super();
        this.initializeClient();
    }

    private async initializeClient(): Promise<void> {
        const apiKey = ConfigManager.getCohereApiKey();
        if (apiKey) {
            // Import and initialize Cohere SDK
            const { CohereClient } = await import('cohere-ai');
            this.client = new CohereClient({ apiKey });
            logger.info('Cohere client initialized successfully');
        } else {
            logger.warn('No Cohere API key found. Client not initialized.');
        }
    }

    async translate(text: string, targetLang: string): Promise<string> {
        logger.info(`Cohere translation request received`);

        // Check if translation is needed (BaseProvider method)
        const skipResult = await this.checkTranslationNeeded(text, targetLang);
        if (skipResult !== null) {
            return skipResult;
        }

        if (!this.client) {
            const errorMsg = 'Cohere API key not configured...';
            logger.notifyCriticalError(errorMsg);
            throw new Error(errorMsg);
        }

        // Build prompt (BaseProvider method)
        const prompt = this.buildPrompt(text, targetLang);
        const timeout = ConfigManager.getTimeout();
        const retryConfig = ConfigManager.getRetryConfig();

        try {
            const translation = await withRetry(
                async () => {
                    const response = await this.client.chat({
                        message: prompt,
                        // Cohere-specific settings
                    });
                    return response.text.trim();
                },
                retryConfig,
                'Cohere translation'
            );

            return translation;
        } catch (error: any) {
            logger.notifyError(`Translation failed: ${error.message}`);
            throw error;
        }
    }

    updateConfiguration(): void {
        logger.info('Configuration changed, re-initializing Cohere client');
        this.initializeClient();
    }
}
```

#### 2. Register in Factory

Add to `src/providers/translationProviderFactory.ts`:

```typescript
import { CohereProvider } from './cohereProvider';

export class TranslationProviderFactory {
    private static providerCache: ITranslationProvider | null = null;
    private static currentProvider: LLMProvider | null = null;

    static getProvider(): ITranslationProvider {
        const provider = ConfigManager.getProvider();

        // ...existing code...

        let instance: ITranslationProvider;
        switch (provider) {
            // ...existing cases...
            case 'cohere':
                instance = new CohereProvider();
                break;
            default:
                // ...
        }
    }
}
```

#### 3. Add Configuration

Add to `package.json`:

```json
{
    "configuration": {
        "properties": {
            "docTranslate.provider": {
                "type": "string",
                "enum": ["anthropic", "openai", "gemini", "cohere"],
                "default": "anthropic"
            },
            "docTranslate.cohereApiKey": {
                "type": "string",
                "default": "",
                "description": "Cohere API key"
            },
            "docTranslate.cohereModel": {
                "type": "string",
                "default": "command-r-plus",
                "description": "Cohere model to use"
            }
        }
    }
}
```

#### 4. Update ConfigManager

Add to `src/utils/config.ts`:

```typescript
export class ConfigManager {
    // ...existing code...

    static getCohereApiKey(): string | undefined {
        return process.env.COHERE_API_KEY || this.getConfig<string>('cohereApiKey');
    }

    static getCohereModel(): string {
        return this.getConfig<string>('cohereModel') || DEFAULT_CONFIG.COHERE_MODEL;
    }
}
```

Add to `src/utils/constants.ts`:

```typescript
export const DEFAULT_CONFIG = {
    // ...existing...
    COHERE_MODEL: 'command-r-plus',
};
```

#### 5. Update Type Definitions

Add to provider type:

```typescript
export type LLMProvider = 'anthropic' | 'openai' | 'gemini' | 'cohere';
```

#### 6. Add Tests

Create `src/test/cohereProvider.test.ts`.

## Debugging

### Using Logs

Record debug information in logs:

```typescript
logger.debug('Detailed debug info', { variable1, variable2 });
logger.info('General information');
logger.warn('Warning message');
logger.error('Error message', error);
```

Logs can be viewed in "View" → "Output" → "Doc Translate".

### Breakpoints

1. Set breakpoints in VSCode
2. Press `F5` to start debugging
3. Use the extension in the new window
4. Stop at breakpoints and inspect variables

### Troubleshooting Issues

#### Translations Not Displaying

1. Check logs ("Doc Translate: Show Logs" command)
2. Verify API keys are configured correctly
3. Verify LSP is working correctly (check if language extensions are installed)

#### Performance is Slow

1. Verify cache is working correctly
2. Adjust concurrent request count (`MAX_CONCURRENT_REQUESTS`)
3. Check timeout settings

## Release Process

### 1. Update Version

Update version in `package.json`:

```json
{
    "version": "0.5.2"
}
```

### 2. Update CHANGELOG

Add the new version to the release notes section in `CHANGELOG.md`.

### 3. Commit

```bash
git add .
git commit -m "Bump version to 0.5.2"
git tag v0.5.2
git push origin main --tags
```

### 4. Package

```bash
vsce package
```

### 5. Publish

Publish to VSCode Marketplace:

```bash
vsce publish
```

## Questions & Support

- **Issues**: Report questions or issues in GitHub Issues
- **Discussions**: Feature proposals and general discussions in Discussions
- **Documentation**: Check [ARCHITECTURE.md](./ARCHITECTURE.md) for detailed architecture information

---

Thank you for contributing! 🎉
