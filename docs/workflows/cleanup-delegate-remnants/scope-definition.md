# Scope Definition: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

harness_delegate_coordinator MCP tool は既に削除済みだが、参照の残骸が3箇所に残存している。
これらを除去し、dist/ を再ビルドして整合性を回復する。

## In-Scope Files

| # | File | Change |
|---|------|--------|
| 1 | workflow-harness/hooks/tool-gate.js (L11) | HARNESS_LIFECYCLE Set から `harness_delegate_coordinator` を削除 |
| 2 | workflow-harness/mcp-server/src/tools/handlers/stream-progress-tracker.ts (L2) | JSDoc "coordinator subprocess" を実態に即した記述に修正 |
| 3 | workflow-harness/mcp-server/dist/tools/handlers/delegate-coordinator.* (4 files) | 削除 |
| 4 | workflow-harness/mcp-server/dist/tools/handlers/delegate-work.* (4 files) | 削除 |
| 5 | workflow-harness/mcp-server/dist/tools/handlers/coordinator-spawn.* (4 files) | 削除 |

## Out-of-Scope

- pre-tool-guard.sh: delegate検出ロジックなし。変更不要。
- MCP tool定義ファイル (src/tools/definitions/): 既に削除済み。
- tool-gate.js の detectLayer() ロジック: 正常動作確認済み。変更しない。
- dist/state/manager.js 内の "delegate" コメント: 内部設計パターンの説明であり、削除対象ツールとは無関係。

## Decisions

- HARNESS_LIFECYCLE Set からの削除は1行変更。存在しないツール名を allowlist に残すとセキュリティ上の攻撃面となるため除去する。
- stream-progress-tracker.ts の JSDoc は "coordinator subprocess" が実態と乖離しているため "subagent" に修正する。クラス動作は変更しない。
- dist/ 内の12ファイル(delegate-coordinator, delegate-work, coordinator-spawn 各4ファイル)は対応するsrcが存在しないため手動削除する。
- dist/ 削除後に npm run build で再ビルドし、削除したファイルが再生成されないことを確認する。
- dist/state/manager.js 内の "delegate" コメントはスコープ外とする。内部メソッド委譲パターンの説明であり、削除済みツールとは無関係である。
- テスト計画: tool-gate.js で harness_delegate_coordinator が拒否されることを grep で確認。ビルド成功を CI 通過で確認。

## Acceptance Criteria

- AC-1: tool-gate.js HARNESS_LIFECYCLE Set に harness_delegate_coordinator が含まれないこと
- AC-2: stream-progress-tracker.ts の JSDoc から "coordinator subprocess" 表現が除去されていること
- AC-3: dist/ 内に delegate-coordinator.*, delegate-work.*, coordinator-spawn.* が存在しないこと
- AC-4: npm run build が成功し、削除ファイルが再生成されないこと

## Artifacts

| Artifact | Phase | Format |
|----------|-------|--------|
| scope-definition.md | scope_definition | .md |
| modified tool-gate.js | implementation | .js |
| modified stream-progress-tracker.ts | implementation | .ts |
| build verification log | verification | console output |

## Risk Assessment

- Size: XS (3ファイル編集 + 12ファイル削除)
- Risk: Low (参照除去のみ、ロジック変更なし)
- Blast radius: hook allowlist + JSDoc + stale dist artifacts

## Next

research フェーズ: 変更対象の詳細行番号確定、依存関係の最終確認
