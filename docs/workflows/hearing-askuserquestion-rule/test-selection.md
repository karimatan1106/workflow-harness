# Test Selection: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9
phase: test_selection
target: .claude/skills/workflow-harness/workflow-phases.md

## summary

TC-AC1-01 から TC-AC5-01 の全5テストケースを選択する。対象ファイルは workflow-phases.md 1ファイルのみであり、全テストケースが grep/wc による手動検証で完結するため、除外すべきケースはない。

## selectedTests

| TC | 対象AC | 選択理由 |
|----|--------|----------|
| TC-AC1-01 | AC-1 | hearing セクション見出しの存在は変更の最も基本的な検証項目であり必須 |
| TC-AC2-01 | AC-2 | hearing-worker エージェント型の明記は AC-2 の直接検証であり必須 |
| TC-AC3-01 | AC-3 | AskUserQuestion ツール使用の明記は AC-3 の直接検証であり必須 |
| TC-AC4-01 | AC-4 | 200行上限は core-constraints.md の強制ルールであり検証必須 |
| TC-AC5-01 | AC-5 | 構造一貫性はタスクの根本目的であり検証必須 |

## excludedTests

なし。全5テストケースが grep/wc のみで実行可能であり、除外する理由がない。

## executionMethod

手動検証(grep/wc コマンド)。自動テストフレームワークは不要。workflow-phases.md はスキルファイルであり、単体テストの対象外である。

## acCoverage

| AC | 選択TC数 | カバレッジ |
|----|----------|-----------|
| AC-1 | 1 | TC-AC1-01 で完全カバー |
| AC-2 | 1 | TC-AC2-01 で完全カバー |
| AC-3 | 1 | TC-AC3-01 で完全カバー |
| AC-4 | 1 | TC-AC4-01 で完全カバー |
| AC-5 | 1 | TC-AC5-01 で完全カバー |

## decisions

- D-001: 全5テストケースを選択する。対象が1ファイルかつ grep/wc のみで完結するため、選択的除外の必要がない。
- D-002: 実行順序は TC-AC1-01 から TC-AC5-01 の番号順とする。AC-1 の見出し存在確認が他の検証の前提条件となるため。
- D-003: 自動テストフレームワークは使用しない。対象がスキルファイル(.md)であり vitest 等の対象外であるため。
- D-004: TDD Red フェーズでは全5テストが FAIL となることを確認する。実装前の状態で hearing セクションが存在しないことが前提であるため。
- D-005: TC-AC5-01 の構造比較は grep による Stage 見出しパターン抽出で実施する。目視比較ではなく再現可能なコマンドで判定するため。

## artifacts

- docs/workflows/hearing-askuserquestion-rule/test-selection.md (本ファイル)

## next

phase: test_impl
action: 選択した5テストケースを実行可能なシェルコマンド列として実装し、TDD Red(全テスト FAIL)を確認する
