# research-analysis: workflow-harness-refactoring

## 1. vscode-ext/ 全ファイル一覧と参照箇所

### ファイル一覧 (node_modules除外: 6ファイル)

| ファイル | サイズ |
|---------|-------|
| workflow-harness/vscode-ext/src/extension.ts | ソース (77行) |
| workflow-harness/vscode-ext/out/extension.js | ビルド出力 |
| workflow-harness/vscode-ext/package.json | 27行 |
| workflow-harness/vscode-ext/tsconfig.json | 12行 |
| workflow-harness/vscode-ext/package-lock.json | ロックファイル |
| workflow-harness/vscode-ext/harness-log-pane-0.1.0.vsix | ビルド成果物 (4.2KB) |

node_modules/ ディレクトリも存在する（削除対象）。

### 参照箇所 (全検索結果)

| ファイル | 行番号 | 種別 | 内容 |
|---------|--------|------|------|
| workflow-harness/STRUCTURE_REPORT.md | L38 | ドキュメント | ディレクトリ構造記載 |
| workflow-harness/STRUCTURE_REPORT.md | L140-L148 | ドキュメント | セクション 2.6 VS Code Extension 解説 |
| workflow-state.toon (27a3413e) | L23, L34 | 過去タスク状態 | scopeFiles に vscode-ext パス含む |
| workflow-state.toon (8ad74731) | L25 | 過去タスク状態 | scopeDirs に .vscode-extensions パス含む（別ディレクトリ） |
| workflow-state.toon (a0e87be6) | L18, L22, L34, L36 | 現タスク状態 | userIntent/scopeDirsに vscode-ext 記載 |

### 削除時の安全性

- setup.sh, .gitignore, package.json (root), hooks/, mcp-server/src/: 参照なし（ランタイム依存なし）
- STRUCTURE_REPORT.md: L38, L140-L148 の2箇所を修正すれば完了
- workflow-state.toon: 過去記録として残す（SD-07）

結論: ランタイム依存ゼロ。安全に削除可能。
---

## 2. hooks/ 各hookファイル詳細分析

### ファイル一覧と行数

| ファイル | 行数 | 目的 | hook-utils依存 |
|---------|------|------|---------------|
| hook-utils.js | 82行 | 共通ユーティリティ（プロジェクトルート検出、フェーズ取得、バイパスパス判定、stdin読み込み） | - (自身) |
| block-dangerous-commands.js | 114行 | 危険コマンドブロック（rm -rf /、fork bomb、mkfs、dd、chmod 777、curl pipe、npm publish、git force push、git reset --hard等） | parseHookInput |
| context-watchdog.js | 160行 | コンテキスト監視（定期記憶リフレッシュ、重複Read検出、チェックポイント強制、ピットフォール検出、subagent知識注入） | findProjectRoot, readStdin |
| loop-detector.js | 65行 | ループ検出（同一ファイルへの連続Edit/Write検出、5分間5回でブロック） | findProjectRoot, isBypassPath |
| session-boundary.js | 107行 | セッション境界管理（ハンドオフ注入、セッション終了キーワード検出、カウンターリセット） | findProjectRoot, readStdin |
| tool-gate.js | 237行 | 3層ツールアクセス制御（L1/L2/L3のツール権限、フェーズ別Bash/Write/Edit制限） | findProjectRoot, getCurrentPhase, isBypassPath, readStdin, parseHookInput |
| pre-tool-guard.sh | 107行 | Bash版2層ツールガード（環境変数ベース、Agent whitelist） | なし（独立） |
| test-guard.sh | 263行 | pre-tool-guard.shのテストスイート | なし（テスト） |

### hook-utils.js エクスポート関数の利用状況

| 関数 | 利用hookファイル |
|------|-----------------|
| findProjectRoot | context-watchdog.js, loop-detector.js, session-boundary.js, tool-gate.js |
| getCurrentPhase | tool-gate.js |
| isBypassPath | loop-detector.js, tool-gate.js |
| parseHookInput | block-dangerous-commands.js, tool-gate.js |
| readStdin | context-watchdog.js, session-boundary.js, tool-gate.js |
| getActivePhaseFromTaskIndex | （直接利用なし。getCurrentPhase経由） |
| getActivePhaseFromWorkflowState | （直接利用なし。getCurrentPhase経由） |

### バックアップファイル（削除対象: 4件）

| ファイル | パス | サイズ |
|---------|------|--------|
| pre-tool-guard.sh.bak2 | workflow-harness/hooks/pre-tool-guard.sh.bak2 | 5.3KB |
| pre-tool-guard.sh.bak3 | workflow-harness/hooks/pre-tool-guard.sh.bak3 | 5.3KB |
| pre-tool-guard.sh.disabled | workflow-harness/hooks/pre-tool-guard.sh.disabled | 3.9KB |
| test-guard.sh.bak4 | workflow-harness/hooks/test-guard.sh.bak4 | 10.9KB |

他にバックアップファイルなし（.old, .backup, ~ も未検出）。git履歴で復元可能。
---

## 3. フェーズテンプレート分析

### 全ステージファイル一覧

| ファイル | フェーズ | 行数 |
|---------|---------|------|
| defs-stage0.ts | hearing | 42行 |
| defs-stage1.ts | scope_definition, research, impact_analysis, requirements | 202行 |
| defs-stage2.ts | threat_modeling, planning, state_machine, flowchart, ui_design | 175行 |
| defs-stage3.ts | design_review, test_design, test_selection | 130行 |
| defs-stage4.ts | test_impl, implementation, refactoring, build_check, code_review | 185行 |
| defs-stage5.ts | testing, regression_test, acceptance_verification, manual_test, security_scan | 153行 |
| defs-stage6.ts | performance_test, e2e_test, docs_update, commit, push, ci_verification, deploy, health_observation | 198行 |

注: scope-analysisでは defs-stage3.ts が言及されていなかったが、実際には存在する（design_review, test_design, test_selection を含む）。

### Serena CLI統合状況

| ファイル | フェーズ | Serena統合 | 詳細 |
|---------|---------|-----------|------|
| defs-stage1.ts | scope_definition (L27-L52) | 統合済み | Step 0 Serena可否チェック, Step 1 LSP search, fallback Grep |
| defs-stage1.ts | research (L104-L117) | 未統合 | Serenaコマンドなし |
| defs-stage1.ts | impact_analysis (L128-L148) | 統合済み | find_referencing_symbols, Grep fallback付き |
| defs-stage1.ts | requirements (L158-L201) | 未統合 | ドキュメント生成フェーズ |
| defs-stage2.ts | threat_modeling-ui_design | 未統合 | 分析/設計のみ |
| defs-stage3.ts | design_review-test_selection | 未統合 | レビュー/テスト設計のみ |
| defs-stage4.ts-stage6.ts | 全フェーズ | 未統合 | 実装/テスト/リリース |

### Serena統合パターン（scope_definitionの例: defs-stage1.ts L27-L52）

Step 0 Serena利用可否チェック -> Step 1 LSP-firstエントリポイント検索(--limit 100) -> fallback Grep/Glob -> Step 2 依存追跡(find_referencing_symbols --limit 100) -> fallback Grep/Glob

research, test_design への統合拡大時はこのパターンを踏襲する。
---

## 4. hearing DoD分析

### registry.ts のhearing定義 (L10)

hearing: name=hearing, stage=0, model=opus, outputFile={docsDir}/hearing.md, requiredSections=[decisions, artifacts, next], minLines=20, dodChecks=[] (空配列)

### dodChecksの型定義 (types-core.ts L6-L9)

DoDCheck interface: level(ControlLevel), description(string), check(context => boolean or Promise of boolean)

### 全フェーズのdodChecks状況

registry.tsの全31フェーズで dodChecks: [] が設定されている。カスタムDoDチェックを使用しているフェーズは現在ゼロ。DoDは代わりに gates/ 配下の14モジュールで一括実行される:

- dod.ts: メインDoD実行エントリ
- dod-l1-l2.ts: L1(ファイル存在)/L2(exitコード/テスト結果)チェック
- dod-l3.ts: L3チェック
- dod-l4-content.ts: L4コンテンツ検証（禁止パターン、プレースホルダー、重複行、セクション）
- dod-l4-delta.ts, dod-l4-art.ts, dod-l4-commit.ts, dod-l4-dci.ts
- dod-l4-refs.ts, dod-l4-ia.ts, dod-l4-requirements.ts, dod-l4-toon.ts
- dod-helpers.ts, dod-types.ts

### hearing DoDにuserResponse検証を追加する方法

選択肢A: registry.tsの dodChecks 配列にインラインチェック関数を追加
選択肢B: dod-l4-content.ts にhearing固有のphase分岐を追加
選択肢C: 新規 dod-l4-hearing.ts ファイルを作成（200行制限に収まりやすい）

推奨: 選択肢Aまたは選択肢C。dodChecks配列は現在全フェーズで空だが、型定義は整っており追加可能。

---

## 5. スキルドキュメント分析

### workflow-orchestrator.md のテンプレート取得フロー

現在の記述:
- L27: b. If hasTemplate: harness_get_subphase_template -> get prompt
- L28: c. Agent(subagent_type="coordinator", prompt=template) -> 分析/タスク分解
- L101: NEVER construct prompts from scratch. Get from harness_next or harness_get_subphase_template. Use VERBATIM.
- L160: ツール一覧表に harness_get_subphase_template

現在のフロー: Orchestrator -> harness_get_subphase_template -> template取得 -> Coordinator に渡す
変更後のフロー: Coordinator -> harness_get_subphase_template -> template取得（直接）

変更箇所: L27-L28, L101 を coordinator 直接取得に更新。L160 は変更不要。

### workflow-execution.md のsubagent設定表

- L9-L25: フェーズ別subagent設定表
- L71: harness_get_subphase_template で取得可能 -> coordinator直接取得に更新

### tool-gate.js との整合性 (重要な発見)

tool-gate.js L48-L56: checkL2関数でL2(coordinator)は非ライフサイクルMCPを呼べる。harness_get_subphase_template はライフサイクルMCPではない（HARNESS_LIFECYCLEに含まれない）ため、coordinator から呼び出し可能。hook変更不要。
---

## 6. Magic Numbers / 暗黙の制約

### hooks/ 内の定数値

| 定数 | 値 | ファイル | 行番号 | 用途 |
|------|---|---------|--------|------|
| THRESHOLD | 30 | context-watchdog.js | L6 | ツール呼び出し30回ごとに記憶リフレッシュ注入 |
| REREAD_LIMIT | 3 | context-watchdog.js | L7 | 同一ファイル3回読み込みで警告 |
| EDIT_THRESHOLD | 10 | context-watchdog.js | L8 | Write/Edit 10回ごとにチェックポイント確認 |
| CHECKPOINT_MAX_AGE_MS | 600000 (10min) | context-watchdog.js | L9 | チェックポイント有効期限 |
| MAX_EDITS_IN_WINDOW | 5 | loop-detector.js | L7 | 5分間に同一ファイル5回編集でブロック |
| WINDOW_MS | 300000 (5min) | loop-detector.js | L8 | ループ検出ウィンドウ |
| MARKER_STALE_MS | 1800000 (30min) | session-boundary.js | L6 | ハンドオフ再注入の間隔 |
| findProjectRoot loop | 10 (max) | hook-utils.js | L7 | プロジェクトルート検索の最大遡上階層数 |

### registry.ts 内の定数値

| 定数 | 値 | 行番号 | 用途 |
|------|---|--------|------|
| SIZE_MINLINES_FACTOR.small | 0.6 | L101 | smallタスクの最小行数係数 |
| SIZE_MINLINES_FACTOR.medium/large | 1.0 | L102-L103 | medium/largeの最小行数係数 |
| getPhaseConfig min | 20 | L150 | minLines下限値 |
| completed stage | 99 | L56 | 完了フェーズのステージ番号 |

### テンプレート内の定数値

| 定数 | 値 | ファイル | 用途 |
|------|---|---------|------|
| Serena --limit | 100 | defs-stage1.ts L33,L47 | search/referencing結果上限 |
| Serena --limit | 50 | defs-stage1.ts L38 | find_symbol結果上限 |
| 安全上限hop | 10 | defs-stage1.ts L50 | 依存追跡の最大ホップ数 |
| 安全上限hop | 15 | defs-stage1.ts L133 | impact_analysisの最大ホップ数 |
| harness_set_scope max | 100 | defs-stage1.ts L82 | スコープファイル上限 |

### 環境変数によるオーバーライド

| 変数 | ファイル | 行番号 | 用途 |
|------|---------|--------|------|
| TOOL_GUARD_DISABLE=true | pre-tool-guard.sh | L21 | 全チェックバイパス |
| HARNESS_LAYER | tool-gate.js | L17 | 層判定オーバーライド |
| HARNESS_DEBUG | tool-gate.js | L187 | デバッグログ出力 |

---

## decisions

- RD-01: vscode-ext/ はランタイム依存ゼロ。STRUCTURE_REPORT.md の2箇所のみ修正で安全に削除可能
- RD-02: hookバックアップ4ファイルは他ファイルから参照なし。削除安全
- RD-03: hook-utils.js は全5hookファイルから利用されている共通モジュール。変更対象外
- RD-04: dodChecks配列は全31フェーズで空。型定義(DoDCheck)は整っており、hearing用チェック追加が可能
- RD-05: tool-gate.js L48-L56 により、coordinator は harness_get_subphase_template を既に呼び出し可能。hook変更不要
- RD-06: Serena CLIは scope_definition と impact_analysis のみ統合済み。research/test_design への拡大はテンプレート追記で対応可能
- RD-07: defs-stage3.ts が scope-analysis で言及漏れ。design_review, test_design, test_selection を含む（130行）
- RD-08: test-guard.sh (263行) は200行制限を超過。本タスクのスコープ外（テストファイル）

## artifacts

- docs/workflows/workflow-harness-refactoring/research-analysis.md: 本分析結果

## next

- requirementsフェーズで AC-N / RTM F-NNN を定義
- 実装優先度: SD-01(vscode-ext削除) + SD-03(hookバックアップ削除) -> SD-02(STRUCTURE_REPORT修正) -> SD-04(スキルドキュメント更新) -> SD-05(hearing DoD追加) -> SD-06(Serena CLI統合)