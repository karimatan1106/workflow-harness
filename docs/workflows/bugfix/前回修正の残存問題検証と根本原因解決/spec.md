## サマリー

本仕様書は、調査フェーズで発見されたNI-1（ci_verificationフェーズの許可カテゴリ不一致）を解消するため、
FR-4（CLAUDE.mdのci_verificationフェーズ行における許可カテゴリ修正）の実装仕様を定義する。
本要件定義を踏まえ、ドキュメントと実装の整合性を回復するための最小変更を実施する。

### 目的

CLAUDE.mdのフェーズ別Bashコマンド許可カテゴリテーブルにおいて、ci_verificationフェーズの記載が
「readonly, testing」となっているが、権威的ソースであるdefinitions.tsでは「readonly」のみと定義
されており、この乖離が問題となっている。現状の不整合を解消し、修正対象行の記載内容を
権威的ソースと一致させることで、サブエージェントへの誤情報伝達を防ぐ。

### 主要な決定事項

- 今回のスコープは CLAUDE.md の1行のみに限定する（最小変更原則）
- definitions.ts はすでに正しい状態にあるため変更不要とする
- 修正後のci_verification行の許可カテゴリは「readonly」のみとする
- 用途説明は「CI結果確認のため読み取りのみ」に更新し、readonlyのみであることを明示する

### 次フェーズで必要な情報

- 修正対象ファイル: `C:\ツール\Workflow\CLAUDE.md`（181行目付近）
- 修正前の内容: `| ci_verification | readonly, testing | CI結果確認のため |`
- 修正後の内容: `| ci_verification | readonly | CI結果確認のため読み取りのみ |`
- 検証方法: Read ツールで181行目付近を読み込み、修正内容を目視確認する

---

## 概要

本タスクは「前回修正の残存問題検証と根本原因解決」として位置付けられる単一行修正である。
調査フェーズで発見された課題として、CLAUDE.mdのフェーズ別Bashコマンド許可カテゴリテーブル内の
ci_verification行に「testing」が誤って含まれており、これが権威的ソースであるdefinitions.tsとの
齟齬を生じさせていることが確認された。

問題の発端は前回のP0修正（commit d4404b7）にある。このコミットではdeployフェーズ行と
test_implフェーズ行が修正済みであったが、ci_verification行が見落とされた。
その結果、現状においても「readonly, testing」という誤った許可カテゴリが残存しており、
本仕様書はその残存問題（NI-1）を解決する要件に適用される実装仕様を記述する。

定義ファイルであるworkflow-plugin/mcp-server/src/phases/definitions.tsでは、ci_verificationの
allowedBashCategories はreadonlyのみを含む単一要素の配列として定義されており、
CLAUDE.mdのテーブル記載と一致していなかった。修正によりドキュメントと実装の完全な整合性を回復する。

この修正はランタイムの動作変更を一切伴わないドキュメント整合性の修正である。
フックシステムの実際の動作はdefinitions.tsに基づくため既に正しく機能しているが、
Orchestratorがサブエージェントを起動する際に伝達する権限情報に誤情報が含まれる可能性があり、
サブエージェントの混乱を防ぐことが主な目的である。

---

## 変更対象ファイル

### 主変更ファイル

以下のファイルが本タスクの直接的な変更対象である。今回の修正量は最小限であり、
変更差分は1行のみとすることでレビュー時の確認が容易な状態を維持する。

- `C:\ツール\Workflow\CLAUDE.md` — フェーズ別Bashコマンド許可カテゴリテーブルの1行を修正する

### 参照ファイル（変更なし）

以下のファイルは変更せず、参照・検証目的のみで使用する。

- `workflow-plugin/mcp-server/src/phases/definitions.ts` — ci_verificationフェーズのallowedBashCategories 該当設定を確認する
- `workflow-plugin/mcp-server/src/index.ts` — MCPサーバーのフェーズ管理ロジックを確認する（必要時のみ）

### 変更内容の詳細

CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」テーブル内のci_verification行を以下のとおり修正する。

修正前の記載（修正対象行）: `| ci_verification | readonly, testing | CI結果確認のため |`

修正後の記載（修正後のci_verification行）: `| ci_verification | readonly | CI結果確認のため読み取りのみ |`

---

## 機能要件

### FR-4: ci_verificationフェーズの許可カテゴリ修正

本機能要件は本要件定義のコアとなる変更であり、CLAUDE.mdの許可カテゴリテーブルにおける
ci_verificationフェーズの記載を権威的ソースと一致させることを目的とする。

**修正対象**

- ファイル: `C:\ツール\Workflow\CLAUDE.md`
- 該当セクション: 「フェーズ別Bashコマンド許可カテゴリ」テーブル
- 対象行: ci_verificationフェーズの行（tesingカテゴリを削除する）

**根拠**

definitions.tsにおける該当設定は`allowedBashCategories: ['readonly']`であり、CI検証フェーズでは
テストコマンド（npm test等）を許可する必要がないことを反映している。ローカルでのテスト実行は
testingフェーズやregression_testフェーズの役割であり、ci_verificationフェーズでは
CI結果をログや外部サービスから読み取るだけであるため、readonlyカテゴリのみで十分である。

現状の矛盾はsubagentへの権限情報伝達に影響する可能性があり、解消が必要である。

---

## 非機能要件

### 保守性

修正はCLAUDE.mdの最小限の変更にとどめ、テーブル構造や他の行の形式を維持する。
今回の変更差分は1行のみとし、レビュー時の確認が容易な修正量とすることで、
誤操作のリスクを最小化しながら保守性を確保する。

### 追跡可能性

本修正はNI-1として識別されたdefinitions.tsとCLAUDE.mdの不整合を解消するものである。
修正後はresearchフェーズの調査で確認した全24行のうち全行がdefinitions.tsと一致する状態となり、
各修正の根拠がすべて追跡可能な形で記録されている。

### 一貫性

修正後のCLAUDE.mdは、definitions.tsを権威的ソースとするフェーズ別設定の正確なドキュメントとして
機能する。他のフェーズ行との表記形式（カテゴリ名の区切り文字、行の構造等）が一致しており、
テーブル全体の一貫性が保たれること。

### 再発防止への貢献

本修正により、前回修正（FR-2、FR-3）と同一の根本原因である手動同期漏れに起因する不整合が
1件解消される。今後、definitions.tsを変更する際はCLAUDE.mdの対応テーブル行も同時に更新する
運用ルールの遵守が求められる。自動同期機構や自動生成の仕組みの構築は別タスクとして扱う。

---

## 実装計画

### ステップ1: 対象行の特定

Read ツールでCLAUDE.mdの170行目から190行目を読み込み、ci_verification行の正確な内容と
前後のコンテキストを把握する。対象行が181行目付近に存在することを確認し、
テーブル構造（3カラム構成のパイプ区切り形式）が正常であることを確認する。
この調査ステップで現状の不整合を直接目視検証してから実施に移る。

### ステップ2: 文字列置換の実行

Edit ツールで以下の文字列置換を実行する。

置換前の文字列（old_string）:
```
| ci_verification | readonly, testing | CI結果確認のため |
```

置換後の文字列（new_string）:
```
| ci_verification | readonly | CI結果確認のため読み取りのみ |
```

この置換は対象ファイル内で1箇所のみ一致する一意な文字列であるため、
replace_allを使用せず単一置換で実行し、他行への影響を防ぐ。

### ステップ3: 修正結果の検証

Read ツールで修正後の対象行付近を読み込み、以下の4点を確認する。

- ci_verification行の許可カテゴリが「readonly」のみになっていること（testingの削除を確認）
- 用途説明が「CI結果確認のため読み取りのみ」になっていること
- 前後の行（security_scan行、commit行等）が変更されていないこと
- テーブル構造（カラム区切りのパイプ）が崩れていないこと

### ステップ4: definitions.tsとの一致確認

Read ツールでdefinitions.tsのci_verificationエントリを読み込み、
allowedBashCategoriesがreadonlyカテゴリのみの単一要素配列であることと、
CLAUDE.mdの修正後の記載が一致していることを確認する。

---

## 変更対象の詳細

### 対象ファイルとセクション

修正対象はCLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクション内のテーブル行である。
このテーブルはOrchestratorがサブエージェントを起動する際に許可カテゴリを伝達するための
リファレンスとして機能している。テーブルは「| フェーズ | 許可カテゴリ | 用途 |」の3カラム構成となっており、
全24行が各フェーズの設定を記述している。

修正対象行は以下の現在の内容を持つ。

```
| ci_verification | readonly, testing | CI結果確認のため |
```

この行は181行目付近（`| security_scan, performance_test, e2e_test |`行の直後）に存在する。

### 権威的ソースとの不一致

definitions.tsのci_verificationエントリは以下のように定義されている。

```typescript
ci_verification: {
  phaseName: 'ci_verification',
  description: 'CI検証フェーズ',
  allowedBashCategories: ['readonly'],
}
```

一方、CLAUDE.mdのテーブルには「readonly, testing」と記載されており、
これがフックシステムの実際の動作とドキュメントの齟齬となっている。
このドキュメントが誤った権限情報をOrchestratorやサブエージェントに伝える可能性があるため、
今回の修正で解消する。実際のフック動作はdefinitions.tsに基づくためテストコマンドはブロックされるが、
誤情報による混乱を防ぐことが目的である。

---

## 受入基準

### AC-1: ci_verification行の許可カテゴリが修正されている

CLAUDE.mdのci_verificationフェーズ行において、許可カテゴリ列に「readonly」のみが記載されており、
「testing」が含まれていない。具体的には`| ci_verification | readonly |`の形式で記載されている。
この確認はRead ツールによる目視検証によって実施する。

### AC-2: 用途説明が実態を反映した適切な表現になっている

ci_verification行の用途説明列が「CI結果確認のため読み取りのみ」と記載されており、
readonlyカテゴリのみが許可されていることと整合する内容になっている。
旧テキスト「CI結果確認のため」は「CI結果確認のため読み取りのみ」に置き換えられており、
削除されたtestingカテゴリと矛盾しない適切な表現となっていること。

### AC-3: 他の行に影響を与えていない

フェーズ別Bashコマンド許可カテゴリテーブルの他の全行が変更前と同一の内容を維持している。
特に、ci_verification行の直前行である`| security_scan, performance_test, e2e_test |`と
直後行である`| commit, push |`が変更されていないことを確認する。
Edit ツールの単一置換（replace_all: false）を使用することで他行への誤影響を防止できる。

### AC-4: definitions.tsとの完全一致

修正後のCLAUDE.md ci_verification行の許可カテゴリ「readonly」が、
definitions.tsのallowedBashCategoriesと完全に一致している。
両者ともreadonlyカテゴリ1件のみを含み、カテゴリの過不足がゼロであり、
testingカテゴリの過剰付与が解消されていること。

---

## 技術的背景

### なぜtestingカテゴリが誤って追加されていたか

ci_verificationフェーズはCI/CDパイプラインの結果を「確認する」フェーズであり、
ローカルでテストコマンドを実行する必要がない。npm test等のテストコマンドを実行するのは
testingフェーズやregression_testフェーズの役割である。
ci_verificationフェーズではCI結果をログや外部サービスから読み取るだけであるため、
readonlyカテゴリのみで十分である。

前回修正（commit d4404b7）ではdeploy行とtest_impl行が修正されたが、
ci_verification行は見落とされた。この見落としがNI-1として識別された残存問題であり、
本タスクで対応することになった。

### テーブルの表記形式規約

CLAUDE.mdの許可カテゴリテーブルでは、複数カテゴリはカンマ+スペースで区切られる。
修正後のci_verification行はカテゴリが1件のみであるため区切りは不要である。
用途説明列の末尾パイプとスペースの表記形式は他行と統一する。
テーブル構造等（行の構造、カラム区切りの形式）について他行との一貫性を維持すること。

### workflow-plugin/mcp-server/src/phases/definitions.ts の役割

definitions.tsはフェーズごとの別設定を一元管理するTypeScriptファイルであり、
allowedBashCategoriesプロパティが各フェーズで使用可能なBashコマンドカテゴリを規定する。
このファイルがフックシステムの実際の動作制御に使用されるため、権威的ソースとして扱われる。
CLAUDE.mdはその内容をドキュメントとして反映するものであり、両者の整合性維持が重要である。

---

## 変更影響分析

### 影響範囲と直接的な影響

今回の修正影響範囲はCLAUDE.mdの1行のみである。この変更により、
Orchestratorがci_verificationフェーズのサブエージェントを起動する際に伝達する
「許可Bashコマンドカテゴリ」情報が正確になる。
サブエージェントはtestingカテゴリが禁止されていることを正しく認識して動作するため、
不必要なテストコマンド試行とそれに伴うフックエラーを防止できる。

### 間接的な影響

definitions.tsは変更されないため、フックシステムの実際の動作は変化しない。
テストファイルやその他のソースコードも変更されない。
本修正は純粋なドキュメント整合性の修正であり、ランタイムの動作変更を伴わない。

### リスク評価

変更行数が1行のみであるため、誤操作のリスクは最小限である。
Edit ツールの文字列置換はexact matchを要求するため、意図しない行が変更されるリスクはない。
修正後の検証手順（ステップ3・4）により、変更の正確性を確認できる。

---

## スコープ外事項

以下の事項は今回のスコープ外とする。実害が限定的な項目や別タスクで扱う項目はここに分類する。

- **NI-2（サブエージェント設定テーブルの欠落行）**: ci_verificationとdeployの行がサブエージェント設定テーブルに含まれていない問題は、実害が限定的であるため今回は対応しない。
- **definitions.tsの変更**: definitions.tsは既に正しい状態にあるため変更不要であり、修正対象外とする。
- **自動同期機構の実装**: definitions.tsからCLAUDE.mdを自動生成する仕組みの構築は別タスクとして扱う。
- **workflow-plugin/CLAUDE.md**: 前回修正（FR-1）で確認済みの通り、こちらには許可カテゴリテーブルの重複記載がなく今回の修正対象外である。
