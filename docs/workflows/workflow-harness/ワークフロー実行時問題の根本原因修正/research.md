# ワークフロー実行時問題の根本原因修正 - 調査結果

## サマリー

前回タスク実行中に発生した5つの問題の根本原因をコードレベルで特定した。
問題1は `REVIEW_PHASES` への `test_design` 追加が意図的な設計であることを確認し、CLAUDE.md の記述との乖離を特定した。
問題2・3は `testing` フェーズのテンプレートに `sessionToken` の正しい取得方法と使用方法の説明が欠落していることを確認した。
問題4・5は `regression_test` および `testing` フェーズのテンプレートにワークフロー制御ツール禁止の明示的な指示が存在しないことを確認した。
修正対象は `definitions.ts` の2箇所（`testing` テンプレート、`regression_test` テンプレート）と、問題1については設計方針を決定した上で `REVIEW_PHASES` または `CLAUDE.md` のいずれかを修正する。

---

## 問題1の調査: test_designフェーズで workflow_approve が必要だった

### 根本原因の特定

調査対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts` 358行目

```typescript
export const REVIEW_PHASES: (PhaseName | SubPhaseName)[] = ['requirements', 'design_review', 'test_design', 'code_review'];
```

`test_design` が `REVIEW_PHASES` 配列に明示的に含まれている。この配列は `requiresApproval()` 関数（431行目）から参照される。

`workflow-plugin/mcp-server/src/tools/next.ts` の253行目でこのチェックが実行される。

```typescript
if (requiresApproval(currentPhase)) {
  return {
    success: false,
    message: `${currentPhase}フェーズはユーザー承認が必要です。workflow_approve で承認してください`,
  };
}
```

さらに `APPROVE_TYPE_MAPPING`（369行目）にも `test_design` が登録されている。

```typescript
test_design: { expectedPhase: 'test_design', nextPhase: 'test_impl' },
```

`approve.ts` の152行目には `workflow_approve` のツール説明に `test_design` が明記されている。

```
description: '...test_designフェーズでは "test_design"...'
```

### 問題の性質と判断

CLAUDE.md には「design_review と code_review のみが承認必要」という趣旨の記述があるが、コードレベルでは `requirements`・`design_review`・`test_design`・`code_review` の4フェーズが承認必要として実装されている。この乖離が混乱の原因である。

`test_design` への承認要件は `APPROVE_TYPE_MAPPING` の定義・`approve.ts` の説明文・`REVIEW_PHASES` の3箇所に一貫して実装されており、意図的な設計である可能性が高い。CLAUDE.md の記述が古くなっているか、または意図的に省略されていると推測される。

修正方針の候補として2つが考えられる。
- 選択肢A: `REVIEW_PHASES` から `test_design` を削除する（承認不要にする）
- 選択肢B: CLAUDE.md と subagentTemplate を更新して `test_design` が承認必要であることを明記する

---

## 問題2・3の調査: workflow_record_test_result のエラー分析

### 問題2の根本原因: sessionToken エラー

調査対象ファイル: `workflow-plugin/mcp-server/src/tools/helpers.ts` 103行目

`verifySessionToken()` 関数は、`taskState.sessionToken` が存在する場合に `sessionToken` パラメータを必須とする。

```typescript
if (taskState.sessionToken) {
  if (!sessionToken) {
    return {
      success: false,
      message: 'sessionTokenが必要です。このAPIはOrchestratorのみ実行可能です。',
    };
  }
  if (sessionToken !== taskState.sessionToken) {
    return {
      success: false,
      message: 'sessionTokenが無効です。',
    };
  }
}
```

現在の `testing` フェーズのテンプレートには、`sessionToken` をどこから取得するかの説明がない。subagent は Orchestrator から引数として受け取るべきだが、そのガイダンスが欠落している。

### 問題3の根本原因: 「テストフレームワーク構造なし」はブロックではない

調査対象ファイル: `workflow-plugin/mcp-server/src/tools/record-test-result.ts` 431行目

このチェックは `console.warn` のみで実装されており、処理はブロックされない。

```typescript
if (!hasFrameworkStructure) {
  console.warn('[record-test-result] テストフレームワークの構造が検出されませんでした。...');
}
```

前回の失敗は「テストフレームワーク構造なし」のブロックではなく、真正性検証（`validateTestAuthenticity`）または出力文字数不足（100文字以上必要）が原因だった可能性が高い。

### testing フェーズのテンプレートの現状

`definitions.ts` 878行目を確認した。現在のテンプレートに含まれる注意事項は以下の通りである。

```
## workflow_record_test_result 呼び出し時の注意
- output引数にはテストコマンドの標準出力をそのまま貼り付けること
- vitest/jestが出力する集計行の形式例: 「Test Files 3 passed (3)」...
- 同一の出力テキストを重複して送信した場合もブロックエラーとなる
```

以下の内容が欠落している。
- `sessionToken` は Orchestrator からプロンプト引数として受け取ること（MCPツールで自分で取得しない）
- `sessionToken` は `workflow_record_test_result` の呼び出し時のみ使用すること
- ワークフロー制御ツール（`workflow_next` 等）は呼び出してはならないこと

---

## 問題4・5の調査: regression_test サブエージェントのスコープ超過

### 根本原因の特定

調査対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts` 887行目

`regression_test` フェーズの `subagentTemplate` の全文を確認した。「workflow_next を呼び出すな」「ワークフロー制御ツールを使用するな」という禁止指示が存在しない。

`testing` フェーズのテンプレート（878行目）にも同様の禁止指示がない。

subagent が `sessionToken` を保持している場合、そのトークンを使って `workflow_next` や `workflow_complete_sub` を呼び出すことが技術的に可能になる。前回の問題では regression_test サブエージェントに `sessionToken` を渡したため、サブエージェントが自律的にフェーズ制御を行い `parallel_verification` の全4サブフェーズを実行してしまった。

### CLAUDE.md の設計意図との乖離

CLAUDE.md には「Orchestrator は Main Claude として動作し、各フェーズをsubagentに委譲する」「フェーズごとにTask toolでsubagentを起動」「workflow_next で次フェーズへ」という記述がある。この設計では Orchestrator のみが `workflow_next` を呼び出すことが前提となっている。

しかしテンプレートにその制約が記載されていないため、subagent が `sessionToken` を保有すると制御を奪取できてしまう。この状態は設計意図と実装の不整合である。

### 修正方針

`testing`（878行目）と `regression_test`（887行目）の両テンプレートに以下のセクションを追加する必要がある。

追加すべき内容の要点を以下に示す。
- このサブエージェントは `workflow_next`・`workflow_approve`・`workflow_complete_sub`・`workflow_start` などのワークフロー制御ツールを呼び出してはならない
- `sessionToken` を受け取った場合も、ワークフロー制御ツールには使用せず、`workflow_record_test_result` のみに使用すること
- `sessionToken` の値は Orchestrator からプロンプト引数として受け取り、MCP ツールで自分で取得しないこと

---

## 修正対象ファイルと箇所のまとめ

以下に修正が必要なファイルと行番号をまとめる。

修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`

- 878行目（testing の subagentTemplate）: sessionToken の使い方説明とワークフロー制御ツール禁止の指示を追加
- 887行目（regression_test の subagentTemplate）: sessionToken の使い方説明とワークフロー制御ツール禁止の指示を追加
- 358行目（REVIEW_PHASES）: 設計方針決定後に修正（問題1対応）

修正後の検証として、テスト実行（912件全パス）を確認する必要がある。CLAUDE.md の記述も必要に応じて更新する。
