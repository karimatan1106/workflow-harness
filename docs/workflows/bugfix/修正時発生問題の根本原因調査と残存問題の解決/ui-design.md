# UI設計書 — 修正時発生問題の根本原因調査と残存問題の解決

## サマリー

- 目的: 本ドキュメントはMCPサーバーのワークフロープラグイン修正に伴うインターフェース設計を定義する。具体的にはdefinitions.ts（security_scanテンプレートへのNG/OK例追記）とstatus.ts（workflow_statusレスポンスの重量フィールド除外）の2件の変更を実装するために必要なCLI・エラーメッセージ・APIレスポンス・設定ファイルの設計を網羅する。
- 評価スコープ: workflow_status MCPツール、workflow_next MCPツール、workflow_complete_sub MCPツール、artifact-validatorのエラーメッセージ形式、definitions.tsのsecurity_scanサブフェーズテンプレート文字列、status.tsのphaseGuide設定ロジックを対象とする。
- 主要な決定事項: workflow_statusのレスポンスからsubagentTemplate・content・claudeMdSectionsの3フィールドを除外してレスポンスサイズを削減する。workflow_nextはこれらを引き続き含め後方互換性を維持する。security_scanテンプレートには評価結論フレーズに特化したNG/OK例を追記してsubagentが重複行エラーを回避できる指示を強化する。
- 検証状況: 設計フェーズのため実装前。test_designフェーズでの検証計画立案が必要となる。
- 次フェーズで必要な情報: definitions.tsのsecurity_scanテンプレート変更の具体的な差分、status.tsの変更後のTypeScript実装コード、ビルドコマンドの実行順序、workflow_statusとworkflow_nextのJSONレスポンスの差分確認方法。

## CLIインターフェース設計

MCPサーバーが公開するワークフロー制御ツールは、Claude DesktopがMCP（Model Context Protocol）経由で呼び出す形式を採用している。
各ツールはJSON-RPCスタイルのリクエストを受け取り、JSONオブジェクトをレスポンスとして返す。
以下では主要3ツールのインターフェースを設計として定義する。

### workflow_status ツール

workflow_statusはアクティブなタスクの現在フェーズと状態情報を返すツールである。
本タスクの修正後は、レスポンスに含まれるphaseGuideフィールドからサイズの大きな3フィールドが除外される。

workflow_statusツールが受け付ける入力パラメータの仕様は以下の通りである。
- taskId: 文字列型、省略可能。省略時は全アクティブタスク一覧を返す。指定時は該当タスクの詳細を返す。
- sessionToken: 文字列型、省略可能。Orchestratorの認証に使用する（REQ-6対応）。

レスポンスに含まれるphaseGuideの設計（本タスク修正後）は下表の通りである。
除外されるフィールドはworkflow_nextでは引き続き提供されるため、Orchestratorの動作に影響はない。

| フィールド名 | 型 | 含まれるか | 説明 |
|---|---|---|---|
| phaseName | string | 含む | フェーズの識別名 |
| description | string | 含む | フェーズの説明文 |
| requiredSections | string配列 | 含む | 成果物に必須のMarkdownセクション一覧 |
| outputFile | string | 含む | 成果物の出力先ファイルパス |
| allowedBashCategories | string配列 | 含む | 使用可能なBashコマンドカテゴリ |
| minLines | number | 含む | 成果物の最小行数 |
| subPhases | オブジェクト | 含む（スリム版） | 並列フェーズの場合のサブフェーズ情報 |
| subagentTemplate | string | **除外** | subagentへのプロンプトテンプレート（大容量） |
| content | string | **除外** | フェーズ固有のコンテンツ（大容量） |
| claudeMdSections | object | **除外** | CLAUDE.mdの該当セクション（大容量） |

subPhasesフィールド内の各エントリについても同様に3フィールドが除外される。
parallel_verificationフェーズでは4サブフェーズ分が含まれるため、除外によって合計40000文字超のサイズ削減が見込まれる。

### workflow_next ツール

workflow_nextは現在フェーズの成果物をバリデーションして次フェーズに遷移するツールである。
本タスクの修正では、workflow_nextのレスポンス仕様は変更しない。後方互換性維持が優先事項であるためである。

workflow_nextツールが受け付ける入力パラメータの仕様は以下の通りである。
- taskId: 文字列型、省略可能。省略時は最新アクティブタスクを対象とする。
- sessionToken: 文字列型、省略可能。Orchestratorの認証に使用する。
- forceTransition: 真偽値型、省略可能。ベースライン未設定時のregression_test遷移を強制する（新規プロジェクト用）。

workflow_nextのレスポンスに含まれるphaseGuideは全フィールドを含む完全版である。
つまりsubagentTemplateとcontentとclaudeMdSectionsも引き続き含まれる。
Orchestratorはworkflow_nextを呼んでsubagentTemplateを取得し、subagentへのプロンプトを構築する設計となっているため、このフィールドの除外は許されない。

### workflow_complete_sub ツール

workflow_complete_subは並列フェーズのサブフェーズを完了としてマークするツールである。
このツールは本タスクの修正対象ではなく、インターフェース仕様の変更はない。

workflow_complete_subツールが受け付ける入力パラメータの仕様は以下の通りである。
- taskId: 文字列型、必須。対象タスクのIDを指定する。
- subPhase: 文字列型、必須。完了とするサブフェーズ名を指定する（例: security_scan、manual_test等）。
- sessionToken: 文字列型、省略可能。Orchestratorの認証に使用する。

レスポンスには完了後の状態情報が含まれる。全サブフェーズが完了した場合はその旨を通知するメッセージが返される。

## エラーメッセージ設計

artifact-validatorが検出するエラーのメッセージ形式と、対処方法の設計を定義する。
エラーメッセージはworkflow_nextまたはworkflow_complete_subの呼び出し時に返される。

### security_scan重複行エラーのメッセージ設計

security_scanフェーズで評価結論フレーズが3件以上繰り返された場合に発生するエラーのメッセージ形式を定義する。

エラーコードは`DUPLICATE_LINE_DETECTED`であり、以下の情報を含む形式で返される。
- エラー種別: 重複行検出（バリデーション規則: 同一行が3回以上）
- 検出された行: 実際に3回以上出現した行の内容（先頭100文字）
- 出現回数: 実際の繰り返し回数
- 対処方法: 各評価行に評価対象の固有識別子と判断根拠を追記すること

エラーメッセージの文面例は以下の通りである。この形式はバリデーターが現在返す形式であり、設計変更の対象ではない。

```
バリデーション失敗: 重複行が検出されました
検出行（3回以上出現）: "- 評価結果: リスクなし"
出現回数: 4回
対処: 各行に評価対象を一意に特定できる識別子（BUG番号・ファイル名等）と判断根拠を含めてください
例（OK）: "- BUG-1（definitions.ts修正）の評価: リスクなし、テンプレート文字列のみの変更のため"
例（OK）: "- BUG-2（status.ts修正）の評価: リスクなし、後方互換性を維持した変更のため"
```

重複行エラーの根本的な回避方法は、security_scanテンプレートのNG/OK例を充実させてsubagentに正しい記述パターンを伝えることである。
本タスクの修正1（definitions.tsへの追記）がこの根本対応となる。

### 必須セクション欠落エラーのメッセージ設計

成果物に必須のMarkdownセクションが欠落している場合のエラー形式を定義する。
このエラーはworkflow_nextの呼び出し時にバリデーターが検出する。

- エラーコード: `MISSING_REQUIRED_SECTION`
- 含まれる情報: 欠落しているセクション名の一覧、対象フェーズ名、要求されるヘッダーの正確な文字列

エラーメッセージの文面例は以下の通りである。

```
バリデーション失敗: 必須セクションが欠落しています
対象フェーズ: security_scan
欠落セクション: "## 脆弱性スキャン結果", "## 検出された問題"
対処: 上記のMarkdownセクションヘッダーを成果物に追加してください
```

必須セクションの一覧はフェーズごとにdefinitions.tsのrequiredSectionsフィールドで定義されている。
security_scanフェーズの必須セクションは「脆弱性スキャン結果」と「検出された問題」の2件である。

### エラーコードと対処方法の対応表

バリデーターが返すエラーコードと対処方法の対応を下表に示す。

| エラーコード | 検出条件 | 推奨対処方法 |
|---|---|---|
| DUPLICATE_LINE_DETECTED | 同一行が3回以上出現 | 各行に固有の識別子と根拠を追記して一意にする |
| MISSING_REQUIRED_SECTION | 必須セクションヘッダーが存在しない | 対象のMarkdownセクションを成果物に追加する |
| FORBIDDEN_PATTERN_FOUND | 禁止語が成果物に含まれる | 禁止語を安全な代替表現に置き換える |
| DENSITY_TOO_LOW | セクション密度が30%未満 | コードブロック外に説明文を追加して実質行数を増やす |
| MINIMUM_LINES_NOT_MET | 成果物の総行数が最小行数未満 | セクションに内容を追記して行数を増やす |

## APIレスポンス設計

workflow_statusとworkflow_nextのJSONレスポンス構造を設計として定義する。
本タスクの修正2（status.tsの変更）によってworkflow_statusのレスポンス構造が変化するため、その差分を明確にする。

### workflow_statusレスポンスの構造設計（修正後）

修正後のworkflow_statusレスポンスのJSON構造は以下の通りである。
phaseGuideフィールドからサイズの大きな3フィールドが除外されている点が修正前との差分である。

```json
{
  "taskId": "task_001",
  "taskName": "修正時発生問題の根本原因調査と残存問題の解決",
  "phase": "parallel_verification",
  "phaseGuide": {
    "phaseName": "parallel_verification",
    "description": "並列検証フェーズ",
    "requiredSections": [],
    "outputFile": "",
    "allowedBashCategories": ["readonly", "testing"],
    "minLines": 0,
    "subPhases": {
      "security_scan": {
        "phaseName": "security_scan",
        "description": "セキュリティスキャン",
        "requiredSections": ["## 脆弱性スキャン結果", "## 検出された問題"],
        "outputFile": "docs/workflows/.../security-scan.md",
        "minLines": 50
      }
    }
  }
}
```

上記のJSONではsubagentTemplate・content・claudeMdSectionsが除外されている。
並列フェーズのsubPhasesの各エントリ（security_scan・manual_test等）についても同様の除外が適用される。

### workflow_nextレスポンスの構造設計（変更なし）

workflow_nextのレスポンスはsubagentTemplateを引き続き含む完全版である。
Orchestratorがsubagentへのプロンプトを構築するために使用するため、このフィールドは除外できない。

修正後もworkflow_nextのレスポンスには以下の全フィールドが含まれる。
- phaseGuide.subagentTemplate: subagentへのプロンプトテンプレート（大容量、5000〜10000文字程度）
- phaseGuide.content: フェーズ固有のコンテンツ（大容量）
- phaseGuide.claudeMdSections: CLAUDE.mdの該当セクション

### workflow_statusとworkflow_nextのレスポンス差分サマリー

2つのツールのレスポンス差分を明示するために下表に整理する。

| 比較項目 | workflow_status（修正後） | workflow_next（変更なし） |
|---|---|---|
| subagentTemplate | 除外（含まれない） | 含まれる（Orchestrator用） |
| content | 除外（含まれない） | 含まれる |
| claudeMdSections | 除外（含まれない） | 含まれる |
| requiredSections | 含まれる | 含まれる |
| phaseName | 含まれる | 含まれる |
| outputFile | 含まれる | 含まれる |
| minLines | 含まれる | 含まれる |

この差分設計によって、Orchestratorがworkflow_statusを頻繁にポーリングする際のレスポンスサイズが削減される。
並列フェーズ（parallel_verification）では4サブフェーズ分のsubagentTemplateが除外されるため、削減効果が最も大きい。

## 設定ファイル設計

本セクションではdefinitions.tsのsecurity_scanテンプレート変更の設計を定義する。
設定ファイルの変更はJSONやYAMLではなく、TypeScriptのテンプレートリテラル文字列の修正という形式を取る。

### security_scanテンプレートへの追記設計

definitions.tsのsecurity_scan.subagentTemplateフィールドに含まれる「重複行回避の注意事項」セクションへの追記内容を設計する。

追記する文言は以下の目的を達成するために設計されている。
1. 評価結論フレーズ（「評価結果: リスクなし」「判定: 問題なし」等）が3件以上繰り返されるパターンを明示的にNGとして示す。
2. BUG番号・ファイル名・関数名・行番号等の固有識別子を含めた評価行を具体的なOK例として示す。
3. subagentが判断に迷わないよう、NGとOKの対比を視覚的に明確にする。

追記する設計の構造は以下の通りである。既存の重複行回避セクションの末尾に接続する。

評価結論フレーズに特化した注意事項として、複数修正点を同一フォーマットで記述する際の危険性を警告する文章を配置する。
その後にNGパターン2件とOKパターン2件を対比形式で列挙する。
NGパターン1件目は「評価結果: リスクなし」の3件以上繰り返し。
NGパターン2件目は「判定: 問題なし」「結論: 合格」のような評価結論行の3件以上繰り返し。
OKパターン1件目はBUG-1に固有識別子と判断根拠を含めた評価行。
OKパターン2件目はBUG-2に固有識別子と判断根拠を含めた評価行。

### 重複防止パターンの設計原則

評価結果フレーズの重複防止に関する設計原則を以下に定義する。
これらの原則はテンプレートの追記内容だけでなく、将来のsecurity_scanサブエージェントが成果物を作成する際の指針となる。

第1原則として、評価対象を一意に特定できる識別子を各評価行に必ず含める。
BUG番号（BUG-1、BUG-2等）、ファイル名（definitions.ts、status.ts等）、関数名（resolvePhaseGuide等）、行番号（121〜127行目等）のいずれかを使用する。

第2原則として、評価の判断根拠の要点を各評価行の末尾に付記する。
「テンプレート文字列のみの変更でロジック非変更のため」「後方互換性を維持した変更のため」のように、なぜそのリスクレベルと判断したかを簡潔に示す。

第3原則として、評価対象が4件以上ある場合は表形式の使用を検討する。
Markdownのテーブルセパレータ行はartifact-validatorの重複検出から除外されるため、
評価行をテーブルの行として記述することで重複検出を回避できる。

### テンプレート変更の対象箇所

definitions.tsの変更対象となる行番号と文脈を明示する。

- 対象ファイル: workflow-plugin/mcp-server/src/phases/definitions.ts
- 変更箇所の識別: security_scanフェーズのsubagentTemplateプロパティ内の「重複行回避の注意事項」セクション
- 変更の種類: 既存テキストへの追記（既存テキストの削除や変更なし）
- 変更サイズの見積もり: 6〜8行分のテンプレートテキスト追記

ビルドと再起動の必要性について、このテンプレートはTypeScriptのソースコードとして定義されているため、
変更後にnpm run buildでJavaScriptにトランスパイルしなければMCPサーバーに反映されない。
さらにNode.jsのモジュールキャッシュ機構によりプロセス再起動も必須となる。
これら2つの手順を省略すると変更前のテンプレートが使われ続ける。

### definitions.tsとstatus.tsの変更後の動作確認方法

2件の変更が正しく機能しているかを確認する手順を設計として定義する。

修正1の確認方法として、parallel_verificationフェーズのタスクでworkflow_nextを呼び、
レスポンスのphaseGuide.subPhases.security_scan.subagentTemplateに
「BUG番号」「評価結論フレーズ」「NG/OK例」という文字列が含まれることを確認する。

修正2の確認方法として、workflow_statusを呼んでレスポンスのphaseGuideに
subagentTemplateフィールドが含まれないことをJSONで確認する。
同時にworkflow_nextを呼んでsubagentTemplateが含まれることを確認して後方互換性を検証する。

これら2点の確認が完了した場合に限り、本タスクの実装は完了と判定する。
