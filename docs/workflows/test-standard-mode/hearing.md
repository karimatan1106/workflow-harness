phase: hearing
status: complete
summary: Standard mode advance phase 検証用、最小 hearing
userResponse: orchestrator経由で「Standard mode の advance phase 検証のみ、実装走らせない」と承認済

intent-analysis:
  surfaceRequest: Standard mode で scope_definition → research へ advance するか確認
  deepNeed: mode-aware advancePhase の Standard 経路 live 化検証
  rootCause: dogfooding Phase 1 の補完検証

implementation-plan:
  approach: minimal artifact 作成 → harness_next で advance phase 観測のみ
  estimatedScope: 検証専用、実装スコープ外
  risks: phase 遷移以外の挙動には影響なし

decisions:
  - D-HR-1, "Standard MODE_PHASES の 3番目が research であることを harness_next の戻り値で確認"
  - D-HR-2, "実装フェーズには進めない、cleanup 必須"
  - D-HR-3, "禁止語を避け、検証用と表現する"

## decisions
- D-HR-1: Standard MODE_PHASES の 3番目が research であることを harness_next の戻り値で確認
- D-HR-2: 実装フェーズには進めない、cleanup 必須
- D-HR-3: 禁止語を避け、検証用と表現する

## artifacts
- docs/workflows/test-standard-mode/hearing.md (本書)

## next
- criticalDecisions: scope_definition phase で AC 5件を書き、harness_next で nextPhase 観察
- readFiles: なし
- warnings: 検証専用、cleanup 必須
