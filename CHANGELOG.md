# Change Log

All notable changes to the "doc-translate" extension will be documented in this file.

## [0.1.0] - 2025-01-08

### Added
- LSP-based docstring detection using Pylance
- Hover provider for Python docstrings and comments
- Claude API integration (Claude 4.5 Sonnet)
- Translation caching system
- Loading indicator in status bar
- Comprehensive debug logging
- Support for unsaved Python files (untitled scheme)
- Commands: Clear Cache, Show Logs

### Features
- Detects and translates:
  - Multi-line docstrings (`"""` and `'''`)
  - Comment blocks (consecutive `#` lines)
  - Inline comments
- Environment variable and settings.json configuration
- Configurable model, API key, and timeout

## [Unreleased]

- Initial release