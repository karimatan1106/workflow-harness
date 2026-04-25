## サマリー

本仕様書は workflow-harness の StateManager における retryCount リセット漏れバグの修正計画を記述する。
バグの根本原因は resetTask および goBack の両メソッドが state.retryCount を初期化しない点にある。
この漏れにより、リセットまたはロールバック後もフェーズのリトライカウンターが旧値を引き継ぎ、ハーネスが即座にブロックされる状態が生じる。
修正はそれぞれ1行の追加であり、既存の型定義・署名処理・ハーネスロジックへの影響はない。
テストファイルに2件の新規テストを追加してリグレッションを防止する。

- [PL-001][decision] resetTask に state.retryCount = {} を追加する — リセット後に全フェーズのリトライカウンターを確実にクリアするため
- [PL-002][decision] goBack に state.retryCount = {} を追加する — ロールバック後にリトライカウンターをクリアしてクリーンな状態で再開するため
- [PL-003][decision] manager-lifecycle.test.ts に resetTask 後の retryCount クリア検証テストを追加する — リグレッション防止のため
- [PL-004][decision] manager-lifecycle.test.ts に goBack 後の retryCount クリア検証テストを追加する — リグレッション防止のため
- [PL-005][decision] 型定義の変更は行わない — 既存の Record 型は空オブジェクト代入と互換しており変更不要なため

## 概要

本修正は workflow-harness/mcp-server/src/state/manager.ts における resetTask と goBack の2メソッドにおいて、state.retryCount の初期化が漏れているバグを修正する。
resetTask は completedPhases と subPhaseStatus をクリアするが retryCount を初期化しないため、リセット後も旧カウントが残存してハーネスがフェーズ再実行時に即座にブロックされる状態が生じていた。
goBack はフェーズ差し戻し処理を行うが retryCount がそのまま残存するため、差し戻し先フェーズが旧カウントを引き継いで即座にブロックされる問題が発生していた。
修正は最小限の1行追加であり、既存の型定義および harness_next のリトライ判定ロジックへの変更は不要である。
既存テスト群は retryCount のクリアを検証していないため、新規テストを2件追加してリグレッションを防止する。
TypeScript の型安全性を保ちながら空オブジェクト {} を代入することで、フィールドの存在有無にかかわらず一貫してカウンターをクリアできる。
後続の signAndPersist 呼び出しが HMAC 署名を再計算するため、retryCount のクリア後に追加の署名処理は不要である。

## 実装計画

本修正は5つの手順で実施し、各手順は独立して検証可能である。
修正対象は manager.ts の2箇所と manager-lifecycle.test.ts の2テストケースであり、変更規模は合計約22行の追加にとどまる。
既存の StateManager API・型定義・HMAC署名ロジックへの変更は一切行わないため、副作用リスクは最小限である。
実装後は npm run build でコンパイルエラーがないことを確認し、npm test で全テストが通過することを検証する。
レビュー観点はリトライカウンターが完全にクリアされること、既存テストがすべて通過すること、型エラーがゼロであることの3点である。

手順1: manager.ts の resetTask メソッド (L83) で completedPhases と subPhaseStatus のクリア後に state.retryCount = {} を追加する。
この変更によりタスクリセット操作がすべてのフェーズのリトライカウンターを完全に初期化するようになる。
resetTask はすでに completedPhases と subPhaseStatus を空にしているため、retryCount も同じタイミングでクリアすることが設計上一貫している。
手順2: manager.ts の goBack メソッド (L75) で state.phase = targetPhase の直後に state.retryCount = {} を追加する。
この変更によりフェーズロールバック操作がリトライカウンターをクリアし、差し戻し先フェーズで 0 から再開できるようになる。
手順3: manager-lifecycle.test.ts の resetTask describe ブロックに retryCount クリア検証テストを追加する。
手順4: manager-lifecycle.test.ts に goBack describe ブロックを新設して retryCount クリア検証テストを追加する。
手順5: npm run build と npm test で変更を検証し、終了コード 0 であることを確認する。

## 変更対象ファイル

本修正で変更するファイルは manager.ts と manager-lifecycle.test.ts の2ファイルのみである。
manager.ts は StateManager クラスを実装するファイルであり、タスク状態の読み書きと各種操作メソッドを提供する。
manager-lifecycle.test.ts は StateManager のライフサイクル操作（タスク作成・フェーズ進行・リセット等）を検証するテストファイルである。
両ファイルとも workflow-harness/mcp-server/src 配下に存在し、npm run build でコンパイルされ npm test で検証される。
変更規模は manager.ts で2行追加、manager-lifecycle.test.ts で約20行追加と最小限である。
変更後の npm run build は TypeScript のインクリメンタルコンパイルで数秒以内に完了し、追加の依存関係インストールも不要である。
変更後の npm test は既存テスト群のリグレッションがないことと新規2件の合格を同時に確認できる。
型定義ファイル types.ts および読み書き分離された manager-read.ts・manager-write.ts への変更は不要である。

### manager.ts の変更内容

manager.ts の resetTask メソッドは L80-88 に定義されており、L83 の連続代入式が修正対象である。
現在の L83 は `state.completedPhases = []; state.subPhaseStatus = {};` で終わっており、retryCount のクリアが欠落している。
修正後は `state.completedPhases = []; state.subPhaseStatus = {}; state.retryCount = {};` となり、3つのフィールドが一括クリアされる。
goBack メソッドは L69-78 に定義されており、L75 の `state.phase = targetPhase;` の直後に `state.retryCount = {};` を追加する。
この2箇所の修正により、ハーネスのリセット操作とロールバック操作の両方でリトライカウンターが確実にクリアされる。
state.retryCount の型は Record<string, number> であり、空オブジェクト {} の代入は TypeScript の型チェックを通過する。

### manager-lifecycle.test.ts の変更内容

manager-lifecycle.test.ts には既存の resetTask describe ブロック (L137-177) が存在しており、その末尾に新規テストを追加する。
新規テスト1は incrementRetryCount を複数フェーズで呼び出した後に resetTask を実行し、retryCount が空オブジェクトになることを検証する。
また goBack 操作の検証のため、sub-phase dependency enforcement describe ブロックの前に goBack describe ブロックを新設する。
新規テスト2は incrementRetryCount でカウンターを積み上げた後に goBack を実行し、retryCount が空オブジェクトになることを検証する。
両テストとも createMgr ヘルパー関数を使用する既存テストと同じパターンで記述できる。
toEqual({}) アサーションで retryCount フィールドが完全に空になったことを確認する。
