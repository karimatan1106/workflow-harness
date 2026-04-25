# 調査結果: ワークフロープロセス阻害要因解消

## サマリー

- 目的: 前回タスク完了後の監査で発見された8件のワークフロープロセス阻害要因を調査する
- 主要な発見: bash-whitelist.js に5件、phase-edit-guard.js に2件、enforce-workflow.js に1件の問題が存在
- 重要度内訳: Critical（プロセス停止レベル）4件、High（機能制限レベル）3件、Low（整合性問題）1件
- 修正対象ファイル: workflow-plugin/hooks/ 配下の3ファイル
- 次フェーズで必要な情報: 各問題の具体的な修正方法とテスト戦略の策定

## 調査結果

前回タスク「ワークフロー残存阻害要因C1-C3修正」の完了後に実施した包括的監査により、
ワークフロープロセスの実行を妨げる8件の新たな問題が発見された。
これらはいずれもフックスクリプトの不備に起因するもので、
特にbash-whitelist.jsのフェーズマッピングとコマンド分割処理に集中している。
以下、各問題の詳細な調査結果を記載する。

### D-1: ci_verificationフェーズがgetWhitelistForPhase()に未登録（Critical）

bash-whitelist.jsのgetWhitelistForPhase()関数（行180-226）において、
ci_verificationフェーズが readonlyPhases, docsUpdatePhases, verificationPhases,
testingPhases, implementationPhases, gitPhases のいずれの配列にも含まれていない。
その結果、else節（行224）にフォールバックし BASH_WHITELIST.readonly のみが適用される。
CI検証に必要な gh コマンド（GitHub CLI）が実行できず、ワークフローのci_verificationフェーズが機能しない。

### D-2: deployフェーズがgetWhitelistForPhase()に未登録（Critical）

D-1と同様に、deployフェーズもgetWhitelistForPhase()のどのフェーズグループにも含まれていない。
デプロイに必要なコマンド群が実行できないため、ワークフローのdeployフェーズが機能しない。
deployフェーズでは docker, kubectl, ssh 等のデプロイコマンドが必要となる可能性があるが、
現在はreadonly扱いになっている。
修正としてverificationPhasesまたは専用のdeployグループに追加する必要がある。

### D-3: `|| true` がsplitCompoundCommandで分割される（Critical）

splitCompoundCommand()の行315で正規表現 `/\s*(?:&&|\|\||;|\|)\s*/` によりコマンドを分割している。
この正規表現には `\|\|` が含まれているため、`cmd || true` のようなシェルイディオムが
`["cmd", "true"]` の2つのパートに分割される。
`true` コマンドはBASH_WHITELISTのどのリストにも登録されていないため、ホワイトリスト検証で失敗する。
同様に `false`, `exit 0`, `exit 1` 等のシェル組み込みコマンドも影響を受ける。

### D-4: `node filename` がホワイトリスト未登録（Critical）

BASH_WHITELIST.readonlyリスト（行31）には `node -e` のみが登録されている。
`node filename.js` 形式のコマンドは前方一致で `node -e` にマッチしないためブロックされる。
testing/implementationフェーズのホワイトリストにも `node` 単体は含まれていない。
テストスクリプトの実行には `node -e "require('...')"` 等の回避策が必要だが、
複雑なスクリプトの実行が著しく困難になっている。

### D-5: PHASE_ORDERに10フェーズが未登録（High）

phase-edit-guard.jsのPHASE_ORDER配列（行301-322）に以下の10フェーズが定義されていない。
parallel_analysis, parallel_design, parallel_quality の3つの並列親フェーズ、
regression_test, parallel_verification の2つの検証系フェーズ、
performance_test, e2e_test の2つの並列サブフェーズ、
push, ci_verification, deploy の3つの後期フェーズが欠けている。
これにより、findNextPhaseForFileType()のガイダンスメッセージの「次のフェーズ」情報が不正確になる。

### D-6: `git -C` がホワイトリストにマッチしない（High）

bash-whitelist.jsの行399で `partTrimmed.startsWith(allowedCommand)` によるマッチングを行っている。
ホワイトリストには `git status`, `git log`, `git diff` 等が登録されているが、
`git -C /path/to/dir status` のように `-C` オプション付きで実行するとマッチしない。
`git -C` はサブディレクトリのリポジトリを操作するための標準的なオプションであり、
現状ではブロックされるため `cd dir && git status` のような回避策が必要になっている。

### D-7: フックのブロックメッセージがstdoutに出力（High）

phase-edit-guard.jsのdisplayBlockMessage()関数（行1119-1151）では、
全てのブロックメッセージが console.log() を使ってstdoutに出力されている。
Claude Codeがブロックメッセージをstderrで受け取ることを期待している場合、
ブロック理由がユーザーに表示されない可能性がある。
ただしenforce-workflow.jsも同様にconsole.logを使っており、
現在のClaude Codeの仕様でstdoutが表示されるなら問題ない可能性もある。
要検証の上、必要に応じてconsole.errorに変更する。

### D-8: architecture_reviewフェーズの余剰定義（Low）

enforce-workflow.jsの行55に `'architecture_review': ['.md']` が、
phase-edit-guard.jsの行129-134にもarchitecture_reviewの PHASE_RULES 定義が残存している。
CLAUDE.mdで定義されているワークフローの19フェーズにはarchitecture_reviewは含まれておらず、
MCPサーバー側でもこのフェーズは遷移先として存在しない。
実害はないが、コードベースの整合性のために削除が望ましい。

## 既存実装の分析

### bash-whitelist.js の構造

getWhitelistForPhase()は6つのフェーズグループ（readonlyPhases, docsUpdatePhases,
verificationPhases, testingPhases, implementationPhases, gitPhases）に
フェーズを分類し、各グループに対応するBASH_WHITELISTのキーを返す関数である。
グループに含まれないフェーズはデフォルトでreadonly扱いとなる。
splitCompoundCommand()はシェルの複合コマンドを個別パートに分割し、
各パートを個別にホワイトリスト検証する仕組みである。

### phase-edit-guard.js の構造

PHASE_ORDERはfindNextPhaseForFileType()で使用され、
現在のフェーズで編集が許可されないファイルタイプに対して
「このファイルは{次のフェーズ名}フェーズで編集可能です」というガイダンスを生成する。
displayBlockMessage()はブロック時のユーザー向けメッセージ全体を構築する関数で、
ブロック理由、現在のフェーズ、許可ファイル、ガイダンスを含む。

### enforce-workflow.js の構造

PHASE_EXTENSIONSはフェーズごとに編集可能なファイル拡張子を定義するマップである。
各フェーズに対して許可される拡張子の配列が格納されており、
`*` はワイルドカードで全拡張子を許可する。
architecture_reviewは他のフェーズと同列に定義されているが、
実際のワークフロー遷移では使用されないデッドコードである。
