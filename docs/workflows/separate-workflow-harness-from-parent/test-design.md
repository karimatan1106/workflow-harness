# test-design: separate-workflow-harness-from-parent

## overview
AC-1..AC-7 をカバーするテストケース定義。全 TC は bash 一行の assert で検証可能。testing フェーズで harness_record_test_result により記録する。TDD Red→Green 原則に従い、移管実装前に Red 確認、実装後に Green 確認を行う。

## acTcMapping
| AC | TC ID | 概要 |
|----|-------|------|
| AC-1 | TC-AC1-01 | ADR ファイル件数が親と一致 |
| AC-2 | TC-AC2-01 | workflow-phases 27 ファイル存在 |
| AC-3 | TC-AC3-01 | 親固有 hooks 11 ファイル存在 |
| AC-3 | TC-AC3-02 | hooks の permission 755 維持 |
| AC-4 | TC-AC4-01 | commands 3 ファイル存在 |
| AC-5 | TC-AC5-01 | code-search-policy.md 存在 |
| AC-5 | TC-AC5-02 | rtk-scope.md 存在 |
| AC-6 | TC-AC6-01 | .mcp.json の cwd が "." |
| AC-7 | TC-AC7-01 | submodule に移管コミット存在 |
| AC-7 | TC-AC7-02 | origin/main に push 済 |

## testCases

### TC-AC1-01: ADR 件数整合
- 目的: 親リポジトリの ADR 全件がサブモジュールに移管されていることを確認
- 検証: `[ "$(ls workflow-harness/docs/adr/ADR-*.md 2>/dev/null | wc -l)" -ge "$(ls docs/adr/ADR-*.md 2>/dev/null | wc -l)" ]`
- 期待: exit 0 (ADR 件数 サブモジュール ≥ 親)

### TC-AC2-01: workflow-phases ファイル数
- 目的: 30 フェーズ定義の 27 ファイルがサブモジュール側に存在
- 検証: `[ "$(ls workflow-harness/.claude/workflow-phases/*.md | wc -l)" -eq 27 ]`
- 期待: exit 0 (workflow-phases 27 件一致)

### TC-AC3-01: 親固有 hooks 存在確認
- 目的: check_ocr.py を除く 11 個の hook ファイルがサブモジュール側に存在
- 検証: 各ファイルを順次 test -f で確認
- 対象: context-watchdog.sh, handoff-reader.sh, handoff-validator.sh, harness-enforce.sh, post-commit-auto-push.sh, post-tool-lint.sh, pre-compact-context-save.sh, pre-tool-config-guard.sh, pre-tool-gate.sh, pre-tool-no-verify-block.sh, test-guard.sh
- 期待: 全 11 hooks で exit 0

### TC-AC3-02: hooks 実行 permission
- 目的: 実行可能ビット (755) が保持されていること
- 検証: `stat -c '%a' workflow-harness/.claude/hooks/<file>` が 755 または 750 相当
- 期待: 全 hooks permission PASS

### TC-AC4-01: commands 3 ファイル
- 目的: handoff.md, harness-report.md, recall.md の 3 スラッシュコマンドがサブモジュール側に存在
- 検証: 各ファイルを test -f で確認
- 期待: commands 3 ファイル全てで exit 0

### TC-AC5-01: code-search-policy.md 存在
- 検証: `test -f workflow-harness/.claude/rules/code-search-policy.md`
- 期待: exit 0 (code-search-policy.md 存在)

### TC-AC5-02: rtk-scope.md 存在
- 検証: `test -f workflow-harness/.claude/rules/rtk-scope.md`
- 期待: exit 0 (rtk-scope.md 存在)

### TC-AC6-01: .mcp.json cwd 書き換え
- 目的: cwd がサブモジュール基準の "." に更新されていること
- 検証: `jq -r '.mcpServers[] | .cwd' workflow-harness/.mcp.json` の全出力が "."
- 期待: exit 0 かつ全エントリ "."

### TC-AC7-01: 移管コミット存在
- 検証: `git -C workflow-harness log --oneline -1` で最新コミットが表示される
- 期待: 非空出力

### TC-AC7-02: origin/main 同期確認
- 検証: `git -C workflow-harness ls-remote origin refs/heads/main` の SHA が `git -C workflow-harness rev-parse HEAD` と一致
- 期待: 両 SHA 一致

## decisions
- D-TD-1: 全 AC (AC-1..AC-7) を TC でカバーし AC:TC マッピングは 1:1 以上
- D-TD-2: テストは bash スクリプト形式とする。node/vitest テストは本タスクの planning 範囲外
- D-TD-3: TDD Red→Green 方針を適用し、実装前に Red (ファイル不在で失敗)、実装後に Green を確認
- D-TD-4: テスト結果は harness_record_test_result で exitCode 付きで記録する
- D-TD-5: 単純 assert 的な bash 一行確認が中心。複雑な mock や fixture は不要
- D-TD-6: TC ID は TC-ACN-NN フォーマットを厳守 (例 TC-AC3-02)
- D-TD-7: TC 実行は testing フェーズで行い、implementation フェーズでは実行しない

## artifacts
- test-design.md (本ファイル)
- acTcMapping テーブル (10 TC, 7 AC カバー)
- testCases 詳細 (10 件)

## next
- implementation フェーズで移管スクリプト実行 (cp / git mv / sed による .mcp.json 書き換え)
- testing フェーズで本 TC を順次実行し harness_record_test_result で記録
- Red 証拠は実装前の ls / test -f 失敗出力を保存
- Green 証拠は実装後の全 TC exit 0 出力を保存
