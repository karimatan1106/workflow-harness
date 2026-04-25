phase: test_selection
task: harness-report-fb-fixes
status: complete
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/test-design.md

## existingTestFiles

テストディレクトリ: workflow-harness/mcp-server/src/__tests__/
vitest設定: workflow-harness/mcp-server/vitest.config.ts (globals=true, environment=node, timeout=300000ms)

| File | Exists | Action |
|---|---|---|
| dod-extended.test.ts | yes | TC-AC2-01~04を追加 |
| manager-lifecycle.test.ts | yes | 参照のみ(直接変更なし) |
| manager-lifecycle-reset.test.ts | yes | TC-AC4-01~03を追加 |
| delegate-coordinator-readonly.test.ts | no | 新規作成(TC-AC1-01~03) |
| manager-write-rtm.test.ts | no | 新規作成(TC-AC3-01~03) |

## newTestFiles

| File | Location | Purpose |
|---|---|---|
| delegate-coordinator-readonly.test.ts | mcp-server/src/__tests__/ | AC-1: readonlyフェーズでのWrite/Edit除外検証 |
| manager-write-rtm.test.ts | mcp-server/src/__tests__/ | AC-3: RTM upsert動作の新規追加/上書き検証 |

## existingFileAdditions

| File | Location | TCs Added |
|---|---|---|
| dod-extended.test.ts | mcp-server/src/__tests__/ | TC-AC2-01~04: isStructuralLine()のテストケースID判定 |
| manager-lifecycle-reset.test.ts | mcp-server/src/__tests__/ | TC-AC4-01~03: goBack時のartifactHashesクリア検証 |

## vitestConfig

- path: workflow-harness/mcp-server/vitest.config.ts
- globals: true
- environment: node
- testTimeout: 300000
- include: デフォルト(**/*.test.ts)
- exclude: デフォルト
- 追加設定不要: 新規テストファイルはsrc/__tests__/直下に配置すれば自動検出される

## regressionStrategy

- TC-AC5-01: vitest run --reporter=verbose で全既存テストのパスを確認
- tsc --noEmit で型安全性を確認
- 既存95件超のテストファイルへの影響なし(変更は2ファイルへの追加、2ファイルの新規作成のみ)

## decisions

- TS-001: テストファイル配置先はmcp-server/src/__tests__/直下に統一(サブディレクトリ作成なし、既存慣例に従う)
- TS-002: dod-extended.test.tsは既存ファイルにdescribeブロックを追加する形式でTC-AC2-01~04を実装
- TS-003: manager-lifecycle-reset.test.tsは既存ファイルにdescribeブロックを追加する形式でTC-AC4-01~03を実装
- TS-004: delegate-coordinator-readonly.test.tsは新規作成。phaseGuideオブジェクトのモックでallowedToolsフィルタリングを検証
- TS-005: manager-write-rtm.test.tsは新規作成。applyAddRTMとapplyUpdateRTMStatusの連携動作を検証
- TS-006: vitest設定は変更不要。既存のデフォルトincludeパターンで新規テストファイルを自動検出

## artifacts

- docs/workflows/harness-report-fb-fixes/test-selection.md (this file)
- docs/workflows/harness-report-fb-fixes/test-design.md (input)

## next

implementationフェーズで、TS-001~TS-006の方針に従いテストファイル2件新規作成・2件追記し、TC-AC1-01~TC-AC5-01を全パスさせる。
