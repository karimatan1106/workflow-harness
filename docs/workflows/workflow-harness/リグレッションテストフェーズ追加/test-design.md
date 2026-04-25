# リグレッションテストフェーズ追加 - テスト設計

## テスト対象

1. フェーズ定義の変更（`definitions.ts`）
2. 型定義の変更（`types.ts`）
3. フェーズ遷移ロジック

## テストケース

### TC-1: PhaseName 型の検証

| テストID | テスト内容 | 期待結果 |
|---------|----------|---------|
| TC-1.1 | `regression_test` が PhaseName に含まれる | 型エラーなし |
| TC-1.2 | フェーズ数が 19 である | `PHASES_LARGE.length === 19` |

### TC-2: フェーズ順序の検証

| テストID | テスト内容 | 期待結果 |
|---------|----------|---------|
| TC-2.1 | `testing` の次が `regression_test` | `getNextPhase('testing') === 'regression_test'` |
| TC-2.2 | `regression_test` の次が `parallel_verification` | `getNextPhase('regression_test') === 'parallel_verification'` |
| TC-2.3 | `regression_test` のインデックスが 11 | `getPhaseIndex('regression_test') === 11` |

### TC-3: フェーズ説明の検証

| テストID | テスト内容 | 期待結果 |
|---------|----------|---------|
| TC-3.1 | `regression_test` の説明が存在する | `PHASE_DESCRIPTIONS['regression_test']` が定義済み |
| TC-3.2 | 説明に「リグレッション」が含まれる | 文字列に含まれる |

### TC-4: 許可拡張子の検証

| テストID | テスト内容 | 期待結果 |
|---------|----------|---------|
| TC-4.1 | `regression_test` の許可拡張子が定義済み | `PHASE_EXTENSIONS['regression_test']` が存在 |
| TC-4.2 | `.md` が許可される | 文字列に含まれる |
| TC-4.3 | `.test.ts` が許可される | 文字列に含まれる |

### TC-5: フェーズ判定関数の検証

| テストID | テスト内容 | 期待結果 |
|---------|----------|---------|
| TC-5.1 | `regression_test` は並列フェーズではない | `isParallelPhase('regression_test') === false` |
| TC-5.2 | `regression_test` は承認不要 | `requiresApproval('regression_test') === false` |

## テストコード設計

### ファイル構成

```
mcp-server/src/phases/__tests__/definitions.test.ts  # 既存ファイルに追加
```

### テストコード（追加分）

```typescript
describe('regression_test phase', () => {
  it('should be included in PHASES_LARGE', () => {
    expect(PHASES_LARGE).toContain('regression_test');
  });

  it('should have 19 phases in total', () => {
    expect(PHASES_LARGE.length).toBe(19);
  });

  it('should come after testing phase', () => {
    const testingIndex = PHASES_LARGE.indexOf('testing');
    const regressionIndex = PHASES_LARGE.indexOf('regression_test');
    expect(regressionIndex).toBe(testingIndex + 1);
  });

  it('should come before parallel_verification phase', () => {
    const regressionIndex = PHASES_LARGE.indexOf('regression_test');
    const verificationIndex = PHASES_LARGE.indexOf('parallel_verification');
    expect(verificationIndex).toBe(regressionIndex + 1);
  });

  it('should have a description', () => {
    expect(PHASE_DESCRIPTIONS['regression_test']).toBeDefined();
    expect(PHASE_DESCRIPTIONS['regression_test']).toContain('リグレッション');
  });

  it('should have allowed extensions', () => {
    expect(PHASE_EXTENSIONS['regression_test']).toBeDefined();
    expect(PHASE_EXTENSIONS['regression_test']).toContain('.md');
    expect(PHASE_EXTENSIONS['regression_test']).toContain('.test.ts');
  });

  it('should not be a parallel phase', () => {
    expect(isParallelPhase('regression_test')).toBe(false);
  });

  it('should not require approval', () => {
    expect(requiresApproval('regression_test')).toBe(false);
  });

  it('should return correct next phase', () => {
    expect(getNextPhase('testing')).toBe('regression_test');
    expect(getNextPhase('regression_test')).toBe('parallel_verification');
  });
});
```

## 実行方法

```bash
cd workflow-plugin/mcp-server
pnpm test
```

## 成功基準

- 全てのテストケースがパスする
- 既存のテストが引き続きパスする
- カバレッジが低下しない
