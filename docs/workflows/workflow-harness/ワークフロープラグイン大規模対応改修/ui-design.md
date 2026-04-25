# UI設計書: ワークフロープラグイン大規模対応改修

## サマリー

本UI設計書はワークフロープラグインの11件の改修要件に対応するCLI出力メッセージとエラーハンドリングの詳細設計である。
プラグインはGUIを持たないMCP ServerとHooksシステムで構成されるため、UIはJSON形式レスポンスとユーザーフレンドリーなテキストメッセージで実現される。
主要な設計決定事項として、全てのエラーメッセージには一意のエラーコード（形式: ERR-[カテゴリ][連番]）を付与し、問題内容・原因・解決策の3点セットで構成する。
承認ゲート拡充に伴うrequirements承認メッセージは「✓ requirements承認完了」の成功表示と未承認時のガイダンスで一貫性を保つ。
意味的整合性チェックの検証結果は警告レベル（不足キーワード数）と修正対象ファイルを明示し、AIエージェントが自己修正可能な情報を提供する。
動的フェーズスキップ通知はスキップ理由とスキップ対象フェーズのリストをマークダウンテーブル形式で表示し、ユーザーがタスク進行を把握できるようにする。
段階的リカバリのガイダンスメッセージは差し戻し先フェーズ・理由・バックアップディレクトリパス・次の作業内容を含む4要素構成とする。
bashバイパス検出のエラーメッセージは検出されたエンコード手法または間接実行手法を具体的に示し、セキュリティ脅威の種別を明確化する。
HMACキー不一致エラーはフォールバック検証で使用した世代数と最終確認時刻を表示し、鍵ローテーション問題の診断を支援する。
テスト真正性検証のログは実行時間（ミリ秒精度）とSHA-256ハッシュの先頭8文字を記録し、監査証跡として機能する。
重複行検出改善後のエラーメッセージはコードブロックとテーブル行の除外処理を明示し、誤検知の原因を説明する。
次フェーズのtest_implでは本UI設計に基づく各メッセージフォーマットの出力処理をTypeScriptで実装し、ユーザビリティテストで表現の自然さを検証する必要がある。

## 目的

本UI設計書は以下の3つの目的を達成するために作成される。

第一の目的はワークフロープラグインの11件の改修要件（REQ-B1からREQ-D3まで）で追加される機能に対応するCLI出力メッセージの統一フォーマットを定義することである。
現状のプラグインはMCP Serverの15個のツールがそれぞれ独自のメッセージ形式を持っており、エラーコードの体系化とメッセージの一貫性が不足している。
本設計では全てのメッセージに一意の識別子を付与し、問題の内容・原因・解決策を明確に伝える3点セット形式を標準化する。

第二の目的は大規模AI駆動開発における自己診断可能性を向上させることである。
Claude等のAIエージェントがワークフロー実行中にエラーに遭遇した際、エラーメッセージから問題の根本原因を特定し、適切な修正アクションを自動的に選択できる必要がある。
本設計ではエラーメッセージに構造化された情報（エラーコード・影響範囲・推奨アクション・関連コマンド）を含め、AIが解釈可能な形式とする。

第三の目的は人間ユーザーとAIエージェントの両方にとって読みやすいハイブリッドな出力形式を実現することである。
JSON形式の構造化レスポンスはプログラムからの解析を容易にし、Markdown形式の人間可読メッセージは視認性と理解性を高める。
本設計では各ツールのレスポンスにJSON構造とMarkdown本文の両方を含め、受信者のタイプに応じた情報抽出を可能にする。

## 対象範囲

本UI設計の対象範囲はMCP Server側とHooks側の出力メッセージ全体をカバーする。

MCP Server側の対象コンポーネントは6つのツール（workflow_approve/workflow_next/workflow_back/workflow_reset/workflow_set_scope/workflow_record_test_result）である。
これらのツールは改修要件で機能追加または変更が発生し、新規メッセージまたはメッセージ形式の見直しが必要となる。
具体的にはworkflow_approveのrequirements承認メッセージ、workflow_nextの動的スキップ通知、workflow_backのリカバリガイダンス、workflow_record_test_resultのテスト真正性検証ログが設計対象となる。

MCP Server側のもう一つの対象コンポーネントは3つのバリデーター（artifact-validator/test-authenticity/scope-validator）である。
これらのバリデーターはvalidateArtifacts/validateTestExecutionTime/isWithinScope等の関数を提供し、ValidationResult型の戻り値を返却する。
ValidationResult型のerrors配列とwarnings配列に格納される各エラーオブジェクトのメッセージ形式が設計対象となる。

Hooks側の対象コンポーネントは2つのモジュール（bash-whitelist.js/hmac-verify.js）である。
bash-whitelist.jsはBashコマンドのホワイトリスト検証でブロック時にコンソールエラー出力とプロセス終了を実施する。
hmac-verify.jsはHMAC署名検証失敗時にコンソールエラー出力とプロセス終了を実施する。
これらのエラーメッセージは標準エラー出力に出力され、Claude Codeのターミナルペインに表示されるため、視認性と理解性が重要である。

対象外となるのはworkflow_status/workflow_list/workflow_get_test_info等の参照系ツールである。
これらのツールは改修要件で機能変更がなく、既存のメッセージ形式を維持する。
ただしworkflow_statusはREQ-C3の動的スキップ機構によりスキップされたフェーズ情報を追加表示する必要があり、部分的に設計対象に含まれる。

## CLIインターフェース設計

本プラグインはCLIベースのMCPツールとして動作し、全ての出力はJSON形式のMCPレスポンスとして返却される。
ユーザーインターフェースの主要要素はMCPツールの呼び出しコマンド（workflow_start/workflow_next/workflow_approve等）とそのレスポンスメッセージである。
各ツールは統一されたレスポンス形式（success/message/data構造）を採用し、AIエージェントとヒューマンユーザーの両方が解釈可能な形式とする。
エラーハンドリングは一貫したエラーコード体系に基づき、問題の内容・原因・解決策を明示的に提供する。
Hooksシステムはプロセス開始前のバリデーションを担当し、違反検出時は標準エラー出力にエラーメッセージを出力してプロセスを即座に終了する。
成功時の出力はMarkdown形式のメッセージと構造化されたJSONデータの組み合わせとし、視認性と解析性を両立させる。
ログ出力は標準出力に統一プレフィックス形式（[コンポーネント名] メッセージ）で出力し、デバッグモード時には詳細ログを追加出力する。

## エラーコード体系

本プラグインで使用される全てのエラーコードは以下の形式に従う。

エラーコードの形式は「ERR-[カテゴリ][連番]」とし、カテゴリは2文字の英大文字、連番は3桁のゼロ埋め数値とする。
カテゴリは問題の発生領域を示し、AP（承認・Approval）、SM（意味的整合性・Semantic）、PH（フェーズ制御・Phase）、RC（リカバリ・Recovery）、SH（シェルセキュリティ・Shell）、HM（HMAC検証・HMAC）、TS（テスト真正性・Test）、SC（スコープ検証・Scope）の8種類を定義する。
連番はカテゴリ内で一意な数値とし、001から開始して昇順に割り当てる。

具体的なエラーコード一覧を以下に示す。

| エラーコード | カテゴリ | 説明 | 発生コンポーネント |
|--------------|----------|------|-------------------|
| ERR-AP001 | 承認 | requirements承認が未実施 | workflow_next |
| ERR-AP002 | 承認 | 不正なフェーズでのrequirements承認試行 | workflow_approve |
| ERR-AP003 | 承認 | design承認が未実施 | workflow_next |
| ERR-AP004 | 承認 | test_design承認が未実施 | workflow_next |
| ERR-SM001 | 意味的整合性 | 要件キーワードがspec.mdに不足 | artifact-validator |
| ERR-SM002 | 意味的整合性 | 要件キーワードがtest-design.mdに不足 | artifact-validator |
| ERR-SM003 | 意味的整合性 | セキュリティ要件キーワードがthreat-model.mdに不足 | artifact-validator |
| ERR-PH001 | フェーズ制御 | サブフェーズ依存関係違反（planning前にthreat_modeling未完了） | workflow_complete_sub |
| ERR-PH002 | フェーズ制御 | スキップ対象フェーズへの不正な遷移試行 | workflow_next |
| ERR-RC001 | リカバリ | 差し戻し先フェーズが現在フェーズより後 | workflow_back |
| ERR-RC002 | リカバリ | バックアップディレクトリの作成失敗 | workflow_back |
| ERR-RC003 | リカバリ | 成果物ファイルの移動失敗 | workflow_back |
| ERR-SH001 | シェルセキュリティ | base64エンコードされたコマンドの実行検出 | bash-whitelist.js |
| ERR-SH002 | シェルセキュリティ | printf/echoによるエンコードコマンド実行検出 | bash-whitelist.js |
| ERR-SH003 | シェルセキュリティ | eval/exec間接実行の検出 | bash-whitelist.js |
| ERR-SH004 | シェルセキュリティ | sh/bash -c間接実行の検出 | bash-whitelist.js |
| ERR-SH005 | シェルセキュリティ | パイプ経由のシェル実行検出 | bash-whitelist.js |
| ERR-HM001 | HMAC検証 | 全世代のHMACキーで検証失敗 | hmac-verify.js |
| ERR-HM002 | HMAC検証 | HMACキーファイルの読み込み失敗 | hmac-verify.js |
| ERR-HM003 | HMAC検証 | HMACキーファイルのJSON形式エラー | hmac-verify.js |
| ERR-TS001 | テスト真正性 | テスト実行時間が異常に短い | test-authenticity |
| ERR-TS002 | テスト真正性 | テスト出力ハッシュの重複検出 | test-authenticity |
| ERR-SC001 | スコープ検証 | スコープ外ファイルの編集試行 | scope-validator |
| ERR-SC002 | スコープ検証 | スコープ設定が未実施 | scope-validator |

警告コードの形式は「WARN-[カテゴリ][連番]」とし、エラーコードと同様の体系を採用する。
警告はワークフロー実行を中断しないが、ユーザーまたはAIエージェントに注意喚起する必要がある情報を示す。

具体的な警告コード一覧を以下に示す。

| 警告コード | カテゴリ | 説明 | 発生コンポーネント |
|------------|----------|------|-------------------|
| WARN-PH001 | フェーズ制御 | サブフェーズ依存関係の推奨順序違反 | workflow_complete_sub |
| WARN-PH002 | フェーズ制御 | フェーズがスキップされた | workflow_next |
| WARN-SM001 | 意味的整合性 | 要件キーワードの出現頻度が低い | artifact-validator |
| WARN-SC001 | スコープ検証 | スコープ設定が広範囲すぎる | workflow_set_scope |

## エラーメッセージ設計

本プラグインの全てのエラーメッセージは問題の特定と解決を迅速化するために一貫した構造を持つ。
各エラーメッセージはエラーコード・問題の内容・詳細情報・推奨アクションの4要素で構成される。
エラーコードは問題の分類を示し、AIエージェントがエラーの種別を自動判定する際の識別子として機能する。
問題の内容は人間が読んで理解できる簡潔な説明文であり、技術的な詳細を含まない概要レベルの情報とする。
詳細情報はJSON形式の構造化データとして提供され、エラー発生時のコンテキスト（ファイルパス・変数値・設定値等）を含む。
推奨アクションは具体的な修正手順を箇条書きで提示し、ユーザーまたはAIエージェントが次に実行すべきコマンドや確認事項を明示する。
Hooksシステムのエラーメッセージは標準エラー出力に出力され、セキュリティブロック時は即座にプロセスを終了する設計とする。

## APIレスポンス設計

MCPツールのAPIレスポンスは全て統一されたJSON構造を採用し、成功レスポンスとエラーレスポンスで異なる形式を使用する。
成功レスポンスはsuccessフラグ（true）・Markdown形式のmessageプロパティ・構造化されたdataプロパティの3要素で構成される。
エラーレスポンスはsuccessフラグ（false）・errorオブジェクト（code/message/details/suggestedActionsを含む）の2要素で構成される。
警告を含む成功レスポンスはsuccessフラグ（true）・messageプロパティ・dataプロパティ・warnings配列の4要素で構成される。
warnings配列は警告オブジェクトの配列であり、各オブジェクトはcode/message/detailsの3プロパティを持つ。
dataオブジェクトの内容はツールごとに異なるが、taskId/currentPhase/timestamp等の共通プロパティを必ず含む設計とする。
レスポンスのJSON構造はJSON Schemaで定義され、response-format.test.tsでバリデーションテストを実施する。

## 設定ファイル設計

本プラグインの動作設定は環境変数とJSONファイルの組み合わせで管理される。
環境変数WORKFLOW_DEBUGはデバッグモードの有効化を制御し、trueに設定すると詳細ログが標準出力に追加出力される。
環境変数WORKFLOW_LANGは将来の多言語化対応時にメッセージ言語を切り替えるために予約されているが、現時点では未実装である。
HMACキーの管理は.claude/state/hmac-keys.jsonファイルで実施され、JSON形式で世代別の鍵データを格納する。
ワークフロー状態は.claude/state/workflows/タスクID/workflow-state.jsonファイルに保存され、HMAC署名で改竄を防止する。
設定ファイルのパスはプロジェクトルートからの相対パスまたは絶対パスで指定可能とし、Windowsパスのバックスラッシュは正規化処理で統一する。
全ての設定ファイルはUTF-8エンコーディングで保存され、BOM（Byte Order Mark）の有無は自動判定して処理する。

## メッセージ構造の標準形式

全てのMCP Serverツールのレスポンスメッセージは以下のJSON構造に従う。

成功レスポンスの構造は「success: true」フラグと「message」プロパティと「data」プロパティで構成される。
messageプロパティはMarkdown形式の人間可読テキストを格納し、dataプロパティは構造化された情報オブジェクトを格納する。
dataオブジェクトの内容はツールごとに異なるが、taskId/currentPhase/timestamp等の共通プロパティを含む。

エラーレスポンスの構造は「success: false」フラグと「error」プロパティで構成される。
errorプロパティはcode/message/details/suggestedActionsの4つのサブプロパティを持つオブジェクトである。
codeはエラーコード体系で定義された一意の識別子、messageは人間可読なエラー説明、detailsは追加のコンテキスト情報、suggestedActionsは推奨される修正アクションの配列である。

警告を含む成功レスポンスの構造は「success: true」フラグと「message」プロパティと「warnings」プロパティで構成される。
warningsプロパティは警告オブジェクトの配列であり、各オブジェクトはcode/message/detailsの3プロパティを持つ。

具体的なJSON構造の例を以下に示す。

成功レスポンス（警告なし）:
```json
{
  "success": true,
  "message": "✓ requirements承認が完了しました",
  "data": {
    "taskId": "20260213_120000_タスク名",
    "currentPhase": "requirements",
    "approvals": {
      "requirements": true,
      "design": false,
      "test_design": false
    },
    "timestamp": "2026-02-13T12:00:00.000Z"
  }
}
```

エラーレスポンス:
```json
{
  "success": false,
  "error": {
    "code": "ERR-AP001",
    "message": "requirements承認が必要です",
    "details": {
      "currentPhase": "requirements",
      "approvalStatus": {
        "requirements": false
      }
    },
    "suggestedActions": [
      "workflow_approve requirements を実行してください",
      "requirements.md の内容を確認してください"
    ]
  }
}
```

警告付き成功レスポンス:
```json
{
  "success": true,
  "message": "planning サブフェーズを完了しました",
  "data": {
    "taskId": "20260213_120000_タスク名",
    "currentPhase": "parallel_analysis",
    "subPhaseCompletion": {
      "threat_modeling": false,
      "planning": true
    }
  },
  "warnings": [
    {
      "code": "WARN-PH001",
      "message": "推奨: threat_modeling を先に完了してください",
      "details": {
        "dependency": "planning requires threat_modeling",
        "currentOrder": ["planning"],
        "recommendedOrder": ["threat_modeling", "planning"]
      }
    }
  ]
}
```

## REQ-B1: requirements承認ゲート関連メッセージ

本セクションではREQ-B1のrequirements承認ゲート追加に伴う各種メッセージを定義する。

workflow_approveツールでrequirements承認を実行した際の成功メッセージは以下の形式とする。
Markdown形式の表示は「✓ requirements承認が完了しました」というシンプルなテキストとし、チェックマークで成功を明示する。
JSON構造にはtaskId/currentPhase/approvals/timestampの4プロパティを含め、承認状態を追跡可能にする。
approvalsオブジェクトはrequirements/design/test_designの3プロパティを持ち、各承認の真偽値を示す。

workflow_approveツールで不正なフェーズでrequirements承認を試行した際のエラーメッセージは以下の形式とする。
エラーコードはERR-AP002とし、問題の内容は「requirements承認はrequirementsフェーズでのみ実行可能です」とする。
詳細情報として現在のフェーズ名と許可されたフェーズ名をdetailsオブジェクトに含める。
推奨アクションは「現在のフェーズ: ${currentPhase}」「requirements承認を実行するには、まずrequirementsフェーズに移動してください」の2行とする。

workflow_nextツールでrequirementsフェーズから次フェーズへ遷移する際、承認が未実施の場合のエラーメッセージは以下の形式とする。
エラーコードはERR-AP001とし、問題の内容は「requirements承認が必要です」とする。
詳細情報としてcurrentPhase（requirements）とapprovalStatus（requirements: false）をdetailsオブジェクトに含める。
推奨アクションは「workflow_approve requirements を実行してください」「requirements.md の内容を確認してください」の2行とする。

workflow_statusツールの出力にrequirements承認状態を追加表示する。
既存のdesign承認とtest_design承認の表示形式に倣い、以下のMarkdown形式で表示する。

```markdown
**承認状態**

| 承認種別 | 状態 |
|---------|------|
| requirements | ✓ 承認済み |
| design | - 未承認 |
| test_design | - 未承認 |
```

承認済みの場合は「✓ 承認済み」、未承認の場合は「- 未承認」と表示し、視覚的に状態を判別できるようにする。

## REQ-B2: 意味的整合性チェック関連メッセージ

本セクションではREQ-B2の意味的整合性チェック導入に伴うバリデーションエラーとログメッセージを定義する。

artifact-validatorのvalidateSemanticConsistency関数で要件キーワードがspec.mdに不足している場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SM001とし、問題の内容は「spec.mdに要件キーワードが十分に含まれていません」とする。
詳細情報としてmissingKeywords配列（不足キーワードのリスト）とrequirementId（該当要件ID）とtargetFile（spec.md）をdetailsオブジェクトに含める。
推奨アクションは「spec.mdに以下のキーワードを含む記述を追加してください: ${missingKeywords.join(', ')}」「requirements.mdの${requirementId}セクションを参照してください」の2行とする。

artifact-validatorのvalidateSemanticConsistency関数で要件キーワードがtest-design.mdに不足している場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SM002とし、問題の内容は「test-design.mdに要件キーワードが十分に含まれていません」とする。
詳細情報としてmissingKeywords配列とrequirementIdとtargetFile（test-design.md）をdetailsオブジェクトに含める。
推奨アクションは「test-design.mdに以下のキーワードをテストケース名または検証内容に含めてください: ${missingKeywords.join(', ')}」「requirements.mdの${requirementId}セクションを参照してください」の2行とする。

artifact-validatorのvalidateSemanticConsistency関数でセキュリティ要件キーワードがthreat-model.mdに不足している場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SM003とし、問題の内容は「threat-model.mdにセキュリティ要件キーワードが十分に含まれていません」とする。
詳細情報としてmissingKeywords配列とrequirementIdとtargetFile（threat-model.md）をdetailsオブジェクトに含める。
推奨アクションは「threat-model.mdに以下のキーワードを含む脅威シナリオを追加してください: ${missingKeywords.join(', ')}」「requirements.mdの${requirementId}セクションのセキュリティ要件を参照してください」の2行とする。

キーワード出現頻度が閾値を下回るが、完全に不足しているわけではない場合の警告メッセージは以下の形式とする。
警告コードはWARN-SM001とし、内容は「要件キーワードの出現頻度が低いです」とする。
詳細情報としてkeyword（キーワード名）とoccurrenceCount（出現回数）とthreshold（閾値）とtargetFileをdetailsオブジェクトに含める。
推奨アクションは「${targetFile}で'${keyword}'の出現頻度を増やすことを検討してください（現在${occurrenceCount}回、推奨${threshold}回以上）」の1行とする。

意味的整合性チェックの処理状況を示すログメッセージは標準出力に以下の形式で出力する。
「[artifact-validator] キーワード抽出中: requirements.md」
「[artifact-validator] 抽出されたキーワード: ${keywords.length}個」
「[artifact-validator] 整合性チェック中: spec.md」
「[artifact-validator] 整合性チェック中: test-design.md」
「[artifact-validator] 整合性チェック中: threat-model.md」
「[artifact-validator] 整合性チェック完了: エラー${errorCount}件、警告${warningCount}件」

## REQ-B3: parallel_analysisサブフェーズ依存関係関連メッセージ

本セクションではREQ-B3のparallel_analysis内サブフェーズ依存関係追加に伴うメッセージを定義する。

workflow_complete_subツールでplanningサブフェーズを完了する際、threat_modelingが未完了の場合の警告メッセージは以下の形式とする。
警告コードはWARN-PH001とし、内容は「推奨: threat_modelingを先に完了してください」とする。
詳細情報としてdependency（planning requires threat_modeling）とcurrentOrder配列（既に完了したサブフェーズのリスト）とrecommendedOrder配列（推奨実行順序）をdetailsオブジェクトに含める。
警告の下部に追加メッセージ「続行する場合は、このメッセージを確認の上で再度 workflow_complete_sub planning を実行してください」を表示する。

警告後にユーザーが再度workflow_complete_sub planningを実行した場合は警告を抑制し、通常の完了メッセージのみを表示する。
通常の完了メッセージは「✓ planning サブフェーズが完了しました」とし、警告を含まない成功レスポンスを返却する。

threat_modelingサブフェーズ完了後にplanningサブフェーズを完了する場合は警告を表示せず、通常の完了メッセージのみを表示する。
Markdown形式の表示は「✓ planning サブフェーズが完了しました」とし、JSON構造にはtaskId/currentPhase/subPhaseCompletion/timestampの4プロパティを含める。

workflow_statusツールの出力にサブフェーズ依存関係の情報を追加表示する。
parallel_analysisフェーズの表示に以下のMarkdown形式で依存関係を示す。

```markdown
**parallel_analysis サブフェーズ状況**

| サブフェーズ | 状態 | 依存関係 |
|-------------|------|---------|
| threat_modeling | ✓ 完了 | - |
| planning | - 未完了 | threat_modeling推奨 |
```

依存関係列には「${依存元サブフェーズ}推奨」の形式で表示し、必須ではないが推奨される依存関係を明示する。

## REQ-B4: サブエージェントコンテキスト引き継ぎ関連メッセージ

本セクションではREQ-B4のサブエージェントコンテキスト引き継ぎ改善に伴うガイダンスメッセージを定義する。

サブエージェント起動時のプロンプトテンプレートに含まれる入力ファイル読み込み指示メッセージは以下の形式とする。
「以下のファイルを読み込んでください（★印は全文、☆印はサマリーセクションのみ読み込み）:」
「★ ${highPriorityFile1}」
「★ ${highPriorityFile2}」
「☆ ${mediumPriorityFile1}」

全文読み込み対象ファイルには★マーク、サマリーセクションのみ読み込み対象ファイルには☆マークを付与し、視覚的に重要度を区別する。

サマリーセクションが不足している成果物を検出した場合の警告メッセージは以下の形式とする。
警告コードはWARN-DOC001とし、内容は「サマリーセクションが不足しています」とする。
詳細情報としてfilePath（対象ファイルパス）とrequiredElements配列（目的・主要決定事項・次フェーズ必要情報）をdetailsオブジェクトに含める。
推奨アクションは「${filePath}の先頭50行以内に以下の要素を含むサマリーセクションを追加してください: ${requiredElements.join(', ')}」の1行とする。

サブエージェント起動後の処理ログメッセージは標準出力に以下の形式で出力する。
「[Task] ${phaseName}フェーズ実行中: ${taskName}」
「[Task] 入力ファイル読み込み: ${fileCount}件」
「[Task] 全文読み込み: ${fullReadFiles.join(', ')}」
「[Task] サマリー読み込み: ${summaryReadFiles.join(', ')}」

## REQ-C1: bashホワイトリストバイパス検出関連メッセージ

本セクションではREQ-C1のbashホワイトリストバイパス検出強化に伴うエラーメッセージを定義する。

bash-whitelist.jsでbase64エンコードされたコマンドを検出した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SH001とし、問題の内容は「base64エンコードされたコマンドの実行が検出されました」とする。
詳細情報としてoriginalCommand（元のコマンド文字列）とdecodedCommand（デコード後のコマンド）とdetectedPattern（検出されたパターン）をdetailsオブジェクトに含める。
推奨アクションは「ホワイトリストに登録されたコマンドを直接実行してください」「base64エンコードを使用しない形式に変更してください」の2行とする。

bash-whitelist.jsでprintf/echoによるエンコードコマンドを検出した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SH002とし、問題の内容は「printf/echoによるエンコードコマンド実行が検出されました」とする。
詳細情報としてoriginalCommandとdecodedCommandとencodingType（16進エスケープ/8進エスケープ）をdetailsオブジェクトに含める。
推奨アクションは「ホワイトリストに登録されたコマンドを直接実行してください」「エスケープシーケンスを使用しない形式に変更してください」の2行とする。

bash-whitelist.jsでeval/exec間接実行を検出した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SH003とし、問題の内容は「eval/execによる間接実行が検出されました」とする。
詳細情報としてoriginalCommandとextractedCommand（eval/exec引数として抽出されたコマンド）とindirectType（eval/exec）をdetailsオブジェクトに含める。
推奨アクションは「ホワイトリストに登録されたコマンドを直接実行してください」「eval/execを使用しない形式に変更してください」の2行とする。

bash-whitelist.jsでsh/bash -c間接実行を検出した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SH004とし、問題の内容は「sh/bash -cによる間接実行が検出されました」とする。
詳細情報としてoriginalCommandとextractedCommandとshellType（sh/bash）をdetailsオブジェクトに含める。
推奨アクションは「ホワイトリストに登録されたコマンドを直接実行してください」「sh -c/bash -cを使用しない形式に変更してください」の2行とする。

bash-whitelist.jsでパイプ経由のシェル実行を検出した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-SH005とし、問題の内容は「パイプ経由のシェル実行が検出されました」とする。
詳細情報としてoriginalCommandとpipeLeftSide（パイプ左側のコマンド）とpipeRightSide（パイプ右側のコマンド）をdetailsオブジェクトに含める。
推奨アクションは「ホワイトリストに登録されたコマンドを直接実行してください」「パイプでシェルにコマンドを渡す形式を使用しないでください」の2行とする。

全てのbashホワイトリスト違反エラーは標準エラー出力に以下の形式で出力され、プロセスは即座に終了する。
「[SECURITY BLOCK] ${errorCode}: ${message}」
「[SECURITY BLOCK] 詳細: ${JSON.stringify(details)}」
「[SECURITY BLOCK] プロセスを終了します」

## REQ-C2: テスト真正性検証関連メッセージ

本セクションではREQ-C2のテスト真正性検証強化に伴うエラーメッセージとログを定義する。

test-authenticityのvalidateTestExecutionTime関数でテスト実行時間が異常に短い場合のエラーメッセージは以下の形式とする。
エラーコードはERR-TS001とし、問題の内容は「テスト実行時間が不自然に短いです」とする。
詳細情報としてduration（実行時間ミリ秒）とthreshold（閾値ミリ秒）とdetectedAt（検出時刻ISO8601形式）をdetailsオブジェクトに含める。
推奨アクションは「実際のテスト実行結果を提出してください（${duration}ms < ${threshold}ms）」「テストコマンドを実行して出力をコピーしてください」の2行とする。

test-authenticityのrecordTestOutputHash関数でテスト出力ハッシュの重複を検出した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-TS002とし、問題の内容は「同一のテスト出力が既に記録されています」とする。
詳細情報としてoutputHash（SHA-256ハッシュの先頭16文字）とpreviousSubmissionTime（前回提出時刻）とduplicateCount（重複回数）をdetailsオブジェクトに含める。
推奨アクションは「新規実行結果を提出してください（出力ハッシュ: ${outputHash}）」「テストコードまたはテストデータを変更して再実行してください」の2行とする。

workflow_record_test_resultツールでテスト結果を記録する際のログメッセージは標準出力に以下の形式で出力する。
「[test-authenticity] テスト実行記録開始」
「[test-authenticity] 実行時間: ${duration}ms」
「[test-authenticity] 出力ハッシュ: ${outputHash}」
「[test-authenticity] テスト結果記録完了」

テスト真正性検証が成功した場合の成功メッセージは以下の形式とする。
Markdown形式の表示は「✓ テスト結果を記録しました（実行時間: ${duration}ms）」とし、実行時間を明示する。
JSON構造にはtaskId/phase/testResult（exitCode/outputHash/duration/timestamp）の4プロパティを含める。

## REQ-C3: 動的フェーズスキップ関連メッセージ

本セクションではREQ-C3の動的フェーズスキップ機構導入に伴うメッセージを定義する。

workflow_nextツールでフェーズスキップが発生した場合の通知メッセージは以下の形式とする。
警告コードはWARN-PH002とし、内容は「以下のフェーズがスキップされました」とする。
詳細情報としてskippedPhases配列（スキップされたフェーズ名とスキップ理由のペアオブジェクト配列）とskipReason（スキップ判定根拠）をdetailsオブジェクトに含める。
Markdown形式の表示は以下のテーブル形式とする。

```markdown
**スキップされたフェーズ**

| フェーズ | スキップ理由 |
|---------|-------------|
| test_impl | テストファイルが影響範囲に含まれないため |
| implementation | コードファイルが影響範囲に含まれないため |
| refactoring | コードファイルが影響範囲に含まれないため |
| testing | テストファイルが影響範囲に含まれないため |
| regression_test | テストファイルが影響範囲に含まれないため |

次のフェーズ: parallel_quality
```

スキップ通知の後に実際に遷移する次フェーズ名を明示し、ユーザーがワークフローの進行状況を把握できるようにする。

workflow_statusツールの出力にスキップされたフェーズ情報を追加表示する。
フェーズ一覧の表示に以下のMarkdown形式でスキップ状態を示す。

```markdown
**フェーズ進行状況**

| フェーズ | 状態 | 備考 |
|---------|------|------|
| research | ✓ 完了 | |
| requirements | ✓ 完了 | |
| parallel_analysis | ✓ 完了 | |
| parallel_design | ✓ 完了 | |
| design_review | ✓ 完了 | |
| test_design | ✓ 完了 | |
| test_impl | ⊘ スキップ | テストファイルが影響範囲に含まれないため |
| implementation | ⊘ スキップ | コードファイルが影響範囲に含まれないため |
| refactoring | ⊘ スキップ | コードファイルが影響範囲に含まれないため |
| testing | ⊘ スキップ | テストファイルが影響範囲に含まれないため |
| regression_test | ⊘ スキップ | テストファイルが影響範囲に含まれないため |
| parallel_quality | → 現在 | |
```

スキップされたフェーズには「⊘ スキップ」マークを表示し、備考列にスキップ理由を記載する。

calculateRequiredPhases関数の処理ログメッセージは標準出力に以下の形式で出力する。
「[phase-skip] タスクスコープ分析中」
「[phase-skip] 影響範囲ファイル: ${fileCount}件」
「[phase-skip] コードファイル: ${codeFileCount}件」
「[phase-skip] テストファイル: ${testFileCount}件」
「[phase-skip] ドキュメントファイル: ${docFileCount}件」
「[phase-skip] スキップ判定完了: ${skippedPhaseCount}フェーズをスキップ」

## REQ-C4: 段階的リカバリ関連メッセージ

本セクションではREQ-C4の段階的リカバリ機構改善に伴うメッセージを定義する。

workflow_backツールで差し戻しを実行した際の成功メッセージは以下の形式とする。
Markdown形式の表示は複数のセクションで構成され、差し戻し情報・バックアップ情報・リカバリガイダンスの3つを含む。

```markdown
**ワークフロー差し戻し完了**

**差し戻し情報**

- 差し戻し先フェーズ: requirements
- 理由: 要件定義の重大な不備が発見されたため
- 実行日時: 2026-02-13T12:00:00.000Z

**バックアップ情報**

以下のフェーズの成果物をバックアップしました:

| フェーズ | 成果物ファイル |
|---------|--------------|
| parallel_analysis | threat-model.md, spec.md |
| parallel_design | state-machine.mmd, flowchart.mmd, ui-design.md |
| design_review | （承認記録のみ） |
| test_design | test-design.md |

バックアップディレクトリ: `C:\ツール\Workflow\docs\workflows\タスク名\backup_20260213_120000_taskId\`

**リカバリガイダンス**

次の作業を実行してください:

1. **requirements.md の修正**: 不備が指摘された箇所を修正してください
2. **承認の再実施**: 修正完了後、`workflow_approve requirements` を実行してください
3. **次フェーズへ進む**: 承認後、`workflow_next` で parallel_analysis フェーズに進んでください
4. **成果物の再作成**: バックアップされた成果物を参考に、各フェーズの成果物を再作成してください

バックアップファイルは削除されません。必要に応じて参照してください。
```

JSON構造にはtaskId/targetPhase/reason/backupDirectory/backedUpArtifacts配列/recoverySteps配列の6プロパティを含める。

workflow_resetツールでresearchフェーズへリセットした際の成功メッセージは以下の形式とする。
Markdown形式の表示はworkflow_backと同様の構成だが、差し戻し先フェーズが常にresearchとなり、全フェーズの成果物がバックアップ対象となる。

バックアップディレクトリの作成に失敗した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-RC002とし、問題の内容は「バックアップディレクトリの作成に失敗しました」とする。
詳細情報としてbackupPath（作成しようとしたパス）とosError（OSレベルのエラーメッセージ）をdetailsオブジェクトに含める。
推奨アクションは「ディレクトリの書き込み権限を確認してください」「ディスク容量が十分か確認してください」の2行とする。

成果物ファイルの移動に失敗した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-RC003とし、問題の内容は「成果物ファイルの移動に失敗しました」とする。
詳細情報としてsourceFile（移動元ファイルパス）とdestinationFile（移動先ファイルパス）とosErrorをdetailsオブジェクトに含める。
推奨アクションは「ファイルが他のプロセスで使用されていないか確認してください」「ファイルの読み取り/書き込み権限を確認してください」の2行とする。

## REQ-D1: HMACキー管理統一関連メッセージ

本セクションではREQ-D1のHMACキー管理統一に伴うエラーメッセージを定義する。

hmac-verify.jsで全世代のHMACキーで検証失敗した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-HM001とし、問題の内容は「HMACキー検証に失敗しました」とする。
詳細情報としてtestedGenerations（検証を試行した世代数）とlatestGeneration（最新世代番号）とverificationTime（検証実行時刻）をdetailsオブジェクトに含める。
推奨アクションは「HMACキーファイルが正しいか確認してください」「ワークフロー状態ファイルが改竄されていないか確認してください」「workflow_resetでタスクを再開してください」の3行とする。

hmac-verify.jsでHMACキーファイルの読み込みに失敗した場合のエラーメッセージは以下の形式とする。
エラーコードはERR-HM002とし、問題の内容は「HMACキーファイルの読み込みに失敗しました」とする。
詳細情報としてkeyFilePath（ファイルパス）とosErrorをdetailsオブジェクトに含める。
推奨アクションは「HMACキーファイルが存在するか確認してください: ${keyFilePath}」「ファイルの読み取り権限を確認してください」の2行とする。

hmac-verify.jsでHMACキーファイルのJSON形式が不正な場合のエラーメッセージは以下の形式とする。
エラーコードはERR-HM003とし、問題の内容は「HMACキーファイルのJSON形式が不正です」とする。
詳細情報としてkeyFilePathとparseError（JSONパースエラーメッセージ）とfileContent（ファイル内容の先頭100文字）をdetailsオブジェクトに含める。
推奨アクションは「HMACキーファイルのJSON形式を確認してください」「ファイル内容: ${fileContent}...」の2行とする。

全てのHMAC検証エラーは標準エラー出力に以下の形式で出力され、プロセスは即座に終了する。
「[HMAC VERIFICATION FAILED] ${errorCode}: ${message}」
「[HMAC VERIFICATION FAILED] 詳細: ${JSON.stringify(details)}」
「[HMAC VERIFICATION FAILED] プロセスを終了します」

世代別フォールバック検証の処理ログメッセージは標準出力に以下の形式で出力する。
「[hmac-verify] HMACキー読み込み: ${keyCount}世代」
「[hmac-verify] 最新世代での検証: 世代${latestGeneration}」
「[hmac-verify] フォールバック検証: 世代${generation}」
「[hmac-verify] 検証成功: 世代${generation}」

## REQ-D2: 重複行検出誤検知修正関連メッセージ

本セクションではREQ-D2の重複行検出の誤検知修正に伴うメッセージを定義する。

artifact-validatorのcheckSectionDensity関数で重複行検出が改善され、コードブロックとテーブル行が除外されたことを示すログメッセージは標準出力に以下の形式で出力する。
「[artifact-validator] 重複行チェック開始: ${filePath}」
「[artifact-validator] 総行数: ${totalLines}行」
「[artifact-validator] 構造行（除外対象）: ${structuralLines}行（コードブロック: ${codeBlockLines}行、テーブル: ${tableLines}行、その他: ${otherStructuralLines}行）」
「[artifact-validator] 実質行数: ${substantialLines}行」
「[artifact-validator] 重複行検出: ${duplicateLines}件」

重複行が検出された場合のエラーメッセージは既存のERR-VAL001を維持するが、詳細情報に除外処理の情報を追加する。
詳細情報としてduplicateContent（重複内容）とoccurrenceCount（出現回数）とlineNumbers配列（重複行の行番号リスト）とexcludedLines（除外された構造行数）とexclusionDetails（除外内訳オブジェクト）をdetailsオブジェクトに含める。
exclusionDetailsオブジェクトはcodeBlockLines/tableLines/otherStructuralLinesの3プロパティを持つ。

重複行検出の誤検知が減少したことを示すログメッセージは標準出力に以下の形式で出力する。
「[artifact-validator] 重複行チェック完了: エラー${errorCount}件」
「[artifact-validator] 除外処理による誤検知回避: コードブロック${codeBlockExclusionCount}件、テーブル${tableExclusionCount}件」

## REQ-D3: Windowsパス正規化関連メッセージ

本セクションではREQ-D3のWindowsパス正規化対応に伴うログメッセージを定義する。

normalizePath関数の処理ログメッセージは標準出力に以下の形式で出力する（デバッグモード時のみ）。
「[path-normalize] 正規化前: ${originalPath}」
「[path-normalize] バックスラッシュ統一: ${afterBackslashNormalization}」
「[path-normalize] UTF-8正規化: ${afterUTF8Normalization}」
「[path-normalize] 正規化後: ${normalizedPath}」

scope-validatorのisWithinScope関数でパス比較を実施する際のログメッセージは標準出力に以下の形式で出力する（デバッグモード時のみ）。
「[scope-validator] スコープ検証開始」
「[scope-validator] 編集対象パス（正規化後）: ${normalizedEditPath}」
「[scope-validator] スコープパス（正規化後）: ${normalizedScopePaths.join(', ')}」
「[scope-validator] スコープ内判定: ${isWithin}」

パス正規化によりスコープ検証の精度が向上したことを示すログメッセージは標準出力に以下の形式で出力する。
「[scope-validator] パス正規化による比較精度向上: バックスラッシュ統一${backslashNormalizations}件、UTF-8正規化${utf8Normalizations}件」

スコープ外ファイルの編集を検出した場合のエラーメッセージは既存のERR-SC001を維持するが、詳細情報に正規化後のパスを追加する。
詳細情報としてoriginalEditPath（元の編集対象パス）とnormalizedEditPath（正規化後の編集対象パス）とallowedPaths配列（許可されたパスのリスト、正規化後）をdetailsオブジェクトに含める。

## ログレベルとデバッグモード

本プラグインは3つのログレベル（ERROR/WARN/INFO）をサポートする。

ERRORレベルは処理を中断するエラー発生時に標準エラー出力に出力される。
WARNレベルは処理を継続するが注意喚起が必要な場合に標準出力に出力される。
INFOレベルは通常の処理状況を示す場合に標準出力に出力される。

デバッグモードは環境変数WORKFLOW_DEBUG=trueで有効化され、追加の詳細ログを出力する。
デバッグモードで出力されるログはDEBUGレベルとして標準出力に「[DEBUG]」プレフィックス付きで出力される。

各ログメッセージのプレフィックス形式は以下の通り。
ERRORレベル: 「[ERROR] [コンポーネント名] ${message}」
WARNレベル: 「[WARN] [コンポーネント名] ${message}」
INFOレベル: 「[INFO] [コンポーネント名] ${message}」
DEBUGレベル: 「[DEBUG] [コンポーネント名] ${message}」

コンポーネント名は発生元のモジュール名とし、artifact-validator/test-authenticity/bash-whitelist/hmac-verify等を使用する。

## メッセージ多言語化の将来対応

本UI設計では日本語メッセージを基本とするが、将来の多言語化を考慮した設計とする。

全てのメッセージテンプレートは定数として外部ファイル（messages.json）に分離可能な構造とする。
messages.jsonは言語コードをキーとするオブジェクトであり、各言語コード配下にエラーコード/警告コードをキーとするメッセージテンプレートを格納する。
メッセージテンプレートは変数置換用のプレースホルダー（${variableName}）を含む文字列とする。

将来的に環境変数WORKFLOW_LANG=enで英語メッセージに切り替え可能とする設計を想定する。
ただし本改修の実装範囲では日本語メッセージのみを実装し、多言語化の基盤整備は将来のフェーズで実施する。

## 受け入れ基準とテスト観点

本UI設計の受け入れ基準は以下の5点である。

第一の基準は全てのエラーメッセージが一意のエラーコードを持ち、問題内容・原因・解決策の3点セットで構成されていることである。
検証方法はerrors.test.tsで各エラーコードのメッセージフォーマットをユニットテストし、code/message/details/suggestedActionsの4プロパティが存在することを確認する。

第二の基準は全てのJSON構造レスポンスが標準形式（success/message/dataまたはsuccess/error）に従っていることである。
検証方法はresponse-format.test.tsで各ツールのレスポンスをJSON Schemaバリデーションし、標準形式への準拠を確認する。

第三の基準は警告付き成功レスポンスが適切にwarnings配列を含んでいることである。
検証方法はwarnings.test.tsでWARN-PH001/WARN-SM001等の警告ケースをシミュレートし、warnings配列の存在と内容を確認する。

第四の基準は全てのログメッセージが適切なログレベル（ERROR/WARN/INFO/DEBUG）とコンポーネント名プレフィックスを持つことである。
検証方法はlogging.test.tsでログ出力をモックキャプチャし、プレフィックス形式と内容を確認する。

第五の基準はMarkdown形式のメッセージがユーザーフレンドリーで読みやすいことである。
検証方法はユーザビリティテストとして実際のワークフロー実行時にメッセージを目視確認し、改善点をフィードバックする。
