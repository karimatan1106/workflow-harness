## サマリー

本ドキュメントは、ワークフロープラグインの3つの修正案をドキュメント更新の観点から検証し、実装後の効果と後続タスクへの波及を記録する。
修正対象は、サブエージェントテンプレート・Mermaid記法ガイダンス・ワークフロー設定パターンの3領域にわたる。
本フェーズでは、修正内容の永続的なドキュメント化、バージョン管理への対応、および次フェーズ以降の検証計画を確立する。
評価スコープは、definitions.ts（MCP サーバーコアモジュール）、CLAUDE.md（プロジェクト向けガイダンス）、enforce-workflow.js（フック機構）の3ファイルである。
後続の test_design フェーズでは、修正ごとのユニットテストと手動検証シナリオの設計が必須となる。

## 修正内容の確認と変更対象ファイルの整理

### 修正1: サマリーテンプレートの項目追加（definitions.ts 行1251）

**修正前の現状:**
テンプレート文字列は以下の3項目を例示していた。
- 目的
- 主要な決定事項
- 次フェーズで必要な情報

3項目の各行をカウントすると実質行4行（説明行1 + 項目3）となり、バリデーター要件の minSectionLines=5 を下回る。

**修正内容:**
テンプレートを5項目構成に拡張する。
追加する2項目は以下のとおりである。

1. 「評価スコープ: 対象となるシステム・ファイル・機能の範囲」を「目的」の後に挿入
2. 「検証状況: テスト実施の有無と結果の概要」を「主要な決定事項」の後に挿入

修正後の項目構成は以下の順序となる。
- 目的
- 評価スコープ
- 主要な決定事項
- 検証状況
- 次フェーズで必要な情報

**効果:**
修正後の実質行数は説明行1 + 項目5 = 合計6行となり、minSectionLines=5 の要件を確実に満たす。
subagent が本テンプレートを忠実に再現する際、項目数だけで 5 行に達するため、テンプレート例示の不足による バリデーション失敗リスクが大幅に低減される。

**ファイル変更:**
- ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 変更行: 行1251 の importantSection += の右辺文字列リテラル
- 変更種別: 文字列修正（単一行内の複数行フィード記号編集）
- テランスパイル: `npm run build` 実行後に dist/phases/definitions.js に反映
- MCP サーバー再起動: 変更反映に必須（Node.js module cache のため）

### 修正2a: flowchart 記法制約の追記（definitions.ts 行1182の直後）

**修正前の現状:**
Mermaid 図に関するガイダンスセクションでは stateDiagram-v2 の制約（「名前付き状態（Start, End）を使うこと」）は明記されている。
しかし flowchart ノード記法の使い分け（丸括弧 vs 角括弧）に関する明示的なガイダンスは欠落している。

subagent が `NodeID["日本語テキスト"]` や `NodeID[テキスト]` の角括弧形式を使用する場合、
artifact-validator の角括弧プレースホルダー検出に誤検知されるリスクが存在する。
.mmd ファイルはコードフェンスに囲まれておらず、全行が extractNonCodeLines の検出対象となるため、
ノード定義行がそのまま検出される。

**修正内容:**
行1182の直後に以下の1行を追加する。

```
qualitySection += `- flowchartノードは NodeID(text) の丸括弧形式を使うこと。.mmdファイルは全行がバリデーター検出対象となるため NodeID[text] や NodeID["text"] の角括弧形式は角括弧プレースホルダーとして誤検出されるため禁止\n`;
```

制約の根拠:
- 丸括弧形式 `NodeID(text)` は Mermaid 仕様で角丸四角形（rounded box）としてレンダリングされ、視覚的に四角形と区別される。
- 角括弧形式 `NodeID[text]` は通常の四角形（rectangle）となり、丸括弧形式との視覚的分化は限定的である。
- ただし角括弧形式を避けることで、バリデーター側の角括弧プレースホルダー検出との衝突を完全に回避できる。
- artifact-validator.ts の isPlaceholder 関数の検出パターンは角括弧 `[...]` の形式であり、丸括弧形式は全く関係がない。

**ファイル変更:**
- ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 変更行: 行1182の直後（行1183に新規挿入）
- 変更種別: 行追加（1行の新規テンプレート文字列）
- テランスパイル: `npm run build` 実行後に dist/phases/definitions.js に反映
- MCP サーバー再起動: 変更反映に必須

### 修正2b: CLAUDE.md の flowchart 例示変更

**修正前の現状:**
プロジェクトルート `CLAUDE.md` の「図式設計（Mermaid形式で記述）」セクションに、
flowchart の例示コードが以下の形式で記載されている。

```
flowchart TD
    A[開始] --> B{条件判定}
    B -->|Yes| C[処理A]
    B -->|No| D[処理B]
    C --> E[終了]
    D --> E
```

角括弧形式 `A[開始]` が使用されており、修正2aのガイダンスと矛盾する。

**修正内容:**
flowchart 例示の全ノード定義を丸括弧形式に変更する。

```
flowchart TD
    A(開始) --> B{条件判定}
    B -->|Yes| C(処理A)
    B -->|No| D(処理B)
    C --> E(終了)
    D --> E
```

変更対象行:
- `A[開始]` → `A(開始)`
- `C[処理A]` → `C(処理A)`
- `D[処理B]` → `D(処理B)`
- `E[終了]` → `E(終了)`

菱形ノード（ダイヤモンド）`B{条件判定}` は角括弧形式ではないため変更不要。

**ファイル変更:**
- ファイル: `C:\ツール\Workflow\CLAUDE.md` (プロジェクトルート)
- 変更セクション: 「図式設計（Mermaid形式で記述）」の「フローチャート」見出し下
- 変更種別: 例示コード内の4ノード定義の置換
- ビルド不要: Markdown ファイルであり、テランスパイル対象ではない
- MCP サーバー再起動不要: ドキュメント変更

### 修正2c: workflow-plugin/CLAUDE.md の flowchart 例示変更

**修正前の現状:**
ワークフロープラグインの CLAUDE.md（`workflow-plugin/CLAUDE.md`）にも flowchart の例示コードが含まれている可能性がある。
プロジェクト内複数箇所に同一のドキュメントが存在する場合、ガイダンスの一貫性を保つため、
すべての CLAUDE.md ファイルの例示を修正する必要がある。

**修正内容:**
`workflow-plugin/CLAUDE.md` の「図式設計」セクションにある flowchart 例示についても、
修正2bと同一の変更を適用する。

- ファイル: `workflow-plugin/CLAUDE.md`
- 変更セクション: 「図式設計（Mermaid形式で記述）」
- 変更種別: 例示コード内のノード定義置換
- ビルド不要
- MCP サーバー再起動不要

**一貫性確保:**
プロジェクトルート と workflow-plugin の両 CLAUDE.md に同一の例示が存在する場合、
両方を同一タイミングで更新することで、ドキュメント一貫性を確保する。

### 修正3: enforce-workflow.js の WORKFLOW_CONFIG_PATTERNS 拡張

**修正前の現状:**
enforce-workflow.js（行219〜224）の WORKFLOW_CONFIG_PATTERNS 配列は、現在4パターンで構成されている。

```javascript
const WORKFLOW_CONFIG_PATTERNS = [
  /\.claude[\/\\]state[\/\\]workflows[\/\\]/i,
  /\.claude[\/\\]state[\/\\]*/i,
  /\.claude[\/\\]settings\.json$/i,
  /\.claude[\/\\]projects[\/\\][^\/\\]+[\/\\]\.claudeignore$/i,
];
```

これら4パターンは主に `.claude/state/` 下の ワークフロー状態ファイルと `.claude/projects/` 下の設定ファイルをカバーしている。
しかし `memory/` ディレクトリ（`.claude/projects/{projectName}/memory/`）へのアクセスを許可するパターンが欠落しており、
タスク未開始状態で MEMORY.md への Write/Edit 操作が hook によってブロックされる。

**修正内容:**
WORKFLOW_CONFIG_PATTERNS 配列に新たなパターンを追加する。

追加するパターン（5番目の要素）:
```javascript
/\.claude[\/\\]projects[\/\\][^\/\\]+[\/\\]memory[\/\\]/i,
```

このパターンの意味:
- `\.claude` — .claude ディレクトリの開始（エスケープ済み）
- `[\/\\]` — スラッシュまたはバックスラッシュ（Windows / Unix 両対応）
- `projects` — projects サブディレクトリ
- `[\/\\][^\/\\]+[\/\\]` — 任意のプロジェクト名を含むディレクトリ階層
- `memory[\/\\]` — memory ディレクトリの開始
- `/i` — 大文字小文字を区別しない

**対象パス例:**
- `C:\Users\owner\.claude\projects\MyProject\memory\MEMORY.md`
- `/home/user/.claude/projects/MyProject/memory/MEMORY.md`

**ファイル変更:**
- ファイル: `workflow-plugin/hooks/enforce-workflow.js`
- 変更行: 行219〜224 の WORKFLOW_CONFIG_PATTERNS 配列末尾
- 変更種別: 配列要素の1件追加
- ビルド不要: JavaScript ファイルであり、直接実行対象
- MCP サーバー再起動不要: Claude Desktop のfork/exec による読み込み

**フック処理フロー上の位置確認:**
enforce-workflow.js の処理フロー:
- 行329: `isWorkflowConfigFile(filePath)` チェック
- 行364: ゼロタスクブロック（「有効なタスクが存在しない」チェック）

isWorkflowConfigFile チェックがゼロタスクブロックより前に実行されるため、
memory/ パターンを WORKFLOW_CONFIG_PATTERNS に追加するだけで、
タスク未開始状態でも MEMORY.md へのアクセスが許可される。

## 変更対象ファイル一覧と優先順位

### コード変更ファイル（テランスパイル・MCP 再起動が必要）

**1. workflow-plugin/mcp-server/src/phases/definitions.ts**
- 修正1: 行1251 の サマリーテンプレート文字列修正（3項目 → 5項目）
- 修正2a: 行1182の直後に flowchart 記法制約の1行を追加
- 変更規模: 計2箇所、2行分の修正
- テランスパイル: `cd workflow-plugin/mcp-server && npm run build`
- 成果物: `workflow-plugin/mcp-server/dist/phases/definitions.js`（自動生成）
- MCP サーバー再起動: 必須（Node.js module cache 回避）
- 検証: コードレビューフェーズで修正内容を確認

### JavaScript ファイル変更（再起動不要）

**2. workflow-plugin/hooks/enforce-workflow.js**
- 修正3: 行219〜224 の WORKFLOW_CONFIG_PATTERNS 配列に memory/ パターンを追加
- 変更規模: 1行の追加
- ビルド不要: JavaScript 直実行
- Claude Desktop による読み込み: 即座に反映（hook invocation 時）
- 検証: 手動テストフェーズで MEMORY.md Write が許可されることを確認

### ドキュメント変更ファイル（ガイダンス更新）

**3. C:\ツール\Workflow\CLAUDE.md（プロジェクトルート）**
- 修正2b: 「図式設計」セクションの flowchart 例示を丸括弧形式に変更
- 変更規模: flowchart ブロック内の4ノード定義置換
- ビルド不要: Markdown ファイル
- 効果: プロジェクト向けドキュメント刷新

**4. workflow-plugin/CLAUDE.md**
- 修正2c: 「図式設計」セクションの flowchart 例示を丸括弧形式に変更
- 変更規模: flowchart ブロック内の複数ノード定義置換
- ビルド不要: Markdown ファイル
- 効果: ワークフロープラグイン向けドキュメント刷新

## 修正による効果の検証ポイント

### 修正1 の効果検証（サマリーテンプレート項目追加）

**検証項目:**
- artifact-validator の minSectionLines エラーが削減される
- subagent が新しい5項目テンプレートに従って、自然に 5行以上のサマリーを生成できる
- 既存フェーズ（research, requirements 等）のサマリー生成品質が向上する

**検証方法:**
- test_impl フェーズで unit test を作成
- テスト内容: 新しいテンプレートから自動生成されるサマリーセクションが minSectionLines=5 を満たすことを確認
- 手動テスト: 複数フェーズで実際のワークフロー実行を試みて、バリデーション失敗が減少することを確認

### 修正2a, 2b, 2c の効果検証（flowchart 記法ガイダンス）

**検証項目:**
- subagent が丸括弧形式を優先的に使用するようになる
- flowchart ノード記法に関する角括弧プレースホルダー誤検知が発生しなくなる
- CLAUDE.md のガイダンスが definitions.ts のテンプレートと一貫性を持つ

**検証方法:**
- code_review フェーズで、生成された flowchart .mmd ファイルのノード定義を確認
- 角括弧形式が使用されていないことを確認
- artifact-validator での角括弧検出エラーが発生しないことを確認

### 修正3 の効果検証（MEMORY.md アクセス許可）

**検証項目:**
- タスク未開始状態で MEMORY.md への Write/Edit が hook によってブロックされない
- enforce-workflow.js が isWorkflowConfigFile チェックで正しく memory/ パターンを認識する
- memory/ 配下のファイル全般がアクセス可能である

**検証方法:**
- 手動テスト: タスクを completed に変更し、ゼロタスク状態を作成
- MEMORY.md に対して Write/Edit を実行
- hook エラーが発生しないことを確認（期待値: 成功）

## バージョン管理と Git 整合性

### コミット対象ファイルの分類

**Commit フェーズで必須 commit**:
1. `workflow-plugin/mcp-server/src/phases/definitions.ts` — コアモジュール
2. `workflow-plugin/hooks/enforce-workflow.js` — フック機構
3. `CLAUDE.md` (プロジェクトルート) — ドキュメント
4. `workflow-plugin/CLAUDE.md` — ドキュメント

**Commit メッセージの指針:**
修正ごとにスコープ（修正番号）を明記し、变更の意図を端的に記述する。

例:
```
fix: サマリーテンプレート項目追加（修正1: 5項目構成への拡張）

- definitions.ts 行1251 のテンプレートを3項目から5項目に拡張
- 「評価スコープ」「検証状況」の2項目を追加
- artifact-validator の minSectionLines=5 要件を確実に満たすため

関連: subagentテンプレート-サマリ行数不足とflowchart記法制約の修正
```

### dist/ ファイルの扱い

`workflow-plugin/mcp-server/dist/` は npm run build により自動生成されるため、
通常は .gitignore に登録されている。
本修正では dist/*.js ファイルへの直接的な変更はなく、
src/phases/definitions.ts の修正後に自動生成される成果物となるため、
commit 対象外とする。

ただし dist/*.js が Git に登録されている場合は、
build 後に dist/phases/definitions.js を commit 対象に含めることを検討すること。

## 後続フェーズへの依存関係と注意事項

### test_design フェーズ（次フェーズ）での設計項目

修正ごとの検証方針をテスト設計フェーズで記述する。

**修正1 向けテスト:**
- ユニットテスト: importantSection テンプレート生成のテスト
- シナリオ: 新テンプレートに従うサマリーセクションが minSectionLines を満たすことを確認

**修正2 向けテスト:**
- ユニットテスト: qualitySection テンプレート生成のテスト
- シナリオ: flowchart 記法ガイダンスが テンプレートに含まれることを確認
- ドキュメント検証: CLAUDE.md の例示が修正されていることを確認

**修正3 向けテスト:**
- 手動テスト: WORKFLOW_CONFIG_PATTERNS パターンマッチングの確認
- シナリオ: ゼロタスク状態で MEMORY.md アクセスが許可されることを確認

### test_impl フェーズでのテストコード配置

テストコードは以下の位置に配置する。
- `workflow-plugin/mcp-server/src/phases/__tests__/definitions.test.ts` — definitions.ts ユニットテスト
- `workflow-plugin/hooks/__tests__/enforce-workflow.test.js` — enforce-workflow.js ユニットテスト
- 手動テスト記録は `{docsDir}/manual-test.md`

### implementation フェーズでの確認事項

修正1・2 については既にコード变更が確定しているため、
implementation フェーズではテストコードの実装に集中する。

修正3 については JavaScript ファイル変更であり、
テストコード実装後に enforce-workflow.js の正確性を確認する。

### regression_test フェーズでの注意

修正1・2 の effects は全フェーズに波及するため、
回帰テスト実行時には既存の成果物（research.md, spec.md 等）に対して
新しいバリデーション基準が適用されることに留意する。

ただし修正内容がテンプレート拡張と記法ガイダンス追加であるため、
既存成果物のバリデーション失敗率が増加することは想定されない。
むしろ不足していた実質行を自然に埋められるようになるため、
バリデーション成功率は向上する可能性が高い。

## ドキュメント更新の完了条件

### 本フェーズで実施した記録

本ドキュメント（docs-update.md）では、以下の内容を網羅した。
- 修正1: テンプレート拡張の詳細（ファイルパス・変更行・実質内容）
- 修正2a, 2b, 2c: flowchart 記法ガイダンスの一貫性確保
- 修正3: hook パターン追加の技術背景とフロー解析
- 後続フェーズでの検証方法と注意事項
- バージョン管理とコミット方針

### 次フェーズの commit 前確認事項

次フェーズで push 前に以下を確認することを推奨する。
- [ ] definitions.ts の修正が npm run build で dist/*.js に反映されているか
- [ ] MCP サーバー再起動後に新しいテンプレートが subagent に供給されているか
- [ ] CLAUDE.md 2ファイルの flowchart 例示が丸括弧形式に統一されているか
- [ ] enforce-workflow.js の memory/ パターンが WORKFLOW_CONFIG_PATTERNS に追加されているか
- [ ] テストコード（unit test + 手動テスト）が期待値を検証できるか

## まとめ

3つの修正案は、ワークフロープラグインの安定性とユーザビリティを向上させるための必須修正である。
修正1・2 は subagent が生成する成果物の品質基準を満たすようにテンプレートとガイダンスを改善し、
修正3 は memory/ ディレクトリへのアクセスを許可することで、ユーザーが過度な制限なく作業メモを更新できるようにする。

修正後のワークフロー実行では、バリデーション失敗率の低下、ドキュメント一貫性の向上、
およびユーザー作業の利便性向上が期待される。
test_design・test_impl フェーズでの検証により、修正効果を数値化できる。
