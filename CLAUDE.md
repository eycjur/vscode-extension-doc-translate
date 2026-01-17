# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリのコードを扱う際のガイダンスを提供します。

## プロジェクト概要

複数のLLM（Claude, OpenAI, Gemini, Azure OpenAI）を使用してdocstringとコメントを翻訳するVSCode拡張機能です。Python、JavaScript、TypeScript、Go、Markdownに対応し、2種類のインライン表示方式で翻訳を提供します。

**対象ユースケース:** 新人オンボーディング、コードレビュー、生産性向上

## プロジェクトステータス

v1.0.3 - プロダクションレディ。マルチLLM（Azure OpenAI含む4プロバイダー）・マルチ言語対応、自動言語検出、エラーハンドリング、自動リリースCI/CD、包括的なドキュメントを含む安定版

## アーキテクチャ

### コアコンポーネント

- **UI**: 2種類のインライン翻訳表示
  - **コメント**: 行の右側に表示（Virtual Text方式）
  - **Docstring**: 元のテキストを隠して翻訳を上書き表示（Overlay方式）
- **対象言語**: Python、JavaScript、TypeScript、Go、Markdown
- **翻訳方向**: 自動検出（francライブラリ） → 設定した言語（10言語以上対応）
- **翻訳対象**:
  - Python: docstring（`"""`と`'''`）、インラインコメント（`#`）
  - JavaScript/TypeScript: JSDoc（`/** */`）、コメント（`//`, `/* */`）
  - Go: godoc（`/* */`）、コメント（`//`, `/* */`）
  - Markdown: ヘッダー、段落、リスト、引用（コードブロック・HTMLコメント・画像は除外）
- **翻訳エンジン**: 選択可能な4つのLLMプロバイダー
  - Anthropic Claude（デフォルト: Claude Haiku 4.5）
  - OpenAI（デフォルト: GPT-4o-mini）
  - Google Gemini（デフォルト: Gemini 2.0 Flash）
  - Azure OpenAI（エンタープライズ向け、カスタムエンドポイント対応）
- **検出方法**: LSP（Language Server Protocol）でdocstringを検出、正規表現でコメントを検出
  - Python: Pylance
  - JavaScript/TypeScript: TypeScript Language Server
  - Go: gopls
- **翻訳タイミング**: ファイルを開いた時・保存した時・タブ切り替え時に全翻訳をバックグラウンド実行（キャッシュベース）

### 翻訳ポリシー

- 技術用語・関数名・クラス名・ライブラリ名はそのまま保持
- 直訳ではなく「自然な」翻訳先言語に寄せる
- 翻訳テキストのみを出力（説明不要）
- 元のコメントと同じ言語の場合は翻訳をスキップ
- 記号のみのテキスト（英数字・CJK文字を含まない）は翻訳をスキップ

### 主要機能

1. **自動言語検出**
   - francライブラリで翻訳元言語を自動検出
   - 翻訳先と同じ言語の場合は翻訳をスキップ（API呼び出しを節約）
   - ISO 639-3形式からISO 639-1形式への変換対応

2. **言語固有のフォーマット**
   - Python: `"""docstring"""`形式
   - JavaScript/TypeScript: `/** JSDoc */`形式
   - Go: `/* godoc */`形式
   - 各言語の慣習に合わせた自然な表示

3. **LSPベースのdocstring検出**
   - `vscode.executeDocumentSymbolProvider` でシンボル情報取得
   - モジュール、クラス、関数、メソッドのdocstringを抽出
   - 各言語のLSP（Pylance, TypeScript Language Server, gopls）を活用

4. **正規表現ベースのコメント検出**
   - 文字列内のコメント記号を除外して正確に検出
   - 各行のインラインコメントを抽出
   - 複数行コメントにも対応

5. **バックグラウンド事前翻訳**
   - ファイルオープン・保存・タブ切り替え時に全docstringとコメントを自動翻訳
   - **キャッシュベース**: キャッシュがあればAPI呼び出しなし、なければ翻訳
   - **グローバル並列翻訳**: 全ファイルで共有するセマフォで並列リクエスト数を制御（デフォルト: 10、設定で変更可能）
   - **Progressive translation**: 翻訳完了したブロックから順次表示
   - ステータスバーに進捗表示
   - キャッシュに保存

6. **2種類のインライン翻訳表示**
   - **コメント**: `TextEditorDecorationType` の `after` プロパティで行の右側に表示
   - **Docstring**: `opacity: 0` で元のテキストを隠し、`before` で翻訳を上書き表示
   - **カーソル・選択時の原文表示**: テキスト選択イベントを監視し、カーソル位置または選択範囲と重なるdocstring decorationを自動的に除外
   - 半透明の斜体でグレーアウト表示
   - 常時表示、ホバー不要
   - ファイルは変更されない（見た目のみ）
   - 編集中も翻訳表示を保持

7. **永続化翻訳キャッシュ**
   - メモリ内ハッシュマップ（SHA-256）でキャッシュ
   - VSCodeの`globalState`に自動保存（永続化）
   - 拡張機能を再起動しても翻訳結果が保持される
   - `set()`時に自動的にディスクに保存
   - 起動時に自動的にロード
   - 保存時は変更されていない部分はキャッシュを活用

8. **エラー通知システム**
   - **Critical Error**: ダイアログで表示（APIキー未設定など）
   - **Error**: ステータスバーで表示（タイムアウト、翻訳失敗など）
   - **Warning**: ステータスバーで表示
   - スパム防止機能（同じエラーは60秒に1回のみ）
   - ログ表示へのクイックアクセス

9. **バッチ翻訳**
   - 複数のブロックをまとめて1回のAPIリクエストで翻訳（API呼び出し最適化）
   - 各プロバイダーで`translateBatch()`メソッドを実装
   - JSON配列形式でリクエスト・レスポンスを処理
   - エラー時はシーケンシャル翻訳にフォールバック

10. **Debounce処理**
    - ユーザー入力停止後500ms待機してから翻訳を開始
    - 編集中の不要な翻訳リクエストを防止
    - パフォーマンス向上とAPI呼び出し削減

11. **スマートキャッシュ（targetLang別）**
    - キャッシュキーに`targetLang`を含めて言語別にキャッシュを分離
    - 翻訳先言語を切り替えても正しい翻訳を取得
    - SHA-256ハッシュベースのキー生成

12. **インデント保持**
    - 翻訳後のテキストが元のインデントを正しく保持
    - Markdown、Python、JavaScript/TypeScript、Goで動作
    - InlineTranslationProviderでインデント計算を実装

13. **記号のみテキストのスキップ**
    - 英数字・CJK文字（中国語・日本語・韓国語）を含まないテキストは翻訳をスキップ
    - 無駄なAPI呼び出しを削減してコストを節約
    - BaseProviderの`checkTranslationNeeded()`内で`isSymbolOnly()`を実行

## ファイル構成

拡張機能は以下のディレクトリ構造で整理されています：

### `src/`（エントリーポイント）
- `extension.ts` - 拡張機能のエントリーポイント、イベントハンドラー登録

### `src/providers/`（翻訳プロバイダー）
- `base/`
  - `baseProvider.ts` - 抽象基底クラス（プロンプト構築、言語検出、記号チェック、translate/translateBatchの契約定義）
- `anthropicProvider.ts` - Anthropic Claude API クライアント
- `openaiProvider.ts` - OpenAI API クライアント
- `geminiProvider.ts` - Google Gemini API クライアント
- `azureOpenaiProvider.ts` - Azure OpenAI API クライアント
- `translationProviderFactory.ts` - プロバイダー選択のファクトリー

### `src/detectors/`（ブロック検出）
- `base/`
  - `blockDetector.ts` - IBlockDetectorインターフェース定義
  - `baseDetector.ts` - 共通ロジック（LSPクエリ、シンボル検索、重複排除）
- `pythonBlockDetector.ts` - Python用ブロック検出（Pylance連携）
- `javascriptBlockDetector.ts` - JavaScript/TypeScript用ブロック検出
- `goBlockDetector.ts` - Go用ブロック検出
- `markdownBlockDetector.ts` - Markdown用ブロック検出（ヘッダー、段落、リスト、引用）
- `blockDetectorFactory.ts` - 検出器選択のファクトリー

### `src/services/`（コアサービス）
- `preTranslationService.ts` - バックグラウンド事前翻訳サービス
- `inlineTranslationProvider.ts` - インライン翻訳表示プロバイダー（2種類のdecoration実装）
- `translationCache.ts` - 翻訳キャッシュ（SHA-256ハッシュベース）

### `src/utils/`（ユーティリティ）
- `logger.ts` - ログ出力・エラー通知システム
- `config.ts` - 設定管理（ConfigManager）
- `constants.ts` - 定数定義（言語名マッピング、デフォルト設定）
- `retryHelper.ts` - リトライロジック（指数バックオフ）
- `languageDetector.ts` - 言語検出（francライブラリ統合）
- `commentFormatter.ts` - 言語固有のコメントフォーマット
- `globalSemaphore.ts` - グローバルなAPIリクエスト並行数制限（セマフォ実装）

### `src/test/`（テストコード）
- 87個のユニットテスト（baseDetector, languageDetector, commentFormatter, translationCache, config）
- `assets/` - テスト用サンプルファイル（Python, TypeScript, JavaScript, Go）

### `docs/`（ドキュメント）
- `ARCHITECTURE.md` - システムアーキテクチャの詳細
- `CONTRIBUTING.md` - 開発者ガイド

### `.github/workflows/`（CI/CD）
- `ci.yml` - 継続的インテグレーション（テスト、ビルド）
- `release.yml` - 自動リリース（VS Code Marketplace & Open VSX Registry）

### 多言語化ファイル
- `package.nls.json` - パッケージ説明の英語翻訳
- `package.nls.ja.json` - パッケージ説明の日本語翻訳
- `package.nls.zh-cn.json` - パッケージ説明の中国語翻訳
- `l10n/bundle.l10n.json` - UI文字列の英語翻訳
- `l10n/bundle.l10n.ja.json` - UI文字列の日本語翻訳
- `l10n/bundle.l10n.zh-cn.json` - UI文字列の中国語翻訳
- `README.md` - 英語版README
- `README.ja.md` - 日本語版README
- `README.zh-CN.md` - 中国語版README

## アーキテクチャ設計原則

### 1. Factory Pattern
- `TranslationProviderFactory`: LLMプロバイダーの選択・キャッシング
- `BlockDetectorFactory`: 言語ごとの検出器の選択・サポート言語チェック

### 2. Template Method Pattern
- `BaseProvider`: 共通の翻訳ロジック（プロンプト構築、言語検出チェック）
- `BaseBlockDetector`: 共通の検出ロジック（LSPクエリ、シンボル検索、重複排除）

### 3. Dependency Injection
- `ConfigManager`: 設定の一元管理、散在していた`vscode.workspace.getConfiguration()`呼び出しを集約

### 4. Cache-First Strategy
- 常にキャッシュをチェック、存在すれば即座に返却
- API呼び出しは最小限に抑える

## 設定

### 基本設定
- `docTranslate.provider` - 使用するLLMプロバイダー（`anthropic`、`openai`、`gemini`、`azure-openai`、デフォルト: `anthropic`）
- `docTranslate.targetLang` - 翻訳先の言語コード（デフォルト: `ja`）
  - 翻訳元言語は自動検出されます
  - 対応言語: `en`, `ja`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru` など
- `docTranslate.supportedLanguages` - 翻訳対象のプログラミング言語（デフォルト: `["python", "javascript", "typescript", "go"]`）
- `docTranslate.timeout` - APIリクエストのタイムアウト（ミリ秒、デフォルト: `30000`）
- `docTranslate.maxRetries` - 最大リトライ回数（デフォルト: `3`）
- `docTranslate.retryInitialDelay` - リトライ初期遅延（ミリ秒、デフォルト: `1000`）
- `docTranslate.maxConcurrentRequests` - 全ファイルで同時に実行するAPIリクエストの最大数（デフォルト: `10`、範囲: 1-50）
  - 複数ファイルを同時に開いても、この設定値を超えるAPIリクエストは同時に実行されません
  - レート制限を防ぐために使用します

### Anthropic Claude設定
- `docTranslate.anthropicApiKey` - Anthropic APIキー（環境変数 `ANTHROPIC_API_KEY` が優先）
- `docTranslate.model` - 使用するClaudeモデル（デフォルト: `claude-haiku-4-5-20251001`）

### OpenAI設定
- `docTranslate.openaiApiKey` - OpenAI APIキー（環境変数 `OPENAI_API_KEY` が優先）
- `docTranslate.openaiModel` - 使用するOpenAIモデル（デフォルト: `gpt-4o-mini`）

### Google Gemini設定
- `docTranslate.geminiApiKey` - Gemini APIキー（環境変数 `GEMINI_API_KEY` が優先）
- `docTranslate.geminiModel` - 使用するGeminiモデル（デフォルト: `gemini-2.0-flash-exp`）

### Azure OpenAI設定
- `docTranslate.azureOpenaiApiKey` - Azure OpenAI APIキー（環境変数 `AZURE_OPENAI_API_KEY` が優先）
- `docTranslate.azureOpenaiEndpoint` - Azure OpenAI エンドポイントURL（環境変数 `AZURE_OPENAI_ENDPOINT` が優先）
- `docTranslate.azureOpenaiApiVersion` - Azure OpenAI APIバージョン（デフォルト: `2024-02-15-preview`）
- `docTranslate.azureOpenaiDeploymentName` - Azure OpenAI デプロイメント名（デフォルト: `gpt-4o-mini`）

## 開発

### セットアップ

```bash
# 依存関係インストール
npm install

# コンパイル
npm run compile

# 自動コンパイル（開発時）
npm run watch

# テスト実行
npm test

# 拡張機能をデバッグ
F5キーを押す
```

### テスト

87個のユニットテストで主要コンポーネントをカバー：
- `baseDetector.test.ts` - BaseBlockDetectorの共通メソッド（10テスト）
- `languageDetector.test.ts` - 言語検出（17テスト、10言語以上）
- `commentFormatter.test.ts` - 言語固有フォーマット（21テスト、Python/JS/TS/Go）
- `translationCache.test.ts` - キャッシュCRUD・永続化（19テスト）
- `config.test.ts` - 設定管理（13テスト）

### 新機能追加ガイド

詳細は `docs/CONTRIBUTING.md` を参照してください。

#### 新しいプログラミング言語のサポート追加

1. `src/detectors/` に新しい検出器を作成（例: `rustBlockDetector.ts`）
2. `BaseBlockDetector` を継承して言語固有のロジックを実装
3. `src/detectors/blockDetectorFactory.ts` に言語を追加
4. `src/utils/commentFormatter.ts` に言語固有のフォーマットを追加
5. テストを追加

#### 新しいLLMプロバイダーのサポート追加

1. `src/providers/` に新しいプロバイダーを作成（例: `claudeProvider.ts`）
2. `BaseProvider` を継承して API呼び出しロジックを実装
3. `src/providers/translationProviderFactory.ts` にプロバイダーを追加
4. `package.json` に設定項目を追加
5. テストを追加

### リファクタリング履歴

v0.5.0でメジャーリファクタリングを実施：
- ディレクトリ構造の整理（providers/, detectors/, services/, utils/）
- BaseProvider/BaseDetectorによる共通化
- ConfigManagerによる設定の一元管理
- 重複コードの削減（-245行）
- 包括的なテスト追加（87テスト）

### ドキュメント

- [アーキテクチャ](docs/ARCHITECTURE.md) - システムアーキテクチャの詳細
- [開発ガイド](docs/CONTRIBUTING.md) - 開発者向けガイド

### リリースプロセス

1. `package.json` のバージョンを更新（例: 1.0.2 → 1.0.3）
2. `CHANGELOG.md` に変更内容を記録
3. mainブランチにマージ
4. GitHub Actionsが自動的に：
   - バージョン変更を検出
   - テストを実行
   - VSIXをビルド
   - VS Code Marketplaceに公開
   - Open VSX Registryに公開
   - GitHub Releaseを作成
