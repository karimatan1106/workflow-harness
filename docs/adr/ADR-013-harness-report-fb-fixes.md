# ADR-013: Harness Reporting Fixes (FB-1+5, FB-2, FB-4, FB-6)

Date: 2026-03-30
Status: Accepted
Category: Internal Logic Improvement
Impact: Quality & Reliability

## Context

ハーネスレポート分析（9c418c3, 3ec490d）で4件のバグ/改善が検出された：
- FB-1+5: readonlyフェーズでのWrite/Edit制御不全
- FB-2: テストケースID行の重複誤検出
- FB-4: RTM ID重複時のエントリ蓄積
- FB-6: goBack後の成果物ハッシュ不整合

各修正は相互独立の内部ロジック改善であり、ユーザー向けAPI/UI変更を伴わない。

## Problem Statement

### FB-1+5: readonlyフェーズのWrite/Edit除外漏れ

readonlyフェーズ（hearing, scope_definition, research, impact_analysis, requirements）ではコード編集を許可すべきでない。planOnlyフィルタでは既に除外されているが、通常のreadonlyフェーズでは未対応。結果、CoordinatorがWrite/Editツールを使用可能になり、設計思想（planning以前の段階では変更禁止）に違反する可能性。

### FB-2: テストケース構造行の重複誤検出

checkDuplicateLines()が「TC-001: テスト名」形式のテストケース行を重複として誤検出。構造行判定パターンにテストケースID行が含まれないため。結果、DoD検証で無関係の行を重複として報告し、成果物品質判定を阻害。

### FB-4: RTMエントリの無制限蓄積

applyAddRTM()が重複チェックなしに無条件pushするため、同一IDで複数回呼ぶとrtmEntries配列に重複エントリが蓄積。リトライフローで前のリトライ結果が残り、最新の修正内容が埋もれる。

### FB-6: goBack後のハッシュ不整合

goBack()でretryCountはクリアされるがartifactHashesはクリアされない。ロールバック後、古いフェーズの成果物を再生成するとハッシュが更新される一方、古いハッシュも残存。artifact_driftチェックで「同じフェーズなのにハッシュが異なる」と誤検出する可能性。

## Decision

4件の修正を以下の方針で実装する：

### FB-1+5: readonlyフェーズ判定の追加

**判定:** phaseGuide.bashCategories.length === 1 && bashCategories[0] === 'readonly'

**実装:** delegate-coordinator.tsのallowedTools算出時に、planOnlyフィルタと同じfilter chainでreadonly判定を追加。

```
const isReadonlyPhase = phaseGuide.bashCategories.length === 1 && phaseGuide.bashCategories[0] === 'readonly';
const allowedTools = (planOnly || isReadonlyPhase) ? baseAllowedTools.split(',').filter(t => !['Write', 'Edit'].includes(t)).join(',') : baseAllowedTools;
```

**理由:** planOnlyと同一パターンを使用することで、コード一貫性を保ちながら実装変更を最小化。boolean OR統合により、二重フィルタが発生しても冪等な設計。

**代替案を棄却した理由:**
- buildAllowedTools()側で実装：coordinatorBaseにWrite/Editが含まれないため、delegate-coordinatorで制御する現行パターンを維持。
- Map構造で管理：コード行数増加と既存コードへの影響が大きい。

### FB-2: テストケース構造行パターンの追加

**パターン:** `/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/`

**マッチ対象:**
- "TC-001: テスト名" ✓
- "- AC-1: 受入基準" ✓
- "F-001: 要件" ✓
- "- BUG-123: バグ" ✓
- "通常のテキスト行" ✗

**実装:** dod-helpers.tsのisStructuralLine()にパターンを追加（L26の短ラベル行判定の直前）。

**理由:** 既存パターンと独立し、false negativeリスク（構造行として認識すべき行を見逃す）は軽微（実装ガイドラインで指定されたID形式をカバー）。false positiveリスク（通常行を構造行と誤認識）も低い（一般的なID形式をカバーしつつ、テキストで始まる行は除外）。

**代替案を棄却した理由:**
- checkDuplicateLines()側で例外化：構造行の定義を一元管理する既存設計に従い、isStructuralLine()側で対応。
- 正規表現拡張：[A-Z]{1,5}で一般的なプレフィックスをカバー。6文字以上のプレフィックスは実装ガイドライン外のため対象外。

### FB-4: applyAddRTM()のupsert化

**変更:** 無条件push → findIndex + splice置換

```
const existingIdx = state.rtmEntries.findIndex(e => e.id === entry.id);
if (existingIdx >= 0) {
  state.rtmEntries.splice(existingIdx, 1, entry);
} else {
  state.rtmEntries.push(entry);
}
```

**理由:** 既存配列インターフェースを保持し、下流の依存関係（applyUpdateRTMStatus, refreshCheckpointTraceability）への影響を最小化。同一IDの重複エントリ蓄積を防ぎ、リトライフローで常に最新値が採用される堅牢性。

**代替案を棄却した理由:**
- Mapへの構造変更：rtmEntriesを使用する既存コード箇所（15+か所）への影響が大きい。incremental deploymentが困難。
- Set<id>の併用：追加メモリコスト、同期メンテナンスコスト。findIndex O(n)の性能ペナルティ許容（RTMエントリ数は数十件程度）。

### FB-6: goBack()でartifactHashesをクリア

**変更:** retryCount = {} の直後に state.artifactHashes = {} を追加。

**全クリアを採用した理由:** ハッシュキーにフェーズ名が含まれる保証がないため（例：複数フェーズで同じ成果物が生成される場合、キー形式が不透明）、部分クリア（targetPhase以降のみ）は危険。全クリアでも実害なし（フェーズ進行時に再計算されるため）。

**代替案を棄却した理由:**
- 部分クリア（targetPhase以降）：ハッシュキー形式の保証不在。不整合リスク。
- タイムスタンプベース：クロック依存、分散環境で不安定。

## Design Rationale

### 一貫性

FB-1+5はplanOnlyと同パターン（bool OR フィルタリング）を使用し、コードスタイルの一貫性を維持。追加の分岐やspecial caseを避ける。

### 最小変更原則

各修正は1-3行の変更に収まり、既存コード構造を保持。incrementalで安全なdeployment。

### 影響分析の透明性

4件の修正は相互独立。配置順序による依存関係がなく、並列実装・テスト可能。

### リスク軽減

- FB-1+5: Low risk（既存planOnlyパターンの拡張）
- FB-2: Low risk（パターン追加、既存判定に影響なし）
- FB-4: Medium risk（配列要素の置換）→ findIndex+splice動作の厳密テスト
- FB-6: Medium risk（全クリア）→ 既存フェーズ進行後の再計算で自己修復

## Verification

- AC-1～AC-5の全5件がmetを確認（acceptance-report.md）
- F-001～F-004のRTM追跡完了
- 既存テストスイート825+パス、FB関連ユニットテスト35/35 PASS
- TypeScriptビルド成功、回帰なし

## Artifacts

- requirements.md: AC-1～AC-5, F-001～F-004定義
- scope-definition.md: 影響分析、テスト戦略
- planning.md: 実装ステップ、コード差分
- acceptance-report.md: AC/RTM最終検証
- docs-update.md: ユーザー向けドキュメント更新判定

## Consequences

### Positive

- readonlyフェーズの安全性向上（Write/Edit禁止の完全実装）
- DoD検証精度向上（テストケース行の重複誤検出排除）
- リトライ信頼性向上（RTM重複エントリ排除）
- goBack安全性向上（成果物ハッシュ不整合排除）

### Negative

- なし（内部実装のみ、API/UI変更なし）

### Neutral

- コード行数増加（最小限、3行程度）
- テスト追加（各修正に対応するユニットテスト）

## References

- Harness Report: 9c418c3, 3ec490d
- Task: harness-report-fb-fixes (2026-03-30)
- PHASE_REGISTRY: workflow-harness/mcp-server/src/phases/registry.ts
- Core Constraints: .claude/rules/core-constraints.md
