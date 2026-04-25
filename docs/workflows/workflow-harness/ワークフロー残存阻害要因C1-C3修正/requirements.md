# 要件定義書：ワークフロー残存阻害要因C1-C3修正

## サマリー

本要件定義書は、ワークフロープラグインのフックファイルに残存する6件の実装欠陥の修正要件を定めるものである。前タスクで修正されなかった阻害要因として、enforce-workflow.jsのPHASE_EXTENSIONS欠落2件（docs_update、ci_verification）、bash-whitelist.jsのアロー関数誤検出1件、phase-edit-guard.jsのPHASE_RULES欠落3件（regression_test、ci_verification、deploy）が確認された。これらはCLAUDE.mdで定義された19フェーズのワークフロー仕様と実装コードの不整合に起因しており、特定のフェーズでのファイル編集が完全にブロックされる致命的問題を引き起こしている。本修正により、docs_updateフェーズでのMarkdownファイル編集が可能となり、ci_verificationフェーズでのCI結果記録が実現され、node -eコマンドでのアロー関数使用が許可される。さらに、regression_testフェーズでのテストファイル編集、deployフェーズでのMarkdown記録が機能するようになる。修正対象は3ファイル6箇所であり、全て定型的なエントリ追加または条件分岐改善で対応可能である。根本原因はフェーズ定義の一元管理欠如にあるが、本タスクでは即座に修正可能な実装欠陥への対処に焦点を当てる。

修正の優先度としては、docs_updateとci_verificationのPHASE_EXTENSIONS欠落が最も緊急性が高く、これらはワークフロー後半でのドキュメント記録を完全に停止させる。次いでci_verificationのPHASE_RULES欠落、アロー関数誤検出、regression_testのPHASE_RULES欠落、deployのPHASE_RULES欠落の順に対応する。全ての修正は既存コードへの追加であり、副作用リスクは低いと評価される。本修正完了後は、ワークフロープラグインの全19フェーズが設計通りに機能する状態となる。

## 背景

ワークフロープラグインは、Claude Codeの開発プロセスを19フェーズの厳格なワークフローで管理する仕組みであり、各フェーズでのファイル編集制限をフックファイルで実装している。前タスク「ワークフロープロセス阻害要因4件完全解消」では、discover-tasks.jsのソート順序問題、test-tracking.tsのベースライン記録制限、parallel_designフェーズのサブフェーズ処理問題、planning/designフェーズのスコープ検証問題の4件が修正された。しかし、実運用において依然として特定フェーズでのファイル編集がブロックされる問題が報告されており、残存阻害要因の網羅的調査が実施された。

調査の結果、enforce-workflow.js、bash-whitelist.js、phase-edit-guard.jsの3ファイルに合計6件の実装欠陥が確認された。これらはCLAUDE.mdのフェーズ定義テーブルと実装コード間の不整合に起因しており、特定可能かつ修正方法が明確な実装漏れである。特に重大な問題として、docs_updateフェーズとci_verificationフェーズにおいてMarkdownファイルの編集が完全にブロックされる状況が確認された。これらのフェーズはワークフロー後半に位置しており、ドキュメント更新とCI検証結果の記録という重要な役割を担っているため、機能停止の影響は大きい。

また、bash-whitelist.jsに定義されたリダイレクト演算子検出パターンが、JavaScriptのアロー関数構文を誤検出する問題も確認された。これは前タスクのテスト実行時に実際に障害として顕在化しており、開発効率を低下させる要因となっている。さらに、phase-edit-guard.jsでは新たに追加されたregression_test、ci_verification、deployの3フェーズがPHASE_RULESに未定義であり、ファイル編集制限が適切に機能していない。

本要件定義書では、これら6件の実装欠陥に対する修正要件を明確化し、受入条件を定める。修正方針としては、既存コードへの最小限の追加または条件改善とし、副作用リスクを最小化する。根本的な問題であるフェーズ定義の一元管理については、本タスクのスコープ外として将来の改善課題とする。

## 機能要件

### REQ-C1：docs_updateフェーズのPHASE_EXTENSIONS定義追加

enforce-workflow.jsの行49から行79に定義されたPHASE_EXTENSIONSオブジェクトに、docs_updateフェーズのエントリを追加する必要がある。CLAUDE.mdのフェーズ定義では、docs_updateフェーズの編集可能ファイルは「.md, .mdx」と明記されているが、現在のPHASE_EXTENSIONSには28エントリ中このフェーズが欠落している。getAllowedExtensions関数はフェーズキーに対応するエントリが存在しない場合に空配列を返す実装となっているため、docs_updateフェーズでは全てのファイル書き込みがブロックされる状態である。

修正内容として、PHASE_EXTENSIONSオブジェクトに「'docs_update': ['.md', '.mdx']」というエントリを追加する。挿入位置はe2e_testエントリの後（行74付近）が適切であり、CLAUDE.mdに定義されたフェーズ順序との整合性を保つ。この修正により、docs_updateフェーズにおいてMarkdownファイルとMDXファイルの編集が許可され、ドキュメント更新作業が正常に実行可能となる。docs_updateフェーズは並列検証フェーズの後、コミットフェーズの前に位置する重要なフェーズであり、実装・テスト完了後のドキュメント同期を担うため、本修正の優先度は最高である。

### REQ-C2：ci_verificationフェーズのPHASE_EXTENSIONS定義追加

REQ-C1と同様の問題が、ci_verificationフェーズにも存在している。enforce-workflow.jsのPHASE_EXTENSIONSにci_verificationエントリが完全に欠落しており、このフェーズでのファイル編集が全てブロックされる。CLAUDE.mdではci_verificationフェーズの編集可能ファイルは「.md（CI結果の記録のみ）」と定義されており、push後のCI/CDパイプライン実行結果をMarkdownファイルに記録することが設計上の目的である。しかし、拡張子定義がないため記録操作が実行できず、ワークフロー全体の完遂に支障をきたしている。

修正内容として、PHASE_EXTENSIONSオブジェクトに「'ci_verification': ['.md']」というエントリを追加する。挿入位置はdocs_updateエントリの後、commitエントリの前（行75付近）が適切であり、CLAUDE.mdのフェーズ順序（docs_update → commit → push → ci_verification）との整合性を保つ。この修正により、ci_verificationフェーズにおいてMarkdownファイルへのCI結果記録が可能となり、ビルド・テスト・lint・セキュリティスキャンの自動チェック結果をドキュメント化できる。ci_verificationはワークフロー後半（19フェーズ中17番目）に位置し、品質保証の最終確認を担うため、本修正の優先度も最高である。

### REQ-C3：BASH_BLACKLISTのリダイレクトパターン改善

bash-whitelist.jsの行90に定義された「{ pattern: '> ', type: 'contains' }」パターンが、シェルリダイレクト以外のコンテキストでも誤検出を引き起こしている。matchesBlacklistEntry関数はcontains型判定で「command.includes(entry.pattern)」を実行し、コマンド文字列全体（引数を含む）を検査対象とするため、JavaScriptのアロー関数「=> 」が「> 」の部分一致として検出される。具体的には、「node -e "arr.map(x => x + 1)"」のようなコマンドがブラックリスト違反と判定され、実行がブロックされる。前タスクのテスト実行時に、forループとfunction式で回避する必要があり、開発効率を著しく低下させた実績がある。

修正方針として、単純な部分一致検出を維持しつつ、アロー関数構文を除外する条件を追加する。具体的には、matchesBlacklistEntry関数内でパターンが「> 」の場合、コマンド文字列に「=> 」が含まれているかを先に確認し、含まれている場合は「=> 」を一時的に除外した文字列に対して「> 」の検出を行う。あるいは、「> 」パターン自体を正規表現型に変更し、「[^=]> 」のようにイコール記号の直後でない場合のみマッチさせる方法も検討可能である。本修正により、node -eコマンドでのアロー関数使用が許可され、テスト実行やデータ処理における記述の簡潔性が向上する。

### REQ-H1a：regression_testフェーズのPHASE_RULES定義追加

phase-edit-guard.jsのPHASE_RULESオブジェクト（行98-255）に、regression_testフェーズの定義が欠落している。regression_testフェーズはPHASE_ORDER配列には記載されているが、PHASE_RULESには未定義であり、canEditInPhase関数のfail-closed判定によりisKnownPhaseがfalseとなり全てのファイル編集がブロックされる。CLAUDE.mdのフェーズ定義では、regression_testフェーズの編集可能ファイルは「.md, テストファイル」と記載されており、リグレッションテスト中のテストファイル修正とMarkdown記録が許可されるべきである。

修正内容として、PHASE_RULESオブジェクトにregression_testエントリを追加する。allowedカテゴリには'spec'（仕様書・Markdown）と'test'（テストファイル）を設定し、blockedカテゴリには'code'（ソースコード）を設定する。挿入位置はtestingエントリの後（行200付近）が適切であり、CLAUDE.mdのフェーズ順序との整合性を保つ。この修正により、regression_testフェーズにおいてテストファイルの修正とテスト結果のMarkdown記録が可能となり、既存テストのベースライン比較とリグレッション検出が正常に機能する。regression_testは品質保証における重要なフェーズであり、testingフェーズの直後に位置するため、修正優先度は高い。

### REQ-H1b：ci_verificationフェーズのPHASE_RULES定義追加

REQ-C2ではenforce-workflow.jsのPHASE_EXTENSIONS追加を要件としたが、phase-edit-guard.jsのPHASE_RULESにもci_verificationフェーズが完全に未定義である。ci_verificationフェーズはPHASE_ORDER配列にも記載されておらず、完全に認識されないフェーズとなっている。getPhaseRule関数はフェーズキーに対応するエントリが存在しない場合にnullを返し、canEditInPhase関数のfail-closed原則により全ブロックとなるため、PHASE_RULESの欠落はフェーズの機能停止を意味する。

修正内容として、PHASE_RULESオブジェクトにci_verificationエントリを追加し、PHASE_ORDER配列にもこのフェーズを追加する必要がある。allowedカテゴリには'spec'（仕様書・Markdown）のみを設定し、blockedカテゴリには'code'（ソースコード）と'test'（テストファイル）を設定する。挿入位置はpushエントリの後（行240付近）が適切であり、CLAUDE.mdのフェーズ順序（commit → push → ci_verification → deploy）との整合性を保つ。この修正により、ci_verificationフェーズにおいてCI実行結果のMarkdown記録が可能となり、ビルド・テスト・lint・セキュリティスキャンの結果をドキュメント化できる。

### REQ-H1c：deployフェーズのPHASE_RULES定義追加

phase-edit-guard.jsのPHASE_RULESに、deployフェーズの定義が欠落している。deployフェーズはPHASE_ORDER配列には記載されているが、PHASE_RULESには未定義であり、REQ-H1aと同様にfail-closed判定により全てのファイル編集がブロックされる。CLAUDE.mdのフェーズ定義では、deployフェーズの編集可能ファイルは「.md」と記載されており、デプロイ作業中のMarkdown記録が許可されるべきである。deployフェーズは最終フェーズの一つ手前（19フェーズ中18番目）に位置し、本番環境へのリリース作業を担う。

修正内容として、PHASE_RULESオブジェクトにdeployエントリを追加する。allowedカテゴリには'spec'（仕様書・Markdown）のみを設定し、blockedカテゴリには'code'（ソースコード）と'test'（テストファイル）を設定する。挿入位置はci_verificationエントリの後（行245付近）が適切であり、CLAUDE.mdのフェーズ順序との整合性を保つ。この修正により、deployフェーズにおいてデプロイ手順や結果のMarkdown記録が可能となり、リリース履歴の文書化が実現される。実運用への影響は限定的であるが、ワークフロー完全性の観点から修正が必要である。

## 非機能要件

### NFR-1：既存機能への影響最小化

本修正は既存コードへのエントリ追加または条件分岐改善であり、既存のフェーズ定義や動作に影響を与えてはならない。enforce-workflow.jsのPHASE_EXTENSIONSへのエントリ追加は、既存の26エントリの動作を変更せず、docs_updateとci_verificationの2エントリを新規追加するのみとする。bash-whitelist.jsのBASH_BLACKLIST改善は、既存のリダイレクト検出機能を維持しつつ、アロー関数を誤検出しないよう条件を追加する。phase-edit-guard.jsのPHASE_RULES追加は、既存のフェーズルールを変更せず、regression_test、ci_verification、deployの3エントリを新規追加するのみとする。

修正後の動作確認として、既存フェーズ（research、requirements、implementation、testing等）でのファイル編集制限が変更されていないことを検証する必要がある。特に、testingフェーズでのテストファイル編集、implementationフェーズでのソースコード編集が引き続き許可されることを確認する。また、bash-whitelist.jsの改善により、既存の危険なコマンド（rm -rf、危険なリダイレクト等）が引き続き検出されることを確認する。

### NFR-2：CLAUDE.md仕様との完全整合性

本修正により、enforce-workflow.jsのPHASE_EXTENSIONS、phase-edit-guard.jsのPHASE_RULESは、CLAUDE.mdに定義された19フェーズの仕様と完全に整合する状態となる必要がある。CLAUDE.mdのフェーズ順序は「research → requirements → parallel_analysis → parallel_design → design_review → test_design → test_impl → implementation → refactoring → parallel_quality → testing → regression_test → parallel_verification → docs_update → commit → push → ci_verification → deploy → completed」の19フェーズであり、各フックファイルのフェーズ定義はこの順序と一致しなければならない。

CLAUDE.mdのフェーズ別編集可能ファイルテーブルに記載された内容と、実装コードのallowedカテゴリ・拡張子リストが一致することを検証する。特に、docs_updateフェーズの「.md, .mdx」、ci_verificationフェーズの「.md」、regression_testフェーズの「.md, テストファイル」、deployフェーズの「.md」の定義が正確に反映されることを確認する。また、PHASE_ORDERとPHASE_RULESのフェーズキーが完全に一致し、欠落や重複がない状態とする。

### NFR-3：修正の可読性と保守性

本修正は、将来の開発者がコードを読んだ際に理解しやすい形で実装する必要がある。PHASE_EXTENSIONSとPHASE_RULESへのエントリ追加は、既存のコードスタイルと一貫性を保ち、インデント・コメント・キー順序を既存コードに合わせる。bash-whitelist.jsのBASH_BLACKLIST改善は、検出ロジックの変更理由を明確にするコメントを追加し、アロー関数除外の意図を記述する。各修正箇所には、CLAUDE.md仕様との対応を示すコメントを付与し、フェーズ定義の出典を明確化する。

コードレビュー時に、修正内容がCLAUDE.mdのフェーズ定義テーブルと対照しやすいよう、各エントリにフェーズ番号や説明を付記することを推奨する。例えば、「'docs_update': ['.md', '.mdx'], // Phase 15: Documentation update」のような形式とする。また、今後のフェーズ追加時に参照しやすいよう、PHASE_EXTENSIONS、PHASE_RULES、PHASE_ORDERの3箇所が同期すべき対象であることをREADMEまたはコメントに記載する。

## 受入条件

### AC-C1：docs_updateフェーズでのMarkdownファイル編集許可

enforce-workflow.jsのPHASE_EXTENSIONSに「'docs_update': ['.md', '.mdx']」エントリが追加されていること。getAllowedExtensions('docs_update')を呼び出した際に、['.md', '.mdx']配列が返却されることを単体テストで検証する。実際にdocs_updateフェーズに遷移した状態で、docs/配下のMarkdownファイルおよびMDXファイルの書き込みが成功することを統合テストで検証する。また、docs_updateフェーズでTypeScriptファイルやJavaScriptファイルの書き込みが引き続きブロックされることを確認し、不正な拡張子が許可されていないことを検証する。

エントリの挿入位置がe2e_testエントリの後であり、CLAUDE.mdのフェーズ順序と一致していることをコードレビューで確認する。PHASE_EXTENSIONSオブジェクトのキー数が30（28 + 2追加分）となり、全19フェーズがカバーされていることを確認する。修正後のenforce-workflow.jsがESLintおよびTypeScriptコンパイルエラーなく動作することを確認する。

### AC-C2：ci_verificationフェーズでのMarkdownファイル編集許可

enforce-workflow.jsのPHASE_EXTENSIONSに「'ci_verification': ['.md']」エントリが追加されていること。getAllowedExtensions('ci_verification')を呼び出した際に、['.md']配列が返却されることを単体テストで検証する。実際にci_verificationフェーズに遷移した状態で、docs/配下のMarkdownファイルの書き込みが成功することを統合テストで検証する。また、ci_verificationフェーズでソースコードファイルやテストファイルの書き込みが引き続きブロックされることを確認し、Markdown以外の編集が制限されていることを検証する。

エントリの挿入位置がdocs_updateエントリの後、commitエントリの前であり、CLAUDE.mdのフェーズ順序と一致していることをコードレビューで確認する。AC-C1と合わせて、PHASE_EXTENSIONSオブジェクトのキー数が30となり、docs_updateとci_verificationの2エントリが追加されていることを確認する。修正後のenforce-workflow.jsが既存のフェーズ動作に影響を与えていないことを、既存の統合テストで検証する。

### AC-C3：アロー関数を含むnode -eコマンドの実行許可

bash-whitelist.jsのmatchesBlacklistEntry関数が、「node -e "arr.map(x => x + 1)"」のようなアロー関数を含むコマンドをブラックリスト違反として検出しないこと。単体テストで、アロー関数を含む複数のnode -eコマンド例（配列操作、オブジェクト変換、Promise処理等）がホワイトリスト判定となることを検証する。同時に、「echo test > output.txt」や「cat file > output.txt」のような実際のリダイレクト演算子を含むコマンドが引き続きブラックリスト違反として検出されることを検証し、セキュリティ機能が維持されていることを確認する。

修正方法として、matchesBlacklistEntry関数内でパターンが「> 」の場合にアロー関数検出ロジックを追加するか、正規表現型に変更する場合は「[^=]> 」パターンを使用することをコードレビューで確認する。修正箇所にアロー関数除外の理由を説明するコメントが追加されていることを確認する。修正後のbash-whitelist.jsがESLintおよびTypeScriptコンパイルエラーなく動作することを確認する。

### AC-H1a：regression_testフェーズでのテストファイル・Markdown編集許可

phase-edit-guard.jsのPHASE_RULESに「'regression_test': { allowed: ['spec', 'test'], blocked: ['code'] }」エントリが追加されていること。getPhaseRule('regression_test')を呼び出した際に、allowedに'spec'と'test'が含まれることを単体テストで検証する。実際にregression_testフェーズに遷移した状態で、テストファイル（*.test.ts等）とMarkdownファイルの書き込みが成功し、ソースコードファイル（src/**/*.ts等）の書き込みがブロックされることを統合テストで検証する。

エントリの挿入位置がtestingエントリの後であり、CLAUDE.mdのフェーズ順序と一致していることをコードレビューで確認する。PHASE_RULESオブジェクトのキー数が増加し、regression_testエントリが追加されていることを確認する。修正後のphase-edit-guard.jsが既存のフェーズ動作に影響を与えていないことを、既存の統合テストで検証する。

### AC-H1b：ci_verificationフェーズのPHASE_RULES定義追加とPHASE_ORDER登録

phase-edit-guard.jsのPHASE_RULESに「'ci_verification': { allowed: ['spec'], blocked: ['code', 'test'] }」エントリが追加されていること。PHASE_ORDER配列にci_verificationフェーズが追加され、pushの後、deployの前に配置されていることを確認する。getPhaseRule('ci_verification')を呼び出した際に、allowedに'spec'のみが含まれることを単体テストで検証する。実際にci_verificationフェーズに遷移した状態で、Markdownファイルの書き込みが成功し、ソースコードファイルとテストファイルの書き込みがブロックされることを統合テストで検証する。

AC-C2のenforce-workflow.js側のPHASE_EXTENSIONS追加と合わせて、ci_verificationフェーズが両フックファイルで正しく認識されることを確認する。PHASE_ORDERの配列長が正しく増加し、フェーズ順序がCLAUDE.mdの定義と一致していることをコードレビューで確認する。修正後のphase-edit-guard.jsがESLintおよびTypeScriptコンパイルエラーなく動作することを確認する。

### AC-H1c：deployフェーズでのMarkdown編集許可

phase-edit-guard.jsのPHASE_RULESに「'deploy': { allowed: ['spec'], blocked: ['code', 'test'] }」エントリが追加されていること。getPhaseRule('deploy')を呼び出した際に、allowedに'spec'のみが含まれることを単体テストで検証する。実際にdeployフェーズに遷移した状態で、Markdownファイルの書き込みが成功し、ソースコードファイルとテストファイルの書き込みがブロックされることを統合テストで検証する。

エントリの挿入位置がci_verificationエントリの後であり、CLAUDE.mdのフェーズ順序と一致していることをコードレビューで確認する。AC-H1aとAC-H1bと合わせて、PHASE_RULESオブジェクトのキー数が3件増加し、regression_test、ci_verification、deployの3エントリが追加されていることを確認する。修正後のphase-edit-guard.jsが既存のフェーズ動作に影響を与えていないことを、既存の統合テストで検証する。

### AC-Integration：統合的な動作検証

全6件の修正が適用された状態で、CLAUDE.mdに定義された19フェーズの完全なワークフローを実行し、各フェーズでのファイル編集制限が設計通りに機能することをエンドツーエンドテストで検証する。特に、docs_updateフェーズでドキュメント更新が可能であること、regression_testフェーズでテストファイル修正が可能であること、ci_verificationフェーズでCI結果記録が可能であること、deployフェーズでデプロイ記録が可能であることを確認する。

node -eコマンドでのアロー関数使用が、testing以降の全フェーズで許可されることを確認し、前タスクで発生したような回避策が不要となることを検証する。PHASE_EXTENSIONS、PHASE_RULES、PHASE_ORDERの3箇所が完全に同期し、CLAUDE.mdのフェーズ定義との整合性が保たれていることをドキュメントレビューで確認する。修正後のフックファイル群がESLint、TypeScriptコンパイル、既存の単体テスト・統合テストを全てパスすることを確認する。

## 制約事項

### 制約1：MCPサーバーの再起動必須

本修正はフックファイル（enforce-workflow.js、bash-whitelist.js、phase-edit-guard.js）の変更であり、MCPサーバーがモジュールキャッシュを保持しているため、修正後はMCPサーバーの再起動が必須となる。Claude Codeのセッション再起動だけでは不十分であり、VSCodeまたはターミナルからMCPサーバープロセスを完全に停止・再起動する必要がある。この制約はMCPサーバーのアーキテクチャに起因するものであり、本タスクでは解決できない。

修正適用手順として、フックファイルの変更をコミット後、MCPサーバーを再起動し、新規セッションで動作確認を行うことをドキュメント化する。開発者がこの手順を理解していない場合、修正が反映されず混乱する可能性があるため、READMEまたはCHANGELOGに明記する。

### 制約2：フェーズ定義の一元管理は将来課題

本タスクでは、enforce-workflow.js、phase-edit-guard.js、CLAUDE.mdの3箇所に分散したフェーズ定義を個別に修正する方針とする。根本的な問題として、フェーズ定義が一元管理されていないため、フェーズ追加時に複数箇所の同期が必要となる設計上の課題が存在する。理想的には、フェーズ定義を共通定数ファイル（phase-definitions.js等）に一元化し、各フックファイルがそれをインポートする構造へのリファクタリングが望ましい。

しかし、本タスクのスコープは残存阻害要因の修正であり、大規模なアーキテクチャ変更は含まない。フェーズ定義の一元管理は将来の改善課題として別タスクで対応することとし、本タスクでは即座に修正可能な実装欠陥への対処に焦点を当てる。ドキュメントに将来課題として記録し、次回のアーキテクチャ改善時に参照可能とする。

### 制約3：bash-whitelist.jsの改善範囲の限定

REQ-C3のアロー関数誤検出問題に対しては、「> 」パターンの検出ロジックを改善するが、BASH_BLACKLIST全体の抜本的見直しは本タスクのスコープ外とする。現在のBASH_BLACKLISTには約25個のパターンが定義されているが、他のパターン（「&& 」「|| 」等）についても同様の誤検出リスクが存在する可能性がある。しかし、これらは現時点で顕在化した問題ではないため、予防的修正は行わない。

「> 」パターンのみに焦点を当て、最小限の条件分岐追加または正規表現変更で対応する方針とする。他のパターンについて問題が発生した場合は、別タスクで個別に対応することとし、本タスクでは過度な変更を避ける。この判断により、修正の副作用リスクを最小化し、レビュー・テストの負荷を軽減する。

## 関連ドキュメント

- C:\ツール\Workflow\CLAUDE.md - ワークフロー定義（フェーズ一覧、編集可能ファイル）
- C:\ツール\Workflow\docs\workflows\ワ-クフロ-残存阻害要因C1-C3修正\research.md - 調査結果
- C:\ツール\Workflow\.claude\hooks\enforce-workflow.js - PHASE_EXTENSIONS定義
- C:\ツール\Workflow\.claude\hooks\bash-whitelist.js - BASH_BLACKLIST定義
- C:\ツール\Workflow\.claude\hooks\phase-edit-guard.js - PHASE_RULES定義

## 変更履歴

| 日付 | バージョン | 変更内容 | 変更者 |
|------|-----------|---------|--------|
| 2026-02-09 | 1.0 | 初版作成 | Claude Sonnet 4.5 |
