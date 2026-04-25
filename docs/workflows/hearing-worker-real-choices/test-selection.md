# Test Selection: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: test_selection
size: large

## テスト実行計画

テストは2カテゴリに分離して実行する。

### 新規テスト: hearing-worker-rules.test.ts

ファイルパス: workflow-harness/mcp-server/src/__tests__/hearing-worker-rules.test.ts

対象TC:
- TC-AC1-01: hearing-worker.mdに確認形式禁止ルールが存在するか (regex検証)
- TC-AC2-01: hearing-worker.mdに2案以上ルールが存在するか (regex検証)
- TC-AC3-01: hearing-worker.mdにメリット・デメリット明記ルールが存在するか (regex検証)
- TC-AC5-01: hearing-worker.mdが200行以下か (split('\n').length検証)

実行コマンド: npx vitest run src/__tests__/hearing-worker-rules.test.ts

### 既存テスト: hearing-template.test.ts

ファイルパス: workflow-harness/mcp-server/src/__tests__/hearing-template.test.ts

対象TC:
- TC-AC4-01: defs-stage0.tsに具体例付き品質ルールが含まれるか
- TC-AC6-01: defs-stage0.tsが構文的に健全であること (インポート成功で確認)
- TC-AC7-01: 既存テストが全てパスすること

実行コマンド: npx vitest run src/__tests__/hearing-template.test.ts

## acTcMapping

- AC-1: TC-AC1-01 (hearing-worker-rules.test.ts)
- AC-2: TC-AC2-01 (hearing-worker-rules.test.ts)
- AC-3: TC-AC3-01 (hearing-worker-rules.test.ts)
- AC-4: TC-AC4-01 (hearing-template.test.ts)
- AC-5: TC-AC5-01 (hearing-worker-rules.test.ts)
- AC-6: TC-AC6-01 (hearing-template.test.ts)
- AC-7: TC-AC7-01 (hearing-template.test.ts)

## TDD Red期待

新規テスト(hearing-worker-rules.test.ts)は実装前に全てFAILする。hearing-worker.mdにはまだ品質ルールセクションが存在しないため、regex検証が全て不一致となる。

既存テスト(hearing-template.test.ts)は現時点でPASSする。defs-stage0.tsの変更後もPASS維持が求められる。

## decisions

- TS-001: テスト実行はvitest runで行う。ワーキングディレクトリはworkflow-harness/mcp-server/。
- TS-002: hearing-worker-rules.test.tsはfs.readFileSyncでMDファイルを読み込みregexマッチで検証する方式(TD-001踏襲)。
- TS-003: fileURLToPathでパス解決(TD-005踏襲)。日本語ディレクトリ対応済み。
- TS-004: TC-AC4-01はhearing-template.test.tsに追記する形で対応。defs-stage0.ts関連テストの集約を維持。
- TS-005: TDD Red-Green順守。hearing-worker-rules.test.tsは実装前に全FAILを確認してからGreenに移行する。

## artifacts

- docs/workflows/hearing-worker-real-choices/test-selection.md: spec: 7TCを2ファイルに分配。新規1ファイル+既存1ファイル活用のテスト実行計画。

## next

- criticalDecisions: TS-002(fs.readFileSync+regex方式)、TS-003(fileURLToPathパス解決)
- readFiles: workflow-harness/mcp-server/src/__tests__/hearing-template.test.ts
- warnings: TC-AC4-01の追記時に既存テストとの競合に注意
