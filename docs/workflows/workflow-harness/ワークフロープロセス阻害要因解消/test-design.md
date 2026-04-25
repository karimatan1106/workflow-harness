# テスト設計書: ワークフロープロセス阻害要因解消

## サマリー

本テスト設計書は、ワークフロープロセス阻害要因D-1からD-8までの8件の修正を検証するためのテスト戦略とテストケースを定義する。
テスト方式としてTDD Red-Greenサイクルを採用し、test_implフェーズで失敗するテストを先に作成した後、implementationフェーズでfix-all.jsを実装して全テストをGreenにする。
テストファイルはverify-fixes.test.tsとして作成し、修正前の状態確認（Red）と修正後の状態確認（Green）の両方を含む。
修正対象は3つのフックファイル（bash-whitelist.js、phase-edit-guard.js、enforce-workflow.js）であり、各修正は文字列検索・置換で適用される。
テストケースは合計24件で構成され、各修正に対して修正前確認・修正後確認・受入テストの3種類を用意する。
回帰テストとして既存フェーズの動作が影響を受けないことも検証する。

## テスト戦略

### テストアプローチ

テストは静的コンテンツ検証方式を採用する。フックファイルの内容を文字列として読み込み、修正前後でパターンマッチングにより正しい変更が適用されたことを検証する。この方式を選択した理由は、フックファイルがClaude Codeのプロセス内で動作するため、直接的な関数呼び出しテストが困難だからである。fix-all.jsスクリプトは各修正をapplyFix関数で適用し、文字列の一致箇所が厳密に1件であることを保証する安全機構を持つ。

テストランナーにはNode.jsの組み込みassertモジュールを使用する。外部依存を排除することで、テスト環境のセットアップを最小化し、CI/CD環境での実行を容易にする。テストスクリプトはnode コマンドで直接実行可能な形式とし、vitest等のテストフレームワークへの依存を避ける。

### テストファイル構成

テストファイルはsrc/backend/tests/unit/配下に配置する。ルートディレクトリへの配置はCLAUDE.mdの規定により禁止されている。

主要テストファイルとして verify-fixes.test.ts を作成し、全8件の修正を1ファイルで検証する。テストユーティリティとしてファイル読み込みとパターンマッチングのヘルパー関数をテストファイル内に定義する。fix-all.jsスクリプトの実行はchild_processのexecSyncを使用する。

### TDD Red-Greenサイクルの実装

test_implフェーズでは、修正前のフックファイルに対してテストを実行し、8件全てが「問題あり」として検出されることを確認する（Redフェーズ）。implementationフェーズでfix-all.jsを作成・実行した後、同じテストが全てパスすることを確認する（Greenフェーズ）。テストコードの変更なしにRedからGreenへ遷移することがTDDの原則である。

## テストケース

### TC-D1: ci_verificationフェーズのverificationPhases登録確認

ci_verificationフェーズがbash-whitelist.jsのgetWhitelistForPhase()関数内のverificationPhasesグループに含まれているかを検証する。修正前はverificationPhases配列に'ci_verification'が存在せず、else節にフォールバックしてreadonly権限のみが付与される状態である。修正後はverificationPhases配列に'ci_verification'が追加され、ghコマンド等のCI検証コマンドが実行可能になる。テストではファイル内容を読み込み、verificationPhases定義行に'ci_verification'が含まれるかをassertStrictEqualで検証する。受入基準として、ci_verificationフェーズでgh pr checksコマンドがホワイトリストに合致することを確認する。

### TC-D2: deployフェーズのdeployPhasesグループ登録確認

deployフェーズ用の専用グループdeployPhasesが新設され、deployフェーズが正しく登録されているかを検証する。修正前にはdeployPhasesグループ自体が存在しない。修正後はconst deployPhases配列が定義され、'deploy'が含まれ、さらにgetWhitelistForPhase関数内のif文にdeployPhases.includes(phase)条件が追加される。テストではファイル内容からdeployPhases定義とgetWhitelistForPhase内の条件分岐の両方を確認する。受入基準として、deployフェーズでdocker、kubectl、sshコマンドがホワイトリストに合致することを確認する。

### TC-D3: シェル組み込みコマンドのsplitCompoundCommand対応確認

SHELL_BUILTINS定数が定義され、splitCompoundCommandの結果からシェル組み込みコマンド（true、false、exit等）がフィルタリングされるかを検証する。修正前はsplitCompoundCommandが`cmd || true`を`["cmd", "true"]`に分割し、"true"がホワイトリストに未登録のためブロックされる。修正後はSHELL_BUILTINS定数にtrue、false、exit等が定義され、checkCommand関数内でSHELL_BUILTINSに含まれるコマンドはホワイトリスト検証をスキップする。テストではSHELL_BUILTINS定義の存在と、checkCommand内のスキップロジックの両方を確認する。受入基準として`npm test || true`が正常に許可されることを確認する。

### TC-D4: nodeコマンドのホワイトリスト登録確認

nodeコマンドがtestingおよびcode_edit（implementation）のBASH_WHITELISTに追加されているかを検証する。修正前はBASH_WHITELIST.readonlyに`node -e`のみが登録されており、`node filename.js`形式はマッチしない。修正後はBASH_WHITELIST.testingおよびBASH_WHITELIST.code_editに'node 'が追加され、任意のnodeコマンドが許可される。テストではBASH_WHITELISTオブジェクト内のtestingとcode_editの定義に'node 'エントリが含まれるかを確認する。受入基準として`node verify-fixes.test.ts`がtestingフェーズで実行可能であることを確認する。

### TC-D5: PHASE_ORDERの欠落フェーズ追加確認

phase-edit-guard.jsのPHASE_ORDER配列に10件の欠落フェーズが追加されているかを検証する。追加対象はparallel_analysis、parallel_design、parallel_quality、regression_test、parallel_verification、performance_test、e2e_test、push、ci_verification、deployの10フェーズである。修正前のPHASE_ORDER要素数は約21件で、修正後は31件になる。テストではPHASE_ORDER配列の内容を正規表現で抽出し、全10フェーズが含まれていることを個別に確認する。受入基準として、findNextPhaseForFileType関数が全31フェーズに対して正しいガイダンスを返すことを確認する。

### TC-D6: git -Cオプションの正規化処理確認

normalizeGitCommand関数がbash-whitelist.jsに追加され、`git -C /path/to/dir status`を`git status`に正規化するかを検証する。修正前は`git -C`オプション付きコマンドがpartTrimmed.startsWith(allowedCommand)で一致しないためブロックされる。修正後はnormalizeGitCommand関数が定義され、checkCommand内でホワイトリスト照合前にgitコマンドが正規化される。テストではnormalizeGitCommand関数の定義存在と、checkCommand内での呼び出し箇所の両方を確認する。受入基準として`git -C ../other-repo status`がgit statusとしてホワイトリストに合致することを確認する。

### TC-D7: displayBlockMessageのstderr出力確認

phase-edit-guard.jsのdisplayBlockMessage関数内のconsole.log呼び出しがconsole.errorに変更されているかを検証する。修正前はdisplayBlockMessage関数内の全てのメッセージ出力がconsole.logを使用しており、stdoutに出力される。修正後はconsole.errorに変更され、stderrに出力される。テストではdisplayBlockMessage関数の本体を正規表現で抽出し、console.logの呼び出しが残存していないことと、console.errorが使用されていることを確認する。受入基準としてブロック時のメッセージがprocess.stderrストリームに出力されることを確認する。

### TC-D8: architecture_reviewの余剰定義削除確認

enforce-workflow.jsのPHASE_EXTENSIONSとPHASE_DESCからarchitecture_review定義が削除されているかを検証する。修正前はPHASE_EXTENSIONSオブジェクトに`'architecture_review': ['.md']`が、PHASE_DESCにもarchitecture_reviewのエントリが存在する。修正後は両方のオブジェクトからarchitecture_review関連の行が削除される。テストではファイル内容全体を検索し、architecture_reviewという文字列が一切含まれないことを確認する。受入基準としてenforce-workflow.jsにarchitecture_reviewへの参照が残存しないことを確認する。

## 回帰テスト

### 既存フェーズの動作継続性確認

D-1とD-2の修正によりgetWhitelistForPhase関数のフェーズ分類が変更されるため、既存の全フェーズが従来通りの権限グループに割り当てられることを確認する。具体的には、readonlyPhasesに属するresearch、requirements等のフェーズ、implementationPhasesに属するimplementation、refactoring等のフェーズ、testingPhasesに属するtesting、test_impl等のフェーズが、修正前後で同一の権限グループに所属することをテストする。この回帰テストにより、新規フェーズ追加が既存フェーズの動作に影響を与えないことを保証する。

### splitCompoundCommandの既存動作維持確認

D-3の修正でシェル組み込みコマンドのフィルタリングを追加するが、通常のコマンド分割動作は変更されないことを確認する。`npm test && npm run build`が正しく`["npm test", "npm run build"]`に分割され、各パートが個別にホワイトリスト検証される既存動作が維持されることをテストする。パイプ`|`やセミコロン`;`による分割も同様に検証する。

### PHASE_ORDERの既存フェーズ順序維持確認

D-5の修正で10フェーズを追加するが、既存フェーズの相対的な順序が変更されないことを確認する。research、requirements、planning、implementation等の既存フェーズが修正前と同じ順番で並んでいることをテストする。フェーズの挿入位置が適切で、ワークフローの論理的な順序が保たれていることを確認する。

## エッジケーステスト

### D-3のエッジケース: 複雑な複合コマンド

`npm test || true && echo done`のように複数の演算子を含むコマンドのテストケースを設計する。この場合、splitCompoundCommandは`["npm test", "true", "echo done"]`に分割し、"true"はSHELL_BUILTINSとしてスキップされ、残りの"npm test"と"echo done"のみがホワイトリスト検証される。

### D-6のエッジケース: 複数の-Cオプション

`git -C /path1 -C /path2 status`のように-Cオプションが複数指定された場合のテストケースを設計する。normalizeGitCommand関数は全ての`-C <path>`ペアを除去し、最終的に`git status`に正規化する。

### D-4のエッジケース: nodeコマンドのバリエーション

`node --experimental-modules script.mjs`のようにフラグ付きのnodeコマンドや、`node -e "console.log('test')"`の既存パターンが引き続き動作することを確認する。`node`の前方一致により、あらゆるnode実行形式が許可される。

## テスト実行手順

### Redフェーズ（test_impl）の実行

test_implフェーズでは、修正適用前のフックファイルに対してverify-fixes.test.tsを実行する。この時点ではD-1からD-8の全てが未修正状態であるため、修正後確認テスト（should-pass系）は全て失敗し、修正前確認テスト（should-detect系）は全て成功する。Redフェーズの完了条件は、修正後確認テストが8件全て失敗していることである。

### Greenフェーズ（implementation）の実行

implementationフェーズではfix-all.jsスクリプトを作成し実行する。実行後にverify-fixes.test.tsを再実行し、修正前確認テスト（問題検出系）は結果が反転して失敗し、修正後確認テスト（修正確認系）が全て成功する。Greenフェーズの完了条件は、全24テストケースのうち修正後確認テスト8件と受入テスト8件の合計16件がパスしていることである。

### 受入テストの実行

受入テストでは、実際のワークフロー実行に近い形式でフックの動作を検証する。各修正が実運用で期待通りに機能することを確認する。受入テスト8件が全てパスすることで、本タスクの修正が品質基準を満たしたと判断する。
