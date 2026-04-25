## decisions

- DU-1: skill file workflow-gates.md の L3 threshold 表に `AC count >= 3` と記載されているが、コード側は `MIN_ACCEPTANCE_CRITERIA = 5` に変更済み。スキルファイル更新が必要。
- DU-2: skill file workflow-phases.md の requirements フェーズ説明に `min 3` / `AC >= 3` と記載されているが、コード側は 5 に変更済み。スキルファイル更新が必要。
- DU-3: pivot-advisor.ts は新規MCPツールではなく lifecycle-next.ts 内部で import される内部モジュール。ユーザー向けドキュメントへの記載は不要。
- DU-4: AI slopパターンL4検出(dod-helpers.ts)、コードフェンス警告(dod-l4-content.ts)、構造パターン除外(isStructuralLine)はDoDゲートの内部実装改善。ゲートの動作仕様(L4 pattern check)自体は変わらないため、スキルファイルへの追記は不要。
- DU-5: RTMバグ修正(manager-write.ts find→filter)は動作修正であり、仕様変更ではない。ドキュメント更新不要。
- DU-6: phase-analytics.ts のガイダンスメッセージは既に「最低5件」に更新済み。コードとガイダンスの整合性は確保されている。
- DU-7: ADR作成の要否 -- AC最低数の変更(3→5)は設計判断の変更であり、ADR-NNN として Why を記録すべき。ただし本タスクのスコープ外とし、別タスクで対応を推奨。

## required-updates

以下2ファイルのAC閾値を `3` から `5` に更新する必要がある:

1. `.claude/skills/workflow-harness/workflow-gates.md` line 13, 30
   - L3行: `AC count >= 3` → `AC count >= 5`
   - requirements行: `AC >= 3, >= 40 lines` → `AC >= 5, >= 40 lines`

2. `.claude/skills/workflow-harness/workflow-phases.md` line 21
   - `Define AC-1~AC-N (min 3)` → `Define AC-1~AC-N (min 5)`
   - `L3 AC >= 3` → `L3 AC >= 5`

## no-update-needed

| 変更内容 | 理由 |
|----------|------|
| P3: AI slopパターン検出 | DoDゲート内部実装。外部仕様の変更なし |
| P4: planningコードフェンス警告 | DoDゲート内部実装。警告追加のみ |
| P5: pivot advisor | lifecycle-next内部モジュール。新APIではない |
| P7: 構造パターン除外 | 重複行検出の精度改善。外部仕様の変更なし |
| RTMバグ修正 | find→filterのバグ修正。仕様変更なし |

## artifacts

- docs-update.md (本ファイル): ドキュメント更新の評価と判定結果

## next

- workflow-gates.md と workflow-phases.md の AC閾値を 3→5 に更新する(別タスクまたは本タスクの後続作業)
- AC最低数変更の設計根拠を ADR として記録する(推奨)
