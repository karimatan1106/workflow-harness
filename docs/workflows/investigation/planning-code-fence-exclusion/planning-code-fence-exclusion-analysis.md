# P4: planningフェーズ コード例排除 実装調査レポート

## 1. planningフェーズの定義ファイルパス

- テンプレート定義: `workflow-harness/mcp-server/src/phases/defs-stage2.ts` (planning key, L44-L76)
- レジストリ定義: `workflow-harness/mcp-server/src/phases/registry.ts` (planning entry, L26)
- 共有型定義: `workflow-harness/mcp-server/src/phases/definitions-shared.ts` (PhaseDefinition interface)
- L4コンテンツ検証: `workflow-harness/mcp-server/src/gates/dod-l4-content.ts`
- ヘルパー関数群: `workflow-harness/mcp-server/src/gates/dod-helpers.ts`

## 2. planningフェーズの定義内容

### registry.ts での PhaseConfig

```
planning: {
  name: 'planning',
  stage: 3,
  model: 'opus',
  inputFiles: ['{docsDir}/requirements.md', '{docsDir}/threat-model.md'],
  outputFile: '{docsDir}/planning.md',
  requiredSections: ['decisions', 'artifacts', 'next'],
  minLines: 50,
  allowedExtensions: ['.md', '.mmd'],
  bashCategories: ['readonly'],
  dodChecks: [],            // <-- 空。カスタムDoDチェックなし
  parallelGroup: 'parallel_analysis',
  dependencies: ['threat_modeling'],
  allowedTools: ['Read', 'Glob', 'Grep', 'Write'],
}
```

### defs-stage2.ts での subagentTemplate

テンプレート内にコード例排除の指示は一切なし。テンプレート変数:
- `{SUMMARY_SECTION}` = TOON形式の出力説明
- `{TOON_SKELETON_PLANNING}` = planningフェーズ用TOONスケルトン
- `{BASH_CATEGORIES}` = Bash制限
- `{ARTIFACT_QUALITY}` = 品質要件(禁止語チェック等)
- `{EXIT_CODE_RULE}` = AGT-1終了コードルール

### dodChecks が空の意味

planningフェーズには `dodChecks: []` が設定されている。つまりL2カスタムチェックは未定義。
コード例排除を実装する場合、ここにカスタムチェックを追加するか、dod-l4-content.ts内でフェーズ別分岐を追加する必要がある。

## 3. dod-l4-content.ts でのフェーズ別分岐の有無

### 現状の実装パターン

`checkL4ContentValidation()` はフェーズ名に基づく分岐を持たない。全フェーズ共通の処理:

1. `PHASE_REGISTRY[phase]` から `PhaseConfig` を取得
2. `config.outputFile` からファイルパスを解決
3. 共通チェックを実行:
   - `checkForbiddenPatterns(content)` -- 禁止語検出(コードフェンス外のみ)
   - `checkBracketPlaceholders(content)` -- [#xxx#]プレースホルダー検出
   - `checkDuplicateLines(content)` -- 重複行検出(非.mmd)
   - TOON key checks (.toon) / Markdown section checks (.md)

フェーズ名による `if (phase === 'planning')` のような分岐は存在しない。

### 実装パターンの選択肢

A. **PhaseConfig.dodChecks に追加** -- registry.ts の planning entry に L4 カスタムチェックを追加
B. **dod-l4-content.ts にフェーズ別分岐を追加** -- planning時のみコードフェンス検出を実行
C. **PhaseConfig に新プロパティ追加** -- 例: `noCodeFences: true` フラグを追加し、dod-l4-content.ts で汎用的に処理

推奨: **C案**。planning以外にも将来的に適用できる汎用的なフラグとして設計するのが望ましい。
ただし、最小変更ならA案(dodChecksに関数追加)が最も影響範囲が小さい。

## 4. コードフェンス検出の正規表現推奨案

### 既存のコードフェンス処理(dod-helpers.ts)

`extractNonCodeLines()` (L30-39) に既にコードフェンス検出ロジックが存在:

```typescript
// L36: コードフェンス開始/終了の検出
if (/^`{3,}/.test(trimmed)) { inCodeFence = !inCodeFence; continue; }
// L37: コードフェンス外ではインラインコードを除去
if (!inCodeFence) result.push(trimmed.replace(/`[^`]+`/g, ''));
```

### コードフェンス検出用の正規表現(新規)

```typescript
// コードフェンス(```)の存在検出
const CODE_FENCE_REGEX = /^`{3,}/m;

// planningフェーズ用チェック関数
function hasCodeFences(content: string): boolean {
  return CODE_FENCE_REGEX.test(content);
}
```

注: `^`{3,}` は行頭の3つ以上のバックティックにマッチ。`m`フラグで複数行対応。
既存の `extractNonCodeLines()` と同じパターンを使用するため整合性が取れる。

### 代替案: より厳密なパターン

```typescript
// 言語指定付きコードフェンスも検出
const CODE_FENCE_WITH_LANG = /^`{3,}\s*\w*/m;

// コードブロック全体(開始から終了まで)の検出
const CODE_BLOCK_FULL = /^`{3,}.*\n[\s\S]*?^`{3,}\s*$/m;
```

推奨は最もシンプルな `CODE_FENCE_REGEX = /^`{3,}/m` 。理由:
- 既存コードと同じパターンで一貫性がある
- コードフェンスの開始だけ検出すれば十分(存在の有無が重要)
- ペアの整合性チェックは不要(存在自体がNG)

## 5. インラインコード(backtick)許容時の考慮事項

### 現状のインラインコード処理

`extractNonCodeLines()` L37で、コードフェンス外の行からインラインコードを除去:
```typescript
result.push(trimmed.replace(/`[^`]+`/g, ''));
```

これは禁止語チェック時にインラインコード内の禁止語を無視するための処理。

### planningフェーズでインラインコードを許容すべき理由

planningフェーズの成果物は技術仕様書であり、以下の記述が必然的に発生する:
- ファイルパス参照: `src/phases/registry.ts`
- 関数名・型名参照: `checkL4ContentValidation()`, `PhaseConfig`
- 設定値参照: `minLines: 50`
- コマンド参照: `npm test`

これらはインラインコード(シングルバックティック)であり、実装コード例(コードフェンス)とは本質的に異なる。

### インラインコードとコードフェンスの区別

| 種類 | 記法 | planningでの扱い |
|------|------|-----------------|
| インラインコード | `` `identifier` `` | 許容(技術用語の参照) |
| コードフェンス | ` ``` ... ``` ` | 禁止(実装コード例) |

### 検出ロジックでの考慮点

- `CODE_FENCE_REGEX = /^`{3,}/m` はインラインコードにマッチしない(行頭3つ以上が条件)
- インラインコードは行の途中に出現するため、行頭条件で自然に除外される
- 追加の除外ロジックは不要

### エッジケース

1. **行頭のインラインコード**: `` `foo` is a variable `` -- マッチしない(バックティック1つ)
2. **ダブルバックティック**: ``` `` nested `` ``` -- マッチしない(2つのみ)
3. **偽陽性の可能性**: 行頭にバックティック3つ以上がインラインコードとして出現するケースは実質ない
4. **TOON形式の成果物**: TOONフォーマットではコードフェンスは使用しないため、.toonファイルでは本チェック不要

## 6. 実装推奨案

### 最小実装(A案: dodChecksに追加)

registry.ts の planning entry を変更:

```typescript
planning: {
  // ...existing config...
  dodChecks: [
    {
      level: 'L4',
      description: 'planning.md must not contain code fences (implementation examples)',
      check: (ctx) => !/^`{3,}/m.test(readFileSync(resolveProjectPath(
        ctx.config.outputFile!.replace('{docsDir}', ctx.docsDir).replace('{workflowDir}', ctx.workflowDir)
      ), 'utf8')),
    },
  ],
}
```

### 汎用実装(C案: PhaseConfig拡張)

1. `types.ts` に `noCodeFences?: boolean` を追加
2. `registry.ts` の planning (および必要に応じて他フェーズ) に `noCodeFences: true` を設定
3. `dod-l4-content.ts` の `checkL4ContentValidation()` に汎用チェックを追加:

```typescript
if (config.noCodeFences && /^`{3,}/m.test(content)) {
  errors.push('Code fences (```) are forbidden in this phase artifact. Use inline code (`identifier`) for technical references.');
}
```

### subagentTemplateへの指示追加

defs-stage2.ts の planning テンプレートに以下を追加:

```
注意: コードフェンス(```)による実装コード例の記載は禁止です。
技術用語の参照にはインラインコード(`identifier`)を使用してください。
```

## 7. 影響範囲まとめ

| ファイル | 変更内容 |
|---------|---------|
| `mcp-server/src/state/types.ts` | PhaseConfig に `noCodeFences?: boolean` 追加 (C案の場合) |
| `mcp-server/src/phases/registry.ts` | planning の dodChecks or noCodeFences 設定 |
| `mcp-server/src/phases/defs-stage2.ts` | planning テンプレートにコード例禁止指示を追加 |
| `mcp-server/src/gates/dod-l4-content.ts` | コードフェンス検出チェックの追加 (C案の場合) |
| `mcp-server/src/__tests__/` | 新規テストケース追加 |
