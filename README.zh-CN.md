# Doc Translate

[![CI](https://github.com/eycjur/vscode-extension-doc-translate/actions/workflows/ci.yml/badge.svg)](https://github.com/eycjur/vscode-extension-doc-translate/actions/workflows/ci.yml)

使用多种 LLM（Claude, OpenAI, Gemini, Azure OpenAI）翻译代码文档字符串和注释的 VSCode 扩展。

**[English README](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/README.md)** | **[日本語 README](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/README.ja.md)**

## 功能

- **支持多种 LLM 提供商**: Anthropic Claude、OpenAI、Google Gemini、Azure OpenAI
- **支持多种编程语言**: Python、JavaScript、TypeScript、Go、Markdown
- **内联翻译显示**: 直接在代码中显示翻译（注释在右侧，文档字符串为覆盖层）
- **自动翻译**: 文件打开/保存时使用智能缓存和批处理自动翻译
- **语言检测**: 如果文本已经是目标语言则自动跳过
- **持久化缓存**: 跨会话保存翻译以最小化 API 调用
- **错误处理**: 非侵入式通知和重试选项
- **可配置**: 支持环境变量和 VSCode 设置

## 文档

- [架构](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/docs/ARCHITECTURE.md) - 系统架构详情
- [开发指南](https://github.com/eycjur/vscode-extension-doc-translate/blob/main/docs/CONTRIBUTING.md) - 开发者指南

## 必要条件

- **LLM API 密钥**: 需要以下任一 LLM 提供商的 API 密钥
  - **Anthropic Claude**: `ANTHROPIC_API_KEY` 环境变量，或 `docTranslate.anthropicApiKey` 设置
  - **OpenAI**: `OPENAI_API_KEY` 环境变量，或 `docTranslate.openaiApiKey` 设置
  - **Google Gemini**: `GEMINI_API_KEY` 环境变量，或 `docTranslate.geminiApiKey` 设置
- **语言扩展**: 需要各语言的 LSP 支持
  - **Python**: Python 扩展（带 Pylance）
  - **JavaScript/TypeScript**: 通常 VSCode 内置支持
  - **Go**: Go 扩展

## 扩展设置

本扩展提供以下设置项：

### 基本设置
* `docTranslate.provider`: 使用的 LLM 提供商（`anthropic`、`openai`、`gemini`，默认: `anthropic`）
* `docTranslate.targetLang`: 目标语言代码（默认: `ja`）
  - 源语言自动检测
  - 支持语言: `en`, `ja`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru` 等
* `docTranslate.supportedLanguages`: 翻译对象的编程语言（默认: `["python", "javascript", "typescript", "go"]`）
* `docTranslate.exclude`: 排除翻译的 glob 模式（工作区相对路径或文件名，例如：`docs/**/*.md`, `*.md`）
* `docTranslate.timeout`: API 请求超时（毫秒，默认: `30000`）
* `docTranslate.maxRetries`: 最大重试次数（默认: `3`）
* `docTranslate.retryInitialDelay`: 重试初始延迟（毫秒，默认: `1000`）

### Anthropic Claude 设置
* `docTranslate.anthropicApiKey`: Anthropic API 密钥（优先使用 `ANTHROPIC_API_KEY` 环境变量）
* `docTranslate.model`: 使用的 Claude 模型（默认: `claude-haiku-4-5-20251001`）

### OpenAI 设置
* `docTranslate.openaiApiKey`: OpenAI API 密钥（优先使用 `OPENAI_API_KEY` 环境变量）
* `docTranslate.openaiModel`: 使用的 OpenAI 模型（默认: `gpt-4o-mini`）

### Google Gemini 设置
* `docTranslate.geminiApiKey`: Gemini API 密钥（优先使用 `GEMINI_API_KEY` 环境变量）
* `docTranslate.geminiModel`: 使用的 Gemini 模型（默认: `gemini-2.0-flash-exp`）

## 使用方法

1. 设置 LLM 提供商和 API 密钥:
   - 在 VSCode 设置中选择 `docTranslate.provider`（`anthropic`、`openai`、`gemini`）
   - 设置所选提供商的 API 密钥:
     - **Anthropic**: 环境变量 `ANTHROPIC_API_KEY` 或设置 `docTranslate.anthropicApiKey`
     - **OpenAI**: 环境变量 `OPENAI_API_KEY` 或设置 `docTranslate.openaiApiKey`
     - **Gemini**: 环境变量 `GEMINI_API_KEY` 或设置 `docTranslate.geminiApiKey`

2. 设置目标语言（可选）:
   - `docTranslate.targetLang`: 目标语言（默认: `ja`）
   - 源语言自动检测（使用 franc 库）
   - 相同语言自动跳过
   - 支持语言: `en`, `ja`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru` 等

3. 打开支持语言的文件（Python、JavaScript、TypeScript、Go）
   - 扩展自动在后台开始翻译所有文档字符串和注释
   - 状态栏查看进度: `$(sync~spin) Translating X/Y blocks...`
   - 完成时: `$(check) Translated X blocks`

4. 查看翻译
   - **注释**: 在每行右侧显示翻译
     - Python: `# This is a comment → 这是注释`
     - JavaScript/TypeScript/Go: `// This is a comment → 这是注释`
   - **Docstring/JSDoc**: 隐藏原文，覆盖显示翻译
   - 无需悬停，常驻显示
   - 原始代码不被修改（仅视觉效果）

5. 编辑并保存文件
   - 保存文件时自动重新翻译
   - 利用缓存，未修改部分处理迅速

## 测试用示例文件

`src/test/assets/` 中提供了用于确认扩展行为的示例文件：

- **`sample.py`**: Python 示例代码（docstring、内联注释）
- **`sample.ts`**: TypeScript 示例代码（JSDoc、多行注释、单行注释）
- **`sample.js`**: JavaScript 示例代码（JSDoc、多行注释、单行注释）
- **`sample.go`**: Go 示例代码（godoc、package doc、多行/单行注释）

打开这些文件，扩展将自动翻译注释和文档字符串并内联显示。
这些文件也作为测试代码引用的资产配置。

## 命令

* `Doc Translate: Clear Translation Cache`: 清除翻译缓存和预翻译缓存（下次打开文件时重新翻译）
* `Doc Translate: Show Logs`: 打开显示详细日志的输出通道

## 调试

要显示详细日志：

1. 打开命令面板（`Cmd+Shift+P` 或 `Ctrl+Shift+P`）
2. 执行 `Doc Translate: Show Logs`
3. "Doc Translate" 输出通道将显示以下详细日志：
   - 扩展启动状态
   - API 密钥检测
   - 预翻译进度（打开文件时）
   - LSP 符号查询和结果
   - LSP 文档字符串检测
   - 翻译请求和响应
   - 缓存命中/未命中
   - 错误详情

或者，也可以手动打开输出面板：
- 视图 → 输出 → 下拉菜单选择 "Doc Translate"

## 已知问题

目前没有。

## 发布说明

详细变更记录请参阅 [CHANGELOG.md](./CHANGELOG.md)。
