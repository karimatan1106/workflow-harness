# ワークフロー実行時バグ修正 - 実装仕様書

## サマリー

本ドキュメントは、ワークフロー実行時に発見された4つのバグを修正するための詳細実装仕様です。
要件定義（requirements.md）で明確化された修正要件と受入基準に基づき、各修正対象ファイルへの具体的な変更内容を規定します。

- 目的: research/requirementsフェーズで特定された根本原因に基づき、最小限の変更で各バグを安全に修正する
- 主要な決定事項: FQ-1はtestingフェーズのハッシュチェックをスキップする条件を追加、FQ-2はhasRedirection関数の正規表現を修正して比較演算子の誤検出を排除、FQ-3はcommit/pushのallowedBashCategoriesを'git'に変更、FQ-4はpushのsubagentTemplateにブランチ確認手順を追加
- 次フェーズで必要な情報: 修正対象は4箇所（3ファイル）、各行番号の詳細は本文参照のこと。definitions.tsを変更した後はMCPサーバーの再起動が必須。

修正優先度はFQ-1が最高（毎回のtestingフェーズ遷移をブロックする致命的な問題）、次いでFQ-3（subagentへの誤情報伝達）、FQ-4（ブランチ名誤指定）、FQ-2（比較演算子の誤検出）の順です。

---

## 概要

### 背景とプロジェクトの位置づけ

本プロジェクトはワークフロープラグイン（`workflow-plugin/`）のランタイム動作を改善するバグ修正タスクです。
ワークフロープラグインはClaude CodeのAIエージェントがタスクを段階的に実行するための基盤を提供します。
発見されたバグはいずれもワークフロー実行中にフェーズ遷移や外部コマンド制御が正しく機能しない問題であり、
日常的なワークフロー運用に直接影響を与える問題です。

requirements.mdの要件定義から引用すると、修正要件の明確化にあたって以下の4つの問題が特定されました。
各バグの再現条件は調査フェーズで詳細に記録されており、本仕様書はその内容を実装レベルで具体化したものです。

### 修正対象の4バグの要約

バグ1（FQ-1）は `next.ts` のtestingフェーズにおけるテスト出力ハッシュの自己参照的な重複検出です。
この問題により `workflow_record_test_result` を呼んだ直後に `workflow_next` を呼ぶとフェーズブロックが発生します。
バグ2（FQ-2）は `bash-whitelist.js` の `hasRedirection` 関数が `>=` 演算子を誤ってリダイレクトと判定する問題で、
比較演算子を含むシェルコマンドが不当に制限されるケースがあります。
バグ3（FQ-3）は `definitions.ts` のcommit/pushフェーズで `allowedBashCategories` が誤った値を持つ問題です。
バグ4（FQ-4）はpushフェーズのsubagentTemplateにブランチ確認手順が含まれていない問題です。

### 修正方針の基本原則

既存の動作を壊さない最小限の変更に留め、各バグの根本原因のみを修正します。
後方互換性を維持しながら、ドキュメント・フック・フェーズ定義の三者の整合性が保たれることを確認します。
コアモジュール（next.ts、definitions.ts）を変更した後はMCPサーバーの再起動が必要です。

---

## 実装計画

### 修正の実施順序

各修正対象ファイルへの変更は、FQ-1、FQ-2、FQ-3、FQ-4の順で実施することを推奨します。
この順序の根拠は以下の通りです。
FQ-1は毎回のtestingフェーズ遷移をブロックするため最も影響が大きく、最優先で修正します。
FQ-3はsubagentへ誤情報を送信する問題であり、FQ-4と同一ファイルを修正するため連続して対応します。
FQ-4はFQ-3と同じ `definitions.ts` への変更であるため、同じビルドセッション内で実施すると効率的です。
FQ-2はフック側の `bash-whitelist.js` への変更で、MCPサーバーとは独立して修正できます。

### 依存関係と制約

FQ-1の修正（next.ts）とFQ-3/FQ-4の修正（definitions.ts）は、どちらも `npm run build` とMCPサーバー再起動が必要です。
次回のビルドコストを最小化するため、FQ-3とFQ-4を同一セッション内で連続して修正することを推奨します。
その後一度だけビルドとMCPサーバー再起動を実施することで、2回分の再起動コストを1回に圧縮できます。
FQ-2（bash-whitelist.js）の変更はフック側への変更であり、セッション再起動で反映されます。

### 実装後の確認項目

FQ-1修正後: testingフェーズで `workflow_record_test_result` を呼んだ後に `workflow_next` が成功することを確認します。
FQ-3修正後: definitions.tsのcommit/pushフェーズの `allowedBashCategories` が `['readonly', 'git']` であることを確認します。
FQ-4修正後: subagentへ送信されるpushフェーズのプロンプトにブランチ確認コマンドが含まれることを確認します。
FQ-2修正後: `>=` を含むコマンドがリダイレクト誤検出でブロックされないことを手動テストで確認します。

---

## FQ-1: testingフェーズのハッシュチェックスキップ

### 問題の背景と再現条件

`next.ts` の `testing` フェーズ検証ブロック（line 267-276）には、テスト出力のハッシュ重複チェックが実装されています。
このチェックは、subagentがテストを実行せずに過去のテスト出力をコピーして報告する行為を防ぐセキュリティ機能です。
問題の再現条件は「testingフェーズで `workflow_record_test_result` を呼び、その直後に `workflow_next` を呼ぶ」操作です。
この操作を行うと `record_test_result` がハッシュを `testOutputHashes` 配列に追加した直後に
`workflow_next` が同じ配列を参照してハッシュ重複ロジックを実行します。
記録したばかりのハッシュを自己参照で比較するため「以前と同一のテスト出力」と誤判定されフェーズブロックが生じます。

`regression_test` フェーズでは既に同じ問題が認識されており、スキップロジックとして
ハッシュチェックブロック全体が除外される条件が実装済みです。
testingフェーズに対しても同様の条件追加を行うことで解決できます。

### 変更対象ファイルと箇所

各修正対象となるファイルのパス: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts`

変更前（line 267-275）のハッシュ重複チェック処理は条件分岐なしに常時実行されています。

```typescript
// ハッシュ重複チェック
const existingHashes = taskState.testOutputHashes || [];
const hashResult = recordTestOutputHash(testResult.output, existingHashes);
if (!hashResult.valid && testStrict) {
  return {
    success: false,
    message: `テスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。`,
  };
}
```

変更後（testingフェーズもスキップ対象に追加）は以下の通りです。

```typescript
// ハッシュ重複チェック（testingフェーズとregression_testフェーズはスキップ）
// 理由: record_test_result直後にnextを呼ぶと自己参照的な重複検出が発生するため
if (currentPhase !== 'regression_test' && currentPhase !== 'testing') {
  const existingHashes = taskState.testOutputHashes || [];
  const hashResult = recordTestOutputHash(testResult.output, existingHashes);
  if (!hashResult.valid && testStrict) {
    return {
      success: false,
      message: `テスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。`,
    };
  }
}
```

### 受入基準と影響範囲の確認

requirements.mdで定義された受入基準に対応するため、以下の動作を確認します。
testingフェーズで1回 `record_test_result` を呼んだ後、`workflow_next` が成功することが必須です。
regression_testフェーズには既存のスキップロジックが引き続き適用されることを確認します。
他のフェーズでのハッシュ重複検出ロジックが変更されていないことを確認します。

testingフェーズのハッシュチェックをスキップしても、以下の保護機能は引き続き動作します。
test-authenticityバリデーション（line 251-265）は変更されず、タイムスタンプベースの真正性検証が継続します。
ハッシュの記録処理（`record_test_result.ts`）は変更されないため、regression_testフェーズ以降での重複検出に影響しません。
testingフェーズとregression_testフェーズ以外のフェーズでのハッシュ重複チェックは、条件分岐内にあるため影響を受けません。

手動検証手順: testingフェーズに進んだ後、実際のテスト結果を `record_test_result` で記録し、直後に `workflow_next` を呼び出して成功することを確認してください。

---

## FQ-2: hasRedirection関数の比較演算子誤検出修正

### 問題の背景と再現条件

`bash-whitelist.js` の `hasRedirection` 関数（line 268-270）は現在シンプルな部分文字列検索を使用しています。
この実装は `>` の前後の文字を確認せずに検索を行うため、`>=` 演算子（以上を意味する比較演算子）を含む文字列でも
`>` が存在するとtrueを返します。この関数は `awk-redirect` タイプのブラックリストチェックで使用されており、
`awk ... >= ...` を含むシェルコマンドが誤ってリダイレクトを含むと判定されてブロックされるリスクがあります。

requirements.mdのFQ-2セクションで明確化された修正要件として、`>=` や `<=` などの比較演算子をリダイレクトとして
誤検出しないよう修正することが定義されています。また `> ` パターン（`>` の後にスペース）や `>>` パターンの
検出精度を維持することが非機能要件として定義されています。

BASH_BLACKLISTの `regex` タイプエントリには `>=` を除外するパターンがすでに用意されていますが、
`hasRedirection` 関数はこの洗練されたリダイレクトパターンを使用せず単純な部分文字列検索を使っているという
一貫性の問題もあります。

### 変更対象ファイルと箇所

各修正対象となるファイルのパス: `C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js`

変更前（line 268-270）は以下の通りです。

```javascript
function hasRedirection(part) {
  return part.includes('>') || part.includes('>>');
}
```

変更後（`>=` や `<=` を比較演算子として除外）は以下の通りです。

```javascript
function hasRedirection(part) {
  // '>>' はリダイレクト（追記）として常に検出
  if (part.includes('>>')) return true;
  // '>' の後ろが '=' の場合は比較演算子（>=）であるためリダイレクトではない
  // 正規表現: '>' の後ろが '=' でなければリダイレクトと判定
  return /(?<!=)>(?!=)/.test(part);
}
```

### 正規表現の詳細解説

採用する正規表現 `/(?<!=)>(?!=)/` の各部分の意味は以下の通りです。
否定後読み `(?<!=)` は `>` の直前が `=` でないことを確認し、`=>` 記号を除外します。
リテラルの `>` 文字にマッチする部分が本体の検出対象です。
否定先読み `(?!=)` は `>` の直後が `=` でないことを確認し、`>=` 演算子を除外します。
`>` の前後にスペースが存在するケース（例: `echo hello > output.txt`）はこの正規表現でリダイレクトとして正しく検出されます。

この正規表現によって検出対象と非検出対象を明確に分類できます。
`echo hello > output.txt` の `> ` はリダイレクトとして検出され、`awk 'NR >= 2' file` の `>=` は比較演算子として除外されます。
`cat file >> log.txt` の `>>` は先に行われる `includes('>>')` チェックで検出されるため、正規表現チェックに到達する前に確実に捕捉されます。

### 受入基準と手動検証手順

requirements.mdで定義された受入基準に対応するため、以下の動作を検証します。
`node -e "if (a >= 0) { console.log(a); }"` がリダイレクト誤検出でブロックされないことを確認します。
`echo hello > output.txt` はリダイレクトとして正しく検出されることを確認します。
`cat file >> log.txt` はリダイレクトとして正しく検出されることを確認します。

手動検証手順: bash-whitelist.jsを修正した後、awk/nodeコマンドで比較演算子 `>=` を含むシェルコマンドを
実際に実行し、ブロックされないことをClaude Codeセッション内で検査してください。

---

## FQ-3: commit/pushフェーズのallowedBashCategories修正

### 問題の背景と再現条件

`definitions.ts` のcommitフェーズ（line 942）およびpushフェーズ（line 950）で、
`allowedBashCategories` が `['readonly', 'implementation']` と設定されています。
`implementation` カテゴリには `npm install`, `npm run build`, `mkdir`, `rm` などが含まれており、
commit/pushフェーズでは不適切なコマンド制限となっています。

CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクションには、commit/pushフェーズが
`readonly, git` と明記されています。また `bash-whitelist.js` の `getWhitelistForPhase` 関数内の
`gitPhases` 配列を参照するロジックも正しく `readonly + git` を返す構成になっており、
実装と定義の間に齟齬が生じています。

この問題の再現条件は「commitまたはpushフェーズに進んだとき、subagentへ送信されるプロンプトの
Bashコマンド制限セクションに誤った許可カテゴリが表示される」という状況です。
実際のフックは正しく動作しますが、subagentへの誤情報がsubagentの自律的な判断に影響するリスクがあります。

### 変更対象ファイルと箇所

各修正対象となるファイルのパス: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

変更箇所1はcommitフェーズのline 942で、`allowedBashCategories` を以下のように変更します。

```typescript
// 変更前
allowedBashCategories: ['readonly', 'implementation'],

// 変更後
allowedBashCategories: ['readonly', 'git'],
```

変更箇所2はpushフェーズのline 950で、同様に `allowedBashCategories` を変更します。

```typescript
// 変更前
allowedBashCategories: ['readonly', 'implementation'],

// 変更後
allowedBashCategories: ['readonly', 'git'],
```

### 整合性の確認とドキュメント・フック・フェーズの三者一致

修正後の状態として、以下3者の一致を確認します。
CLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクション（ドキュメント）はcommit/pushフェーズが `readonly, git` と記載されています。
`bash-whitelist.js` の `getWhitelistForPhase`（フック）は `gitPhases = ['commit', 'push']` として `readonly + git` を返します。
`definitions.ts` の `allowedBashCategories`（フェーズ定義）は修正後に `['readonly', 'git']` に揃います。
`git` カテゴリには `git add`, `git commit`, `git push`, `git pull`, `git fetch` が含まれており、commit/pushフェーズの作業に必要なコマンドが網羅されています。

手動検証手順: definitions.tsを修正してビルド後、commitフェーズに進みsubagentへ送信されるプロンプトを検査し、
`git` カテゴリが正しく表示されていることを確認してください。

---

## FQ-4: pushフェーズsubagentTemplateのブランチ確認手順追加

### 問題の背景と再現条件

現在の `definitions.ts` のpushフェーズの `subagentTemplate`（line 953）には「リモートリポジトリにプッシュしてください」
という指示のみが含まれており、subagentがどのブランチにpushするかを自律的に選択しなければなりません。
環境によってデフォルトブランチが `master` か `main` か異なる場合があり、
サブモジュールを含むリポジトリでは親リポジトリとサブモジュールのブランチ名が独立して管理されています。

requirements.mdのFQ-4セクションで定義された修正要件として、`git branch --show-current` または
`git rev-parse --abbrev-ref HEAD` でカレントブランチ名を確認する手順を明示的に追加することが求められています。
ブランチ名をプロンプトにハードコードすることは環境依存性を生じさせるため、実行時に動的に確認する構成を採用します。

### 変更対象ファイルと箇所

各修正対象となるファイルのパス: `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`

変更対象はline 953のpushフェーズ `subagentTemplate` です（実際のファイルでは `\n` で接続された1行の文字列として記述します）。

新しいテンプレートの内容は以下の通りです。

```
pushフェーズ

タスク情報:
- ユーザーの意図: ${userIntent}
- 出力先: ${docsDir}/

作業内容:
リモートリポジトリにプッシュしてください。

ブランチ確認と実行手順:
1. カレントブランチ名を確認する
   - 実行コマンド: git branch --show-current（または git rev-parse --abbrev-ref HEAD）
   - 出力されたブランチ名（masterまたはmain等）を使用する（name変数に格納して利用可）
   - detached HEAD状態（コマンド出力が空文字）の場合はpushを中止してエラーを報告すること
2. 親リポジトリのプッシュを実行する
   - 確認したブランチ名を使って git push origin {確認されたブランチ名} を実行すること
3. サブモジュールが存在する場合はサブモジュールのブランチも確認する
   - git submodule foreach git branch --show-current を実行してサブモジュールのブランチ名を確認すること
   - 各サブモジュールについて個別に git push origin {確認されたブランチ名} を実行すること
   - サブモジュールもdetached HEAD状態の場合はエラーを報告すること

注意事項:
- git push origin main と git push origin master をハードコードしないこと
- 必ず事前にブランチ名を確認してから実行すること
```

### サブモジュール対応の根拠と受入基準

本プロジェクトでは `workflow-plugin` がサブモジュールとして管理されており、親リポジトリと独立したブランチを持つ可能性があります。
commitフェーズの既存テンプレートには「サブモジュール内でコミットすること」という指示が含まれていますが、
pushフェーズには同様の考慮が欠如していました。
pushフェーズでも同様のサブモジュール対応手順を明示することで、サブモジュールの変更が確実にリモートに反映されます。
detached HEAD状態の検出は誤ったブランチへのpushを防ぐ安全装置として機能します。

requirements.mdで定義された受入基準に対応するため、以下の動作を確認します。
subagentがpushフェーズで `git branch --show-current` を実行してブランチ名（nameとして取得）を確認することが必須です。
確認したブランチ名を使った `git push origin {確認されたブランチ名}` が実行されることを検査します。
`main`、`master`、その他のブランチ名のどれであっても正しくpushされることを確認します。

手動検証手順: pushフェーズに進んだときにsubagentへ送信されるプロンプト内容を確認し、
`git branch --show-current` または `git rev-parse --abbrev-ref HEAD` コマンドの引数が明示されていることを検査してください。

---

## MCPサーバー再起動の要件

### 再起動が必要な変更の理由

FQ-1（next.ts）およびFQ-3とFQ-4（definitions.ts）の変更はMCPサーバーのコアモジュールに対する変更です。
Node.jsのrequire()はモジュールをグローバルキャッシュに保存するため、ディスク上のファイルを変更しても
実行中のMCPサーバーには変更が反映されません。プロセスを再起動することによってのみ変更が有効になります。
`definitions.ts` はCLAUDE.mdの「強制再起動条件」セクションに明示されているファイルであり、変更後の再起動は必須です。
`next.ts` はツール実装のコアファイルであり、同様に再起動が必要です。

### 再起動手順（4ステップ）

まず `C:\ツール\Workflow\workflow-plugin\mcp-server` ディレクトリで `npm run build` を実行してTypeScriptをトランスパイルします。
次に `dist/` 以下のファイルが更新日時が新しくなったことをファイルの更新日時で確認します。
そのうえでClaude DesktopのMCPサーバー再起動ボタンを使用してプロセスを再起動します。
最後に `workflow_status` を実行して現在のフェーズが正常に返されることを確認します。

### フックキャッシュのリフレッシュとNF-4の適用

FQ-2（bash-whitelist.js）の変更はhookファイルへの変更であり、MCPサーバーのコアモジュールではありません。
ただし、requirements.mdのNF-4（MCPサーバー再起動の要否判断）に記載の通り、フックキャッシュのリフレッシュを確認する必要があります。
Claude Codeのセッションを再起動することでフックキャッシュがリフレッシュされ、新しいコードが読み込まれます。
bash-whitelist.jsはフックから読み込まれるため、セッション再起動によって変更が適用されます。

---

## 変更対象ファイルまとめ

本修正で変更が必要な各修正対象は以下の4箇所（3ファイル）で構成されます。
ファイル構成と修正内容を以下に整理します。

修正ファイル1は `workflow-plugin/mcp-server/src/tools/next.ts` で、line 267-275のハッシュ重複チェックブロックに
条件分岐 `currentPhase !== 'regression_test' && currentPhase !== 'testing'` を追加します。
この条件追加により、testingフェーズでのフェーズブロックが解消されます。

修正ファイル2は `workflow-plugin/hooks/bash-whitelist.js` で、line 268-270の `hasRedirection` 関数を
`includes('>')` の単純検索から正規表現 `/(?<!=)>(?!=)/` による検出に変更します。
これによりリダイレクトパターン検出の精度と検出精度が向上し、比較演算子の誤検出が排除されます。

修正ファイル3（変更箇所1）は `workflow-plugin/mcp-server/src/phases/definitions.ts` のcommitフェーズで、
line 942の `allowedBashCategories` を `['readonly', 'implementation']` から `['readonly', 'git']` に変更します。

修正ファイル3（変更箇所2）は同じ `definitions.ts` のpushフェーズで、line 950の `allowedBashCategories` を
`['readonly', 'implementation']` から `['readonly', 'git']` に変更し、line 953の `subagentTemplate` に
`git branch --show-current` および `git rev-parse --abbrev-ref HEAD` を使ったブランチ確認手順を追加します。

---

## 非機能要件の適用

requirements.mdに定義された非機能要件は本仕様書の各修正内容に以下のように適用されています。
NF-1（後方互換性の維持）: 各修正はスキップロジックの条件追加や値の変更に留め、既存のロジックを削除しない形で実装します。
NF-2（コードの整合性）: FQ-3の修正によりドキュメント・フック・フェーズ定義の三者の構成が同じ情報を持つ状態を維持します。
NF-3（サブモジュール対応）: FQ-4のテンプレートでは親リポジトリとサブモジュールのブランチを個別に確認する明示的な手順を提供します。
NF-4（MCPサーバー再起動の要否判断）: next.tsおよびdefinitions.tsの変更後はMCPサーバーの再起動を必須とし、bash-whitelist.jsの変更後はフックキャッシュのリフレッシュを確認します。
NF-5（テスト可能性）: 各修正に対応するユニットテストまたは手動検証手順を本仕様書の各セクションに記載し、修正が有効であることを検査できる構成を採用しています。
