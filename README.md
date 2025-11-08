# Doc Translate

コードのdocstringやコメントを複数のLLM（Claude, OpenAI, Gemini）で翻訳するVSCode拡張機能です。

## 機能

- **複数のLLMプロバイダー対応**: Anthropic Claude、OpenAI、Google Geminiから選択可能
- **複数のプログラミング言語対応**: Python、JavaScript、TypeScript、Goに対応
- **翻訳言語の自由な設定**: 翻訳元と翻訳先の言語を自由に設定可能
- **インライン翻訳表示**: ファイルを開くと、docstringとコメントの翻訳がコード内に常時表示
  - **コメント**（`#`）: 各行の右側に翻訳を表示（例: `# comment → コメント`）
  - **Docstring**（`"""`/`'''`）: 元のテキストを隠して翻訳を上書き表示
  - **カーソル・選択時は原文表示**: docstringにカーソルがあるか選択すると翻訳が自動的に非表示になり原文が見える
  - ホバー不要、常に表示されている
  - グレーアウトされた斜体で表示、邪魔にならない
  - ファイルは変更されない（見た目のみの変更）
- **ファイルを開くだけで自動翻訳**: Pythonファイルを開くと、すべてのdocstringとコメントを自動的にバックグラウンドで翻訳
  - ステータスバーに進捗表示
  - スマートキャッシング: ファイルごとに1回のみ翻訳
  - ファイル保存時も自動再翻訳（キャッシュを活用）
  - **並列翻訳**: 最大5個のリクエストを同時実行（rate limit対策）
- **LSP駆動の検出**: VSCodeのLanguage Server Protocol (Pylance)を使用した正確なdocstring検出
- **翻訳対象**:
  - モジュールdocstring（ファイル先頭のdocstring）
  - クラス・関数・メソッドのdocstring（`"""`と`'''`）
  - インラインコメント（`#`）
- **永続化キャッシュ**: ディスクに保存される永続的なキャッシュでAPI呼び出しを最小化
  - 拡張機能を再起動しても翻訳結果が保持される
  - VSCodeのglobalStateに保存
- **進捗インジケーター**: 翻訳中はステータスバーに進捗を表示
- **詳細なログ**: LSPクエリ、APIリクエスト/レスポンス、デバッグ情報を記録
- **設定可能**: 環境変数とVSCode設定の両方に対応

## 必要要件

- **LLM APIキー**: 以下のいずれかのLLMプロバイダーのAPIキーが必要です
  - **Anthropic Claude**: `ANTHROPIC_API_KEY` 環境変数、または `docTranslate.anthropicApiKey` 設定
  - **OpenAI**: `OPENAI_API_KEY` 環境変数、または `docTranslate.openaiApiKey` 設定
  - **Google Gemini**: `GEMINI_API_KEY` 環境変数、または `docTranslate.geminiApiKey` 設定
- **言語拡張機能**: 各言語のLSPサポートが必要
  - **Python**: Python拡張機能（Pylance付き）
  - **JavaScript/TypeScript**: 通常、VSCodeに標準搭載
  - **Go**: Go拡張機能

## 拡張機能の設定

この拡張機能は以下の設定項目を提供します：

### 基本設定
* `docTranslate.provider`: 使用するLLMプロバイダー（`anthropic`、`openai`、`gemini`、デフォルト: `anthropic`）
* `docTranslate.sourceLang`: 翻訳元の言語コード（デフォルト: `en`）
* `docTranslate.targetLang`: 翻訳先の言語コード（デフォルト: `ja`）
* `docTranslate.supportedLanguages`: 翻訳対象のプログラミング言語（デフォルト: `["python", "javascript", "typescript", "go"]`）
* `docTranslate.timeout`: APIリクエストのタイムアウト（ミリ秒、デフォルト: `30000`）

### Anthropic Claude設定
* `docTranslate.anthropicApiKey`: Anthropic APIキー（環境変数 `ANTHROPIC_API_KEY` が優先されます）
* `docTranslate.model`: 使用するClaudeモデル（デフォルト: `claude-haiku-4-5-20251001`）

### OpenAI設定
* `docTranslate.openaiApiKey`: OpenAI APIキー（環境変数 `OPENAI_API_KEY` が優先されます）
* `docTranslate.openaiModel`: 使用するOpenAIモデル（デフォルト: `gpt-4o-mini`）

### Google Gemini設定
* `docTranslate.geminiApiKey`: Gemini APIキー（環境変数 `GEMINI_API_KEY` が優先されます）
* `docTranslate.geminiModel`: 使用するGeminiモデル（デフォルト: `gemini-2.0-flash-exp`）

## 使い方

1. LLMプロバイダーとAPIキーを設定:
   - VSCode設定で `docTranslate.provider` を選択（`anthropic`、`openai`、`gemini`）
   - 選択したプロバイダーのAPIキーを設定:
     - **Anthropic**: 環境変数 `ANTHROPIC_API_KEY` または設定 `docTranslate.anthropicApiKey`
     - **OpenAI**: 環境変数 `OPENAI_API_KEY` または設定 `docTranslate.openaiApiKey`
     - **Gemini**: 環境変数 `GEMINI_API_KEY` または設定 `docTranslate.geminiApiKey`

2. 翻訳言語を設定（オプション）:
   - `docTranslate.sourceLang`: 翻訳元の言語（デフォルト: `en`）
   - `docTranslate.targetLang`: 翻訳先の言語（デフォルト: `ja`）
   - 対応言語: `en`, `ja`, `zh`, `ko`, `fr`, `de`, `es`, `it`, `pt`, `ru`

3. サポートされている言語のファイルを開く（Python、JavaScript、TypeScript、Go）
   - 拡張機能が自動的にバックグラウンドですべてのdocstringとコメントを翻訳開始
   - ステータスバーで進捗を確認: `$(sync~spin) Translating X/Y blocks...`
   - 完了時: `$(check) Translated X blocks`

4. 翻訳を確認
   - **コメント**: 各行の右側に翻訳が表示されます
     - Python: `# This is a comment → これはコメントです`
     - JavaScript/TypeScript/Go: `// This is a comment → これはコメントです`
   - **Docstring/JSDoc**: 元のテキストが隠され、翻訳が上書き表示されます
   - ホバー不要、常に見える状態
   - 元のコードは一切変更されません（見た目のみ）

5. ファイルを編集・保存
   - ファイルを保存すると自動的に再翻訳されます
   - キャッシュを活用するので、変更されていない部分は高速に処理

## テスト用サンプルファイル

拡張機能の動作を確認するためのサンプルファイルが `src/test/assets/` に用意されています：

- **`sample.py`**: Pythonのサンプルコード（docstring、インラインコメント）
- **`sample.ts`**: TypeScriptのサンプルコード（JSDoc、複数行コメント、単一行コメント）
- **`sample.js`**: JavaScriptのサンプルコード（JSDoc、複数行コメント、単一行コメント）
- **`sample.go`**: Goのサンプルコード（godoc、package doc、複数行/単一行コメント）

これらのファイルを開くと、拡張機能が自動的にコメントとdocstringを翻訳し、インライン表示します。
テストコードからも参照可能なアセットとして配置されています。

## コマンド

* `Doc Translate: Clear Translation Cache`: 翻訳キャッシュと事前翻訳キャッシュをクリア（次回ファイルを開いたときに再翻訳）
* `Doc Translate: Show Logs`: 詳細ログを表示する出力チャンネルを開く

## デバッグ

詳細ログを表示するには：

1. コマンドパレットを開く（`Cmd+Shift+P` または `Ctrl+Shift+P`）
2. `Doc Translate: Show Logs` を実行
3. "Doc Translate" 出力チャンネルに以下の詳細ログが表示されます：
   - 拡張機能の起動状態
   - APIキーの検出
   - 事前翻訳の進捗（ファイルを開いたとき）
   - LSPシンボルのクエリと結果
   - LSPによるdocstring検出
   - 翻訳リクエストとレスポンス
   - キャッシュヒット/ミス
   - エラー詳細

または、出力パネルを手動で開くこともできます：
- 表示 → 出力 → ドロップダウンから "Doc Translate" を選択

## 既知の問題

現時点ではありません。

## リリースノート

### 0.4.0

メジャーアップデート - マルチLLM & マルチ言語対応:
- **複数のLLMプロバイダー対応**: Anthropic Claude、OpenAI、Google Geminiから選択可能
- **複数のプログラミング言語対応**: Python、JavaScript、TypeScript、Goに対応
- **翻訳言語の自由な設定**: 翻訳元と翻訳先の言語を自由に設定可能
- プロバイダーごとのモデル設定
- 言語ごとの最適化されたブロック検出

### 0.3.0

メジャーアップデート:
- インライン翻訳表示（ホバー不要で常時表示）
- コメント：右側表示、Docstring：オーバーレイ表示
- 複数行翻訳の適切なフォーマット表示
- 永続化キャッシュ（拡張機能再起動後も保持）
- 並列翻訳（最大5並列、rate limit対策）
- カーソル・選択時の原文自動表示
- モジュールレベルdocstringのサポート
- ファイル保存時の自動再翻訳
- Claude Haiku 4.5 (20251001)に変更

### 0.1.0

初回MVPリリース:
- PythonのdocstringとコメントのホバープロバイダーBE
- Claude API統合
- 翻訳キャッシング
- APIキーとモデル設定の設定機能
