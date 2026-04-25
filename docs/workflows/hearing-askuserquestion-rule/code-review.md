# Code Review: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md に Pre-phase: hearing セクションを追加し、hearing-worker による AskUserQuestion を用いた意図明確化フェーズを定義した。併せて各フェーズに付随していた "Why:" 行（8行）を削除し、ADR-004/ADR-005 の Documentation Layers 方針（Why は ADR に集約、スキルファイルには How/What のみ）に準拠させた。変更後のファイルは 81 行で 200 行制限内に収まっている。

## designImplementationConsistency

- planning.md で定義した「Pre-phase: hearing を Phase Work Descriptions の先頭に追加」という方針と一致している。
- hearing-worker エージェント名は .claude/agents/hearing-worker.md のファイル名と整合する。
- AskUserQuestion ツール参照は Claude Code の標準ツール名と一致している。
- DoD 定義（L1 exists, L2 userResponse present, L4 decisions >= 5）は他フェーズの DoD 記述パターンと同形式。
- "Why:" 行の削除は ADR-004 の「Why は ADR に書く。スキルファイルに Why を混在させない」という原則に従っている。

## userIntentConsistency

ユーザーの意図は「hearing フェーズの運用ルールを workflow-phases.md に記載すること」であり、追加された 2 行（見出し + 説明）がその意図を正確に反映している。"Why:" 行の削除はスコープ外の変更に見えるが、ADR-004 準拠のクリーンアップとして妥当であり、意図を損なわない。

## acAchievementStatus

- AC-1: met -- hearing セクション存在確認。grep "hearing" の結果 = 2 件（見出し行 + 説明行）。
- AC-2: met -- hearing-worker 文字列存在。grep "hearing-worker" の結果 = 1 件。
- AC-3: met -- AskUserQuestion 文字列存在。grep "AskUserQuestion" の結果 = 1 件。
- AC-4: met -- ファイル行数 81 行。200 行制限以内。
- AC-5: met -- "### Pre-phase: hearing" 形式で、他の "### Stage N:" セクションと見出しレベルが一貫している。

## decisions

- D-001: hearing セクションの配置を Phase Work Descriptions の先頭（scope_definition の前）とした。Pre-phase は全 Stage に先行するため妥当。
- D-002: "coordinator委譲禁止" を説明文に明記した。hearing-worker への直接委譲を強制する設計意図を保持。
- D-003: DoD に L1/L2/L4 の 3 レベルチェックを定義した。他フェーズと同等の検証粒度を確保。
- D-004: 推奨選択肢の A（先頭）配置ルールを説明文に含めた。ユーザー体験の一貫性を担保。
- D-005: "Why:" 行を 8 箇所から削除した。ADR-004 の Documentation Layers 方針に従い、Why は ADR に集約する。

## artifacts

- 変更ファイル: .claude/skills/workflow-harness/workflow-phases.md (81 行)
- 追加行: L11-L12 (### Pre-phase: hearing + 説明)
- 削除行: 8 行 (各フェーズの "Why:" 行)

## next

code_review 承認後、testing フェーズで workflow-phases.md の構文検証と DoD チェック自動実行に進む。
