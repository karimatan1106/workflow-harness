phase: test_selection
taskName: article-insights-harness-improvements
intent: 5改善項目(P3-P7)のテスト実行対象選定

baseline-total: 795
baseline-passed: 767
baseline-failed: 28
baseline-failed-files[5]{file,count,relation}:
  ace-reflector.test.ts, 7, unrelated
  ace-reflector-curator.test.ts, 5, unrelated
  metrics.test.ts, 8, unrelated
  reflector-failure-loop.test.ts, 5, unrelated
  reflector-quality.test.ts, 3, unrelated
baseline-note: 全28件は既存の既知失敗。本タスクの変更対象と無関係(ACE reflector/metrics系)

new-test-files[2]{file,purpose,tc-count,target}:
  gates/dod-code-fence.test.ts, P4コードフェンス検出テスト, 5, "TC-AC6-01〜TC-AC10-01"
  tools/pivot-advisor.test.ts, P5方向転換提案テスト, 5, "TC-AC11-01〜TC-AC15-01"

existing-test-files[4]{file,change-type,tc-count,target}:
  gates/dod-extended.test.ts, テスト追加, 8, "TC-AC1-01〜TC-AC5-01 + TC-AC21-01〜TC-AC23-01"
  gates/dod-l4-requirements.test.ts, アサーション更新, 5, "TC-AC16-01〜TC-AC20-01"
  tools/handlers/handler-misc-ia2.test.ts, アサーション更新, 0, "P6閾値変更に伴うメッセージ更新"
  tools/handlers/handler-parallel.test.ts, アサーション更新, 0, "P6閾値変更に伴うharness_add_ac呼び出し回数更新"

additional-assertion-updates[1]{file,change}:
  tools/handlers/handler-approval.test.ts, "P6閾値変更に伴うharness_add_ac呼び出し回数3→5更新"

execution-order[5]{step,tests,trigger,command}:
  Step-1, P6テスト(TC-AC16-01〜TC-AC20-01), W1完了後, "npx vitest --run gates/dod-l4-requirements.test.ts"
  Step-2, P6関連ハンドラテスト, W2完了後, "npx vitest --run tools/handlers/handler-misc-ia2.test.ts tools/handlers/handler-parallel.test.ts tools/handlers/handler-approval.test.ts"
  Step-3, P3+P7テスト(TC-AC1-01〜TC-AC5-01 + TC-AC21-01〜TC-AC23-01), W3完了後, "npx vitest --run gates/dod-extended.test.ts"
  Step-4, P4テスト(TC-AC6-01〜TC-AC10-01), W4完了後, "npx vitest --run gates/dod-code-fence.test.ts"
  Step-5, P5テスト(TC-AC11-01〜TC-AC15-01), W5完了後, "npx vitest --run tools/pivot-advisor.test.ts"

regression-command: npx vitest --run
regression-criteria: "total=795以上, passed=767以上, 新規失敗ゼロ(既存28件の既知失敗は許容)"

tc-file-mapping[23]{tc-id,ac-id,rtm,file}:
  TC-AC1-01, AC-1, F-001, gates/dod-extended.test.ts
  TC-AC2-01, AC-2, F-002, gates/dod-extended.test.ts
  TC-AC3-01, AC-3, F-003, gates/dod-extended.test.ts
  TC-AC4-01, AC-4, F-001, gates/dod-extended.test.ts
  TC-AC5-01, AC-5, "F-001, F-002", gates/dod-extended.test.ts
  TC-AC6-01, "AC-6, AC-8", "F-004, F-005", gates/dod-code-fence.test.ts
  TC-AC7-01, AC-8, F-005, gates/dod-code-fence.test.ts
  TC-AC8-01, AC-9, F-005, gates/dod-code-fence.test.ts
  TC-AC9-01, AC-8, F-005, gates/dod-code-fence.test.ts
  TC-AC10-01, AC-10, F-005, gates/dod-code-fence.test.ts
  TC-AC11-01, "AC-11, AC-13", F-006, tools/pivot-advisor.test.ts
  TC-AC12-01, AC-12, F-006, tools/pivot-advisor.test.ts
  TC-AC13-01, AC-12, F-006, tools/pivot-advisor.test.ts
  TC-AC14-01, "AC-13, AC-14", "F-006, F-007", tools/pivot-advisor.test.ts
  TC-AC15-01, AC-15, F-006, tools/pivot-advisor.test.ts
  TC-AC16-01, AC-16, F-008, gates/dod-l4-requirements.test.ts
  TC-AC17-01, "AC-17, AC-18", F-008, gates/dod-l4-requirements.test.ts
  TC-AC18-01, AC-18, F-008, gates/dod-l4-requirements.test.ts
  TC-AC19-01, AC-20, F-008, gates/dod-l4-requirements.test.ts
  TC-AC20-01, AC-19, F-008, gates/dod-l4-requirements.test.ts
  TC-AC21-01, AC-21, F-009, gates/dod-extended.test.ts
  TC-AC22-01, AC-22, F-009, gates/dod-extended.test.ts
  TC-AC23-01, AC-23, F-009, gates/dod-extended.test.ts

coverage-by-priority[5]{priority,ac-range,tc-count,coverage}:
  P3(AI slop), AC-1〜AC-5, 5, 100%
  P4(コードフェンス), AC-6〜AC-10, 5, 100%
  P5(方向転換), AC-11〜AC-15, 5, 100%
  P6(AC数変更), AC-16〜AC-20, 5, 100%
  P7(重複行除外), AC-21〜AC-23, 3, 100%

decisions[6]{id,statement,rationale}:
  TS-1, "新規テストファイル2件(dod-code-fence.test.ts + pivot-advisor.test.ts)を作成", "P4/P5は既存テストファイルに該当する構造がないため新規作成が適切"
  TS-2, "既存dod-extended.test.tsにP3+P7テスト8件を追加", "同一ファイル(dod-helpers.ts)の関数テストを集約"
  TS-3, "dod-l4-requirements.test.tsの境界値を3→5に更新", "MIN_ACCEPTANCE_CRITERIA定数変更に伴うアサーション整合"
  TS-4, "handler系3ファイルのharness_add_ac呼び出し回数を3→5に更新", "P6閾値変更の波及範囲を全てカバー"
  TS-5, "回帰テストはvitest --run全実行で既存767パス維持を確認", "変更が既存機能を破壊していないことの検証"
  TS-6, "既存28件の失敗はACE reflector/metrics系で本タスクと無関係のため許容", "ベースラインと同一の失敗セットであること を確認"

artifacts[1]{path,role,summary}:
  docs/workflows/article-insights-harness-improvements/test-selection.md, test, "テスト実行対象選定(23TC, 新規2ファイル, 既存4ファイル更新, 回帰テスト基準)"

next:
  criticalDecisions: "新規2テストファイル作成 + 既存4ファイル更新 + handler系3ファイルのアサーション修正"
  readFiles: "test-design.md, planning.md"
  warnings: "handler-approval.test.tsもP6影響範囲に含まれる(harness_add_ac呼び出し回数更新が必要)"

## decisions

- D-TS-1: 新規テストファイル2件(dod-code-fence.test.ts, pivot-advisor.test.ts)を作成する
- D-TS-2: 既存テストファイル2件(dod-extended.test.ts, dod-l4-requirements.test.ts)にテストケースを追加・更新する
- D-TS-3: P6のアサーション更新対象は3ハンドラテストファイル(handler-misc-ia2, handler-parallel, handler-approval)
- D-TS-4: 回帰テストはvitest --runで全テスト実行、ベースライン767パス維持を確認する
- D-TS-5: 既知の28失敗(ace-reflector系, metrics, reflector系)は本タスク対象外として除外する

## artifacts

- test-selection.md: テスト実行対象の選定結果

## next

- baseline_capture: ベースラインテスト結果を記録済み(795総テスト、767パス、28既知失敗)
- next_phase: tdd_red(テスト先行で失敗確認)
- implementation_order: P6 → P3+P7 → P4 → P5
