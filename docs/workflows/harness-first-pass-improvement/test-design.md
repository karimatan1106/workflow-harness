# Test Design: harness-first-pass-improvement

taskId: ce320677-d107-4cc9-ad90-978291c61666
phase: test_design

## Test Strategy

手動検証（ファイル内容確認）+ 自動テスト（既存vitestスイート）の2軸で検証する。
対象ファイル3つは全てテキスト追加のみの変更であり、ロジック変更を含まないため、内容の存在確認が主な検証手段となる。

## Test Cases

### TC-AC1-01: Phase Output Rulesセクション存在確認
- AC-1 (Phase Output Rules見出し) / F-001
- 検証方法: coordinator.md内に "## Phase Output Rules" 見出しが存在すること
- 検証コマンド: grep -c "## Phase Output Rules" .claude/agents/coordinator.md
- 期待値: 出力が1であること

### TC-AC1-02: decisions定量ルール明記確認
- AC-1 (decisions定量ルール) / F-001
- 検証方法: coordinator.md内に "decisions: 5件以上" を含む行が存在すること
- 検証コマンド: grep -c "decisions.*5件以上" .claude/agents/coordinator.md
- 期待値: 出力が1以上であること

### TC-AC1-03: artifacts列挙ルール明記確認
- AC-1 (artifacts列挙ルール) / F-001
- 検証方法: coordinator.md内に "artifacts:" で始まるルール行が存在すること
- 検証コマンド: grep -c "artifacts:.*列挙" .claude/agents/coordinator.md
- 期待値: マッチ数が1以上であること

### TC-AC1-04: nextセクション空欄禁止ルール確認
- AC-1 (next空欄禁止ルール) / F-001
- 検証方法: coordinator.md内に "next:" で始まり "空欄禁止" を含む行が存在すること
- 検証コマンド: grep -c "next:.*空欄禁止" .claude/agents/coordinator.md
- 期待値: マッチ行が正確に1行あること

### TC-AC2-01: Edit Completenessセクション存在確認
- AC-2 (Edit Completenessセクション) / F-002
- 検証方法: worker.md内に "## Edit Completeness" 見出しが存在すること
- 検証コマンド: grep -c "## Edit Completeness" .claude/agents/worker.md
- 期待値: 見出しが1箇所存在すること

### TC-AC2-02: 部分適用禁止ルール明記確認
- AC-2 (部分適用禁止ルール) / F-002
- 検証方法: worker.md内に "部分適用" と "禁止" を含む行が存在すること
- 検証コマンド: grep -c "部分適用.*禁止" .claude/agents/worker.md
- 期待値: 該当ルール行が1行以上存在すること

### TC-AC2-03: all-or-nothing原則確認
- AC-2 (全件適用原則) / F-002
- 検証方法: worker.md内にEdit操作の全件適用ルールが明記されていること
- 検証コマンド: grep -c "全件適用" .claude/agents/worker.md
- 期待値: 全件適用に関する記述が1箇所以上あること

### TC-AC3-01: implementation baseline手順確認
- 対応AC: AC-3, F-003
- 検証方法: defs-stage4.ts内のimplementationテンプレートにharness_capture_baselineの呼び出し指示が存在すること
- 検証コマンド: grep -c "harness_capture_baseline" workflow-harness/mcp-server/src/phases/defs-stage4.ts
- 期待値: baseline呼び出し指示が1箇所以上含まれること

### TC-AC3-02: code_review RTM更新手順確認
- 対応AC: AC-3, F-003
- 検証方法: defs-stage4.ts内のcode_reviewテンプレートにharness_update_rtm_statusの呼び出し指示が存在すること
- 検証コマンド: grep -c "harness_update_rtm_status" workflow-harness/mcp-server/src/phases/defs-stage4.ts
- 期待値: RTM更新指示が1箇所以上含まれること

### TC-AC4-01: coordinator.md 200行以下確認
- AC-4 (coordinator.md行数) / F-004
- 検証方法: coordinator.mdの行数が200以下であること
- 検証コマンド: wc -l < .claude/agents/coordinator.md
- 期待値: 行数が200以下であること

### TC-AC4-02: worker.md 200行以下確認
- AC-4 (worker.md行数) / F-004
- 検証方法: worker.mdの行数が200以下であること
- 検証コマンド: wc -l < .claude/agents/worker.md
- 期待値: worker.mdの総行数が200を超えないこと

### TC-AC4-03: defs-stage4.ts 200行以下確認
- AC-4 (defs-stage4.ts行数) / F-004
- 検証方法: defs-stage4.tsの行数が200以下であること
- 検証コマンド: wc -l < workflow-harness/mcp-server/src/phases/defs-stage4.ts
- 期待値: defs-stage4.tsの総行数が200を超えないこと

### TC-AC5-01: 既存テストスイート全パス確認
- 対応AC: AC-5
- 検証方法: vitest実行で全テストがパスすること
- 検証コマンド: cd workflow-harness && npx vitest run
- 期待値: 全テストがPASSしFAILが0件であること

## acTcMapping

| AC | Test Cases |
|----|-----------|
| AC-1 | TC-AC1-01, TC-AC1-02, TC-AC1-03, TC-AC1-04 |
| AC-2 | TC-AC2-01, TC-AC2-02, TC-AC2-03 |
| AC-3 | TC-AC3-01, TC-AC3-02 |
| AC-4 | TC-AC4-01, TC-AC4-02, TC-AC4-03 |
| AC-5 | TC-AC5-01 |

| RTM | Test Cases |
|-----|-----------|
| F-001 | TC-AC1-01, TC-AC1-02, TC-AC1-03, TC-AC1-04 |
| F-002 | TC-AC2-01, TC-AC2-02, TC-AC2-03 |
| F-003 | TC-AC3-01, TC-AC3-02 |
| F-004 | TC-AC4-01, TC-AC4-02, TC-AC4-03, TC-AC5-01 |

## decisions

- TD-001: ロジック変更がないため、grepベースの内容存在確認を主な検証手段とする
- TD-002: 定量ルール（decisions 5件以上）は文字列マッチで検証可能。数値パースは不要
- TD-003: 200行制限はwc -lで機械的に検証する
- TD-004: 既存テストスイートの実行はvitest runで一括実行する
- TD-005: AC-1に4ケース割当。Phase Output Rulesの各サブルール（decisions/artifacts/next）を個別検証する

## artifacts

- docs/workflows/harness-first-pass-improvement/test-design.md: spec: 13テストケース、AC-1〜AC-5全カバー、RTM F-001〜F-004全カバー

## next

- test_selectionフェーズでTC-AC1-01〜TC-AC5-01の実行優先度を決定
- TC-AC5-01（既存テスト全パス）は実行時間が長いため最後に実行する方針を推奨
