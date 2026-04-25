# Test Selection: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

dead code 除去タスクのテスト選定。全テストケースは CLI 検証（grep, ls, npm, vitest）で実施する。
新規テストファイルの作成は不要。test-design.md で定義した6件のテストケースを全て採用する。

## decisions

- TC-AC1-01 を採用する。grep "harness_delegate_coordinator" tool-gate.js による静的検証は、allowlist からの削除確認に必要十分であり、実行時テストよりコスト効率が高い
- TC-AC2-01 を採用する。grep "coordinator subprocess" stream-progress-tracker.ts による静的検証は、JSDoc 修正確認の最小コスト手段である
- TC-AC3-01 を採用する。ls/stat による dist/ 内12ファイルの不在確認は、ファイル削除の直接的証拠となる。ワイルドカード展開で delegate-coordinator.*, delegate-work.*, coordinator-spawn.* の4拡張子(.js, .js.map, .d.ts, .d.ts.map)を網羅する
- TC-AC3-02 を採用する。npm run build の exit code 0 確認は、削除ファイルが再生成されないことと、残存参照によるコンパイルエラーがないことを同時に検証する
- TC-AC4-01 を採用する。vitest run による全テストパスは、dead reference 除去がランタイム動作に影響しないことのリグレッション保証である
- TC-AC5-01 を採用する。grep -r "harness_delegate_coordinator" workflow-harness/ によるソースツリー全体走査は、散在する残存参照がゼロであることの最終保証である。dist/ と node_modules/ は走査対象から除外する
- 自動テストファイル新規作成は行わない。変更内容がロジック変更を含まず、既存テストパス + CLI 静的検証で品質保証が成立するため

## Selected Test Cases

| TC ID | AC | 検証コマンド | 期待結果 |
|-------|-----|-------------|---------|
| TC-AC1-01 | AC-1 | grep "harness_delegate_coordinator" tool-gate.js | 一致ゼロ |
| TC-AC2-01 | AC-2 | grep "coordinator subprocess" stream-progress-tracker.ts | 一致ゼロ |
| TC-AC3-01 | AC-3 | ls dist/tools/handlers/delegate-coordinator.* delegate-work.* coordinator-spawn.* | 全て不在 |
| TC-AC3-02 | AC-3 | npm run build | exit code 0 |
| TC-AC4-01 | AC-4 | vitest run | 全テスト pass |
| TC-AC5-01 | AC-5 | grep -r "harness_delegate_coordinator" workflow-harness/ | 一致ゼロ |

## Excluded Tests

該当なし。test-design.md で定義した6件全てを採用。除外理由が存在するテストケースはない。

## Execution Order

1. TC-AC3-02: npm run build (ビルド成功が後続検証の前提)
2. TC-AC3-01: dist/ ファイル不在確認 (ビルド後に実施)
3. TC-AC1-01: tool-gate.js grep 検証
4. TC-AC2-01: stream-progress-tracker.ts grep 検証
5. TC-AC5-01: ソースツリー全体 grep 走査
6. TC-AC4-01: vitest run リグレッション (最も実行時間が長いため最後)

## artifacts

- test-selection.md: 本ドキュメント。テストケース6件選定、実行順序定義、AC全件カバレッジ確認済み

## next

implementation フェーズ: scope-definition.md の Change Inventory に従い、tool-gate.js 編集、stream-progress-tracker.ts 編集、dist/ 12ファイル削除を実施する
