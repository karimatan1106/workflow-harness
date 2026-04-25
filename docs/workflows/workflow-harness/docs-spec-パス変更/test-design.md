# テスト設計: docs/product → docs/spec パス変更

## テストスコープ

### 1. 置換完了確認テスト

| テストID | テスト内容 | 期待結果 |
|---------|---------|---------|
| TC-001 | grep -r "docs/product/" workflow-plugin/ | 0件 |
| TC-002 | grep "docs/product/" CLAUDE.md | 0件 |
| TC-003 | grep -r "docs/spec/" workflow-plugin/ | 182件以上 |

### 2. ビルドテスト

| テストID | テスト内容 | 期待結果 |
|---------|---------|---------|
| TC-004 | npm run build (mcp-server) | 成功 |
| TC-005 | TypeScriptコンパイルエラー | 0件 |

### 3. 既存テスト

| テストID | テスト内容 | 期待結果 |
|---------|---------|---------|
| TC-006 | npm test (mcp-server) | 全テストパス |
| TC-007 | types.test.ts | パス |
| TC-008 | start.test.ts | パス |

### 4. フック動作テスト

| テストID | テスト内容 | 期待結果 |
|---------|---------|---------|
| TC-009 | spec-first-guard.js実行 | エラーなし |
| TC-010 | check-spec.js実行 | エラーなし |
| TC-011 | phase-edit-guard.js実行 | エラーなし |

## テスト実行手順

```bash
# 1. 置換確認
grep -r "docs/product/" workflow-plugin/ | wc -l  # 期待: 0
grep -r "docs/spec/" workflow-plugin/ | wc -l     # 期待: 182+

# 2. ビルド
cd workflow-plugin/mcp-server && npm run build

# 3. テスト
cd workflow-plugin/mcp-server && npm test
```

## 受け入れ基準

- [ ] TC-001: docs/product/が0件
- [ ] TC-004: ビルド成功
- [ ] TC-006: テスト全パス
