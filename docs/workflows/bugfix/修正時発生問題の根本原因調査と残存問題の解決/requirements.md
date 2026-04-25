# 修正時発生問題の根本原因調査と残存問題の解決 - 要件定義

## サマリー

- 目的: 前回タスク（20260223_100331）でのBUG修正作業中に新たに発生した3つの問題について、根本原因分析に基づいた修正要件を定義する
- 評価スコープ: workflow-plugin/mcp-server/src/phases/definitions.ts（security_scanテンプレート・buildPrompt関数）、workflow-plugin/mcp-server/src/tools/status.ts および next.ts（レスポンス構造）、BUG-1〜3の修正確認対象ファイル
- 主要な決定事項: 問題1はsecurity_scanテンプレートへの「評価結果」フレーズ具体例の追加で対応し、問題2はworkflow_statusのレスポンスからsubagentTemplateおよびcontentフィールドを除外することで対応する
- 検証状況: ソースコードの静的分析と調査フェーズの成果物を基に要件を確定している。コードの実変更は実施フェーズ以降で行う
- 次フェーズで必要な情報: 修正対象ファイルのパスとライン番号、定義すべき修正箇所の詳細、BUG-1〜3の最終確認結果

## 背景

前回のBUG-1〜BUG-4修正タスク（コミット c9fb34f、ee094cc）の実施中に、parallel_verificationフェーズで新たな問題が3件発生した。
これらは前回タスクの修正作業が引き金となった副作用ではなく、元々存在していた構造的な問題が顕在化したものである。
本タスクでは3件の問題を個別に分析し、それぞれに対する修正要件を定義する。

## 機能要件

### FR-1: security_scanテンプレートへの重複行回避ガイダンス強化

security_scan サブフェーズの subagentTemplate（definitions.ts 918行目）に記述されている重複行回避の注意事項に、「評価結果:」形式の具体的なNG/OK例を追加する。

現在のテンプレートはFR番号と「問題なし」の組み合わせのみをNG例として示しているが、「評価結果: リスクなし」のような評価結論行が3件以上並ぶパターンについてのNG例が不足している。

追加すべき内容は以下の通りである。

複数の修正点（BUG-A・BUG-B・BUG-Cなど）を評価する際に同一の評価結論語（「評価結果: リスクなし」「判定: 問題なし」「結論: 合格」等）を3件以上繰り返すと重複行エラーが発生することを明記する。
各評価行には評価対象の修正点名（BUG番号・ファイル名・関数名）と判断根拠を含めて行全体を一意にすることを義務付ける説明を追加する。
manual_test・performance_test・e2e_testの各サブフェーズのテンプレートにも同様の注意事項を追加または強化することで、同種の問題の再発を防ぐ。

この修正はテンプレートの文字列リテラル変更のみであり、バリデーター本体のロジック変更は不要である。

### FR-2: workflow_statusレスポンスからsubagentTemplateとcontentフィールドを除外する

workflow_status ツール（status.ts 122〜127行目）が返すレスポンスに含まれる phaseGuide フィールドから、以下のフィールドを除外する。

除外対象フィールドの1つ目は subagentTemplate である。このフィールドはbuildPrompt関数が生成する5000〜10000文字程度の大容量テキストであり、parallel_verificationフェーズでは4サブフェーズ分が含まれ合計40000文字を超える。workflow_statusの本来の用途（現在の状態確認）には不要な情報である。

除外対象フィールドの2つ目は content である。このフィールドはCLAUDE.mdから抽出したセクション内容（最大12000文字以上）であり、すでにsubagentTemplateに品質要件が展開されているため重複情報となっている。

除外対象フィールドの3つ目はサブフェーズの subagentTemplate である。resolved.subPhases の各要素に含まれる subagentTemplate は、workflow_statusのレスポンスには不要である。

一方、workflow_next ツール（next.ts 629行目）が返すレスポンスの phaseGuide フィールドにはsubagentTemplateを引き続き含める。Orchestratorはworkflow_nextを呼んで次フェーズのtemlateを取得してsubagentを起動するため、このレスポンスからの除外は行わない。

この修正により、workflow_statusのレスポンスサイズを現状の62K文字から5K文字程度まで削減できると推定される。Claude Codeのコンテキスト消費が大幅に減少し、Orchestratorのトークン枯渇リスクが低下する。

### FR-3: BUG-1〜3修正の完全性確認

前回コミット（c9fb34f, ee094cc）で実施されたBUG-1〜3の修正について、現在のソースコードで正しく実装されていることを確認し、問題がある場合は修正する。

BUG-1のサマリーテンプレート5項目化については、definitions.ts 1252行目のimportantSectionに「目的・評価スコープ・主要な決定事項・検証状況・次フェーズで必要な情報」の5項目が含まれていることを確認済みである。コードは正しく実装されている。

BUG-2のflowchart角括弧制約については、definitions.ts 1183行目のqualitySectionに「flowchartノードはNodeID(text)の丸括弧形式を使うこと」という記述が追加されていることを確認済みである。コードは正しく実装されている。

BUG-3のmemory/ディレクトリパターンについては、workflow-plugin/hooks/enforce-workflow.js 224行目に正規表現パターン `/\.claude[\/\\]projects[\/\\][^\/\\]+[\/\\]memory[\/\\]/i` が追加されていることを確認済みである。コードは正しく実装されている。

上記3点はすべてソースコードレベルで正しく実装されており、MCPサーバー再起動後は正しく機能する状態である。dist/ディレクトリへのコンパイル済みファイルが最新状態に更新されているかの確認が必要である。

## 非機能要件

### NF-1: レスポンスサイズの削減目標

workflow_statusのレスポンスサイズを現状の62K文字超から10K文字以下に削減することを目標とする。
subagentTemplateとcontentフィールドを除外することで、並列フェーズの場合でも各サブフェーズの基本情報（フェーズ名・必須セクション・出力ファイルパス）のみがレスポンスに含まれる状態にする。
サブフェーズ情報として必要な最小限のフィールドは phaseName・description・requiredSections・outputFile・allowedBashCategories・minLines であり、これらは除外しない。

### NF-2: 後方互換性の維持

workflow_next のレスポンスには引き続きsubagentTemplateを含めることで、Orchestratorの動作に影響を与えない。
workflow_statusを呼んで状態確認のみを行う既存のコードパスは引き続き機能する。
phaseGuide.subPhasesの構造自体は維持し、各サブフェーズのフェーズ名・必須セクション等のメタ情報はworkflow_statusでも引き続き参照可能にする。

### NF-3: コード変更の最小性

修正はstatus.tsの1箇所（resolvePhaseGuideの呼び出し後にsubagentTemplateとcontentを除去するロジックの追加）と、definitions.tsのsecurity_scanテンプレート文字列の1箇所のみとする。
新しい関数や型の追加は原則として行わず、既存の構造を最大限に活用する。
テストコードの変更が必要な場合は最小限にとどめる。

### NF-4: MCPサーバー再起動の必要性への対応

definitions.tsおよびstatus.tsを変更した場合は、MCP サーバーを再起動してキャッシュされた旧バイナリを更新する必要がある。
ソースコード変更後にnpm run buildを実行してdist/以下の.jsファイルを更新し、その後MCPサーバーを再起動することを手順として定める。
これによりモジュールキャッシュに起因するバリデーション失敗の継続を防ぐ。

## 受入条件

### AC-1: security_scanテンプレート修正の受入条件

修正後のsecurity_scanテンプレートに「評価結果: リスクなし」のような評価結論行のNG例とその回避方法（評価対象名を含める）のOK例が明示的に記述されていること。
テンプレートの重複行回避セクションに、複数の修正点を評価する際の具体的な行フォーマット（修正点名を含む形式）の例示があること。
テンプレートが約3000文字以内に収まり、buildPromptで展開されたsubagentTemplateが15000文字を超えないこと（現状の10000〜12000文字程度を維持）。

### AC-2: workflow_statusレスポンス削減の受入条件

workflow_status を taskId 指定で呼び出した際のレスポンスJSONサイズが10KB以下になること（parallel_verificationフェーズを含む全フェーズで達成）。
workflow_status のレスポンスに phaseGuide.subagentTemplate が含まれないこと（並列フェーズのサブフェーズのsubagentTemplateも除外されること）。
workflow_status のレスポンスに phaseGuide.content が含まれないこと。
workflow_next のレスポンスには phaseGuide.subagentTemplate が引き続き含まれること（除外されないこと）。
Orchestrator が workflow_next → subagent起動 のフローを変更なしで継続できること。

### AC-3: BUG-1〜3確認の受入条件

dist/phases/definitions.js がソースコードと同期していること（npm run buildによる最新コンパイル済み）。
MCP サーバー再起動後にworkflow_statusを呼んで、現在のフェーズ情報が正しく返ることを確認できること。
security_scanフェーズのsubagentTemplateにflowchart丸括弧制約の記述が含まれていること。
enforce-workflow.jsにmemory/ディレクトリパターンが含まれていること。
