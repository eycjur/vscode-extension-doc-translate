# Changelog

All notable changes to the "doc-translate" extension will be documented in this file.

## [1.1.0] - 2025-12-08

### ✨ New Features
- **Azure OpenAI Support**: Added enterprise-grade Azure OpenAI provider
  - Custom endpoint, API version, and deployment name configuration
  - Environment variable support: `AZURE_OPENAI_API_KEY` and `AZURE_OPENAI_ENDPOINT`
- **Automated Release Workflow**: Automated marketplace publishing via GitHub Actions
  - Automatic version detection and publishing to VS Code Marketplace & Open VSX Registry
  - Auto-generation of GitHub Releases with VSIX artifact uploads
- **Markdown File Translation**: Full support for `.md` file translation
  - Preserves structure (lists, quotes, code blocks, etc.)
  - Maintains front matter metadata
  - Correctly handles multi-line HTML comments
  - **Example**: Translate documentation files
    ```markdown
    <!-- English version -->
    # User Guide
    ## Installation
    Run the following command to install...

    <!-- After translation to Japanese -->
    # ユーザーガイド
    ## インストール
    次のコマンドを実行してインストールします...
    ```
- **Batch Translation**: Optimized API requests by translating multiple blocks in a single call
  - Reduces API costs and improves performance
  - JSON array-based strategy for all providers
- **Debounce Processing**: 500ms delay after user stops typing before translation starts
  - Prevents excessive API calls during active editing
- **Smart Cache**: Separate cache per `targetLang` for seamless language switching
  - Enables quick switching between translation targets without re-translation

### 🔧 Improvements & Fixes
- **Provider Architecture Refactoring**: Major code structure improvements
  - **Azure OpenAI Inheritance**: AzureOpenAIProvider now extends OpenAIProvider instead of BaseProvider
    - Reduced from 155 lines to 47 lines (108 lines eliminated, -70% code)
    - Shares all translation logic via Template Method pattern
    - Overrides only initialization and configuration methods
  - **Removed Redundant Interface**: Eliminated `ITranslationProvider` interface
    - BaseProvider abstract class serves as both contract and shared implementation
    - Simplified architecture with single source of truth
  - **Template Method Pattern**: OpenAIProvider now provides protected hook methods
    - `getProviderName()`, `getModel()`, `getApiKeyMissingError()`, `getSettingsKey()`
    - Enables clean inheritance and customization
- **Skip Symbol-Only Text**: Skips translation for text containing only symbols/punctuation (no alphanumeric or CJK characters)
  - Reduces unnecessary API calls for decorative separators like `========`
- **BaseProvider Refactoring**: Unified symbol checking logic in base class (`checkTranslationNeeded`)
  - Eliminates code duplication across all providers
- **Multi-Language Documentation**: English README.md, Japanese README.ja.md, Chinese README.zh-CN.md
- **Marketplace Links**: Added badges and links for VS Code Marketplace and Open VSX Registry
- **Indent Preservation**: Improved algorithm to correctly preserve original indentation after translation
- **Dependency Cleanup**: Removed unused `p-limit` dependency to reduce VSIX size

### 📝 Documentation
- **CHANGELOG Internationalization**: Converted CHANGELOG.md to English with comprehensive examples
  - Added Markdown translation example in 1.1.0 release notes
  - Standardized format following [Keep a Changelog](https://keepachangelog.com/) conventions
- Unified all documentation links to GitHub absolute URLs (from relative paths)
- Added Azure OpenAI configuration section
- Added marketplace links in Installation section
- Multi-language localization: package.nls.*.json, l10n/bundle.l10n.*.json

## [1.0.0]

🎉 **Official Release** - Production-ready quality achieved.

### Core Features
- ✅ **Multi-LLM Support**: Claude, OpenAI, Gemini (3 providers)
- ✅ **Multi-Language Support**: Python, JavaScript, TypeScript, Go (4 languages)
- ✅ **Automatic Language Detection**: Auto-detect source language using franc library
- ✅ **Inline Translation Display**: Always visible without hover, persists during editing
- ✅ **Persistent Cache**: Minimizes API calls, survives restarts
- ✅ **Error Handling**: Detailed error notifications with retry mechanisms
- ✅ **Parallel Translation**: Up to 5 concurrent requests with progressive translation
- ✅ **CI/CD**: Continuous integration via GitHub Actions

### Quality Assurance
- 90 unit tests covering core components
- Comprehensive documentation (ARCHITECTURE.md, CONTRIBUTING.md)
- Architecture diagrams with Mermaid
- Full TypeScript type safety implementation

### Developer Experience
- Organized directory structure (providers/, detectors/, services/, utils/)
- Extensibility via Factory Pattern and Template Method Pattern
- Centralized configuration management with ConfigManager
- Detailed logging and debugging capabilities

### User Experience
- Non-intrusive error notifications (dialog/status bar)
- Spam prevention (60-second cooldown)
- Progress indication in status bar with tooltip
- Retry options on translation failures

This version is stable and suitable for production use.

## [0.5.1]

Bug fixes and performance improvements:
- Adjusted translation display margins for better readability
- Added error notification system
  - Critical errors: Dialog display
  - Normal errors: Status bar display (auto-dismiss)
  - Spam prevention (60-second cooldown)
- Improved translation display on file open
  - Instant restoration from cache
  - Reliable display on tab switching
- Translation display persists during editing (no longer disappears on edit)
- Simplified translation logic (cache-based)

## [0.5.0]

Major update - Automatic language detection & refactoring:
- **Automatic Language Detection**: Auto-detect source language using franc library
- **Language-Specific Formatting**: Python `"""`, JS/TS `/** */`, Go `/* */`
- **Progressive Translation**: Display blocks as they complete translation
- **Code Refactoring**:
  - Organized directory structure (providers/, detectors/, services/, utils/)
  - Shared logic via BaseProvider/BaseDetector
  - Centralized configuration with ConfigManager
  - Reduced code duplication (-245 lines)
- **Comprehensive Testing**: Added 87 unit tests

## [0.4.0] - 2025-01-08

### Added
- **Multiple LLM Provider Support**: Choose between Anthropic Claude, OpenAI, and Google Gemini
  - Per-provider API authentication and model configuration
  - Highly extensible implementation using Factory Pattern
- **Multiple Programming Language Support**: Python, JavaScript, TypeScript, Go
  - JavaScript/TypeScript: JSDoc, multi-line comments (`/* */`), single-line comments (`//`)
  - Go: godoc, package doc, multi-line comments, single-line comments
  - Language-optimized block detectors
- **Flexible Translation Language Configuration**: Free configuration of source and target languages
  - Supported languages: en, ja, zh, ko, fr, de, es, it, pt, ru
  - Multi-language prompt templates

### Changed
- Enhanced extensibility through provider abstraction
- Block detector abstraction and factory pattern implementation
- Improved LSP integration for each language

### Technical Improvements
- Introduced `ITranslationProvider` interface
- Introduced `IBlockDetector` interface
- Factory pattern-based management of providers and block detectors

## [0.3.0] - 2025-01-08

### Added
- **Inline Translation Display**: Always visible without hover
  - Comments (`#`): Translation shown on right side of each line
  - Docstrings (`"""`/`'''`): Original text hidden, translation overlayed
- **Multi-Line Translation Display**: Properly formatted multi-line docstring translations
- **Persistent Cache**: Cache persisted using VSCode globalState
- **Parallel Translation**: Up to 5 concurrent requests for rate limit handling
- **Original Text on Cursor/Selection**: Hide translation when cursor or selection is in docstring block
- **Module Docstring Support**: Translate top-level file docstrings
- **Auto Re-translation on Save**: Fast re-translation using cache
- **Pre-Translation Service**: Automatically translate Python files in background on open

### Changed
- Switched model to Claude Haiku 4.5 (20251001)
- Use only LSP-based docstring detection (removed comment detection logic)
- Removed hover provider (replaced with inline display)

### Fixed
- Fixed indentation issues in docstring translation
- Fixed mixed display of original and translated text

## [0.1.0] - 2025-01-08

### Added
- LSP-based docstring detection using Pylance
- Hover provider for Python docstrings and comments
- Claude API integration (Claude 4.5 Sonnet)
- Translation caching system
- Status bar loading indicator
- Comprehensive debug logging
- Support for unsaved Python files (untitled scheme)
- Commands: Clear cache, Show logs

### Features
- Detects and translates:
  - Multi-line docstrings (`"""` and `'''`)
  - Comment blocks (consecutive `#` lines)
  - Inline comments
- Configuration via environment variables and settings.json
- Configurable model, API key, and timeout

## [Unreleased]

- Initial release
