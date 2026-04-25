# Test Design: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Summary

既存テスト2スイート(計10件)をそのままテストケースとして採用する。テストコードが正であり、agentファイルの実装をテストに合わせる方針のため、新規テスト作成は不要。

## Test Strategy

既存テストファイルがテストケースの実体である。本ドキュメントはテストとACの対応関係を定義し、実行手順を明確化する。

- テストフレームワーク: vitest
- テスト実行コマンド: `cd workflow-harness/mcp-server && npx vitest run src/__tests__/first-pass-improvement.test.ts src/__tests__/hearing-worker-rules.test.ts`
- テストコード変更: なし（テストが正、実装を合わせる）

## Test Cases

### TC-AC1-01: coordinator.md Phase Output Rules セクション存在

- AC: AC-1
- Requirement: F-001 (Phase Output Rules section)
- File: first-pass-improvement.test.ts (TC-AC1-01 Phase Output Rules heading)
- Precondition: coordinator.md に `## Phase Output Rules` 見出しが存在すること
- Verification: `expect(content()).toContain('## Phase Output Rules')`
- Expected: PASS (AC-1 Phase Output Rules section verified)

### TC-AC1-02: coordinator.md decisions 5件以上ルール

- AC: AC-1
- Requirement: F-001 (decisions quantitative rule)
- File: first-pass-improvement.test.ts (TC-AC1-02 decisions count rule)
- Precondition: coordinator.md に decisions の定量ルール文言が記載されていること
- Verification: `expect(content()).toMatch(/decisions.*5件以上/)`
- Expected: PASS (AC-1 decisions 5件以上 rule verified)

### TC-AC2-01: worker.md Edit Completeness セクション存在

- AC: AC-2
- Requirement: F-002 (Edit Completeness section)
- File: first-pass-improvement.test.ts (TC-AC2-01 Edit Completeness heading)
- Precondition: worker.md に `## Edit Completeness` 見出しが存在すること
- Verification: `expect(content()).toContain('## Edit Completeness')`
- Expected: PASS (AC-2 Edit Completeness section verified)

### TC-AC2-02: worker.md 部分適用禁止ルール

- AC: AC-2
- Requirement: F-002 (partial apply prohibition rule)
- File: first-pass-improvement.test.ts (TC-AC2-02 partial apply prohibition)
- Precondition: worker.md に部分適用の禁止文言が記載されていること
- Verification: `expect(content()).toMatch(/部分適用.*禁止/)`
- Expected: PASS (AC-2 partial apply prohibition verified)

### TC-AC3-01: hearing-worker.md 確認のみ質問禁止

- AC: AC-3
- Requirement: F-003 (confirmation-only question prohibition)
- File: hearing-worker-rules.test.ts (TC-AC3-01 confirmation prohibition)
- Precondition: hearing-worker.md に確認のみの質問を禁止する文言が存在すること
- Verification: `expect(content).toMatch(/確認.*禁止/)` 及び禁止キーワード存在
- Expected: PASS (AC-3 confirmation-only question prohibition verified)

### TC-AC3-02: hearing-worker.md 2以上アプローチ提示

- AC: AC-3
- Requirement: F-003 (multiple approach presentation)
- File: hearing-worker-rules.test.ts (TC-AC3-02 approach presentation)
- Precondition: hearing-worker.md に複数アプローチ提示の要求文言が存在すること
- Verification: `expect(content).toMatch(/2.*以上/)` 及び `異なる` キーワード存在
- Expected: PASS (AC-3 multiple approach presentation verified)

### TC-AC4-01: first-pass-improvement.test.ts artifacts/next ルール PASS

- AC: AC-4
- Requirement: F-001 (artifacts enumeration and next non-empty rule)
- File: first-pass-improvement.test.ts (TC-AC4-01 artifacts and next rules)
- Precondition: coordinator.md に artifacts 列挙ルールと next 空欄禁止ルールが存在すること
- Verification: TC-AC1-03 (`artifacts.*列挙`) と TC-AC1-04 (`next.*空欄禁止`) が PASS
- Expected: PASS (AC-4 artifacts enumeration and next non-empty verified)

### TC-AC4-02: first-pass-improvement.test.ts worker 全件適用 PASS

- AC: AC-4
- Requirement: F-002 (worker full-apply rule)
- File: first-pass-improvement.test.ts (TC-AC4-02 worker full-apply rule)
- Precondition: worker.md に全件適用の文言が記載されていること
- Verification: TC-AC2-03 (`全件適用` 文字列含む) が PASS
- Expected: PASS (AC-4 worker full-apply rule verified)

### TC-AC5-01: hearing-worker-rules.test.ts メリット/デメリット PASS

- AC: AC-5
- Requirement: F-003 (merit and demerit verification)
- File: hearing-worker-rules.test.ts (TC-AC5-01 merit-demerit check)
- Precondition: hearing-worker.md にメリットとデメリットの両方の文言が存在すること
- Verification: TC-AC3-01 (`メリット` と `デメリット` の両方にマッチ)
- Expected: PASS (AC-5 merit and demerit presence verified)

### TC-AC5-02: hearing-worker-rules.test.ts 200行制限 PASS

- AC: AC-5
- Requirement: F-003 (200-line limit verification)
- File: hearing-worker-rules.test.ts (TC-AC5-02 line count check)
- Precondition: hearing-worker.md が200行以下であること（現状27行 + 追加分で50行未満）
- Verification: TC-AC5-01 (`lineCount <= 200`)
- Expected: PASS (既にPASS済み、追加後も維持)

## acTcMapping

| AC | TC | Test File | Status |
|----|-----|-----------|--------|
| AC-1 | TC-AC1-01 | first-pass-improvement.test.ts | Red -> Green |
| AC-1 | TC-AC1-02 | first-pass-improvement.test.ts | Red -> Green |
| AC-2 | TC-AC2-01 | first-pass-improvement.test.ts | Red -> Green |
| AC-2 | TC-AC2-02 | first-pass-improvement.test.ts | Red -> Green |
| AC-3 | TC-AC3-01 | hearing-worker-rules.test.ts | Red -> Green |
| AC-3 | TC-AC3-02 | hearing-worker-rules.test.ts | Red -> Green |
| AC-4 | TC-AC4-01 | first-pass-improvement.test.ts | Red -> Green |
| AC-4 | TC-AC4-02 | first-pass-improvement.test.ts | Red -> Green |
| AC-5 | TC-AC5-01 | hearing-worker-rules.test.ts | Red -> Green |
| AC-5 | TC-AC5-02 | hearing-worker-rules.test.ts | Already Green |

## decisions

- D-001: 既存テストファイル2つをそのままテストケースとして採用する。新規テスト作成は行わない。テストが正であるため。
- D-002: TC IDは既存テストコード内のTC命名(TC-AC1-01等)に準拠する。hearing-worker-rules.test.tsのTC-AC1-01はfirst-pass-improvement.test.tsのTC-AC1-01と別スイートであり衝突しない。
- D-003: テスト実行は vitest run で2ファイルを同時指定する。個別実行は不要。
- D-004: 200行制限テスト(TC-AC4-01〜03, TC-AC5-01)は既にPASS済みだが、追加後の行数増加でも制限内であることをTC-AC5-02で確認する。
- D-005: テストの正規表現パターンに正確にマッチする文言を実装に使用する方針を維持する。テスト変更は行わない。

## artifacts

- test-design.md: 本ドキュメント (`docs/workflows/fix-failing-quality-rule-tests/test-design.md`)

## next

implementation フェーズへ進む。planning.md の Step 1-3 に従い3ファイルを編集し、Step 4 でテスト全件PASSを確認する。
