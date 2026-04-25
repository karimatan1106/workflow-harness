# Hearing: harness-report-fb-fixes

scope: harness-report FB-1+5, FB-2, FB-4, FB-6 の4件修正
date: 2026-03-30

## User Intent

ハーネスレポートで検出された4件のバグ/改善をコード修正する。

## Confirmed Scope

### FB-1+5: readonlyフェーズでWrite/Editを禁止

- file: workflow-harness/mcp-server/src/tools/handlers/delegate-coordinator.ts
- problem: readonlyフェーズ(hearing, scope_definition, research等)でcoordinatorにWrite/Editが許可されている。planOnlyモードでは除外済みだが、通常のreadonly bashCategoriesフェーズでは未対応。
- fix: phaseGuideのbashCategoriesにreadonlyのみ含まれる場合、allowedToolsからWrite/Editを除外する。

### FB-2: テストケース構造行の誤検出

- file: workflow-harness/mcp-server/src/gates/dod-helpers.ts
- problem: isStructuralLine()がテストケースID行(例: TC-001:, - TC-001:)を構造行として認識しない。checkDuplicateLines()で重複として誤検出される。
- fix: isStructuralLine()にテストケースID行パターン(/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[::]/)を追加。

### FB-4: RTM ID重複時のサイレント上書き

- file: workflow-harness/mcp-server/src/state/manager-write.ts
- problem: applyAddRTM()が重複IDチェックなしでpushするため、同一IDのRTMエントリが複数存在し得る。
- fix: 既存IDがあれば上書き(replace)、なければpush。coordinatorリトライ時に最新の値が採用される。

### FB-6: goBack時のartifactHashesクリア

- file: workflow-harness/mcp-server/src/state/manager-lifecycle.ts
- problem: goBack()でartifactHashesがクリアされないため、戻り先フェーズで成果物を再生成するとハッシュ不一致でバリデーション失敗する。
- fix: goBack()内でstate.artifactHashes = {}を追加(retryCountクリアの直後)。

## Implementation Approach

- FB-4はユーザー確認済み: サイレント上書き方式(Option A)を採用。既存エントリをfindIndex+spliceで置換し、存在しなければpush。
- 4件とも修正箇所が明確で独立しているため、1つのimplementationフェーズで一括修正する。
- 既存テストスイート(825+パス)でリグレッション確認。各修正に対応するユニットテストの追加/更新を行う。

userResponse: FB-4のRTM ID重複時はOption A(サイレント上書き)を選択。既存エントリを最新値で置換する方式。

## decisions

- HR-001: FB-4のRTM ID重複時はサイレント上書き方式を採用。リトライ/修正フローで最新値が常に採用される設計。
- HR-002: 4件を1タスクで一括修正。各修正は独立しており相互依存なし。
- HR-003: FB-1+5はbashCategories判定でreadonlyフェーズを検出し、Write/EditをdisallowedToolsに追加する。
- HR-004: FB-2はisStructuralLine()にテストケースIDパターンを追加し、重複行false positiveを解消する。
- HR-005: FB-6はgoBack()でartifactHashesを全クリアし、ロールバック後のハッシュ不整合を防止する。

## artifacts

- hearing.md (this file)

## next

scope_definitionフェーズで各修正の影響範囲を精査し、テスト計画を含むスコープ定義を作成する。

## Out of Scope

- FB-3 (size判定): 設計判断として現状維持
