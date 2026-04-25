## サマリー

CLAUDE.mdのsubagent起動テンプレートにBashコマンド制限セクションを追加する実装計画を記述する。
現在テンプレートには「成果物品質要件の具体ルール」が記載されているが、Bashコマンドの許可情報は含まれていない。
同じパターンで「★重要★ Bashコマンド制限」セクションを追加し、フェーズ別の許可コマンドカテゴリをOrchestratorが埋め込む。
変更対象はCLAUDE.mdのみ。MCPサーバーやフックのコード変更は不要。
追加箇所は初回テンプレートとリトライテンプレートの2箇所、およびフェーズ別マッピング表の1箇所。

## 概要

subagentがBashコマンド実行時に「コマンドチェーン違反」でブロックされる問題を解決する。
根本原因は、CLAUDE.mdのsubagent起動テンプレートにフェーズ別のBashコマンド許可情報が含まれていないことにある。
bash-whitelist.js（workflow-plugin/hooks/bash-whitelist.js）には18フェーズ全ての許可コマンドマッピングが定義されているが、subagentにはこの情報が伝達されていない。
前回のルール21で追加した「成果物品質要件の具体ルール」と同じパターンで、テンプレートに「Bashコマンド制限」セクションを追加し、Orchestratorがフェーズに応じて許可カテゴリを埋め込む方式で対応する。
ソースコードの変更はなく、ドキュメント（CLAUDE.md）の修正のみで完結する。ただし参照先としてworkflow-plugin/hooks/bash-whitelist.jsのフェーズマッピング定義（getWhitelistForPhase関数）を正確に反映する。

## 実装計画

### 変更1: フェーズ別Bashコマンド許可カテゴリマッピング表の追加

CLAUDE.md 164行付近（「subagent起動テンプレート」セクションの直前）に、Orchestratorがsubagent起動時に参照するマッピング表を追加する。
このマッピング表はworkflow-plugin/hooks/bash-whitelist.jsのgetWhitelistForPhase関数（213-255行）と整合させる。
Orchestratorはworkflow_statusで取得したフェーズ名をこのマッピング表と照合し、該当する許可カテゴリ一覧をテンプレートのプレースホルダーに埋め込む。
マッピング表にはサブフェーズ（threat_modeling, planning, build_check等）も個別にリストアップし、subagentが自身のフェーズに対応するカテゴリを直接確認できるようにする。
これにより、プレースホルダー未置換時のフォールバックとしても機能する。

### 変更2: subagent起動テンプレートへの「Bashコマンド制限」セクション追加

CLAUDE.md 215行目（成果物品質要件セクションの直後）に「★重要★ Bashコマンド制限」セクションを挿入する。
セクションには許可カテゴリのプレースホルダー、カテゴリ別コマンド一覧（readonly/testing/implementation/git/deploy）、および注意書きを含める。
カテゴリ別コマンド一覧はCLAUDE.md既存の「Bashコマンドカテゴリの定義」セクション（353-365行）の内容と一致させる。
ファイル操作にはBashではなくRead/Write/Editツールを優先する旨の注意書きを必ず含める。

### 変更3: リトライテンプレートへの「Bashコマンド制限（再確認）」追加

CLAUDE.md 278行目（成果物品質要件（再確認）セクションの直後）に簡潔なBashコマンド制限再確認セクションを挿入する。
リトライ時には初回テンプレートよりも簡潔に、許可カテゴリとブロック警告のみを記載する。
これにより初回テンプレートの約15行に対し、リトライテンプレートでは約3行で済む。

## 変更対象ファイル

### CLAUDE.md（プロジェクトルート直下）

変更箇所は3箇所:

1. **164行付近（テンプレート直前）**: フェーズ別許可カテゴリマッピング表を挿入（約15行追加）
   - workflow-plugin/hooks/bash-whitelist.jsのgetWhitelistForPhase関数と整合するマッピング
   - 全18フェーズ+サブフェーズの許可カテゴリ定義

2. **215行目（初回テンプレート内、品質要件直後）**: 「★重要★ Bashコマンド制限」セクションを挿入（約15行追加）
   - 許可カテゴリプレースホルダー、カテゴリ別コマンド一覧、注意書き

3. **278行目（リトライテンプレート内、品質要件再確認直後）**: 「Bashコマンド制限（再確認）」セクションを挿入（約3行追加）
   - 許可カテゴリとブロック警告の簡潔な再確認

### 参照ファイル（変更なし、整合性確認用）

- workflow-plugin/hooks/bash-whitelist.js: フェーズ別マッピングの正確な定義元（src/内のフック実装）
- workflow-plugin/mcp-server/src/phases/definitions.ts: フェーズ名の正式定義

### 追加行数の見積もり

合計約33行の追加。既存のセクション構造は変更しない。

### 影響を受けるワークフローフェーズ

Bashコマンドを使用する可能性がある全フェーズのsubagentに影響する:
- build_check: ビルドエラー修正時にnpm install, npm run build等を実行
- testing/regression_test: テスト実行時にnpm test, npx vitest等を実行
- security_scan: npm auditやセキュリティスキャンツールを実行
- performance_test: パフォーマンス計測ツールを実行
- e2e_test: Playwrightやpytest等のE2Eテストフレームワークを実行
- commit/push: git add, git commit, git push等を実行
- implementation/refactoring: npm install, npm run build, mkdir等を実行
- deploy: docker, kubectl等のデプロイコマンドを実行

readonlyフェーズ（research, requirements等）のsubagentにも伝達するが、これらのフェーズではls, git status等の読み取りコマンドのみが許可されている旨を明示する。
