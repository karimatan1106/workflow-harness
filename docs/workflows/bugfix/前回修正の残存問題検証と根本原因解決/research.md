# 前回修正の残存問題検証と根本原因解決 — 調査結果

## サマリー

前回のP0修正（commit d4404b7）で修正した3件（FR-1/FR-2/FR-3）は全て正しく適用されていることを確認した。
しかし、同一テーブル内で修正漏れとなっていた新たな不整合が1件発見された。
definitions.tsを権威的ソースとして全フェーズのallowedBashCategories、subagentType、modelを照合した結果を以下に報告する。
NI-1は修正が必要な実質的な不整合であり、Orchestratorが誤った権限情報を参照するリスクがある。
NI-2はsubagent設定テーブルの欠落行だが、deployフェーズにsubagentが起動されることは稀であり実害は低い。
次フェーズで修正すべき項目はNI-1の1件である。

## 調査結果

本調査では、前回修正（d4404b7）の適用確認と、CLAUDE.mdテーブルとdefinitions.tsの全行照合を実施した。
調査対象は以下の4ファイルである。
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（権威的ソース）
- `C:\ツール\Workflow\CLAUDE.md`（ドキュメント側テーブル）
- `workflow-plugin/CLAUDE.md`（プラグイン側テーブル）
- `workflow-plugin/mcp-server/src/hooks/bash-whitelist.js`（実行時ホワイトリスト）

前回修正3件（FR-1/FR-2/FR-3）の適用状況をすべて確認し、正常に反映されていることを検証した。
追加調査として、CLAUDE.mdのBashコマンド許可カテゴリテーブル（169-184行）の全24行をdefinitions.tsと1行ずつ照合した結果、ci_verificationの1行のみが不一致であった（NI-1）。
ci_verificationは前回の修正対象外であったにもかかわらず、definitions.tsでreadonlyのみに設定されており、CLAUDE.mdが「readonly, testing」と記載しているため乖離が生じていた。

## 既存実装の分析

### definitions.ts の設計と役割

`workflow-plugin/mcp-server/src/phases/definitions.ts` はPHASE_GUIDESオブジェクトを通じて全フェーズの設定を一元管理する権威的ソースである。
各フェーズエントリには `allowedBashCategories`（文字列配列）、`subagentType`（文字列）、`model`（文字列）が定義されている。
フック（bash-whitelist.js、phase-edit-guard.js）はこの設定を読み込んで実行時のコマンド制御を行う。
CLAUDE.mdのテーブルはdefinitions.tsの設定をドキュメント化したものだが、自動同期の仕組みがなく手動管理に依存している。
このため、definitions.tsが変更された際にCLAUDE.mdの対応行が更新されないケースが繰り返し発生している。

### bash-whitelist.js の実装構造

`bash-whitelist.js` はgetWhitelistForPhase関数を提供し、フェーズ名を受け取って許可コマンドの配列を返す。
関数内部ではdefinitions.tsのallowedBashCategoriesを参照し、カテゴリ名に対応するコマンドセットを結合して返す実装になっている。
実在するカテゴリは readonly、testing、implementation、git の4種類で、deployカテゴリは存在しない。
commit/push フェーズでは allowedBashCategories に `readonly` と `implementation` が設定されているが、git操作はgetWhitelistForPhase内の特殊処理で別途追加される。
この特殊処理により、CLAUDE.mdのテーブルに「git」カテゴリが記載されていなくても、commit/pushフェーズでgit操作が許可される。

## definitions.ts の全フェーズ設定一覧

definitions.tsのPHASE_GUIDESから抽出した全フェーズ設定を以下に示す。

| フェーズ | allowedBashCategories | subagentType | model |
|---------|----------------------|--------------|-------|
| research | readonly | general-purpose | sonnet |
| requirements | readonly | general-purpose | sonnet |
| threat_modeling | readonly | general-purpose | sonnet |
| planning | readonly | general-purpose | sonnet |
| state_machine | readonly | general-purpose | haiku |
| flowchart | readonly | general-purpose | haiku |
| ui_design | readonly | general-purpose | sonnet |
| design_review | readonly | general-purpose | sonnet |
| test_design | readonly | general-purpose | sonnet |
| test_impl | readonly, testing | general-purpose | sonnet |
| implementation | readonly, testing, implementation | general-purpose | sonnet |
| refactoring | readonly, testing, implementation | general-purpose | haiku |
| build_check | readonly, testing, implementation | general-purpose | haiku |
| code_review | readonly | general-purpose | sonnet |
| testing | readonly, testing | general-purpose | haiku |
| regression_test | readonly, testing | general-purpose | haiku |
| manual_test | readonly | general-purpose | sonnet |
| security_scan | readonly, testing | general-purpose | sonnet |
| performance_test | readonly, testing | general-purpose | sonnet |
| e2e_test | readonly, testing | general-purpose | sonnet |
| docs_update | readonly | general-purpose | haiku |
| commit | readonly, implementation | general-purpose | haiku |
| push | readonly, implementation | general-purpose | haiku |
| ci_verification | readonly | general-purpose | haiku |
| deploy | readonly | general-purpose | haiku |

## CLAUDE.md テーブルとの照合結果

### フェーズ別Bashコマンド許可カテゴリテーブル（CLAUDE.md 169-184行）

前回修正済みの項目（FR-2: deploy、FR-3: test_impl分割）は正しく反映されている。
新たに発見された不一致は以下の1件である。

| CLAUDE.md の記載 | definitions.ts の値 | 判定 |
|-----------------|---------------------|------|
| ci_verification: readonly, testing | readonly | 不一致（NI-1） |

その他の全行（research/requirements、threat_modeling/planning、設計フェーズ群、test_impl、implementation/refactoring、build_check、testing/regression_test、security_scan/performance_test/e2e_test、commit/push、deploy）は全てdefinitions.tsと完全一致を確認した。

### フェーズ別subagent設定テーブル（CLAUDE.md 141-163行）

全フェーズのsubagent_typeとmodelをdefinitions.tsと照合した結果、全行が一致していた。
ただしsubagent設定テーブルにはci_verificationとdeployの行が含まれていない（テーブルがpushで終了している）。
これは既存の欠落（NI-2）であるが、これらのフェーズでsubagentを起動する頻度は低いため実害は限定的である。

## workflow-plugin/CLAUDE.md の照合結果

前回のFR-1修正（submodule commit 9c4b0f9）により、planning行のsubagent_typeが'general-purpose'に統一されていることを確認した。
並列フェーズ実行コード例の2行（threat_modeling、planning）ともに正しいsubagent_typeが記載されており、修正は完全に適用されている。
workflow-plugin/CLAUDE.md内のフェーズ別subagent設定テーブルをdefinitions.tsと照合した結果、全行が一致していた。
Bashコマンド許可カテゴリに関するテーブルをworkflow-plugin/CLAUDE.md内で確認したが、該当テーブルはCLAUDE.md（プロジェクトルート）側に存在し、workflow-plugin/CLAUDE.md側には重複記載がないため照合対象外となった。
その他のコード例、コメント行についても不整合は検出されなかった。

## bash-whitelist.js カテゴリ定義の照合結果

bash-whitelist.jsに実在するカテゴリは以下の4つである。

- readonly: ls, cat, head, tail, grep, find, wc, git status/log/diff/show/branch等
- testing: npm test, npx vitest, npx jest, npx mocha等
- implementation: npm install, npm ci, pnpm install, npm run build, mkdir, rm等
- git: git add, git commit, git push, git pull, git fetch等

CLAUDE.md のテーブルに記載された全カテゴリ（readonly, testing, implementation）はbash-whitelist.jsに実在する。
前回修正で削除されたdeployカテゴリはbash-whitelist.jsに定義が存在しなかったため、削除は正しかった。
commit/push行に記載されたreadonly, implementationはdefinitions.tsの値と一致しており、bash-whitelist.jsのgitカテゴリはgetWhitelistForPhase関数の特殊処理で適用される。

## 前回修正の検証結果

前回修正（d4404b7）の3件は全て正しく適用されていることを確認した。

- FR-1: workflow-plugin/CLAUDE.md planning行のsubagent_typeが'general-purpose'に修正済み
- FR-2: CLAUDE.md deploy行がreadonlyのみに修正済み
- FR-3: CLAUDE.md test_impl行が2行に分割され、test_implはreadonly, testingのみ

修正による副作用（他の行への意図しない変更）は検出されなかった。

## 発見された問題一覧

### NI-1（高優先度）: ci_verification の許可カテゴリ不一致

CLAUDE.md 181行目でci_verificationが「readonly, testing」と記載されているが、definitions.tsではreadonlyのみと定義されている。
Orchestratorがこの誤った情報を参照すると、ci_verificationフェーズのsubagentに過剰なtestingカテゴリの権限情報を伝達する。
実際のフック動作はdefinitions.tsに基づくためテストコマンドはブロックされるが、ドキュメントとの齟齬がsubagentの混乱を招く。

### NI-2（低優先度）: subagent設定テーブルの欠落行

CLAUDE.md のフェーズ別subagent設定テーブルにci_verificationとdeployの行が含まれていない。
これらのフェーズでsubagentが起動される頻度は低いが、テーブルの網羅性としては不完全である。

## 根本原因分析

### 直接原因

前回のP0修正（91c3270およびd4404b7）ではdeploy行とtest_impl行に焦点が当てられ、同一テーブル内のci_verification行は修正対象から除外されていた。
definitions.tsでは91c3270の時点でci_verificationのallowedBashCategoriesがreadonlyのみに変更されていたが、CLAUDE.mdの対応行が更新されなかった。

### 構造的原因

CLAUDE.mdのテーブルは手動管理であり、definitions.tsの変更と自動同期される仕組みがない。
フェーズごとの設定変更時にdefinitions.tsのみが更新され、CLAUDE.mdの対応行の更新が見落とされるパターンが繰り返し発生している。
前回のFR-2（deploy行）と同一の根本原因（ドキュメントとコードの手動同期の不備）である。

### 再発防止

definitions.tsを変更する際は、CLAUDE.mdの対応テーブル行も同時に更新する運用ルールが必要である。
理想的にはdefinitions.tsから自動生成する仕組みの導入が望ましいが、現状は手動照合で対応する。
