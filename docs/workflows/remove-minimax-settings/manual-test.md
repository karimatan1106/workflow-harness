# manual_test

phase: manual_test
task: remove-minimax-settings
status: complete

## summary

自動テスト (test-minimax-removal.js) が TC-AC1-01..TC-AC5-01 の 5 ケース全て Green で終了した事を前提に、
削除対象 4 ファイルの before/after 状態を目視相当 (bash ベースのファイル存在・行数・pattern 有無) で記録する。
本タスクはドキュメント削除のみのため、UI 動作確認および実行時挙動確認は対象外 (N/A) とする。
目視確認の主眼は「MiniMax / m2.7 / ミニマックス キーワードが 4 ファイル全てから消えている事」の
ファイル単位再確認であり、5 つの AC の人手目線での裏取りを残す事を目的とする。

## environment

- os: Windows 11 Home 10.0.26200
- shell: bash (MSYS) 経由
- check-date: 2026-04-11
- branch: feature/v2-workflow-overhaul

## manualCheckItems

- M-1: CLAUDE.md から MiniMax 注意事項セクションが目視で見当たらない事
- M-2: feedback_no-minimax.md が ls で存在しない事
- M-3: MEMORY.md 索引表に feedback_no-minimax.md 行が無い事
- M-4: canboluk.md ベンチマーク表に MiniMax 行が無い事
- M-5: 対象 4 ファイル合計に対し `(?i)minimax|m2\.7|ミニマックス` の grep 結果が 0 件

## beforeAfter

### T-1 CLAUDE.md

- path: C:\ツール\Workflow\CLAUDE.md
- before: MiniMax 注意事項セクション (## workflow-harness/.claude/settings.json 注意事項) が存在し本文複数行を保持
- after: セクションごと削除、wc -l 結果は 30 行
- pattern-hit (CLAUDE.md) for /minimax|m2.7|ミニマックス/i: 0 件 (grep -iEc 実測)
- visual-check: M-1 OK、他セクション (rtk scope, session 開始手順) は保持を確認

### T-2 feedback_no-minimax.md

- path: C:\Users\owner\.claude\projects\C------Workflow\memory\feedback\feedback_no-minimax.md
- before: ファイルが存在し feedback 運用ルール文書として記載
- after: ls で No such file or directory を確認、ファイルシステム上に不在
- pattern-hit (feedback_no-minimax.md) for /minimax|m2.7|ミニマックス/i: ファイル不在のため 0
- visual-check: M-2 OK

### T-3 MEMORY.md

- path: C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md
- before: 索引表中に feedback_no-minimax.md への行が存在
- after: 該当 1 行のみ削除、wc -l 結果は 101 行、表ヘッダと周辺行は保持
- pattern-hit (MEMORY.md) for /minimax|m2.7|ミニマックス/i: 0 件 (grep -iEc 実測)
- visual-check: M-3 OK、索引表フォーマット (列構成) 崩れ無し

### T-4 canboluk.md

- path: C:\Users\owner\.claude\projects\C------Workflow\memory\patterns\canboluk.md
- before: ベンチマーク表内に MiniMax 行が存在
- after: 該当 1 行のみ削除、wc -l 結果は 181 行、他ベンチマーク行と表ヘッダは保持
- pattern-hit (canboluk.md) for /minimax|m2.7|ミニマックス/i: 0 件 (grep -iEc 実測)
- visual-check: M-4 OK

## patternScan

- command: grep -iEc "minimax|m2\.7|ミニマックス" <3 files>
- targets: CLAUDE.md, MEMORY.md, canboluk.md (feedback_no-minimax.md は不在のため除外)
- result: 全ファイル 0 件
- M-5 verdict: OK (AC-5 の人手裏取り成立)

## uiBehaviorCheck

- status: N/A
- reason: 本タスクは live 参照ドキュメントの削除のみで、UI/CLI/ランタイム挙動に影響する
  コードおよび設定ファイルは触っていない。scope-definition.md の outOfScope に明記された
  workflow-harness/.claude/settings.json も未変更。よって UI 動作確認は不要。

## automatedTestReference

- script: C:/ツール/Workflow/docs/workflows/remove-minimax-settings/test-minimax-removal.js
- exit-code: 0 (testing.md / regression_test.md で確認済)
- results:
  - TC-AC1-01 (AC-1): PASS
  - TC-AC2-01 (AC-2): PASS
  - TC-AC3-01 (AC-3): PASS
  - TC-AC4-01 (AC-4): PASS
  - TC-AC5-01 (AC-5): PASS
- total: 5 pass / 0 fail

## decisions

- D-MT-1: UI 動作確認は N/A とする。ドキュメント削除のみでランタイム影響無しのため。
- D-MT-2: before 状態は git 履歴および scope-definition.md 由来の事前情報を根拠とし、after 状態は
  bash (ls / wc -l / grep -iEc) の実測結果を正として記録する。
- D-MT-3: feedback_no-minimax.md の pattern-hit は N/A とする。ファイル不在のため grep 対象に
  含めず、AC-2 は ls の失敗 (No such file or directory) で決定的に判定する。
- D-MT-4: 自動テスト 5 TC Green を手動確認の前提とし、人手確認は AC ごとの再裏取りに限定する。
- D-MT-5: 本 manual-test.md は人手確認の証跡として保持し、以降 acceptance フェーズの根拠として参照する。

## verdict

- overall: PASS
- rationale: M-1..M-5 全項目 OK、AC-1..AC-5 の自動テスト Green と整合、UI 影響無し。
- blocker: 無し

## artifacts

- path: docs/workflows/remove-minimax-settings/manual-test.md
  role: report
  summary: 手動目視相当確認の結果記録、M-1..M-5 全 OK、UI N/A、自動テスト 5/5 Green を参照
- path: docs/workflows/remove-minimax-settings/testing.md
  role: input-testing
  summary: testing フェーズの Green 結果参照元
- path: docs/workflows/remove-minimax-settings/regression_test.md
  role: input-regression
  summary: regression 再実行の Green 結果参照元
- path: docs/workflows/remove-minimax-settings/scope-definition.md
  role: input-scope
  summary: 削除対象 4 ファイルと AC-1..AC-5 の出所

## next

- next: acceptance
- input: docs/workflows/remove-minimax-settings/manual-test.md
- criticalDecisions: 手動確認 5 項目全 PASS、UI 確認 N/A、自動テスト Green と整合
- warnings: 無し
