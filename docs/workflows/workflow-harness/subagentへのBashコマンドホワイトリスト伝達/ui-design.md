# UI設計書: subagentへのBashコマンドホワイトリスト伝達

## サマリー

本タスクはコードを実装しないドキュメント変更タスクだが、subagentに表示されるCLIインターフェース（テンプレート内のBashコマンド制限セクション）、フックのエラーメッセージ、workflow_statusのAPIレスポンス活用、CLAUDE.mdのマッピング表フォーマットという4つのUI設計観点が存在する。

第一の設計観点はsubagent起動テンプレートに追加する「Bashコマンド制限」セクションの表示形式である。現在の「成果物品質要件の具体ルール」と同じ★重要★マーカーを使用し、許可カテゴリの列挙、カテゴリ別コマンド一覧、注意書きの3つのブロックで構成する。初回テンプレートでは詳細な説明を、リトライテンプレートでは簡潔な再確認メッセージを表示する差別化を行う。

第二の設計観点はフックがBashコマンドをブロックした際のエラーメッセージである。現在の「コマンドチェーン違反」という抽象的なメッセージから、「フェーズ名とBashカテゴリの不一致によるブロック」という具体的な原因を示すメッセージに改善する。ただしフックのコード変更は本タスクの範囲外のため、メッセージ改善案の提示にとどめる。

第三の設計観点はworkflow_statusのAPIレスポンスに含まれるphaseGuide.allowedBashCategoriesの活用である。Orchestratorはこのフィールドから現在フェーズで許可されているカテゴリ一覧を取得し、テンプレートのプレースホルダーに埋め込む。これにより動的にフェーズに応じた制限情報をsubagentに伝達できる。

第四の設計観点はCLAUDE.mdに追加するフェーズ別許可カテゴリマッピング表のフォーマットである。Markdown表形式で、フェーズ名、許可カテゴリ、カテゴリの用途説明の3列で構成する。18フェーズとサブフェーズの全てをリストアップし、subagentとOrchestratorの両方が参照できる統一マスターデータとする。

これらの設計により、subagentは実行可能なBashコマンドの範囲を事前に把握でき、フックのブロックを回避できる。また、ブロックが発生した場合も明確な原因が提示されるため、修正が容易になる。

## CLIインターフェース設計

subagentに渡すテンプレートのBashコマンド制限表示、フックのエラーメッセージ改善、テンプレート内での視覚的優先度づけを設計する。
初回テンプレートでは詳細な制限情報を提供し、リトライテンプレートでは簡潔な再確認メッセージに短縮する方針とする。
テンプレート内のセクション配置は「成果物品質要件」の直後とし、品質制約とコマンド制約を連続して提示することでsubagentの認識漏れを防止する。
★重要★マーカーの使用により、成果物品質要件と同等の重要性を持つ制約としてsubagentに認識させる。
以下にテンプレートの具体的な設計内容を示す。

### subagent起動テンプレートのBashコマンド制限セクション

subagentに渡されるpromptテンプレートに「★重要★ Bashコマンド制限」セクションを追加する。成果物品質要件セクションと同じレベルの重要度を示す★マーカーを使用し、視覚的に目立たせる。

#### 初回テンプレート用セクション（詳細版）

```
★重要★ Bashコマンド制限

このフェーズで許可されているBashコマンドカテゴリ: {allowedCategories}

カテゴリ別コマンド一覧:
- readonly: ls, pwd, cat, head, tail, grep, find, wc, git status, git log, git diff, git show, npm list, node --version, npm --version
- testing: npm test, npm run test, npx vitest, npx jest, npx playwright test, pytest
- implementation: npm install, pnpm add, npm run build, mkdir, rm, git add, git commit
- git: git add, git commit, git push, git status, git diff, git log
- deploy: docker, kubectl, docker-compose, helm

上記カテゴリ以外のBashコマンドを実行すると「コマンドチェーン違反」でブロックされます。
ファイル操作（cp, mv, cat等）は極力避け、Read/Write/Editツールを優先してください。
```

プレースホルダー `{allowedCategories}` には、Orchestratorがworkflow_statusのphaseGuide.allowedBashCategoriesから取得したカテゴリ一覧をカンマ区切りで埋め込む（例: "readonly, testing"）。

カテゴリ別コマンド一覧はCLAUDE.mdの「Bashコマンドカテゴリの定義」セクション（353-365行）と完全に一致させる。これにより、subagentとメインのCLaudeが参照する情報の一貫性を保証する。

注意書きには2つのポイントを含める。第一にブロックされる条件の明確化、第二にファイル操作ツール優先の原則である。特にcp, mv, catなどのファイル操作コマンドは多くのフェーズで禁止されているため、代替手段（Read/Write/Edit）の使用を促す。

#### リトライテンプレート用セクション（簡潔版）

```
Bashコマンド制限（再確認）

許可カテゴリ: {allowedCategories}
上記以外のBashコマンドは「コマンドチェーン違反」でブロックされます。
Read/Write/Editツールを優先使用してください。
```

リトライ時には初回テンプレートの約15行に対し、3行の簡潔なメッセージに短縮する。subagentは既に初回で詳細な説明を受けているため、再確認として最小限の情報を提示すれば十分である。

カテゴリ別コマンド一覧は省略し、許可カテゴリ名とブロック警告のみを記載する。これによりテンプレート全体の肥大化を防ぎ、コンテキスト効率を維持する。

### セクション配置位置

初回テンプレートでは「成果物品質要件の具体ルール」セクション直後（CLAUDE.md 215行目付近）に挿入する。これにより、品質要件とコマンド制限という2つの制約事項が連続して提示され、subagentの認識漏れを防ぐ。

リトライテンプレートでは「成果物品質要件（再確認）」セクション直後（CLAUDE.md 278行目付近）に挿入する。品質要件とコマンド制限の配置順序を初回と揃えることで、subagentの学習パターンを統一する。

### 視覚的な差別化

★重要★マーカーは成果物品質要件と同じレベルの重要度を示すために使用する。これにより、subagentは成果物品質とBashコマンド制限を同等の重要性を持つ制約として認識する。

カテゴリ別コマンド一覧は箇条書き形式で記述し、各カテゴリの具体的なコマンドを視覚的に識別しやすくする。readonly、testing、implementation等のカテゴリ名を太字やコロン区切りで強調することは避け、シンプルなハイフン区切り箇条書きとする（Markdownの過度な装飾はsubagentの解釈を複雑にするため）。

## エラーメッセージ設計

### 現在のフックエラーメッセージの課題

workflow-plugin/hooks/bash-whitelist.jsが出力する現在のエラーメッセージ「コマンドチェーン違反」は抽象的すぎて、subagentが原因を特定できない。どのコマンドがなぜブロックされたのか、どのカテゴリに属していないのかが不明である。

bash-whitelist.jsの148行目付近で生成される現在のメッセージは以下の形式である:

```
ブロック: コマンド '{command}' はコマンドチェーン '{chain}' に含まれており、
フェーズ '{phase}' では許可されていません。
```

このメッセージには「コマンドチェーン」という概念が含まれているが、subagentはこの概念を認識していない（CLAUDE.mdに説明がないため）。また、どのカテゴリに属するコマンドであれば許可されるのかの案内がない。

### 改善されたエラーメッセージ案

フックのエラーメッセージを以下の形式に改善することを提案する（本タスクではフックのコード変更は行わないため、将来の改善案として記録）:

```
Bashコマンド '{command}' がブロックされました。

原因: フェーズ '{phase}' ではカテゴリ '{detectedCategory}' のコマンドは許可されていません。
許可されているカテゴリ: {allowedCategories}

'{command}' はカテゴリ '{detectedCategory}' に分類されます。
このフェーズでは以下のカテゴリのコマンドのみ使用できます:
{allowedCategoriesDetail}

ファイル操作にはBashコマンドではなくRead/Write/Editツールを使用してください。
```

プレースホルダー `{command}` にはブロックされたコマンド名（例: "cp"）、`{phase}` には現在のフェーズ名（例: "requirements"）、`{detectedCategory}` にはコマンドが属するカテゴリ名（例: "file_operations"）を埋め込む。

プレースホルダー `{allowedCategories}` にはフェーズで許可されているカテゴリのカンマ区切りリスト（例: "readonly"）、`{allowedCategoriesDetail}` にはカテゴリ別コマンド一覧を箇条書きで埋め込む。

このメッセージにより、subagentは以下の情報を即座に把握できる:
- なぜブロックされたのか（カテゴリの不一致）
- どのカテゴリであれば許可されるのか
- 代替手段は何か（Read/Write/Editツール）

### エラーメッセージの段階的詳細化

初回ブロック時は上記の詳細メッセージを表示し、同一subagent内で2回目以降のブロックが発生した場合は簡潔版に切り替えることを検討する:

```
Bashコマンド '{command}' がブロックされました（カテゴリ '{detectedCategory}' は未許可）。
許可カテゴリ: {allowedCategories}
```

これにより、同じ誤りを繰り返すsubagentに対して冗長なメッセージを表示することを避け、コンテキスト効率を維持する。

### フック以外のエラーメッセージ（workflow_next時）

workflow_nextでフェーズ遷移する際、未完了のサブフェーズがある場合やレビュー未承認の場合のエラーメッセージも統一する。現在のMCPサーバーのエラーメッセージは簡潔だが、Bashコマンド制限に関する情報は含まれていない。

フェーズ遷移時のエラーメッセージにもBashコマンド制限の案内を追加することを検討する:

```
次フェーズ '{nextPhase}' に進むには、以下の条件を満たす必要があります:
- サブフェーズの完了: {incompleteSubPhases}
- レビュー承認: {pendingApprovals}

次フェーズで許可されるBashコマンドカテゴリ: {nextPhaseCategories}
```

これにより、subagentは次フェーズで使用可能なコマンドを事前に把握でき、フェーズ遷移後の作業を効率的に計画できる。

## APIレスポンス設計

### workflow_statusのphaseGuide活用

workflow-plugin/mcp-server/src/handlers/workflow-status.tsの80-95行付近で生成されるworkflow_statusレスポンスには、phaseGuideフィールドが含まれている（REQ-22で追加）。このフィールドのallowedBashCategoriesプロパティが、Orchestratorのテンプレートプレースホルダー埋め込みのデータソースとなる。

workflow_statusのレスポンス形式（抜粋）:

```
status: "active"
currentPhase: "test_impl"
phaseGuide:
  allowedBashCategories: "readonly", "testing"
  allowedFileTypes: ".test.ts", ".test.tsx", ".spec.ts"
  editTargetHint: "テストファイルの作成と実装"
  nextAction: "workflow_next"
```

Orchestratorはsubagent起動前にworkflow_statusを呼び出し、phaseGuide.allowedBashCategoriesを取得する。このカテゴリ一覧を文字列化（カンマ区切り）し、テンプレートの `{allowedCategories}` プレースホルダーに埋め込む。

### allowedBashCategoriesの文字列化ルール

workflow_statusが返すallowedBashCategoriesは配列形式である。Orchestratorはこれを以下のルールで文字列化する:

1. 配列要素をカンマ+スペース区切りで結合（例: "readonly, testing"）
2. カテゴリが1つの場合もカンマなしの単純文字列（例: "readonly"）
3. カテゴリが空配列の場合は "なし（Bashコマンド実行禁止）" と埋め込む

カテゴリが空配列のケースは、idleフェーズやcompletedフェーズなど、Bashコマンド実行が一切許可されないフェーズで発生する。この場合、テンプレートのBashコマンド制限セクションは以下のように表示される:

```
このフェーズで許可されているBashコマンドカテゴリ: なし（Bashコマンド実行禁止）
```

### phaseGuideの他のフィールドとの連携

phaseGuideにはallowedBashCategories以外にもallowedFileTypes、editTargetHint、nextActionのフィールドがある。これらをテンプレートに追加で埋め込むことも検討できる:

```
★重要★ フェーズガイド

編集可能ファイル種別: {allowedFileTypes}
編集対象のヒント: {editTargetHint}
許可されているBashコマンドカテゴリ: {allowedBashCategories}
次のアクション: {nextAction}
```

ただし、テンプレートが肥大化するとsubagentのコンテキスト効率が低下するため、まずはallowedBashCategoriesの埋め込みのみを実装し、他のフィールドは必要に応じて追加する段階的なアプローチを推奨する。

### workflow_statusのエラー時のフォールバック

workflow_status呼び出しがエラーになった場合（タスクが存在しない、MCPサーバーがダウンしている等）、Orchestratorはプレースホルダーを埋め込めない。この場合のフォールバック動作として、以下の2つの選択肢がある:

選択肢A: プレースホルダーを空文字列で埋め込む（テンプレート内のマッピング表を参照するようsubagentに促す）
選択肉B: プレースホルダーをデフォルト値（例: "readonly"）で埋め込む（最も制限的なカテゴリ）

推奨は選択肢Aである。CLAUDE.mdに追加するマッピング表をsubagentが参照できれば、workflow_statusが取得できなくてもフェーズ別の制限を把握できる。選択肢Bはデフォルト値が誤っている場合に不適切なコマンド実行を許可するリスクがあるため避ける。

### workflow_list, workflow_get_test_infoとの整合性

workflow_listやworkflow_get_test_infoなど他のMCPツールのレスポンスにもBashコマンド制限情報を含めるべきかを検討する。workflow_listは複数タスクの一覧を返すため、各タスクのcurrentPhaseに対応するallowedBashCategoriesを含めることができる:

```
tasks:
  - taskId: "..."
    taskName: "..."
    currentPhase: "test_impl"
    allowedBashCategories: "readonly", "testing"
```

ただし、これはMCPサーバーのコード変更を伴うため、本タスクの範囲外とする。将来的な拡張として記録しておく。

## 設定ファイル設計

### CLAUDE.mdのフェーズ別マッピング表フォーマット

CLAUDE.mdの164行付近（subagent起動テンプレートセクションの直前）に、フェーズ別許可カテゴリマッピング表を挿入する。このマッピング表はMarkdown表形式とし、以下の3列で構成する:

| フェーズ名 | 許可カテゴリ | カテゴリの用途説明 |

フェーズ名列には18フェーズとサブフェーズの全てをリストアップする（idle, research, requirements, parallel_analysis, threat_modeling, planning, parallel_design, state_machine, flowchart, ui_design, design_review, test_design, test_impl, implementation, refactoring, parallel_quality, build_check, code_review, testing, regression_test, parallel_verification, manual_test, security_scan, performance_test, e2e_test, docs_update, commit, push, ci_verification, deploy, completed）。

許可カテゴリ列にはworkflow-plugin/hooks/bash-whitelist.jsのgetWhitelistForPhase関数（213-255行）と完全に一致するカテゴリ一覧をカンマ区切りで記述する。

カテゴリの用途説明列には、各カテゴリが何のために許可されているかの簡潔な説明を記述する（例: "調査のため読み取りコマンドのみ許可"、"テスト実行のためtestingカテゴリ許可"）。

### マッピング表の具体例

```markdown
| フェーズ | 許可カテゴリ | 用途 |
|---------|-------------|------|
| idle | （なし） | タスク外のためBashコマンド実行禁止 |
| research | readonly | 既存コード・設定の調査のため読み取りコマンドのみ |
| requirements | readonly | 要件定義時の現状確認のため読み取りコマンドのみ |
| threat_modeling | readonly | 脅威分析のため読み取りコマンドのみ |
| planning | readonly | 計画策定のため読み取りコマンドのみ |
| state_machine | readonly | 状態遷移図作成のため読み取りコマンドのみ |
| flowchart | readonly | フローチャート作成のため読み取りコマンドのみ |
| ui_design | readonly | UI設計のため読み取りコマンドのみ |
| design_review | readonly | レビューのため読み取りコマンドのみ |
| test_design | readonly | テスト設計のため読み取りコマンドのみ |
| test_impl | readonly, testing, implementation | テストファイル作成とテスト実行のため |
| implementation | readonly, implementation | ソースコード実装とビルドのため |
| refactoring | readonly, implementation | コード改善とビルドのため |
| build_check | readonly, testing, implementation | ビルドエラー修正のため全カテゴリ許可 |
| code_review | readonly | コードレビューのため読み取りコマンドのみ |
| testing | readonly, testing | テスト実行のため |
| regression_test | readonly, testing | リグレッションテスト実行のため |
| manual_test | readonly | 手動テストのため読み取りコマンドのみ |
| security_scan | readonly, testing | セキュリティスキャン実行のため |
| performance_test | readonly, testing | パフォーマンス計測のため |
| e2e_test | readonly, testing | E2Eテスト実行のため |
| docs_update | readonly | ドキュメント更新のため読み取りコマンドのみ |
| commit | readonly, git | コミット作成のため |
| push | readonly, git | リモートプッシュのため |
| ci_verification | readonly | CI結果確認のため読み取りコマンドのみ |
| deploy | readonly, deploy | デプロイ実行のため |
| completed | （なし） | タスク完了後のためBashコマンド実行禁止 |
```

この表はworkflow-plugin/hooks/bash-whitelist.jsのgetWhitelistForPhase関数と完全に一致させる必要がある。不一致がある場合、フックのブロックとCLAUDE.mdの説明が矛盾し、subagentの混乱を招く。

### マッピング表の配置位置と見出し

マッピング表は「subagentによるフェーズ実行」セクション内の「フェーズ別subagent設定」表の直後に配置する。見出しは以下の形式とする:

```markdown
### フェーズ別Bashコマンド許可カテゴリ

Orchestratorがsubagent起動時にテンプレートに埋め込む許可カテゴリは、以下のマッピングに基づきます。
subagentも必要に応じてこの表を参照できます。

| フェーズ | 許可カテゴリ | 用途 |
|---------|-------------|------|
（上記の表を挿入）
```

この見出しにより、マッピング表の目的（Orchestratorのテンプレート埋め込み用）とsubagentの参照可能性（フォールバック用）が明確になる。

### マッピング表のメンテナンス性

フェーズ定義が追加・変更された場合、以下の3箇所を同期して更新する必要がある:

1. workflow-plugin/hooks/bash-whitelist.jsのgetWhitelistForPhase関数
2. CLAUDE.mdのフェーズ別マッピング表
3. workflow-plugin/mcp-server/src/phases/definitions.tsのPHASES定義

これらの一貫性を保つため、将来的にはbash-whitelist.jsからマッピング表をJSON形式でエクスポートし、CLAUDE.mdのMarkdown表を自動生成するスクリプトを検討する。ただし、本タスクでは手動でのマッピング表作成とする。

### カテゴリ定義セクションとの整合性

CLAUDE.md 353-365行の「Bashコマンドカテゴリの定義」セクションは、カテゴリ別コマンド一覧を定義している。マッピング表の「許可カテゴリ」列に記載されるカテゴリ名は、この定義セクションのカテゴリ名と完全に一致させる必要がある。

現在のカテゴリ定義セクションで定義されているカテゴリは以下の5つである:

- readonly（読み取り専用操作）
- testing（テスト実行）
- implementation（ビルド・セットアップ）
- git（git操作、定義セクションには明示的な見出しなし）
- deploy（デプロイ操作、定義セクションには明示的な見出しなし）

bash-whitelist.jsのCOMMAND_CATEGORIESオブジェクト（17-146行）で定義されているカテゴリとの対応を確認し、CLAUDE.mdのカテゴリ定義セクションを拡張する必要がある場合は、別タスクとして対応する（本タスクではCLAUDE.mdの既存カテゴリ定義を変更しない）。

### マッピング表の並び順

マッピング表のフェーズ並び順は、ワークフローの実行順序に従う:

idle → research → requirements → parallel_analysis（threat_modeling, planning） → parallel_design（state_machine, flowchart, ui_design） → design_review → test_design → test_impl → implementation → refactoring → parallel_quality（build_check, code_review） → testing → regression_test → parallel_verification（manual_test, security_scan, performance_test, e2e_test） → docs_update → commit → push → ci_verification → deploy → completed

並列フェーズ内のサブフェーズは、親フェーズの直後にインデントなしで列挙する。これにより、subagentは自身のフェーズが並列フェーズのサブフェーズであることを認識できる。

## 追加のUI設計考慮事項

### プレースホルダー未置換時の表示

Orchestratorがworkflow_statusの取得に失敗した場合、テンプレートのプレースホルダー `{allowedCategories}` が未置換のまま残る可能性がある。subagentがこの未置換プレースホルダーをそのまま解釈するとエラーとなる。

未置換検出のため、プレースホルダーの前後に案内文を追加することを検討する:

```
このフェーズで許可されているBashコマンドカテゴリ: {allowedCategories}
（上記が未置換の場合は、CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」表を参照してください）
```

これにより、subagentは未置換プレースホルダーを検出した場合の代替手段（CLAUDE.mdのマッピング表参照）を認識できる。

### カテゴリ名の日本語化検討

現在のカテゴリ名（readonly, testing, implementation, git, deploy）は英語である。CLAUDE.mdは日本語ドキュメントであるため、カテゴリ名を日本語化することも検討できる:

- readonly → 読み取り専用
- testing → テスト実行
- implementation → ビルド・実装
- git → Git操作
- deploy → デプロイ

ただし、bash-whitelist.jsのCOMMAND_CATEGORIESオブジェクトのキー名は英語であるため、日本語化するとコードとドキュメントの対応が複雑になる。本タスクでは英語カテゴリ名のまま使用し、日本語化は将来的な検討課題とする。

### エラーメッセージの多言語対応

現在のエラーメッセージは日本語で記述されているが、将来的にCLAUDE.mdが英語化される場合、エラーメッセージも英語化する必要がある。エラーメッセージのテンプレート化（i18n対応）を検討する:

```typescript
const ERROR_MESSAGES = {
  ja: {
    commandBlocked: "Bashコマンド '{command}' がブロックされました。",
    reasonCategoryMismatch: "原因: フェーズ '{phase}' ではカテゴリ '{detectedCategory}' のコマンドは許可されていません。"
  },
  en: {
    commandBlocked: "Bash command '{command}' was blocked.",
    reasonCategoryMismatch: "Reason: Category '{detectedCategory}' is not allowed in phase '{phase}'."
  }
};
```

本タスクではフックのコード変更は行わないため、多言語対応は将来的な拡張として記録しておく。

### テンプレートの肥大化対策

subagent起動テンプレートにBashコマンド制限セクションを追加することで、テンプレート全体の行数が増加する（約15行の追加）。テンプレートが肥大化するとsubagentのコンテキスト効率が低下するため、以下の対策を検討する:

対策A: リトライテンプレートでは簡潔版に短縮（3行程度）
対策B: カテゴリ別コマンド一覧を初回のみ表示し、2回目以降は省略
対策C: CLAUDE.mdのカテゴリ定義セクションへの参照リンクで代替

本タスクでは対策Aを採用する。初回テンプレートでは詳細な説明を提供し、リトライテンプレートでは最小限の情報に絞ることで、バランスを取る。

### フックのブロックログ出力

bash-whitelist.jsがBashコマンドをブロックした際、ブロック履歴をログファイルに記録することを検討する。ログには以下の情報を含める:

- タイムスタンプ
- タスクID
- フェーズ名
- ブロックされたコマンド
- コマンドが属するカテゴリ
- subagentのタスクID（Task toolのtaskId）

ログファイルは `.claude/state/bash-whitelist-blocks.log` に保存し、Orchestratorがsubagentのブロック履歴を分析できるようにする。ただし、本タスクではフックのコード変更は行わないため、ログ出力は将来的な拡張として記録しておく。

## 実装時の注意事項

### CLAUDE.mdのMarkdown構文

CLAUDE.mdに追加する表はMarkdown形式の標準的なテーブル構文を使用する。GitHub Flavored Markdown（GFM）のテーブル拡張機能に依存しないようにする:

```markdown
| フェーズ | 許可カテゴリ | 用途 |
|---------|-------------|------|
| idle | （なし） | 説明 |
```

テーブルの列揃え（左寄せ、中央寄せ、右寄せ）は使用せず、デフォルトの左寄せのみとする。これにより、Markdown解析の互換性を維持する。

### テンプレート内のMarkdown表示

subagent起動テンプレートはプレーンテキストとしてsubagentに渡されるため、Markdownの装飾（太字、リンク等）はレンダリングされない。subagentはMarkdown記号をそのまま解釈する能力があるが、過度な装飾は避ける。

箇条書きは `-` （ハイフン）のみを使用し、`*`（アスタリスク）や番号付きリストは使用しない。これにより、テンプレートの視覚的な一貫性を保つ。

### プレースホルダーの命名規則

テンプレート内のプレースホルダーは波括弧 `{}` で囲む。プレースホルダー名はキャメルケースとし、意味が明確な名前を使用する:

- `{allowedCategories}`: 許可カテゴリのカンマ区切りリスト
- `{allowedFileTypes}`: 許可ファイル種別（将来的な拡張用）
- `{editTargetHint}`: 編集対象のヒント（将来的な拡張用）

プレースホルダー名は大文字小文字を区別するため、Orchestratorの埋め込み処理で正確に一致させる必要がある。

### カテゴリ別コマンド一覧の更新手順

bash-whitelist.jsのCOMMAND_CATEGORIESオブジェクトが更新された場合、CLAUDE.mdの以下の3箇所を同期して更新する:

1. 353-365行の「Bashコマンドカテゴリの定義」セクション
2. subagent起動テンプレートのBashコマンド制限セクション内のカテゴリ別コマンド一覧
3. フェーズ別Bashコマンド許可カテゴリマッピング表の「許可カテゴリ」列

更新漏れを防ぐため、COMMAND_CATEGORIESの変更時にはCLAUDE.mdの全箇所をGrep検索して確認する手順をドキュメント化する（将来的な運用ガイドとして）。
