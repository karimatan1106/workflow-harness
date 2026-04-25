# Threat Model: docs-workflows-refactoring-v2

phase: threat_modeling
task: docs-workflows-refactoring-v2
status: complete
riskLevel: low
summary: docs/workflows/ 配下のファイル移動と空ディレクトリ削除のみで構成されるリファクタリング。コード変更・API変更・設定変更を含まないため、脅威は全て低リスク。5件の脅威を特定し、全てに緩和策が存在する。

## threats[5]{id,title,likelihood,impact,mitigation}

- T-001, ファイル移動中のファイル消失, 低, 高, git mv はアトミックな名前変更操作であり中間状態でファイルが消失しない。AC-6 で移動前後の総ファイル数(1902件)一致を検証する。
- T-002, ファイルの誤カテゴリ分類, 低, 低, research フェーズで各ファイルの内容を確認し分類を決定済み。requirements.md の REQ-04/REQ-05 で分類根拠を記録済み。誤分類があっても再移動で修正可能。
- T-003, 移動ファイル内の相対参照の破損, なし, 中, impact-analysis の Cross-Reference Analysis で docs/workflows/ 内のファイルを参照している外部ファイルが存在しないことを確認済み。移動対象の .md ファイル自体も他ファイルへの相対参照を含んでいない。
- T-004, git 履歴の断裂による追跡性喪失, 低, 中, git mv を使用することで rename detection が機能し git log --follow で移動前の履歴を追跡可能。REQ-NF1 で履歴追跡性を非機能要件として定義済み。
- T-005, 非空ディレクトリの誤削除によるデータ消失, なし, 高, research フェーズで P1(9件)と P1-cleanup(13件)の全22ディレクトリが空であることを確認済み。rmdir コマンドは空ディレクトリのみ削除可能であり、非空の場合はエラーで停止する。

## overallAssessment

本リファクタリングの脅威レベルは全体として「低」である。理由は以下の3点:

1. 全操作がドキュメントの移動または空ディレクトリ削除であり、実行コード・設定ファイル・APIに一切の変更を加えない (IA-01)
2. 5件の脅威全てに対して既存の緩和策(git mv, AC-6 検証, rmdir の安全性)が存在する
3. 万が一問題が発生しても git revert で全操作を即座に復元可能

残存リスク: なし。全脅威が緩和策により対処済み。

## threatMatrix

| ID    | 発生可能性 | 影響度 | 緩和後リスク | 緩和策の信頼度 |
|-------|-----------|--------|-------------|---------------|
| T-001 | 低        | 高     | 極低        | 高 (git mv + AC-6) |
| T-002 | 低        | 低     | 極低        | 高 (research 検証済み) |
| T-003 | なし      | 中     | なし        | 高 (参照なし確認済み) |
| T-004 | 低        | 中     | 極低        | 高 (git mv rename tracking) |
| T-005 | なし      | 高     | なし        | 高 (rmdir 安全機構) |

## decisions

- TM-01, 追加の緩和策は不要と判定, 全5脅威が既存の操作手順(git mv, rmdir, AC-6)で十分に緩和されているため
- TM-02, ロールバック計画として git revert を採用, 全操作が単一コミットまたは少数コミットで構成されるため revert が最も単純で確実な復元手段であるため
- TM-03, ドライラン実行は不要と判定, 全操作が低リスクであり planning フェーズで操作順序を定義すれば十分であるため
- TM-04, git mv を使用しファイル移動の追跡性を確保する, T-004 の緩和策として rename detection を機能させ履歴の連続性を維持するため
- TM-05, 移動前後のファイル数カウントを検証ステップに含める, T-001 の緩和策としてファイル消失がないことを機械的に確認するため

## artifacts

- docs/workflows/docs-workflows-refactoring-v2/threat-model.md: report - 脅威モデル(5脅威の評価と緩和策)

## next

- criticalDecisions: 追加緩和策不要(TM-01)、ロールバックは git revert(TM-02)
- readFiles: requirements.md (AC定義), impact-analysis.md (影響範囲)
- warnings: なし。全脅威が緩和済みで残存リスクなし。
