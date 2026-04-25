# ワークフロープロセス阻害要因解消 - 要件定義書

## サマリー

本ドキュメントは、前回タスク完了後の監査で発見された8件のワークフローフック不備（D-1～D-8）を解消するための要件を定義する。
これらの問題はワークフロー実行を完全に停止させる Critical レベルが4件、機能を著しく制限する High レベルが3件、整合性の問題である Low レベルが1件で構成されている。
修正対象ファイルは workflow-plugin/hooks/ 配下の bash-whitelist.js（5件）、phase-edit-guard.js（2件）、enforce-workflow.js（1件）である。
各問題に対して修正要件、実装方針、受け入れ基準を定義し、全修正完了後にワークフローの19フェーズ全てが正常に実行可能な状態を実現する。
次の planning フェーズでは、これらの要件に基づく具体的な実装計画とテスト戦略を策定する。

---

## 機能要件

### FR-1: ci_verificationフェーズのホワイトリスト登録

**ID:** FR-1
**問題コード:** D-1
**優先度:** Critical
**カテゴリ:** bash-whitelist.js

**問題の説明:**

bash-whitelist.jsのgetWhitelistForPhase()関数（行180-226）において、ci_verificationフェーズがreadonlyPhases、docsUpdatePhases、verificationPhases、testingPhases、implementationPhases、gitPhasesのいずれの配列にも含まれていない。
その結果、else節（行224）にフォールバックしBASH_WHITELIST.readonlyのみが適用される。
CI検証に必要なghコマンド（GitHub CLI）が実行できず、ワークフローのci_verificationフェーズが機能しない。
これはワークフロープロセス全体の停止を引き起こすCriticalレベルの問題である。

**修正要件:**

1. ci_verificationフェーズをverificationPhasesグループに追加する
2. verificationPhasesのホワイトリストにghコマンドを追加する
3. CI検証に必要な他のコマンド（git、curl等）が既に含まれていることを確認する

**実装方針:**

```javascript
// bash-whitelist.js の修正
// 行194付近の verificationPhases 配列に ci_verification を追加
const verificationPhases = ['regression_test', 'ci_verification'];

// BASH_WHITELIST の verification 定義に gh を追加（既にあれば確認のみ）
verification: [
  ...readonly,
  'gh',  // GitHub CLI（CI検証用）
  'curl',
  'jq'
]
```

**受け入れ基準:**

1. ci_verificationフェーズで `gh pr checks` コマンドがブロックされない
2. ci_verificationフェーズで `gh run view` コマンドが実行可能
3. getWhitelistForPhase('ci_verification') が readonly + gh + curl + jq を含む配列を返す
4. 既存のverificationPhases（regression_test）の動作が変わらない

---

### FR-2: deployフェーズのホワイトリスト登録

**ID:** FR-2
**問題コード:** D-2
**優先度:** Critical
**カテゴリ:** bash-whitelist.js

**問題の説明:**

D-1と同様に、deployフェーズもgetWhitelistForPhase()のどのフェーズグループにも含まれていない。
デプロイに必要なコマンド群（docker、kubectl、ssh等）が実行できないため、ワークフローのdeployフェーズが機能しない。
現在はreadonly扱いになっており、ワークフローの最終フェーズが実行不可能な状態である。

**修正要件:**

1. 新しいフェーズグループ deployPhases を定義し、deploy を含める
2. deployPhases のホワイトリストにデプロイコマンド（docker、kubectl、ssh、scp等）を追加する
3. セキュリティリスクを考慮し、必要最小限のコマンドのみを許可する

**実装方針:**

```javascript
// bash-whitelist.js の修正
// 新しいフェーズグループの定義（行201付近に追加）
const deployPhases = ['deploy'];

// BASH_WHITELIST に deploy 定義を追加
deploy: [
  ...readonly,
  'docker',       // Dockerデプロイ用
  'kubectl',      // Kubernetes デプロイ用
  'ssh',          // リモートデプロイ用
  'scp',          // ファイル転送用
  'rsync',        // 同期デプロイ用
  'gh',           // GitHub CLI（デプロイトリガー用）
  'curl'          // API呼び出し用
],

// getWhitelistForPhase() に deployPhases の判定を追加
if (deployPhases.includes(phase)) {
  return { readonly, ...BASH_WHITELIST.deploy };
}
```

**受け入れ基準:**

1. deployフェーズで `docker push` コマンドが実行可能
2. deployフェーズで `kubectl apply -f deployment.yaml` が実行可能
3. deployフェーズで `ssh user@host "command"` が実行可能
4. deployフェーズで `gh workflow run deploy.yml` が実行可能
5. readonly系コマンド（ls、cat、grep等）も引き続き使用可能

---

### FR-3: シェル組み込みコマンドのホワイトリスト除外

**ID:** FR-3
**問題コード:** D-3
**優先度:** Critical
**カテゴリ:** bash-whitelist.js

**問題の説明:**

splitCompoundCommand()の行315で正規表現 `/\s*(?:&&|\|\||;|\|)\s*/` によりコマンドを分割しているため、`cmd || true` のようなシェルイディオムが `["cmd", "true"]` の2つのパートに分割される。
`true` コマンドはBASH_WHITELISTのどのリストにも登録されていないため、ホワイトリスト検証で失敗する。
同様に `false`、`exit 0`、`exit 1` 等のシェル組み込みコマンドも影響を受け、エラー処理のイディオムが使用不可能になっている。

**修正要件:**

1. SHELL_BUILTINSリスト（true、false、exit等）を定義する
2. checkCommand()関数で、コマンドがSHELL_BUILTINSに含まれる場合はホワイトリストチェックをスキップする
3. セキュリティリスクのない基本的なシェル組み込みコマンドのみを許可する

**実装方針:**

```javascript
// bash-whitelist.js の修正
// ファイル冒頭にシェル組み込みコマンドリストを定義（行25付近）
const SHELL_BUILTINS = [
  'true',
  'false',
  'exit',
  ':',       // null コマンド
  'set',     // シェルオプション設定（-e, -u等）
  'unset',   // 変数削除
  'readonly' // 読み取り専用変数
];

// checkCommand() 関数を修正（行356付近）
function checkCommand(command, phase, filePath) {
  // ...既存のコード...

  for (const partTrimmed of parts.map(p => p.trim())) {
    // シェル組み込みコマンドはホワイトリストチェックをスキップ
    const baseCommand = partTrimmed.split(/\s+/)[0];
    if (SHELL_BUILTINS.includes(baseCommand)) {
      continue;
    }

    // ...既存のホワイトリストチェック...
  }
}
```

**受け入れ基準:**

1. `npm test || true` コマンドがブロックされない
2. `set -e && npm run build` コマンドがブロックされない
3. `exit 0` コマンドがブロックされない
4. `[ -f file.txt ] && cat file.txt || echo "File not found"` のような複雑な条件式が動作する
5. SHELL_BUILTINSに含まれないコマンドは引き続きホワイトリスト検証が適用される

---

### FR-4: nodeコマンドの単体実行許可

**ID:** FR-4
**問題コード:** D-4
**優先度:** Critical
**カテゴリ:** bash-whitelist.js

**問題の説明:**

BASH_WHITELIST.readonlyリスト（行31）には `node -e` のみが登録されている。
`node filename.js` 形式のコマンドは前方一致で `node -e` にマッチしないためブロックされる。
testing/implementationフェーズのホワイトリストにも `node` 単体は含まれていないため、テストスクリプトの実行に `node -e "require('...')"` 等の回避策が必要になっており、複雑なスクリプトの実行が著しく困難になっている。

**修正要件:**

1. BASH_WHITELIST.readonly、testing、implementationの各リストに `node` を追加する
2. `node -e` と `node filename.js` の両方の形式を許可する
3. セキュリティリスク（任意コード実行）は既に `node -e` で許容済みのため、`node` 単体の追加は妥当と判断する

**実装方針:**

```javascript
// bash-whitelist.js の修正
// BASH_WHITELIST.readonly を修正（行31付近）
readonly: [
  // ...既存のコマンド...
  'node',        // Node.js スクリプト実行
  'node -e',     // Node.js ワンライナー（既存）
  // ...
],

// BASH_WHITELIST.testing を修正（行113付近）
testing: [
  // ...既存のコマンド...
  'node',        // テストスクリプト実行
  // ...
],

// BASH_WHITELIST.implementation を修正（行144付近）
implementation: [
  // ...既存のコマンド...
  'node',        // 実装確認スクリプト実行
  // ...
]
```

**受け入れ基準:**

1. testingフェーズで `node test-script.js` コマンドが実行可能
2. implementationフェーズで `node build-check.js` が実行可能
3. readonlyフェーズ（research等）で `node analyze.js` が実行可能
4. `node -e "console.log('test')"` も引き続き動作する
5. 既存のコマンドホワイトリスト検証は変更されない

---

### FR-5: PHASE_ORDERへの欠落フェーズ追加

**ID:** FR-5
**問題コード:** D-5
**優先度:** High
**カテゴリ:** phase-edit-guard.js

**問題の説明:**

phase-edit-guard.jsのPHASE_ORDER配列（行301-322）に以下の10フェーズが定義されていない。
parallel_analysis、parallel_design、parallel_qualityの3つの並列親フェーズ、regression_test、parallel_verificationの2つの検証系フェーズ、performance_test、e2e_testの2つの並列サブフェーズ、push、ci_verification、deployの3つの後期フェーズが欠けている。
これにより、findNextPhaseForFileType()のガイダンスメッセージの「次のフェーズ」情報が不正確になり、ユーザーが適切なフェーズへの遷移を理解できなくなっている。

**修正要件:**

1. PHASE_ORDERに欠落している10フェーズを正しい順序で追加する
2. 並列フェーズ（parallel_*）とそのサブフェーズの順序関係を適切に表現する
3. CLAUDE.mdで定義されている19フェーズの順序と完全に一致させる

**実装方針:**

```javascript
// phase-edit-guard.js の修正
// PHASE_ORDER 配列を拡張（行301-322）
const PHASE_ORDER = [
  'idle',
  'research',
  'requirements',
  'parallel_analysis',      // 追加: 並列分析フェーズ
  'threat_modeling',
  'planning',
  'parallel_design',        // 追加: 並列設計フェーズ
  'state_machine',
  'flowchart',
  'ui_design',
  'design_review',
  'test_design',
  'test_impl',
  'implementation',
  'refactoring',
  'parallel_quality',       // 追加: 並列品質チェックフェーズ
  'build_check',
  'code_review',
  'testing',
  'regression_test',        // 追加: リグレッションテストフェーズ
  'parallel_verification',  // 追加: 並列検証フェーズ
  'manual_test',
  'security_scan',
  'performance_test',       // 追加: パフォーマンステストサブフェーズ
  'e2e_test',               // 追加: E2Eテストサブフェーズ
  'docs_update',
  'commit',
  'push',                   // 追加: pushフェーズ
  'ci_verification',        // 追加: CI検証フェーズ
  'deploy',                 // 追加: デプロイフェーズ
  'completed'
];
```

**受け入れ基準:**

1. PHASE_ORDER配列が19フェーズ + idle + completed の21要素を含む
2. findNextPhaseForFileType('code', 'parallel_analysis') が正しい次フェーズ（parallel_design）を返す
3. displayBlockMessage()のガイダンスメッセージが正確な次フェーズ名を表示する
4. CLAUDE.mdのフェーズ順序定義と完全に一致する
5. 並列フェーズとサブフェーズの順序関係が正しく表現されている

---

### FR-6: git -C オプションのホワイトリスト対応

**ID:** FR-6
**問題コード:** D-6
**優先度:** High
**カテゴリ:** bash-whitelist.js

**問題の説明:**

bash-whitelist.jsの行399で `partTrimmed.startsWith(allowedCommand)` によるマッチングを行っている。
ホワイトリストには `git status`、`git log`、`git diff` 等が登録されているが、`git -C /path/to/dir status` のように `-C` オプション付きで実行するとマッチしない。
`git -C` はサブディレクトリのリポジトリを操作するための標準的なオプションであり、現状ではブロックされるため `cd dir && git status` のような回避策が必要になっている。

**修正要件:**

1. gitコマンドの検証ロジックを修正し、`git -C <path>` パターンを認識する
2. `-C` オプションを除去した後のコマンドに対してホワイトリストマッチングを行う
3. 他のgitオプション（-c、--git-dir等）も同様に処理可能な汎用的な実装にする

**実装方針:**

```javascript
// bash-whitelist.js の修正
// checkCommand() 関数内のホワイトリストマッチング部分を修正（行395-410付近）

function normalizeGitCommand(commandStr) {
  // git -C <path> ... → git ... に正規化
  // git --git-dir=<path> ... → git ... に正規化
  if (commandStr.startsWith('git ')) {
    return commandStr
      .replace(/^git\s+-C\s+\S+\s+/, 'git ')
      .replace(/^git\s+--git-dir=\S+\s+/, 'git ')
      .replace(/^git\s+-c\s+\S+=\S+\s+/, 'git ');
  }
  return commandStr;
}

// ホワイトリストマッチング部分
const normalizedCommand = normalizeGitCommand(partTrimmed);
let isAllowed = allowedCommands.some(cmd => normalizedCommand.startsWith(cmd));
```

**受け入れ基準:**

1. `git -C /path/to/dir status` コマンドがブロックされない
2. `git -C ./subdir log` コマンドが実行可能
3. `git --git-dir=/path/.git log` コマンドが実行可能
4. `git -c user.name="Test" commit` コマンドが実行可能
5. 通常の `git status` コマンドも引き続き動作する
6. `git -C` の後に不正なサブコマンドを指定した場合は依然としてブロックされる

---

### FR-7: フックブロックメッセージのstderr出力

**ID:** FR-7
**問題コード:** D-7
**優先度:** High
**カテゴリ:** phase-edit-guard.js

**問題の説明:**

phase-edit-guard.jsのdisplayBlockMessage()関数（行1119-1151）では、全てのブロックメッセージが console.log() を使ってstdoutに出力されている。
Claude Codeがブロックメッセージをstderrで受け取ることを期待している場合、ブロック理由がユーザーに表示されない可能性がある。
enforce-workflow.jsも同様にconsole.logを使っているが、Git pre-commit hookのエラーメッセージは通常stderrに出力するのが標準的な動作である。

**修正要件:**

1. displayBlockMessage()関数の全てのconsole.log()をconsole.error()に変更する
2. Git pre-commit hookの標準動作に準拠し、エラーメッセージをstderrに出力する
3. 既存のフックシステムとの互換性を保つため、出力内容は変更しない

**実装方針:**

```javascript
// phase-edit-guard.js の修正
// displayBlockMessage() 関数内の全ての console.log を console.error に置換（行1119-1151）

function displayBlockMessage(blockInfo) {
  // ブロック理由の表示
  console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  console.error('\x1b[31m✘ COMMIT BLOCKED - Phase Edit Guard\x1b[0m');
  console.error('\x1b[31m━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\x1b[0m');
  // ...以降の全ての console.log を console.error に変更...
}
```

**受け入れ基準:**

1. コミットブロック時のメッセージがstderrに出力される
2. Claude Codeのターミナルでブロックメッセージが赤色で表示される
3. Git pre-commit hookの終了コード（process.exit(1)）は変更されない
4. メッセージの内容とフォーマットは既存のまま（console.logからconsole.errorへの置換のみ）
5. enforce-workflow.jsも同様に修正が必要か検討する（別タスクで対応可能）

---

### FR-8: architecture_reviewフェーズの定義削除

**ID:** FR-8
**問題コード:** D-8
**優先度:** Low
**カテゴリ:** enforce-workflow.js, phase-edit-guard.js

**問題の説明:**

enforce-workflow.jsの行55に `'architecture_review': ['.md']` が、phase-edit-guard.jsの行129-134にもarchitecture_reviewのPHASE_RULES定義が残存している。
CLAUDE.mdで定義されているワークフローの19フェーズにはarchitecture_reviewは含まれておらず、MCPサーバー側でもこのフェーズは遷移先として存在しない。
実害はないが、コードベースの整合性とメンテナンス性のために削除が望ましい。

**修正要件:**

1. enforce-workflow.jsのPHASE_EXTENSIONSからarchitecture_reviewエントリを削除する
2. phase-edit-guard.jsのPHASE_RULESからarchitecture_reviewエントリを削除する
3. コメントやドキュメント内のarchitecture_review参照も削除する

**実装方針:**

```javascript
// enforce-workflow.js の修正
// PHASE_EXTENSIONS から architecture_review 行を削除（行55）
const PHASE_EXTENSIONS = {
  // ...既存のフェーズ...
  // 'architecture_review': ['.md'],  // ← この行を削除
  // ...既存のフェーズ...
};

// phase-edit-guard.js の修正
// PHASE_RULES から architecture_review セクションを削除（行129-134）
const PHASE_RULES = {
  // ...既存のフェーズ...
  // architecture_review: {  // ← このセクション全体を削除
  //   allowedExtensions: ['.md', '.mmd'],
  //   allowedDirs: ['docs/'],
  //   blockSourceCode: true,
  //   requiresWorkflowStart: true
  // },
  // ...既存のフェーズ...
};
```

**受け入れ基準:**

1. enforce-workflow.jsにarchitecture_reviewの参照が存在しない
2. phase-edit-guard.jsにarchitecture_reviewの参照が存在しない
3. `git grep 'architecture_review' workflow-plugin/hooks/` で検索結果が0件
4. 既存の19フェーズの動作に影響がない
5. MCPサーバー側のフェーズ定義との整合性が取れている

---

## 非機能要件

### NFR-1: パフォーマンス

**要件:**
- ホワイトリスト検証の追加オーバーヘッドは10ms以内に抑える
- normalizeGitCommand()の正規表現処理は単純な文字列置換で実装し、複雑な解析を避ける
- SHELL_BUILTINSのチェックはArray.includes()を使用し、O(n)の線形探索で十分とする（要素数が少ないため）
- PHASE_ORDERの拡張によるfindNextPhaseForFileType()の処理時間増加は無視できるレベル
- フックの総実行時間は500ms以内を維持する（既存の性能を維持）

### NFR-2: 信頼性

**要件:**
- bash-whitelist.jsの変更により、既存のフェーズの動作が変わらないこと
- 新しいホワイトリスト定義が既存の定義と衝突しないこと
- SHELL_BUILTINSの追加により、悪意のあるコマンドが実行可能にならないこと
- normalizeGitCommand()の正規化処理により、不正なgitコマンドがホワイトリストを迂回できないこと
- phase-edit-guard.jsのstderr出力変更により、Claude Codeでのエラー表示が正しく機能すること

### NFR-3: 保守性

**要件:**
- 各ホワイトリスト定義にはコメントで用途を説明する
- SHELL_BUILTINSリストには各コマンドの用途をコメントで記載する
- normalizeGitCommand()には処理内容と対応するgitオプションをコメントで記載する
- PHASE_ORDERの追加フェーズには「追加」のマーカーコメントを付ける
- 変更内容はgit commitメッセージに詳細に記録する（FR-1～FR-8の対応を明記）

### NFR-4: セキュリティ

**要件:**
- deployフェーズのホワイトリストは必要最小限のコマンドに限定する
- SHELL_BUILTINSには危険なシェル組み込みコマンド（eval、exec等）を含めない
- nodeコマンドの許可は既に任意コード実行が可能な状態であるため、追加のセキュリティリスクは限定的
- normalizeGitCommand()は正規化処理のみを行い、コマンド実行は行わない
- 全ての変更はセキュリティレビューを経てコミットする

### NFR-5: 互換性

**要件:**
- 既存のワークフロー実行が動作しなくなる変更は行わない
- 新しいフェーズ定義の追加は、既存のフェーズに影響を与えない
- console.log から console.error への変更は、出力内容を変更しない
- architecture_reviewの削除は、既存のコードベースに影響を与えない
- MCPサーバー側のフェーズ定義との整合性を保つ

---

## 制約条件

### TC-1: Git hooksの実行順序

**制約:**
- Git pre-commit hookは phase-edit-guard.js → scope-validator.ts → bash-whitelist.js の順で実行される
- bash-whitelist.jsの変更は他のフックの後で検証される
- フック間の依存関係を変更してはならない

### TC-2: MCPサーバーとの整合性

**制約:**
- PHASE_ORDERはMCPサーバー側のWorkflowPhase型定義と完全に一致する必要がある
- MCPサーバーが定義していないフェーズをPHASE_ORDERに追加してはならない
- architecture_reviewの削除は、MCPサーバー側に同フェーズが存在しないことを確認済み

### TC-3: CLAUDEの仕様との整合性

**制約:**
- CLAUDE.mdで定義されている19フェーズの順序と完全に一致させる
- 各フェーズの編集可能ファイルルールはCLAUDE.mdの定義に従う
- 新しいホワイトリスト定義はCLAUDE.mdの「フェーズごとの編集可能ファイル」セクションと矛盾しない

### TC-4: 後方互換性

**制約:**
- 既存のワークフロータスクが動作しなくなる変更は行わない
- 既存のコミット済みコードに影響を与えない
- 既存のドキュメント（research.md、requirements.md等）の修正は不要

---

## 受け入れ基準

### AC-1: ci_verificationフェーズの動作確認

**テストケース:**
```bash
# ci_verificationフェーズで以下が可能
gh pr checks
gh run view
gh workflow view
curl -s https://api.github.com/repos/owner/repo/actions/runs
```

**成功条件:**
- 全てのコマンドがブロックされない
- getWhitelistForPhase('ci_verification')がghコマンドを含むリストを返す

---

### AC-2: deployフェーズの動作確認

**テストケース:**
```bash
# deployフェーズで以下が可能
docker build -t myapp .
docker push registry.example.com/myapp
kubectl apply -f deployment.yaml
ssh user@server "systemctl restart myapp"
gh workflow run deploy.yml
```

**成功条件:**
- 全てのデプロイコマンドが実行可能
- getWhitelistForPhase('deploy')がdocker、kubectl、ssh、ghを含むリストを返す

---

### AC-3: シェル組み込みコマンドの動作確認

**テストケース:**
```bash
# 各フェーズで以下が可能
npm test || true
set -e && npm run build
exit 0
[ -f file.txt ] && cat file.txt || echo "Not found"
```

**成功条件:**
- `|| true`、`|| false`、`exit`を含むコマンドがブロックされない
- SHELL_BUILTINSに含まれるコマンドはホワイトリストチェックがスキップされる

---

### AC-4: nodeコマンドの動作確認

**テストケース:**
```bash
# testingフェーズ
node test-script.js
node -e "console.log('test')"

# implementationフェーズ
node build-check.js
node scripts/validate.js
```

**成功条件:**
- `node filename.js`形式が実行可能
- `node -e "..."`形式も引き続き動作する

---

### AC-5: PHASE_ORDERの完全性確認

**テストケース:**
```javascript
// phase-edit-guard.js のテスト
const phases = [
  'idle', 'research', 'requirements', 'parallel_analysis',
  'threat_modeling', 'planning', 'parallel_design', 'state_machine',
  'flowchart', 'ui_design', 'design_review', 'test_design',
  'test_impl', 'implementation', 'refactoring', 'parallel_quality',
  'build_check', 'code_review', 'testing', 'regression_test',
  'parallel_verification', 'manual_test', 'security_scan',
  'performance_test', 'e2e_test', 'docs_update', 'commit', 'push',
  'ci_verification', 'deploy', 'completed'
];

assert.deepEqual(PHASE_ORDER, phases);
```

**成功条件:**
- PHASE_ORDERが上記の31要素を含む（19フェーズ + サブフェーズ + idle + completed）
- findNextPhaseForFileType()が正確な次フェーズを返す

---

### AC-6: git -C オプションの動作確認

**テストケース:**
```bash
# 各フェーズで以下が可能
git -C /path/to/subdir status
git -C ./submodule log
git --git-dir=/path/.git log
git -c user.name="Test" log
```

**成功条件:**
- 全てのgitコマンドが正しくホワイトリストマッチする
- normalizeGitCommand()により`git -C`が`git`に正規化される

---

### AC-7: stderr出力の確認

**テストケース:**
```bash
# コミットブロック時
# ブロックメッセージがstderrに出力されることを確認
git commit -m "test" 2>&1 | grep "COMMIT BLOCKED"
```

**成功条件:**
- ブロックメッセージがstderrに出力される（stderr redirectで取得可能）
- Claude Codeのターミナルでメッセージが表示される
- 出力内容は変更されない

---

### AC-8: architecture_review削除の確認

**テストケース:**
```bash
# コードベースからarchitecture_reviewの参照を検索
git grep 'architecture_review' workflow-plugin/hooks/
# → 結果が0件であること
```

**成功条件:**
- enforce-workflow.js、phase-edit-guard.jsにarchitecture_reviewの参照が存在しない
- 既存の19フェーズの動作に影響がない

---

## 関連ドキュメント

| ドキュメント | 説明 |
|-------------|------|
| `docs/workflows/ワ-クフロ-プロセス阻害要因解消/research.md` | 調査結果（D-1～D-8の問題分析） |
| `workflow-plugin/hooks/bash-whitelist.js` | Bashコマンドホワイトリスト（FR-1～FR-4、FR-6の修正対象） |
| `workflow-plugin/hooks/phase-edit-guard.js` | フェーズ編集ガード（FR-5、FR-7の修正対象） |
| `workflow-plugin/hooks/enforce-workflow.js` | ワークフロー強制フック（FR-8の修正対象） |
| `CLAUDE.md` | ワークフロー仕様書（19フェーズの定義） |

---

## 用語集

| 用語 | 定義 |
|------|------|
| verificationPhases | 検証フェーズのグループ（regression_test、ci_verificationを含む） |
| deployPhases | デプロイフェーズのグループ（deployを含む） |
| SHELL_BUILTINS | シェル組み込みコマンドのリスト（true、false、exit等） |
| normalizeGitCommand | gitコマンドから`-C`等のオプションを除去して正規化する関数 |
| PHASE_ORDER | フェーズの順序を定義する配列（findNextPhaseForFileType用） |
| displayBlockMessage | コミットブロック時のメッセージを表示する関数 |
| PHASE_EXTENSIONS | フェーズごとの編集可能拡張子を定義するマップ |

---

## 次フェーズへの引き継ぎ

**planning フェーズで必要な情報:**
- 各要件（FR-1～FR-8）の具体的な実装手順の詳細化
- bash-whitelist.js、phase-edit-guard.js、enforce-workflow.jsの変更箇所の特定（行番号、関数名）
- 実装優先順位の決定（Critical → High → Lowの順で実装）
- テストケースの実装方法と実行手順の策定
- 各修正のリスク評価と影響範囲の分析

**実装優先順位:**
1. FR-1、FR-2（ci_verification、deployフェーズの有効化）- Critical、プロセス停止の解消
2. FR-3、FR-4（SHELL_BUILTINS、node単体許可）- Critical、コマンド実行の基本機能
3. FR-5（PHASE_ORDER拡張）- High、ガイダンスメッセージの正確性向上
4. FR-6（git -C対応）- High、gitコマンドの柔軟性向上
5. FR-7（stderr出力）- High、エラー表示の標準化
6. FR-8（architecture_review削除）- Low、コードベース整合性向上

**リスク:**
- bash-whitelist.jsの変更により、意図しないコマンドが許可されるセキュリティリスク（NFR-4で対応）
- SHELL_BUILTINSの定義漏れにより、必要なシェルイディオムがブロックされるリスク
- normalizeGitCommand()の正規化処理のバグにより、不正なgitコマンドがホワイトリストを迂回するリスク
- PHASE_ORDERの順序誤りにより、ガイダンスメッセージが誤った情報を表示するリスク
- console.errorへの変更により、Claude Codeでのエラー表示が機能しなくなるリスク（要動作確認）

**依存関係:**
- 全ての修正は Git pre-commit hookの仕組みに依存する
- bash-whitelist.jsの修正は getWhitelistForPhase()、checkCommand()、splitCompoundCommand() の各関数に依存
- phase-edit-guard.jsの修正は PHASE_ORDER配列と displayBlockMessage()関数に依存
- MCPサーバーのフェーズ定義との整合性確認が必要（特にPHASE_ORDER拡張時）
