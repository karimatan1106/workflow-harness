# P3 AI Slop Pattern Detection - Impact Analysis

## Summary

dod-helpers.ts への AI slop 検出関数追加の影響を分析した結果。

## Analysis (TOON-style key: value)

```
helpers_current_lines: 124
helpers_remaining_capacity: 76 (200 - 124)
existing_l4_checks_in_helpers:
  - checkForbiddenPatterns (L53-65): 禁止語検出、errors配列に追加 -> passed=false
  - checkBracketPlaceholders (L67-69): [#...#]プレースホルダ検出 -> passed=false
  - checkDuplicateLines (L71-84): 3回以上の重複行検出 -> passed=false
  - checkRequiredSections (L86-95): 必須セクション欠落検出 -> passed=false(未使用、dod-l4-content内でインライン実装に置換済)
  - checkFileLineLimit (L98-101): 200行超過検出
  - checkBrokenPointers (L104-117): TOON artifacts参照切れ検出
  - detectGhostFiles (L120-123): 同名ファイル重複検出
existing_l4_checks_in_content:
  - checkL4ContentValidation (dod-l4-content.ts L41-86): helpers の3関数を呼び出し + TOON key + MD sections
  - dod.ts L44 で呼び出し: push(checkL4ContentValidation(...), 'L4')
test_files:
  - dod-extended.test.ts (checkFileLineLimit, checkBrokenPointers, detectGhostFiles をimport)
  - dod-l3-l4-content.test.ts (L4 content validation全般)
  - dod-l4-duplicate.test.ts (重複行検出)
  - dod-l4-sections.test.ts (セクション検出)
  - dod-basic.test.ts (基本DoD)
  - dod-format.test.ts (フォーマット検証)
  - dod-toon-safety.test.ts (TOON安全性)
  - dod-ia.test.ts, dod-ia5.test.ts (IA検証)
  - dod-l4-requirements.test.ts, dod-l4-refs.test.ts, dod-l4-commit.test.ts
  - dod-tdd.test.ts
  - skill-rules.test.ts (FORBIDDEN_PATTERNS をimport)
blocking_behavior: NON-BLOCKING (警告のみ)
blocking_evidence:
  - dod-l4-content.ts の checkL4ContentValidation は DoDCheckResult を返す
  - DoDCheckResult.passed = false の場合、dod.ts L35 で errors 配列に追加
  - dod.ts L69: passed = errors.length === 0 で最終判定
  - つまり現在の L4 チェックは全てブロッキング(passed=falseならDoD失敗)
  - 非ブロックにするには: (1) checkL4ContentValidation 内で warnings として分離する、
    または (2) dod.ts の push 時に passed を強制 true にする、
    または (3) 新関数の戻り値で passed=true + evidence に警告文を載せる
  - 推奨: 方式(3) - passed=true を返しつつ evidence に "[WARN] AI slop detected: ..." を記載
interference_risk: LOW
interference_detail:
  - dod-helpers.ts のエクスポート関数は純粋関数(副作用なし)
  - 新関数追加は既存関数に影響しない
  - dod-l4-content.ts での呼び出し追加箇所: L53-61 の既存チェック群の後(L62付近)
  - 既存テストは helpers の個別関数を直接テストしており、新関数追加で壊れない
integration_point: dod-l4-content.ts L61 付近(duplicates チェック後、TOON key チェック前)
integration_approach:
  - dod-helpers.ts に checkAiSlopPatterns(content: string) を追加 (~20行想定)
  - dod-l4-content.ts L61 付近で呼び出し
  - 非ブロック実装: evidence に "[WARN]" プレフィックスで記録、passed には影響させない
  - つまり errors 配列には追加せず、warnings 的な evidence のみ記載
```

## Capacity Check

| Item | Value |
|------|-------|
| dod-helpers.ts current | 124 lines |
| AI slop function estimate | ~20 lines |
| Post-addition estimate | ~144 lines |
| 200-line limit headroom | ~56 lines remaining |

## Risk Matrix

| Risk | Level | Mitigation |
|------|-------|------------|
| Existing test breakage | None | Pure function addition, no signature changes |
| L4 gate interference | None | Independent check, no shared mutable state |
| False positive blocking | None if non-blocking | Use passed=true + WARN evidence pattern |
| 200-line limit breach | Low | 144/200 with comfortable margin |

## Non-Blocking Implementation Pattern

Current L4 checks all use passed=false to block. For warning-only behavior:

```typescript
// In dod-l4-content.ts, after existing checks:
const slopPatterns = checkAiSlopPatterns(content);
if (slopPatterns.length > 0) {
  // WARNING only - do NOT add to errors array
  // Append to evidence string instead
}
```

The key distinction: do NOT push to `errors[]` in dod.ts. Instead, include in the
check result with `passed: true` so it appears in the report but does not fail the gate.

## Conclusion

- helpers has 76 lines of capacity - sufficient for a ~20 line slop detection function
- No interference with existing L4 checks (all pure functions, no shared state)
- Non-blocking requires explicit design: passed=true + WARN prefix in evidence
- Integration point is clean: after duplicate check, before TOON key check in dod-l4-content.ts
