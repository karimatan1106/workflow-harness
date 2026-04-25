# 既存バグ記録機能 - テスト設計

## テストケース

### workflow_record_known_bug

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| T1 | regression_testフェーズで正常記録 | success: true, bugId生成 |
| T2 | 他フェーズで呼び出し | エラー（フェーズ違反） |
| T3 | 必須パラメータ欠落 | エラー（パラメータ不足） |
| T4 | 同一テスト名の重複記録 | エラー（重複） |
| T5 | bugId自動採番 | BUG-001, BUG-002... |

### workflow_get_known_bugs

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| T6 | バグあり | knownBugs配列返却 |
| T7 | バグなし | 空配列 |
| T8 | 存在しないタスクID | エラー |

## テストファイル

`mcp-server/src/tools/__tests__/known-bugs.test.ts`
