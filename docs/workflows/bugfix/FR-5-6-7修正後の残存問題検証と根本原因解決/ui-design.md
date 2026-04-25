# UI設計書 — verify-sync.ts CLIインターフェース

## サマリー

- 目的: `verify-sync.ts` のCLIインターフェース・エラーメッセージ・出力フォーマット・設定ファイルを設計し、実装フェーズで参照できる明確な仕様を提供する。
- 主要な決定事項:
  - CLIはサブコマンドなし・フラグなしのシンプルな単一実行形式とする（拡張時のみオプションを追加）
  - 標準出力はフェーズ行ごとに `OK:` または `NG:` プレフィックスを付与し、機械的なパースも可能な一貫したフォーマットとする
  - 標準エラー出力にはデバッグ情報・スタックトレースのみを出力し、CI/CDログと切り分けやすくする
  - 終了コードは0（完全同期）・1（差分検出）・2（スクリプトエラー）の3値とし、spec.mdの出力仕様と完全対応させる
  - 設定ファイルは将来の拡張に備えて `.verify-sync.json` として定義するが、初期実装ではハードコードした定数を使用する
- 次フェーズで必要な情報:
  - 各出力行のプレフィックス文字列（`OK:` / `NG:` / `検証結果:`）はテスト設計・test_implフェーズでの正規表現マッチングに使用される
  - 終了コードの3値（0/1/2）はtest_implフェーズのプロセス終了コードアサーションで参照される
  - `--verbose` オプション（将来拡張）の実装はこの設計書を基点とすること

---

## CLIインターフェース設計

### 基本実行形式

`verify-sync.ts` は引数・サブコマンドなしで実行する単一コマンドである。
実行エントリポイントはプロジェクトルートからの相対パスで指定する。

```bash
npx tsx workflow-plugin/mcp-server/src/verify-sync.ts
```

`ts-node` でも実行可能だが、ESMインポートの解決精度の観点から `tsx` を推奨する。

### 将来拡張用オプション仕様

初期実装では以下のオプションは実装しないが、設計段階で予約しておく。
将来の拡張時にこの設計を参照することで一貫したCLIを提供できる。

| オプション | 短縮形 | 型 | 説明 | 初期実装 |
|-----------|--------|-----|------|----------|
| `--verbose` | `-v` | boolean | 一致フェーズのOK行も全件出力する（デフォルトは全件出力） | 初期版から全件出力 |
| `--json` | なし | boolean | 出力をJSON形式に切り替える | 実装しない |
| `--fail-fast` | なし | boolean | 最初のNG検出時点で処理を中断する | 実装しない |
| `--phase` | `-p` | string | 指定した1フェーズのみ検証する | 実装しない |

### 実行例（想定シナリオ）

全フェーズが同期済みの場合（正常完了、終了コード0）:

```bash
npx tsx workflow-plugin/mcp-server/src/verify-sync.ts
OK: research - 全フィールド一致
OK: requirements - 全フィールド一致
...
OK: deploy - 全フィールド一致
検証結果: 25フェーズ中0件の不一致を検出
```

差分が存在する場合（終了コード1）:

```bash
npx tsx workflow-plugin/mcp-server/src/verify-sync.ts
OK: research - 全フィールド一致
NG: planning - model: definitions.ts=sonnet, root-CLAUDE.md=haiku
NG: build_check - allowedBashCategories: definitions.ts={readonly,testing,implementation}, root-CLAUDE.md={readonly}
検証結果: 25フェーズ中2件の不一致を検出
```

### stdoutとstderrの責務分担

標準出力（stdout）には人間可読な検証レポートのみを出力する。
CI/CDシステムはstdoutのサマリー行と終了コードで成否を判定する。

標準エラー出力（stderr）にはスクリプト実行失敗時のエラー詳細のみを出力する。
具体的にはファイル読み込み失敗のNode.jsエラーオブジェクト・スタックトレースがstderrに送られる。

---

## エラーメッセージ設計

### エラーコード体系

エラーメッセージはエラーコード・メッセージ本文・対処方法の3要素で構成する。
スクリプトが終了コード2で終了する全パターンを以下に定義する。

| エラーコード | 発生条件 | 終了コード |
|------------|---------|-----------|
| `ERR_FILE_NOT_FOUND` | 対象ファイルが存在しない | 2 |
| `ERR_FILE_READ_FAILED` | ファイルの読み取り権限がないまたはIOエラー | 2 |
| `ERR_PARSE_FAILED` | テーブル解析で必須セクションが見つからない | 2 |
| `ERR_IMPORT_FAILED` | definitions.tsのESMインポートが失敗した | 2 |

### エラーメッセージの出力フォーマット

stderrへのエラー出力は以下のフォーマットで統一する。
エラーコードを先頭に置くことで、ログ管理システムによる自動分類を支援する。

```
ERR_FILE_NOT_FOUND: ファイルが見つかりません: {ファイルパス}
対処方法: プロジェクトルートから実行しているか確認してください。
期待パス: workflow-plugin/mcp-server/src/definitions.ts

ERR_PARSE_FAILED: セクションが見つかりません: "フェーズ別subagent設定" in CLAUDE.md
対処方法: CLAUDE.mdの該当セクションヘッダーが変更されていないか確認してください。

ERR_IMPORT_FAILED: definitions.tsのインポートに失敗しました
対処方法: tsxがインストールされているか確認してください。
コマンド: npm list tsx
```

### 各エラーコードの詳細定義

`ERR_FILE_NOT_FOUND` はファイルパスの検索結果とともに出力する。
検索パスはプロセスのカレントディレクトリ（`process.cwd()`）を基準とした絶対パスを表示する。
開発者はこの出力から実行ディレクトリが正しいかをただちに確認できる。

`ERR_PARSE_FAILED` はどのセクションが欠落しているかを具体的に示す。
ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdで別々のエラーメッセージを生成し、どのファイルで失敗したかを明確にする。
この区別により、CLAUDE.mdのどちらのファイルを修正すべきかを開発者が即座に特定できる。

`ERR_IMPORT_FAILED` はNode.jsのエラーオブジェクトのmessageフィールドをそのまま付加する。
ESMインポートのパスエラーとコンパイルエラーはNode.jsのメッセージで区別できる。

### NG検出時の差分メッセージフォーマット

差分検出（終了コード1）時のNGメッセージは以下のフォーマットに従う。
フィールドごとに独立した行を出力し、1フェーズで複数フィールドが不一致の場合は複数行を出力する。

```
NG: {フェーズ名} - {フィールド名}: definitions.ts={期待値}, {ソース識別子}={実際値}
```

ソース識別子は以下の2種類を使い分ける。
- ルートCLAUDE.mdとの不一致: `root-CLAUDE.md`
- workflow-plugin/CLAUDE.mdとの不一致: `plugin-CLAUDE.md`
- Bashカテゴリテーブルとの不一致: `root-CLAUDE.md(bash-table)`

`allowedBashCategories` の差分表示では配列要素を `{elem1,elem2}` の波括弧形式で表現する。
順序に依存しない比較を行うが、出力時は要素をアルファベット順にソートして表示する。

---

## APIレスポンス設計

### 終了コードの完全定義

プロセス終了コードはCI/CDパイプラインとの統合インターフェースである。
3値のみを使用し、それ以外の値は出力しない。

終了コード0は全25フェーズで不一致が検出されなかった場合にのみ使用する。
definitions.tsとルートCLAUDE.md（subagentテーブル・Bashカテゴリテーブル）およびworkflow-plugin/CLAUDE.mdの全フィールドが一致した場合である。
CI/CDパイプラインは終了コード0をビルドステップの成功として扱う。

終了コード1は1件以上の差分が検出された場合に使用する。
スクリプト自体は最後まで実行され、全25フェーズのOK/NGを出力した後にこのコードで終了する。
CI/CDパイプラインは終了コード1をビルドステップの失敗として扱い、プルリクエストのマージをブロックする。

終了コード2はスクリプトの実行自体が失敗した場合（ファイル読み込みエラー・パースエラー）に使用する。
この場合、フェーズごとの検証出力は出力されず、stderrにエラー情報のみが出力される。
終了コード2はCI/CDパイプラインで「スクリプトが壊れている」ことを示し、終了コード1（差分あり）と区別される。

### 標準出力のライン形式

stdoutに出力される各行の形式を以下に定義する。
機械的パースを可能にするため、プレフィックスは固定文字列とする。

| 行種別 | プレフィックス | フォーマット |
|-------|-------------|------------|
| 正常フェーズ行 | `OK: ` | `OK: {フェーズ名} - 全フィールド一致` |
| 差分検出行 | `NG: ` | `NG: {フェーズ名} - {フィールド名}: definitions.ts={値}, {ソース}={値}` |
| サマリー行 | `検証結果: ` | `検証結果: 25フェーズ中{N}件の不一致を検出` |

### 出力行数の保証

全フェーズが正常な場合、stdoutは26行（フェーズ行25行＋サマリー行1行）となる。
差分がある場合は、NGフェーズで複数フィールドが不一致なら対応する行数分増加する。
終了コード2の場合は0行（stdoutへの出力なし）となる。

### CI/CD統合スクリプト例

GitHub ActionsでのCI統合時の参考実装を以下に示す。
`exit-code` の確認と `grep` によるNGメッセージの抽出を組み合わせることで、差分の詳細をアノテーションに付与できる。

```yaml
- name: Verify CLAUDE.md sync
  run: npx tsx workflow-plugin/mcp-server/src/verify-sync.ts
  continue-on-error: false
```

---

## 設定ファイル設計

### 設定ファイルの位置と形式

将来の拡張に備えて設定ファイルのスキーマを定義するが、初期実装ではこのファイルは使用しない。
初期実装ではすべての設定値をスクリプト内の定数（`const`）としてハードコードする。
設定ファイルが存在しない場合は無視し、デフォルト値で動作する。

設定ファイルのパス: プロジェクトルートの `.verify-sync.json`

### 設定スキーマ定義

```json
{
  "$schema": "https://json-schema.org/draft/2020-12/schema",
  "type": "object",
  "properties": {
    "targets": {
      "type": "object",
      "description": "検証対象のファイルパス設定（プロジェクトルートからの相対パス）",
      "properties": {
        "definitions": {
          "type": "string",
          "default": "workflow-plugin/mcp-server/src/definitions.ts",
          "description": "PhaseGuideのソースオブトゥルースとなるTypeScriptファイルのパス"
        },
        "rootClaudeMd": {
          "type": "string",
          "default": "CLAUDE.md",
          "description": "プロジェクトルートのCLAUDE.mdファイルのパス"
        },
        "pluginClaudeMd": {
          "type": "string",
          "default": "workflow-plugin/CLAUDE.md",
          "description": "workflow-pluginディレクトリ配下のCLAUDE.mdファイルのパス"
        }
      }
    },
    "sections": {
      "type": "object",
      "description": "CLAUDE.md内の対象セクションヘッダー文字列設定",
      "properties": {
        "subagentTable": {
          "type": "string",
          "default": "フェーズ別subagent設定",
          "description": "subagent設定テーブルを含むMarkdownセクションの見出しテキスト"
        },
        "bashTable": {
          "type": "string",
          "default": "フェーズ別Bashコマンド許可カテゴリ",
          "description": "Bashコマンドカテゴリテーブルを含むMarkdownセクションの見出しテキスト"
        }
      }
    },
    "output": {
      "type": "object",
      "description": "出力フォーマット設定",
      "properties": {
        "showOkLines": {
          "type": "boolean",
          "default": true,
          "description": "全フィールド一致のOK行を出力するかどうかの制御フラグ"
        },
        "exitOnFirstError": {
          "type": "boolean",
          "default": false,
          "description": "最初のNG検出時点で処理を中断するフェイルファスト動作の制御フラグ"
        }
      }
    }
  }
}
```

### 設定ファイル不在時のデフォルト値

設定ファイルが存在しない場合、スクリプトは以下のハードコードされたデフォルト値で動作する。
これらの値はスクリプト先頭の定数として宣言し、将来の設定ファイル対応時には読み込み処理で上書きする。

- `DEFINITIONS_PATH`: `"workflow-plugin/mcp-server/src/definitions.ts"` — definitions.tsのプロジェクトルートからの相対パス
- `ROOT_CLAUDE_MD_PATH`: `"CLAUDE.md"` — ルートCLAUDE.mdのプロジェクトルートからの相対パス
- `PLUGIN_CLAUDE_MD_PATH`: `"workflow-plugin/CLAUDE.md"` — プラグイン版CLAUDE.mdのプロジェクトルートからの相対パス
- `SUBAGENT_SECTION_HEADER`: `"フェーズ別subagent設定"` — subagentテーブルセクションの識別文字列
- `BASH_SECTION_HEADER`: `"フェーズ別Bashコマンド許可カテゴリ"` — Bashカテゴリテーブルセクションの識別文字列

### 設定ファイルの拡張方針

セクションヘッダー文字列はCLAUDE.mdが将来的に改訂された際に変更が必要となる箇所であるため、設定ファイルで上書きできる構造としておく。
`targets.definitions` フィールドはmonorepo構成でのパス変更に対応するための予備設定項目である。
`output.showOkLines` はCI環境でログ量を削減したい場合に `false` に設定することで差分行のみを出力できる。
