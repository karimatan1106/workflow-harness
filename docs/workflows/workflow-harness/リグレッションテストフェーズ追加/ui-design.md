# リグレッションテストフェーズ追加 - UI設計

## 概要

この機能はワークフロープラグインのバックエンド変更であり、直接的なUI変更はない。

ただし、ワークフローステータス表示に関連する変更がある。

## 影響を受けるUI

### 1. workflow_status コマンドの出力

#### 変更前
```json
{
  "phase": "testing",
  "nextPhase": "parallel_verification"
}
```

#### 変更後
```json
{
  "phase": "testing",
  "nextPhase": "regression_test"
}

// または

{
  "phase": "regression_test",
  "nextPhase": "parallel_verification"
}
```

### 2. フェーズ数の表示

- 変更前: 18フェーズ
- 変更後: 19フェーズ

### 3. 進捗表示

AIが報告する「残りNフェーズ」の数が変わる。

## コマンドライン出力例

### regression_test フェーズの表示

```
【regression_testフェーズ】
- 目的: 既存機能の回帰テストを実行
- 対象: src/backend/tests/regression/, src/frontend/test/regression/

テスト実行中...

バックエンド: 15 passed, 0 failed
フロントエンド: 8 passed, 0 failed

全てのリグレッションテストがパスしました。
次のフェーズに進めます: parallel_verification
```

### テスト失敗時の表示

```
【regression_testフェーズ】

❌ リグレッションテストが失敗しました

失敗したテスト:
- src/backend/tests/regression/user-auth/test_login.py::test_invalid_password
- src/frontend/test/regression/checkout/payment.test.tsx::should handle timeout

次フェーズに進むには、全てのテストをパスさせる必要があります。
```

## 非UI要素

この変更は主に以下に影響する:

1. **MCPサーバー**: フェーズ定義の変更
2. **フック**: フェーズ遷移の検証
3. **CLAUDE.md**: AIへの指示

これらはUI要素ではなく、バックエンドロジックの変更。
