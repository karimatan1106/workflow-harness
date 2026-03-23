---
name: retrospective
description: タスク完了後の振り返りと改善点の記録。completed フェーズで自動実行、または手動で `/retrospective` として呼び出し可能。
---

## 実行手順

### 1. データ収集
以下のファイルを読み込む:
- `docs/workflows/{taskId}/phase-analytics.toon` — フェーズ別所要時間
- `docs/workflows/{taskId}/phase-metrics.toon` — AC/RTM/テスト数
- harness_status で feedbackLog を取得
- harness_get_known_bugs で既知バグを取得

### 2. タスク振り返り生成
Agent(coordinator) に以下を分析させる:
- リトライが発生したフェーズとその原因
- DoD失敗が発生したフェーズとその原因
- 所要時間が突出して長かったフェーズ
- Worker が [FAIL] を返したケース
- feedbackLog に記録されたユーザーフィードバック

出力: `docs/workflows/{taskId}/retrospective.md`

フォーマット:
```
[retrospective]
taskId = {taskId}
date = {ISO date}

[[issues]]
phase = {phase name}
type = {retry | dod_failure | slow | worker_fail | user_feedback}
description = {何が起きたか}
cause = {原因}
improvement = {次回の改善策}

[[summary]]
total_issues = {数}
most_problematic_phase = {phase name}
key_improvement = {最も重要な改善点}
```

### 3. ハーネス改善トラッカー更新
issues の中で「ハーネス自体の問題」に該当するものを抽出:
- tool-gate の制約が原因 → ハーネス改善
- テンプレートの不備 → ハーネス改善
- フェーズ設計の問題 → ハーネス改善
- Worker/Coordinator の制約 → ハーネス改善

該当があれば `docs/harness-improvements.md` に追記:
```
[[improvement]]
date = {ISO date}
taskId = {taskId}
phase = {phase name}
description = {改善内容}
priority = {high | medium | low}
status = open
```

該当がなければ追記しない。

### 4. 報告
Orchestrator に以下を返す:
- issues 数
- 最も問題があったフェーズ
- ハーネス改善提案の有無
