# 要件定義: VDB-1 retryCount reset修正

## サマリー

| ID | 決定事項 | 根拠 |
|----|---------|------|
| REQ-001 | `resetTask` に `state.retryCount = {}` を追加してリトライカウンターを全クリアする | `resetTask` は `completedPhases` と `subPhaseStatus` をクリアするが `retryCount` への代入がなく、リセット後も旧カウントが残存してハーネスがブロックされる |
| REQ-002 | `goBack` に `state.retryCount = {}` を追加してフェーズロールバック時にリトライカウンターを全クリアする | `goBack` はフェーズ差し戻し処理を行うが `retryCount` がそのまま残り、差し戻し先フェーズが即座にブロックされる |
| REQ-003 | 差し戻し先フェーズのみではなく全フェーズの `retryCount` をクリアする | 全クリアのほうが差し戻し先フェーズの選択ロジックより単純で誤りが少なく、差し戻し後は必ずクリーンな状態から再開できる |
| REQ-004 | `manager-lifecycle.test.ts` に `retryCount` クリアを検証する新規テストを2件追加する | 既存テスト群は `subPhaseStatus` のクリアを検証するが `retryCount` のクリアを検証しておらず、今回のバグを検出できない状態にある |
| REQ-005 | `types.ts` の `retryCount` フィールド型定義および `harness_next` のリトライ判定ロジックは変更しない | 修正対象は `manager.ts` 内の初期化漏れのみであり、公開 API や型定義の変更は今回のスコープ外とする |

## 機能要件

`workflow-harness/mcp-server/src/state/manager.ts` の `resetTask` 関数は、現在 `state.completedPhases` と `state.subPhaseStatus` をクリアするが `state.retryCount` の初期化処理を含まない。このため `harness_reset` を呼び出した後に同一フェーズで `harness_next` を実行すると、リセット前の失敗カウントがそのまま残存し `lifecycle.ts` L73 のリトライ上限判定（5回以上でブロック）に引っかかってハーネスが永続的にブロックされる。

同様に `goBack` 関数はフェーズの差し戻し処理を行うが `retryCount` の初期化を行わない。その結果、`harness_back` でフェーズをロールバックした後に同一フェーズで `harness_next` を呼び出すと差し戻し前のカウントが差し戻し先フェーズに引き継がれ、カウントが上限に達していた場合は即座にブロックされる。

修正内容は `resetTask` と `goBack` のそれぞれに `state.retryCount = {}` の1行を追加することで完結する。`retryCount` の型は `Record<string, number>` であり空オブジェクトの代入は型安全である。公開 API の変更は一切不要であり、既存の `incrementRetryCount` および `resetRetryCount` の動作は変更しない。

## 非機能要件

修正は既存のコードスタイルおよびコーディング規約に従い、最小限の変更行数で実装する。`state.retryCount = {}` の追加は `manager.ts` 内の2箇所（`resetTask` と `goBack`）に限定し、他のファイルへの波及を発生させない。

ビルドの健全性は `workflow-harness/mcp-server` ディレクトリで `npm run build` を実行することで確認する。TypeScript コンパイラが終了コード 0 を返すこと（型エラーゼロ）を条件とする。

テスト品質として `npm test` が全テスト通過で終了コード 0 を返すことを必須とする。既存テストのリグレッションを発生させてはならない。加えて `retryCount` のクリアを直接検証する新規テストを2件追加し、今後同様のバグが再発した際に自動的に検出できる状態にすること。

パフォーマンスへの影響はなく、空オブジェクトの代入はいずれのランタイムにおいても定数時間で完了する。

## 受入基準

**AC-1**: `harness_reset` 後に同一フェーズで `harness_next` を呼び出した際に、`retryCount` がリセットされた状態（0回）から開始されること。具体的には `resetTask` 実行後に `getState()` で取得した `state.retryCount` が空オブジェクト `{}` であること。

**AC-2**: `harness_back` でフェーズをロールバックした後に同一フェーズで `harness_next` を呼び出した際に、`retryCount` がクリアされた状態（0回）から開始されること。具体的には `goBack` 実行後に `getState()` で取得した `state.retryCount` が空オブジェクト `{}` であること。

**AC-3**: `workflow-harness/mcp-server` ディレクトリで `npm run build` を実行し、TypeScript コンパイラが終了コード 0 で完了すること（型エラーゼロ）。

**AC-4**: `workflow-harness/mcp-server` ディレクトリで `npm test` を実行し、全テストが通過して終了コード 0 が返されること。既存テストのリグレッションがなく、新規テスト2件（`resetTask retryCount クリア` および `goBack retryCount クリア`）がパスすること。

## NOT_IN_SCOPE

以下の項目は今回の修正スコープに含まれない。

`types.ts` における `retryCount` フィールドの型定義変更は行わない。現在の `Record<string, number>` 型で空オブジェクトの代入は型安全であり、型の変更は不要である。

`harness_next` のリトライ判定ロジック（`lifecycle.ts` L73 の上限5回判定）の変更は行わない。リトライ上限の値や判定条件の見直しは別タスクとして扱う。

`retryCount` の履歴を永続化する機能（例: どのフェーズで何回失敗したかをログに記録する機能）の追加は行わない。現在の設計は揮発性のカウンターであり、履歴管理の要件は存在しない。

差し戻し先フェーズのみをクリアする選択的初期化ロジックは実装しない。全クリアのほうが単純で誤りが少なく、差し戻し後はクリーンな状態から再開できるため全クリアを採用する。

`harness_reset` および `harness_back` の MCP ツールレイヤー（ハンドラー関数）の変更は行わない。修正は `manager.ts` の内部実装のみに限定する。

## OPEN_QUESTIONS
