## サマリー

本UI設計書は FR-4（CLAUDE.md の ci_verification 行修正）に対するインターフェース設計を定義する。
本タスクはGUIを持たないドキュメント修正タスクであるため、CLIツール（Read/Edit）の呼び出しパターン、
エラーメッセージの処理方針、workflow_next の APIレスポンス形式、設定ファイルの修正前後の構造を設計する。

### 目的

- Edit ツールによる CLAUDE.md の1行修正が確実に実行されるよう、引数仕様を明確化する
- Read ツールによる事前確認と事後検証の手順を確立し、誤操作リスクをゼロにする
- バリデーション失敗時のエラーパターンを事前に定義し、リトライ対応の指針を提供する

### 主要な決定事項

- Edit ツールは replace_all: false（デフォルト）で呼び出し、単一行のみを置換する
- Read ツールは offset と limit を指定して対象行周辺のみを取得し、変更前後を確認する
- 修正前の old_string はテーブル行全体（先頭パイプから末尾パイプまで）を完全一致文字列とする
- 修正後の new_string はカテゴリ列を「readonly」のみとし、用途列を「CI結果確認のため読み取りのみ」とする

### 次フェーズで必要な情報

- 実装フェーズでは本設計書に記載の Edit ツール呼び出しパターンをそのまま使用する
- 検証ステップは Read ツールで offset=178, limit=10 を指定して実行する
- バリデーション成功の判断基準は「readonly」のみが許可カテゴリ列に表示されることである

---

## CLIインターフェース設計

本タスクでは Read ツールと Edit ツールの2種類のCLIインターフェースを使用する。
各ツールの呼び出しパターンと引数仕様を以下に定義する。

### Read ツール呼び出しパターン（事前確認）

修正前に対象行の現在の内容を確認するための Read ツール呼び出し仕様を以下に示す。

- file_path（確認ステップ用）: `C:\ツール\Workflow\CLAUDE.md`
- offset: 178（ci_verification 行が存在する付近から読み込みを開始する）
- limit: 10（対象行とその前後数行を含む範囲を取得する）

この呼び出しにより、ci_verification 行が「readonly, testing」という誤った許可カテゴリを持っていることを
目視確認してから置換を実行することができる。offset の値はファイル変更により前後する可能性があるため、
実際の行番号はコンテキストの確認後に調整することが望ましい。

### Edit ツール呼び出しパターン（置換実行）

CLAUDE.md の ci_verification 行を修正するための Edit ツール呼び出し仕様を以下に示す。

- file_path（置換実行用）: `C:\ツール\Workflow\CLAUDE.md`
- old_string: `| ci_verification | readonly, testing | CI結果確認のため |`
- new_string: `| ci_verification | readonly | CI結果確認のため読み取りのみ |`
- replace_all: false（省略可。デフォルト false のため単一置換が保証される）

old_string はファイル内で1箇所のみ出現する一意な文字列であるため、replace_all を使用する必要はない。
置換後はテーブルの3カラム構成（フェーズ名・許可カテゴリ・用途）が維持されることを確認する。

### Read ツール呼び出しパターン（事後検証）

置換実行後に修正内容を確認するための Read ツール呼び出し仕様を以下に示す。

- file_path（検証ステップ用）: `C:\ツール\Workflow\CLAUDE.md`
- offset: 178（事前確認と同一の行番号を指定する）
- limit: 10（置換後の対象行とその前後数行を取得する）

この呼び出しにより、ci_verification 行に「readonly」のみが記載されていること、
「testing」が削除されていること、および前後の行が変更されていないことを確認する。

---

## エラーメッセージ設計

Edit ツールおよび Read ツールの実行時に発生しうるエラーパターンと対処方針を以下に定義する。

### エラーパターン 1: old_string が見つからない

Edit ツールが `old_string is not found in the file` または類似のエラーを返す場合、
対象の文字列がすでに修正済みであるか、行の内容が想定と異なっている可能性がある。
対処方針は以下のとおりである。Read ツールで CLAUDE.md の対象行付近を再読み込みし、
ci_verification 行の現在の内容を確認する。修正済みであれば Edit ツールの実行は不要である。
内容が異なる場合は old_string を実際の行内容に合わせて修正して再実行する。

### エラーパターン 2: old_string が複数箇所で一致する

old_string が複数箇所で一致する場合、Edit ツールはエラーを返す。
本タスクの old_string は `| ci_verification | readonly, testing | CI結果確認のため |` であり、
この文字列はファイル内で1箇所のみ出現することが事前調査で確認されている。
万一複数一致が発生した場合は、前後のコンテキストを含む長い old_string に変更して再実行する。

### エラーパターン 3: ファイルパスが不正

file_path に指定したパスが存在しない場合、ツールはファイル未発見エラーを返す。
Windows 環境ではパス区切り文字の混在（スラッシュとバックスラッシュ）が原因となる場合がある。
対処方針として、パスを `C:/ツール/Workflow/CLAUDE.md` の形式に変更して再実行する。

### エラーパターン 4: ファイルが予期せず変更されている

Read/Write/Edit ツールは「File has been unexpectedly modified」エラーを返す場合がある。
これは他のプロセスやフックがファイルを変更した場合に発生する。
対処方針として、再度 Read ツールでファイルを読み込み、現在の内容を確認した上で操作を再実行する。

---

## APIレスポンス設計

本タスクで使用する MCP ツール（workflow_next および workflow_complete_sub）のレスポンス形式を定義する。

### workflow_complete_sub レスポンス（成功時）

ui_design サブフェーズが完了した場合に workflow_complete_sub を呼び出す。
成功時のレスポンスは以下の構造を持つ。

- status: "success"
- message: サブフェーズ完了を示すテキスト（例: "ui_design sub-phase completed"）
- nextAction: 次に実行すべきアクション（全サブフェーズ完了後に workflow_next を呼び出す）

### workflow_complete_sub レスポンス（バリデーション失敗時）

成果物が品質要件を満たさない場合、workflow_complete_sub はバリデーション失敗レスポンスを返す。
失敗時のレスポンスには以下の情報が含まれる。

- status: "validation_failed"
- errors: 失敗した検証項目のリスト（セクション密度不足、必須セクション欠落、禁止語検出等）
- retryRequired: true（Orchestrator がサブエージェントを再起動する必要があることを示す）

バリデーション失敗時は Orchestrator が本設計書の記載に基づいてリトライプロンプトを作成し、
subagent を再起動する。Orchestrator 自身が直接 Edit/Write ツールで成果物を修正してはならない。

### workflow_next レスポンス（フェーズ遷移成功時）

全サブフェーズ（state_machine, flowchart, ui_design）が完了した後に workflow_next を呼び出す。
成功時のレスポンスは以下の構造を持つ。

- status: "success"
- currentPhase: "design_review"（遷移先フェーズ名）
- message: 設計レビューフェーズへの移行完了を示すテキスト

---

## 設定ファイル設計

本セクションでは CLAUDE.md の「フェーズ別Bashコマンド許可カテゴリ」テーブルにおける
ci_verification 行の修正前後の構造を比較する。

### テーブル構造の説明

CLAUDE.md の許可カテゴリテーブルは Markdown のパイプ区切りテーブル形式で記述されている。
テーブルは3カラム構成であり、ヘッダー行・区切り行・データ行で構成されている。
ヘッダー行の内容は `| フェーズ | 許可カテゴリ | 用途 |` である。
ci_verification 行は security_scan, performance_test, e2e_test 行の直後に配置されている。

### 修正前の ci_verification 行

修正前のテーブル行は以下のとおりである。許可カテゴリ列に「readonly, testing」が記載されており、
definitions.ts の実際の設定（readonly のみ）と乖離している状態である。

```
| ci_verification | readonly, testing | CI結果確認のため |
```

この行は、フックシステムの実際の動作ではテストコマンドが許可されていないにもかかわらず、
ドキュメント上では許可されているかのように見えるため、サブエージェントへの誤情報伝達を引き起こす。

### 修正後の ci_verification 行

修正後のテーブル行は以下のとおりである。許可カテゴリ列が「readonly」のみとなり、
definitions.ts の実際の設定と完全に一致する状態になる。

```
| ci_verification | readonly | CI結果確認のため読み取りのみ |
```

用途説明列も「CI結果確認のため」から「CI結果確認のため読み取りのみ」に変更することで、
readonly カテゴリのみが許可されていることを明示的に示す内容となっている。

### 修正前後の比較表

修正前後の違いをカラム単位で整理すると以下のようになる。

| カラム | 修正前の内容 | 修正後の内容 |
|--------|------------|------------|
| フェーズ名 | ci_verification | ci_verification（変更なし） |
| 許可カテゴリ | readonly, testing | readonly |
| 用途説明 | CI結果確認のため | CI結果確認のため読み取りのみ |

フェーズ名列は変更されない。許可カテゴリ列から「testing」が削除される。
用途説明列はreadonly のみであることを明示する表現に更新される。
テーブル行の Markdown 構造（先頭パイプ・末尾パイプ・スペースの有無）は他行と一致した形式を維持する。

### 周辺行との関係

ci_verification 行の直前行は `| security_scan, performance_test, e2e_test | readonly, testing | 検証ツール実行のため |` であり、
直後行は `| commit, push | readonly, git | Git操作のため |` である。
これらの行は今回の修正で変更されない。Edit ツールによる単一置換により影響範囲が厳密に制御される。
修正後のテーブル全体の一貫性が保たれることを Read ツールの事後検証ステップで確認する。
