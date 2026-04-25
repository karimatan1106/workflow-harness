# Researchフェーズ：ワークフロー残存阻害要因C1-C3修正

## サマリー

ワークフロープラグインの3つのフックファイルに構造的欠陥が確認された。
enforce-workflow.jsのPHASE_EXTENSIONSにdocs_updateとci_verificationのエントリが欠落しており、これらのフェーズでMarkdownファイルの書き込みが全てブロックされる。
bash-whitelist.jsのBASH_BLACKLISTに含まれる「> 」パターンがJavaScriptのアロー関数「=> 」を誤検出し、node -eコマンドでの関数式使用を阻害している。
phase-edit-guard.jsのPHASE_RULESにregression_test、ci_verification、deployの3フェーズが未定義であり、ファイル編集制限が不完全となっている。
これらは全て特定可能で修正方法が明確な実装漏れであり、CLAUDE.mdの仕様と実装コードの不整合が根本原因である。

## 調査結果

本調査では、前タスク「ワークフロープロセス阻害要因4件完全解消」で修正されなかった残存阻害要因を網羅的に特定した。
調査対象は enforce-workflow.js、bash-whitelist.js、phase-edit-guard.js の3ファイルである。
CLAUDE.mdに定義された19フェーズの完全な定義と各フックファイルの実装を突合した結果、6箇所の不整合を検出した。
Critical（重大）に分類される欠陥が3件（C-1、C-2、C-3）、High（高）に分類される欠陥が3件（H-1a、H-1b、H-1c）確認された。
各欠陥の再現手順、影響範囲、修正方法を以下のセクションで詳述する。
enforce-workflow.jsでは28フェーズ中26フェーズのみがPHASE_EXTENSIONSに定義されており、docs_updateとci_verificationが完全に欠落していた。
bash-whitelist.jsのBASH_BLACKLISTは行90にリダイレクト検出用の「> 」パターンを含むが、matchesBlacklistEntry関数のcontains型マッチングが過剰に広い範囲を検出する。
phase-edit-guard.jsではPHASE_ORDERに含まれるregression_test、deployがPHASE_RULESに未定義であり、ci_verificationは両方に未定義である。

## 既存実装の分析

enforce-workflow.jsのPHASE_EXTENSIONS（行49-79）は各フェーズで許可されるファイル拡張子を定義するオブジェクトであり、現在28エントリが存在する。
getAllowedExtensions関数は指定フェーズのエントリを検索し、未定義フェーズに対しては空配列を返却するため、全てのファイル書き込みがブロックされる結果となる。
bash-whitelist.jsのBASH_BLACKLIST配列（行82-107）には約25個のブラックリストパターンが定義され、matchesBlacklistEntry関数（行255-284）がcontains型で部分一致検査を行う。
phase-edit-guard.jsのPHASE_RULES（行98-255）は各フェーズのallowed/blockedカテゴリを定義するオブジェクトであり、canEditInPhase関数（行953-980）がこれを参照してファイル編集の可否を判定する。
未知のフェーズはgetPhaseRule関数（行1420-1425）がnullを返却し、canEditInPhase内のfail-closed原則により全ブロックとなるため、PHASE_RULESの欠落はフェーズの機能停止を意味する。
discover-tasks.js（共通ライブラリ）はワークフローディレクトリをスキャンしてアクティブタスクを検出する共有モジュールで、前タスクでB-1修正（taskId降順ソート）が適用済みである。
test-tracking.ts（MCPサーバー側）はテストファイル記録とベースライン管理を担当し、前タスクでB-3修正（testingフェーズでのベースライン記録許可）が適用済みである。

## C-1：docs_updateフェーズのPHASE_EXTENSIONS未定義

enforce-workflow.jsの行49から行79に定義されたPHASE_EXTENSIONSオブジェクトにdocs_updateエントリが存在しない。
CLAUDE.mdのフェーズ定義では、docs_updateフェーズの編集可能ファイルは「.md, .mdx」と明記されている。
getAllowedExtensions('docs_update')を呼び出すと空配列が返り、docs_updateフェーズでのMarkdownファイル書き込みが全てブロックされる。
このため、ドキュメント更新フェーズという名称にもかかわらず、実際にはドキュメントの編集が不可能という致命的矛盾が発生している。
修正として、PHASE_EXTENSIONSに「'docs_update': ['.md', '.mdx']」エントリを追加する必要がある。
挿入位置はe2e_testエントリの後（行74付近）が適切であり、CLAUDE.mdのフェーズ順序と一致させる。

## C-2：ci_verificationフェーズのPHASE_EXTENSIONS未定義

docs_updateと同様に、enforce-workflow.jsのPHASE_EXTENSIONSにci_verificationエントリが完全に欠落している。
CLAUDE.mdではci_verificationフェーズの編集可能ファイルは「.md（CI結果の記録のみ）」と定義されている。
ci_verificationフェーズに到達した際、CI実行結果をMarkdownファイルに記録することが設計上の目的であるが、拡張子の定義がないため記録操作がブロックされる。
push後のCI検証ワークフローが事実上機能しない状態であり、ワークフロー全体の完遂に支障をきたす阻害要因となっている。
修正として、PHASE_EXTENSIONSに「'ci_verification': ['.md']」エントリを追加する必要がある。
docs_updateエントリの後（commitエントリの前）に配置することで、CLAUDE.mdのフェーズ順序との整合性を保つ。

## C-3：BASH_BLACKLISTのリダイレクトパターンによるアロー関数誤検出

bash-whitelist.jsの行90に定義された「{ pattern: '> ', type: 'contains' }」パターンが、シェルリダイレクト以外のコンテキストでも誤検出を引き起こす。
matchesBlacklistEntry関数のcontains型判定は「command.includes(entry.pattern)」で実装されており、コマンド文字列全体（引数を含む）を検査対象とする。
node -eコマンドでJavaScriptのアロー関数を使用する場合、「node -e "arr.map(x => x + 1)"」のように「=> 」がコマンド文字列に含まれるが、これは「> 」の部分一致で検出される。
前タスクのテスト実行時に、forループとfunction式で回避する必要があり、開発効率を著しく低下させた実績がある。
修正アプローチとして、単純な部分一致ではなくリダイレクト演算子の文脈を考慮した正規表現マッチングへの変更を提案する。
具体的には「[^=]> 」のようにイコール記号の直後でない場合のみマッチさせるか、あるいは「>> 」パターンとともに正規表現型に変更する方法が考えられる。

## H-1：phase-edit-guard.jsのPHASE_RULES欠落フェーズ

phase-edit-guard.jsのPHASE_RULESオブジェクトに3つのフェーズ定義が欠落しており、それぞれの影響範囲と修正方法を以下に記述する。
regression_testフェーズはPHASE_ORDERには記載されているがPHASE_RULESに定義がなく、テストファイルとMarkdownの編集許可が設定されていない。
ci_verificationフェーズはPHASE_ORDERにもPHASE_RULESにも未定義であり、完全に認識されないフェーズとなっている。
deployフェーズはPHASE_ORDERに記載されているがPHASE_RULESに定義がなく、Markdownのみの編集許可が設定されていない。
これら3フェーズはcanEditInPhase関数のfail-closed判定によりisKnownPhaseがfalseとなり、全てのファイル編集がブロックされる。
CLAUDE.mdのフェーズ定義に基づき、regression_testにはallowed: ['spec', 'test']、ci_verificationとdeployにはallowed: ['spec']を設定する必要がある。

## 修正対象ファイルの詳細一覧

本調査で特定された6箇所の修正対象を以下にまとめる。
C-1はenforce-workflow.jsのPHASE_EXTENSIONSへのdocs_updateエントリ追加であり、許可拡張子は.mdと.mdxの2種類となる。
C-2はenforce-workflow.jsのPHASE_EXTENSIONSへのci_verificationエントリ追加であり、許可拡張子は.mdのみとなる。
C-3はbash-whitelist.jsのBASH_BLACKLISTにおける「> 」パターンの検出ロジック改善であり、アロー関数の「=> 」を除外する修正を行う。
H-1aはphase-edit-guard.jsのPHASE_RULESへのregression_testエントリ追加であり、spec（仕様書）とtest（テストファイル）カテゴリを許可する。
H-1bはphase-edit-guard.jsのPHASE_RULESへのci_verificationエントリ追加であり、spec（仕様書）カテゴリのみを許可する。
H-1cはphase-edit-guard.jsのPHASE_RULESへのdeployエントリ追加であり、spec（仕様書）カテゴリのみを許可する。

## 影響範囲の評価と優先度

C-1のdocs_update欠落はワークフローの後半フェーズ（18フェーズ中15番目）に影響し、ドキュメント更新作業を完全にブロックする重大な問題である。
C-2のci_verification欠落もワークフロー後半（17番目のフェーズ）に影響し、CI検証結果のMarkdown記録を完全にブロックするため修正優先度が高い。
C-3のアロー関数誤検出はtesting以降の全フェーズでnode -eコマンドを使用する際に影響するが、function式での回避が可能なため影響度は中程度である。
H-1aのregression_test欠落はtesting直後のフェーズ（12番目）に影響し、リグレッションテスト中のファイル編集を全てブロックする。
H-1bのci_verification欠落はC-2と同じフェーズに影響するが、phase-edit-guard.js側の問題であるため別途修正が必要となる。
H-1cのdeploy欠落は最終フェーズ近辺（18番目）に影響し、デプロイ中のMarkdown記録をブロックするが実運用への影響は限定的である。
全体として、C-1とC-2の修正が最も緊急性が高く、次いでH-1b（ci_verificationのPHASE_RULES追加）、C-3、H-1a、H-1cの順に対応すべきである。

## 根本原因分析

enforce-workflow.jsとphase-edit-guard.jsが独立して設計・実装されたことにより、フェーズ定義の同期が取れていないことが根本原因である。
CLAUDE.mdには19フェーズの完全な定義が存在するが、各フックファイルはそれぞれ独自のフェーズ定義テーブルを持ち、一元管理されていない。
enforce-workflow.jsのPHASE_EXTENSIONSは28エントリ中2件が欠落、phase-edit-guard.jsのPHASE_RULESは28エントリ中3件が欠落している。
bash-whitelist.jsのBASH_BLACKLISTはセキュリティ目的で設計されたが、プログラミング言語の構文パターンとの干渉が考慮されていない。
今後の対策として、フェーズ定義を共通定数ファイルに一元化し、各フックファイルがそれをインポートする構造への変更を検討すべきである。
