# researchフェーズ: ワークフロー実行時の3つの根本問題修正

## サマリー

ワークフロー実行時に発生した3つの根本的な問題の原因を特定し、修正方針を提案する。
問題1はloop-detector-state.jsonの肥大化（107KB）によるフッククラッシュである。
問題2はsubagent成果物のバリデーション失敗でOrchestratorが手動修正を繰り返す必要がある。
問題3はスコープチェックが事前変更を検出しcommit遷移をブロックする。
全3問題とも根本原因が特定でき、いずれも修正難易度は低い。
優先度は問題1（緊急度高）、問題2（緊急度中）、問題3（緊急度低）の順である。

- 目的: 前タスク（phaseGuide追加）実行中に発生した3つの問題の根本原因特定と修正方針の提案
- 主要な決定事項: 問題1はファイルエントリのpruning機能欠如、問題2はバリデーションルールの具体例不足、問題3はpreExistingChangesの不完全な記録が根本原因
- 次フェーズで必要な情報: 各問題の修正方針（後述）を要件定義に反映すること

---

## 調査結果

### 問題1: loop-detector-state.jsonの肥大化（107KB）によるフッククラッシュ

#### 症状の詳細
- .claude/state/loop-detector-state.jsonが106KB（3320行）に肥大化した
- loop-detector.jsフックがNode.jsで処理する際に断続的にクラッシュし「No stderr output」エラーが発生する
- クラッシュによりEdit/Writeツールが使用不能になる

#### 根本原因

workflow-plugin/hooks/loop-detector.jsのコード調査結果は以下のとおりである。

古いタイムスタンプ削除は機能している。filterOldTimestamps関数（行276-287）が5分より古いタイムスタンプを削除し、checkLoop関数（行342）で毎回フィルタリングが実行される。

しかし、ファイルエントリ削除（pruning）メカニズムが欠如している。タイムスタンプが空になったファイルエントリ自体を削除する処理がない。saveState関数（行183-191）は状態をそのまま保存するのみであり、一度でも編集されたファイルのエントリが永久に残る。

状態ファイルの構造はfilesオブジェクト内にファイルパスをキー、count・timestamps・lastWarning・warningSuppressを値として持つ。過去のワークフローで編集された3000個以上のファイルエントリが蓄積されている。

問題の本質は、タイムスタンプが5分以上古くなってもエントリ自体は削除されないことである。ファイル数が3000個を超えるとJSONパースと処理に時間がかかりすぎてタイムアウト（3秒）に引っかかる。

#### 影響範囲
- Edit/Writeツール使用時に毎回loop-detector.jsが実行される
- 状態ファイルが大きいとフック処理が3秒タイムアウトに引っかかる
- タイムアウト発生時はexit code 2でブロックされEdit/Writeが不可能になる

#### 修正方針

推奨方針: checkLoop関数内でタイムスタンプ削除後に空になったエントリを削除する。具体的には、filterOldTimestampsの呼び出し後にtimestampsの長さが0かつlastWarningが未設定のエントリをstateオブジェクトから削除する処理を追加する。

補完方針: saveState関数内で保存前に空エントリを一括削除する。Object.entriesでstate.filesを走査しtimestampsが空かつlastWarningが未設定のエントリをフィルタリングして除外する。

推奨実装はcheckLoop内でのpruningを優先し、saveState内でのクリーンアップを補完的に追加する。

---

### 問題2: subagent成果物のバリデーション失敗

#### 症状の詳細
parallel_verificationフェーズのsubagentが生成した成果物（manual-test.md、security-scan.md、e2e-test.md、performance-test.md）がartifact-validatorの検証に繰り返し失敗した。

失敗パターンは3種類ある。第一に、同一行の繰り返しが3回以上検出される問題（「結果: パス」や「実装確認位置：」など）。第二に、セクション行数不足（5行未満）でサマリーセクションが1-3行しかない問題。第三に、コードブロック内のブラケット記法が検出される問題である。

#### 根本原因

artifact-validator.ts（行90-107）のisStructuralLine関数が構造要素を判定する。テーブルデータ行（行101）やMarkdownラベル（行103-105）も構造要素として除外される。同一行が3回以上出現すると「形式的テキスト」として検出（行319）され、各セクションに最低5行の実質行が必要（行643-722）で、セクション密度30%以上が必要（行707-711）である。

definitions.tsのPHASE_GUIDESにはフェーズごとの説明と許可拡張子を定義しているが、artifact-validatorの具体的なバリデーションルールは含まれていない。

CLAUDE.mdのsubagent起動テンプレート（行234-277）にはバリデーションルールが記載されているが、記述が一般的すぎる。「同じ行が3回以上出現しないこと」の具体例が不足しており、subagentは具体例なしに抽象的なルールを理解しづらい。

#### 影響範囲
- parallel_verificationフェーズの全サブフェーズに影響する
- Orchestratorが手動で成果物を修正する必要がありワークフローの自動化が阻害される

#### 修正方針

推奨方針: CLAUDE.mdのsubagent起動テンプレートにバリデーションルールの具体例を追加する。悪い例と良い例を並べて記述し、同一行の繰り返し禁止（各行をコンテキストで差別化する方法）、セクション密度30%の遵守方法（表形式で詳細を含める方法）、各フェーズの必須セクション名を明示する。

補完方針: definitions.tsのPHASE_GUIDESに各フェーズ固有のバリデーション要件を追加する。

推奨実装はCLAUDE.md改善を優先する（全subagentに適用されるため）。

---

### 問題3: スコープチェックが事前変更（pre-existing changes）をブロック

#### 症状の詳細
commitフェーズへの遷移時に、タスク開始前から存在したgit変更（remotionディレクトリの削除、.mcp.jsonの変更）がスコープ外として検出され遷移がブロックされた。手動でworkflow_set_scopeでremotion/を追加する回避策が必要だった。

#### 根本原因

start.tsのpreExistingChanges記録（行100-119）を調査した結果、git diff実行でHEADとの差分ファイルを取得しpreExistingChanges配列に格納する実装が確認できた。scopeオブジェクトにpreExistingChangesを保存し、scope-validator.tsのvalidateScopePostExecution関数（行781-786）でpreExistingChangesに含まれるファイルをスキップするロジックが実装されている。

next.tsのスコープ検証呼び出し（行366）でtaskState.scope?.preExistingChangesを取得し、undefinedの場合は空配列にフォールバックする。

preExistingChangesメカニズムは実装済みでコード上は正しく動作するはずであるが、実際のワークフロー実行時にブロックされた。

推定原因は3つある。第一に、workflow_start時にgit diff実行が失敗しpreExistingChangesが空配列になった可能性。第二に、エラーハンドリングでconsole.warnのみ実行され空配列が明示的に設定されずundefinedのまま保存された可能性。第三に、EXCLUDE_PATTERNSに.mcp.jsonが含まれていないため、事前変更であっても.mcp.jsonがスコープチェック対象になる。

EXCLUDE_PATTERNSの現状は、Markdownファイル、package.json、ロックファイル、.claude/state/配下、docs/workflows/配下、フェーズガードログ、ループ検出状態が定義されているが、.mcp.jsonは含まれていない。

#### 影響範囲
- docs_update → commitフェーズの遷移時のスコープ事後検証に影響する
- タスク開始前に設定ファイルを変更していた場合に意図せずブロックされる
- ユーザーが手動でworkflow_set_scopeを実行する必要がある

#### 修正方針

推奨方針: workflow_start時のエラーハンドリングを改善する。git diff失敗時でも確実に空配列を設定し、undefinedチェックを追加してtaskState.scope.preExistingChangesに空配列を確実に代入する。

補完方針1: EXCLUDE_PATTERNSに.mcp.json、.gitignore、.env.example、tsconfig.json、vitest.config.ts、vite.config.tsを追加する。

補完方針2: preExistingChangesのログ出力を強化し、workflow_start時に記録件数と先頭5件をconsole.logで出力して検証可能にする。

推奨実装はエラーハンドリング改善を優先し、EXCLUDE_PATTERNS拡張とログ出力を補完的に追加する。

---

## 既存実装の分析

### loop-detectorの状態管理
現状では古いタイムスタンプは削除されるがエントリ自体は残る。
loop-detection-log.jsonは100件に制限（行221）されているがloop-detector-state.jsonには制限がない。
タイムアウトは3秒（行428）で処理が完了しない場合はexit code 2でブロックされる。
フック実行はEdit/Write呼び出し時のPreToolUseイベントで発生する。
状態ファイルの読み込み・パース・検証・書き込みが毎回行われるためファイルサイズが性能に直結する。

### artifact-validatorの検証ロジック
検証は各フェーズの成果物作成後workflow_next実行時に行われる。
バリデーション項目は最小行数、必須セクション、禁止パターン、形式的テキスト検出、セクション密度、短い行の比率である。
バリデーションタイムアウトは10秒（行22）に設定されている。
各フェーズの必須セクションはPHASE_ARTIFACT_REQUIREMENTS定数で管理される。
検証失敗時はworkflow_nextがエラーを返し、フェーズ遷移がブロックされる。

### scope-validatorのpreExistingChanges処理
記録タイミングはworkflow_start実行時であり使用タイミングはdocs_update → commit遷移時のvalidateScopePostExecutionである。
除外ロジックはEXCLUDE_PATTERNS配列によるパターンマッチングとpreExistingChanges配列による個別除外の二重構造である。
gitキャッシュは30秒TTL（行57）でgit diff結果をキャッシュする。
SCOPE_STRICTモードがデフォルトで有効であり、スコープ外ファイルの変更はブロックされる。
サブモジュール変更はignore-submodulesオプションで除外されている。

---

## 提案する修正の優先順位

Priority 1は問題1（loop-detector肥大化）である。
緊急度は高でありフック完全クラッシュによりEdit/Writeが使用不能になる。
修正難易度は低でcheckLoop関数に数行追加するのみである。
修正ファイルはworkflow-plugin/hooks/loop-detector.jsの1ファイルである。
修正後は既存の肥大化した状態ファイルも自動的にクリーンアップされる。

Priority 2は問題2（subagent成果物バリデーション失敗）である。
緊急度は中でありOrchestrator手動修正で回避可能だが効率が悪い。
修正難易度は低でCLAUDE.mdのテンプレートに具体例を追加するのみである。
修正ファイルはCLAUDE.mdの1ファイルである。
この修正により全subagentがバリデーションルールを具体的に理解できるようになる。

Priority 3は問題3（preExistingChanges処理）である。
緊急度は低で手動でworkflow_set_scopeで回避可能である。
修正難易度は低でエラーハンドリング改善とEXCLUDE_PATTERNS拡張である。
修正ファイルはworkflow-plugin/mcp-server/src/tools/start.tsとscope-validator.tsの2ファイルである。
修正後は事前変更ファイルが自動的にスコープチェックから除外される。

---

## 技術的な考慮事項

### loop-detectorのpruning実装時の注意点
lastWarningが設定されているエントリはtimestampsが空でも削除してはいけない（警告抑止期間の管理のため）。
削除判定はtimestampsの長さが0かつlastWarningが未設定の条件を使用する。
saveState時の一括クリーンアップも同様の条件を使用する。
pruningはcheckLoop呼び出し時に行うため、フック実行のたびに自動的にクリーンアップが進む。
大量のエントリが存在する初回実行時は処理時間が長くなる可能性があるため、バッチ削除で対応する。

### artifact-validatorのバリデーション具体例の記述方法
悪い例と良い例を並べて記述し、コードブロック内ではなく散文で実際のMarkdown記述例を提示する。
構造要素除外の判定ロジック（テーブルデータ行やMarkdownラベルが除外される仕組み）を明示する。
各フェーズの必須セクション名はCLAUDE.mdのフェーズ詳細説明セクションに既に記載されている。
subagentが理解しやすい形式として、禁止パターンの具体的な文字列例を含める。
バリデーション要件はCLAUDE.mdの一箇所に集約し全subagentが参照できるようにする。

### preExistingChangesの記録タイミングの検証
workflow_start時にgit diffが失敗した場合のログ出力を確認する。
実際のワークフロー実行時にpreExistingChangesが正しく記録されているか検証する。
commitフェーズでのスコープ検証時にpreExistingChangesの内容をログ出力して確認できるようにする。
EXCLUDE_PATTERNSの拡張は設定ファイル系（.mcp.json等）が対象であり、ソースコードは除外しない。
デバッグログはconsole.log形式で出力しMCPサーバーの標準出力経由で確認できるようにする。
