# Planning: hearing-worker-real-choices

## decisions

- PL-001: hearing-worker.mdに確認形式禁止ルールを追加。現在は「Do you want A?」パターンを防ぐルールがない。Yes/No確認はLLMに判断を委譲しユーザーの選択権を奪う。
- PL-002: 各選択肢にトレードオフ(メリット・デメリット)明記を必須化。トレードオフなしの選択肢は装飾であり実質的な選択にならない。
- PL-003: hearing-worker.mdに「AskUserQuestion Quality Rules」セクションを新設。既存Guidelinesは操作手順、新セクションは品質基準を担当。
- PL-004: defs-stage0.tsは24行目の抽象的指示のみ置換。前後の行(23行、25-27行)は維持。具体例(悪い例・良い例)付きルールに書き換え。
- PL-005: テストアサーション更新不要。TC-AC2-01の「必須」とTC-AC2-02の「選択肢.*2」パターンは新テキストでも一致する。
- PL-006: defs-stage0.tsは現在44行。テンプレート8行追加でも200行制限に余裕あり。

## artifacts

### File 1: .claude/agents/hearing-worker.md

Location: `C:\ツール\Workflow\.claude\agents\hearing-worker.md`

**Edit: Append new section before `## Result Format` (after line 22, before line 24)**

old_string:
```
## Result Format
```

new_string:
```
## AskUserQuestion Quality Rules
- Confirmation-only patterns are prohibited. Never ask "Shall I do X? [Yes/No]".
  Every question must present 2+ substantively different approaches or strategies.
- Each option must include a trade-off: at least one merit and one demerit.
  Options without trade-offs are decoration, not real choices.
- The recommended option (marked with (Recommended)) must still show its demerit.
  Hiding downsides of the recommended path undermines user trust.

## Result Format
```

### File 2: workflow-harness/mcp-server/src/phases/defs-stage0.ts

Location: `C:\ツール\Workflow\workflow-harness\mcp-server\src\phases\defs-stage0.ts`

**Edit: Replace the abstract instruction line with concrete rules and example**

old_string:
```
   - AskUserQuestion呼び出しは必須。選択肢は2個以上提示すること。
```

new_string:
```
   - AskUserQuestion呼び出しは必須。選択肢は2個以上、各選択肢にメリット・デメリットを明記すること。
   - 確認だけの質問（はい/いいえ）は禁止。必ず異なるアプローチを提示する。
   - 悪い例: 「テストを追加しますか？ [はい / いいえ]」
   - 良い例: 「テスト戦略: A) ユニットテスト中心（速い・カバレッジ浅い） B) 統合テスト中心（遅い・信頼性高い）」
```

### File 3: hearing-template.test.ts

Location: `C:\ツール\Workflow\workflow-harness\mcp-server\src\__tests__\hearing-template.test.ts`

**No edit required.**

Verification:
- TC-AC2-01 checks `/AskUserQuestion/i` and `/必須/` -- both words exist in new text. PASS.
- TC-AC2-02 checks `/選択肢.*2|2.*選択肢|options.*2|2.*options/i` -- new text contains `選択肢は2個以上`. PASS.
- TC-AC1-01 and TC-AC7-01 are unrelated to the changed lines. PASS.

## next

1. Worker executes Edit on hearing-worker.md (old_string/new_string from File 1 above)
2. Worker executes Edit on defs-stage0.ts (old_string/new_string from File 2 above)
3. Run `npx vitest run mcp-server/src/__tests__/hearing-template.test.ts` to confirm no regression
4. DoD gate check on planning.md itself (sections, line count, uniqueness)
