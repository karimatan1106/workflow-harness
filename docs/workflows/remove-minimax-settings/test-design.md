# test-design.md

## overview

このドキュメントは remove-minimax-settings タスクにおけるテスト設計を定める。対象はドキュメント/設定ファイルの削除のみであり、ロジック変更を伴わないため vitest などのコードテストは不要とする。検証は bash による grep および file existence チェックで完結する。

## testStrategy

- TDD Red: 削除前に全 TC を実行し、少なくとも 1 件の hit または file 存在を確認することで Red 状態の証拠とする。
- TDD Green: 削除適用後に全 TC を再実行し、全件 pass となることで Green 状態の証拠とする。
- regression: コード変更が存在しないため既存ユニット/E2E テストの再実行対象はなし。代わりに対象 4 ファイルへの grep パスを TC-AC5-01 として束ねる。
- evidence log: 各 TC の exitCode と 標準出力を test_execution フェーズで claude-progress.toon に追記する。

## testInfrastructure

- runner: bash (Git Bash on Windows)。vitest/jest は未使用。
- dependencies: grep, test コマンドのみ。追加インストール不要。
- portability: CI ランナー上でも同一スクリプトが動作することを想定。Windows パス区切りはフォワードスラッシュで統一する。

## testCases

### TC-AC1-01 (AC-1): CLAUDE.md セクション削除検証

対象ファイル `C:/ツール/Workflow/CLAUDE.md` から `## workflow-harness/.claude/settings.json 注意事項` セクションが消えていること、および同ファイル内に MiniMax 言及が残存していないことを確認する。

- primary command: `grep -c "## workflow-harness/.claude/settings.json 注意事項" C:/ツール/Workflow/CLAUDE.md`
- primary expected: match count が 0 件 (grep exit code 1)
- secondary command: `grep -c "MiniMax" C:/ツール/Workflow/CLAUDE.md`
- secondary expected: match count が 0 件

### TC-AC2-01 (AC-2): feedback_no-minimax.md 不在検証

ユーザー memory 配下のフィードバックファイルが物理的に存在しないことを確認する。単体 file existence チェックで判定する。

- command: `test -f "C:/Users/owner/.claude/projects/C------Workflow/memory/feedback/feedback_no-minimax.md" && echo exists || echo absent`
- expected output: `absent`
- rationale: ファイルが存在すると後続の MEMORY.md 索引整合が崩れるため物理削除を必須とする。

### TC-AC3-01 (AC-3): MEMORY.md 索引行削除検証

MEMORY.md 内の feedback 索引テーブルから該当行が除去されていることを確認する。grep で部分一致文字列をカウントする。

- command: `grep -c "feedback_no-minimax" "C:/Users/owner/.claude/projects/C------Workflow/memory/MEMORY.md"`
- expected: カウント結果 0 (grep exit code 1)
- note: TC-AC2-01 で物理削除済みであってもインデックス行が残ると LLM がリンク切れを踏むため独立 TC として検証する。

### TC-AC4-01 (AC-4): canboluk.md MiniMax 行削除検証

patterns 配下の調査ファイルに残存していた MiniMax 言及 1 行が削除されていることを確認する。

- command: `grep -c "MiniMax" "C:/Users/owner/.claude/projects/C------Workflow/memory/patterns/canboluk.md"`
- expected: match 検出数ゼロ
- rationale: canboluk.md は研究参照ノートであり、MiniMax は無関係なため単純削除で整合が取れる。

### TC-AC5-01 (AC-5): 4 ファイル統合 grep 検証

TC-AC1-01..TC-AC4-01 の対象 4 ファイルを単一スクリプトで横断 grep し、MiniMax 関連語彙の総出現数が 0 であることを確認する。case-insensitive で別名表記もカバーする。

- command:
  ```bash
  for f in \
    "C:/ツール/Workflow/CLAUDE.md" \
    "C:/Users/owner/.claude/projects/C------Workflow/memory/MEMORY.md" \
    "C:/Users/owner/.claude/projects/C------Workflow/memory/patterns/canboluk.md" \
    "C:/Users/owner/.claude/projects/C------Workflow/workflow-harness/.claude/settings.json"; do
    grep -i -c "minimax\|m2\.7\|ミニマックス" "$f"
  done | paste -sd+ | bc
  ```
- expected: 合算値 0
- rationale: 個別 TC に漏れがあった場合の最終セーフティネット。TC-AC1-01..TC-AC4-01 が全て pass なら TC-AC5-01 も自動的に pass する包含関係。

## acTcMapping

| AC | TC | 検証対象 |
|----|----|----------|
| AC-1 | TC-AC1-01 | CLAUDE.md セクション削除 |
| AC-2 | TC-AC2-01 | feedback_no-minimax.md 物理削除 |
| AC-3 | TC-AC3-01 | MEMORY.md 索引行削除 |
| AC-4 | TC-AC4-01 | canboluk.md MiniMax 行削除 |
| AC-5 | TC-AC5-01 | 4 ファイル統合 grep ゼロ |

## decisions

- D-TD-1: 全 TC を bash の grep と test コマンドで実装し、vitest/jest の導入を見送る。根拠はコード変更が存在せず、ドキュメント/設定の差分確認のみで DoD を満たせるため。
- D-TD-2: TC-AC1-01..TC-AC5-01 と AC-1..AC-5 を 1:1 で対応付け、F-NNN → AC → TC のトレーサビリティチェーンを planning.md / requirements.md と整合させる。
- D-TD-3: TDD Red の証拠は削除適用前に grep が 1 件以上 hit する状態（exit code 0）で記録し、Green の証拠は削除後に exit code 1 となった事実をログに残す形で二段階化する。
- D-TD-4: regression テストの対象は存在しないと明言する。コード変更がないため既存ユニット/E2E スイートの再実行を省略し、レビュー工数を TC 実行エビデンスに集約する。
- D-TD-5: TC-AC5-01 を TC-AC1-01..TC-AC4-01 の統合セーフティネットと位置付け、個別 TC が見落とした残存文字列を bc による合算で捕捉する設計とする。

## artifacts

- test-design.md (本ファイル)

## next

- next phase: test_implementation もしくは implementation
- input files: requirements.md, planning.md, test-design.md
- exit gate: test_design DoD の 5 項目 (decisions >=4, artifacts 存在, next 明記, minLines 50, 禁止語ゼロ) を満たすこと
