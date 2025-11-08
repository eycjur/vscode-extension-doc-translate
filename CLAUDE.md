# CLAUDE.md

このファイルは、Claude Code (claude.ai/code) がこのリポジトリのコードを扱う際のガイダンスを提供します。

## プロジェクト概要

Claude APIを使用して英語のdocstringとコメントを日本語に翻訳するVSCode拡張機能です。Pythonファイル対象で、2種類のインライン表示方式で翻訳を提供します。

**対象ユースケース:** 新人オンボーディング、コードレビュー、生産性向上

## プロジェクトステータス

v0.1.0リリース済み - バックグラウンド事前翻訳＋2種類のインライン表示機能を含む完全なMVP実装

## アーキテクチャ

### コアコンポーネント

- **UI**: 2種類のインライン翻訳表示
  - **コメント**: 行の右側に表示（Virtual Text方式）
  - **Docstring**: 元のテキストを隠して翻訳を上書き表示（Overlay方式）
- **対象言語**: Python
- **翻訳方向**: 英語 → 日本語
- **翻訳対象**: docstring（`"""`と`'''`）とインラインコメント（`#`）
- **翻訳エンジン**: Claude API（Claude 4.5 Haiku）
- **検出方法**: LSP（Language Server Protocol / Pylance）でdocstringを検出、正規表現でコメントを検出
- **翻訳タイミング**: ファイルを開いた時・保存した時に全翻訳をバックグラウンド実行

### 翻訳ポリシー

- 技術用語・関数名・クラス名・ライブラリ名はそのまま保持
- 直訳ではなく「自然な」日本語に寄せる
- 日本語のみを出力（説明不要）

### 主要機能

1. **LSPベースのdocstring検出**
   - `vscode.executeDocumentSymbolProvider` でシンボル情報取得
   - シンボル定義直後からdocstringを抽出

2. **正規表現ベースのコメント検出**
   - 文字列内の`#`を除外してコメントを検出
   - 各行のインラインコメントを抽出

3. **バックグラウンド事前翻訳**
   - ファイルオープン・保存時に全docstringとコメントを自動翻訳
   - **並列翻訳**: 最大5個のリクエストを同時実行（rate limit対策）
   - バッチ処理でAPI呼び出しを効率化
   - ステータスバーに進捗表示
   - キャッシュに保存

4. **2種類のインライン翻訳表示**
   - **コメント**: `TextEditorDecorationType` の `after` プロパティで行の右側に表示
   - **Docstring**: `opacity: 0` で元のテキストを隠し、`before` で翻訳を上書き表示
   - **選択時の原文表示**: テキスト選択イベントを監視し、選択範囲と重なるdocstring decorationを自動的に除外
   - 半透明の斜体でグレーアウト表示
   - 常時表示、ホバー不要
   - ファイルは変更されない（見た目のみ）

5. **永続化翻訳キャッシュ**
   - メモリ内ハッシュマップ（SHA-256）でキャッシュ
   - VSCodeの`globalState`に自動保存（永続化）
   - 拡張機能を再起動しても翻訳結果が保持される
   - `set()`時に自動的にディスクに保存
   - 起動時に自動的にロード
   - ファイル編集時にキャッシュ無効化
   - 保存時は変更されていない部分はキャッシュを活用

## ファイル構成

- `src/extension.ts` - 拡張機能のエントリーポイント、イベントハンドラー登録
- `src/inlineTranslationProvider.ts` - インライン翻訳表示プロバイダー（2種類のdecoration実装）
- `src/preTranslationService.ts` - バックグラウンド事前翻訳サービス
- `src/claudeClient.ts` - Claude API クライアント
- `src/pythonBlockDetector.ts` - LSPベースのdocstring検出＋正規表現ベースのコメント検出
- `src/translationCache.ts` - 翻訳キャッシュ（SHA-256ハッシュベース）
- `src/logger.ts` - ログ出力

## 設定

- `docTranslate.anthropicApiKey` - Anthropic APIキー（環境変数 `ANTHROPIC_API_KEY` が優先）
- `docTranslate.model` - 使用モデル（デフォルト: `claude-haiku-4-5-20251001`）
- `docTranslate.timeout` - タイムアウト（デフォルト: 30000ms）

## 開発

```bash
# 依存関係インストール
npm install

# コンパイル
npm run compile

# 自動コンパイル（開発時）
npm run watch

# 拡張機能をデバッグ
F5キーを押す
```
