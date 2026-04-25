# テスト設計書 - ワークフロー構造的問題完全解決

## サマリー

6つのREQに対する31テストケースの設計。全てVitest + TypeScriptで実装。
テストカバレッジ目標: 行カバレッジ90%以上。

## テストケース一覧

### REQ-1: HMAC署名検証の厳格化 (5テスト)
- TC-1-1: HMAC_STRICT未設定で署名なし → null
- TC-1-2: HMAC_STRICT未設定で署名不一致 → null
- TC-1-3: HMAC_STRICT=falseで署名なし → 正常読み込み
- TC-1-4: 正常な署名 → 正常読み込み
- TC-1-5: 検証エラー → null

### REQ-2: 複数承認ゲート (6テスト)
- TC-2-1: requirementsで未承認→next → ブロック
- TC-2-2: test_designで未承認→next → ブロック
- TC-2-3: code_reviewで未承認→next → ブロック
- TC-2-4: workflow_approve('requirements') → parallel_analysisへ
- TC-2-5: workflow_approve('test_design') → test_implへ
- TC-2-6: workflow_approve('code_review') → testingへ

### REQ-3: 成果物品質検証強化 (7テスト)
- TC-3-1: セクション本文0文字 → 失敗
- TC-3-2: セクション本文50文字以上 → 成功
- TC-3-3: ヘッダーのみmd → 比率失敗
- TC-3-4: 本文60%以上 → 比率成功
- TC-3-5: 状態2個のmmd → 構文失敗
- TC-3-6: 状態3個以上のmmd → 構文成功
- TC-3-7: "T O D O"含む文書 → 禁止パターン検出

### REQ-4: テスト回帰チェック (5テスト)
- TC-4-1: testBaseline未設定→next → ブロック
- TC-4-2: テスト総数減少 → ブロック
- TC-4-3: パス数減少 → ブロック
- TC-4-4: テスト数増加・パス数維持 → 成功
- TC-4-5: testing→regression_test遷移でbaseline自動設定

### REQ-5: スコープ事後検証 (5テスト)
- TC-5-1: スコープ内ファイルのみ → 成功
- TC-5-2: スコープ外(警告モード) → 警告+続行
- TC-5-3: スコープ外(SCOPE_STRICT=true) → ブロック
- TC-5-4: 除外パターン(.md等) → 除外される
- TC-5-5: gitリポジトリなし → スキップ

### REQ-6: セッショントークン (6テスト)
- TC-6-1: workflow_start → sessionToken返却
- TC-6-2: sessionToken未指定→next → エラー
- TC-6-3: sessionToken不一致→next → エラー
- TC-6-4: sessionToken一致→next → 成功
- TC-6-5: SESSION_TOKEN_REQUIRED=false → トークンなしで成功
- TC-6-6: 既存タスク(tokenなし)→next → 警告のみで続行

## テスト計画

テストファイル配置:
- mcp-server/src/state/__tests__/hmac-strict.test.ts (REQ-1)
- mcp-server/src/tools/__tests__/approval-gates.test.ts (REQ-2)
- mcp-server/src/validation/__tests__/artifact-quality.test.ts (REQ-3)
- mcp-server/src/tools/__tests__/test-regression.test.ts (REQ-4)
- mcp-server/src/validation/__tests__/scope-post-validation.test.ts (REQ-5)
- mcp-server/src/tools/__tests__/session-token.test.ts (REQ-6)
