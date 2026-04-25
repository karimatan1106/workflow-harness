# ワークフロー実行時バグ根本原因分析と修正 - 調査結果

## サマリー

- 目的: 前回のFQ-1〜FQ-4修正時に発見された追加問題の根本原因を特定し、修正方針を確立する
- 主要な決定事項: 4つの調査項目について現状コードを詳細に読み込み、問題点を分析した
- 次フェーズで必要な情報: 各問題の具体的なコード行番号と修正案（本ドキュメントの各セクションを参照）

## 調査結果

### FQ-1修正の完全性確認 - next.tsのハッシュチェック

`workflow-plugin/mcp-server/src/tools/next.ts` を調査した結果、testingフェーズとregression_testフェーズの両方でハッシュ重複チェックの扱いが異なることが判明した。

**testingフェーズ（line 267-270）:**
```
// ハッシュ重複チェックはtestingフェーズではスキップ
// 理由: record_test_result直後にnextを呼ぶと自己参照的な重複検出が発生するため
```
testingフェーズでは、ハッシュ重複チェックのブロック処理が完全にスキップされている。コメントが明示的に理由を説明しており、この修正は意図的かつ完全である。

**regression_testフェーズ（line 336-346）:**
```typescript
// ハッシュ重複チェック（regression_testフェーズでは自己参照が発生するためスキップ）
if (currentPhase !== 'regression_test') {
  const existingHashes = taskState.testOutputHashes || [];
  const hashResult = recordTestOutputHash(testResult.output, existingHashes);
  if (!hashResult.valid && testStrict) {
    return { success: false, message: `...` };
  }
}
```
regression_testフェーズについては、`if (currentPhase !== 'regression_test')` という条件によってハッシュ重複チェックをスキップしている。しかし、この条件は**regression_testフェーズのブロック内に置かれているため、実質的に常にスキップ**される自己矛盾したコードになっている。

この条件式はコードとしては機能しているが、構造的に問題がある。`currentPhase` は常に `'regression_test'` であるため、ハッシュチェックのブロックは絶対に実行されない。テスト真正性の観点から、意図したロジックは達成されているが、コードの可読性が著しく低い。

**`recordTestOutputHash`の実装（test-authenticity.ts）:**
関数はSHA-256ハッシュを計算し、既存ハッシュ配列と比較する。重複があれば`valid: false`を返す。この実装は正常に機能している。

**`record-test-result.ts`でのハッシュ保存（line 422-429）:**
```typescript
const existingHashes = currentPhase === 'regression_test' ? [] : (taskState.testOutputHashes || []);
const hashValidation = recordTestOutputHash(output, existingHashes);
```
`record-test-result.ts`のline 422では、regression_testフェーズでは空配列を渡すことで、同一ハッシュの再記録を許可している。この設計はコメントに明記されており（FR-3: regression_testフェーズでは同一ハッシュの再記録を許可）、意図的な実装である。

**FQ-1の完全性評価:** testingフェーズは修正済みで問題なし。regression_testフェーズのハッシュチェックは自己参照的な条件式（常に偽）で実装されており、機能はするが品質上の問題がある。

---

### FQ-2修正の完全性確認 - hasRedirection正規表現

`workflow-plugin/hooks/bash-whitelist.js` のline 268-273を調査した結果、`hasRedirection`関数は以下のように実装されている。

```javascript
function hasRedirection(part) {
  // '>>' はリダイレクト（追記）として常に検出
  if (part.includes('>>')) return true;
  // '>' の後ろが '=' の場合は比較演算子（>=）であるためリダイレクトではない
  // 正規表現: '>' の後ろが '=' でなければリダイレクトと判定
  return /(?<!=)>(?!=)/.test(part);
}
```

この正規表現 `/(?<!=)>(?!=)/` の解説:
- `(?<!=)`: 後読み否定で、直前が `=` でないことを確認する
- `>`: リダイレクト記号そのもの
- `(?!=)`: 先読み否定で、直後が `=` でないことを確認する

これにより `>=`（以上）と `<=`（以下）の `>` 部分を除外できる。ただし `<=` については `<` と `=` の組み合わせであり、`>` を含まないため、そもそも `hasRedirection` でのチェック対象外である。

**比較演算子別の動作確認:**
- `>=`: `(?<!=)` により前に `=` があるケースは除外できないが、`(?!=)` により直後が `=` の場合は除外される。`>=` の `>` は直後が `=` なので正しく除外される。
- `<=`: `>` を含まないのでこの関数は無関係。
- `==`: `>` を含まないのでこの関数は無関係。
- `!=`: `>` を含まないのでこの関数は無関係。

**正当なリダイレクトの検出確認:**
- `> file.txt`: `>` の後が `=` ではないので検出される（正しい）
- `>> file.txt`: `includes('>>') = true` で先に検出される（正しい）
- `2>`: `>` の前が数字であり、`(?<!=)` は `=` のみを除外するため検出される（正しい）
- `2>>`: `includes('>>') = true` で先に検出される（正しい）
- `&>`: `>` の前が `&` であり、`(?<!=)` は `=` のみを除外するため検出される（正しい）

**問題点の発見:** 正規表現 `/(?<!=)>(?!=)/` は `>` の前が `=` の場合（例: `=>`）をスキップする設計だが、ブラックリストのline 117では別のパターンが使われている。

```javascript
{ pattern: /(?<!=)> /, type: 'regex' },
```

ブラックリストの `regex` パターンはスペースを要求するが (`> `)、`hasRedirection` の正規表現はスペースを要求しない (`>`のみ)。この違いにより、`grep pattern>file` のようなスペースなしのリダイレクトはブラックリストでは検出されないが、`hasRedirection` では検出される。一貫性の観点で軽微な非整合が存在する。

**FQ-2の完全性評価:** 基本的な比較演算子（`>=`）との誤検出は修正されている。ただし、ブラックリストの `regex` パターンとの一貫性に軽微な差異がある。

---

### FQ-3修正の完全性確認 - definitions.tsの全フェーズカテゴリ

`definitions.ts`の各フェーズの`allowedBashCategories`と、CLAUDE.mdに記載されたフェーズ別Bashコマンド許可カテゴリ表を照合した結果を以下に示す。

**definitions.tsの実際の設定値:**

| フェーズ | definitions.tsの設定値 |
|---------|----------------------|
| research | readonly |
| requirements | readonly |
| threat_modeling | readonly |
| planning | readonly |
| state_machine | readonly |
| flowchart | readonly |
| ui_design | readonly |
| design_review | readonly |
| test_design | readonly |
| test_impl | readonly, testing |
| implementation | readonly, testing, implementation |
| refactoring | readonly, testing, implementation |
| build_check | readonly, testing, implementation |
| code_review | readonly |
| testing | readonly, testing |
| regression_test | readonly, testing |
| manual_test | readonly |
| security_scan | readonly, testing |
| performance_test | readonly, testing |
| e2e_test | readonly, testing |
| docs_update | readonly |
| commit | readonly, git |
| push | readonly, git |
| ci_verification | readonly |
| deploy | readonly |

**CLAUDE.mdの期待値との照合:**

CLAUDE.mdには以下の表が定義されている（抜粋）:

| フェーズ | 期待カテゴリ | definitions.ts実際値 | 一致状況 |
|---------|------------|---------------------|---------|
| research | readonly | readonly | 一致 |
| requirements | readonly | readonly | 一致 |
| threat_modeling | readonly | readonly | 一致 |
| planning | readonly | readonly | 一致 |
| state_machine | readonly | readonly | 一致 |
| flowchart | readonly | readonly | 一致 |
| ui_design | readonly | readonly | 一致 |
| design_review | readonly | readonly | 一致 |
| code_review | readonly | readonly | 一致 |
| manual_test | readonly | readonly | 一致 |
| docs_update | readonly | readonly | 一致 |
| test_impl | readonly, testing | readonly, testing | 一致 |
| implementation | readonly, testing, implementation | readonly, testing, implementation | 一致 |
| build_check | readonly, testing, implementation | readonly, testing, implementation | 一致 |
| testing | readonly, testing | readonly, testing | 一致 |
| regression_test | readonly, testing | readonly, testing | 一致 |
| security_scan | readonly, testing | readonly, testing | 一致 |
| performance_test | readonly, testing | readonly, testing | 一致 |
| e2e_test | readonly, testing | readonly, testing | 一致 |
| ci_verification | readonly | readonly | 一致 |
| commit | readonly, git | readonly, git | 一致 |
| push | readonly, git | readonly, git | 一致 |
| deploy | readonly | readonly | 一致 |

**注目すべき差異:** CLAUDE.mdでは `refactoring` フェーズについて `readonly, testing, implementation` と記載されているが、definitions.tsでも同様に `readonly, testing, implementation` が設定されており一致している。

**FQ-3の完全性評価:** 全フェーズのallowedBashCategoriesはCLAUDE.mdの仕様と一致している。修正は完全に適用されている。

---

### 修正プロセス中に発見された追加問題の分析

#### 問題1: testingフェーズでworkflow_nextが「テスト出力が以前と同一です」でブロックされ続けた

**根本原因の分析:**

`record-test-result.ts`のline 422において、testingフェーズでは`existingHashes`に`taskState.testOutputHashes`を使用している。同一のテスト出力（同一ハッシュ）を2回以上`record_test_result`で記録しようとすると、ハッシュ重複エラーが発生する。

この問題がtesting→regression_test遷移でブロックを引き起こしたのは、MCPサーバーがNode.jsのモジュールキャッシュにより古いバイナリを使い続けたためと推測される。コードを修正しても再起動しなければ修正が反映されず、結果として古いハッシュチェックロジックが動作し続ける。

`next.ts`のline 267-270のコメントには「ハッシュ重複チェックはtestingフェーズではスキップ（自己参照的な重複検出が発生するため）」と記載されており、この問題への対策として`next.ts`側でのチェックを削除したが、`record-test-result.ts`側でのハッシュ保存は継続している。

**自己参照問題のシナリオ:**
1. testingフェーズで`record_test_result`を実行 → ハッシュAをtestOutputHashesに保存
2. `workflow_next`を実行 → `next.ts`内でhashチェックを実行（現在はスキップ済み）
3. 再度同じ出力で`record_test_result`を実行 → ハッシュAが既存ハッシュと重複してブロック

現在の実装では`record-test-result.ts`でのブロックは残っているため、同一テスト出力の再記録は依然としてブロックされる。これはPR-12（コピペ検出）の要件として意図的に維持されている。

#### 問題2: forceTransition=trueでもハッシュチェックはバイパスされなかった

**根本原因の分析:**

`forceTransition`パラメータは`next.ts`のline 292において、ベースライン未設定時のregression_testへの遷移強制にのみ使用される。

```typescript
if (!forceTransition && !baselineSetByReq4) {
  const baseline = taskState.testBaseline;
  if (!baseline) {
    return { success: false, message: '...' };
  }
}
```

`forceTransition`はこのベースラインチェックをスキップするためにのみ設計されており、テスト出力ハッシュのチェックとは独立している。そのため、ハッシュ重複チェックは`forceTransition=true`であってもバイパスされない。これは設計上の意図であるが、ユーザー（Orchestrator）にとって誤解を招くパラメータ名になっている可能性がある。

#### 問題3: task-index.jsonのフェーズキャッシュ陳腐化（FIX-1既知バグ）

`discover-tasks.js`のTASK_INDEX_TTLは30秒（line 21）に短縮されているが、MCPサーバーがフェーズ遷移時にtask-index.jsonを更新しないという根本問題は残存している。

`discover-tasks.js`のdiscoverTasks()関数はキャッシュが有効な場合はtask-index.jsonから読み取り、TTL超過時のみworkflow-state.jsonを再スキャンしてキャッシュを更新する。MCP serverのupdateTaskPhase()はworkflow-state.jsonのみを更新するため、task-index.jsonのキャッシュがTTL以内（30秒以内）の場合は古いフェーズ情報が返される。

**現在の対策:** `phase-edit-guard.js`のline 1440-1443に記載のとおり、commit/pushフェーズのgit操作は状態確認と関係なく許可するという早期リターン処理（FIX-2）が実装済みである。この対症療法は機能しているが、根本原因（MCPサーバーがtask-index.jsonを更新しない）は未解決のままである。

---

### regression_testフェーズのハッシュチェック詳細分析

next.tsのline 336-346（regression_testブロック内）のコードを再確認する。

```typescript
// REQ-2: regression_test → parallel_verification 遷移時のテスト結果検証
if (currentPhase === 'regression_test') {
  // ...テスト結果の存在チェック、exitCode確認...

  // ハッシュ重複チェック（regression_testフェーズでは自己参照が発生するためスキップ）
  if (currentPhase !== 'regression_test') {
    // このブロックは絶対に実行されない（currentPhaseは常にregression_testのため）
    const existingHashes = taskState.testOutputHashes || [];
    const hashResult = recordTestOutputHash(testResult.output, existingHashes);
    if (!hashResult.valid && testStrict) {
      return { success: false, message: `...` };
    }
  }
```

このコードは構造的に`if (currentPhase !== 'regression_test')`という永遠にfalseになる条件を持つデッドコードになっている。機能的には問題ないが、将来的なコード保守者にとって誤解を招く原因となる。また、このデッドコードは`recordTestOutputHash`関数のimportを必要とするため、未使用のimportとしてlinterが警告を出す可能性がある。

`record-test-result.ts`側では、regression_testフェーズに対して空の既存ハッシュ配列（line 422）を渡すことで重複チェックを回避しており、ハッシュ衝突の問題はこちら側で既に解決されている。したがって`next.ts`のデッドコードブロックは削除して問題ない。

## 既存実装の分析

### ファイル構成と責任分担

各調査対象ファイルの役割を整理する。

- `next.ts`: workflow_nextツールの実装。フェーズ遷移時のバリデーションを担当する。testingとregression_testの両フェーズで、テスト結果のexitCode確認、真正性チェック、ハッシュチェックを実施する。
- `record-test-result.ts`: workflow_record_test_resultツールの実装。テスト結果の記録時点でハッシュを保存し、同一出力の再記録をブロックする。
- `test-authenticity.ts`: テスト真正性の検証ロジック。最小出力文字数チェック、フレームワーク構造チェック、タイムスタンプ整合性チェック、ハッシュ重複検出を実装している。
- `bash-whitelist.js`: Bashコマンドのホワイトリスト検証。フェーズ別許可コマンドの管理とリダイレクト検出を担当する。
- `definitions.ts`: フェーズ定義とガイド情報。各フェーズのallowedBashCategoriesを保持する。
- `discover-tasks.js`: タスク検索とtask-index.jsonキャッシュ管理。30秒TTLでキャッシュを更新するが、MCPサーバーとの同期は行わない。

### 問題の優先度評価

調査で発見された問題の優先度を評価する。

高優先度（コードの正確性に影響）の問題として、regression_testフェーズのデッドコード（next.ts line 336-346）が挙げられる。条件式が常にfalseになるため、意図したハッシュチェックは実行されず、コードの意図が不明確になっている。

中優先度（整合性・保守性に影響）の問題として以下が挙げられる。まず、`forceTransition`パラメータの役割がベースラインチェックのスキップに限定されているのに、名前が「強制遷移」を示唆しており誤解を招く可能性がある。次に、ブラックリストの`regex`パターン（スペース必須）と`hasRedirection`関数の正規表現（スペース不要）の間に軽微な不整合がある。

低優先度（実用上の影響なし）の問題として、task-index.jsonとworkflow-state.jsonの同期の欠如がある。TTLを30秒に短縮することで実用上は対処されているが、根本的な問題として残存している。

## 調査対象ファイル一覧

以下のファイルを調査した。

- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts` — 709行、フェーズ遷移ロジック全体を担当
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\record-test-result.ts` — 537行、テスト結果記録とハッシュ保存
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\test-authenticity.ts` — 194行、真正性検証関数群
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts` — 全フェーズ定義（37219トークン、大規模ファイル）
- `C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js` — 921行、Bashコマンドホワイトリスト
- `C:\ツール\Workflow\.claude\state\task-index.json` — キャッシュファイル（現在空）
