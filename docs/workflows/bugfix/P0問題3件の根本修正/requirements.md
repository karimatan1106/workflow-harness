# P0問題3件の根本修正 - 要件定義

## サマリー

本要件定義はworkflow-pluginのレビューで発見されたP0（致命的）問題3件の修正要件を定義する。
research.mdの調査結果に基づき、各問題の解決アプローチを選定し、実装すべき機能と非機能要件を明確化する。

### 目的

以下のP0問題を根本解決し、ワークフローの信頼性を致命的問題ゼロの状態に戻す。

- P0-1: ユーザー意図からコードへの自動マッピングが存在しない（test_implスキップ・parallel_analysisブロック）
- P0-2: 成果物バリデーションが形式チェックのみで意味的品質を検証しない（大多数のフェーズで品質チェック欠落）
- P0-3: task-index.jsonの非アトミック書き込みによるレース条件（タスク消失・誤ブロック）

### 主要な決定事項

- P0-1は「アプローチA（researchフェーズ強化）+ アプローチC（遷移ガード強化）」の組み合わせを採用する
- P0-2はPHASE_TO_ARTIFACTの全フェーズ拡張と、complete-sub.tsへの同等チェック追加を採用する
- P0-3はwrite-then-renameパターンによるアトミック書き込みと、MCPサーバーからのtask-index.json更新を採用する

### 次フェーズで必要な情報

- P0-1: definitions.tsのPHASE_GUIDES.researchに追加するチェックリスト項目の正確な文言
- P0-2: complete-sub.tsのSUBPHASE_TO_ARTIFACTマッピング定義（サブフェーズ名→ファイル名の対応表）
- P0-3: next.ts/start.tsにおけるtask-index.json同期更新の挿入箇所の特定

---

## 機能要件

### P0-1: ユーザー意図からコードへの自動スコープマッピング

#### アプローチ選定の根拠

3つのアプローチを比較した結果、アプローチAとアプローチCの組み合わせを選定する。

**アプローチA（researchフェーズ強化）の採用理由:**
researchフェーズはuserIntentが最初に読み込まれるフェーズであり、
調査時に関連ファイルを特定してスコープを設定するのが最も自然な流れである。
モデルをhaikuからsonnetに引き上げることで、キーワード抽出とファイルマッピングの精度が向上する。
既存のフェーズ構成を変更せず、subagentTemplateとchecklistの修正だけで実現できる。

**アプローチB（新フェーズ追加）を採用しない理由:**
新フェーズ「scope_mapping」を追加すると19フェーズが20フェーズに増え、
小規模タスクでも全フェーズを経由するオーバーヘッドが生じる。
git diffによる変更ファイル検出は「まだ変更を行っていないresearchフェーズ」では意味をなさない。
フェーズ数の増加はCLAUDE.mdのドキュメント・フェーズ定義・スキップロジック全体の修正を要求し
修正コストが高い割にアプローチAで同等の効果が得られる。

**アプローチC（遷移ガード強化）の部分採用:**
parallel_analysis遷移時のスコープ必須チェックは既に存在するが、
research→requirementsフェーズ遷移時にもスコープ設定の警告を出力する機能を追加する。
完全なブロックではなく警告とすることで、本当にスコープが不要なケース（調査タスク）をサポートする。

#### P0-1の実装要件

**REQ-P01-1: researchフェーズのモデル引き上げ**
- definitions.tsのPHASE_GUIDES.researchのmodelをhaikuからsonnetに変更する
- 変更理由: userIntentから関連ファイルを正確に特定するにはsonnetレベルの推論が必要

**REQ-P01-2: researchフェーズのsubagentTemplateにスコープ設定指示を追加**
- subagentTemplateのチェックリスト末尾に以下を追加する
- 指示内容の方針: userIntentのキーワードからGlob/Grepで関連ファイルを特定し、
  `workflow_set_scope`を呼び出してaffectedFiles/affectedDirsを設定するよう明示する
- スコープ設定は「調査フェーズの最後の必須ステップ」として位置付ける

**REQ-P01-3: researchフェーズのchecklistにスコープ確認を追加**
- checklist配列の末尾に「workflow_set_scopeを呼び出してaffectedFilesを設定したか」を追加する
- これによりphaseGuide.checklistを表示するUI/ログでスコープ設定が促される

**REQ-P01-4: research→requirements遷移時のスコープ未設定警告**
- next.tsのresearch→requirements遷移処理にスコープ検証を追加する
- スコープが空の場合、エラーではなくwarning文字列を返してフェーズ遷移は許可する
- 警告メッセージ: 「スコープが設定されていません。parallel_analysisフェーズでブロックされます。
  researchフェーズでworkflow_set_scopeを呼び出してください。」
- 警告はworkflow_nextのレスポンスのwarningsフィールドに含める

---

### P0-2: 成果物バリデーションの全フェーズ拡張

#### 実装要件

**REQ-P02-1: PHASE_TO_ARTIFACTの全フェーズ拡張**

next.tsのPHASE_TO_ARTIFACT定義を以下のエントリに拡張する。

| フェーズキー | 成果物ファイル |
|------------|-------------|
| research | research.md（既存） |
| requirements | requirements.md（既存） |
| test_design | test-design.md（既存） |
| planning | spec.md（新規追加） |
| threat_modeling | threat-model.md（新規追加） |

上記はworkflow_nextが呼ばれるフェーズ（メインフェーズ遷移）の成果物マッピングである。

**REQ-P02-2: complete-sub.tsへのサブフェーズ成果物チェック追加**

complete-sub.tsにSUBPHASE_TO_ARTIFACTマッピングを新規追加し、
workflow_complete_sub呼び出し時にサブフェーズ成果物の品質チェックを実施する。

| サブフェーズキー | 成果物ファイル |
|--------------|-------------|
| state_machine | state-machine.mmd |
| flowchart | flowchart.mmd |
| ui_design | ui-design.md |
| code_review | code-review.md |
| manual_test | manual-test.md |
| security_scan | security-scan.md |
| performance_test | performance-test.md |
| e2e_test | e2e-test.md |

`checkSubPhaseArtifacts`関数を新規作成し、上記マッピングを用いて
`validateArtifactQuality`（artifact-validator.tsの既存関数）を呼び出す。
チェック失敗時はworkflow_complete_subのレスポンスにエラーを含めてサブフェーズ完了をブロックする。

**REQ-P02-3: semantic-checkerのブロッキングモード適用範囲の明確化**

現在のvalidateSemanticConsistencyは「warningsが1件以上でブロック」だが、
warningsが生成されるケースが限定的（requirementsとspecのキーワード追跡のみ）である。
この関数の呼び出し対象フェーズをコメントで明確化し、将来拡張の足がかりとする。
追加の意味的チェック実装はこのタスクのスコープ外とする（実装コストが高い）。

---

### P0-3: task-index.jsonのアトミック書き込みとMCP同期

#### 実装要件

**REQ-P03-1: writeTaskIndexCacheのアトミック書き込み化**

discover-tasks.jsの`writeTaskIndexCache`関数を以下のwrite-then-renameパターンに変更する。

処理の流れ:
1. task-index.jsonと同じディレクトリに一時ファイル（task-index.json.tmpと同じ名前ベース+プロセスID）を作成する
2. 一時ファイルにfs.writeFileSyncでJSONを書き込む
3. fs.renameSyncで一時ファイルを最終パス（task-index.json）に移動する
4. renameは同一ファイルシステム上でアトミック操作として機能するため、
   中途半端なJSONが読まれる問題が解消される

一時ファイルの命名規則: `task-index.json.{process.pid}.tmp`

例外処理: 一時ファイルへの書き込み失敗またはrename失敗時は、
一時ファイルを削除してエラーをスローする（既存のtry-catchと統合する）。

**REQ-P03-2: MCP serverからtask-index.jsonへのフェーズ同期更新（FIX-1修正）**

現在MCP serverはフェーズ遷移時にworkflow-state.jsonのみを更新し、
task-index.jsonを更新しないため、フックが古いフェーズ情報を読み続ける。

next.tsのフェーズ遷移完了処理（saveState後）に`syncTaskIndex`関数を追加し、
以下の処理を実行する。

syncTaskIndex関数の仕様:
- task-index.jsonのパスを構築する（STATE_DIRまたはデフォルトパス）
- ファイルが存在する場合のみ読み込む（存在しない場合はスキップして正常終了）
- tasksリストから対象タスクIDのエントリを探し、phaseフィールドを新しいフェーズに更新する
- updatedAtを現在時刻に更新する
- REQ-P03-1のアトミック書き込みを用いてtask-index.jsonを更新する

同様の処理をstart.ts（タスク開始時）にも追加し、新規タスクがtask-index.jsonに追加されるようにする。

---

## 非機能要件

### 互換性要件

**NFR-1: 後方互換性の維持**
- P0-1の変更はresearchフェーズのモデルとsubagentTemplateのみを変更し、
  既存のフェーズ遷移ロジックへの影響を最小化する
- P0-2の変更はPHASE_TO_ARTIFACTの拡張であり、既存の3エントリの動作は変更しない
- P0-3のアトミック書き込みはwriteTaskIndexCacheの内部実装変更のみで、
  呼び出し側のインターフェースは変更しない

**NFR-2: パフォーマンス要件**
- P0-1のsonnetモデル引き上げによりresearchフェーズの応答時間が増加するが、
  このフェーズは長時間かかっても許容範囲である（調査フェーズのため）
- P0-2の追加チェックは成果物ファイルの読み込みのみであり、
  フェーズ遷移の応答時間増加は1秒未満に収める
- P0-3のwrite-then-renameはfs.writFileSyncより高速であり、
  パフォーマンス上の懸念はない

**NFR-3: 障害時の安全性**
- P0-3でrename操作が失敗した場合、古いtask-index.jsonはそのまま残り
  一時ファイルのみが削除されるため、データ損失は発生しない
- 一時ファイルが残存した場合（プロセスクラッシュ等）はdiscoverTasksの
  次回呼び出し時に孤立した一時ファイルを検出してクリーンアップする
  （孤立ファイルの判断基準: 作成から60秒以上経過したtmpファイル）

**NFR-4: テスト可能性**
- 各修正点に対してユニットテストを作成し、以下のシナリオを検証する
- P0-1: researchフェーズ完了時にスコープが空の場合、warningが返ること
- P0-2: PHASE_TO_ARTIFACTに登録されたフェーズで成果物チェックが実行されること
- P0-2: サブフェーズ完了時に成果物チェックが実行されること
- P0-3: 並行書き込みシミュレーションで、最終ファイルが正常なJSONであること

### 修正対象ファイルの一覧

以下のファイルが修正対象となる。

| ファイルパス | 修正内容 |
|-----------|---------|
| workflow-plugin/mcp-server/src/phases/definitions.ts | PHASE_GUIDES.researchのmodel変更・checklist追加・subagentTemplate修正 |
| workflow-plugin/mcp-server/src/phases/next.ts | PHASE_TO_ARTIFACT拡張・research遷移警告追加・syncTaskIndex追加 |
| workflow-plugin/mcp-server/src/phases/complete-sub.ts | SUBPHASE_TO_ARTIFACT新規定義・checkSubPhaseArtifacts関数追加 |
| workflow-plugin/hooks/discover-tasks.js | writeTaskIndexCacheのアトミック書き込み化 |
| workflow-plugin/mcp-server/src/phases/start.ts | syncTaskIndexによるtask-index.json更新追加 |

### 修正の優先順位

3件のP0問題の実装優先順位は以下の通りとする。

1位: P0-3（レース条件修正）- データ整合性に関わり最も緊急度が高い
2位: P0-2（バリデーション拡張）- 成果物品質の確保に直結し効果が高い
3位: P0-1（スコープ自動マッピング）- subagentTemplateとモデル変更のみで実現可能

### 受け入れ基準

以下の条件を全て満たした時点でこのタスクは完了とする。

- researchフェーズのsubagentTemplateにworkflow_set_scope呼び出し指示が含まれること
- research→requirementsフェーズ遷移時にスコープ未設定の場合warningが返ること
- PHASE_TO_ARTIFACTにplanning/threat_modelingが追加され、フェーズ遷移時に成果物チェックが実行されること
- workflow_complete_sub呼び出し時にサブフェーズの成果物チェックが実行されること
- task-index.jsonへの書き込みがwrite-then-renameパターンで実装されること
- MCPサーバーのフェーズ遷移時にtask-index.jsonのphaseフィールドが同期更新されること
