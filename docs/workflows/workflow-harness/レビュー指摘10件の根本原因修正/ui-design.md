# UI設計: レビュー指摘10件の根本原因修正

## サマリー

本ドキュメントは、ワークフロープラグイン修正における4つのインターフェース設計領域を規定します。

CLIインターフェース設計では、workflow start コマンドにおけるtaskSizeパラメータの復活と、レスポンスメッセージの変更を定義します。`small`、`medium`、`large`の3サイズが利用可能となり、ユーザーが適切なサイズを選択できるようになります。

エラーメッセージ設計では、テスト品質検証エラー時とスタブ検出エラー時の具体的なメッセージ形式を規定します。ユーザーが問題を正確に理解し、修正方法を明確に把握できる詳細なメッセージを提供します。

APIレスポンス設計では、definition.tsのREVIEW_PHASES配列への変更に伴うレスポンス構造の統一化を定義します。4つの承認ゲート全てが一貫した応答形式で返されるようになります。

設定ファイル設計では、CLAUDE.mdのスコープ設定ガイダンスと新規追加されるセクション構成を記述します。workflow set-scopeコマンド実行時の入力指針と、subagent起動テンプレートの新規セクションを明確化します。

次フェーズのimplementationでは、これらの設計に従い、コード修正とドキュメント修正を実施します。

## CLIインターフェース設計

### workflow start コマンド拡張

ユーザーは`workflow start <タスク名> [--taskSize=<size>]`形式でワークフローを開始します。taskSizeパラメータには、`small`、`medium`、`large`の3つの値が指定可能です。デフォルト値は`large`であり、パラメータ省略時は19フェーズの完全ワークフローが実行されます。

smallサイズが指定された場合、システムは`research → requirements → planning → test_impl → implementation → testing → commit → completed`の8フェーズのみを実行します。CLIの出力には「smallサイズで開始されました（8フェーズ）」というメッセージが表示されます。

mediumサイズが指定された場合、システムは14フェーズのワークフローを実行します。threat_modeling、design_review、refactoring、code_review、regression_testの5フェーズがスキップされます。出力メッセージには「mediumサイズで開始されました（14フェーズ）」と表示されます。

largeサイズが指定された場合、全19フェーズが実行されます。明示的に`--taskSize=large`が指定された場合、「largeサイズで開始されました（19フェーズ）」というメッセージが表示されます。パラメータ省略時の場合は「タスクサイズが指定されていません。デフォルトのlargeサイズ(19フェーズ)で開始されました」というメッセージが表示されます。

### workflow status コマンド出力変更

ワークフロー実行中に`workflow status`コマンドを実行すると、現在のフェーズ名と残りフェーズ数が表示されます。smallサイズで実行中の場合、「8フェーズ中の現在フェーズ: 3/8」のような形式で表示されます。mediumサイズの場合は「14フェーズ中」、largeサイズの場合は「19フェーズ中」と表示されます。

ユーザーはステータス出力から、自分が選択したタスクサイズと現在の進捗状況を一目で把握できます。残りフェーズ数の表示により、作業完了までの大まかな所要時間を見積もることが可能です。

### 承認ゲート通知

definitions.tsのREVIEW_PHASES配列にcode_reviewが追加されたことにより、code_reviewフェーズでも他の承認フェーズと同じ通知が表示されます。ユーザーが`workflow next`を実行した場合、「このフェーズは承認が必要です。workflow_approveを実行してください」というメッセージが表示されます。

3つの既存承認フェーズ（requirements、design_review、test_design）と同じメッセージ形式を採用することで、ユーザーの操作精度が向上します。全ての承認ゲートで一貫した動作と通知を提供することで、ワークフロー全体の予測可能性が高まります。

### 並列フェーズ依存関係通知

parallel_analysisフェーズでplanningを先にcomplete-subしようとした場合、「planningはthreat_modelingの完了を待機しています。threat_modelingをcomplete-subしてください」というエラーメッセージが返されます。このメッセージにより、ユーザーは依存関係の存在を正確に理解できます。

parallel_designフェーズでは、ui_designを先にcomplete-subしようとした場合、「ui_designはflowchartの完了を待機しています」というメッセージが表示されます。各依存関係に対して、「AはBの完了を待機」という統一形式のメッセージを提供することで、並列フェーズの操作がユーザーに明確になります。

## エラーメッセージ設計

### テスト品質検証エラー

test_implフェーズでテストファイルがアサーション関数を含まない場合、エラーメッセージ「テストファイル 'src/backend/tests/unit/user.test.ts' にアサーション関数が見つかりません。expect()またはassert()を含むテストを記述してください」が表示されます。

ユーザーは正確なファイルパスと必要な修正内容を理解できます。修正提案としてexpectまたはassertの使用例が含まれる場合、メッセージは「期待値と実際の値を比較するexpect(actual).toBe(expected)またはassert(actual === expected)の形式を使用してください」となります。

テストケース数が不足している場合のメッセージは「テストケース数が不足しています。describeブロック内に3件以上のit/test関数を記述してください。現在: 2個」となります。ユーザーは現在のテストケース数と必要な数を同時に把握できます。

拡張子が不正な場合は「テストファイルの拡張子が無効です。.test.tsまたは.spec.ts形式である必要があります。ファイル: 'src/backend/tests/user-test.js'」というメッセージが返されます。

複数のテストファイルが品質基準を満たさない場合、まずエラーサマリー「テストファイル品質検証：3個中2個が失敗」が表示され、その後、個別のエラー詳細が列挙されます。

### スタブ検出エラー

design-validator.tsがAST解析を強化した後、スタブを検出した場合のエラーメッセージは「ファイル 'src/backend/domain/user.ts' 内でスタブメソッドが検出されました。メソッド名: 'validateEmail'、行番号: 42」となります。

ユーザーはスタブが存在する正確な位置を把握でき、即座に該当メソッドを確認できます。複数のスタブが検出された場合は、「スタブメソッド検出：5個」というサマリーに続き、個別の位置情報が表示されます。

スタブ判定の根拠を含めたメッセージとして「メソッド 'calculateTax' はstatement数が1（単一のreturn文のみ）で、戻り値がnullである可能性があります。実装を完了してください」が表示されます。

エラースロー専用の判定メッセージは「メソッド 'updateUser' は実装ではなく、単にエラーをthrowしています。スタブと判定されました」となります。

未完了マーカーを検出した場合は「メソッド 'processPayment' に未完了マーカーコメントが含まれています。実装が未完了と判定されました」というメッセージが返されます。

### リグレッションテストフィルタリング警告

regression_testフェーズでスコープに基づくフィルタリングが実施される場合、情報メッセージとして「スコープ内のファイル数: 5個。関連テスト数: 8個。全テスト数は742個です」が表示されます。

ユーザーは、自分のスコープに関連する限定的なテストセットが実行されていることを認識できます。影響範囲が広い場合の警告メッセージは「警告: スコープ内のファイル数が20を超えています（26個）。全テスト(742個)の実行を推奨します」となります。

## APIレスポンス設計

### workflow_approve レスポンス統一

definitions.tsのREVIEW_PHASES配列にcode_reviewが追加されたことにより、workflow_approveコマンドのレスポンス形式が4つの承認フェーズで統一されます。

requirements承認時のレスポンス：`{ success: true, message: "requirementsフェーズの承認が完了しました", nextPhase: "parallel_analysis" }`

design_review承認時のレスポンス：`{ success: true, message: "design_reviewフェーズの承認が完了しました", nextPhase: "design_review" }`（最後のレビューフェーズ）

test_design承認時のレスポンス：`{ success: true, message: "test_designフェーズの承認が完了しました", nextPhase: "test_impl" }`

code_review承認時のレスポンス：`{ success: true, message: "code_reviewフェーズの承認が完了しました", nextPhase: "testing" }`

全ての承認フェーズで、`{ success, message, nextPhase }`の統一されたレスポンス構造が採用されます。クライアント側は同じロジックで全ての承認レスポンスを処理できます。

### workflow_next レスポンス拡張

承認が必要なフェーズでworkflow_nextが実行された場合、統一されたエラーレスポンスが返されます：`{ success: false, error: "このフェーズは承認が必要です", requiredAction: "workflow_approve <type:requirements|design_review|test_design|code_review>" }`

requiredActionフィールドにより、ユーザーが取るべき次のアクションが明確に指示されます。type値として、requirementsやdesign_reviewと同様にcode_reviewが含まれるようになります。

### test_impl フェーズレスポンス新規追加

test_implフェーズでテスト品質検証が実施される場合、artifact-validator.tsがValidationResultオブジェクトを返します：`{ isValid: true, errors: [], warnings: ["テストカバレッジが60%です。推奨値は80%以上です"] }`

テスト品質検証が失敗した場合：`{ isValid: false, errors: ["メソッド 'calculateTax' はテストされていません", "アサーション数が2個です。最低3個必要です"], warnings: [] }`

エラー配列には修正が必須な項目が、warningsにはガイダンス性の提案が含まれます。

### AST解析スタブ検出レスポンス

design-validator.tsがAST解析を実施した後、スタブ検出結果は以下の構造で返されます：

```
{
  found: true,
  stubs: [
    { functionName: "validateEmail", line: 42, reason: "statement数が1で、nullを返却" },
    { functionName: "calculateTax", line: 87, reason: "実装されていない（未完了マーカー検出）" }
  ],
  summary: "2個のスタブメソッドが検出されました。実装を完了してください"
}
```

クライアントはこのレスポンス構造から、スタブの位置情報と修正理由を体系的に取得できます。

## 設定ファイル設計

### CLAUDE.md タスクサイズセクション

CLAUDE.mdのL85付近に、タスクサイズ定義セクションが追加されます。テーブル形式で以下を記載：

| サイズ | フェーズ数 | 適用基準 | 例 |
|--------|----------|--------|-----|
| small | 8 | 変更行数10行未満、単一ファイル | typo修正、1行バグ修正、設定値変更 |
| medium | 14 | 変更行数100行未満、単一モジュール | 既存機能改善、中規模リファクタリング、API仕様変更 |
| large | 19 | 変更行数100行以上、複数モジュール | 新機能追加、アーキテクチャ変更、セキュリティ対策 |

各サイズのスキップフェーズも記載：smallは threat_modeling, design_review, refactoring, code_review, regression_test, parallel_quality, manual_test, security_scan, performance_test, e2e_test, docs_update, push, ci_verification, deployをスキップ。mediumはthreat_modeling, design_review, refactoring, code_review, regression_testをスキップ。

### subagent起動テンプレート拡張セクション

CLAUDE.mdのL153-194のsubagent起動テンプレートに、新規セクションを追加します。

「選択理由」セクション：subagent_typeおよびmodelを選択した根拠を記述。例：「ExploreタイプとHaikuモデルを選択した理由は、大規模なコードベースから関連ファイルを効率的に探索する必要があり、精密性よりはコスト効率を優先するため」

「探索戦略」セクション：4ステップの段階的探索手順を記載。ステップ1「プロジェクト概要把握：README.md、package.json等を読む」、ステップ2「ディレクトリ構成把握：ls -R またはglobで全体像を把握」、ステップ3「関連モジュール特定：grepで検索」、ステップ4「詳細調査：readで対象ファイルを精読」

「分割基準」セクション：入力ファイルサイズに基づく分割判定。「入力が5万行以上の場合は分割」「サマリーセクションを活用して段階的情報取得」「並列実行で複数モジュールを同時処理」「promptが2万トークン（約8万文字）を超える場合は分割検討」

### CLAUDE.md 完了表現制約セクション

L497-522の完了宣言ルールセクションに、技術的制約の注記を追加。テキスト：「注記：このルールはhookによる技術的強制はできず、AIの自己規律に依存します。Claude Codeのhookシステムはツール呼び出しのみを監視対象とし、AI応答テキストは検証範囲外です」

代替策としてフェーズ完了報告テンプレートを明示：「【{フェーズ名}フェーズ完了】- 完了した作業: {作業内容} - 次のフェーズ: {次フェーズ名} - 残りフェーズ数: {数}フェーズ」

### CLAUDE.md スコープ設定ガイダンスセクション

L959-987の「workflow set-scope」セクションを拡張。globパターンの推奨事項：「src/**/*.ts ではなく src/backend/domain/**/*.ts のように具体化」「tests/ ディレクトリ等の巨大ディレクトリは避ける」

ファイル数制限ガイダンス：「1000ファイル以上のスコープは避け、複数タスクに分割」「推奨最大値は500ファイル」

dirsパラメータ注意点：「事前にls -Rでファイル数を確認」「node_modules、.git、distは除外」

段階的スコープ設定戦略：「確実な数ファイルのみ→依存関係解析→段階的拡大」

### CLAUDE.md 並列フェーズ依存関係セクション

L649-661の並列フェーズセクションに依存関係の技術的強制を明記。表形式で依存関係を整理：

parallel_analysis：planning → threat_modeling（threat_modeling完了待機）
parallel_design：flowchart → state_machine、ui_design → flowchart
parallel_quality：code_review → build_check
parallel_verification：依存関係なし（任意順序実行可能）

### CLAUDE.md max_turns推奨値セクション

subagent起動テンプレートにmax_turnsパラメータの推奨値を追加。表形式：

| フェーズ | 推奨max_turns |
|---------|-------------|
| research | 15 |
| requirements | 10 |
| planning | 15 |
| test_design | 10 |
| test_impl | 10 |
| implementation | 10 |
| refactoring | 5 |
| code_review | 5 |
| その他 | 10 |

通常タスク：max_turns 10、大規模プロジェクト：max_turns 5

### CLAUDE.md リグレッションテスト指針セクション

L651付近に、スコープベースのテストフィルタリング指針を追加。手順：「1.workflow-get-test-info APIでテスト一覧取得」「2.スコープ内ファイルに関連するテストを選出」「3.選出テストのみ実行」

関連付けルール：ファイル名ベース（user.ts → user.test.ts）とディレクトリベース（src/backend/domain → src/backend/tests/）

全テスト実行条件：「影響ファイル数が20以上」「複数ドメイン境界をまたぐ」

## 次フェーズ方向性

implementationフェーズでは、本設計に従いコード修正とドキュメント修正を実施します。
test_impl遷移時のテスト品質検証ロジック追加が最優先のコード修正項目です。
design-validator.tsのAST解析強化は、既存のast-analyzer.ts基盤を活用して実装します。
definitions.tsのREVIEW_PHASES配列更新とコメント修正は、最も影響範囲が小さい修正です。
CLAUDE.mdには6つの新規セクション（タスクサイズ、判断ログ、技術制約、フィルタリング、探索戦略、分割基準）を追加します。
修正実施後、mcp-serverディレクトリの全テスト732件が合格することを確認します。
workflow-pluginルートからの実行でも全テスト合格を検証し、前回タスクで修正したvitest設定との互換性を保証します。
