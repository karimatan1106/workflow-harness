# Test Selection: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Summary

既存テスト2スイートから本タスクスコープに関連する13TCを選択。全て既存テストであり、新規テスト作成なし。defs-stage4.ts対象の3TC(TC-AC3-01, TC-AC3-02, TC-AC4-03)はスコープ外のため除外。

## Selection Criteria

- スコープ内の3ファイル(coordinator.md, worker.md, hearing-worker.md)に関連するテストを全て選択
- defs-stage4.ts を対象とするテスト(TC-AC3-01, TC-AC3-02 in first-pass, TC-AC4-03)はスコープ外のため除外
- 既にPASSしているテスト(200行制限等)もリグレッション検出のため選択に含める

## Selected Test Cases (13 TCs)

### first-pass-improvement.test.ts (9 TCs)

| TC ID | Description | AC | Status | Rationale |
|-------|-------------|-----|--------|-----------|
| TC-AC1-01 | coordinator.md Phase Output Rules section exists | AC-1 | Red | 修正対象。セクション追加で PASS 見込み |
| TC-AC1-02 | coordinator.md decisions quantitative rule | AC-1 | Red | 修正対象。decisions 5件以上ルール追加で PASS 見込み |
| TC-AC1-03 | coordinator.md artifacts enumeration rule | AC-1 | Red | 修正対象。artifacts 列挙ルール追加で PASS 見込み |
| TC-AC1-04 | coordinator.md next field must not be empty | AC-1 | Red | 修正対象。next 空欄禁止ルール追加で PASS 見込み |
| TC-AC2-01 | worker.md Edit Completeness section exists | AC-2 | Red | 修正対象。セクション追加で PASS 見込み |
| TC-AC2-02 | worker.md partial application prohibition | AC-2 | Red | 修正対象。部分適用禁止ルール追加で PASS 見込み |
| TC-AC2-03 | worker.md all-or-nothing principle | AC-2 | Red | 修正対象。全件適用ルール追加で PASS 見込み |
| TC-AC4-01 | coordinator.md is 200 lines or fewer | AC-4 | Green | リグレッション防止。追加後も制限内であること確認 |
| TC-AC4-02 | worker.md is 200 lines or fewer | AC-4 | Green | リグレッション防止。追加後も制限内であること確認 |

### hearing-worker-rules.test.ts (4 TCs)

| TC ID | Description | AC | Status | Rationale |
|-------|-------------|-----|--------|-----------|
| TC-AC1-01 | confirmation-only prohibition rule exists | AC-3 | Red | 修正対象。確認のみ質問禁止ルール追加で PASS 見込み |
| TC-AC2-01 | 2+ substantively different approaches required | AC-3 | Red | 修正対象。複数アプローチ提示ルール追加で PASS 見込み |
| TC-AC3-01 | merit and demerit required for each option | AC-3 | Red | 修正対象。メリット/デメリット記載ルール追加で PASS 見込み |
| TC-AC5-01 | file is 200 lines or fewer | AC-5 | Green | リグレッション防止。追加後も制限内であること確認 |

## Excluded Test Cases (3 TCs)

| TC ID | Description | Reason |
|-------|-------------|--------|
| TC-AC3-01 (first-pass) | harness_capture_baseline in implementation template | defs-stage4.ts 対象。本タスクスコープ外 |
| TC-AC3-02 (first-pass) | harness_update_rtm_status in code_review template | defs-stage4.ts 対象。本タスクスコープ外 |
| TC-AC4-03 (first-pass) | defs-stage4.ts is 200 lines or fewer | defs-stage4.ts 対象。本タスクスコープ外 |

## Execution Command

```
cd workflow-harness/mcp-server && npx vitest run src/__tests__/first-pass-improvement.test.ts src/__tests__/hearing-worker-rules.test.ts
```

## decisions

- D-001: 全13TCを既存テストから選択し、新規テスト作成は行わない。テストコードが正であり実装側を合わせる方針のため
- D-002: defs-stage4.ts対象の3TCはスコープ外として除外。別タスクで対応する
- D-003: 既にGreenの4TC(200行制限テスト)もリグレッション検出のため選択に含める
- D-004: テスト実行は2ファイルを同時指定し、1コマンドで全13TC実行する
- D-005: 選択TC全てが既存テストのため、テストコード自体への変更は一切行わない
- D-006: Red->Greenの期待遷移は10TC、Green維持は3TCである

## artifacts

- `docs/workflows/fix-failing-quality-rule-tests/test-selection.md` (本ドキュメント)

## next

implementation フェーズへ進む。planning.md の手順に従い coordinator.md, worker.md, hearing-worker.md の3ファイルを編集し、全13TC PASSを確認する。
