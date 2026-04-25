## サマリー

- [R-001][finding] resetTask (manager.ts L83) は completedPhases と subPhaseStatus をクリアするが state.retryCount を初期化しないため、リセット後も旧フェーズのカウンターが残存する
- [R-002][finding] goBack (manager.ts L74-75) はフェーズを差し戻すが state.retryCount をクリアしないため、差し戻し先フェーズで即座にリトライカウントが引き継がれる
- [R-003][finding] retryCount は types.ts L96 で `Record<string, number>` として定義されており、フェーズ名をキーとした辞書型である
- [R-004][finding] incrementRetryCount (manager.ts L184-189) は harness_next ハンドラ (lifecycle.ts L78) から呼び出され、DoD 失敗時にカウントを加算する
- [R-005][finding] resetRetryCount (manager.ts L193-198) は harness_next の DoD 成功時 (lifecycle.ts L105) に単一フェーズのキーのみ削除するが、全フェーズ一括クリアは実施していない
- [R-006][risk] リトライ上限は lifecycle.ts L73 で getRetryCount が 5 以上の場合にエラーを返す実装であり、カウンターが残存すると同フェーズへの再進入が永続的にブロックされる
- [R-007][finding] manager-lifecycle.test.ts の resetTask テスト群 (L137-177) には retryCount のクリア検証が存在せず、現バグを検出できていない

## 調査結果

本調査では workflow-harness/mcp-server/src/state/manager.ts を中心に、retryCount フィールドの管理に関わるすべての関数を調査した。
バグの直接原因は resetTask (L83) と goBack (L74-75) の2メソッドが state.retryCount をクリアしない実装になっている点である。
lifecycle.ts の handleHarnessNext (L73) では getRetryCount の戻り値が 5 以上の場合にエラーを返す仕様であり、カウンターが残存すると再進入が即座にブロックされる。
調査の結果、修正対象は manager.ts の2箇所のみであり、他のファイルへの変更は不要であることが確認できた。
型定義 (types.ts L96) は `retryCount?: Record<string, number>` というオプショナルなレコード型であり、`{}` の代入は完全に型安全で変更不要である。

### manager.ts の resetTask 実装 (L80-88)

resetTask メソッドは L83 で `state.completedPhases = []` と `state.subPhaseStatus = {}` を代入するが、`state.retryCount` への代入は行われていない。
その結果、リセット後に同じ taskId を使って同じフェーズに再進入すると、以前の失敗で蓄積されたカウンターがそのまま残っている。
たとえば research フェーズで 5 回 DoD 失敗してリセットした場合、リセット直後の harness_next 呼び出しでも getRetryCount が 5 を返すため、即座に「リトライ上限超過」エラーが発生する。
この状態はタスクを削除して再作成しない限り解消されないため、ハーネスが永続的にブロックされる。
修正は `state.retryCount = {}` を L83 の代入群に追加することで完全に解決できる。

### manager.ts の goBack 実装 (L69-78)

goBack メソッドは targetPhase を state.phase に設定し、completedPhases を切り詰める処理を行うが、retryCount のクリアは実施しない。
差し戻し先フェーズに過去の失敗カウントが残っている場合、差し戻し直後の harness_next でそのカウントが読み取られ、上限チェックに影響する。
たとえばフェーズ A で 4 回失敗した後 goBack でフェーズ A に戻ると、次の 1 回の DoD 失敗で即座に上限 5 に達しブロックされる。
goBack は部分的な差し戻しであるため、差し戻し先フェーズ以降のすべてのカウントをクリアするか、差し戻し先フェーズのカウントのみをクリアするかを設計上決定する必要がある。
最も安全な実装は `state.retryCount = {}` で全フェーズのカウントをクリアすることであり、これにより差し戻し後は必ずクリーンな状態から再開できる。

### retryCount の型定義 (types.ts L96)

retryCount フィールドは `Record<string, number>` 型で、フェーズ名（文字列）をキーとしてリトライ回数（数値）を保持する。
フィールド自体はオプショナルであるため、新規タスクでは初期値が設定されていない（undefined）。
incrementRetryCount (L186) では `if (!state.retryCount) state.retryCount = {}` というガード節で初期化している。
resetTask や goBack がこのガード節を流用せず直接 `state.retryCount = {}` を代入することで、フィールド有無に関わらず確実にクリアできる。
型定義上 `{}` の代入は完全に型安全であり、追加の型変更は不要である。

### incrementRetryCount と getRetryCount の呼び出し箇所

lifecycle.ts の handleHarnessNext (L70-78) は引数の retryCount が 1 以上の場合に getRetryCount でチェックし、5 以上ならエラーを返す。
チェック通過後は incrementRetryCount を呼び出してカウントを加算する。
DoD 成功時は L105 で resetRetryCount を呼び出すが、これは単一フェーズキーの削除 (`delete state.retryCount[phase]`) であり、全フェーズクリアではない。
resetRetryCount は対象フェーズのカウントが存在する場合のみ実行されるため、空の retryCount オブジェクトに対しては何もしない（余計な書き込みが発生しない）。
handleHarnessBack や handleHarnessReset のハンドラコードは manager の goBack/resetTask を呼ぶだけであり、retryCount に触れる追加処理を持っていない。

## 既存実装の分析

resetTask の L83 では `state.completedPhases = []` と `state.subPhaseStatus = {}` が明示的にクリアされている。
設計者が completedPhases と subPhaseStatus はリセット対象と認識していたことは明確であるが、retryCount については見落とされている。
goBack の L74 では `state.completedPhases.slice(0, idx)` でフェーズ履歴を切り詰めており、差し戻し後の状態を一貫させようとする設計意図がある。
しかし retryCount は completedPhases と同様にフェーズ進行と紐付いた状態であり、差し戻し時に同じく整理されるべきである。
manager-lifecycle.test.ts の resetTask テスト群 (L137-177) は completeSubPhase のクリアを検証している (L169-176) が、retryCount のクリアを検証するテストケースが存在しない。
この欠落がバグを見逃す原因となっており、テストの追加が必要である。
現行の resetRetryCount は単一フェーズ削除のみであり、タスクレベルの全フェーズクリアを担う API が存在しない。
修正は StateManager 内部での実装変更で完結し、公開 API の変更は不要である。

## 実装アクション一覧

1. `manager.ts` の resetTask メソッド (L83) に `state.retryCount = {}` を追加する。修正後のコード: `state.completedPhases = []; state.subPhaseStatus = {}; state.retryCount = {}; state.phase = targetPhase;`
2. `manager.ts` の goBack メソッド (L74-75) に `state.retryCount = {}` を追加する。修正後のコード: `if (idx !== -1) state.completedPhases = state.completedPhases.slice(0, idx); state.retryCount = {}; state.phase = targetPhase;`
3. `manager-lifecycle.test.ts` の resetTask describe ブロックに新テストを追加する。内容: incrementRetryCount を 3 回呼び出した後 resetTask を実行し、getRetryCount が 0 を返すことを検証する。
4. `manager-lifecycle.test.ts` に goBack 用のテストを追加する。内容: incrementRetryCount を 3 回呼び出した後 goBack を実行し、getRetryCount が 0 を返すことを検証する。
5. `npm run build` でビルドエラーがないことを確認する。
6. `npm test` で既存テストに回帰がないことを確認し、新規追加テストが PASS することを確認する。

## 暗黙の制約・Magic Number 一覧

本調査で判明した暗黙的な数値制約を以下に記録する。これらは実装フェーズで参照すべき固定値である。
最も重要な制約は lifecycle.ts L73 の上限値 5 であり、この値を超えるとハーネスが永続的にブロックされる。
3 という閾値は VDB-1 警告を表示するための値であり、ユーザーへの早期警告に使用される。
retryCount の引数デフォルト値 1 は harness_next の呼び出し時に retryCount 引数を省略した場合に使われる値である。
testResults の output 切り詰め上限 5000 文字はログの肥大化を防ぐための制約であり本タスクには直接関係しない。

| 値 | 用途 | 根拠・出典 |
|----|------|-----------|
| 5 | リトライ上限回数 (RLM-1) | lifecycle.ts L73: `if (currentRetry >= 5)` |
| 3 | VDB-1 警告閾値 | lifecycle.ts L96: `retryCount >= 3` で VDB-1 警告を表示 |
| 1 | retryCount 引数デフォルト値 | lifecycle.ts L70: `Number(args.retryCount ?? 1)` |
| 5000 | testResults output 切り詰め文字数 | manager.ts L122: `output.slice(0, 5000)` |

## 依存バージョン固有挙動

本修正に関わるランタイムおよびツールのバージョン固有挙動を以下に記録する。
TypeScript において `Record<string, number>` への空オブジェクト `{}` の代入はすべてのバージョンで型安全であり、特別な回避策は不要である。
Node.js においてオブジェクトへの直接代入と delete 演算子はどちらも定数時間で完了するため、パフォーマンス上の懸念はない。
vitest のモジュールリセット (`vi.resetModules`) は状態管理テストで使用されるパターンであり、新規テストも同じパターンで記述できる。
使用するすべてのライブラリはプロジェクト設定に従ったバージョンであり、この修正はバージョン依存の挙動を持たない。

| ライブラリ/RT | バージョン | 固有の挙動・回避策 |
|-------------|-----------|-----------------|
| TypeScript | プロジェクト設定に従う | `Record<string, number>` への `{}` 代入は型安全。特別な回避策不要 |
| Node.js | プロジェクト設定に従う | `delete obj[key]` と `obj = {}` はどちらも O(1) 相当。パフォーマンス差はない |
| vitest | プロジェクト設定に従う | `vi.stubEnv` / `vi.resetModules` のパターンは既存テストと同一。新テストも同パターンで動作する |
