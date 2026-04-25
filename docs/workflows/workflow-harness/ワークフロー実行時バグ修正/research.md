# ワークフロー実行時バグ修正 - 調査結果

## サマリー

このドキュメントは、前回の「開発環境整合性修正」タスク実行中に発見された4つのバグについて、
ソースコードを直接読み込み、根本原因を特定した調査結果をまとめたものです。

- 目的: 4つのバグの根本原因をコードレベルで特定し、次フェーズ（要件定義・設計）に引き渡す
- 主要な発見事項: バグ1は自己参照ロジックの設計ミス、バグ2は正規表現の副作用、バグ3はカテゴリ設定ミス、バグ4はテンプレートにブランチ名がない（subagentの判断依存）
- 次フェーズで必要な情報: 各バグの修正箇所ファイルパス・行番号・修正方針

---

## バグ1: testingフェーズの自己参照ハッシュチェック

### 症状の詳細

testingフェーズで `workflow_record_test_result` を呼んだ直後に `workflow_next` を呼ぶと、
「テスト出力が以前と同一です（コピペの可能性）」エラーが返り、フェーズ遷移がブロックされる。
同じテスト出力を何度実行しても突破できない状態になる。

### コード調査結果

`record-test-result.ts` の line 420-429 を確認した。

```
// REQ-C2: テスト出力ハッシュの記録と重複チェック
// FR-3: regression_testフェーズでは同一ハッシュの再記録を許可（修正前後の比較用）
const existingHashes = currentPhase === 'regression_test' ? [] : (taskState.testOutputHashes || []);
const hashValidation = recordTestOutputHash(output, existingHashes);
```

`record_test_result` は `testOutputHashes` 配列に新しいハッシュを追記してから状態を保存する（line 484-489）。

続いて `next.ts` の line 267-275 を確認した。

```
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

`workflow_next` 側はフェーズ限定スキップをしていないため、testingフェーズでも `testOutputHashes` を参照する。
`record_test_result` で追加されたハッシュが `testOutputHashes` に入った状態で `workflow_next` が呼ばれると、
同一の出力ハッシュが配列に存在するため、重複チェックで必ずブロックされる。

### regression_testフェーズとの比較

`next.ts` の line 342-352 に以下のコードがある。

```
// ハッシュ重複チェック（regression_testフェーズでは自己参照が発生するためスキップ）
if (currentPhase !== 'regression_test') {
  const existingHashes = taskState.testOutputHashes || [];
  const hashResult = recordTestOutputHash(testResult.output, existingHashes);
  ...
}
```

regression_testフェーズでは `currentPhase !== 'regression_test'` という条件でスキップが実装されている。
testingフェーズでは同等のスキップがなく、このコードブロック（line 266-275）は
`if (currentPhase === 'testing')` ブロック内（line 235-307）に入っているため、
testingフェーズでのみハッシュ重複チェックが実行される。

### 根本原因

`record_test_result` がハッシュを `testOutputHashes` に追加した後で、
`workflow_next` が同じ `testOutputHashes` 配列を参照してチェックするため、
自己参照的な重複検出が発生する。
regression_testフェーズにはスキップロジックが実装済みだが、testingフェーズには適用されていない設計不備。

### 修正方針

`next.ts` の line 267-275 のハッシュ重複チェックブロックを、
regression_testフェーズのスキップコード（line 342-352）と同様に、
testingフェーズでも条件付きスキップする形に変更する。
具体的には、testingフェーズ向けのハッシュチェックブロック自体をコメントアウトまたは削除するか、
フェーズが 'testing' の場合にもスキップ条件を追加することで解決できる。

---

## バグ2: bash-whitelist.jsのリダイレクトパターン誤マッチ

### 症状の詳細

`node -e` コマンド内で `>=` や `<=` 演算子を含むJavaScriptコードを実行しようとすると、
「禁止されたコマンド/パターン」としてブロックされる。

### コード調査結果

`bash-whitelist.js` の BASH_BLACKLIST 定義（line 117）を確認した。

```javascript
{ pattern: /(?<!=)> /, type: 'regex' },
```

このパターンは「`=` の直前ではない `>` に続くスペース」にマッチする正規表現である。
`(?<!=)` は否定後読み（negative lookbehind）で、直前が `=` でない場合にマッチする。

`>=` に対しては `>` の直前が `=` ではないため、条件は `>` の前の文字によって変わる。
たとえば `x >= 0` というコードで `> ` の部分（`>` とスペース）にマッチするかを確認すると、
`>=` では `>` の直後に `=` が来るのでパターン `/(?<!=)> /` の "> " 部分（`>` + スペース）にはマッチしない。
しかし実際に `node -e "if (a >= 0) { ... }"` のようなコードでは、
`>=` の後にスペースが続く場合（たとえば `>= 0`）、`>=` の中の `>` だけ見た場合、
パターン `/(?<!=)> /` は `>` + スペースにマッチしようとするが、
`>= 0` の場合は `>` の直後が `=` であり ` ` ではないためマッチしない。

つまり `>=` は誤検出しない設計になっているが、実際に問題が起きた場合は別の箇所の可能性がある。
たとえば `node -e "const r = process.stdout; r.write(...)"` のような場合、
`.write(` はNODE_E_BLACKLISTに含まれているためブロックされる。

### さらなる調査

`hasRedirection` 関数（line 268-270）を確認した。

```javascript
function hasRedirection(part) {
  return part.includes('>') || part.includes('>>');
}
```

この関数はawk-redirectタイプのチェックで使用される。`>` を単純にincludesで検出しており、
`>=` を含む文字列でも `>` が存在すればtrueを返す。ただしこれはawk-redirect専用であり、
node -eには適用されない。

### 根本原因の特定

正規表現パターン `/(?<!=)> /` は `>=` の誤検出は防止できているが、
`> ` というパターン（`>` とスペース）のみを検出する。
`>0` のようにスペースなしの場合はマッチしない。
一方、`hasRedirection` は単純な `includes('>')` で動作するため、
awk-redirectタイプの判定では `>=` を含む部分文字列でも誤検出する可能性がある。
しかし `node -e` コマンドはawk-redirect判定の対象外であるため、別経路での誤検出が考えられる。

実際の症状（`>=` でブロック）の根本原因は、
正規表現パターン `/(?<!=)> /` よりも `hasRedirection` 関数（`includes('>')` による粗い検索）が
awk-redirectチェックで誤作動している可能性がある。もしくは `>=` を含む文字列の中で
前後の文脈によって `/(?<!=)> /` の期待と異なる解釈が生じているケースが考えられる。

---

## バグ3: pushフェーズのBashカテゴリ設定

### 症状の詳細

pushフェーズで `git push` を実行しようとすると、ブロックされる可能性がある。
CLAUDE.mdでは pushフェーズの許可カテゴリは `readonly, git` と記載されているが、
実際のコードでの定義が異なる状態が疑われる。

### コード調査結果（bash-whitelist.js）

`getWhitelistForPhase` 関数（line 213-255）を確認した。

```javascript
const gitPhases = ['commit', 'push'];

...

} else if (gitPhases.includes(phase)) {
  return [...BASH_WHITELIST.readonly, ...BASH_WHITELIST.git];
}
```

`bash-whitelist.js` においては、pushフェーズは `gitPhases` に含まれており、
`BASH_WHITELIST.readonly + BASH_WHITELIST.git` を返す。`git` カテゴリには `git push` が含まれている（line 88）。
この実装自体は正しく、`bash-whitelist.js` 側ではgit pushが許可されている。

### コード調査結果（definitions.ts）

`definitions.ts` の pushフェーズ定義（line 947-954）を確認した。

```typescript
push: {
  phaseName: 'push',
  description: 'プッシュフェーズ',
  allowedBashCategories: ['readonly', 'implementation'],
  ...
}
```

問題発見: `allowedBashCategories` が `['readonly', 'implementation']` になっており、
`'git'` カテゴリが含まれていない。

同様に `commit` フェーズの定義（line 940-945）も確認した。

```typescript
commit: {
  phaseName: 'commit',
  description: 'コミットフェーズ',
  allowedBashCategories: ['readonly', 'implementation'],
  ...
}
```

commitフェーズも `allowedBashCategories` が `['readonly', 'implementation']` であり、`'git'` が欠落している。

### 根本原因

`definitions.ts` の `allowedBashCategories` 設定が実際のフックの動作（`bash-whitelist.js` の `getWhitelistForPhase`）と
乖離している。CLAUDE.mdの記載や `bash-whitelist.js` の実装では `git` カテゴリが許可されるべきだが、
`definitions.ts` のフェーズガイドでは `implementation` カテゴリのみが設定されており、
subagentがテンプレートのBashコマンド制限セクションを参考にすると、
git pushが使えないと誤解する可能性がある。

フック自体（`bash-whitelist.js`）はphase名を直接参照してホワイトリストを決定するため、
実際のブロックはされないが、subagentへのプロンプトに誤情報が伝わることで
subagentが git push を実行しない判断を下すリスクがある。

---

## バグ4: workflow-pluginのブランチ名不一致

### 症状の詳細

pushフェーズでsubagentが `git push origin master` を実行したが、
`workflow-plugin` サブモジュールのブランチは `main` であったため、プッシュに失敗した。

### コード調査結果（definitions.ts - pushフェーズテンプレート）

`definitions.ts` の pushフェーズ `subagentTemplate`（line 953）を確認した。

```
subagentTemplate: '# pushフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\nリモートリポジトリにプッシュしてください。'
```

テンプレートには「リモートリポジトリにプッシュしてください」とのみ記述されており、
ブランチ名はハードコードされていない。

### なぜsubagentがmasterブランチを指定したか

テンプレートにブランチ名の指定がないため、subagentは自律的に判断してコマンドを生成した。
subagentが `git branch` や `git status` でカレントブランチを確認せずに、
デフォルト値として `master` を選択した可能性が高い。
これはテンプレートが「ブランチ確認のステップ」を明示的に指示していないための設計欠陥である。

### 根本原因

pushフェーズの `subagentTemplate` が、事前に現在のブランチ名を確認する手順を指示していない。
テンプレートに以下のような手順が欠如している。

- `git branch --show-current` または `git rev-parse --abbrev-ref HEAD` でカレントブランチ名を確認する
- 確認したブランチ名を使って `git push origin <branchName>` を実行する
- サブモジュールが存在する場合は、サブモジュールのブランチ名も個別に確認する

subagentが自律的にブランチを判断する設計にすると、環境によって `master` か `main` かが異なるため、
テンプレートに明示的なブランチ確認コマンドを追加することで解決できる。

---

## 調査対象ファイルの一覧

以下のファイルを直接読み込んで根本原因を特定した。

- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts`: testingフェーズのハッシュチェックロジック（line 235-307、line 342-352）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\record-test-result.ts`: ハッシュ記録ロジック（line 420-429、line 484-489）
- `C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js`: getWhitelistForPhase（line 213-255）、リダイレクトパターン（line 117）、hasRedirection（line 268-270）
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`: pushフェーズ定義（line 947-954）、commitフェーズ定義（line 940-945）

---

## 次フェーズへの引き継ぎ情報

### 修正優先度

バグ1は毎回のtestingフェーズ遷移をブロックする致命的なバグであり、最優先で対処が必要である。
バグ3はsubagentのプロンプトに誤情報が伝わる品質問題であり、優先度は高い。
バグ4はsubagentの自律的判断に起因するため、テンプレート改善で対処できる。
バグ2はハッシュリダイレクト検出の副作用であり、再現条件の絞り込みが必要である。

### 修正対象ファイルまとめ

バグ1の修正対象は `next.ts` の line 266-275 のブロックである。
バグ2の修正対象は `bash-whitelist.js` の `hasRedirection` 関数または BASH_BLACKLIST の regex パターンである。
バグ3の修正対象は `definitions.ts` の commit/push フェーズの `allowedBashCategories` フィールドである。
バグ4の修正対象は `definitions.ts` の push フェーズの `subagentTemplate` 文字列である。

### 設計上の留意点

バグ1の修正では、testingフェーズでのハッシュチェックを完全に無効化するのではなく、
「record_test_result で記録した直後のworkflow_next では同一ハッシュを許可する」という設計が望ましい。
regression_testフェーズのスキップ実装（`currentPhase !== 'regression_test'`）を参考に、
testingフェーズにも同様のスキップを追加することが最小変更の修正方針である。

バグ3の修正では、CLAUDE.mdの記載と実際のコードを一致させる必要がある。
pushフェーズとcommitフェーズの `allowedBashCategories` を `['readonly', 'git']` に変更することで、
subagentへのプロンプトに正確な情報が伝わるようになる。
