# workflow_nextレスポンスにphaseGuide追加 - 調査結果

## サマリー

workflow_nextおよびworkflow_statusのレスポンスにsubagent向けphaseGuide情報を追加する改修の調査を完了した。
現在subagentのprompt構築に必要な情報は5つのファイルに分散しており、Orchestratorが記憶ベースで組み立てている。
この構造がsubagentへの指示欠落の根本原因であり、MCP serverから構造化情報を返す方式で解決する。
改修方針として、workflow_nextレスポンスにphaseGuideフィールドを追加し、確定的な制約情報をコードから提供する。
加えてCLAUDE.mdのOrchestrator手順にLayer2の事後検証とLayer3の自動修正手順を追記する。

## 調査結果

### workflow_nextの現在のレスポンス構造（next.ts）

レスポンスフィールドはsuccess、taskId、from、to、description、message、workflow_contextで構成される。
descriptionフィールドにはPHASE_DESCRIPTIONSから取得した1行の日本語説明が含まれるのみ。
workflow_contextにはworkflowDir、phase、currentPhaseが含まれるが、フェーズ固有のガイド情報はない。

### workflow_statusの現在のレスポンス構造（status.ts）

success、status、taskId、taskName、phase、workflowDir、docsDir、activeTasks、allTasks、message、taskSize、userIntent、activePhases等を返す。
docsDirフィールドで成果物出力先ディレクトリを提供している。
並列フェーズの場合subPhasesオブジェクトが追加されるが、各サブフェーズのガイド情報は含まれない。

### phaseGuide情報の分散状況

フェーズ説明はdefinitions.tsのPHASE_DESCRIPTIONSで定義されている。
必須セクションはartifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSで各成果物のminLinesとrequiredSectionsとして定義されている。
編集可能ファイルはphase-definitions.jsのPHASE_RULESでallow/deny方式で定義されている。
Bashコマンド許可はbash-whitelist.jsのBASH_WHITELISTでカテゴリ別に定義されている。
入出力ファイル関係はCLAUDE.mdのテーブルにのみ記載されており、コードには定義されていない。

### artifact-validatorの必須セクション詳細

各成果物に対してminLinesとrequiredSectionsが定義されている。requiredSectionsは日本語と英語のペアで多言語対応。
対象成果物はresearch.md、requirements.md、spec.md、test-design.md、threat-model.md、ui-design.md、code-review.md、manual-test.md、security-scan.md、performance-test.md、e2e-test.mdの11種類。

### bash-whitelistのカテゴリ構造

readonlyカテゴリにはls、cat、grep、git status、git diff等の読み取り専用コマンドが含まれる。
testingカテゴリにはnpm test、npx vitest、npx jest等のテスト実行コマンドが含まれる。
implementationカテゴリにはnpm install、npm run build、mkdir等のビルド関連コマンドが含まれる。
gitカテゴリにはgit add、git commit、git push、rm -fが含まれる。
フェーズごとにカテゴリの組み合わせで許可コマンドを決定し、BASH_BLACKLISTで危険パターンを全フェーズ共通で拒否する。

### phase-edit-guardの制御構造

PHASE_RULESでファイルタイプごとのallow/denyリストを定義している。
ファイルタイプはcode、test、.md、config等の抽象カテゴリで分類される。

## 既存実装の分析

### 情報統合の阻害要因

phaseGuide情報がMCP server内部（definitions.ts、artifact-validator.ts）とhooks側（bash-whitelist.js、phase-definitions.js）に分かれている。
MCP serverプロセスとhooksプロセスは別プロセスで動作するため、hooks側の定義をMCP serverから直接参照することは不可能。
解決策として、MCP server側にPHASE_GUIDESマスター定義を新設し、hooks側の情報を重複定義する。

### 入出力ファイル関係のコード化

現在CLAUDE.mdにのみ記載されている入出力ファイル関係をPHASE_GUIDESに含める必要がある。
各フェーズの入力ファイルはdocsDir配下の前フェーズ成果物であり、パスはtaskNameとdocsDirから動的に構築可能。
出力ファイルも同様にdocsDir配下に配置されるため、docsDirとフェーズ名から一意に決定できる。

### 実装方針

definitions.tsにPHASE_GUIDESマスター定義を追加する。
types.tsにPhaseGuide型を定義しNextResultおよびStatusResultの型を拡張する。
next.tsのレスポンス構築部分でphaseGuideフィールドを追加する。
status.tsのレスポンス構築部分でもphaseGuideフィールドを追加する。
CLAUDE.mdのsubagent起動テンプレートにphaseGuideの参照手順を追記する。

### 既存テストへの影響

57個のテストファイルが存在しvitestで実行される。
next.ts関連テストでレスポンス構造のアサーションが存在するため、phaseGuideフィールド追加に伴うテスト更新が必要。
status.ts関連テスト（status-context.test.ts）も同様に更新が必要。
