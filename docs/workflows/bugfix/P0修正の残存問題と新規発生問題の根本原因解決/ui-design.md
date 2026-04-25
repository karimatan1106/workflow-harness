## サマリー

本UI設計書は、P0修正の残存問題と新規発生問題の根本原因解決タスクにおける操作インターフェース設計を定義する。

本タスクはCLAUDE.mdドキュメントの文字列置換と行分割のみで完結するため、GUI画面は存在しない。しかしこのフェーズの成果物として、以下の4つの設計観点から具体的な仕様を記述する。

- **CLIインターフェース設計**: EditツールおよびReadツールの呼び出しパターンと引数の仕様
- **エラーメッセージ設計**: バリデーション失敗時や起動失敗時のエラーメッセージパターン
- **APIレスポンス設計**: workflow_nextおよびworkflow_complete_subのレスポンス形式
- **設定ファイル設計**: CLAUDE.mdテーブルの修正前後の構造比較

主要な決定事項として、実行時エラーの直接原因となるFR-1（subagent_type誤記）を最重要度として位置付け、Orchestratorが正確な情報に基づいてsubagentを起動できる状態を回復することを優先する。修正済みの記述との完全一致確認を受入基準として採用し、信頼性のあるガイダンス提供を達成する。

次フェーズ（implementation）では本設計書で定義した呼び出しパターンを基に、EditツールとReadツールを実際に使用してFR-1、FR-2、FR-3の修正を実施する。

---

## CLIインターフェース設計

本タスクで使用するツールはEditツールとReadツールであり、これらの呼び出しパターンを定義する。

### Editツール呼び出しパターン

FR-3（test_impl行分割）の操作：

```
Edit({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  old_string: "| test_impl, implementation, refactoring | readonly, testing, implementation | テスト・実装・ビルドのため |",
  new_string: "| test_impl | readonly, testing | テストコード先行作成のため（TDD Redフェーズ）|\n| implementation, refactoring | readonly, testing, implementation | 実装・ビルド・リファクタリングのため |",
  replace_all: false
})
```

FR-2（deploy行修正）の操作：

```
Edit({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  old_string: "| deploy | readonly, implementation, deploy | デプロイ実行のため |",
  new_string: "| deploy | readonly | デプロイ確認のため読み取りのみ |",
  replace_all: false
})
```

FR-1（subagent_type修正）の操作：

```
Edit({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  old_string: "Task({ prompt: '...planning...', subagent_type: 'Plan', model: 'sonnet', description: 'planning' })",
  new_string: "Task({ prompt: '...planning...', subagent_type: 'general-purpose', model: 'sonnet', description: 'planning' })",
  replace_all: false
})
```

### Readツール呼び出しパターン

各修正後の検証に使用するReadツールの呼び出しパターンを以下に示す。FR-3修正後の確認では、分割によって行が増えるため読み取り範囲を広めに指定する。

```
Read({
  file_path: "C:\\ツール\\Workflow\\CLAUDE.md",
  offset: 173,
  limit: 15
})
```

FR-1修正後の確認では、コードブロック全体を読み取ってスコープ内の変更のみを確認する：

```
Read({
  file_path: "C:\\ツール\\Workflow\\workflow-plugin\\CLAUDE.md",
  offset: 325,
  limit: 10
})
```

### 実行順序の制限

Editツールは文字列マッチングで動作するため、行番号のずれには影響されない。しかし論理的な整合性を保つため、以下の制限を設ける。FR-3を最初に実施することで、deploy行（FR-2）の修正時に行番号変動による混乱を回避する。各修正の後に必ずReadツールで検証を行い、次の修正へ進む前に合格条件を満たしていることを確認する。

---

## エラーメッセージ設計

本セクションでは、バリデーション失敗時と起動失敗時のエラーメッセージパターンを定義する。

### FR-1に関連するエラーメッセージ

Orchestratorが誤った `subagent_type: 'Plan'` でsubagentを起動した場合に発生するエラーの実態は以下の通りである。フック（phase-edit-guard）はsubagentTypeを検証しないが、Task tool呼び出し時にAPIが返すエラーは次のような形式となる。

```
Error: Invalid subagent_type 'Plan'. Valid values are: general-purpose, Explore, Bash
```

このエラーはOrchestratorのTaskツール呼び出しに対して即座に返されるため、planningフェーズ全体が起動失敗となりワークフローが停止する。修正後は `general-purpose` に変更することで、このクラスのエラーが発生しなくなる。

### バリデーションエラーのパターン

workflow_nextが成果物バリデーション失敗を返す場合のエラーメッセージ形式は以下の通りである。具体的なエラー内容はMCPサーバーから返されるテキストに含まれる：

```
ValidationError: Artifact validation failed for phase 'planning'
  - Missing required section: ## サマリー
  - Duplicate line detected (count >= 3): "..."
  - Forbidden pattern found: (禁止語)
```

Orchestratorはこのメッセージをリトライプロンプトに含めてsubagentを再起動する。エラーメッセージの全文を `前回のバリデーション失敗理由` セクションにコードブロックで引用することが重要度の高い要件である。

### フック制限エラーのパターン

phase-edit-guardフックがBashコマンドを拒否する場合のエラーメッセージ形式は以下の通りである。現フェーズと許可されているカテゴリのスコープが提示される：

```
BlockedByHook: Command 'npm install' is not allowed in phase 'ui_design'
  Allowed categories: readonly
  Blocked categories: implementation, testing
  Hint: Use Read/Write/Edit tools instead of Bash for file operations
```

FR-3とFR-2の記述誤りが修正されることで、test_implフェーズのsubagentがnpm installを試みた際に正しくブロックされるようになる。修正前はドキュメントが `implementation` を許可していると誤解させるため、情報の信頼性に影響していた。

---

## APIレスポンス設計

本セクションでは、本タスクのワークフロー制御に使用するMCP APIのレスポンス形式を定義する。

### workflow_next のレスポンス形式

ui_designフェーズからdesign_reviewフェーズへの遷移要求のレスポンスは以下の形式で返される：

```json
{
  "taskId": "20260218_XXXXXX_P0修正の残存問題と新規発生問題の根本原因解決",
  "currentPhase": "design_review",
  "previousPhase": "ui_design",
  "status": "success",
  "message": "Moved to design_review phase. Awaiting user approval.",
  "artifactsValidated": "ui-design.md",
  "nextActions": "workflow_approve design"
}
```

バリデーション失敗時のレスポンスは以下の形式で返され、Orchestratorはこれを受けてsubagentを再起動する：

```json
{
  "taskId": "20260218_XXXXXX_P0修正の残存問題と新規発生問題の根本原因解決",
  "currentPhase": "ui_design",
  "status": "validation_failed",
  "message": "Artifact validation failed",
  "errors": "Missing section: ## CLIインターフェース設計, Line count insufficient: 32 < 50"
}
```

### workflow_complete_sub のレスポンス形式

並列フェーズのサブフェーズ完了時のレスポンス形式は以下の通りである。前回修正済みの実態を確認するため、本タスクでは並列フェーズは存在しないが、参照情報として記載する：

```json
{
  "taskId": "20260218_XXXXXX_...",
  "subPhase": "threat_modeling",
  "status": "completed",
  "remainingSubPhases": "planning",
  "message": "Sub-phase threat_modeling completed successfully"
}
```

### definitions.tsとの整合性確認API

最終検証ステップで使用するReadツールの呼び出し結果の期待形式を以下に示す。`subagentType` フィールドと `allowedBashCategories` フィールドの値が具体的に確認できることが前提となる：

```
Read結果例（definitions.tsの762行目付近）:
  subagentType: "general-purpose"
  allowedBashCategories: "readonly, testing"
  phaseId: "test_impl"
```

完全一致の確認はこの出力とCLAUDE.mdのテーブル記述を対比することで実施する。

---

## 設定ファイル設計

本セクションでは、修正対象のCLAUDE.mdにあるテーブルの修正前後の構造を比較し、変更内容を明確化する。

### フェーズ別Bashコマンド許可カテゴリテーブル（修正前）

修正前の記述では、test_impl・implementation・refactoringが1行にまとめられており、deployフェーズには過剰なカテゴリが設定されている。背景として、複数フェーズをまとめた際の個別設定の誤記が残存問題として継続していた。

| フェーズ | 許可カテゴリ（修正前） | 用途説明（修正前） |
|---------|---------------------|------------------|
| test_impl, implementation, refactoring | readonly, testing, implementation | テスト・実装・ビルドのため |
| deploy | readonly, implementation, deploy | デプロイ実行のため |

### フェーズ別Bashコマンド許可カテゴリテーブル（修正後）

修正後は各フェーズが独立した行として記述され、definitions.tsの正規設定値との完全一致が実現される。記述誤りを排除することで、Orchestratorがドキュメントを参照した際に正確な制限情報を取得できる状態となる。

| フェーズ | 許可カテゴリ（修正後） | 用途説明（修正後） |
|---------|---------------------|------------------|
| test_impl | readonly, testing | テストコード先行作成のため（TDD Redフェーズ） |
| implementation, refactoring | readonly, testing, implementation | 実装・ビルド・リファクタリングのため |
| deploy | readonly | デプロイ確認のため読み取りのみ |

### workflow-plugin/CLAUDE.mdのコードブロック（修正前後）

FR-1に対応する修正箇所のコードブロックの修正前後の比較を以下に示す。修正前は `subagent_type: 'Plan'` という存在しない値が記述されており、同コードブロック内の他行（threat_modeling）との不整合が存在していた。

修正前のコードブロック（330行目付近）：

```javascript
// parallel_analysisの例
Task({ prompt: '...threat_modeling...', subagent_type: 'general-purpose', model: 'sonnet', description: 'threat modeling' })
Task({ prompt: '...planning...', subagent_type: 'Plan', model: 'sonnet', description: 'planning' })
```

修正後のコードブロック（330行目付近）：

```javascript
// parallel_analysisの例
Task({ prompt: '...threat_modeling...', subagent_type: 'general-purpose', model: 'sonnet', description: 'threat modeling' })
Task({ prompt: '...planning...', subagent_type: 'general-purpose', model: 'sonnet', description: 'planning' })
```

### 設定ファイルの構造的な設計原則

CLAUDE.mdのテーブルは、フック（phase-edit-guard）が参照するdefinitions.tsの実装値を人間が読めるドキュメントとして表現したものである。このため、テーブルの各行は必ずdefinitions.tsの1フェーズエントリに対応させる必要がある。複数フェーズを1行にまとめることは、フェーズ個別の設定差異を隠蔽するリスクを生むため、今回のFR-3修正で廃止する。また設定ファイルの修正箇所特定においては、行番号ではなく文字列内容を基準とすることで、Edit操作の安全性と再現性を確保する。権限付与の観点では、「必要最小限の許可カテゴリ」を原則とし、過剰な権限付与はドキュメントの信頼性を損なうと同時に誤解の原因となることを認識する。
