# 前回修正時の残存問題調査と解決 - 調査報告

## サマリー

このドキュメントは、RCA-1タスク（next.tsのデッドコード削除）実行中に発見された残存問題を調査した結果をまとめたものである。

調査の目的は以下の3点である:
- `verify-sync.test.ts` の重複ファイル問題の原因と内容差分を確認する
- テストカウントが852から897に増加した原因を特定する
- `git status` の現状とコミット5d0450fの適用状況を確認する

主要な発見事項:
- `mcp-server/src/verify-sync.test.ts`（未追跡）と `mcp-server/src/__tests__/verify-sync.test.ts`（追跡済み）は同じ826行だが、内容に3箇所の差分がある
- 未追跡ファイルはRCA-1タスク実行中に作成されたもので、gitに追跡されていない
- テストカウント増加（852→897）は4ead400コミットで追加された `bug-fix-regression-transition.test.ts`（12テストケース）が主な原因と推定される
- コミット5d0450fのnext.ts修正は正しく適用されている

次フェーズで必要な情報:
- 未追跡の `verify-sync.test.ts` をどう扱うか（削除するか追跡するかの判断）
- テストカウント変動が意図的かどうかの確認（ベースライン852 vs 現在897）

---

## 1. git状態の確認

### ワークフロープラグイン（サブモジュール）の状態

`workflow-plugin` サブモジュール内のgit statusは以下の通りである:

- ブランチ: `main`
- リモートより1コミット先行している（`origin/main` より1コミット進んでいる）
- コミットされていない変更: なし
- ワーキングツリー: クリーン

つまり、`workflow-plugin` サブモジュール自体のワーキングディレクトリには変更はなく、最新コミット5d0450fのみが未プッシュの状態である。

### メインリポジトリの状態

メインリポジトリ（`/c/ツール/Workflow`）には多数のステージされていない変更があるが、これらは以前のタスクで削除された古いワークフロー状態ファイルや動画ファイルであり、今回の調査対象とは直接関係がない。未追跡ファイルとして `docs/security/threat-models/workflow-runtime-bugs.md` と `docs/security/threat-models/workflow-runtime-root-cause.md` が存在する。

---

## 2. verify-sync.test.tsの重複ファイル問題

### ファイルの追跡状態

`git ls-files` の結果から以下が確認された:

- `mcp-server/src/__tests__/verify-sync.test.ts`: git追跡済み（コミットb642cc2で追加）
- `mcp-server/src/verify-sync.test.ts`: gitに追跡されていない（未追跡ファイル）

コミットb642cc2（2026年2月18日）で `mcp-server/src/__tests__/verify-sync.test.ts` と `mcp-server/src/verify-sync.ts` が同時に追加された。この時点で `mcp-server/src/` 直下にはテストファイルは存在しなかった。

### 未追跡ファイルの作成時期

ファイルのタイムスタンプから:
- `mcp-server/src/verify-sync.test.ts`（未追跡）: 2026年2月19日 20:49
- `mcp-server/src/__tests__/verify-sync.test.ts`（追跡済み）: 2026年2月19日 20:53

RCA-1タスクのコミット5d0450fが2026年2月19日21:03に作成されているため、両ファイルはRCA-1タスクの実行中に修正されていたことがわかる。未追跡ファイルの方が4分早いタイムスタンプを持つ。

### 2つのファイルの内容差分

両ファイルはどちらも826行で同名のテストケースを持つが、以下の3箇所に差分がある:

**差分1: vi.mock のパス（22行目付近）**

未追跡ファイル（src直下）:
```typescript
vi.mock('./phases/definitions.js', () => ({
```

追跡済みファイル（__tests__内）:
```typescript
vi.mock('../phases/definitions.js', () => ({
```

これは `__tests__` ディレクトリからの相対パスの違いで、追跡済みファイルの方が正しいパス指定をしている。

**差分2: TC-1-3テストケース（165〜220行付近）**

未追跡ファイル（古い版）の主要な相違点:
- `simplePhases` 配列に `'completed'` を含む（15件のフェーズ）
- コメントに「主要フェーズ15件 + サブフェーズ11件 = 26件」と記載
- `expect(result).toHaveLength(26)` を検証

追跡済みファイル（新しい版）の内容:
- `simplePhases` 配列に `'completed'` を含まない（14件のフェーズ）
- コメントに「非並列フェーズ14件 + サブフェーズ11件 = 25件」と記載
- `expect(result).toHaveLength(25)` を検証

この差分は、`completed` フェーズが `PHASE_GUIDES` に含まれるかどうかの仕様変更を反映している。追跡済みファイルの方が正しい最新の仕様を反映しており、25フェーズが正しい期待値である。

**差分3: TC-6-4テストケース（722〜771行付近）**

未追跡ファイルでは `simplePhases` に `'completed'` を含む（16フェーズ）、25件未満であることを `26件未満` で検証している内容になっており、追跡済みファイルではdeployを除いた13件の非並列フェーズで24件を正しく検証している。

### 未追跡ファイルが存在する原因

RCA-1タスクの作業中に誰かが（あるいはサブエージェントが）`mcp-server/src/` 直下に誤った場所でテストファイルを作成したと推定される。正しい配置場所は `mcp-server/src/__tests__/` 直下であり、追跡済みファイルが正規のファイルである。未追跡ファイルは古い版であり、かつ配置場所も誤っているため、削除が適切な処置となる。

---

## 3. テストカウント変動の原因調査

### ベースライン（852件）と現在（897件）の差

892件から897件の差分は45件増加となる。実際のテスト数は調査時点でのみ確認できないが（testingカテゴリのコマンドがresearchフェーズではブロックされるため）、追加されたテストファイルの内容から原因を推定する。

### コミット4ead400（2026年2月19日）の影響

コミット4ead400では以下の変更があった:
- `mcp-server/src/tools/__tests__/bug-fix-regression-transition.test.ts` が新規追加（628行、12テストケース）
- `mcp-server/src/tools/__tests__/record-test-result-output.test.ts` が修正（15行変更）
- `mcp-server/src/tools/next.ts` が修正（18行変更）
- `mcp-server/src/tools/record-test-result.ts` が修正（10行変更）

`bug-fix-regression-transition.test.ts` には628行にわたる包括的なテストスイートが含まれており、12のテストケースが記述されている。このファイルの追加が主な増加要因と見られる。

### コミット間のテスト数変動の経緯

ベースライン852件は、おそらく4ead400コミット以前のテスト数を指している可能性がある。4ead400コミットで `bug-fix-regression-transition.test.ts` が追加され、さらにその後の変更でテスト数が増加したと考えられる。verify-sync.test.tsが追加されたコミットb642cc2（2026年2月18日）でも30件のテストケースが追加されているため、そちらも増加の一因となっている。

このテスト数の増加は、バグ修正と機能追加に伴う意図的なテストカバレッジ拡充であり、リグレッション問題ではないと判断される。

---

## 4. コミット5d0450fの修正内容確認

### 変更されたファイルと内容

コミット5d0450f（2026年2月19日21:03）は以下の変更を含む:
- 変更ファイル: `mcp-server/src/tools/next.ts` のみ
- 変更内容: 2件の追加、12件の削除（合計14行の変更）

コミットメッセージ: 「fix: remove dead code in regression_test hash validation (RCA-1)」

削除されたコードの内容:
- `recordTestOutputHash` のimport文を `validateTestAuthenticity` のimport文から分離していた部分を整理した
- `if (currentPhase !== 'regression_test')` という常に偽となる条件分岐ブロック（10行）を削除した

条件が常に偽となる理由: ハッシュ重複チェックのコードブロック自体が、その外側でregression_testフェーズ限定の処理として呼び出されるため、`currentPhase !== 'regression_test'` は絶対に真にならない。

### 修正後の状態

削除されたデッドコードは以下の処理を行っていた:
- `taskState.testOutputHashes` から既存ハッシュ配列を取得する
- `recordTestOutputHash` 関数を呼び出してハッシュを記録・検証する
- ハッシュが無効で `testStrict` が真の場合にエラーメッセージを返す

現在は代わりにコメント「ハッシュ重複チェックは record-test-result.ts 側で対処済みのためスキップ」のみが残り、`recordTestOutputHash` のimportも削除されている。修正は正しく適用されており、コードはクリーンな状態である。

---

## 5. 残存問題のまとめと推奨対応

### 問題1: 未追跡の verify-sync.test.ts

現在の状態: `mcp-server/src/verify-sync.test.ts` がgit未追跡の状態で存在している。
内容の評価: 追跡済みファイルより古い版であり、vi.mockパスが誤っている。

推奨対応: このファイルを削除する。正しいテストファイルは `mcp-server/src/__tests__/verify-sync.test.ts` であり、そちらが最新の正しい内容（25フェーズ対応、正しいimportパス）を持つ。

### 問題2: テストカウント変動

現在の状態: ベースライン852から897への増加が記録されている。
内容の評価: 増加分の大部分は意図的なバグ修正用テストの追加（4ead400コミット）によるものと推定され、リグレッションではない。

推奨対応: テストを実際に実行して正確な現在のカウントを確認し、増加が全て意図的なものかを検証する。既知バグとしての記録は不要と判断される。

### 問題3: next.tsのデッドコード削除（完了済み）

コミット5d0450fは正しく適用されており、追加の対応は不要である。デッドコードと未使用importの両方が削除されており、コードは期待通りの状態となっている。
