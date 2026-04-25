## サマリー

- 目的: ワークフロープラグインの3つのアーキテクチャ上の問題（並列サブフェーズの subagentTemplate 取得不能・requiredSections の二重管理・minLines の二重管理）を解消し、Orchestrator が正確なサブエージェントプロンプトを利用できる状態にする
- 評価スコープ: `workflow-plugin/mcp-server/src/tools/next.ts`, `status.ts`, `definitions.ts`, `artifact-validator.ts` の4ファイル
- 主要な決定事項:
  - FR-1: 新規 MCPツール `workflow_get_subphase_template` を追加し、サブフェーズ名を指定して `subagentTemplate` を個別取得できるようにする（選択肢A採用）
  - FR-2: `artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS.requiredSections` の各値に `## ` プレフィックスを付与して `definitions.ts` の形式に統一する
  - FR-3: `definitions.ts` の `PHASE_GUIDES.minLines` を正規の定義場所とし、`artifact-validator.ts` はその値を参照するように変更する
- 次フェーズで必要な情報: 上記3項目の具体的な実装計画・変更対象ファイルのスコープ・影響範囲の詳細

---

## 機能要件

### FR-1: 並列サブフェーズの subagentTemplate 取得 API 追加

#### FR-1-1: 新規 MCP ツールの追加

Orchestrator が並列フェーズ（`parallel_analysis`, `parallel_design`, `parallel_quality`, `parallel_verification`）に遷移した後、個々のサブフェーズの `subagentTemplate` を取得できる MCP ツールを新規追加する。

ツール名は `workflow_get_subphase_template` とする。このツールは以下の引数を受け取る。

- `taskId`: タスクID（文字列、省略可能）
- `subPhaseName`: サブフェーズ名（文字列、必須）。有効な値は `threat_modeling`, `planning`, `state_machine`, `flowchart`, `ui_design`, `build_check`, `code_review`, `manual_test`, `security_scan`, `performance_test`, `e2e_test` のいずれか

ツールの返値は以下の情報を含む。

- `subagentTemplate`: 指定されたサブフェーズの完全な `subagentTemplate` 文字列
- `phaseName`: サブフェーズ名
- `requiredSections`: 必須セクション一覧（配列）
- `minLines`: 最低行数要件（数値）
- `outputFile`: 成果物の出力先ファイルパス

#### FR-1-2: 認証要件

`workflow_get_subphase_template` は読み取り専用操作であるため、`sessionToken` による認証は不要とする。ただし `taskId` が省略された場合はアクティブなタスクを自動検索する既存の仕組みを流用する。

#### FR-1-3: 内部実装要件

ツール内部では `resolvePhaseGuide()` を呼び出して `subPhases[subPhaseName].subagentTemplate` を取得する。`definitions.ts` の行1547-1562 で各サブフェーズの `subagentTemplate` が `buildPrompt()` により動的生成されているため、この値を直接返す。

`slimSubPhaseGuide()` による削除は `workflow_next` と `workflow_status` のレスポンス構築時のみに限定し、新規ツールのレスポンスには削除を適用しない。

#### FR-1-4: MEMORY.md のルール整合性

MEMORY.md の「Orchestrator の subagentTemplate 使用ルール」には「`workflow_status` は `subagentTemplate` を返さない設計」と記載されている。新規ツール追加後は、この記述を「並列フェーズのサブフェーズテンプレートは `workflow_get_subphase_template` で取得すること」に更新する。

---

### FR-2: requiredSections の形式統一

#### FR-2-1: 統一方針の決定

`definitions.ts` の `PHASE_GUIDES` では `requiredSections` の各値に `## ` プレフィックスが付与されている（例: `'## テストシナリオ'`）。`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` では一部の値に `## ` プレフィックスがない（例: `'テストシナリオ'`）。

統一方針は `## ` プレフィックス付きを正規形式とし、`artifact-validator.ts` 側を修正する方向で統一する。この選択の根拠は次の通り。

- `buildPrompt()` でサブエージェントに対して `## セクション名` という形式でプロンプト指示が生成されており、この形式を変更すると多数の成果物に影響が出る
- サブエージェントは `## セクション名` の形式で見出しを書くよう指示されているため、成果物側の形式が先に確立されている
- `artifact-validator.ts` 側の修正は検証ロジックの変更のみで済み、サブエージェントの動作や既存成果物への影響がない

#### FR-2-2: 修正対象の値

`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` において、`## ` プレフィックスがない値は以下の通り。

- `'manual-test.md'` の `requiredSections`: `'テストシナリオ'` と `'テスト結果'` を `'## テストシナリオ'` と `'## テスト結果'` に変更する
- `'security-scan.md'` の `requiredSections`: `'脆弱性スキャン結果'` と `'検出された問題'` を `'## 脆弱性スキャン結果'` と `'## 検出された問題'` に変更する
- `'threat-model.md'` の `requiredSections`: `'## 脅威'` と `'## リスク'` のプレフィックスは付いているが、`definitions.ts` の `threat_modeling` フェーズの定義（`'## 脅威シナリオ'`, `'## リスク評価'`）とセクション名が異なるため、一致するよう修正する

#### FR-2-3: 検証ロジックの維持

`validateRequiredSections()` の `content.includes(section)` によるマッチング方式はそのまま維持する。`## ` プレフィックスを付与した場合でも `includes()` による部分一致は機能するため、既存成果物との後方互換性が保たれる。

---

### FR-3: minLines の二重管理解消

#### FR-3-1: 正規の定義場所の決定

`minLines` の正規の定義場所を `definitions.ts` の `PHASE_GUIDES` とする。この選択の根拠は次の通り。

- `PHASE_GUIDES.minLines` はサブエージェントへのプロンプト内で行数要件として伝達されており、ユーザーが目にする数値と一致することが重要である
- `definitions.ts` はフェーズ定義の中心ファイルであり、全フェーズの設定を一元管理している
- `artifact-validator.ts` は検証ツールとして機能すべきであり、設定値は外部から注入される設計が望ましい

#### FR-3-2: artifact-validator.ts の変更方針

`artifact-validator.ts` の `checkPhaseArtifacts()` 関数（`next.ts` から呼び出される）が `minLines` を参照する際、`PHASE_ARTIFACT_REQUIREMENTS` の値ではなく `PHASE_GUIDES` から取得した値を優先的に使用するように変更する。

具体的には、`PHASE_ARTIFACT_REQUIREMENTS` の各エントリに `minLines` プロパティを維持しつつ、フェーズガイドが提供する値で上書きする仕組みを実装する。または `artifact-validator.ts` が `PHASE_GUIDES` を直接 import して参照する構造に変更する。

#### FR-3-3: minLines の値の確定

現在 `PHASE_GUIDES` と `PHASE_ARTIFACT_REQUIREMENTS` で異なる値が設定されているケースがある。`research.md` の場合、`PHASE_GUIDES` は 50 行を要求し、`PHASE_ARTIFACT_REQUIREMENTS` は 20 行を要求している。この不一致は `PHASE_GUIDES` の値（50 行）を正とし、バリデーション時にも 50 行が要求されるよう統一する。

各フェーズの確定値は `definitions.ts` の `PHASE_GUIDES[phase].minLines` の値を採用する。

---

## 非機能要件

### NFR-1: 後方互換性

既存の `workflow_next`, `workflow_status`, `workflow_complete_sub` などの MCP ツールの API シグネチャを変更しない。新規ツール `workflow_get_subphase_template` の追加は既存ツールに影響を与えない形で実施する。

### NFR-2: レスポンスサイズの制御

`workflow_next` と `workflow_status` のレスポンスに対する `slimSubPhaseGuide()` の削除処理はそのまま維持する。レスポンスサイズの増大を防ぐため、`subagentTemplate` の取得は新規ツールへのオプトイン方式とする。

### NFR-3: 型安全性

新規ツール `workflow_get_subphase_template` の実装において TypeScript の型定義を適切に整備する。引数の `subPhaseName` には有効なサブフェーズ名のみを受け付けるよう、型または実行時バリデーションを実装する。

### NFR-4: MCPサーバー再起動要件

`definitions.ts`, `artifact-validator.ts` はコアモジュールであり、これらを変更した場合は必ず MCP サーバーを再起動してから動作確認を行う。CLAUDE.md のルール22に従い、変更後は `npm run build` でトランスパイルし、サーバーを再起動する。

### NFR-5: テスト要件

実装後は既存のテストスイートが全て通過することを確認する。新規ツール `workflow_get_subphase_template` に対しては、ユニットテストを `workflow-plugin/mcp-server/src/` 以下に追加する。

### NFR-6: MEMORY.md との整合性

本改善により MEMORY.md の記述が古くなる箇所が発生する。docs_update フェーズでは以下の記述を更新する。

- 「workflow_status は subagentTemplate を含まないため、テンプレートの取得源として使用できない」の箇所に、並列フェーズのサブフェーズテンプレートは `workflow_get_subphase_template` で取得できる旨を追記する
- 既存の「Orchestrator の subagentTemplate 使用ルール」における `workflow_next` レスポンスからの取得手順は非並列フェーズに限定する旨を明記する
