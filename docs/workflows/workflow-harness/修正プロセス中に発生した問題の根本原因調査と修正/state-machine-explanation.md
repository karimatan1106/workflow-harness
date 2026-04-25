# ステートマシン図解説ドキュメント

## サマリー

本ドキュメントは、CLAUDE.md厳命23番の誤記修正およびmanual_test・e2e_testテンプレートの前提条件行重複防止ガイダンス追加にかかるステートマシン図の詳細説明である。

- **目的**: 修正プロセス（FR-1・FR-2・FR-3）の状態遷移フロー、成功時の分岐・失敗時の復帰ロジックを視覚化する。
- **評価スコープ**: CLAUDE.mdの厳命23番修正、definitions.tsの2つのテンプレート追記、ビルド・テスト・検証の各フェーズを対象。
- **主要な決定事項**: 3つの独立した修正タスク（FR-1・FR-2・FR-3）を並列実行しつつ、ビルド・テスト・検証は統一フローで実施。エラー発生時は各修正タスクへの復帰ポイントを確保。
- **検証状況**: ステートマシン図は spec.md の実装計画に基づいており、全状態（20+）と遷移（30+）を含む。
- **次フェーズで必要な情報**: 各状態の詳細条件、遷移トリガー、エラーハンドリングロジック、検証項目一覧。

---

## ステートマシン図の概要

本図は以下の3つの階層で構成されている。

### 層1: 要件確認フェーズ（初期状態）

```
Start → ValidateRequirements → {CheckCLAUDEmd, ReviewDefinitions}
```

修正プロセスは、CLAUDE.md と definitions.ts の構造を確認する2つの並列タスクから開始する。
この分岐は修正対象ファイルが異なるため、並列実行で効率化される。

### 層2: 3つの修正タスク（並列実行可能）

#### FR-1: CLAUDE.md厳命23番修正

```
CheckCLAUDEmd
  → FR1Implementation（728行特定）
  → FR1Complete（二層構造に修正）
```

- **修正内容**: sessionToken の使用ルールを「層1（Orchestrator直接呼び出し）」と「層2（subagent引き渡し）」に区別。
- **修正対象**: CLAUDE.md 728行目付近の1行のみ。
- **復帰ポイント**: ビルド・テスト失敗時は FR1Implementation へ戻る。

#### FR-2: manual_test テンプレート追記

```
ReviewDefinitions
  → FR2Planning（追記位置確定）
  → FR2Implementation（ガイダンス記述）
  → FR2Complete（テンプレート追記完了）
```

- **追記内容**: 前提条件行の一意化（TC番号付加・状態差異の明示）。
- **追記位置**: 「実行日時・環境情報行の一意化」セクション直後。
- **復帰ポイント**: ビルド・テスト失敗時は FR2Implementation へ戻る。

#### FR-3: e2e_test テンプレート追記

```
ReviewDefinitions
  → FR3Planning（追記位置確定）
  → FR3Implementation（E2E固有ガイダンス記述）
  → FR3Complete（テンプレート追記完了）
```

- **追記内容**: E2E固有の前提条件行一意化（SC番号付加・ブラウザ設定等）。
- **追記位置**: 「角括弧禁止パターン」セクション直後。
- **復帰ポイント**: ビルド・テスト失敗時は FR3Implementation へ戻る。

### 層3: 統一ビルド・テスト・検証フェーズ

```
FR1Complete, FR2Complete, FR3Complete
  → BuildValidation
  → {CompileSuccessful, CompileError}
  → TestExecution
  → {AllTestsPassed, TestFailures}
  → MCPServerRestart
  → SessionTokenVerification
  → ManualTestVerification
  → E2ETestVerification
  → VerificationComplete
  → End
```

3つの修正タスクが全て完了した後、統一フロー（ビルド・テスト・検証）に遷移する。
このフローは順序が固定され、エラー時は各修正タスクへの復帰を行う。

---

## 状態遷移の詳細

### Start（初期状態）

**入力**: 修正プロセス開始
**出力**: ValidateRequirements（要件確認へ遷移）

修正プロセスの開始状態。CLAUDE.md と definitions.ts の2つのファイルに対する修正を実施することが確認される。

---

### ValidateRequirements（要件確認）

**入力**: Start からの遷移
**出力分岐**:
- CheckCLAUDEmd: CLAUDE.md 厳命23番の確認
- ReviewDefinitions: definitions.ts の構造確認

この状態では、修正対象ファイルの構造を理解する。CLAUDE.md は Markdown ファイルで直接編集可能、definitions.ts は TypeScript テンプレート文字列で \n エスケープが必要という違いを認識する。

---

### CheckCLAUDEmd（CLAUDE.md厳命23番確認）

**入力**: ValidateRequirements からの遷移
**出力**: FR1Implementation（修正対象行の特定へ）

CLAUDE.md 内の厳命23番末尾にある sessionToken 関連の記述を確認。現行の「sessionTokenの使用先は workflow_record_test_result のみ」という記述が、Orchestrator による直接呼び出しまで禁止しているように読める誤記であることを確認する。

---

### ReviewDefinitions（definitions.ts構造確認）

**入力**: ValidateRequirements からの遷移
**出力分岐**:
- FR2Planning: manual_test テンプレート追記準備
- FR3Planning: e2e_test テンプレート追記準備

definitions.ts の manual_test・e2e_test サブエージェントテンプレートの構造を確認。追記位置（既存セクション直後）、エスケープ方式（シングルクォート、\n 改行）、テンプレート内容（ガイダンス、具体例、警告）を確認する。

---

### FR1Implementation（CLAUDE.md修正実装）

**入力**: CheckCLAUDEmd からの遷移
**出力**: FR1Complete（修正完了）
**失敗時復帰ポイント**: 後のビルド・テスト失敗時にこの状態に戻される

厳命23番の末尾1行を「二層構造」に書き換える実装フェーズ。変更内容:

現行:
```
- sessionTokenの取得先は `workflow_status` のみ、使用先は `workflow_record_test_result` のみに限定すること
```

修正後:
```
- sessionTokenの使用ルール（二層構造）:
  - 層1（Orchestratorによる直接呼び出し）: ...workflow_next, workflow_complete_sub, workflow_approve...
  - 層2（subagentへの引き渡し）: ...workflow_record_test_result目的に限定...
  - 取得先: sessionTokenは `workflow_status` を taskId 指定で呼び出すことで再取得可能...
```

---

### FR1Complete（CLAUDE.md修正完了）

**入力**: FR1Implementation からの遷移
**出力**: BuildValidation（ビルド確認へ）

FR-1 修正が完了。他の修正タスク（FR2Complete・FR3Complete）と同期して BuildValidation へ遷移する。

---

### FR2Planning（manual_testテンプレート追記位置確定）

**入力**: ReviewDefinitions からの遷移
**出力**: FR2Implementation（ガイダンス記述へ）

definitions.ts 内の manual_test サブエージェントテンプレートの追記位置を確定。
検索文字列: 「実行日時・環境情報行の一意化（FR-1: 重複行防止）」セクション直後。

---

### FR2Implementation（manual_testテンプレート追記実装）

**入力**: FR2Planning からの遷移
**出力**: FR2Complete（追記完了）
**失敗時復帰ポイント**: ビルド・テスト失敗時にこの状態に戻される

前提条件行の一意化ガイダンスをテンプレートに追記。内容:

- 問題パターン: 「- 前提条件: MCPサーバーが起動していること」を TC-1・TC-2・TC-3 で記述（重複エラー）
- 推奨パターン1: 「- TC-1の前提条件: MCPサーバーが起動していること（正常起動状態）」
- 推奨パターン2: 「- TC-2の前提条件: MCPサーバーが起動していること（前回テストからの継続起動状態）」
- 操作ステップの一意化方法も記述

---

### FR2Complete（manual_testテンプレート追記完了）

**入力**: FR2Implementation からの遷移
**出力**: BuildValidation（ビルド確認へ）

FR-2 修正が完了。同期して BuildValidation へ遷移する。

---

### FR3Planning（e2e_testテンプレート追記位置確定）

**入力**: ReviewDefinitions からの遷移
**出力**: FR3Implementation（E2E固有ガイダンス記述へ）

definitions.ts 内の e2e_test サブエージェントテンプレートの追記位置を確定。
検索文字列: 「テスト文書固有の角括弧禁止パターン（FR-3: e2e_test特化ガイダンス）」セクション直後。

---

### FR3Implementation（e2e_testテンプレート追記実装）

**入力**: FR3Planning からの遷移
**出力**: FR3Complete（追記完了）
**失敗時復帰ポイント**: ビルド・テスト失敗時にこの状態に戻される

E2E固有の前提条件行一意化ガイダンスをテンプレートに追記。内容:

- 問題パターン: 「- 前提条件: ブラウザが起動していること」を SC-1・SC-2・SC-3 で記述（重複エラー）
- 推奨パターン1: 「- SC-1の前提条件: ブラウザが起動していること（Chromiumヘッドレスモード）」
- 推奨パターン2: 「- SC-2の前提条件: ブラウザが起動していること（前シナリオの認証セッション引き継ぎ状態）」
- ブラウザ起動コマンド・URL ナビゲーションステップの一意化方法も記述

---

### FR3Complete（e2e_testテンプレート追記完了）

**入力**: FR3Implementation からの遷移
**出力**: BuildValidation（ビルド確認へ）

FR-3 修正が完了。同期して BuildValidation へ遷移する。

---

### BuildValidation（ビルド確認フェーズ）

**入力**: FR1Complete・FR2Complete・FR3Complete からの同期遷移
**出力分岐**:
- CompileSuccessful: コンパイルエラーなし → TestExecution へ
- CompileError: コンパイルエラー発生 → FR1Implementation / FR2Implementation / FR3Implementation への復帰

実行コマンド: `cd workflow-plugin/mcp-server && npm run build`

TypeScript コンパイルにより、definitions.ts の \n エスケープやシングルクォート処理が正しいか、構文エラーがないかを検証。エラー発生時は各修正タスク（FR1～FR3）に復帰し、修正内容を見直す。

---

### CompileSuccessful（コンパイル成功）

**入力**: BuildValidation からの遷移（コンパイル成功時）
**出力**: TestExecution（テスト実行へ）

TypeScript コンパイルが成功。次フェーズのテスト実行へ進む。

---

### CompileError（コンパイルエラー発生）

**入力**: BuildValidation からの遷移（コンパイル失敗時）
**出力分岐**:
- → FR1Implementation
- → FR2Implementation
- → FR3Implementation

コンパイルエラーが発生した場合、3つの修正タスクへ復帰。エラーメッセージから原因を特定し、該当する修正タスクを再実装する。

例：
- 「Unexpected token in template string」→ FR2・FR3 の \n エスケープ見直し
- 「Unterminated string」→ FR1・FR2・FR3 のシングルクォート処理見直し

---

### TestExecution（テスト実行フェーズ）

**入力**: CompileSuccessful からの遷移
**出力分岐**:
- AllTestsPassed: 全テスト合格・リグレッションなし → MCPServerRestart へ
- TestFailures: テスト失敗あり → FR1Implementation / FR2Implementation / FR3Implementation への復帰

実行コマンド: `cd workflow-plugin/mcp-server && npx vitest`

既存テストスイート全体の実行。修正の副作用による既存テスト失敗を検出。全ケースが通ることでリグレッションがないことを確認。

---

### AllTestsPassed（全テスト合格）

**入力**: TestExecution からの遷移（全テスト成功時）
**出力**: MCPServerRestart（MCPサーバー再起動へ）

既存テストスイートが全て合格。リグレッションなし。次フェーズの検証へ進む。

---

### TestFailures（テスト失敗）

**入力**: TestExecution からの遷移（テスト失敗時）
**出力分岐**:
- → FR1Implementation
- → FR2Implementation
- → FR3Implementation

テストが失敗した場合、3つの修正タスクへ復帰。失敗原因を分析し、該当する修正内容を見直す。

例：
- テンプレート文字列の構文エラー（ガイダンス内容）→ FR2・FR3 の内容見直し
- definitions.ts インポート順序エラー → FR1 の CLAUDE.md 修正内容確認
- sessionToken 関連のテストケース失敗 → FR1 の二層構造記述見直し

---

### MCPServerRestart（MCPサーバー再起動）

**入力**: AllTestsPassed からの遷移
**出力**: SessionTokenVerification（sessionToken二層構造動作確認へ）

MCPサーバープロセスを再起動。definitions.ts の変更がメモリキャッシュに反映されるようにする。
キャッシュ更新により、新たに追記したテンプレートガイダンスが次回の subagent 起動時に使用される。

---

### SessionTokenVerification（sessionToken二層構造動作確認）

**入力**: MCPServerRestart からの遷移
**出力**: ManualTestVerification（manual_testテンプレート検証へ）

CLAUDE.md 修正（二層構造）の正当性を検証。
- Orchestrator が workflow_next・workflow_complete_sub・workflow_approve 等に sessionToken を渡す動作が正しく機能するか。
- subagent へ sessionToken を引き渡す際、workflow_record_test_result 目的に限定されているか。
- workflow_status の taskId 指定呼び出しで sessionToken が正しく再取得されるか。

---

### ManualTestVerification（manual_testテンプレート前提条件一意化検証）

**入力**: SessionTokenVerification からの遷移
**出力**: E2ETestVerification（e2e_testテンプレート検証へ）

FR-2 追記（前提条件行一意化）の動作確認。
- TC番号付加ガイダンスが manual_test subagent に正しく伝わるか。
- 複数の TC でも前提条件行が重複しないか（TC-1・TC-2・TC-3 で異なる記述が可能か）。
- 操作ステップの一意化方法が明確に理解されるか。

---

### E2ETestVerification（e2e_testテンプレート前提条件一意化検証）

**入力**: ManualTestVerification からの遷移
**出力**: VerificationComplete（検証完了へ）

FR-3 追記（E2E固有ガイダンス）の動作確認。
- SC番号付加ガイダンスが e2e_test subagent に正しく伝わるか。
- ブラウザ設定・ヘッドレスモード等の E2E 固有状態差異による一意化が可能か。
- ブラウザ起動コマンド・URL ナビゲーション等の重複防止方法が機能するか。

---

### VerificationComplete（全項目検証完了）

**入力**: E2ETestVerification からの遷移
**出力**: End（修正プロセス完了へ）

3つの修正タスク（FR-1・FR-2・FR-3）、ビルド・テスト、および3つの検証項目が全て完了。
意図通りの動作が確認された。

---

### End（終了状態）

**入力**: VerificationComplete からの遷移
**出力**: なし（プロセス終了）

修正プロセス完了。CLAUDE.md と definitions.ts の修正がリポジトリに反映される準備が整った。

---

## エラーハンドリング戦略

### コンパイルエラー時の復帰

```
BuildValidation → CompileError → {FR1Implementation, FR2Implementation, FR3Implementation}
```

コンパイルエラーが発生した場合、以下の復帰ロジックが適用される:

1. エラーメッセージを分析
2. エラー原因から該当する修正タスクを特定
3. 当該タスクの実装フェーズへ復帰
4. 修正内容を見直し、再度ビルドへ進む

**復帰ポイントの配置により、修正内容の独立性が保証される。**

### テスト失敗時の復帰

```
TestExecution → TestFailures → {FR1Implementation, FR2Implementation, FR3Implementation}
```

テスト失敗時も同様に各修正タスクへ復帰。テストケースの失敗原因から該当タスクを特定し、修正内容を検証。

---

## 状態数と遷移数の統計

- **状態総数**: 20（Start、End、中間状態18）
- **遷移総数**: 30+（条件分岐含む）
- **並列実行可能なタスク**: FR-1、FR-2、FR-3（異なるファイルに対する独立修正）
- **同期ポイント**: BuildValidation（3つの修正完了後に統一フロー開始）
- **復帰ポイント**: 各修正タスクの実装フェーズ（エラー時のロールバック）

---

## 設計の特徴

### 1. 修正タスクの独立性

FR-1・FR-2・FR-3 は異なるファイルに対する修正のため、技術的に並列実行可能。
状態機械は分岐により並列フローを表現。

### 2. 統一ビルド・テストフロー

3つの修正の同期後、ビルド・テスト・検証は順序が固定される。
これにより全修正の整合性を確保する。

### 3. 復帰ポイントの配置

エラー発生時に各修正タスク（FR1～FR3）の実装フェーズへ復帰可能。
繰り返し修正が可能な設計。

### 4. 段階的な検証

- ビルド検証: 構文正当性（TypeScript）
- テスト検証: 機能リグレッション
- 動作検証: sessionToken・テンプレート・ガイダンスの実際の動作

段階的検証により、修正の品質を確保する。

---

## 次フェーズへの引き継ぎ情報

本ステートマシン図の以下の情報を次フェーズ（test_design フェーズ）で活用すること:

1. **FR-1 修正内容**: CLAUDE.md 厳命23番の二層構造
2. **FR-2・FR-3 追記内容**: 前提条件行一意化ガイダンスの具体例
3. **ビルド・テスト・検証の順序**: ステップバイステップ実行
4. **復帰ポイント**: エラー時の修正タスク割り当て

