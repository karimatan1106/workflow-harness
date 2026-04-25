# Serena CLI 調査報告

## 1. Serenaとは何か

Serena (serena-agent) は、Python製のLSP (Language Server Protocol) ベースのコード解析ツール。
GitHub: https://github.com/oraios/serena

`indexer/serena-query.py` は Serena を CLI から使うためのラッパーで、以下の機能を提供する:

- **シンボル検索**: `find_symbol` -- 名前パターンでシンボル定義を検索
- **シンボル一覧**: `get_symbols_overview` -- ファイル/ディレクトリ内のシンボル構造を取得
- **参照元追跡**: `find_referencing_symbols` -- 逆依存グラフ構築(誰がこのシンボルを使っているか)
- **パターン検索**: `search_for_pattern` -- コード内テキスト検索
- **ファイル操作**: `list_dir`, `find_file`, `read_file`, `activate_project`

出力はTOON形式に自動変換される。ページネーション対応(--limit, --offset)。

### セットアップ

- `indexer/setup.sh` が `uv` で Python 3.11 venv を作成し `serena-agent` をインストール
- `mcp-server/package.json` の `postinstall` スクリプトで自動セットアップ
- 現在 `.venv` は存在しインストール済み

## 2. mcp-server/src/ での参照箇所

### defs-stage1.ts (フェーズテンプレート)

2つのフェーズテンプレートに埋め込まれている:

- **scope_definition**: Step 0でSerena利用可否チェック、Step 1-2でLSP-firstの検索・逆依存追跡。フォールバックとしてGrep/Globも記載。
- **impact_analysis**: 逆依存グラフ構築にSerenaを使用。フォールバックあり。

### serena-integration.test.ts (テスト)

- TC-AC5-01: テンプレート内に `serena-query.py` への参照が含まれることを検証
- TC-AC2-03: `setup.sh` に `serena-agent`, `uv`, `3.11` への参照が含まれることを検証

## 3. hooks/ での参照箇所

### tool-gate.js

- `BASH_COMMANDS.lsp` に `'python serena-query.py'` と `'indexer/.venv/Scripts/python.exe'` を許可コマンドとして登録
- `PHASE_BASH` で殆ど全フェーズ(scope_definition, research, impact_analysis, implementation等)に `lsp` カテゴリを許可

つまり、Bash実行時にSerena CLIコマンドがホワイトリスト許可されている。

## 4. 実際にワークフロー内で呼ばれているか

**テンプレートに組み込み済み、かつインフラ(venv, hook許可)も整備済み。**

- scope_definitionとimpact_analysisのsubagentTemplateにSerenaコマンドが記載されている
- テンプレートにはフォールバック機構あり: `SERENA_UNAVAILABLE` ならGrep/Globを使用
- 過去のワークフロー実行ディレクトリとして `Serena CLI完全統合` と `serena-lsp-scope-integration` が存在
- `.mcp.json` にはSerena MCP サーバー設定は**なし** -- SerenaはMCPサーバーではなく、Bashコマンドとして呼ばれる設計

### 実際の利用状況の推測

テンプレートに埋め込まれているため、scope_definitionやimpact_analysisフェーズでsubagentが実行されるたびに、Serena利用可否チェック(Step 0)が走る。ただし:

- subagentがSerenaを**実際に呼ぶかどうかは、対象プロジェクトにSerenaが正しくセットアップされているか**に依存
- Windows環境では `indexer/.venv/Scripts/python.exe` パスがハードコードされている
- フォールバック(Grep/Glob)があるため、Serenaが使えなくてもワークフローは止まらない

## 5. 使われなくなった手がかり (もしあれば)

**Serenaは現時点で「使われなくなった」わけではない。** 以下の証拠:

- コミット履歴: 3回の機能追加コミットがあり、進化している
  1. `feat: integrate Serena LSP into scope_definition and impact_analysis templates`
  2. `feat: complete Serena LSP integration with auto-setup`
  3. `feat: rewrite serena-query.py as generic CLI dispatcher with auto TOON conversion`
  4. `feat: add pagination to serena-query.py and LSP-first scope narrowing`
- テストが存在し、テンプレート内の参照を検証している
- hook (tool-gate.js) でBash許可リストに含まれている
- STRUCTURE_REPORT.mdに `indexer/` がプロジェクト構造として記載

ただし、**実運用での利用頻度は低い可能性がある**:

- フォールバック機構が常に用意されている = Serenaなしでも動作する設計
- 対象プロジェクト側にもSerenaのプロジェクト登録が必要(`SerenaConfig`)
- subagentが実際にSerenaコマンドを実行するかはLLMの判断に委ねられている(テンプレートはガイダンスであり強制ではない)

## まとめ

| 観点 | 状態 |
|------|------|
| コード存在 | indexer/に3ファイル (query CLI, setup, requirements) |
| テンプレート参照 | scope_definition, impact_analysis の2フェーズ |
| Hook許可 | tool-gate.js で全フェーズにlspカテゴリ許可 |
| テスト | serena-integration.test.ts で参照存在を検証 |
| venvインストール | 済み (.venv/Scripts/python.exe 存在) |
| MCP設定 | なし (Bash経由で呼ぶ設計) |
| 廃止兆候 | なし (アクティブに統合されている) |
