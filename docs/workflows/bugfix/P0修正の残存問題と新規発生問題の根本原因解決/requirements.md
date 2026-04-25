## サマリー

本ドキュメントは、前回のP0修正コミット（91c3270）後に残存が確認された3件のドキュメント不整合を修正するための要件定義書である。

修正対象はCLAUDE.mdドキュメント群（ルートCLAUDE.mdおよびworkflow-plugin/CLAUDE.md）であり、definitions.ts（正規ソース）との整合性を回復することが目的である。コードの変更は一切行わず、ドキュメントの記述誤りのみを修正する。

主要な決定事項は以下の3点である。
- 問題1: workflow-plugin/CLAUDE.mdのsubagent_type値「Plan」を「general-purpose」に修正する
- 問題2: ルートCLAUDE.mdのBashカテゴリテーブルのdeploy行を「readonly」のみに修正する
- 問題3: ルートCLAUDE.mdのBashカテゴリテーブルのtest_impl行をimplementationカテゴリなしで独立した行に分割する

次フェーズ（planning）で参照すべき情報として、修正は全てドキュメントの文字列置換で完結し、テストコードや実装コードの変更は不要である。各修正箇所のファイルパスと行番号を本ドキュメントに明記する。

---

## 修正対象の背景

### 前回修正（91c3270）の範囲と残存問題の関係

前回のP0修正コミットはフェーズ別subagent設定テーブルの行レベル修正に限定されていた。その結果、以下の3箇所が修正対象外のまま残存した。

1. workflow-plugin/CLAUDE.md内のコード例ブロック（テーブル形式ではないため見落とし）
2. ルートCLAUDE.mdのBashカテゴリテーブルのdeploy行（commit/push行のみが修正対象だった）
3. ルートCLAUDE.mdのBashカテゴリテーブルのtest_impl行（前回修正の検証スコープ外）

3件の問題はいずれも、definitions.tsの正規設定値とCLAUDE.mdの記述との乖離であり、Orchestratorがドキュメントを参照する際に誤った情報を提供するリスクを持つ。

---

## 機能要件

### FR-1: workflow-plugin/CLAUDE.md の subagent_type 修正

**対象ファイル**: `workflow-plugin/CLAUDE.md`
**対象行**: 330行目（並列フェーズ実行コード例内）
**修正内容**: `subagent_type: 'Plan'` を `subagent_type: 'general-purpose'` に変更する

**修正前の記述**:
```
Task({ prompt: '...planning...', subagent_type: 'Plan', model: 'sonnet', description: 'planning' })
```

**修正後の記述**:
```
Task({ prompt: '...planning...', subagent_type: 'general-purpose', model: 'sonnet', description: 'planning' })
```

**根拠**: definitions.tsでは全25フェーズのsubagentTypeがgeneral-purposeに統一されており、「Plan」という値は存在しない。ルートCLAUDE.mdの対応箇所（372行目付近）は既にgeneral-purposeに修正済みであるため、workflow-plugin/CLAUDE.mdとの整合性を取る必要がある。

**重要度**: 高（Orchestratorが誤ったsubagent_typeでTask toolを呼び出した場合、planningフェーズの起動が失敗する）

### FR-2: ルートCLAUDE.md の deploy 行 Bash カテゴリ修正

**対象ファイル**: `CLAUDE.md`（ルート）
**対象行**: 182行目（フェーズ別Bashコマンド許可カテゴリテーブル）
**修正内容**: deploy行の許可カテゴリを「readonly」のみに変更し、用途説明も実態に合わせて修正する

**修正前の記述**:
```
| deploy | readonly, implementation, deploy | デプロイ実行のため |
```

**修正後の記述**:
```
| deploy | readonly | デプロイ確認のため読み取りのみ |
```

**根拠その1**: definitions.ts 964行目ではdeployフェーズのallowedBashCategoriesが「readonly」のみに設定されている。
**根拠その2**: bash-whitelist.jsにはdeployカテゴリが存在しない。仮に「deploy」カテゴリを指定しても展開されるコマンドは空となり機能しない架空のカテゴリである。
**根拠その3**: implementationカテゴリ（npm install、git add等）はdeployフェーズには不要であり、definitions.tsでも含まれていない。

**重要度**: 中（deployフェーズでのコマンド制限の誤解を防ぐ。実行時エラーよりもドキュメントの信頼性に影響する）

### FR-3: ルートCLAUDE.md の test_impl 行分割と Bash カテゴリ修正

**対象ファイル**: `CLAUDE.md`（ルート）
**対象行**: 176行目（フェーズ別Bashコマンド許可カテゴリテーブル）
**修正内容**: test_impl・implementation・refactoringが同一行にまとめられている記述を、test_impl行とimplementation/refactoring行の2行に分割する

**修正前の記述（1行）**:
```
| test_impl, implementation, refactoring | readonly, testing, implementation | テスト・実装・ビルドのため |
```

**修正後の記述（2行）**:
```
| test_impl | readonly, testing | テストコード先行作成のため（TDD Redフェーズ）|
| implementation, refactoring | readonly, testing, implementation | 実装・ビルド・リファクタリングのため |
```

**根拠その1**: definitions.ts 762行目ではtest_implフェーズのallowedBashCategoriesが「readonly, testing」のみである。implementationカテゴリは含まれていない。
**根拠その2**: test_implはTDD Redフェーズであり、テストコードの作成のみを行う段階である。npm installやgit addなどのimplementationカテゴリのコマンドを許可すべき理由がない。
**根拠その3**: implementationカテゴリは「readonly, testing, implementation」として設定されており、test_implとは明確に異なる設定を持つ。これをドキュメントに正確に反映する必要がある。

**重要度**: 中（test_implフェーズでのimplementationカテゴリ許可は過剰なBash権限付与であり、TDDの意図に反する）

---

## 非機能要件

### NFR-1: 変更の最小性

各修正は指定された箇所のみを変更し、周辺の記述に影響を与えないこと。文字列の置換と行の分割という最小限の変更に留める。ドキュメントの他のセクション（フェーズ別subagent設定テーブル、コード例の他の行等）は変更対象外とする。

### NFR-2: definitions.tsとの完全整合性

修正後のCLAUDE.mdの記述が、definitions.tsの正規設定値と一致することを確認すること。具体的にはdefinitions.tsのsubagentType、model、allowedBashCategoriesの各フィールドとCLAUDE.mdの対応箇所が完全一致することが合格条件となる。

### NFR-3: 両CLAUDE.mdの相互整合性

ルートCLAUDE.mdとworkflow-plugin/CLAUDE.mdの記述が相互に矛盾しないこと。同一のsubagent_typeやBashカテゴリが異なるドキュメント間で異なる値として記述されていないことを修正後に確認する。

### NFR-4: 修正箇所の正確な特定

修正は行番号で指定された箇所に対して実施すること。行番号がずれている場合は、文字列検索で正確な箇所を特定してから修正を行う。修正時に不要な空白、改行、インデントの変更を加えないこと。

### NFR-5: コードおよび実装ファイルの不変性

本タスクの修正対象はCLAUDE.mdドキュメントのみである。以下のファイルは変更対象外とする。
- workflow-plugin/mcp-server/src/phases/definitions.ts（正規ソース）
- workflow-plugin/hooks/bash-whitelist.js（フック実装）
- その他のTypeScriptおよびJavaScriptファイル

---

## 修正ファイル一覧

本タスクで変更するファイルは以下の2ファイルのみである。

| ファイルパス | 修正件数 | 修正番号 |
|-------------|---------|---------|
| `C:\ツール\Workflow\workflow-plugin\CLAUDE.md` | 1箇所 | FR-1 |
| `C:\ツール\Workflow\CLAUDE.md` | 2箇所 | FR-2, FR-3 |

---

## 合格条件（受入基準）

修正後に以下の条件を全て満たすことで本タスクを完了とする。

**AC-1**: workflow-plugin/CLAUDE.md内に「subagent_type: 'Plan'」という文字列が存在しないこと。代わりに「subagent_type: 'general-purpose'」が記述されていること。

**AC-2**: ルートCLAUDE.mdのBashカテゴリテーブルにおいて、deploy行が「readonly」のみを許可カテゴリとして記載していること。「implementation」と「deploy」の文字列がdeploy行に含まれていないこと。

**AC-3**: ルートCLAUDE.mdのBashカテゴリテーブルにおいて、test_implが独立した行として存在し、その許可カテゴリが「readonly, testing」であること。「implementation」カテゴリがtest_impl行に含まれていないこと。

**AC-4**: ルートCLAUDE.mdのBashカテゴリテーブルにおいて、implementation/refactoring行が独立した行として存在し、「readonly, testing, implementation」を許可カテゴリとして記載していること。

**AC-5**: 修正後のdefinitions.tsとCLAUDE.mdの対応箇所を比較した際、FR-1、FR-2、FR-3で指定された全ての値が一致すること。
