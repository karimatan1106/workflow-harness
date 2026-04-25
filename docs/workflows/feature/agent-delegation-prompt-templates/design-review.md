# Design Review: agent-delegation-prompt-templates

## サマリー

設計は4層テンプレート(Why/What/How/Constraints)を3種の委譲パターン(coordinator/worker-write/worker-verify)で全委譲対象フェーズをカバーする構成であり、hearing時のdeep意図「DoDリトライ削減」に直結する。planning.mdのF-001〜F-006が6つのACを過不足なくカバーしており、state-machine.mmd/flowchart.mmd/ui-design.mdとの整合性も確認できる。200行制限はimpact-analysisの行数予測で担保済み。全ACがcoveredである。

## AC-to-Design Mapping

| AC | 設計での対応箇所 | カバー状況 |
|----|----------------|-----------|
| AC-1 | planning.md F-001: テンプレートA(coordinator)/B(worker-write)/C(worker-verify)の3種を4層構造で定義 | covered |
| AC-2 | planning.md F-002: 23フェーズ分のパラメータ表(Phase/Template/Role/必須セクション/よくある失敗) | covered |
| AC-3 | planning.md F-003: 8ステージ共通Why + 各フェーズ固有補足の追加設計 | covered |
| AC-4 | planning.md F-004: coordinator.md/worker.md/hearing-worker.mdのRole節直後にPrompt Contract追記 | covered |
| AC-5 | planning.md F-005: 共通Constraints(decisions 5件、重複行禁止、グラウンディング等) + パラメータ表のよくある失敗列(tdd_red_evidence API誤用、TOON/Markdown不整合等) | covered |
| AC-6 | impact-analysis.mdの行数予測で全6ファイルが200行以下を確認済み。delegation.md目標150行以下 | covered |

## 設計-実装整合性

### state-machine.mmd との整合

状態遷移図は TemplateSelection → ParameterFill → WhyContextSet → WhatSpecSet → HowStepsSet → ConstraintsSet → AgentDelegation → AgentExecution → DoDCheck の流れを定義。planning.mdの4層埋め込み順序(Why→What→How→Constraints)と一致している。リトライ時はRetryWithFailure → ConstraintsSetへ戻る設計であり、F-005のPrior failures更新方針と整合。

### flowchart.mmd との整合

フローチャートは委譲判定(approve/commit等の直接実行パスの早期分岐)→ パラメータ表参照 → 3種テンプレート分岐 → 4層埋め込み → Agent委譲 → DoD検証のフローを描写。planning.mdのF-001テンプレート3種とF-002パラメータ表参照の構造と一致。リトライループがPrior failures追加→再埋め込みとなっている点もF-005と整合。

### ui-design.md との整合

プロンプトインターフェースを入力(4層テンプレート)と出力([OK]/[FAIL]/[EDIT])に分離した設計。planning.mdのテンプレート構造(Why層/What層/How層/Constraints層)の各項目が一対一で対応。テンプレート種別選択フローもパラメータ表参照方式であり、LLM判断を排除した決定論的選択としてplanning.mdと一致。

## ユーザー意図との整合性

hearing.mdのdeep意図「DoDリトライの根本原因(Workerが何を書くべきか知らない)を解消し、ハーネス実行時間を削減する」は以下の設計要素で達成される:

- What層のOutput spec(必須セクション+書き方): Workerが「何を書くか」を事前に知る(test_design 5回リトライの根本原因を解消)
- How層の正しいAPI指示: tdd_red_evidence API誤用(レポート2)を防止
- Constraints層のPrior failures: リトライ時に前回失敗理由が明示され、同じ過ちを繰り返さない
- Constraints層の共通ルール(decisions 5件必須、重複行禁止): delta_entry_format(レポート1)、重複行パターン(レポート3 FB-2)を防止
- F-003のステージ共通Why: 各フェーズの目的が明確になり、判断の軸がぶれない

## リスク評価

threat-model.mdで識別された6リスク(T-1〜T-6)に対する設計での軽減状況:

| リスク | 設計での軽減 | 評価 |
|--------|------------|------|
| T-1 Spoofing(テンプレート偽装) | gitリポジトリ管理。設計上の追加対策不要 | 軽減済み |
| T-2 Tampering(構造破壊) | DoDゲートが4層構造を検証。F-004のPrompt Contractが構造参照を義務化 | 軽減済み |
| T-3 Repudiation(変更否認) | git履歴で追跡可能。設計上の追加対策不要 | 軽減済み |
| T-4 Info Disclosure(秘密情報混入) | テンプレートにプレースホルダを含めない設計方針。planning.mdの3種テンプレートいずれもAPIキー等のプレースホルダなし | 軽減済み |
| T-5 DoS(コンテキスト枯渇) | delegation.md目標150行以下(AC-6)。パラメータ表方式で全フェーズ個別定義を回避 | 軽減済み |
| T-6 EoP(権限昇格) | F-006でtool-delegation.mdにテンプレート強制ルールを追記。hookが独立して権限制御 | 軽減済み |

残存リスク: R-1(workflow-execution.mdとの責務重複)はnotInScopeとして明示的に別タスクに先送りされており、本タスク内での対応は不要。

## acDesignMapping

- AC-1: planning.md F-001 テンプレート3種定義(coordinator/worker-write/worker-verify)、ui-design.md プロンプトインターフェース設計
- AC-2: planning.md F-002 フェーズ別パラメータ表(23フェーズ分Output spec)、ui-design.md テンプレート種別選択フロー
- AC-3: planning.md F-003 ステージ共通Why(8個)+フェーズ固有補足、workflow-phases.md構造変更設計
- AC-4: planning.md F-004 Prompt Contract追記(3ファイル)、ui-design.md 入力インターフェース4層構造
- AC-5: planning.md F-005 失敗パターン反映(共通Constraints+パラメータ表のよくある失敗列)
- AC-6: impact-analysis.md行数予測(全ファイル200行以下確認済み)

## decisions

- AC-to-Design Mapping: 全6ACがcoveredであり、uncoveredなし -- F-001〜F-006が各ACに明確に対応している
- テンプレート3種の粒度: coordinator/worker-write/worker-verifyの3分類は全23委譲フェーズを過不足なくカバーしている -- パラメータ表のTemplate列で確認済み
- state-machine.mmdのリトライ設計: ConstraintsSetへの戻りはPrior failures更新のみで4層全体を再構築しない点が効率的 -- ui-design.mdのリトライフロー記述と整合
- F-003のWhy共通化方式: 8ステージ共通+フェーズ固有補足は重複を最小化しつつ全30フェーズにWhyを提供する合理的な設計 -- 個別Why方式だとworkflow-phases.mdが200行を超過する
- 失敗パターンの2層反映(F-005): 共通ConstraintsとフェーズパラメータFixの適切な責務分離 -- test_impl API誤用のようなフェーズ固有問題を共通ルールに混ぜない
- notInScope境界: workflow-execution.md変更、RTM重複コード修正、承認待ち分離コード修正を明示的に除外しスコープ肥大を防止 -- requirements.mdのnotInScopeと一致
- flowchart.mmdの委譲判定分岐: approve/commit等の非委譲フェーズを早期除外する設計はテンプレート適用範囲を明確にする -- 全フェーズに一律適用する誤解を防止

## artifacts

| ファイル | レビュー対象 |
|---------|------------|
| docs/workflows/agent-delegation-prompt-templates/requirements.md | AC-1〜AC-6定義、notInScope境界 |
| docs/workflows/agent-delegation-prompt-templates/planning.md | F-001〜F-006技術設計、実装順序 |
| docs/workflows/agent-delegation-prompt-templates/state-machine.mmd | 状態遷移(テンプレート選択→4層Set→DoD検証→リトライ) |
| docs/workflows/agent-delegation-prompt-templates/flowchart.mmd | フロー(委譲判定→3種分岐→4層埋め込み→DoD検証) |
| docs/workflows/agent-delegation-prompt-templates/ui-design.md | プロンプトインターフェース設計(入力4層/出力[OK][FAIL][EDIT]) |
| docs/workflows/agent-delegation-prompt-templates/threat-model.md | STRIDE分析(T-1〜T-6)と軽減策 |

## next

- test_designフェーズへ
