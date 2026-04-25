## サマリー

本要件定義は、調査フェーズで発見されたNI-1（ci_verificationフェーズの許可カテゴリ不一致）を修正するための要件を記述する。

### 目的

CLAUDE.mdのフェーズ別Bashコマンド許可カテゴリテーブルにおいて、ci_verificationフェーズの記載が「readonly, testing」となっているが、実際の権威的ソース（definitions.ts）では「readonly」のみと定義されている。この乖離を解消し、ドキュメントと実装の整合性を回復する。

### 主要な決定事項

- 修正対象はCLAUDE.mdの1行のみ（ci_verification行）
- NI-2（subagent設定テーブルの欠落行）は今回のスコープ外とする
- definitions.tsは修正しない（権威的ソースとして正しい状態にある）
- 修正後のci_verification行の許可カテゴリは「readonly」のみとする

### 次フェーズで必要な情報

- 修正対象ファイル: `C:\ツール\Workflow\CLAUDE.md`
- 修正対象行の現在の内容: `| ci_verification | readonly, testing | CI結果確認のため |`
- 修正後の内容: `| ci_verification | readonly | CI結果確認のため |`
- definitions.tsの該当設定: `allowedBashCategories: ['readonly']`

---

## 背景と課題

### 問題の発端

前回のP0修正（commit d4404b7）において、CLAUDE.mdのdeployフェーズ行とtest_implフェーズ行の許可カテゴリが修正された。これらの修正は正しく適用されているが、同一テーブル内のci_verification行は修正対象から漏れていた。

### 現状の不整合

definitions.tsでは、ci_verificationフェーズのallowedBashCategoriesは以下のように定義されている。

```
ci_verification: { allowedBashCategories: ['readonly'] }
```

一方、CLAUDE.mdのテーブルには次のように記載されている。

```
| ci_verification | readonly, testing | CI結果確認のため |
```

この不一致により、Orchestratorがsubagentを起動する際に誤った権限情報（testingカテゴリが許可されているという誤情報）を伝達するリスクがある。実際のフック動作はdefinitions.tsに基づくためテストコマンドはブロックされるが、ドキュメントと実装の齟齬がsubagentの混乱を招く可能性がある。

### 影響範囲

今回の修正はCLAUDE.mdの1行のみを変更する。definitions.tsは正しい状態にあるため変更不要である。修正による他フェーズへの影響はない。

---

## 機能要件

### FR-4: ci_verificationフェーズの許可カテゴリ修正

**概要**
CLAUDE.mdのフェーズ別Bashコマンド許可カテゴリテーブルにおいて、ci_verificationフェーズの許可カテゴリを「readonly, testing」から「readonly」に変更する。

**修正対象**
- ファイル: `C:\ツール\Workflow\CLAUDE.md`
- 該当セクション: 「フェーズ別Bashコマンド許可カテゴリ」テーブル
- 対象行: ci_verificationフェーズの行

**修正前**
テーブルのci_verification行が次の形式になっている状態。
- 許可カテゴリ: `readonly, testing`
- 用途説明: `CI結果確認のため`

**修正後**
テーブルのci_verification行を次の形式に変更する。
- 許可カテゴリ: `readonly`
- 用途説明: `CI結果確認のため`（変更なし）

**根拠**
definitions.tsにおけるci_verificationフェーズの設定は`allowedBashCategories: ['readonly']`であり、CI検証フェーズではテスト実行コマンドを許可する必要がないことを反映している。

---

## 受入基準

### AC-1: ci_verification行の許可カテゴリが修正されている

CLAUDE.mdのci_verificationフェーズ行において、許可カテゴリ列に「readonly」のみが記載されており、「testing」が含まれていないこと。具体的には`| ci_verification | readonly |`の形式で記載されていること。

### AC-2: 用途説明が実態を反映した表現になっている

ci_verification行の用途説明列が「CI結果確認のため」等の適切な表現で維持されており、testingカテゴリの削除と矛盾しない内容であること。

### AC-3: 他の行に影響を与えていない

フェーズ別Bashコマンド許可カテゴリテーブルの他の全行（research、requirements、threat_modeling、planning、state_machine、flowchart、ui_design、design_review、test_design、test_impl、implementation、refactoring、build_check、code_review、testing、regression_test、manual_test、security_scan、performance_test、e2e_test、docs_update、commit、push、deploy）が変更前と同一の内容を維持していること。

### AC-4: definitions.tsとの完全一致

修正後のCLAUDE.md ci_verification行の許可カテゴリが、definitions.tsの`allowedBashCategories: ['readonly']`と完全に一致すること。両者のカテゴリの過不足がゼロであること。

---

## 非機能要件

### 保守性

修正はCLAUDE.mdの最小限の変更にとどめ、テーブル構造や他の行の形式を維持する。変更差分は1行のみとし、レビュー時の確認が容易な修正量とする。

### 追跡可能性

本修正はNI-1として識別されたdefinitions.tsとCLAUDE.mdの不整合を解消するものである。修正後はresearchフェーズで確認した全24行のうち全行がdefinitions.tsと一致する状態となる。

### 一貫性

修正後のCLAUDE.mdは、definitions.tsを権威的ソースとするフェーズ別設定の正確なドキュメントとして機能する。他のフェーズ行との表記形式（カテゴリ名の区切り文字、行の構造等）が一致していること。

### 再発防止への貢献

本修正により、前回修正（FR-2、FR-3）と同一の根本原因（definitions.tsとCLAUDE.mdの手動同期漏れ）に起因する不整合が1件解消される。今後、definitions.tsを変更する際はCLAUDE.mdの対応テーブル行も同時に更新する運用ルールの遵守が求められる。

---

## スコープ外事項

以下の事項は今回のスコープ外である。

- **NI-2（subagent設定テーブルの欠落行）**: ci_verificationとdeployの行がサブエージェント設定テーブルに含まれていない問題は、実害が限定的であるため今回は対応しない。
- **definitions.tsの変更**: definitions.tsは既に正しい状態にあるため変更不要。
- **自動同期機構の実装**: definitions.tsからCLAUDE.mdを自動生成する仕組みの構築は別タスクとして扱う。
- **workflow-plugin/CLAUDE.md**: 前回修正（FR-1）で確認済みの通り、こちらには許可カテゴリテーブルの重複記載がなく今回の修正対象外である。
