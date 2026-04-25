# Design Review: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: design_review
date: 2026-03-24
reviewer: coordinator

## summary

全設計成果物(requirements, planning, ui-design, threat-model, impact-analysis, scope-definition)をレビューした。AC-1からAC-7の全受入基準が実装ステップPL-01からPL-06に対応付けられており、RTMエントリF-001からF-006で追跡可能。脅威モデルT-01からT-08の緩和策がplanning.mdの各ステップに組み込まれていることを確認した。重大な問題は検出されなかった。

## decisions

- DR-01: AC網羅性は十分と判定。7件のACが全て実装ステップに対応付けられている。requirements.mdのRTM表でAC-1からAC-7がそれぞれL1またはL2検証手段を持ち、planning.mdのPL-01からPL-06にF-001からF-006として登録されている。未カバーのACは存在しない。
- DR-02: 脅威緩和策の統合は適切と判定。threat-model.mdのT-01からT-08がplanning.mdのarchitectureDecisions AD-1からAD-5に反映されている。特にT-04(mv失敗時のデータ損失)に対するcp+verify+rmの3段階操作(AD-2)、T-02(パス長超過)に対する削除先行の操作順序(AD-1)、T-06(並列Worker競合)に対する依存関係制約(AD-4)が明示的に組み込まれている。
- DR-03: コード変更不要の判定は妥当と判定。impact-analysis.mdでハーネスの全パス参照が動的生成であること(IA-01)、.gitignoreでdocs/workflows/全体がignore済みであること(IA-07)を確認した。unaffectedModules表でmcp-server, hooks, rules, skillsの各モジュールが非影響であることが根拠付きで記載されている。
- DR-04: カテゴリ分類基準は明確かつ曖昧性が低いと判定。ui-design.mdのcategoryClassificationCriteria表で4カテゴリの判定基準とディレクトリ名パターン(BUG*, P0*, fix-*等)が定義されている。research.mdのSection 3で全194件の分類結果が確定済みであり、planning.mdのPL-D4で「実装時に再分類判断を行わない」と明記されているため、分類ブレのリスクは排除されている。
- DR-05: ロールバック戦略は十分と判定。requirements.mdのREQ-D06で5段階コミット分割が定義され、planning.mdのPL-D6で各ステップ完了時のgit commitが明記されている。PL-D5でvitest失敗時のgit revert手順も定義されている。ステップ単位での粒度が確保されており、全体ロールバックも段階的ロールバックも可能。
- DR-06: 並列実行設計は安全と判定。planning.mdのAD-4でPL-01からPL-03の並列実行可能性が定義されている。各ステップが操作対象ディレクトリ群で重複しないことがresearch.mdの一覧で確認できる。PL-04はPL-01からPL-03完了後、PL-05はPL-04完了後という依存関係がthreat-model.mdのT-06緩和策と整合している。
- DR-07: scope-definition.mdとrequirements.mdの件数差異は許容範囲と判定。scope-definitionでは「23件重複、32件旧プロジェクト、211件残存」、requirementsでは「24件重複、33件旧プロジェクト、194件残存」と件数が異なるが、これはresearchフェーズでの精査による更新であり、requirements.mdの件数が最新かつ正とする。planning.mdもrequirements.mdの件数に準拠している。

## acDesignMapping

- AC-1: PL-01 半角重複削除ステップ（diff検証 + rm -rf）
- AC-2: PL-02 半角リネームステップ（cp + diff + rm）
- AC-3: PL-03 旧プロジェクト削除ステップ（rm -rf）
- AC-4: PL-04 カテゴリ移動ステップ（mkdir + mv、ui-design.md のレイアウト設計に準拠）
- AC-5: PL-05 散在.mdラッピングステップ（mkdir + mv）
- AC-6: PL-04 + PL-06 検証ステップ（ls確認でルートにカテゴリディレクトリのみ）
- AC-7: PL-06 検証ステップ（vitest run でハーネス非影響確認）

## artifacts

| path | role | verdict |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/hearing.md | ヒアリング結果 | PASS: ユーザー承認取得済み |
| docs/workflows/docs-workflows-refactoring/research.md | 調査結果 | PASS: 重複ペア/削除対象/カテゴリ分類の全一覧が確定 |
| docs/workflows/docs-workflows-refactoring/scope-definition.md | スコープ定義 | PASS: 5アクション承認済み(件数はrequirementsで更新) |
| docs/workflows/docs-workflows-refactoring/impact-analysis.md | 影響分析 | PASS: コード変更不要を根拠付きで確認 |
| docs/workflows/docs-workflows-refactoring/requirements.md | 要件定義 | PASS: AC-1~AC-7, RTM F-001~F-006, notInScope明確 |
| docs/workflows/docs-workflows-refactoring/planning.md | 実装計画 | PASS: PL-01~PL-06, 脅威緩和統合済み, 並列実行設計済み |
| docs/workflows/docs-workflows-refactoring/ui-design.md | ディレクトリレイアウト設計 | PASS: 4カテゴリ分類基準明確, コンテキスト削減効果定量化済み |
| docs/workflows/docs-workflows-refactoring/threat-model.md | 脅威モデル | PASS: T-01~T-08, STRIDE分析, リスクマトリクス完備 |

## issues

なし。重大な問題は検出されなかった。

## recommendations

- REC-01: 各カテゴリディレクトリにREADME.mdを配置し、分類基準を記載することで、今後の新規タスク作成時のカテゴリ選択を支援できる。ただし本タスクのスコープ外であり、必須ではない。
- REC-02: ハーネスがタスク作成時にカテゴリを自動判定する機能は将来的な改善候補。現時点ではディレクトリ構造の整理が優先であり、本タスクのスコープ外。

## next

- implementationフェーズに進行可能(ブロッカーなし)
- Worker分割: PL-01, PL-02, PL-03を並列実行、PL-04はPL-01~PL-03完了後、PL-05はPL-04完了後、PL-06はPL-05完了後
- 読むべきファイル: research.md(操作対象一覧), planning.md(手順詳細), threat-model.md(緩和策)
