# .mmd file TOON parse bug investigation

## Summary

`dod-l4-delta.ts` の `checkDeltaEntryFormat` 関数で、`.mmd` ファイル(Mermaid図)が TOON としてパースされるバグが存在する。

## Root Cause

**File:** `workflow-harness/mcp-server/src/gates/dod-l4-delta.ts` L37-65, L67-105

コードの分岐ロジック:

1. L37: `if (outputFile.endsWith('.md'))` -- Markdown パス (decisions セクションをリスト検索)
2. L67以降: それ以外すべて -- TOON decode パス (`toonDecode(content)`)

`.mmd` ファイルは `.md` で終わらないため、L67 の TOON decode パスに落ちる。
Mermaid 構文は TOON 形式ではないため、`toonDecode()` が失敗し、チェックが不合格になる。

## Affected Phases

`state_machine` と `flowchart` は `DELTA_ENTRY_APPLICABLE_PHASES` (L14-20) に含まれている:

```
L16: 'state_machine', 'flowchart',
```

これらのフェーズの outputFile は `.mmd`:

- `state_machine` -> `{docsDir}/state-machine.mmd` (registry.ts L21)
- `flowchart` -> `{docsDir}/flowchart.mmd` (registry.ts L22)

## L3 Check (dod-l3.ts) -- Not Affected

L3 の `checkL3Quality` (dod-l3.ts L23, L35) は正しく分岐している:

- L23: `.md` -> Markdown section check
- L35: `.toon` でなければ -> skip ("Non-TOON file, skipping TOON quality check")

L3 は `.mmd` を正しくスキップする。

## L4 Content Check (dod-l4-content.ts) -- Not Affected

L58: `.mmd` でない場合のみ content check を実行
L63-64: `.toon` の場合のみ TOON key check を実行

L4 content も `.mmd` を正しく処理している。

## Bug Location

| Item | Detail |
|------|--------|
| File | `workflow-harness/mcp-server/src/gates/dod-l4-delta.ts` |
| Function | `checkDeltaEntryFormat` |
| Bug line | L37 (`.md` チェック後、else 分岐がすべて TOON として扱う) |
| Trigger | `state_machine`, `flowchart` フェーズの DoD チェック実行時 |

## Fix Proposal

L37 の `.md` チェックの後、TOON decode の前に `.mmd` のスキップを追加する:

```
// L37 の if (outputFile.endsWith('.md')) { ... } ブロック (L65) の直後に:

if (outputFile.endsWith('.mmd')) {
  return {
    level: 'L4', check: 'delta_entry_format', passed: true,
    evidence: 'Delta Entry format check skipped for Mermaid diagram (.mmd)',
  };
}
```

挿入位置: L65 と L67 の間 (現在の `// Internal .toon files: TOON decode path` コメントの前)。

Alternative: `DELTA_ENTRY_APPLICABLE_PHASES` から `state_machine` と `flowchart` を除外する方法もあるが、将来 Mermaid ファイルに decisions メタデータを埋め込む可能性を考慮すると、拡張子ベースのスキップが適切。
