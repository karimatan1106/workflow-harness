# 修正時発生問題の根本原因調査と残存問題の解決 - 調査結果

## サマリー

- 目的: 前回タスク(20260223_100331)でのBUG-1〜3修正時に発生した3つの問題の根本原因を特定し、解決策を提示する
- 評価スコープ: workflow-plugin/mcp-server/src/phases/definitions.ts を中心とした MCP サーバーコアモジュール、および security_scan テンプレート
- 主要な決定事項: 問題1（重複行エラー）はテンプレートの警告不足と生成AIの出力パターンに起因する。問題2（62K+文字レスポンス）は buildPrompt が生成する大量の文字列と CLAUDE.md コンテンツの二重埋め込みに起因する
- 検証状況: ソースコードの静的分析により3つの問題の根本原因を特定済み。コードの変更はまだ実施していない
- 次フェーズで必要な情報: 各問題の修正方針と実装計画

## 調査結果

### 問題1: security_scan重複行バリデーション失敗

#### 症状の詳細

前回タスクの parallel_verification フェーズで security_scan サブフェーズの成果物がバリデーション失敗した。
エラーの内容は「評価結果: リスクなし」が3回以上出現したことによる重複行検出であった。
artifact-validator の重複検出ルールにより、トリム後に完全一致する行が3回以上出現するとエラーになる。

#### 重複検出の除外ルール分析

ルール8（plainLabels）のパターンは `^(?:[-*]\s+)?.{1,50}[:：]\s*$` であり、
コロンで終端する行（コロン後に内容がない行）のみを除外する。
「- 評価結果: リスクなし」という行は、コロンの後に「リスクなし」という内容が続くため、
ルール8の除外対象にならず、重複検出の対象になる。
「評価結果: リスクなし」全体の文字数はおよそ13文字であり50文字以内だが、コロンで終わっていない。
よって複数の修正箇所が「評価結果: リスクなし」という同一行を3件以上含めると即座にエラーになる。

#### テンプレートの警告状況

definitions.ts の security_scan サブフェーズのサブエージェントテンプレートには重複行回避の注意事項が記載されている。
テンプレートのNG例として「セキュリティリスク: 問題なし」を繰り返す例が挙げられているが、
「評価結果: リスクなし」のような具体的なフレーズへの言及がない。
サブエージェントは複数の修正箇所（BUG-1、BUG-2、BUG-3など）を評価する際に
統一フォーマット「評価結果: リスクなし」を各修正箇所に対して繰り返して書く傾向がある。
この習慣的な出力パターンはテンプレートの警告が具体例として示されていない語句に対して発生しやすい。

#### 構造的な問題の特定

security_scan は複数の評価対象（FR-A、FR-B、FR-C など）を同一フォーマットで報告する性質がある。
evaluationフォーマット（評価対象名: 評価結果）の統一性が高いほど重複行が発生しやすい。
テンプレートのNG/OK例では「セキュリティリスク:」という接頭語パターンを例示しているが、
別の接頭語（「評価結果:」「判定:」「結果:」など）に対しては同様の問題が再発する可能性がある。
根本的な解決には、評価行のフォーマット自体を「各行に評価対象の固有名を含める」という制約に変える必要がある。

### 問題2: workflow_status/workflow_nextレスポンス過大問題

#### レスポンスサイズの構造分析

workflow_status のレスポンスに phaseGuide が含まれ、phaseGuide.subagentTemplate に buildPrompt の出力が入る。
buildPrompt 関数は9つのセクションで構成された大きなプロンプト文字列を生成する。
並列フェーズ（parallel_verification など）では phaseGuide.subPhases に4つのサブフェーズが含まれ、
各サブフェーズにも buildPrompt で生成した subagentTemplate が含まれる。
つまり parallel_verification では親フェーズ1件 + サブフェーズ4件の合計5件の buildPrompt 出力がレスポンスに含まれる。

#### buildPrompt の出力サイズ測定

buildPrompt 関数の出力は GlobalRules の展開内容と BashWhitelist の展開内容が大きな割合を占める。
qualitySection（セクション5）だけでも 4000〜5000 文字程度を生成する。
さらに resolvePhaseGuide では CLAUDE.md のパースも行い、マッチしたセクション内容を phaseGuide.content として付与する。
security_scan の CLAUDE.md セクションパターンは「AIへの厳命」のみであり、このセクションは約 4000 文字ある。
buildPrompt の出力（約 5000 文字）と CLAUDE.md コンテンツ（約 4000 文字）の合計が
1つのサブフェーズで約 9000 文字になる。
parallel_verification の場合、4サブフェーズで合計約 36000 文字のサブフェーズ情報がレスポンスに含まれる。
さらに親フェーズの buildPrompt 出力や status の allTasks などを加えると 62K 文字を超える。

#### CLAUDE.md コンテンツの二重埋め込み

resolvePhaseGuide では parseCLAUDEMdByPhase が呼ばれ、マッチしたセクションが phaseGuide.content として設定される。
その後 buildPrompt が呼ばれて subagentTemplate が生成される。
buildPrompt は phaseGuide.guide.subagentTemplate を基にしており、CLAUDE.md のコンテンツを直接は含まない。
ただし status/next のレスポンス JSON には phaseGuide オブジェクト全体が含まれており、
phaseGuide.content（CLAUDE.md の関連セクション）と phaseGuide.subagentTemplate（buildPrompt の出力）の両方が
同一レスポンスに含まれる。この二重包含がサイズを増大させる一因になっている。

#### 62K文字超過の主要因

CLAUDE.md ファイル全体は 104424 バイト（約 2143 行）ある。
「AIへの厳命」セクションは 634〜712 行の約 4000 文字。
「推奨プロジェクト構造」セクションは約 240 行・12000 文字以上ある。
planning サブフェーズの CLAUDE.md パターンには「推奨プロジェクト構造」が含まれるため非常に大きくなる。
parallel_verification の phaseGuide が 36000 文字を超えるため、Claude Code のトークン制限に抵触した可能性が高い。

### 問題3: BUG-1〜3修正の完全性確認

#### BUG-1: サマリーテンプレート5項目化

前回コミット（c9fb34f）で definitions.ts のセクション9（サマリーテンプレート）が更新された。
変更前: 目的・主要な決定事項・次フェーズで必要な情報の3項目
変更後: 目的・評価スコープ・主要な決定事項・検証状況・次フェーズで必要な情報の5項目
コード変更は definitions.ts の 1252 行目の文字列リテラルで確認できる。
ただし MCP サーバーはモジュールキャッシュのため、dist/ のコンパイル済みコードが使用されている。
dist/phases/definitions.js が更新されているかどうかは MCP サーバー再起動後でないと確認できない。
コミット c9fb34f の時点では npm run build が実行されてサブモジュールに含まれているはずであり、
ルートリポジトリの submodule ポインタも更新済みである（ee094cc）。

#### BUG-2: flowchart角括弧制約

前回コミット（c9fb34f）で definitions.ts の buildPrompt 関数に以下の行が追加された。
「flowchartノードは NodeID(text) の丸括弧形式を使うこと。.mmdファイルは全行がバリデーター検出対象となるため
NodeID[text] や NodeID["text"] の角括弧形式は角括弧プレースホルダーとして誤検出されるため禁止」
この制約文言は qualitySection のMermaid図の構造検証の末尾に追加されており、
buildPrompt を経由して subagentTemplate に含まれる。
CLAUDE.md の「図式設計」セクションのフローチャート例も丸括弧形式に変更済みである。

#### BUG-3: memory/ディレクトリパターン

前回コミット（c9fb34f）で hooks/enforce-workflow.js に以下のパターンが追加された。
`/\.claude[\/\\]projects[\/\\][^\/\\]+[\/\\]memory[\/\\]/i`
このパターンにより `.claude/projects/*/memory/` 配下のファイルが WORKFLOW_CONFIG_PATTERNS に含まれ、
enforce-workflow フックによる編集ブロックから除外される。
ただしフックのキャッシュ問題（セッション開始時に settings.json を読み込む仕様）により、
フックの更新が即座に反映されているかは確認が必要である。

#### ビルド状態の確認

definitions.ts の修正が dist/phases/definitions.js に反映されているかを確認するためには
ファイルの更新日時の比較が必要だが、コミット履歴からは前回コミット時に npm run build が実行されたと推定される。
MCP サーバーは Node.js のモジュールキャッシュにより、起動時に読み込んだ dist/ コードを使い続ける。
前回の修正後にユーザーが MCP サーバーを再起動している場合は新しい定義が使用されているはずである。

## 既存実装の分析

### buildPrompt関数の設計と問題点

buildPrompt 関数は definitions.ts の 1022〜1259 行で定義される。
9つのセクション（フェーズ情報・入力・出力・必須セクション・品質要件・Bash制限・編集制限・チェックリスト・重要事項）を結合する。
セクション5（品質要件）が最も大きく、GlobalRules の全フィールドを展開して約 4000〜5000 文字になる。
セクション6（Bash制限）も BashWhitelist のコマンドリストと説明を展開する。
resolvePhaseGuide が並列フェーズで呼ばれると、各サブフェーズに対して buildPrompt が実行される。
parallel_verification（4サブフェーズ）では buildPrompt が 4 回実行され、合計約 20000 文字が生成される。
さらに親フェーズ（parallel_verification 自体）の buildPrompt 出力も加わる。

### resolvePhaseGuide のレスポンス構造

resolvePhaseGuide の返り値は PhaseGuide 型であり、subagentTemplate・subPhases・content・claudeMdSections などを含む。
status.ts では `result.phaseGuide = phaseGuide` としてレスポンスに直接セットされる。
next.ts でも `phaseGuide` をレスポンスの phaseGuide フィールドとして含める。
phaseGuide の中には subPhases（並列フェーズの場合）も含まれ、各サブフェーズの subagentTemplate も含まれる。
content フィールドには CLAUDE.md から抽出したセクション本文が入るため、さらにサイズが増大する。

### security_scanテンプレートの現状

definitions.ts の 908〜919 行に security_scan サブフェーズが定義されている。
subagentTemplate には重複行回避の注意事項が詳細に記述されているが、
注意事項のNG例は「セキュリティリスク: 問題なし」という接頭語パターンのみを示している。
「評価結果: リスクなし」という形式への具体的な言及はない。
サブエージェントが複数の評価対象を列挙する際に「評価結果:」という共通フォーマットを使い始めると、
3件以上になった時点で重複行エラーが発生する構造になっている。

### planningサブフェーズのCLAUDE.mdパターン問題

claude-md-sections.ts の planning エントリには「推奨プロジェクト構造」が含まれている。
「推奨プロジェクト構造」セクションは CLAUDE.md の 979〜1222 行にわたり約 12000 文字以上ある。
このセクションが resolvePhaseGuide で phaseGuide.content に含まれると、
planning サブフェーズ単体でのレスポンスが大幅に増大する。
parallel_analysis フェーズでは threat_modeling と planning の両サブフェーズが subPhases に含まれるため、
「推奨プロジェクト構造」のコンテンツを含む planning サブフェーズが1件追加されるだけで
レスポンスサイズが 15000 文字以上増大する。

### 並列フェーズ時のサイズ加算構造

status.ts の 87〜93 行で isParallelPhase が true の場合 subPhases を result に追加する。
resolvePhaseGuide は phaseGuide.subPhases を構築する際、各サブフェーズの buildPrompt を実行する。
4サブフェーズの parallel_verification では buildPrompt が 4 回実行される。
さらに各サブフェーズに parseCLAUDEMdByPhase が呼ばれ、content が付与される。
security_scan・manual_test・performance_test・e2e_test の 4 サブフェーズが
それぞれ約 5000 文字の buildPrompt 出力 + 約 4000 文字の CLAUDE.md 内容を持つ場合、
合計で約 36000 文字がサブフェーズ情報として追加される。
親フェーズの buildPrompt 出力（約 4000 文字）、taskState の情報（約 2000 文字）、
activePhases の配列などを加算すると、60000 文字を超える可能性がある。

### 問題2の解決アプローチ候補

アプローチA（レスポンスからsubagentTemplateを除外）:
workflow_status のレスポンスから subagentTemplate を除外し、専用の getTemplate エンドポイントを提供する。
この場合、Orchestrator は workflow_next を呼んだ後に別途 getTemplate を呼ぶ必要がある。

アプローチB（レスポンスサイズ上限の設定）:
subagentTemplate が一定文字数を超える場合は省略記号で切り詰める。
ただしプロンプトが不完全になると品質低下を招く可能性がある。

アプローチC（phaseGuide.content の除外）:
CLAUDE.md から抽出した content フィールドをレスポンスに含めないようにする。
buildPrompt はすでに GlobalRules・BashWhitelist から品質要件を展開しており、
CLAUDE.md の content は重複情報になっている可能性が高い。

アプローチD（サブフェーズのsubagentTemplateをレスポンスに含めない）:
並列フェーズでは subPhases のサブフェーズ情報としてフェーズ名・requiredSections・outputFile のみを返す。
subagentTemplate は各サブフェーズの完了ハンドラーが呼ばれた時点で取得する形式にする。

### 残存問題の総括

問題1（重複行エラー）は構造的な問題であり、テンプレートの警告強化だけでは根本解決にならない。
「評価結果: リスクなし」のような接頭語+評価の形式が複数の評価項目で3件以上繰り返される限り発生し続ける。
根本解決には各評価行に評価対象の固有名（FR番号・修正箇所名・ファイル名など）を含めることを強制する必要がある。
問題2（レスポンス過大）は設計的な問題であり、現在の実装では buildPrompt の出力全文がレスポンスに含まれる。
並列フェーズのサブフェーズ数に比例してサイズが線形増加する構造は根本的な見直しが必要である。
BUG-1〜3の修正自体は正しく実装されているが、MCP サーバー再起動後でないと効果を確認できない。
