# Task Size Investigation Report

Date: 2026-03-23

## 1. size enum grep結果

### 型定義
- `src/state/types-core.ts:60` — `export type TaskSize = 'small' | 'medium' | 'large';`
- `src/state/types-core.ts:174` — `export const TaskSizeSchema = z.enum(['small', 'medium', 'large']);`

### harness_start パラメータ定義
- `src/tools/defs-a.ts:17` — `size: { type: 'string', enum: ['small', 'medium', 'large'], description: 'Task size. Default: large.' }`
- ADR-008で追加された。requiredではなくオプショナル。

### ハードコード箇所（size強制）
- `src/tools/handlers/lifecycle.ts:48` — `const size: TaskSize = 'large'; // Always force large — small/medium abolished`
- args.sizeパラメータは完全に無視される。どの値を渡しても常に'large'になる。

## 2. サイズによるフェーズ数変更ロジック

### SIZE_SKIP_MAP（現在: 全て空配列）
- `src/phases/registry.ts:94-98`:
```
SIZE_SKIP_MAP = {
  small: [],
  medium: [],
  large: [],
};
```

### SIZE_MINLINES_FACTOR（現在も残存）
- `src/phases/registry.ts:100-104`:
  - small: 0.6（minLinesを60%に削減）
  - medium: 1.0
  - large: 1.0

### getActivePhases / getNextPhase
- `src/phases/registry.ts:106-119` — SIZE_SKIP_MAPを使ってフェーズをフィルタする仕組みは残っているが、全て空なので効果なし。

### shouldRequireApproval
- `src/tools/handler-shared.ts:39-43` — `size === 'small' && phase === 'requirements'` の場合にrequirements承認を自動スキップするロジックが残存。ただしsizeが常にlargeなので到達不能コード。

### risk-classifier.ts
- `src/phases/risk-classifier.ts:36-38` — score.total <= 3 → small, <= 7 → medium, else → large。コードは残存するが呼び出し元がない（lifecycle.tsがargs.sizeを無視しrisk-classifierも不使用）。

## 3. small/medium廃止の経緯

### 時系列
1. **ADR-007** (2026-03-21): smallタスクDoD最適化 — FB#3でSIZE_SKIP_MAP.smallにフェーズスキップを追加（commit `fa5d1b1`）
2. **ADR-008** (2026-03-22): harness_startにsize引数を追加（commit `7429d6a`）
3. **commit `482468a`** (2026-03-22): small/mediumを廃止
   - SIZE_SKIP_MAPのsmall/medium配列を空に
   - lifecycle.tsでsize引数を無視し常にlargeを強制
   - コミットメッセージ: "All tasks now run full 30-phase workflow regardless of input size"

### 廃止前のSIZE_SKIP_MAP（commit 482468a~1）

**small** がスキップしていたフェーズ（21フェーズスキップ、残り約10フェーズ）:
research, impact_analysis, threat_modeling, planning, state_machine, flowchart, ui_design, design_review, test_selection, refactoring, code_review, regression_test, acceptance_verification, manual_test, security_scan, performance_test, e2e_test, docs_update, ci_verification, deploy, health_observation

**medium** がスキップしていたフェーズ（8フェーズスキップ）:
impact_analysis, state_machine, flowchart, ui_design, design_review, test_selection, refactoring, acceptance_verification

## 4. 現状の矛盾・デッドコード

| 箇所 | 状態 |
|------|------|
| `defs-a.ts:17` size enum定義 | APIスキーマにsmall/mediumが残存（受け付けるが無視） |
| `types-core.ts:60` TaskSize型 | 型にsmall/mediumが残存 |
| `risk-classifier.ts` 全体 | 呼び出し元なし（デッドコード） |
| `registry.ts` SIZE_SKIP_MAP | 空配列のまま残存（構造のみ） |
| `registry.ts` SIZE_MINLINES_FACTOR | small: 0.6が残存するが到達不能 |
| `handler-shared.ts:41` shouldRequireApproval | small分岐が到達不能 |
| `manager-write.ts:20-22` RISK_SCORE_MAP | small/mediumのスコアマップが残存 |
