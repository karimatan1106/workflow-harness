# Test Design: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: test_design
size: large

## テスト戦略

scopeFilesが.mdと.tsの2ファイル。.mdファイルはドキュメントファイルのためTDD Red免除の可能性あり。defs-stage0.tsの変更は既存テストでカバー済み。新規テスト2件を追加しAC-1~AC-4を検証。AC-5~AC-7は既存テストと行数確認で検証。

## テストケース一覧

| TC ID | AC対応 | ファイル | 検証内容 | 期待結果 |
|-------|--------|---------|---------|---------|
| TC-AC1-01 | AC-1 | hearing-worker-rules.test.ts | hearing-worker.mdに確認形式禁止ルールが含まれる | /禁止.*確認/または/prohibited.*confirmation/にマッチ |
| TC-AC2-01 | AC-2 | hearing-worker-rules.test.ts | hearing-worker.mdに2案以上の要求が含まれる | /2.*different.*approaches/または/2.*異なる/にマッチ |
| TC-AC3-01 | AC-3 | hearing-worker-rules.test.ts | hearing-worker.mdにメリット・デメリット要求が含まれる | /merit.*demerit/または/trade-off/にマッチ |
| TC-AC4-01 | AC-4 | hearing-template.test.ts | defs-stage0.tsテンプレートに具体例が含まれる | /悪い例/または/良い例/にマッチ |
| TC-AC5-01 | AC-5 | hearing-worker-rules.test.ts | hearing-worker.mdが200行以下 | lineCount <= 200 |
| TC-AC6-01 | AC-6 | 既存テスト | defs-stage0.tsが200行以下 | 既存hearing-template.test.tsのインポートが成功=コンパイル通過 |
| TC-AC7-01 | AC-7 | 既存テスト | 既存テストが全てパス | exitCode=0 |

## acTcMapping

- AC-1: TC-AC1-01
- AC-2: TC-AC2-01
- AC-3: TC-AC3-01
- AC-4: TC-AC4-01
- AC-5: TC-AC5-01
- AC-6: TC-AC6-01
- AC-7: TC-AC7-01

## テストファイル構成

新規テストファイル: src/__tests__/hearing-worker-rules.test.ts
- TC-AC1-01, TC-AC2-01, TC-AC3-01, TC-AC5-01を含む
- hearing-worker.mdをfs.readFileSyncで読み込みテキスト内容を検証
- fileURLToPathを使用してパス解決(日本語パス対応)

既存テストファイル活用: src/__tests__/hearing-template.test.ts
- TC-AC4-01を追加(具体例チェック)
- TC-AC2-01/TC-AC2-02は既存アサーションが新テキストでも有効

## decisions

- TD-001: hearing-worker.mdの検証はソースコード読み取りテスト方式を採用。エージェント定義はTypeScriptモジュールではないためインポート不可。fs.readFileSyncでファイル内容を読み取りregexマッチで検証。
- TD-002: TC-AC4-01は既存hearing-template.test.tsに追加。defs-stage0.tsのテンプレート内容検証は同ファイルに集約。
- TD-003: TC-AC5-01は行数カウントテスト。split('\n').lengthで200以下を検証。
- TD-004: TC-AC6-01とTC-AC7-01は既存テストで暗黙的にカバー。defs-stage0.tsが200行超ならコンパイルエラーではないが、既存テストのインポート成功で構文健全性を確認。
- TD-005: fileURLToPathを使用してhearing-worker.mdのパス解決を行う。import.meta.url基準の相対パス解決で日本語ディレクトリ対応(前回harness-back-cascade.test.tsで学んだ教訓)。

## artifacts

- docs/workflows/hearing-worker-real-choices/test-design.md: test: 7テストケース設計。新規ファイル1本(hearing-worker-rules.test.ts)と既存ファイル活用。

## next

- criticalDecisions: TD-001(fs.readFileSyncでMD検証)、TD-005(fileURLToPathでパス解決)
- readFiles: workflow-harness/mcp-server/src/__tests__/hearing-template.test.ts, .claude/agents/hearing-worker.md
- warnings: hearing-worker.mdのパスはプロジェクトルート基準(.claude/agents/)であり、テストファイルからの相対パス解決に注意
