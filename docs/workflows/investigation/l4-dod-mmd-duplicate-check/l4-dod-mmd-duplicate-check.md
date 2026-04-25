# L4 DoD: .mmd ファイルに対する重複行チェックの状態

## 結論

.mmd ファイルに対して重複行チェックは除外されていない。重複行チェックはファイル拡張子に関係なく全成果物に適用される。

## 詳細分析

### 重複行チェックのロジック

ファイル: `workflow-harness/mcp-server/src/gates/dod-helpers.ts` (71-83行目)

```typescript
export function checkDuplicateLines(content: string): string[] {
  const nonCodeLines = extractNonCodeLines(content);
  const countMap = new Map<string, number>();
  for (const line of nonCodeLines) {
    const trimmed = line.trim();
    if (!trimmed || isStructuralLine(trimmed)) continue;
    countMap.set(trimmed, (countMap.get(trimmed) ?? 0) + 1);
  }
  const duplicates: string[] = [];
  for (const [line, count] of countMap) {
    if (count >= 3) duplicates.push(`"${line.substring(0, 60)}..." (${count}x)`);
  }
  return duplicates;
}
```

- 同一行が3回以上出現した場合にエラーとして報告
- `isStructuralLine()` で見出し・区切り線・テーブル行などの構造行は除外される
- ファイル形式による分岐はない

### L4 content validation での呼び出し

ファイル: `workflow-harness/mcp-server/src/gates/dod-l4-content.ts` (58-59行目)

```typescript
const duplicates = checkDuplicateLines(content);
if (duplicates.length > 0) errors.push(`Duplicate lines (3+ times): ${duplicates.slice(0, 3).join('; ')}`);
```

- 拡張子による条件分岐なしで呼び出される

### .mmd の除外が存在する箇所（参考）

ファイル: `workflow-harness/mcp-server/src/gates/dod-l4-content.ts` (61-66行目)

```typescript
// TOON key checks only apply to .toon files; skip for .mmd and other non-TOON formats
if (extname(outputFile) === '.toon') {
  const toonCheck = checkRequiredToonKeys(content, config.requiredSections ?? []);
  ...
}
```

- .mmd 除外が存在するのはTOONキーチェック（requiredSections検証）のみ
- 重複行チェック・禁止パターン・プレースホルダチェックには .mmd 除外はない

## 潜在的問題

Mermaid (.mmd) ファイルはノード定義やエッジ定義で同一パターンの行が繰り返される構造的特性がある（例: `end`, `-->`, スタイル定義）。現状では `isStructuralLine()` がMarkdown向けの構造行のみを除外しており、Mermaid構文の構造行は考慮されていない。結果として .mmd ファイルで false positive が発生する可能性がある。
