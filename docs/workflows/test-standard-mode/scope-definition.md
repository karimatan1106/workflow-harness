phase: scope_definition
status: complete
summary: Standard mode 検証用タスク。実装は走らせず phase 遷移のみ確認
userResponse: orchestrator経由で「Standard mode の advance 検証のみ、実装走らせない」と承認済

intent-analysis:
  surfaceRequest: standard mode の phase列が research に進むことを確認
  deepNeed: mode-aware advancePhase の Standard 経路が live
  rootCause: dogfooding Phase 1 検証の補完

scope:
  inScope: dummy/file.ts (実例なし、phase 遷移検証のみ)
  notInScope: 実装、テスト、commit

acceptanceCriteria[5]{id,criterion,measurement}:
  AC-1, "harness_next が research を返す", "MCP 戻り値の nextPhase=research"
  AC-2, "mode=standard 永続化されている", "workflow-state.toon に mode: standard"
  AC-3, "Standard MODE_PHASES 定義に research が 3番目に存在", "registry.ts MODE_PHASES.standard[2]=research"
  AC-4, "DoD で要求される minLines は ~24 (factor 0.8)", "phaseGuide.minLines 値"
  AC-5, "advance 後 phase が research に変わる", "harness_status の phase=research"

openQuestions[0]:

decisions[5]{id,statement,rationale}:
  SD-1, "DoD 通過のため最小限の検証用 artifact を作成", "phase 遷移検証が目的、実装スコープ外"
  SD-2, "AC 5件 (Standard mode の minimum) 設定", "Phase 2 DoD scaling 検証も兼ねる"
  SD-3, "scope は dummy/file.ts 1件のみ", "実体なくても phase 遷移には影響しない"
  SD-4, "implementation phase まで走らせない", "Standard end-to-end 検証は別タスク"
  SD-5, "完了後 harness_reset で畳む", "cleanup を test 中に組み込む"

artifacts[2]{path,role,summary}:
  docs/workflows/test-standard-mode/scope-definition.md, "spec", "本書"
  C:/dummy/file.ts, "ref", "検証用、実例なし"

next:
  criticalDecisions: harness_next で nextPhase 確認、Standard なら research、Express なら implementation
  readFiles: なし (実装走らせない)
  warnings: 検証用タスク、cleanup 必須

## decisions
- SD-1: DoD 通過のため最小限の検証用 artifact 作成 (phase 遷移検証が目的)
- SD-2: AC 5件 (Standard minimum) 設定 (Phase 2 DoD scaling 検証兼用)
- SD-3: scope は dummy/file.ts 1件のみ (実体不要、遷移確認のみ)
- SD-4: implementation phase まで走らせない (end-to-end 検証は別タスク)
- SD-5: 完了後 harness_reset で畳む (cleanup 組込み)

## artifacts
- docs/workflows/test-standard-mode/scope-definition.md (本書)
- C:/dummy/file.ts (検証用、実例なし、phase 遷移確認のみ)

## next
- criticalDecisions: harness_next 確認、Standard mode なら research、Express mode なら implementation
- readFiles: なし
- warnings: 検証用タスク、cleanup 必須
