## サマリー

前回のP0修正コミット（91c3270）の適用後に残存する問題を包括的に調査した結果、3件の乖離が特定された。
全件ともCLAUDE.mdドキュメントとdefinitions.ts（正規ソース）の間の不整合であり、前回の修正範囲外だった箇所に起因する。
修正対象はルートCLAUDE.md（2箇所）とworkflow-plugin/CLAUDE.md（1箇所）の計3箇所である。

主要な発見事項として以下の3件が確認された。
- 問題1: workflow-plugin/CLAUDE.mdの並列フェーズ実行コード例に無効なsubagent_type値「Plan」が残存している
- 問題2: ルートCLAUDE.mdのBashカテゴリテーブルでdeploy行に架空の「deploy」カテゴリが記載されている
- 問題3: ルートCLAUDE.mdのBashカテゴリテーブルでtest_impl行にimplementationカテゴリが誤って含まれている

根本原因は、前回の修正がフェーズ別subagent設定テーブルの行レベル修正に限定されており、コード例ブロックやBashカテゴリテーブルの他の行まで検証範囲が及ばなかったことである。

---

## 調査方法

今回の調査では以下の4ファイルを対象に、definitions.tsを正規ソースとした包括的な整合性検証を実施した。

調査対象ファイル一覧として、workflow-plugin/mcp-server/src/phases/definitions.ts（正規ソース）、CLAUDE.md（ルート）、workflow-plugin/CLAUDE.md、およびworkflow-plugin/hooks/bash-whitelist.jsを精査した。前回コミット91c3270の変更差分も確認し、修正範囲と修正漏れの境界を特定した。

definitions.tsの全25フェーズ（サブフェーズ含む）のsubagentType・model・allowedBashCategoriesを網羅的に抽出し、両CLAUDE.mdの記述と突合した。

検証手法として、definitions.ts内の設定を行単位で確認し、対応するCLAUDE.mdセクションに同一の値が記述されているか確認した。
コード例ブロック、テーブル行、説明文の3つのレベルで検証を実施し、どの箇所で乖離が存在するかを特定した。
bash-whitelist.jsの有効カテゴリ定義も確認し、CLAUDE.mdテーブルで参照されているカテゴリが全て実装に存在するかを検証した。

---

## 調査結果

前回のP0修正コミット（91c3270）以降に残存する乖離は、以下の3件が確認された。

**問題1**: workflow-plugin/CLAUDE.mdのコード例内に無効なsubagent_type値「Plan」が残存。definitions.tsでは全フェーズがgeneral-purposeで統一されているため、この記述は実行不可能である。

**問題2**: ルートCLAUDE.mdのBashカテゴリテーブルにおいて、deployフェーズの許可カテゴリが「readonly, implementation, deploy」と記載されているが、definitions.tsでは「readonly」のみが設定されている。さらにdeployカテゴリはbash-whitelist.jsに存在しない架空のカテゴリである。

**問題3**: ルートCLAUDE.mdのBashカテゴリテーブルにおいて、test_impl行にimplementationカテゴリが誤って含まれている。test_implはテストコード先行作成フェーズ（TDD Red Phase）であり、definitions.tsでは「readonly, testing」のみが許可されている。

これら3件の乖離は、前回修正の検証範囲がフェーズ別subagent設定テーブルに限定されていたため、コード例ブロックやBashカテゴリテーブルの詳細行の検証が漏れていた。

---

## 既存実装の分析

definitions.tsの全フェーズ設定（正規ソース）

definitions.tsから抽出した全フェーズ設定を以下に示す。全25フェーズでsubagentTypeはgeneral-purposeに統一されている。

| フェーズ | subagentType | model | allowedBashCategories |
|---------|-------------|-------|----------------------|
| research | general-purpose | sonnet | readonly |
| requirements | general-purpose | sonnet | readonly |
| threat_modeling | general-purpose | sonnet | readonly |
| planning | general-purpose | sonnet | readonly |
| state_machine | general-purpose | haiku | readonly |
| flowchart | general-purpose | haiku | readonly |
| ui_design | general-purpose | sonnet | readonly |
| design_review | general-purpose | sonnet | readonly |
| test_design | general-purpose | sonnet | readonly |
| test_impl | general-purpose | sonnet | readonly, testing |
| implementation | general-purpose | sonnet | readonly, testing, implementation |
| refactoring | general-purpose | haiku | readonly, testing, implementation |
| build_check | general-purpose | haiku | readonly, testing, implementation |
| code_review | general-purpose | sonnet | readonly |
| testing | general-purpose | haiku | readonly, testing |
| regression_test | general-purpose | haiku | readonly, testing |
| manual_test | general-purpose | sonnet | readonly |
| security_scan | general-purpose | sonnet | readonly, testing |
| performance_test | general-purpose | sonnet | readonly, testing |
| e2e_test | general-purpose | sonnet | readonly, testing |
| docs_update | general-purpose | haiku | readonly |
| commit | general-purpose | haiku | readonly, implementation |
| push | general-purpose | haiku | readonly, implementation |
| ci_verification | general-purpose | haiku | readonly |
| deploy | general-purpose | haiku | readonly |

---

## bash-whitelist.jsのカテゴリ定義と制約

bash-whitelist.jsが定義しているBashコマンドカテゴリは以下の4つのみである。

**readonlyカテゴリ**: ls、pwd、cat、head、tail、grep、find、wc、git status、git log、git diff、git show、npm list、node --versionなどの読み取り専用コマンドが含まれる。調査・分析フェーズではこのカテゴリのみが許可される。

**testingカテゴリ**: npm test、npm run test、npx vitest、npx jest、npx playwright test、pytestなどのテスト実行コマンドが含まれる。test_implやtestingフェーズで使用可能である。

**implementationカテゴリ**: npm install、pnpm add、npm run build、mkdir、rm、git add、git commitなどの実装・ビルド用コマンドが含まれる。implementation、refactoring、commit、pushフェーズで使用可能である。

**gitカテゴリ**: git add、git commit、git push、git pull、git fetch、git checkout、git restoreなどのGit操作コマンドが含まれる。commit、pushフェーズで明示的に指定される。

上記4カテゴリ以外（例: deploy）はbash-whitelist.jsに存在せず、指定しても展開されるコマンドが空となるため架空のカテゴリとなる。この制約によりCLAUDE.mdのBashカテゴリテーブルに記載されたカテゴリがbash-whitelist.jsに対応していない場合、コマンド実行時にエラーが発生する。

---

## 問題1（重要度: 高）: workflow-plugin/CLAUDE.mdのコード例に無効なsubagent_type

workflow-plugin/CLAUDE.mdの330行目の並列フェーズ実行コード例に、無効なsubagent_type値「Plan」が残存している。

該当コードは「Task prompt planning, subagent_type Plan, model sonnet」という形式で記述されており、planningサブフェーズのsubagent起動例として使用されている。definitions.tsでは全フェーズがsubagentType: general-purposeに統一されており、「Plan」というsubagentType値は存在しない。

ルートCLAUDE.mdの対応箇所（372行目付近）は既にgeneral-purposeに修正済みである。workflow-plugin/CLAUDE.md側のコード例のみが未修正のまま残っている状態である。

根本原因として、コミット91c3270ではフェーズ別subagent設定テーブルの行レベル修正のみが実施され、ドキュメント内のコード例ブロックは修正スコープ外だった。Orchestratorがworkflow-plugin/CLAUDE.mdのコード例を参照してsubagentを起動した場合、無効なsubagent_typeによりTask tool呼び出しが失敗する可能性がある。

修正方針として、workflow-plugin/CLAUDE.md 330行目のsubagent_type: 'Plan'をsubagent_type: 'general-purpose'に変更する。

---

## 問題2（重要度: 中）: Bashカテゴリテーブルのdeploy行に架空カテゴリ

ルートCLAUDE.mdの182行目のBashカテゴリテーブルに、deployフェーズの許可カテゴリとして「readonly, implementation, deploy」と記載されている。

しかしdefinitions.ts（964行目）ではdeployフェーズのallowedBashCategoriesは「readonly」のみであり、implementationカテゴリもdeployカテゴリも含まれていない。
さらにbash-whitelist.jsにはdeployカテゴリ自体が存在しないため、仮にdeployカテゴリを指定しても展開されるコマンドは空となり実質的に機能しない。

根本原因として、CLAUDE.mdのBashカテゴリテーブルが手動で作成された際に、フェーズ名と同名のカテゴリが存在するという誤った前提で記述された。
コミット91c3270の修正範囲はcommit/push行のみで、deploy行は検証対象外だった。

修正方針として、deploy行の許可カテゴリを「readonly」のみに変更し、理由を「デプロイ確認のため読み取りのみ」に修正する。

---

## 問題3（重要度: 中）: Bashカテゴリテーブルのtest_impl行にimplementationカテゴリ誤記

ルートCLAUDE.mdの176行目で、test_impl・implementation・refactoringの3フェーズが同一行にまとめられ、許可カテゴリが「readonly, testing, implementation」と記載されている。

しかしdefinitions.ts（762行目）ではtest_implフェーズのallowedBashCategoriesは「readonly, testing」であり、implementationカテゴリは含まれていない。
test_implフェーズはTDD Redフェーズであり、テストコードの実装のみを行う段階であるため、npm installやgit addなどのimplementationカテゴリのコマンドは許可されるべきではない。

根本原因として、CLAUDE.mdのテーブルが「似た設定のフェーズをまとめて記述する」方針で作成された際に、test_implとimplementation/refactoringの許可カテゴリの差異が見落とされた。

修正方針として、176行目の1行を以下の2行に分割する。
test_impl行には「readonly, testing」を設定し、理由を「テストコード先行作成のため」とする。
implementation/refactoring行には「readonly, testing, implementation」を設定し、理由を「実装・ビルド・リファクタリングのため」とする。

---

## 前回修正（91c3270）の評価

コミット91c3270の修正自体は正確に適用されており、修正範囲内の5フェーズ（research、build_check、testing、commit、push）のsubagentType/model乖離とcommit/pushのBashカテゴリ乖離は全て解消されている。

修正が適用されたフェーズにおいては、definitions.tsとルートCLAUDE.md（フェーズ別subagent設定テーブル）の値が完全に一致している状態が確認された。修正の精度と完全性という観点では問題は認められない。

今回特定された3件の問題は、前回の修正範囲外の箇所に存在していた乖離であり、前回の修正によって新たに発生したものではない。前回タスクの調査範囲がフェーズ別subagent設定テーブルに限定されていたことが、これらの見落としの原因である。

具体的には、前回修正がテーブル形式のデータ行に限定されたため、同一ドキュメント内の別セクション（並列フェーズ実行のコード例、Bashカテゴリテーブルの非修正行）における同一フィールドの誤記が見逃された。

今回の修正では、コード例ブロック内の値やBashカテゴリテーブルの全行を含む、より広範な検証を実施することで、同種の見落としを防止し、ドキュメント全体における整合性を達成する。
