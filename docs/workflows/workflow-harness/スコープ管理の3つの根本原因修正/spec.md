# スコープ管理の3つの根本原因修正 - 実装仕様書

## サマリー

本ドキュメントは、前回タスク実行時に発生したスコープ管理の3つの根本原因に対する詳細な実装仕様を定義する。

目的として、FIX-1ではset-scope.tsのpreExistingChanges保持ロジックを実装する。
FIX-2ではdependency-analyzer.tsのgit追跡ディレクトリ許可機能を実装する。
FIX-3ではbash-whitelist.jsのcommitフェーズrm許可を実装する。

主要な設計決定として、FIX-2ではspawnSyncを使用してコマンドインジェクションを完全防止する。
FIX-2ではパス正規化とプロジェクトルート検証を実装し、パストラバーサル攻撃を防ぐ。
FIX-3では既存のgitカテゴリにrmを追加するシンプルな実装を採用する。

次フェーズで必要な情報として、FIX-2のセキュリティ対策ではspawnSyncの引数配列形式を使用する。
FIX-2のタイムアウト設定は1000ミリ秒である。
FIX-3のrmコマンドはphase-edit-guardによる多層防御が引き続き有効である。

---

## 概要

### 背景

前回タスク「ワークフロープラグイン構造的問題9件の根本原因修正」実行中に、docs_update→commit遷移がSCOPE_STRICTでブロックされた。
remotionディレクトリ（タスク開始前にディスクから削除済み）のファイルがgit diff HEADに出現し、スコープ外変更として検出された。
preExistingChangesが消失していたため、ワークフロー開始前の変更がスキップされず誤検出が発生した。
調査の結果、3つの独立した根本原因を特定し、それぞれの修正方針を策定した。
3件とも修正方針が明確で、既存テストへの影響は限定的であることを確認した。

### 修正対象

FIX-1はpreExistingChanges配列の上書き消去問題を修正する。
FIX-2は削除済みgit追跡ディレクトリのスコープ追加拒否問題を修正する。
FIX-3はcommitフェーズでの一時ファイル削除不可問題を修正する。
3つの修正は互いに独立しており、それぞれ単独で実装・テスト可能である。
全修正完了により、ワークフローのdocs_update→commit遷移が正常に動作するようになる。

---

## 変更対象ファイル

### FIX-1の変更対象

workflow-plugin/mcp-server/src/tools/set-scope.ts の行318-324を修正する。
scopeオブジェクト再構築時にpreExistingChangesフィールドを保持するコードを追加する。
変更行数は約5行（新規2行追加、既存1行修正）で、影響範囲は限定的である。

### FIX-2の変更対象

workflow-plugin/mcp-server/src/validation/dependency-analyzer.ts の行160-162を修正する。
行11付近にspawnSyncのimport文を1行追加する。
行140付近にcheckGitTracked関数（約30行）を新規追加する。
行160-162のfor文内の条件分岐を修正する（約10行変更）。
変更行数は約45行（新規追加含む）で、セキュリティ対策を含む。

### FIX-3の変更対象

workflow-plugin/hooks/bash-whitelist.js の行87-90を修正する。
gitカテゴリ配列にrm要素を1行追加する。
変更行数は1行のみで、最もシンプルな修正である。

---

## 実装計画

### FIX-1: preExistingChanges保持（set-scope.ts）

#### 現在の問題

set-scope.ts の行318-324では、scopeオブジェクトを新規構築する際に既存のpreExistingChangesフィールドが失われる。
updatedStateオブジェクトのscopeプロパティにaffectedFilesとaffectedDirsのみを設定し、preExistingChangesを含めていない。
workflow_startで記録されたpreExistingChanges配列が、workflow_set_scope実行時に消失する。
docs_update→commit遷移時にワークフロー開始前の変更がスコープ外変更として誤検出される。

#### 修正方針

set-scope.tsの行318直前に、既存のpreExistingChanges配列を取得する処理を追加する。
taskState.scope?.preExistingChangesが存在する場合はその値を使用し、存在しない場合は空配列をデフォルト値とする。
updatedStateオブジェクトのscopeプロパティにpreExistingChangesフィールドを追加する。
addModeの値に関わらず常にpreExistingChangesを保持する。

#### 修正内容の詳細

行318の直前に以下の処理を挿入する。
コメント行として「既存のpreExistingChangesを保持（FIX-1）」を記述する。
existingPreExistingChanges変数にtaskState.scope?.preExistingChanges ?? 空配列を代入する。
空行を挿入して可読性を確保する。

行320-323のscopeオブジェクト定義にpreExistingChangesフィールドを追加する。
affectedDirsフィールドの後にpreExistingChanges: existingPreExistingChangesを記述する。
これにより、scopeオブジェクトの再構築後もpreExistingChanges配列が保持される。

#### 動作検証ポイント

workflow_start実行後にtaskState.scope.preExistingChangesが記録されていることを確認する。
workflow_set_scope実行後もpreExistingChanges配列が保持されていることを検証する。
preExistingChanges配列の内容が変化していないことをアサーションで確認する。
preExistingChangesプロパティが存在しない状態でworkflow_set_scopeを実行してもエラーが発生しないことを確認する。
addMode=trueとaddMode=falseの両方で正常動作することをテストする。

---

### FIX-2: git追跡ディレクトリ許可（dependency-analyzer.ts）

#### 現在の問題

dependency-analyzer.ts の行160-162では、fs.existsSyncのみを使用してディレクトリの存在を確認している。
git追跡済みだがディスクから削除されたディレクトリをスコープに追加できない。
remotionディレクトリのような削除済みgit追跡ディレクトリが「存在しないディレクトリ」として拒否される。

#### 修正方針

fs.existsSyncがfalseを返す場合に、git ls-filesコマンドでディレクトリ配下のファイルがgit追跡されているか確認するフォールバック処理を追加する。
セキュリティ対策としてspawnSyncを使用し、コマンドインジェクションを完全に防止する。
パス正規化とプロジェクトルート検証によりパストラバーサル攻撃を防ぐ。

#### import文の追加

ファイル冒頭のimport文にchild_processモジュールからspawnSyncをインポートする記述を追加する。
pathモジュールは既にインポート済みのため追加不要である。

#### checkGitTracked関数の実装

validateScopeExists関数の前に、git追跡状態を確認する新規関数checkGitTrackedを追加する。
この関数はdir引数（絶対パス文字列）を受け取り、git追跡状態を示すboolean値を返す。

処理フローとして、まずpath.normalizeでパスを正規化する。
次にprocess.cwdでプロジェクトルートを取得し、normalizedパスがプロジェクトルート配下であることを検証する。
プロジェクトルート外のパスはfalseを返して拒否する。
path.relativeで相対パスに変換し、ドットドット参照が含まれる場合はfalseを返す。
spawnSync関数にgitコマンドとls-filesサブコマンド、相対パスを引数配列として渡す。
cwdオプションにプロジェクトルートを指定し、timeoutを1000ミリ秒に設定する。
実行結果のerrorまたはstatusが非0の場合はfalseを返す。
標準出力をtrimして空でなければtrueを返し、空であればfalseを返す。
全体をtry-catchで囲み、例外時はfalseを返す安全な実装とする。

#### validateScopeExists関数の修正

行160-162のfor文内の条件分岐を修正する。
fs.existsSyncがfalseの場合、checkGitTracked関数を呼び出してgit追跡状態を確認する。
git追跡されていればnonExistentDirs配列に追加しない。
git追跡されていなければ従来通りnonExistentDirs配列に追加する。
fs.existsSyncがtrueの場合は従来通りisDirectory検証を行う。

#### セキュリティ対策の詳細

パス正規化によりシンボリックリンクやドットドットパスを解決する。
プロジェクトルート配下であることの検証によりプロジェクト外へのアクセスを防止する。
相対パスに変換してgit ls-filesに渡すことで絶対パスの注入を回避する。
パストラバーサル防止として親ディレクトリ参照（ドットドット）を拒否する。
spawnSyncを使用して引数配列形式で渡すことでコマンドインジェクションを完全防止する。
タイムアウト設定により大規模リポジトリでの処理遅延を1秒以内に制限する。

#### 動作検証ポイント

git追跡済みで削除済みのディレクトリをスコープに追加できることを確認する。
gitリポジトリではない環境で既存動作が維持されることを検証する。
git ls-filesの実行エラーが適切にハンドリングされることを確認する。
remotionディレクトリ（削除済み）をスコープに追加できることをテストする。
パス正規化により不正なパスが拒否されることを検証する。
プロジェクトルート外へのアクセスが拒否されることを確認する。
タイムアウトが正しく機能してfalseが返されることをテストする。

---

### FIX-3: commitフェーズrm許可（bash-whitelist.js）

#### 現在の問題

bash-whitelist.js の行87-90のgitカテゴリ配列にrmコマンドが含まれていない。
commitフェーズで一時ファイル（scope-placeholder.md等）を削除できない。
build_checkフェーズではrmが許可されているが、commitフェーズでは不許可である。

#### 修正方針

gitカテゴリ配列にrmコマンドを1要素追加する。
既存のphase-edit-guardによるファイル編集制御は引き続き有効なため、重要ファイルの削除は防止される。
FIX-3の修正であることを示すコメントを付記する。

#### 修正内容の詳細

行90の'git restore'要素の後に改行とインデントを追加する。
新規行として 'rm' 文字列要素を追加し、コメントで「FIX-3: commitフェーズで一時ファイル削除を許可」と記述する。
配列の末尾カンマを維持してコードスタイルの一貫性を確保する。

#### セキュリティ考慮

phase-edit-guardによるファイル編集制御が引き続き有効である。
commitフェーズでは編集可能ファイルが「なし」に設定されており、重要ファイルの変更はブロックされる。
git statusが削除ファイルをDステータスで報告し、phase-edit-guardが検証する。
rmで削除できるのは一時ファイル等のphase-edit-guardが許可する範囲に限定される。
phase-edit-guardのsharedGetChangedFiles関数が削除ファイルを変更として検出する。

#### 動作検証ポイント

commitフェーズでrm -f scope-placeholder.mdが実行可能であることを確認する。
rmによるソースコード削除が引き続きブロックされることをphase-edit-guardで検証する。
rmによるテストファイル削除が引き続きブロックされることを確認する。
他のフェーズではrmが引き続き制御されることをテストする。
commitフェーズで一時ファイルを削除後にgit commitが正常に実行されることを確認する。

---

## テスト方針

### FIX-1: preExistingChanges保持のテスト

#### ユニットテスト

既存テストファイル workflow-plugin/mcp-server/src/tools/set-scope.test.ts に新規テストケースを追加する。

テストケース1としてworkflow_set_scope実行後のpreExistingChanges保持を検証する。
準備ステップでtaskStateにpreExistingChangesが設定された状態を作成する。
実行ステップでworkflow_set_scopeを実行する。
検証ステップでpreExistingChanges配列が保持されていることをアサーションで確認する。

テストケース2としてpreExistingChangesプロパティ不在時のデフォルト値を検証する。
準備ステップでtaskStateにpreExistingChangesプロパティが存在しない状態を作成する。
実行ステップでworkflow_set_scopeを実行する。
検証ステップでエラーが発生せず空配列がデフォルト値として設定されることを確認する。

テストケース3としてaddMode両方での動作を検証する。
addMode=trueとaddMode=falseの両方でworkflow_set_scopeを実行する。
どちらの場合もpreExistingChangesが保持されることを確認する。

#### 統合テスト

docs_update→commit遷移でのワークフロー開始前変更の検出を検証する。
ワークフロー開始前にファイルを変更してpreExistingChangesに記録する。
workflow_set_scopeを実行してからdocs_update→commit遷移を実行する。
preExistingChangesの変更がスコープ外変更としてブロックされないことを確認する。

### FIX-2: git追跡ディレクトリのスコープ追加テスト

#### ユニットテスト

既存テストファイル workflow-plugin/mcp-server/src/validation/dependency-analyzer.test.ts に新規テストケースを追加する。

テストケース1としてgit追跡済み削除ディレクトリの追加を検証する。
テストケース2としてgitコマンドエラーのハンドリングを検証する。
テストケース3としてgit ls-filesが空出力を返す場合のfalse返却を検証する。
テストケース4としてパストラバーサル防止（ドットドット参照拒否）を検証する。
テストケース5としてプロジェクトルート外アクセス防止を検証する。

#### セキュリティテスト

コマンドインジェクション防止テストでは、セミコロンを含むディレクトリパスでcheckGitTrackedを呼び出す。
意図しないコマンドが実行されないことを確認する。
タイムアウトテストでは、モックで大規模リポジトリ環境を作成してcheckGitTrackedを呼び出す。
1秒でタイムアウトしてfalseが返されることを確認する。

### FIX-3: commitフェーズrm許可のテスト

#### ユニットテスト

既存テストファイル workflow-plugin/hooks/bash-whitelist.test.js に新規テストケースを追加する。

テストケース1としてcommitフェーズでのrm実行許可を検証する。
テストケース2として他フェーズでのrm制御維持を検証する。

#### 統合テスト

commitフェーズで一時ファイルを削除後にgit commitが正常に実行されることを検証する。
phase-edit-guardが削除ファイルを検出し、許可対象外のファイル削除をブロックすることを確認する。

---

## 非機能要件

### パフォーマンス

FIX-1ではpreExistingChanges配列のスプレッド構文によるコピー処理が追加される。
配列サイズは通常100ファイル未満のため、処理時間は1ミリ秒未満で無視できる。

FIX-2ではgit ls-filesコマンドの実行が追加されるが、実行頻度はディレクトリがディスク上に存在しない場合のみである。
通常のリポジトリサイズでは実行時間100ミリ秒未満であり、タイムアウト設定により最大1秒に制限される。

FIX-3ではホワイトリスト配列に1要素を追加するのみであり、パフォーマンス影響は皆無である。

### セキュリティ

FIX-1はpreExistingChanges配列を変更せず保持するのみであり、セキュリティリスクはない。
FIX-2はspawnSyncの使用、パス正規化、プロジェクトルート検証、タイムアウト設定により、コマンドインジェクションとパストラバーサルを完全に防止する。
FIX-3はphase-edit-guardとgit statusによる多層防御が引き続き有効であり、重要ファイルの削除は防止される。

### 保守性

FIX-1はpreExistingChanges保持ロジックを1箇所に集約し、将来のscopeフィールド追加にも対応可能な構造とする。
FIX-2はgit追跡状態確認ロジックを独立した関数checkGitTrackedとして分離し、他のバリデーションでも再利用可能にする。
FIX-3はbash-whitelist.jsの既存構造に従い最小限の変更で実装し、コードスタイルの一貫性を維持する。

---

## 依存関係

### FIX-1の依存関係

workflow-plugin/mcp-server/src/tools/start.ts はpreExistingChangesの記録元であり、読み取りのみで影響なし。
workflow-plugin/mcp-server/src/tools/next.ts はscope検証の呼び出し元であり、インターフェース不変のため影響なし。

### FIX-2の依存関係

child_process.spawnSyncはNode.js組み込みモジュールであり、追加インストール不要。
pathモジュールとfsモジュールは既にインポート済みのため追加不要。
workflow-plugin/mcp-server/src/tools/set-scope.ts はvalidateScopeExistsの呼び出し元であり、返り値の型が不変のため影響なし。

### FIX-3の依存関係

workflow-plugin/hooks/phase-edit-guard.js はrmコマンドの実行制御を担当し、既存制御を維持するため影響なし。

---

## 実装順序

修正の実装順序は以下の通りである。
各修正は独立しているため並列実装も可能だが、順序立てて実施する。

順序1としてFIX-1（preExistingChanges保持）を実装する。
最も単純で影響範囲が小さく、約5行の変更で完了する。

順序2としてFIX-2（git追跡ディレクトリ許可）を実装する。
セキュリティ対策が必要で実装が複雑であり、約45行の変更が必要。

順序3としてFIX-3（commitフェーズrm許可）を実装する。
既存構造への1行追加のみで最もシンプルである。

---

## 受け入れ基準

### FIX-1の受け入れ基準

workflow_set_scope実行後にpreExistingChanges配列が保持されていること。
preExistingChangesプロパティが存在しない状態でもエラーなく動作すること。
addMode=trueとaddMode=falseの両方で正常動作すること。
docs_update→commit遷移時にワークフロー開始前の変更がブロックされないこと。
set-scope.tsに関連する既存のスコープ設定テストが全てパスすること。

### FIX-2の受け入れ基準

git追跡済みで削除済みのディレクトリをスコープに追加できること。
gitリポジトリではない環境で既存動作が維持されること。
コマンドインジェクション攻撃が完全に防止されること。
パストラバーサル攻撃が完全に防止されること。
タイムアウトが1秒で正しく機能すること。
dependency-analyzer.tsに関連する既存のバリデーションテストが全てパスすること。

### FIX-3の受け入れ基準

commitフェーズでrmコマンドが実行可能であること。
ソースコードやテストファイルの削除がphase-edit-guardによりブロックされること。
他のフェーズでrmが引き続き制御されること。
bash-whitelist.jsに関連する既存のBashホワイトリストテストが全てパスすること。

---

## 関連ドキュメント

調査結果はdocs/workflows/スコ-プ管理の3つの根本原因修正/research.mdに記載されている。
要件定義はdocs/workflows/スコ-プ管理の3つの根本原因修正/requirements.mdに記載されている。
脅威モデルはdocs/workflows/スコ-プ管理の3つの根本原因修正/threat-model.mdに記載されている。
ワークフロー仕様はCLAUDE.mdに定義されている。
スコープバリデーションのロジックはworkflow-plugin/mcp-server/src/validation/scope-validator.tsに実装されている。

---

## 変更履歴

本文書は2026年2月16日に初版として作成された。
3つの修正（FIX-1、FIX-2、FIX-3）の詳細な実装仕様を記述した。
FIX-1はset-scope.tsのpreExistingChanges保持に関する約5行の修正を定義した。
FIX-2はdependency-analyzer.tsのgit追跡確認フォールバックに関する約45行の修正を定義した。
FIX-3はbash-whitelist.jsのrmコマンド許可に関する1行の修正を定義した。

実装フェーズ開始: 2026年2月16日
