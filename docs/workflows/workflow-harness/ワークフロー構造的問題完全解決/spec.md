# 仕様書 - ワークフロー構造的問題完全解決

## サマリー

ワークフロープラグインの6つの構造的問題を根本的に解決する実装仕様。

- REQ-1: HMAC署名検証をデフォルト厳格化（HMAC_STRICT !== 'false'で厳格）
- REQ-2: 承認ゲートを4箇所に拡張（requirements, test_design, code_review, design_review）
- REQ-3: 成果物品質検証強化（セクション最小文字数、コンテンツ比率、Mermaid構文）
- REQ-4: テスト回帰チェック（testBaseline必須、テスト数・パス数の監視）
- REQ-5: スコープ事後検証（git diff照合、スコープ外ファイル検出）
- REQ-6: セッショントークン方式（subagentフェーズ遷移の技術的ブロック）

## 変更対象ファイル

| ファイル | REQ | 変更内容 |
|---------|-----|---------|
| `mcp-server/src/state/manager.ts` | REQ-1 | verifyStateHmac()厳格化 |
| `mcp-server/src/state/types.ts` | REQ-6 | TaskState.sessionToken追加 |
| `mcp-server/src/tools/start.ts` | REQ-6 | sessionToken生成・返却 |
| `mcp-server/src/tools/next.ts` | REQ-2,4,5,6 | 承認チェック、baseline比較、git diff、トークン検証 |
| `mcp-server/src/tools/approve.ts` | REQ-2,6 | 承認タイプ拡張、トークン検証 |
| `mcp-server/src/tools/reset.ts` | REQ-6 | トークン検証 |
| `mcp-server/src/phases/definitions.ts` | REQ-2 | REVIEW_PHASES拡張、APPROVE_TYPE_MAPPING拡張 |
| `mcp-server/src/validation/artifact-validator.ts` | REQ-3 | 3関数追加、禁止パターン強化 |
| `mcp-server/src/validation/scope-validator.ts` | REQ-5 | validateScopePostExecution()追加 |

## REQ-1: HMAC署名検証の厳格化

### 変更箇所: manager.ts verifyStateHmac()

```typescript
export function verifyStateHmac(state: TaskState, expectedHmac: string): boolean {
  if (process.env.HMAC_STRICT === 'false') {
    return true; // 緩和モード
  }
  // デフォルト: 厳格モード
  if (!expectedHmac || expectedHmac.trim() === '') {
    console.warn('[HMAC] 署名なし - 拒否');
    return false;
  }
  const actualHmac = generateStateHmac(state);
  try {
    const expectedBuffer = Buffer.from(expectedHmac, 'base64');
    const actualBuffer = Buffer.from(actualHmac, 'base64');
    if (expectedBuffer.length !== actualBuffer.length) {
      console.warn('[HMAC] 署名長さ不一致 - 拒否');
      return false;
    }
    if (!crypto.timingSafeEqual(expectedBuffer, actualBuffer)) {
      console.warn('[HMAC] 署名不一致 - 拒否');
      return false;
    }
    return true;
  } catch (error) {
    console.error('[HMAC] 検証エラー - 拒否:', error);
    return false;
  }
}
```

環境変数: `HMAC_STRICT=false` で緩和モード（開発・移行時のみ）

## REQ-2: 複数承認ゲートの追加

### 変更箇所1: definitions.ts

```typescript
export const REVIEW_PHASES: PhaseName[] = [
  'requirements',
  'design_review',
  'test_design',
  'code_review',
];

export const APPROVE_TYPE_MAPPING: Record<string, { expectedPhase: PhaseName; nextPhase: PhaseName }> = {
  requirements: { expectedPhase: 'requirements', nextPhase: 'parallel_analysis' },
  design: { expectedPhase: 'design_review', nextPhase: 'test_design' },
  test_design: { expectedPhase: 'test_design', nextPhase: 'test_impl' },
  code_review: { expectedPhase: 'code_review', nextPhase: 'testing' },
};
```

### 変更箇所2: approve.ts

承認タイプのenum拡張:
```typescript
enum: ['requirements', 'design', 'test_design', 'code_review'],
```

next.tsの既存requiresApproval()チェックが自動的に新フェーズにも適用される。

## REQ-3: 成果物品質検証の強化

### 追加関数1: validateSectionContent()
各##セクション内の本文が最低50文字あることを検証。

### 追加関数2: validateContentRatio()
ヘッダー行vs本文行の比率チェック。本文が全体の60%以上であること。

### 追加関数3: validateMermaidStructure()
- stateDiagram: 状態3個以上、遷移(-->)2個以上
- flowchart: ノード3個以上、エッジ2個以上

### 禁止パターン強化
```typescript
const forbiddenPatterns = [
  /t\s*o\s*d\s*o/i,
  /t\s*b\s*d/i,
  /w\s*i\s*p/i,
  /f\s*i\s*x\s*m\s*e/i,
];
```

## REQ-4: テスト回帰チェック

### 変更箇所: next.ts

testing→regression_test遷移時:
- testResult.passedCount + failedCount からtestBaselineを自動設定

regression_test→parallel_verification遷移時:
- testBaseline未設定→ブロック
- テスト総数 < baseline.totalTests→ブロック
- パス数 < baseline.passedTests→ブロック

## REQ-5: スコープ事後検証

### 追加関数: scope-validator.ts validateScopePostExecution()
- `git diff --name-only HEAD` で変更ファイル取得
- スコープ宣言ファイル/ディレクトリと照合
- 除外パターン: .md, package.json, .claude/state/, docs/workflows/
- SCOPE_STRICT=true で厳格モード（デフォルト: 警告のみ）

### トリガー: next.ts docs_update→commit遷移時

## REQ-6: セッショントークン方式

### types.ts
```typescript
sessionToken?: string; // TaskStateに追加
```

### start.ts
```typescript
const sessionToken = crypto.randomBytes(32).toString('hex');
// TaskStateに保存、レスポンスに含める
```

### next.ts, approve.ts, reset.ts
```typescript
// パラメータにsessionToken追加（必須）
// taskState.sessionTokenと照合
// 不一致→エラー
// SESSION_TOKEN_REQUIRED=false で無効化可能
```

### ツール定義の変更
sessionTokenをrequiredパラメータに追加。
既存タスク（tokenなし）は警告のみで続行。
