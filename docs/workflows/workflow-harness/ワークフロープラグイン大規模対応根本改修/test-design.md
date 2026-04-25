# テスト設計書: ワークフロープラグイン大規模対応根本改修

## 概要

本ドキュメントは、ワークフロープラグインの6つのセキュリティ・品質問題を修正するためのテスト設計を定義する。各機能要件（REQ-1〜REQ-6）に対して、ユニットテスト、統合テスト、エンドツーエンドテストを網羅的に計画する。

**関連ドキュメント:**
- 要件定義: `/mnt/c/ツール/Workflow/docs/workflows/ワ-クフロ-プラグイン大規模対応根本改修/requirements.md`
- 仕様書: `/mnt/c/ツール/Workflow/docs/workflows/ワ-クフロ-プラグイン大規模対応根本改修/spec.md`

**テスト戦略:**
- 新規テストケース: 50件以上
- カバレッジ目標: 新規コード90%以上
- 既存テスト保護: 全425テストが通過すること
- 実行環境: Node.js 20.x, TypeScript 5.x

---

## テスト環境

### テストフレームワーク

| 種別 | ツール | 用途 |
|------|--------|------|
| TypeScript | Vitest | MCP サーバーのユニットテスト |
| JavaScript | Node.js標準 assert | フックスクリプトのテスト |
| E2E | Bash スクリプト | ワークフロー全体の統合テスト |

### テストディレクトリ構成

```
workflow-plugin/
├── mcp-server/src/__tests__/
│   ├── hmac-signature.test.ts           # REQ-2
│   ├── scope-limits.test.ts             # REQ-3
│   └── design-validation-strict.test.ts # REQ-6
│
└── hooks/__tests__/
    ├── bash-command-parser.test.ts         # REQ-4
    ├── artifact-content-validation.test.ts # REQ-5
    └── fail-open-removal.test.sh           # REQ-1
```

---

## テストケース

### REQ-1: FAIL_OPEN除去テスト

**目的**: エラー時のfail-closed原則が強制されることを検証

**テストファイル**: `hooks/__tests__/fail-open-removal.test.sh`

#### TC-1-1: enforce-workflow.js - uncaughtExceptionでexit(2)

**説明**: 未捕捉エラー発生時に必ずexit(2)すること

**前提条件**:
- `enforce-workflow.js`が修正済み
- FAIL_OPEN環境変数が設定可能

**テスト手順**:
1. `FAIL_OPEN=true`環境変数を設定
2. 意図的にエラーを発生させるツール呼び出しをstdinで送信
3. フックの終了コードを確認

**期待結果**:
- 終了コード: 2（ブロック）
- 標準エラー出力に「未捕捉エラー - ブロック」が含まれる
- FAIL_OPENが無視されている

**検証方法**:
```bash
FAIL_OPEN=true echo '{"invalid json' | node hooks/enforce-workflow.js
echo $? # 期待: 2
```

#### TC-1-2: enforce-workflow.js - FAIL_OPEN=true設定時でもexit(2)

**説明**: FAIL_OPEN環境変数が設定されていてもブロックすること

**前提条件**: TC-1-1と同じ

**テスト手順**:
1. `FAIL_OPEN=true`を設定
2. 正常なツール呼び出しだがワークフロー違反のデータを送信
3. 終了コードを確認

**期待結果**:
- 終了コード: 2
- ログに「FAIL_OPEN」の文字列が出力されない

#### TC-1-3: phase-edit-guard.js - エラー時exit(2)

**説明**: phase-edit-guardでエラー発生時にexit(2)すること

**前提条件**:
- `phase-edit-guard.js`が修正済み
- テスト用の状態ファイルが存在

**テスト手順**:
1. `FAIL_OPEN=true`を設定
2. JSONパースエラーが発生する不正データを送信
3. 終了コードを確認

**期待結果**:
- 終了コード: 2
- エラーログが出力される

**検証方法**:
```bash
FAIL_OPEN=true echo 'invalid' | node hooks/phase-edit-guard.js
test $? -eq 2 || exit 1
```

#### TC-1-4: block-dangerous-commands.js - エラー時exit(2)

**説明**: block-dangerous-commandsでエラー発生時にexit(2)すること

**前提条件**: `block-dangerous-commands.js`が修正済み

**テスト手順**:
1. `FAIL_OPEN=true`を設定
2. 不正なデータを送信してエラーを発生させる
3. 終了コードを確認

**期待結果**:
- 終了コード: 2
- FAIL_OPENが無視される

#### TC-1-5: grep検証 - FAIL_OPENの文字列がコードに存在しないこと

**説明**: 全フックファイルからFAIL_OPEN参照が削除されていることを確認

**テスト手順**:
```bash
grep -r "FAIL_OPEN" hooks/*.js
```

**期待結果**:
- `grep`の終了コード: 1（見つからない）
- 何も出力されない

**検証コード**:
```bash
#!/bin/bash
# TC-1-5: FAIL_OPEN文字列の完全除去確認
if grep -r "FAIL_OPEN" hooks/*.js 2>/dev/null; then
  echo "FAIL: FAIL_OPEN references still exist"
  exit 1
fi
echo "PASS: No FAIL_OPEN references found"
```

---

### REQ-2: HMAC署名テスト

**目的**: 状態ファイルの改竄検出が正しく動作することを検証

**テストファイル**: `mcp-server/src/__tests__/hmac-signature.test.ts`

#### TC-2-1: generateStateHmac()が一貫した署名を生成

**説明**: 同じTaskStateオブジェクトから常に同じ署名が生成されること

**テストコード**:
```typescript
import { describe, it, expect } from 'vitest';
import { generateStateHmac } from '../state/manager';

describe('REQ-2: HMAC Signature', () => {
  it('TC-2-1: generates consistent signature for same state', () => {
    const state = {
      phase: 'research',
      taskId: '20260101_000000',
      taskName: 'test-task',
      workflowDir: '/tmp/test',
      startedAt: '2026-01-01T00:00:00Z',
      checklist: {},
      history: [],
      subPhases: {},
    };

    const signature1 = generateStateHmac(state);
    const signature2 = generateStateHmac(state);

    expect(signature1).toBe(signature2);
    expect(signature1).toMatch(/^[A-Za-z0-9+/=]+$/); // Base64形式
  });
});
```

**期待結果**:
- `signature1 === signature2`
- 署名がBase64形式の文字列

#### TC-2-2: 異なるstateは異なる署名を生成

**説明**: TaskStateの内容が異なれば異なる署名が生成されること

**テストコード**:
```typescript
it('TC-2-2: generates different signatures for different states', () => {
  const state1 = {
    phase: 'research',
    taskId: '20260101_000000',
    taskName: 'test-task-1',
    // ... 他のフィールド
  };

  const state2 = {
    ...state1,
    taskName: 'test-task-2', // 変更
  };

  const sig1 = generateStateHmac(state1);
  const sig2 = generateStateHmac(state2);

  expect(sig1).not.toBe(sig2);
});
```

**期待結果**:
- `sig1 !== sig2`

#### TC-2-3: writeTaskState()がstateIntegrityフィールドを付与

**説明**: ファイル保存時に署名が自動付与されること

**テストコード**:
```typescript
it('TC-2-3: writeTaskState adds stateIntegrity field', () => {
  const manager = new WorkflowStateManager('/tmp/test-workflow');
  const state = createTestState();

  manager.writeTaskState('/tmp/test-task', state);

  const content = fs.readFileSync('/tmp/test-task/workflow-state.json', 'utf-8');
  const saved = JSON.parse(content);

  expect(saved.stateIntegrity).toBeDefined();
  expect(typeof saved.stateIntegrity).toBe('string');
});
```

**期待結果**:
- `stateIntegrity`フィールドが存在
- 文字列型

#### TC-2-4: readTaskState()で署名検証成功

**説明**: 正常な状態ファイルの読み込みが成功すること

**テストコード**:
```typescript
it('TC-2-4: readTaskState verifies valid signature', () => {
  const manager = new WorkflowStateManager('/tmp/test-workflow');
  const state = createTestState();

  // 保存
  manager.writeTaskState('/tmp/test-task', state);

  // 読み込み
  const loaded = manager.readTaskState('/tmp/test-task');

  expect(loaded).not.toBeNull();
  expect(loaded?.phase).toBe(state.phase);
});
```

**期待結果**:
- `loaded !== null`
- フィールドが元のstateと一致

#### TC-2-5: readTaskState()で改竄検出→null返却

**説明**: 手動編集された状態ファイルの読み込みが失敗すること

**テストコード**:
```typescript
it('TC-2-5: readTaskState detects tampering and returns null', () => {
  const manager = new WorkflowStateManager('/tmp/test-workflow');
  const state = createTestState();

  // 保存
  manager.writeTaskState('/tmp/test-task', state);

  // 手動で改竄
  const filePath = '/tmp/test-task/workflow-state.json';
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  content.phase = 'completed'; // フェーズを書き換え
  fs.writeFileSync(filePath, JSON.stringify(content, null, 2));

  // 読み込み（署名検証失敗）
  const loaded = manager.readTaskState('/tmp/test-task');

  expect(loaded).toBeNull();
});
```

**期待結果**:
- `loaded === null`
- 標準エラー出力に「署名検証失敗」のログ

#### TC-2-6: 署名なしファイルの後方互換（自動マイグレーション）

**説明**: 既存の署名なし状態ファイルが読み込まれ、署名が追加されること

**テストコード**:
```typescript
it('TC-2-6: readTaskState migrates unsigned files', () => {
  const manager = new WorkflowStateManager('/tmp/test-workflow');
  const filePath = '/tmp/test-task/workflow-state.json';

  // 署名なしファイルを作成
  const unsignedState = {
    phase: 'research',
    taskId: '20260101_000000',
    // ... stateIntegrity なし
  };
  fs.writeFileSync(filePath, JSON.stringify(unsignedState, null, 2));

  // 読み込み（警告ログが出る）
  const loaded = manager.readTaskState('/tmp/test-task');

  expect(loaded).not.toBeNull();

  // 再読み込みで署名が付与されているか確認
  const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
  expect(content.stateIntegrity).toBeDefined();
});
```

**期待結果**:
- 最初の読み込みは成功
- 警告ログ「署名なしファイルを検出」
- ファイルに署名が追加される

#### TC-2-7: timingSafeEqual使用確認

**説明**: 署名検証でタイミング攻撃対策が実装されていること

**検証方法**: コードレビュー + ユニットテスト

**テストコード**:
```typescript
it('TC-2-7: verifyStateHmac uses timingSafeEqual', () => {
  // verifyStateHmac関数のコードに crypto.timingSafeEqual が含まれることを確認
  const funcSource = verifyStateHmac.toString();
  expect(funcSource).toContain('timingSafeEqual');
});
```

**期待結果**:
- `timingSafeEqual`が使用されている

#### TC-2-8: PBKDF2キー生成の決定性

**説明**: 同じホスト・ユーザーで常に同じキーが生成されること

**テストコード**:
```typescript
it('TC-2-8: generateSignatureKey is deterministic', () => {
  const key1 = generateSignatureKey();
  const key2 = generateSignatureKey();

  expect(key1.equals(key2)).toBe(true);
  expect(key1.length).toBe(32); // 256bit
});
```

**期待結果**:
- `key1 === key2` (Buffer比較)
- キー長が32バイト

---

### REQ-3: スコープサイズ制限テスト

**目的**: ファイル数・ディレクトリ数の上限が正しく機能することを検証

**テストファイル**: `mcp-server/src/__tests__/scope-limits.test.ts`

#### TC-3-1: set-scope - 200ファイル以下→成功

**説明**: 上限以下のスコープ設定が成功すること

**テストコード**:
```typescript
import { describe, it, expect } from 'vitest';
import { workflowSetScope } from '../tools/set-scope';

describe('REQ-3: Scope Size Limits', () => {
  it('TC-3-1: accepts scope with 200 files', () => {
    const files = Array.from({ length: 200 }, (_, i) => `file${i}.ts`);
    const dirs = ['src/'];

    const result = workflowSetScope('test-task-id', files, dirs);

    expect(result.success).toBe(true);
  });
});
```

**期待結果**:
- `result.success === true`

#### TC-3-2: set-scope - 201ファイル→拒否

**説明**: 上限超過のスコープ設定が拒否されること

**テストコード**:
```typescript
it('TC-3-2: rejects scope with 201 files', () => {
  const files = Array.from({ length: 201 }, (_, i) => `file${i}.ts`);
  const dirs = ['src/'];

  const result = workflowSetScope('test-task-id', files, dirs);

  expect(result.success).toBe(false);
  expect(result.message).toContain('スコープが大きすぎます');
  expect(result.message).toContain('201件');
  expect(result.message).toContain('上限: 200件');
});
```

**期待結果**:
- `result.success === false`
- エラーメッセージに「スコープが大きすぎます」

#### TC-3-3: set-scope - 20ディレクトリ以下→成功

**説明**: ディレクトリ数が上限以下なら成功すること

**テストコード**:
```typescript
it('TC-3-3: accepts scope with 20 directories', () => {
  const files = ['file.ts'];
  const dirs = Array.from({ length: 20 }, (_, i) => `dir${i}/`);

  const result = workflowSetScope('test-task-id', files, dirs);

  expect(result.success).toBe(true);
});
```

**期待結果**:
- `result.success === true`

#### TC-3-4: set-scope - 21ディレクトリ→拒否

**説明**: ディレクトリ数が上限超過なら拒否されること

**テストコード**:
```typescript
it('TC-3-4: rejects scope with 21 directories', () => {
  const files = ['file.ts'];
  const dirs = Array.from({ length: 21 }, (_, i) => `dir${i}/`);

  const result = workflowSetScope('test-task-id', files, dirs);

  expect(result.success).toBe(false);
  expect(result.message).toContain('ディレクトリ: 21件');
  expect(result.message).toContain('上限: 20件');
});
```

**期待結果**:
- `result.success === false`
- エラーメッセージにディレクトリ数超過が含まれる

#### TC-3-5: next - スコープサイズ超過時ブロック

**説明**: parallel_analysis→parallel_design遷移時にスコープ検証が実行されること

**テストコード**:
```typescript
it('TC-3-5: workflowNext blocks oversized scope', () => {
  // parallel_analysisフェーズのタスクを作成
  const taskState = createTestTask({
    phase: 'parallel_analysis',
    scope: {
      affectedFiles: Array.from({ length: 201 }, (_, i) => `file${i}.ts`),
      affectedDirs: ['src/'],
    },
  });

  const result = workflowNext(taskState.taskId);

  expect(result.success).toBe(false);
  expect(result.message).toContain('スコープが大きすぎます');
});
```

**期待結果**:
- `result.success === false`
- フェーズ遷移がブロックされる

#### TC-3-6: エラーメッセージに分割推奨含む

**説明**: エラーメッセージにタスク分割の推奨が含まれること

**テストコード**:
```typescript
it('TC-3-6: error message suggests task splitting', () => {
  const files = Array.from({ length: 250 }, (_, i) => `file${i}.ts`);

  const result = workflowSetScope('test-task-id', files, []);

  expect(result.message).toContain('タスクを機能単位に分割してください');
  expect(result.message).toMatch(/例:.*ユーザー認証機能/s);
});
```

**期待結果**:
- メッセージに「タスクを機能単位に分割」
- 具体例が含まれる

---

### REQ-4: Bash解析強化テスト

**目的**: パイプ・連結コマンドの検出が正しく動作することを検証

**テストファイル**: `hooks/__tests__/bash-command-parser.test.ts`

#### TC-4-1: splitCompoundCommand - &&分割

**説明**: &&で連結されたコマンドが正しく分割されること

**テストコード**:
```typescript
import { splitCompoundCommand } from '../phase-edit-guard';

describe('REQ-4: Bash Command Parser', () => {
  it('TC-4-1: splits && compound commands', () => {
    const cmd = 'pwd && rm -rf /';
    const parts = splitCompoundCommand(cmd);

    expect(parts).toEqual(['pwd', 'rm -rf /']);
  });
});
```

**期待結果**:
- `parts = ['pwd', 'rm -rf /']`

#### TC-4-2: splitCompoundCommand - ||分割

**説明**: ||で連結されたコマンドが正しく分割されること

**テストコード**:
```typescript
it('TC-4-2: splits || compound commands', () => {
  const cmd = 'test -f file.txt || touch file.txt';
  const parts = splitCompoundCommand(cmd);

  expect(parts).toEqual(['test -f file.txt', 'touch file.txt']);
});
```

**期待結果**:
- `parts = ['test -f file.txt', 'touch file.txt']`

#### TC-4-3: splitCompoundCommand - ;分割

**説明**: セミコロンで連結されたコマンドが正しく分割されること

**テストコード**:
```typescript
it('TC-4-3: splits semicolon compound commands', () => {
  const cmd = 'git status; git diff; git log';
  const parts = splitCompoundCommand(cmd);

  expect(parts).toEqual(['git status', 'git diff', 'git log']);
});
```

**期待結果**:
- `parts = ['git status', 'git diff', 'git log']`

#### TC-4-4: splitCompoundCommand - |分割

**説明**: パイプで連結されたコマンドが正しく分割されること

**テストコード**:
```typescript
it('TC-4-4: splits pipe compound commands', () => {
  const cmd = 'cat file.txt | grep error | wc -l';
  const parts = splitCompoundCommand(cmd);

  expect(parts).toEqual(['cat file.txt', 'grep error', 'wc -l']);
});
```

**期待結果**:
- `parts = ['cat file.txt', 'grep error', 'wc -l']`

#### TC-4-5: analyzeBashCommand - `pwd && rm -rf /`→ブロック

**説明**: 連結コマンドでファイル変更コマンドが含まれるとブロックされること

**テストコード**:
```typescript
it('TC-4-5: blocks "pwd && rm -rf /"', () => {
  const cmd = 'pwd && rm -rf /';
  const result = analyzeBashCommand(cmd);

  expect(result.blocked).toBe(true);
  expect(result.reason).toContain('rm -rf /');
});
```

**期待結果**:
- `blocked = true`
- 理由に「rm -rf /」が含まれる

#### TC-4-6: analyzeBashCommand - `cat file | bash`→ブロック

**説明**: パイプでbashに渡すコマンドがブロックされること

**テストコード**:
```typescript
it('TC-4-6: blocks "cat file | bash"', () => {
  const cmd = 'cat file.txt | bash';
  const result = analyzeBashCommand(cmd);

  expect(result.blocked).toBe(true);
  expect(result.reason).toContain('bash');
});
```

**期待結果**:
- `blocked = true`

#### TC-4-7: analyzeBashCommand - `awk ... > file`→ブロック

**説明**: awk単一リダイレクトがブロックされること

**テストコード**:
```typescript
it('TC-4-7: blocks awk single redirect', () => {
  const cmd = 'awk \'BEGIN{print "test"}\' > output.ts';
  const result = analyzeBashCommand(cmd);

  expect(result.blocked).toBe(true);
  expect(result.reason).toContain('ファイル変更');
});
```

**期待結果**:
- `blocked = true`

#### TC-4-8: analyzeBashCommand - `ls -la`→許可

**説明**: 単純なread-onlyコマンドが許可されること

**テストコード**:
```typescript
it('TC-4-8: allows "ls -la"', () => {
  const cmd = 'ls -la';
  const result = analyzeBashCommand(cmd);

  expect(result.blocked).toBe(false);
});
```

**期待結果**:
- `blocked = false`

#### TC-4-9: analyzeBashCommand - `git status; git diff`→許可

**説明**: 複数のread-onlyコマンドが許可されること（フェーズによる）

**テストコード**:
```typescript
it('TC-4-9: allows "git status; git diff" (phase-dependent)', () => {
  const cmd = 'git status; git diff';
  const result = analyzeBashCommand(cmd);

  // research以降のフェーズでは許可される
  expect(result.blocked).toBe(false);
});
```

**期待結果**:
- `blocked = false` (フェーズによる)

---

### REQ-5: 成果物検証強化テスト

**目的**: 成果物の内容検証が正しく動作することを検証

**テストファイル**: `hooks/__tests__/artifact-content-validation.test.ts`

#### TC-5-1: 200バイト未満→エラー

**説明**: 最小サイズ未満のファイルがエラーになること

**テストコード**:
```typescript
import { validateArtifactContent } from '../check-workflow-artifact';

describe('REQ-5: Artifact Content Validation', () => {
  it('TC-5-1: rejects files under 200 bytes', () => {
    const content = 'Too short content';
    const result = validateArtifactContent('requirements.md', content);

    expect(result.valid).toBe(false);
    expect(result.errors).toContainEqual(
      expect.stringContaining('サイズ不足')
    );
  });
});
```

**期待結果**:
- `valid = false`
- エラーに「サイズ不足」

#### TC-5-2: 200バイト以上→通過

**説明**: 十分なサイズのファイルが通過すること

**テストコード**:
```typescript
it('TC-5-2: accepts files with 200+ bytes', () => {
  const content = 'x'.repeat(200) + '\n## 機能要件\n正当な内容';
  const result = validateArtifactContent('requirements.md', content);

  expect(result.valid).toBe(true);
});
```

**期待結果**:
- `valid = true`

#### TC-5-3: requirements.mdに`## 機能要件`なし→エラー

**説明**: 必須セクションがないファイルがエラーになること

**テストコード**:
```typescript
it('TC-5-3: rejects requirements.md without required sections', () => {
  const content = 'x'.repeat(200); // サイズは十分だがセクションなし
  const result = validateArtifactContent('requirements.md', content);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.stringContaining('必須セクションが見つかりません')
  );
});
```

**期待結果**:
- `valid = false`
- エラーに「必須セクション」

#### TC-5-4: requirements.mdに`## 機能要件`あり→通過

**説明**: 必須セクションがあるファイルが通過すること

**テストコード**:
```typescript
it('TC-5-4: accepts requirements.md with required section', () => {
  const content = 'x'.repeat(200) + '\n\n## 機能要件\n\n正当な要件定義';
  const result = validateArtifactContent('requirements.md', content);

  expect(result.valid).toBe(true);
  expect(result.errors).toHaveLength(0);
});
```

**期待結果**:
- `valid = true`
- エラー配列が空

#### TC-5-5: TODOのみの内容→ブロック

**説明**: TODOのみのスタブファイルがブロックされること

**テストコード**:
```typescript
it('TC-5-5: blocks TODO-only files', () => {
  const content = 'TODO';
  const result = validateArtifactContent('spec.md', content);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.stringContaining('禁止パターン')
  );
});
```

**期待結果**:
- `valid = false`
- エラーに「禁止パターン」

#### TC-5-6: WIPのみ→ブロック

**説明**: WIPのみのスタブファイルがブロックされること

**テストコード**:
```typescript
it('TC-5-6: blocks WIP-only files', () => {
  const content = '  WIP  \n';
  const result = validateArtifactContent('spec.md', content);

  expect(result.valid).toBe(false);
});
```

**期待結果**:
- `valid = false`

#### TC-5-7: ヘッダーのみ（本文なし）→ブロック

**説明**: ヘッダーだけで本文がないファイルがブロックされること

**テストコード**:
```typescript
it('TC-5-7: blocks header-only files', () => {
  const content = '# Title\n## Section\n### Subsection';
  const result = validateArtifactContent('spec.md', content);

  expect(result.valid).toBe(false);
  expect(result.errors).toContainEqual(
    expect.stringContaining('ヘッダーのみ')
  );
});
```

**期待結果**:
- `valid = false`

#### TC-5-8: 正常な成果物→通過

**説明**: 正当な内容のファイルが通過すること

**テストコード**:
```typescript
it('TC-5-8: accepts valid artifact', () => {
  const content = `
# 仕様書

## 実装計画

以下の機能を実装する:
- 機能A
- 機能B

## アーキテクチャ

Clean Architectureを採用する。

${'x'.repeat(200)}
`;
  const result = validateArtifactContent('spec.md', content);

  expect(result.valid).toBe(true);
});
```

**期待結果**:
- `valid = true`

---

### REQ-6: 設計検証必須化テスト

**目的**: 設計検証が強制され、環境変数で無効化できないことを検証

**テストファイル**: `mcp-server/src/__tests__/design-validation-strict.test.ts`

#### TC-6-1: SKIP_DESIGN_VALIDATION=true→検証が実行されること

**説明**: 環境変数が無視され、検証が必ず実行されること

**テストコード**:
```typescript
import { describe, it, expect, beforeEach } from 'vitest';
import { performDesignValidation } from '../tools/next';

describe('REQ-6: Design Validation Enforcement', () => {
  beforeEach(() => {
    process.env.SKIP_DESIGN_VALIDATION = 'true';
  });

  it('TC-6-1: validation runs even with SKIP_DESIGN_VALIDATION=true', () => {
    const docsDir = '/tmp/test-docs';

    // 空実装を含む設計
    prepareStubImplementation(docsDir);

    const result = performDesignValidation(docsDir);

    expect(result).not.toBeNull();
    expect(result?.success).toBe(false);
    expect(result?.message).toContain('空実装');
  });
});
```

**期待結果**:
- `result !== null`
- `success = false`
- 環境変数が無視される

#### TC-6-2: 空メソッド `method() {}`→検出

**説明**: 空メソッドが検出されること

**テストコード**:
```typescript
it('TC-6-2: detects empty method bodies', () => {
  const code = `
class UserService {
  getUser() {}
  createUser() {}
}
`;
  const stubs = findStubsInFile(code, 'user-service.ts');

  expect(stubs).toHaveLength(2);
  expect(stubs[0].name).toBe('getUser');
  expect(stubs[0].reason).toContain('メソッドボディが空');
});
```

**期待結果**:
- 2つのスタブが検出される
- 理由に「メソッドボディが空」

#### TC-6-3: TODO残存→検出

**説明**: TODOコメントを含むスタブメソッドが検出されること

**テストコード**:
```typescript
it('TC-6-3: detects TODO comments in methods', () => {
  const code = `
class OrderService {
  processOrder() {
    // TODO: 実装する
  }
}
`;
  const stubs = findStubsInFile(code, 'order-service.ts');

  expect(stubs).toHaveLength(1);
  expect(stubs[0].reason).toContain('TODO');
});
```

**期待結果**:
- 1つのスタブが検出される
- 理由に「TODO」

#### TC-6-4: 空クラス→検出

**説明**: 空のクラス定義が検出されること

**テストコード**:
```typescript
it('TC-6-4: detects empty classes', () => {
  const code = `
class EmptyClass {}
class AnotherEmpty {}
`;
  const stubs = findStubsInFile(code, 'empty.ts');

  expect(stubs).toHaveLength(2);
  expect(stubs[0].reason).toContain('クラスボディが空');
});
```

**期待結果**:
- 2つのスタブが検出される

#### TC-6-5: NotImplementedError→検出

**説明**: NotImplementedErrorを投げるメソッドが検出されること

**テストコード**:
```typescript
it('TC-6-5: detects NotImplementedError', () => {
  const code = `
class PaymentService {
  processPayment() {
    throw new NotImplementedError();
  }
}
`;
  const stubs = findStubsInFile(code, 'payment-service.ts');

  expect(stubs).toHaveLength(1);
  expect(stubs[0].reason).toContain('NotImplementedError');
});
```

**期待結果**:
- 1つのスタブが検出される

#### TC-6-6: 正当な実装→通過

**説明**: 正当な実装が検証に通過すること

**テストコード**:
```typescript
it('TC-6-6: accepts valid implementation', () => {
  const code = `
class UserService {
  getUser(id: string) {
    return this.repository.findById(id);
  }

  createUser(data: UserData) {
    const user = new User(data);
    return this.repository.save(user);
  }
}
`;
  const stubs = findStubsInFile(code, 'user-service.ts');

  expect(stubs).toHaveLength(0);
});
```

**期待結果**:
- スタブが検出されない

#### TC-6-7: VALIDATE_DESIGN_STRICT=false→厳格モードで動作

**説明**: 環境変数が無視され、常に厳格モードで動作すること

**テストコード**:
```typescript
it('TC-6-7: always uses strict mode', () => {
  process.env.VALIDATE_DESIGN_STRICT = 'false';

  const docsDir = '/tmp/test-docs';
  prepareStubImplementation(docsDir);

  const result = performDesignValidation(docsDir);

  expect(result?.success).toBe(false);
  // 警告モードではなくエラーとして返される
});
```

**期待結果**:
- `success = false`
- エラーが返される（警告ではない）

---

## 統合テスト

### E2E-1: 完全ワークフロー実行テスト

**目的**: 修正後も通常のワークフローが動作することを確認

**テスト手順**:
```bash
#!/bin/bash
# E2E-1: Full workflow execution

# 1. タスク開始
workflow_start "統合テスト"

# 2. research フェーズ
echo "# 調査結果" > docs/workflows/統合テスト/research.md
echo "x".repeat(200) >> docs/workflows/統合テスト/research.md
workflow_next

# 3. requirements フェーズ
echo "## 機能要件" > docs/workflows/統合テスト/requirements.md
echo "正当な要件" >> docs/workflows/統合テスト/requirements.md
workflow_next

# ... 以降のフェーズも同様

# 検証: 全フェーズが正常に完了すること
```

**期待結果**:
- 全フェーズが正常に遷移
- フックがブロックしない
- completedフェーズに到達

### E2E-2: 改竄検出テスト

**目的**: 状態ファイル改竄が検出されること

**テスト手順**:
```bash
# 1. タスク作成
workflow_start "改竄テスト"

# 2. 状態ファイルを手動編集
sed -i 's/"phase": "research"/"phase": "completed"/' \
  .claude/state/workflows/*/workflow-state.json

# 3. 次のコマンド実行
workflow_status

# 期待: タスクが見つからないエラー
```

**期待結果**:
- エラー: 「タスクが見つかりません」
- 署名検証失敗のログ

### E2E-3: スコープ超過テスト

**目的**: スコープ制限が正しく動作すること

**テスト手順**:
```bash
# 1. 大量ファイル作成
mkdir -p /tmp/large-scope
for i in {1..250}; do touch /tmp/large-scope/file$i.ts; done

# 2. スコープ設定試行
workflow_set_scope --files /tmp/large-scope/*.ts

# 期待: エラー
```

**期待結果**:
- エラーメッセージに「スコープが大きすぎます」
- タスク分割の推奨

---

## 性能テスト

### PERF-1: HMAC署名計算時間

**目的**: 署名計算が10ms以内に完了すること

**テストコード**:
```typescript
it('PERF-1: HMAC signature calculation < 10ms', () => {
  const state = createLargeTaskState(); // 大きなstate

  const start = Date.now();
  const signature = generateStateHmac(state);
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(10);
});
```

**期待結果**:
- `elapsed < 10ms`

### PERF-2: スコープ検証時間

**目的**: 200ファイルの検証が100ms以内に完了すること

**テストコード**:
```typescript
it('PERF-2: scope validation < 100ms for 200 files', () => {
  const files = Array.from({ length: 200 }, (_, i) => `file${i}.ts`);

  const start = Date.now();
  const result = validateScopeSize({ affectedFiles: files, affectedDirs: [] });
  const elapsed = Date.now() - start;

  expect(elapsed).toBeLessThan(100);
});
```

**期待結果**:
- `elapsed < 100ms`

---

## 回帰テスト

### REG-1: 既存テストスイート実行

**目的**: 既存の425テストが全て通過すること

**テスト手順**:
```bash
cd workflow-plugin/mcp-server
npm test

# 期待: 全テスト通過
```

**期待結果**:
- 425テスト全て通過
- エラー: 0
- 警告: 0

### REG-2: 後方互換性テスト

**目的**: 署名なし状態ファイルとの互換性が維持されること

**テストコード**:
```typescript
it('REG-2: backward compatibility with unsigned files', () => {
  // 署名なしファイルを配置
  const unsignedFile = {
    phase: 'research',
    taskId: '20260101_000000',
    // ... stateIntegrity なし
  };
  fs.writeFileSync('/tmp/test/workflow-state.json', JSON.stringify(unsignedFile));

  // 読み込み成功
  const manager = new WorkflowStateManager('/tmp');
  const state = manager.readTaskState('/tmp/test');

  expect(state).not.toBeNull();

  // 再読み込みで署名付き
  const reloaded = JSON.parse(fs.readFileSync('/tmp/test/workflow-state.json', 'utf-8'));
  expect(reloaded.stateIntegrity).toBeDefined();
});
```

**期待結果**:
- 署名なしファイルが読み込める
- 自動的に署名が追加される

---

## テストデータ

### テストフィクスチャ

**場所**: `workflow-plugin/test-fixtures/`

```
test-fixtures/
├── valid-states/
│   ├── research-state.json
│   ├── requirements-state.json
│   └── signed-state.json
│
├── invalid-states/
│   ├── tampered-state.json
│   ├── unsigned-state.json
│   └── corrupted-state.json
│
├── artifacts/
│   ├── valid-requirements.md
│   ├── invalid-requirements.md (TODOのみ)
│   └── empty-spec.md (サイズ不足)
│
└── source-code/
    ├── valid-implementation.ts
    ├── empty-methods.ts
    └── stub-implementation.ts
```

### ヘルパー関数

```typescript
// test-helpers.ts
export function createTestState(overrides?: Partial<TaskState>): TaskState {
  return {
    phase: 'research',
    taskId: '20260101_000000',
    taskName: 'test-task',
    workflowDir: '/tmp/test',
    startedAt: '2026-01-01T00:00:00Z',
    checklist: {},
    history: [],
    subPhases: {},
    ...overrides,
  };
}

export function prepareStubImplementation(docsDir: string): void {
  const code = `
class EmptyService {
  method() {}
}
`;
  fs.writeFileSync(path.join(docsDir, 'stub.ts'), code);
}
```

---

## テスト実行計画

### Phase 1: ユニットテスト（1日目）

- REQ-1: FAIL_OPEN除去テスト（5件）
- REQ-2: HMAC署名テスト（8件）
- REQ-3: スコープ制限テスト（6件）

### Phase 2: ユニットテスト（2日目）

- REQ-4: Bash解析テスト（9件）
- REQ-5: 成果物検証テスト（8件）
- REQ-6: 設計検証テスト（7件）

### Phase 3: 統合テスト（3日目）

- E2E-1, E2E-2, E2E-3
- 性能テスト（PERF-1, PERF-2）

### Phase 4: 回帰テスト（4日目）

- 既存425テスト実行
- 後方互換性テスト
- 最終検証

---

## テストカバレッジ目標

| 項目 | 目標 | 計測方法 |
|------|------|---------|
| 新規コード | 90%以上 | c8/vitest coverage |
| 既存コード | 現状維持 | 回帰なし |
| 分岐カバレッジ | 85%以上 | 全分岐を網羅 |

**コマンド**:
```bash
npm run test:coverage
```

---

## テスト成功基準

以下の全てを満たすこと:

- ✅ 新規テストケース50件以上が全て通過
- ✅ 既存テスト425件が全て通過
- ✅ カバレッジが90%以上
- ✅ E2Eテストが全て通過
- ✅ 性能テストが基準内
- ✅ 回帰テストでエラーなし

---

## リスク管理

| リスク | 対策 |
|--------|------|
| 既存テストの破壊 | 段階的適用、各REQ後にテスト実行 |
| パフォーマンス劣化 | PERF-1, PERF-2で計測 |
| 環境依存の問題 | CI/CD環境での実行を含める |

---

## 関連ファイル

<!-- @related-files -->
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/enforce-workflow.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/phase-edit-guard.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/block-dangerous-commands.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/hooks/check-workflow-artifact.js`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/types.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/state/manager.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/set-scope.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/tools/next.ts`
- `/mnt/c/ツール/Workflow/workflow-plugin/mcp-server/src/validation/design-validator.ts`
<!-- @end-related-files -->
