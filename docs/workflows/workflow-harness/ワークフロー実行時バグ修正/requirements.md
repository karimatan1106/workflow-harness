# ワークフロー実行時バグ修正 - 要件定義

## サマリー

本ドキュメントは、ワークフロー実行中に発見された4つのバグを修正するための要件を定義したものです。

- 目的: research.mdで特定された根本原因に基づき、各バグの修正要件を明確化する
- 主要な決定事項: バグ1はtestingフェーズのハッシュチェックをスキップする条件追加、バグ2はhasRedirection関数の修正、バグ3はdefinitions.tsのallowedBashCategoriesをgitカテゴリに変更、バグ4はpushフェーズのsubagentTemplateにブランチ確認手順を追加
- 次フェーズで必要な情報: 各修正対象ファイルのパスと変更箇所の詳細（research.mdの「修正対象ファイルまとめ」参照）

修正優先度はバグ1が最高（毎回のtestingフェーズ遷移をブロックする致命的な問題）、次いでバグ3（subagentへの誤情報伝達）、バグ4（ブランチ名誤指定）、バグ2（再現条件の絞り込みが必要）の順です。

---

## 機能要件

### FQ-1: testingフェーズの自己参照ハッシュチェック修正（バグ1）

**問題の背景**

testingフェーズで `workflow_record_test_result` を呼んだ直後に `workflow_next` を呼ぶと、
「テスト出力が以前と同一です（コピペの可能性）」エラーが発生してフェーズ遷移がブロックされる。
これは `record_test_result` がハッシュを `testOutputHashes` 配列に追加した後、`workflow_next`
が同じ配列を参照してチェックするため、自己参照的な重複検出が発生するためである。

**修正要件**

- `next.ts` の testingフェーズブロック（line 266-275）内のハッシュ重複チェックを、testingフェーズでスキップする条件を追加すること
- regression_testフェーズで実装済みのスキップロジック（`currentPhase !== 'regression_test'` 条件）を参考に、testingフェーズでも同様のスキップを適用すること
- ハッシュチェックの目的（コピペ検出）は維持しつつ、`record_test_result` 直後の自己参照ケースのみ除外すること
- testingフェーズでの `workflow_next` がハッシュ重複エラーを返さないことを確認すること

**受入基準**

- testingフェーズで1回 `record_test_result` を呼んだ後、`workflow_next` が成功すること
- regression_testフェーズには既存のスキップロジックが引き続き適用されること
- 他のフェーズでのハッシュ重複検出ロジックが変更されていないこと

---

### FQ-2: bash-whitelist.jsのリダイレクトパターン修正（バグ2）

**問題の背景**

`hasRedirection` 関数（bash-whitelist.js line 268-270）は `part.includes('>')` という粗い検索を使用しており、
`>=` 演算子を含む文字列でも `>` が存在するためtrueを返す可能性がある。
awk-redirectタイプのチェックで用いられるこの関数が、比較演算子を含むシェルコマンドの引数を
誤ってリダイレクトと判定するリスクがある。

**修正要件**

- `hasRedirection` 関数が `>=` や `<=` などの比較演算子をリダイレクトとして誤検出しないよう修正すること
- 修正は `>` の後ろが `=` で続く場合はリダイレクトと判定しない形にすること
- 正しいリダイレクト（`> file.txt` や `>> file.txt` など）は引き続き検出すること
- `> ` パターン（`>` の後にスペース）や `>>` パターンの検出精度を維持すること

**受入基準**

- `node -e "if (a >= 0) { console.log(a); }"` がリダイレクト誤検出でブロックされないこと
- `echo hello > output.txt` はリダイレクトとして正しく検出されること
- `cat file >> log.txt` はリダイレクトとして正しく検出されること

---

### FQ-3: definitions.tsのcommit/pushフェーズBashカテゴリ修正（バグ3）

**問題の背景**

`definitions.ts` のcommitフェーズ（line 940-945）およびpushフェーズ（line 947-954）において、
`allowedBashCategories` が `['readonly', 'implementation']` と設定されており、正しい値である
`['readonly', 'git']` とは異なる。これにより、subagentへのプロンプトに誤情報が伝わり、
subagentが `git push` を実行しない判断を下すリスクがある。

**修正要件**

- `definitions.ts` のcommitフェーズの `allowedBashCategories` を `['readonly', 'git']` に変更すること
- `definitions.ts` のpushフェーズの `allowedBashCategories` を `['readonly', 'git']` に変更すること
- 変更後のカテゴリ設定がCLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」表と一致すること
- 変更後のカテゴリ設定が `bash-whitelist.js` の `getWhitelistForPhase` の実装（gitPhases配列を参照してreadonly+gitを返すロジック）と一致すること

**受入基準**

- `definitions.ts` のcommitフェーズの `allowedBashCategories` が `['readonly', 'git']` であること
- `definitions.ts` のpushフェーズの `allowedBashCategories` が `['readonly', 'git']` であること
- subagentへ送信されるBashコマンド制限セクションに `git` カテゴリが正しく表示されること

---

### FQ-4: pushフェーズのsubagentTemplateにブランチ確認手順を追加（バグ4）

**問題の背景**

pushフェーズの `subagentTemplate` には「リモートリポジトリにプッシュしてください」とのみ記述されており、
ブランチ名の確認手順が欠如している。subagentが自律的に判断してブランチを選択するため、
環境によって `master` か `main` かが異なる場合に誤ったブランチにpushするリスクがある。

**修正要件**

- `definitions.ts` のpushフェーズの `subagentTemplate` に、`git branch --show-current` または `git rev-parse --abbrev-ref HEAD` でカレントブランチ名を確認する手順を追加すること
- 確認したブランチ名を使って `git push origin {branchName}` を実行するよう指示すること
- サブモジュールが含まれるリポジトリでは、サブモジュールのブランチ名も個別に確認してからpushするよう指示すること
- テンプレートがブランチ名をハードコードせず、実行時に動的に確認する形にすること

**受入基準**

- subagentがpushフェーズで `git branch --show-current` を実行してブランチ名を確認すること
- 確認したブランチ名を使った `git push origin {確認されたブランチ名}` が実行されること
- `main`、`master`、その他のブランチ名のどれであっても正しくpushされること

---

## 非機能要件

### NF-1: 後方互換性の維持

修正は既存のワークフロー動作を壊さない最小限の変更に留めること。testingフェーズ以外のフェーズで
ハッシュ重複チェックが動作している部分には手を加えないこと。regression_testフェーズの既存の
スキップロジックは変更せず、testingフェーズに対して同様のスキップを「追加」する形で実装すること。

---

### NF-2: コードの整合性

修正後は `definitions.ts` の `allowedBashCategories` 設定と `bash-whitelist.js` の
`getWhitelistForPhase` の実装が一致していること。CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」
の記述とも整合していること。ドキュメント・フック・フェーズ定義の三者が同じ情報を持つ状態を維持すること。

---

### NF-3: サブモジュール対応

バグ4のテンプレート修正では、親リポジトリとサブモジュールが異なるブランチを持つ構成を考慮すること。
`workflow-plugin` のような依存サブモジュールが含まれる場合でも、正しいブランチにpushできるよう
明示的な確認手順を提供すること。

---

### NF-4: MCPサーバー再起動の要否判断

バグ3はdefinitions.tsを修正するため、MCPサーバーの再起動が必要になる。
CLAUDE.mdの「強制再起動条件」に従い、definitions.tsを変更した後は必ずMCPサーバーを再起動すること。
バグ1はnext.tsを修正するため、同様にMCPサーバーの再起動が必要である。
バグ2はhooks側のbash-whitelist.jsを修正するため、フックキャッシュのリフレッシュを確認すること。

---

### NF-5: テスト可能性

各バグの修正後は、対応するユニットテストまたは手動検証手順によって修正が有効であることを確認できること。
testingフェーズのハッシュチェック修正（バグ1）は、実際のtestingフェーズ遷移を試みることで検証できること。
allowedBashCategories修正（バグ3）は、subagentへ送信されるプロンプトを検査することで確認できること。
