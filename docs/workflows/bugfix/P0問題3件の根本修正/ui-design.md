# P0問題3件の根本修正 - UI/インターフェース設計

## サマリー

本ドキュメントはワークフロープラグイン（CLIツール）のP0問題3件修正に関するインターフェース設計を定義する。
対象はGUIではなく、MCPツールのAPIレスポンス形式・CLIエラーメッセージ・設定ファイルのスキーマである。

主要な決定事項を以下に示す。
- P0-1（スコープ未設定）: workflow_set_scopeの引数仕様とnext.tsの警告レスポンス形式を設計する
- P0-2（PHASE_TO_ARTIFACT欠落）: workflow_nextのバリデーション失敗メッセージとparallel_analysisエントリ形式を設計する
- P0-3（非アトミック書き込み）: discover-tasks.jsのwrite-then-renameパターンと一時ファイル命名規則を設計する

次フェーズ（テスト設計）で必要な情報として、各MCPツールの入出力スキーマと
エラーメッセージの正確な文字列定義を本ドキュメントに記載している。
definitions.tsのresearchフェーズ設定変更（model・checklist・subagentTemplate）の具体的な形式もここで確定する。

---

## CLIインターフェース設計

### workflow_set_scope の引数仕様

workflow_set_scopeはresearchフェーズの最終ステップとして呼び出されるMCPツールである。
引数はJSON形式で以下のフィールドを受け付ける。

| フィールド名 | 型 | 必須 | 説明 |
|---|---|---|---|
| taskId | string | 条件付き | タスクID。省略時はアクティブタスクを自動選択する |
| files | string配列 | 条件付き | 影響を受ける個別ファイルのパスリスト |
| dirs | string配列 | 条件付き | 影響を受けるディレクトリのパスリスト |
| glob | string | 任意 | ファイルを一括指定するglobパターン |
| addMode | boolean | 任意 | trueの場合は既存スコープに追加する（デフォルトはfalse＝置き換え） |

filesとdirsの少なくとも一方に1件以上の要素が必要である。両方が空の場合はP0-1の警告トリガーとなる。
次のresearch→requirementsフェーズ遷移でaffectedFilesとaffectedDirsの両方が0件の場合に警告が発火する設計とする。

### workflow_next の呼び出し仕様

workflow_nextはフェーズ遷移を要求するMCPツールである。引数仕様は以下の通りである。

| フィールド名 | 型 | 必須 | 説明 |
|---|---|---|---|
| taskId | string | 条件付き | タスクID。省略時はアクティブタスクを自動選択する |
| sessionToken | string | 任意 | Orchestrator認証用トークン |

researchフェーズからrequirementsフェーズへの遷移時、スコープ未設定でも遷移はブロックしない。
successフィールドはtrueのままで、warningsフィールドに警告文字列が追加される。

### workflow_complete_sub の呼び出し仕様

workflow_complete_subはparallel_analysisなどの並列フェーズ内のサブフェーズを完了させるMCPツールである。

| フィールド名 | 型 | 必須 | 説明 |
|---|---|---|---|
| taskId | string | 条件付き | タスクID。省略時はアクティブタスクを自動選択する |
| subPhase | string | 必須 | 完了するサブフェーズ名（例: threat_modeling, planning） |
| sessionToken | string | 任意 | Orchestrator認証用トークン |

サブフェーズ完了時にはSUB_PHASE_TO_ARTIFACTを参照して成果物の存在確認とバリデーションを行う。
parallel_analysisのサブフェーズとして、threat_modelingはthreat-model.mdを、planningはspec.mdを検証する。

---

## エラーメッセージ設計

### P0-1: スコープ未設定警告メッセージ

次のフェーズ遷移でwarningsフィールドに格納する警告文字列を以下の通り定義する。

```
スコープが設定されていません。parallel_analysisフェーズでブロックされます。researchフェーズでworkflow_set_scopeを呼び出してください。
```

この警告はエラーではなく情報提供として扱い、successはtrueのままを維持する。
ブロックではなく警告に留める理由として、純粋な調査タスクなどスコープが本当に不要なケースを排除しないためである。
警告が出た場合、Orchestratorはスコープ設定を促すメッセージをユーザーに表示することが期待される。

### P0-2: 成果物バリデーション失敗メッセージ

PHASE_TO_ARTIFACTに登録されたフェーズでの成果物品質チェック失敗時のメッセージ形式を以下に示す。

parallel_analysisフェーズでspec.mdが存在しない場合のメッセージ例を示す。
「成果物の品質チェックに失敗しました: spec.md が見つかりません。planningサブフェーズを完了してください。」

parallel_analysisフェーズでthreat-model.mdが存在しない場合のメッセージ例を示す。
「成果物の品質チェックに失敗しました: threat-model.md が見つかりません。threat_modelingサブフェーズを完了してください。」

成果物の内容品質チェック（artifact-validator.tsのvalidateArtifactQuality）が失敗した場合のメッセージ形式を示す。
「成果物の品質チェックに失敗しました: {ファイル名} - {バリデーターからのエラー詳細}」

### P0-3: アトミック書き込み失敗時のエラーメッセージ

discover-tasks.jsのwriteTaskIndexCacheでレネーム操作が失敗した場合のエラー処理設計を示す。
キャッシュ書き込みエラーは無視する設計とする（呼び出し元はtry-catchで囲まない）。
失敗時のログ出力は行わず、サイレントフェイルとすることで既存の動作との互換性を維持する。
rename失敗時は一時ファイルを削除してから例外を無視する。古いtask-index.jsonはそのまま保持される。

---

## APIレスポンス設計

### workflow_next の戻り値型（NextResult）

現行のNextResult型にwarningsフィールドを追加した拡張後の形式を以下に示す。

| フィールド名 | 型 | 説明 |
|---|---|---|
| success | boolean | 遷移成功可否。警告時もtrueを維持する |
| message | string | 操作結果の説明文 |
| currentPhase | string | 遷移後の現在フェーズ名 |
| nextPhase | string | 次に実行すべきフェーズ名 |
| warnings | string配列 | 警告メッセージの配列（オプショナル） |

warningsフィールドはoptionalであり、警告がない場合はフィールドを含まないか空配列とする。
types.tsのNextResult型にwarnings?: string型の配列フィールドが存在しない場合のみ追加する仕様とする。

research→requirements遷移でスコープが設定されている場合のレスポンス例を示す。
successがtrue、messageが「requirementsフェーズに移行しました」、warningsが空配列となる正常系レスポンスとなる。

research→requirements遷移でスコープが未設定の場合のレスポンス例を示す。
successがtrue（遷移は成功）、warningsにスコープ未設定メッセージが1件含まれた警告系レスポンスとなる。

### workflow_complete_sub の戻り値型

workflow_complete_subはサブフェーズ完了時に以下の形式でレスポンスを返す。

| フィールド名 | 型 | 説明 |
|---|---|---|
| success | boolean | サブフェーズ完了の成否 |
| message | string | 操作結果の説明文 |
| validationErrors | string配列 | 成果物バリデーションのエラー詳細（失敗時のみ） |

parallel_analysisのthreat_modelingサブフェーズ完了時に、threat-model.mdのバリデーションが通過した場合のレスポンス例を示す。
successがtrue、validationErrorsが空配列となる正常系レスポンスとなる。

planning完了時にspec.mdのバリデーションが失敗した場合のレスポンス例を示す。
successがfalse、validationErrorsにエラー詳細が含まれた失敗系レスポンスとなる。

---

## 設定ファイル設計

### PHASE_TO_ARTIFACTの新エントリ形式

next.tsに定義するPHASE_TO_ARTIFACTの変更後の完全な形式を以下に示す。
型はPartial<Record<PhaseName, string配列>>とする。

変更前の3エントリ構成から変更後の4エントリ構成への変更内容を以下の表に示す。

| フェーズキー | 対応する成果物ファイル名 | 変更区分 |
|---|---|---|
| research | research.md（1ファイル） | 既存のまま維持する |
| requirements | requirements.md（1ファイル） | 既存のまま維持する |
| parallel_analysis | spec.md と threat-model.md（2ファイル） | 新規追加エントリ |
| test_design | test-design.md（1ファイル） | 既存のまま維持する |

parallel_analysisエントリを追加する位置は、requirementsエントリの直後でtest_designエントリの直前とする。
PhaseName型にparallel_analysisが既に定義済みであることを実装時に確認してから追加する。

### definitions.tsのresearchフェーズ設定

PHASE_GUIDES.researchオブジェクトに対して行う3件の変更仕様を以下に示す。

**変更1: modelフィールドの更新**
変更前のmodelフィールドは'haiku'である。変更後のmodelフィールドは'sonnet'に変更する。
変更理由はuserIntentのキーワードから関連ファイルを正確に特定するための推論力確保である。
sonnetモデルはGlob/Grepで複数ファイルを調査してスコープをマッピングする際に高精度を発揮する。

**変更2: checklistへの5番目の項目追加**
checklist配列の末尾（現在4項目の後）に以下の内容の文字列を追加する。
追加する文字列の内容: 「userIntentのキーワードからGlob/Grepで関連ファイルを特定し、workflow_set_scopeを呼び出してaffectedFiles/affectedDirsを設定する（調査フェーズの最終必須ステップ）」

**変更3: subagentTemplateへのスコープ設定セクション追加**
subagentTemplateはシングルクォートで囲まれた1行のエスケープ文字列であり、改行は\nで表現する。
追加するセクション見出しは「## スコープ設定（必須）」とする。
セクションの内容として以下の4つの手順を含める必要がある。
- 手順1: userIntentから変更対象キーワードを抽出する
- 手順2: Glob/Grepで関連ファイル・ディレクトリを特定する
- 手順3: ディレクトリを集約してaffectedDirsとaffectedFilesを整理する
- 手順4: workflow_set_scopeを呼び出してaffectedFiles/affectedDirsを設定する

### discover-tasks.jsの一時ファイル命名規則

writeTaskIndexCacheで使用する一時ファイルのパス命名規則を以下に定義する。

一時ファイルのパスはTASK_INDEX_FILEのパスに対してピリオドとprocess.pidとピリオドとtmpを付加した文字列とする。
命名規則の目的はプロセスIDを含めることで複数プロセスが同時実行した場合のファイル名衝突を防ぐことにある。
一時ファイルはTASK_INDEX_FILEと同一ディレクトリに配置し、fs.renameSyncがアトミック操作として機能することを保証する。

孤立した一時ファイルのクリーンアップ条件として、作成から60秒以上経過したtmpファイルを対象とする。
クリーンアップはwriteTaskIndexCache呼び出し時に副次的に実行し、60秒以上経過したtmpファイルを削除する。
削除失敗は無視して処理を継続することで、クリーンアップの失敗がメインの書き込み処理を妨げない設計とする。

---

## 補足: P0問題とインターフェースの対応関係

P0-1・P0-2・P0-3の各問題修正がインターフェースに与える影響を整理して示す。

P0-1の修正（researchフェーズのスコープ設定強制）は、workflow_set_scopeの利用パターンとnext.tsの戻り値に影響する。
Orchestratorがresearchフェーズでworkflow_set_scopeを呼び出さずにworkflow_nextを実行した場合、
warningsフィールドにスコープ未設定の警告が含まれたレスポンスを受け取る仕様となる。
definitions.tsのresearchフェーズchecklist変更により、subagentが自律的にスコープを設定するフローが確立される。

P0-2の修正（PHASE_TO_ARTIFACTへのparallel_analysisエントリ追加）は、workflow_nextの成功条件に影響する。
parallel_analysisフェーズ完了後にworkflow_nextを呼び出した際、spec.mdとthreat-model.mdの存在と品質を検証する。
どちらかのファイルが存在しない場合、またはartifact-validatorの品質チェックに失敗した場合はsuccessがfalseになる。

P0-3の修正（discover-tasks.jsのアトミック書き込み）はユーザー向けインターフェースには直接影響しない。
ただしレース条件解消により、フックが誤ったフェーズ情報を読み取ってコマンドをブロックする問題が解消される。
これによりOrchestratorが意図したフェーズでBashコマンドを実行できる信頼性が向上する効果がある。
