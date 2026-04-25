# Test Design: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9
phase: test_design
target: .claude/skills/workflow-harness/workflow-phases.md

## summary

workflow-phases.md への hearing フェーズセクション追加を検証するテストケース設計。AC-1 から AC-5 の各受入基準に対し、grep/wc による文字列検索と構造比較で合否を判定する。

## acTcMapping

| AC | TC | 検証内容 |
|----|------|----------|
| AC-1 | TC-AC1-01 | hearing セクション見出しの存在確認 |
| AC-2 | TC-AC2-01 | hearing-worker 文字列の存在確認 |
| AC-3 | TC-AC3-01 | AskUserQuestion 文字列の存在確認 |
| AC-4 | TC-AC4-01 | ファイル総行数の上限確認 |
| AC-5 | TC-AC5-01 | 他フェーズとの構造一貫性確認 |

## testCases

### TC-AC1-01: hearing セクション見出しが存在する

対象AC: AC-1
検証レベル: L1
コマンド: grep -c "hearing" workflow-phases.md
期待値: hearing セクション見出しが1件以上存在する(出力値 >= 1)
判定: 出力が1以上なら PASS、0なら FAIL

### TC-AC2-01: hearing-worker エージェント型が記載されている

対象AC: AC-2
検証レベル: L4 (hearing-worker文字列のgrep検索)
コマンド: grep -c "hearing-worker" workflow-phases.md
期待値: hearing-worker 文字列が1件存在する(出力値 = 1)
判定: 出力が1なら PASS、0または2以上なら FAIL

### TC-AC3-01: AskUserQuestion ツール使用が記載されている

対象AC: AC-3
検証レベル: L4 (AskUserQuestion文字列のgrep検索)
コマンド: grep -c "AskUserQuestion" workflow-phases.md
期待値: AskUserQuestion 文字列が1件存在する(出力値 = 1)
判定: 出力が1なら PASS、0または2以上なら FAIL

### TC-AC4-01: ファイル総行数が200行以下である

対象AC: AC-4
検証レベル: L1
コマンド: wc -l workflow-phases.md
期待値: 行数が200以下である(出力値 <= 200)
判定: 出力が200以下なら PASS、201以上なら FAIL

### TC-AC5-01: hearing セクションが他フェーズと同一構造である

対象AC: AC-5
検証レベル: L4 (セクション構造の目視比較)
コマンド: grep "^### Stage" workflow-phases.md で全 Stage 行を抽出し、hearing 行が同一パターンに従うか確認
期待値: hearing セクションが他フェーズと同一の見出しレベル(###)とリスト形式(Stage N: phase_name)で記述されている
判定手順:
1. 全 Stage 見出し行を抽出する
2. hearing 行が `### Stage 0: hearing` の形式であることを確認する
3. セクション内に Output と DoD の記述が含まれることを確認する
4. 上記すべて満たせば PASS、いずれか欠落なら FAIL

## decisions

- D-001: テストケースは grep と wc のみで構成する。外部ツール依存を排除し L1/L4 の決定的検証のみとするため。
- D-002: TC-AC2-01 と TC-AC3-01 は出力値が正確に1であることを要求する。重複記載は意図しない変更を示すため。
- D-003: TC-AC5-01 は複合検証(見出しパターン + 内部構造)とする。単一コマンドでは構造一貫性を十分に検証できないため。
- D-004: TC-AC1-01 は "hearing" の部分一致で検索する。Stage 見出し以外にも hearing への言及がある場合を許容するため。
- D-005: 全テストケースの対象ファイルは workflow-phases.md のみとする。requirements.md の D-006 で変更対象が1ファイルに限定されているため。

## artifacts

- docs/workflows/hearing-askuserquestion-rule/test-design.md (本ファイル)

## next

phase: test_impl
action: TC-AC1-01 から TC-AC5-01 の各テストケースを実行可能なスクリプトとして実装し、TDD Red(全テスト失敗)を確認する
