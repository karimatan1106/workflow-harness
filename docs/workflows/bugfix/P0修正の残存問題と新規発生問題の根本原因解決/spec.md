## サマリー

本仕様書は、前回のP0修正コミット（91c3270）後に残存が確認された3件のドキュメント不整合を修正するための実装計画を定義する。

修正対象は以下の2ファイルであり、コードや設定ファイルへの変更は一切行わない。

- `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`（1箇所: FR-1）
- `C:\ツール\Workflow\CLAUDE.md`（2箇所: FR-2, FR-3）

主要な決定事項：

- FR-1: `workflow-plugin/CLAUDE.md` の330行目にある `subagent_type: 'Plan'` を `subagent_type: 'general-purpose'` に修正する
- FR-2: ルートCLAUDE.md の182行目にある deploy 行の許可カテゴリを `readonly` のみに変更し、用途説明を「デプロイ確認のため読み取りのみ」に修正する
- FR-3: ルートCLAUDE.md の176行目を2行に分割し、test_impl 行は `readonly, testing`、implementation/refactoring 行は `readonly, testing, implementation` とする

次フェーズ（implementation）では、Edit ツールを使用して上記の文字列置換・行分割を実施し、修正後に Read ツールで内容を検証する。

---

## 概要

### 背景と前回修正の残存問題

前回修正（コミット91c3270）はフェーズ別subagent設定テーブルの行レベル修正に限定されており、コード例内やBashカテゴリテーブルの他の行等は修正対象外であった。その結果、3件の記述誤りが残存問題として見落とされた。要件定義書に明記された通り、これらの残存問題はdefinitions.tsの正規設定値とCLAUDE.mdの記述の乖離であり、Orchestratorがドキュメントを参照して誤った情報を取得するリスクを持つ。

### 目的とスコープ

本タスクの目的は、CLAUDE.md ドキュメントの記述をdefinitions.tsの実装値に合わせて正確に修正し、完全整合性を回復することである。修正内容はドキュメントの文字列置換と行分割のみで完結し、コード・設定・テストへの変更は一切含まれない。修正後のドキュメントは、Orchestratorやsubagentが参照した際に正確なガイダンスを提供でき、実行時エラーや誤解を防止できる状態となることを目指す。

### 修正の関係と独立性

3件の不整合（FR-1, FR-2, FR-3）は互いに独立しており、それぞれ単独で修正可能である。各修正箇所のファイルパスと行番号は要件定義書に具体的に特定されている。FR-3 を最初に適用するのは行分割による行番号変動を考慮した論理的な順序であり、Edit ツールの文字列マッチング特性から厳密には順序依存はない。

---

## 変更対象ファイル

### 正規ソースファイル（参照のみ・変更なし）

- `workflow-plugin/mcp-server/src/phases/definitions.ts`
  - 全フェーズの `subagentType`、`allowedBashCategories` の真の値が定義されている
  - test_impl フェーズ（762行目付近）: allowedBashCategories = `readonly, testing`
  - deploy フェーズ（964行目付近）: allowedBashCategories = `readonly`
  - 全フェーズの subagentType = `general-purpose`（`Plan` という値は存在しない）

### 修正対象ファイル（Edit ツールで変更）

- `C:\ツール\Workflow\CLAUDE.md`
  - FR-3 適用箇所: フェーズ別Bashコマンド許可カテゴリテーブルの test_impl 行（176行目）
  - FR-2 適用箇所: フェーズ別Bashコマンド許可カテゴリテーブルの deploy 行（182行目）

- `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`
  - FR-1 適用箇所: subagentによるフェーズ実行の並列フェーズ例示コードブロック内（330行目）

---

## 実装計画

### FR-3: test_impl 行の分割（最優先）

**対象**: `C:\ツール\Workflow\CLAUDE.md` の test_impl/implementation/refactoring 統合行

**現状**: 3フェーズが1行にまとめられ、すべてに `readonly, testing, implementation` が適用されている記述になっている。

**実装手順**:
1. Edit ツールで old_string に現在の1行全体を指定する
2. new_string に改行を含む2行（test_impl 用と implementation/refactoring 用）を指定する
3. Read ツールで対象行の前後5行を読み込み、分割が正しく反映されたことを確認する

**合格条件**: test_impl 行の許可カテゴリが `readonly, testing` のみであり、`implementation` カテゴリが含まれていないこと。

### FR-2: deploy 行の許可カテゴリ修正

**対象**: `C:\ツール\Workflow\CLAUDE.md` の deploy フェーズ行

**現状**: `readonly, implementation, deploy` という過剰なカテゴリが記述されており、definitions.ts の `readonly` のみという設定と乖離している。

**実装手順**:
1. Edit ツールで deploy 行全体を old_string として指定する
2. new_string で `readonly` のみに絞り、用途説明を「デプロイ確認のため読み取りのみ」に変更する
3. Read ツールで修正行を確認し、`implementation` と `deploy` カテゴリが消えていることを検証する

**合格条件**: deploy 行の許可カテゴリが `readonly` のみであり、`implementation`・`deploy` の文字列が当該行に存在しないこと。

### FR-1: subagent_type 値の修正

**対象**: `C:\ツール\Workflow\workflow-plugin\CLAUDE.md` の並列フェーズ例示コード内の planning 行

**現状**: `subagent_type: 'Plan'` という存在しない値が記述されており、同コードブロック内の threat_modeling 行（`general-purpose`）と矛盾している。

**実装手順**:
1. Edit ツールで当該行全体を old_string として指定する（コードブロック外への誤適用防止）
2. new_string で `subagent_type: 'general-purpose'` に置換する
3. Read ツールで修正行を確認し、`'Plan'` という文字列が消えていることを検証する

**合格条件**: 当該行に `subagent_type: 'general-purpose'` が記述されており、`'Plan'` という文字列が存在しないこと。

### 最終検証ステップ

全3件の修正完了後、以下の検証を実施する。

- ルートCLAUDE.md のフェーズ別Bashコマンド許可カテゴリテーブル全体を Read ツールで読み込み、FR-2・FR-3 の合格条件を目視確認する
- workflow-plugin/CLAUDE.md の対象コードブロック全体を Read ツールで読み込み、FR-1 の合格条件を目視確認する
- definitions.ts の対応フィールド（subagentType、allowedBashCategories）の値とCLAUDE.md の記述が一致していることを確認する

---

## 修正方針

### 修正の基本原則

本タスクはドキュメントの文字列置換と行分割のみで完結する。`workflow-plugin/mcp-server/src/phases/definitions.ts` を正規ソースとして扱い、CLAUDE.md の記述をその内容に合わせる。各修正は指定された修正箇所のみに最小限の変更を加え、周辺の記述・書式・空白・インデントを維持する。変更対象外のセクション（フェーズ別subagent設定テーブルの修正済み行等）には一切変更を加えない。フック（phase-edit-guard）によるBashコマンド制限は実装コードとドキュメント記述の同一の値に基づいて動作するため、ドキュメントの記述が正規設定値と完全一致することが信頼性を確保する前提条件となる。

### 修正の優先順序

実装フェーズでは以下の順序で修正を行う。

1. ルートCLAUDE.md の176行目（FR-3: test_impl行の分割）
2. ルートCLAUDE.md の182行目（FR-2: deploy行のカテゴリ修正）
3. workflow-plugin/CLAUDE.md の330行目（FR-1: subagent_type値の修正）

FR-3 を最初に行う理由は、行の分割によって行番号がずれるため、FR-2（182行目）の修正前に完了させる必要があるからである。ただし Edit ツールは文字列マッチングで動作するため、行番号のずれは実際には問題にならない。処理の論理的な順序として先に実施する。

---

## FR-1: workflow-plugin/CLAUDE.md の subagent_type 修正

### 対象ファイルと現状

ファイルパス: `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`

現在の330行目（parallel_analysisの例示コードブロック内）の記述：

```
Task({ prompt: '...planning...', subagent_type: 'Plan', model: 'sonnet', description: 'planning' })
```

### 修正後の記述

```
Task({ prompt: '...planning...', subagent_type: 'general-purpose', model: 'sonnet', description: 'planning' })
```

### 修正方法

Edit ツールを使用して、`subagent_type: 'Plan'` を `subagent_type: 'general-purpose'` に置換する。対象の old_string として行全体を指定することで、他のファイル・他の箇所への誤った適用を防ぐ。

### 修正根拠

`workflow-plugin/mcp-server/src/phases/definitions.ts` では全25フェーズの subagentType が `general-purpose` に統一されており、`Plan` という値は定義されていない。ルートCLAUDE.md の対応箇所（threat_modeling 行）は既に修正済みで `general-purpose` に設定されている。重要度は高レベルであり、Orchestratorが誤ったsubagent_typeでTask toolを起動した場合、planningフェーズのsubagent起動が失敗してワークフロー全体が停止するリスクがある。コード例内の記述誤りが実行時エラーの直接原因となる。

### 受入基準（AC-1）

- workflow-plugin/CLAUDE.md 内に `subagent_type: 'Plan'` という文字列が存在しないこと
- 当該行に `subagent_type: 'general-purpose'` が記述されていること

---

## FR-2: ルートCLAUDE.md の deploy 行修正

### 対象ファイルと現状

ファイルパス: `C:\ツール\Workflow\CLAUDE.md`

現在の182行目（フェーズ別Bashコマンド許可カテゴリテーブル内）の記述：

```
| deploy | readonly, implementation, deploy | デプロイ実行のため |
```

### 修正後の記述

```
| deploy | readonly | デプロイ確認のため読み取りのみ |
```

### 修正方法

Edit ツールを使用して、deploy 行全体を old_string として指定し、修正後の1行に置換する。`replace_all` は使用せず、行全体をパターンとして安全に置換する。

### 修正根拠

`workflow-plugin/mcp-server/src/phases/definitions.ts` の964行目では deploy フェーズの allowedBashCategories が `readonly` のみに設定されている。また bash-whitelist.js には `deploy` カテゴリ自体が定義されておらず、仮に指定されても展開されるコマンドは空となる架空のカテゴリである。`implementation` カテゴリ（npm install、git add 等）はデプロイ確認フェーズには不要であり、過剰な権限付与の実態を示す。重要度は中レベルであり、deployフェーズでの制限に対する誤解を防ぎ、ドキュメントの信頼性を確保する結果につながる。

### 受入基準（AC-2）

- deploy 行の許可カテゴリが `readonly` のみであること
- `implementation` と `deploy` という文字列が deploy 行に含まれていないこと

---

## FR-3: ルートCLAUDE.md の test_impl 行分割

### 対象ファイルと現状

ファイルパス: `C:\ツール\Workflow\CLAUDE.md`

現在の176行目（フェーズ別Bashコマンド許可カテゴリテーブル内）の記述（1行）：

```
| test_impl, implementation, refactoring | readonly, testing, implementation | テスト・実装・ビルドのため |
```

### 修正後の記述（2行）

```
| test_impl | readonly, testing | テストコード先行作成のため（TDD Redフェーズ）|
| implementation, refactoring | readonly, testing, implementation | 実装・ビルド・リファクタリングのため |
```

### 修正方法

Edit ツールを使用して、現在の1行（old_string: 行全体）を新しい2行（new_string: 改行を含む2行）に置換する。Edit ツールは改行文字を含む new_string を正しく処理できるため、行分割はこの方法で実現する。

### 修正根拠

`workflow-plugin/mcp-server/src/phases/definitions.ts` の762行目では test_impl フェーズの allowedBashCategories が `readonly, testing` のみに設定されており、`implementation` カテゴリは含まれていない。test_impl は TDD の Red フェーズであり、テストコードの作成のみを行う段階である。npm install や git add などの implementation カテゴリのコマンドを許可すべき理由がなく、現在のドキュメント記述は過剰な権限を示している。

implementation・refactoring フェーズは `readonly, testing, implementation` として設定されており、test_impl とは明確に異なる設定を持つ。同一行に異なるBashカテゴリのフェーズをまとめた結果、test_implに対する過剰な権限付与という記述誤りが生じており、TDDの検証スコープを超えた誤解を招く。1行を2行に分割し、修正件数は1箇所（修正番号FR-3）として管理する。

### 受入基準（AC-3 / AC-4）

- test_impl が独立した行として存在し、許可カテゴリが `readonly, testing` であること
- test_impl 行に `implementation` カテゴリが含まれていないこと
- implementation/refactoring 行が独立して存在し、`readonly, testing, implementation` を記載していること

---

## 実装手順の詳細

### ステップ1: FR-3 の実施（test_impl行の分割）

ルートCLAUDE.md に対して Edit ツールで test_impl 行を2行に分割する。

- file_path: `C:\ツール\Workflow\CLAUDE.md`
- old_string: `| test_impl, implementation, refactoring | readonly, testing, implementation | テスト・実装・ビルドのため |`
- new_string: `| test_impl | readonly, testing | テストコード先行作成のため（TDD Redフェーズ）|\n| implementation, refactoring | readonly, testing, implementation | 実装・ビルド・リファクタリングのため |`
- replace_all: false（test_impl行は1箇所のみのため不要）

Edit 完了後に Read ツールで対象範囲を読み込み、test_impl と implementation/refactoring が別行になっていることを目視確認する。

### ステップ2: FR-2 の実施（deploy行の修正）

ルートCLAUDE.md の deploy テーブル行を Edit ツールで許可カテゴリ `readonly` のみに絞る。

- file_path: `C:\ツール\Workflow\CLAUDE.md`
- old_string: `| deploy | readonly, implementation, deploy | デプロイ実行のため |`
- new_string: `| deploy | readonly | デプロイ確認のため読み取りのみ |`
- replace_all: false（deploy行はテーブル内で一意のため不要）

Edit 完了後に Read ツールで deploy 行を確認し、`implementation` および `deploy` カテゴリが除去されていることを検証する。

### ステップ3: FR-1 の実施（subagent_type値の修正）

workflow-plugin/CLAUDE.md の planning 行を Edit ツールで `general-purpose` に修正する。

- file_path: `C:\ツール\Workflow\workflow-plugin\CLAUDE.md`
- old_string: `Task({ prompt: '...planning...', subagent_type: 'Plan', model: 'sonnet', description: 'planning' })`
- new_string: `Task({ prompt: '...planning...', subagent_type: 'general-purpose', model: 'sonnet', description: 'planning' })`
- replace_all: false（コードブロック内の当該行は一意のため不要）

Edit 完了後に Read ツールでコードブロック全体を読み込み、`'Plan'` という文字列が消えて `general-purpose` に統一されたことを検証する。

### ステップ4: 最終検証

全修正完了後、以下の検証を実施する。

- ルートCLAUDE.md の対象テーブル全体を Read ツールで読み込み、FR-2・FR-3 の合格条件を目視確認する
- workflow-plugin/CLAUDE.md の対象コードブロック全体を Read ツールで読み込み、FR-1 の合格条件を目視確認する
- `workflow-plugin/mcp-server/src/phases/definitions.ts` の対応フィールド（subagentType、allowedBashCategories）の値とCLAUDE.md の記述が一致していることを確認する

---

## 変更対象ファイル一覧

| ファイル | 対象行 | 変更種別 | 要件ID |
|---------|--------|---------|--------|
| `C:\ツール\Workflow\CLAUDE.md` | 176行目 | 1行を2行に分割 | FR-3 |
| `C:\ツール\Workflow\CLAUDE.md` | 182行目（分割後は183行目） | 文字列置換 | FR-2 |
| `C:\ツール\Workflow\workflow-plugin\CLAUDE.md` | 330行目 | 文字列置換 | FR-1 |

変更はいずれも文字列の置換・分割のみであり、ファイル構造や周辺記述には影響を与えない。

---

## 非機能要件の実装対応

### 変更の最小性（NFR-1への対応）

Edit ツールの old_string に修正対象行全体を指定することで、意図しない箇所への置換を防ぐ。replace_all は使用せず、一意な文字列マッチングのみで変更を適用する。対象外のファイル（definitions.ts、bash-whitelist.js 等）は読み取り専用での参照にとどめる。

### definitions.tsとの整合性確認（NFR-2への対応）

最終検証ステップで、`workflow-plugin/mcp-server/src/phases/definitions.ts` の設定値とCLAUDE.md の記述を比較確認する。確認対象のフィールドは subagentType と allowedBashCategories であり、全フェーズ分の整合性を網羅的に検証する。

### 両CLAUDE.mdの相互整合性（NFR-3への対応）

FR-1の修正により、workflow-plugin/CLAUDE.md のplanningフェーズも `general-purpose` となり、ルートCLAUDE.md の記述と一致する。修正後に両ファイルの該当箇所を確認し、矛盾がないことを検証する。threat_modeling 行（既に `general-purpose`）との整合性も同時に確認する。

### コードおよび実装ファイルの不変性（NFR-5への対応）

本タスクでは `workflow-plugin/mcp-server/src/phases/definitions.ts`、bash-whitelist.js、その他のTypeScript・JavaScriptファイルは変更しない。変更対象はCLAUDE.mdドキュメントのみである。実装フェーズでは Edit/Write ツールを使用してドキュメントのみを操作し、コードファイルには触れない。

### 検証の客観性（NFR-4への対応）

合格条件（AC-1〜AC-4）は全て文字列の存在・不存在で判定可能な客観的基準として定義されている。Read ツールによる目視確認を自動化できない場合でも、grep 等の文字列検索で合否を判定できる形式にしている。
