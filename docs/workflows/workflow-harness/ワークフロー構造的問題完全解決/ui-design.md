# UI設計 - ワークフロー構造的問題完全解決

## サマリー

本ドキュメントはMCPサーバー（CLIツール）のレスポンスメッセージ設計仕様を定義する。

- **目的**: REQ-1～REQ-6に対応するユーザー向けメッセージの標準化
- **主要要素**: 承認待機、HMAC検証、テスト回帰、スコープ検出、セッショントークン、workflow_start成功時のメッセージ
- **実装対象**: mcp-server/src/tools/ のレスポンス実装

次フェーズ（test_design）ではこのメッセージ仕様に基づいてテストシナリオを定義する。

---

## システムコンテキスト

### 対象コンポーネント
- **workflow_start**: タスク開始、sessionToken生成・返却
- **workflow_next**: フェーズ遷移、承認チェック、テスト回帰検出、スコープ検証
- **workflow_approve**: 承認ゲート通過
- **workflow_reset**: リセット実行

### メッセージカテゴリ
1. **成功メッセージ**: フェーズ遷移、承認完了
2. **承認待機メッセージ**: 承認必須フェーズのブロック
3. **エラーメッセージ**: HMAC検証、テスト回帰、スコープ外、トークンエラー

### メッセージフロー

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP ツールコール                       │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  workflow_start  →  sessionToken生成  →  成功メッセージ    │
│                                                             │
│  workflow_next   →  承認チェック  ┬─→  承認待機メッセージ  │
│                                  │                         │
│                                  └─→  フェーズ遷移  →  成功  │
│                                                             │
│  workflow_approve  →  承認タイプ検証  →  成功メッセージ    │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

---

## メッセージ設計

### 1. workflow_start成功メッセージ

**トリガー**: タスク開始時、sessionToken生成完了

**メッセージ構造**:
```
{
  "status": "success",
  "message": "タスク開始",
  "data": {
    "taskId": "<task-id>",
    "taskName": "<task-name>",
    "phase": "research",
    "sessionToken": "<64-char-hex-token>",
    "description": "新しいセッションが作成されました"
  }
}
```

**メッセージテンプレート**:
```
✅ ワークフロー開始

タスク ID: {taskId}
タスク名: {taskName}
現在フェーズ: {phase}
セッショントークン: {sessionToken}

⚠️ 注意: 以後のフェーズ遷移には、このセッショントークンが必要です。
紛失した場合は workflow_status で確認できます。
```

**データ仕様**:
| 項目 | 型 | 説明 | 例 |
|------|------|------|-----|
| taskId | string | タスク識別子 | "task_20260208_001" |
| taskName | string | タスク名（最大100文字） | "ワークフロー構造的問題完全解決" |
| phase | string | 開始フェーズ（常に research） | "research" |
| sessionToken | string | HMAC署名検証用トークン（32 bytes hex = 64文字） | "a1b2c3d4e5f6..." |
| description | string | 説明文（最大200文字） | "新しいセッションが作成されました" |

**実装場所**: `mcp-server/src/tools/start.ts`

---

### 2. 承認待機メッセージ（requirements フェーズ）

**トリガー**: workflow_next で requirements→parallel_analysis 遷移時、承認未完了

**メッセージ構造**:
```
{
  "status": "blocked",
  "phase": "requirements",
  "reason": "approval_required",
  "message": "requirements フェーズの承認待機中",
  "data": {
    "requiredApproval": "requirements",
    "nextPhase": "parallel_analysis",
    "approvalStatus": "pending",
    "instruction": "workflow approve requirements で承認してください"
  }
}
```

**メッセージテンプレート**:
```
⏸️  承認待機: requirements フェーズ

現在のフェーズ: requirements
次のフェーズ: parallel_analysis

本フェーズは品質ゲートがあります。
以下の要件を満たしていることを確認した上で、承認してください：

✓ 要件定義書が完成している
✓ 用語集に必要な用語が記載されている
✓ 機能仕様書が記載されている
✓ ユーザーストーリーが定義されている

承認コマンド:
  /workflow approve requirements --sessionToken {sessionToken}
```

**データ仕様**:
| 項目 | 型 | 説明 |
|------|------|------|
| requiredApproval | string | 承認タイプ: "requirements" |
| nextPhase | string | 承認後のフェーズ: "parallel_analysis" |
| approvalStatus | string | 承認状態: "pending" |
| instruction | string | 指示文 |

**実装場所**: `mcp-server/src/tools/next.ts` - requiresApproval() 関数

---

### 3. 承認待機メッセージ（test_design フェーズ）

**トリガー**: workflow_next で test_design→test_impl 遷移時、承認未完了

**メッセージ構造**:
```
{
  "status": "blocked",
  "phase": "test_design",
  "reason": "approval_required",
  "message": "test_design フェーズの承認待機中",
  "data": {
    "requiredApproval": "test_design",
    "nextPhase": "test_impl",
    "approvalStatus": "pending",
    "instruction": "workflow approve test_design で承認してください"
  }
}
```

**メッセージテンプレート**:
```
⏸️  承認待機: test_design フェーズ

現在のフェーズ: test_design
次のフェーズ: test_impl

本フェーズは品質ゲートがあります。
以下の要件を満たしていることを確認した上で、承認してください：

✓ テスト計画書が作成されている
✓ ユニットテストケースが定義されている（最小10個）
✓ 統合テストケースが定義されている
✓ テスト設計がspec.md と整合している

承認コマンド:
  /workflow approve test_design --sessionToken {sessionToken}
```

**実装場所**: `mcp-server/src/tools/next.ts` - requiresApproval() 関数

---

### 4. 承認待機メッセージ（code_review フェーズ）

**トリガー**: workflow_next で code_review→testing 遷移時、承認未完了

**メッセージ構造**:
```
{
  "status": "blocked",
  "phase": "code_review",
  "reason": "approval_required",
  "message": "code_review フェーズの承認待機中",
  "data": {
    "requiredApproval": "code_review",
    "nextPhase": "testing",
    "approvalStatus": "pending",
    "instruction": "workflow approve code_review で承認してください"
  }
}
```

**メッセージテンプレート**:
```
⏸️  承認待機: code_review フェーズ

現在のフェーズ: code_review
次のフェーズ: testing

本フェーズは品質ゲートがあります。
以下の要件を満たしていることを確認した上で、承認してください：

✓ コードレビュー結果が記載されている
✓ セキュリティレビューが完了している
✓ パフォーマンスレビューが完了している
✓ spec.md との設計整合性が検証されている
✓ 実装漏れがない

承認コマンド:
  /workflow approve code_review --sessionToken {sessionToken}
```

**実装場所**: `mcp-server/src/tools/next.ts` - requiresApproval() 関数

---

### 5. HMAC検証失敗メッセージ

**トリガー**: verifyStateHmac() が false を返す（HMAC_STRICT !== 'false' の場合）

**メッセージ構造**:
```
{
  "status": "error",
  "error": {
    "code": "HMAC_VERIFICATION_FAILED",
    "message": "状態ファイルのHMAC検証に失敗しました",
    "severity": "critical",
    "details": {
      "workflowDir": "<workflow-dir>",
      "reason": "signature_mismatch | missing_signature | computation_error",
      "suggestion": "環境変数 HMAC_STRICT=false で緩和モードを有効にしてください（デバッグ用）"
    }
  }
}
```

**メッセージテンプレート**:
```
❌ HMAC検証エラー

状態ファイルの整合性検証に失敗しました。

原因:
  - 状態ファイルが破損している
  - 外部で状態ファイルが改ざんされている
  - デバッグ時に手動編集された

対応方法:
  1. ワークフロー再開: /workflow reset "HMAC検証失敗"
  2. デバッグ用に緩和する: export HMAC_STRICT=false
  3. サポートに連絡してください

ワークフローディレクトリ: {workflowDir}
```

**詳細エラーケース**:

| 原因 | コード | メッセージ |
|------|--------|-----------|
| 署名なし | `missing_signature` | "署名情報が見つかりません" |
| 署名不一致 | `signature_mismatch` | "署名が一致しません。状態ファイルが改ざんされた可能性があります" |
| 計算エラー | `computation_error` | "署名計算に失敗しました" |
| 検証エラー | `verification_error` | "署名検証中にエラーが発生しました" |

**実装場所**: `mcp-server/src/state/manager.ts` - verifyStateHmac()

---

### 6. テスト回帰検出メッセージ（テスト数減少）

**トリガー**: workflow_next で regression_test→parallel_verification 遷移時、テスト数がbaseline未満

**メッセージ構造**:
```
{
  "status": "blocked",
  "phase": "regression_test",
  "reason": "test_regression_detected",
  "message": "テスト数の回帰が検出されました",
  "data": {
    "regression": {
      "type": "test_count_reduction",
      "baseline": {
        "totalTests": 42,
        "passedTests": 40,
        "failedTests": 2
      },
      "current": {
        "totalTests": 38,
        "passedTests": 38,
        "failedTests": 0
      },
      "delta": {
        "totalTests": -4,
        "passedTests": -2,
        "failedTests": -2
      }
    },
    "description": "テスト数が 4 個減少しています。削除前後で同等のテストカバレッジを確認してください"
  }
}
```

**メッセージテンプレート**:
```
⚠️  テスト数の回帰が検出されました

baseline（前回実行時）:
  総テスト数: {baselineTotalTests}
  成功: {baselinePassedTests}
  失敗: {baselineFailedTests}

現在:
  総テスト数: {currentTotalTests}
  成功: {currentPassedTests}
  失敗: {currentFailedTests}

差分:
  総テスト数: {deltaTotal} ({deltaPercent}%)
  成功: {deltaPass}
  失敗: {deltaFail}

対応:
  1. テスト削除の妥当性を確認してください
  2. 代替テストが追加されているか確認してください
  3. 確認後、以下で承認してください:
     /workflow approve regression_test --sessionToken {sessionToken}

⚠️  テスト数の削減は意図的な変更です。
    削除したテストが不要な理由を確認してください。
```

**実装場所**: `mcp-server/src/tools/next.ts` - validateTestRegression()

---

### 7. テスト回帰検出メッセージ（パス数低下）

**トリガー**: workflow_next で regression_test→parallel_verification 遷移時、パス数がbaseline未満

**メッセージ構造**:
```
{
  "status": "blocked",
  "phase": "regression_test",
  "reason": "test_regression_detected",
  "message": "テストパス数の低下が検出されました",
  "data": {
    "regression": {
      "type": "passed_count_reduction",
      "baseline": {
        "passedTests": 40,
        "failedTests": 2,
        "passRate": 95.2
      },
      "current": {
        "passedTests": 38,
        "failedTests": 4,
        "passRate": 90.5
      },
      "delta": {
        "passedTests": -2,
        "failedTests": +2,
        "passRate": -4.7
      }
    },
    "description": "テスト成功数が 2 個減少し、失敗数が 2 個増加しています。品質低下の原因を調査してください"
  }
}
```

**メッセージテンプレート**:
```
🚨 テスト成功率の低下が検出されました

baseline（前回実行時）:
  成功: {baselinePassedTests}
  失敗: {baselineFailedTests}
  成功率: {baselinePassRate}%

現在:
  成功: {currentPassedTests}
  失敗: {currentFailedTests}
  成功率: {currentPassRate}%

差分:
  成功: {deltaPass} ({deltaPassPercent}%)
  失敗: {deltaFail}
  成功率低下: {deltaPassRate}%

対応:
  1. 失敗したテスト {deltaFail} 個の原因を特定してください
  2. implementation フェーズで修正してください
  3. テストが再度パスすることを確認してください

⛔️ テスト品質の低下は許容できません。
   修正なしにはフェーズ遷移できません。
```

**実装場所**: `mcp-server/src/tools/next.ts` - validateTestRegression()

---

### 8. スコープ外ファイル検出メッセージ

**トリガー**: workflow_next で docs_update→commit 遷移時、git diff でスコープ外ファイルが検出

**メッセージ構造**:
```
{
  "status": "warning",
  "phase": "docs_update",
  "reason": "out_of_scope_files_detected",
  "message": "スコープ外のファイルが変更されました",
  "data": {
    "outOfScopeFiles": [
      {
        "path": "src/components/Button.tsx",
        "scope": ["src/backend/", "src/frontend/components/ui/"],
        "status": "added | modified | deleted"
      },
      {
        "path": ".env",
        "scope": ["src/backend/", "src/frontend/components/ui/"],
        "status": "modified"
      }
    ],
    "scopeStrict": false,
    "description": "3個のファイルがスコープ外です（警告モード）",
    "suggestion": "スコープ再確認後、環境変数 SCOPE_STRICT=true で厳格モードを有効にしてください"
  }
}
```

**メッセージテンプレート（警告モード: SCOPE_STRICT !== 'true'）**:
```
⚠️  スコープ外のファイル変更が検出されました（警告）

タスクスコープ:
  {scopeList}

検出されたスコープ外ファイル ({count}個):
{fileList}

対応:
  1. 各ファイルの変更が意図的か確認してください
  2. 必要に応じてスコープを更新してください
  3. 継続するには以下を実行してください:
     /workflow next --sessionToken {sessionToken}

ℹ️  本メッセージは警告です。強制するには SCOPE_STRICT=true を設定してください。
```

**メッセージテンプレート（厳格モード: SCOPE_STRICT=true）**:
```
❌ スコープ外のファイル変更が検出されました（エラー）

タスクスコープ:
  {scopeList}

検出されたスコープ外ファイル ({count}個):
{fileList}

対応:
  1. スコープ外のファイルを復元してください:
     git checkout HEAD -- {outOfScopeFiles}
  2. または、タスク要件に含めてスコープを拡張してください
  3. その後、再度コミットしてください

⛔️ 厳格モードでは、スコープ外ファイルの変更は禁止されています。
```

**除外パターン** (常に許可):
- `.md`, `.mdx` (ドキュメント)
- `package.json`, `package-lock.json`, `pnpm-lock.yaml` (依存管理)
- `.claude/state/` (ワークフロー内部状態)
- `docs/workflows/` (ワークフロー成果物)
- `.env`, `.env.local` (環境設定)

**ファイルリスト形式**:
```
  • src/components/Button.tsx (modified)
  • package.json (modified)
  • .env (added)
```

**実装場所**: `mcp-server/src/tools/next.ts` - validateScopePostExecution()

---

### 9. セッショントークン検証エラーメッセージ

**トリガー**: workflow_next, workflow_approve, workflow_reset 実行時、sessionToken不一致または未設定

**メッセージ構造**:
```
{
  "status": "error",
  "error": {
    "code": "SESSION_TOKEN_INVALID",
    "message": "セッショントークンの検証に失敗しました",
    "severity": "high",
    "details": {
      "reason": "token_mismatch | token_missing | token_expired",
      "instruction": "workflow status で現在のセッショントークンを確認してください"
    }
  }
}
```

**メッセージテンプレート（トークン未設定）**:
```
❌ セッショントークンが設定されていません

このタスクはセッショントークン方式のワークフローです。
フェーズ遷移にはセッショントークンが必要です。

対応:
  1. 現在のセッショントークンを確認:
     /workflow status

  2. トークンをコマンドに含める:
     /workflow next --sessionToken <token>
     /workflow approve {type} --sessionToken <token>

ℹ️  新しいセッション開始時は workflow_start の出力からトークンを取得してください。
```

**メッセージテンプレート（トークン不一致）**:
```
❌ セッショントークンが一致しません

指定されたトークン:
  {providedToken}

現在のトークン:
  {expectedToken}

対応:
  1. 正しいセッショントークンを確認:
     /workflow status

  2. 正しいトークンを指定して再試行:
     /workflow next --sessionToken {expectedToken}

⚠️  トークンが一致しない場合、別のセッションからのアクセスの可能性があります。
```

**MESSAGE テンプレート（トークン環境変数無効化時）**:
```
ℹ️  セッショントークン検証が無効化されています

環境変数 SESSION_TOKEN_REQUIRED=false が設定されています。
本番環境では絶対に使用しないでください。

トークン検証の有効化:
  unset SESSION_TOKEN_REQUIRED
```

**実装場所**: `mcp-server/src/tools/next.ts`, `approve.ts`, `reset.ts`

---

### 10. フェーズ遷移成功メッセージ

**トリガー**: workflow_next で フェーズ遷移完了

**メッセージ構造**:
```
{
  "status": "success",
  "message": "フェーズ遷移完了",
  "data": {
    "fromPhase": "{previousPhase}",
    "toPhase": "{nextPhase}",
    "taskId": "{taskId}",
    "timestamp": "2026-02-08T10:30:00Z",
    "remainingPhases": 15
  }
}
```

**メッセージテンプレート**:
```
✅ フェーズ遷移完了

前のフェーズ: {fromPhase}
現在のフェーズ: {toPhase}

タスク ID: {taskId}
実行時刻: {timestamp}
残りフェーズ数: {remainingPhases}

次のステップ:
  /workflow status でフェーズの詳細を確認
  /workflow next でフェーズ遷移を継続
```

**実装場所**: `mcp-server/src/tools/next.ts`

---

### 11. 承認完了メッセージ

**トリガー**: workflow_approve で承認成功

**メッセージ構造**:
```
{
  "status": "success",
  "message": "承認完了",
  "data": {
    "approvalType": "{type}",
    "phase": "{phase}",
    "nextPhase": "{nextPhase}",
    "taskId": "{taskId}",
    "timestamp": "2026-02-08T10:30:00Z"
  }
}
```

**メッセージテンプレート**:
```
✅ 承認完了: {approvalType} フェーズ

フェーズ: {phase}
次のフェーズ: {nextPhase}

タスク ID: {taskId}
承認時刻: {timestamp}

次のステップ:
  /workflow next でフェーズ遷移を続行
```

**実装場所**: `mcp-server/src/tools/approve.ts`

---

## メッセージの表示フロー

```
┌──────────────────────────────────────────────────────────────┐
│                    workflow_next コール                      │
├──────────────────────────────────────────────────────────────┤
│                           │                                  │
│                           ▼                                  │
│                   sessionToken 検証                          │
│                           │                                  │
│               ┌───────────┼───────────┐                      │
│               │ トークン   │ トークン   │                      │
│               │ 不正      │ 正常      │                      │
│               ▼           ▼           ▼                      │
│           [Error]    承認確認    [Error]                     │
│          (MSG-9)     必須か?      (HMAC)                      │
│                       │            (MSG-5)                   │
│                   ┌───┴───┐                                  │
│                   │ Yes   │ No                               │
│                   ▼       ▼                                  │
│              [Blocked]  テスト回帰                            │
│              (MSG-2,3,4) 検証                                │
│                          │                                  │
│                      ┌───┴───┐                              │
│                      │ OK    │ NG                           │
│                      ▼       ▼                              │
│                   スコープ  [Blocked]                        │
│                   検証    (MSG-6,7)                          │
│                      │                                      │
│                  ┌───┴───┐                                  │
│                  │ OK    │ NG                               │
│                  ▼       ▼                                  │
│              遷移実行  [Warning]                             │
│                      (MSG-8)                                │
│                      │                                      │
│                      ▼                                      │
│                  [Success]                                  │
│                   (MSG-10)                                  │
│                                                              │
└──────────────────────────────────────────────────────────────┘
```

---

## メッセージ フォーマット規約

### JSON レスポンス基本構造

全てのレスポンスは以下の基本構造を持つ:

```json
{
  "status": "success | error | blocked | warning",
  "message": "ユーザー向けメッセージ（1行）",
  "data": { ... },
  "error": { ... }  // status=error の場合のみ
}
```

### ステータスコード対応

| status | HTTPステータス | 意味 |
|--------|--------------|------|
| success | 200 | 処理成功 |
| blocked | 403 | 承認待機・ブロック状態 |
| warning | 200 | 警告（処理は続行） |
| error | 4xx, 500 | エラー（処理中止） |

### メッセージ文字列規約

- **1行目**: 絵文字 + 主要メッセージ（最大100文字）
- **詳細行**: インデント2スペース、プレーンテキスト
- **絵文字**:
  - ✅ = 成功
  - ⏸️ = 承認待機
  - ⚠️ = 警告・注意
  - ❌ = エラー
  - 🚨 = 重大エラー
  - ℹ️ = 情報・ヒント

---

## テストシナリオ

### シナリオ1: workflow_start 成功

**前提**: 新しいタスク

**期待結果**:
- sessionToken（64文字hex）が返却される
- TaskState に sessionToken が保存される
- ログに "task started: {taskId}" が出力される

**メッセージ**: MSG-1 に準拠

### シナリオ2: requirements 承認待機

**前提**: requirements フェーズの状態で workflow_next 実行

**期待結果**:
- blocked ステータスで返される
- "approval_required" 理由が含まれる
- 承認コマンド例が表示される

**メッセージ**: MSG-2 に準拠

### シナリオ3: HMAC検証失敗

**前提**: HMAC_STRICT が設定されていない、署名なしまたは不一致の状態ファイル

**期待結果**:
- error ステータスで返される
- readTaskState() が null を返す
- "HMAC_VERIFICATION_FAILED" コードが含まれる

**メッセージ**: MSG-5 に準拠

### シナリオ4: テスト数回帰

**前提**: regression_test フェーズでテスト総数 < baseline.totalTests

**期待結果**:
- blocked ステータスで返される
- baseline と current の統計が表示される
- delta（差分）が計算される

**メッセージ**: MSG-6 に準拠

### シナリオ5: パス数低下

**前提**: regression_test フェーズでテストパス数 < baseline.passedTests

**期待結果**:
- blocked ステータスで返される
- 失敗テストの詳細が表示される
- implementation フェーズへの差し戻しを促す

**メッセージ**: MSG-7 に準拠

### シナリオ6: スコープ外ファイル（警告）

**前提**: SCOPE_STRICT が 'true' ではない、スコープ外ファイルが変更

**期待結果**:
- warning ステータスで返される
- スコープとファイルリストが表示される
- 遷移は続行可能

**メッセージ**: MSG-8（警告モード）に準拠

### シナリオ7: スコープ外ファイル（エラー）

**前提**: SCOPE_STRICT=true、スコープ外ファイルが変更

**期待結果**:
- error ステータスで返される
- git checkout コマンド例が表示される
- フェーズ遷移がブロック

**メッセージ**: MSG-8（厳格モード）に準拠

### シナリオ8: セッショントークン不正

**前提**: sessionToken パラメータが未設定または不一致

**期待結果**:
- error ステータスで返される
- "SESSION_TOKEN_INVALID" コードが返される
- 正しいトークン取得方法が表示される

**メッセージ**: MSG-9 に準拠

### シナリオ9: フェーズ遷移成功

**前提**: 承認・検証が全てパス

**期待結果**:
- success ステータスで返される
- fromPhase, toPhase が表示される
- 残りフェーズ数が表示される

**メッセージ**: MSG-10 に準拠

---

## 実装チェックリスト

実装フェーズで以下を確認すること:

- [ ] MSG-1: workflow_start で sessionToken(64文字hex) が返却される
- [ ] MSG-2: requirements 承認待機メッセージが表示される
- [ ] MSG-3: test_design 承認待機メッセージが表示される
- [ ] MSG-4: code_review 承認待機メッセージが表示される
- [ ] MSG-5: HMAC検証失敗時 error ステータスで返される
- [ ] MSG-6: テスト数回帰時 blocked ステータスで delta が表示される
- [ ] MSG-7: パス数低下時 blocked ステータスで失敗テストが表示される
- [ ] MSG-8(警告): スコープ外 warning ステータスで表示される
- [ ] MSG-8(厳格): スコープ外 error ステータスで復元コマンドが表示される
- [ ] MSG-9: sessionToken 不正時 error ステータスで返される
- [ ] MSG-10: フェーズ遷移成功時 success ステータスで remainingPhases が表示される
- [ ] MSG-11: 承認完了時 success ステータスで返される

---

## 制約事項

1. **メッセージの言語**: 全て日本語（エモジは言語非依存）
2. **文字制限**: メッセージ1行目は最大100文字
3. **JSON形式**: RFC 7159 準拠、UTF-8 エンコーディング
4. **数値精度**: パス率は小数第1位（例: 95.2%）
5. **タイムスタンプ**: ISO 8601 形式（UTC）
6. **トークン**: 64文字の16進数文字列（32 bytes）
7. **ログレベル**: ユーザーメッセージと開発者ログを分離
8. **後方互換性**: 既存タスク（tokenなし）は警告のみで続行（SESSION_TOKEN_REQUIRED=false で機能切り替え）

---

## 関連ファイル

<!-- @related-files -->
- `mcp-server/src/tools/start.ts` - workflow_start メッセージ実装
- `mcp-server/src/tools/next.ts` - workflow_next メッセージ実装
- `mcp-server/src/tools/approve.ts` - workflow_approve メッセージ実装
- `mcp-server/src/state/manager.ts` - HMAC検証メッセージ実装
- `mcp-server/src/validation/scope-validator.ts` - スコープ検証メッセージ実装
<!-- @end-related-files -->
