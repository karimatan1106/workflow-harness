## サマリー

- 目的: FR-19実装（全フェーズへのワークフロー制御ツール禁止指示追加）完了後に発生した3つの問題を根本原因まで調査し、次フェーズで修正計画を立てるための情報を提供する
- 調査した問題の数と種別: 問題1（EPERM ファイルロックエラー）、問題2（ルートディレクトリへの一時ファイル残存）、問題3（atomicWriteJson のリトライなし設計）の計3問題
- 根本原因の要約: 問題1と問題3は同一の根本原因（atomicWriteJson が renameSync を1回だけ試行し、Windows のファイルロック競合時にリトライしない設計）に起因する。問題2は refactoring フェーズの subagent が python3 と node のヒアドキュメント実行をフックでブロックされた後、ルートに .js ファイルを Write ツールで作成してから実行を試みた際に残存したもの。
- 次フェーズで必要な情報: lock-utils.ts の atomicWriteJson 関数にリトライロジックを追加する修正、ルートの3ファイル（verify-templates.js, full-template-verify.js, detailed-verify.js）の削除、CLAUDE.md への追加ルール記述の要否判断

---

## 問題1: EPERM ファイルロックエラーの根本原因

### エラーの発生状況

ci_verification から deploy への遷移時（1回目の呼び出し）に以下のエラーが発生した。

```
フェーズ遷移に失敗しました: EPERM: operation not permitted,
rename 'C:\ツール\Workflow\.claude\state\workflows\...\workflow-state.json.tmp.69300'
-> '...workflow-state.json'
```

2回目の呼び出しでは成功したため、競合状態（一時的なファイルロック）が原因と考えられる。

### atomicWriteJson の実装

`lock-utils.ts` の `atomicWriteJson` 関数（115〜127行目）は以下のパターンで実装されている。

```typescript
export function atomicWriteJson<T>(filePath: string, data: T): void {
  const tmpFile = `${filePath}.tmp.${process.pid}`;
  try {
    fs.writeFileSync(tmpFile, JSON.stringify(data, null, 2), 'utf-8');
    fs.renameSync(tmpFile, filePath);
  } catch (error) {
    try { fs.unlinkSync(tmpFile); } catch {}
    throw error;
  }
}
```

この実装は renameSync を1回しか試行しない。Windows ではウィルス対策ソフトやウィンドウズエクスプローラーが一時ファイルを瞬間的にスキャンするため、rename 操作が EPERM で失敗することがある。リトライロジックが存在しないため、競合タイミングが重なるとそのまま例外を上位に伝播させてしまう。

### Windows 環境における renameSync の特性

MSYS_NT（Git Bash for Windows）環境では以下の理由で rename 操作が失敗しやすい。

- ウィルス対策ソフトがファイルを瞬間的にロックしてスキャンする
- Windows ファイルシステムではファイルを開いている間は rename が EPERM を返すことがある
- 他のプロセス（エクスプローラー等）がファイルを参照中の場合にも同様の現象が起きる

2回目の呼び出しで成功した事実は、競合が一時的なものだったことを示しており、短時間のリトライで解消できる性質の問題である。

### acquireLockSync との関係

`manager.ts` の `writeTaskState` メソッド（404〜420行目）は、`acquireLockSync` でロックを取得してから `atomicWriteJson` を呼び出す設計になっている。しかし acquireLockSync が保護するのは「ロックファイルの排他制御」であり、実際の rename 操作が OS レベルの一時的なブロックで失敗するケースには対応していない。

### 問題の影響範囲

この問題は Windows 環境のみで発生し、他のフェーズ遷移でも同様に発生しうる。発生頻度は環境に依存するが、ウィルス対策ソフトが有効な環境では再現性がある。Orchestrator が workflow_next を再度呼び出せば成功するため、実運用上の影響は限定的だが、ワークフローが中断するため自動化の妨げになる。

---

## 問題2: ルートディレクトリへの一時ファイル残存

### 残存しているファイル

`git status` で未追跡ファイルとして表示されている3ファイルは以下の通り。

- `C:/ツール/Workflow/verify-templates.js`（50行のNode.jsスクリプト）
- `C:/ツール/Workflow/full-template-verify.js`（105行のNode.jsスクリプト）
- `C:/ツール/Workflow/detailed-verify.js`（92行のNode.jsスクリプト）

### ファイルが作成された経緯

`.claude-phase-guard-log.json` の以下のエントリが経緯を示している。

1. `"timestamp": "2026-02-24T11:26:46.308Z"` — refactoring フェーズで `python3 << 'PYTHON_EOF'` によるヒアドキュメント実行がブロックされた（禁止コマンド: python3）
2. `"timestamp": "2026-02-24T11:26:50.418Z"` — refactoring フェーズで `node << 'EOF'` によるヒアドキュメント実行がブロックされた（コマンドチェーン違反）
3. `"timestamp": "2026-02-24T11:26:55.457Z"` — refactoring フェーズで `/c/ツール/Workflow/verify-templates.js` への書き込みが許可された（code ファイルタイプ）
4. `"timestamp": "2026-02-24T11:27:17.888Z"` — `detailed-verify.js` への書き込みが許可
5. `"timestamp": "2026-02-24T11:27:35.110Z"` — `full-template-verify.js` への書き込みが許可
6. `"timestamp": "2026-02-24T11:27:42.206Z"` — `rm /c/ツール/Workflow/verify-templates.js ...` の実行がブロックされた（コマンドチェーン違反）

### 根本原因

refactoring フェーズの subagent が以下の手順で問題を引き起こした。

ステップ1: python3 とノードのヒアドキュメント実行がブロックされたため、代替手段として .js ファイルをルートに Write ツールで作成した。refactoring フェーズでは `code` ファイルタイプの書き込みが許可されているため、phase-edit-guard はこれをブロックしなかった。

ステップ2: 検証作業が完了した後、rm コマンドで3ファイルを削除しようとしたが、コマンドチェーン違反でブロックされた。refactoring フェーズの allowedBashCategories は `readonly, testing, implementation` であり、`rm` コマンドは implementation カテゴリに属するが、コマンドチェーン（複数ファイルをスペース区切りで指定）がブロックの原因になった可能性がある。

ステップ3: 削除に失敗した状態でフェーズが進行したため、3ファイルがルートに残存した。

### CLAUDE.md ルール違反の確認

CLAUDE.md の「テスト出力・一時ファイルの配置ルール」セクションには以下が記載されている。

禁止事項として「ルートディレクトリへの以下の配置は禁止: test_*.ts, test_*.js（テストスクリプト）」が明記されており、verify-templates.js, full-template-verify.js, detailed-verify.js はこのルールに抵触する。

また「禁止事項」ブロックには「*_output.*, *_result.*（出力ファイル）」の禁止も記載されており、一時検証スクリプトをルートに配置すること自体が設計原則に反している。

加えて CLAUDE.md の「パッケージインストールルール」では「ルートディレクトリに package.json や node_modules を作成しないこと」とあり、ルートを汚染しない原則が強調されている。

### なぜ削除コマンドがブロックされたか

phase-edit-guard のログエントリを詳細に見ると、rm コマンドの失敗理由は「コマンドチェーン違反（インデックス 0）: rm /c/ツール/Workflow/verify-templates.js ...」となっている。これは rm コマンド自体が implementation カテゴリのホワイトリストに含まれているが、複数ファイルをスペース区切りで指定したコマンドが「コマンドチェーン違反」として検出された可能性がある。ただし rm 単体が implementation カテゴリに含まれるかどうかはコマンドホワイトリストの詳細確認が必要である。

---

## 問題3: atomicWriteJson のリトライなし設計の詳細分析

### 現在の実装の問題点

lock-utils.ts の atomicWriteJson（115〜127行目）はリトライなしで renameSync を1回試行するだけである。これは以下の問題を引き起こす。

Windows 環境では OS レベルのファイルロック競合が一時的に発生する場合がある。renameSync が EPERM で失敗するとエラーが即座に上位に伝播され、フェーズ遷移全体が失敗する。Orchestrator はエラーを受け取り、再度 workflow_next を呼び出す必要があるが、これは自動化の観点から設計上の弱点である。

### acquireLockSync との設計上の非対称性

`manager.ts` の acquireLockSync（104〜136行目）はリトライロジックを持ち、maxRetries=10, retryDelay=100ms でリトライする設計になっている。これは「ロックファイルの競合」に対する対策である。

一方、atomicWriteJson の renameSync にはリトライがない。これは設計上の非対称性であり、OS レベルのファイル操作失敗に対する耐障害性が低い。

### 修正の方向性

atomicWriteJson にリトライロジックを追加することで問題を解消できる。具体的には renameSync が EPERM または EBUSY で失敗した場合に短時間待機してリトライする設計が適切である。最大3〜5回のリトライと100〜200ms の待機時間があれば、一時的なファイルロック競合の大半をカバーできる。Atomics.wait()（sleepSync パターン）は既に manager.ts に実装されており、同様のパターンを lock-utils.ts に適用できる。

---

## 問題の分類と修正優先度

### 即座に対応が必要な残課題

問題2（ルートファイル残存）は git の未追跡ファイルとして残っており、commit フェーズで意図せずステージングされる可能性がある。また、将来のタスクで混乱の原因になりうる。これらの3ファイルは機能的には不要であり、次フェーズで削除することが最優先の対応になる。

### 設計改善として対応すべき課題

問題1と問題3（atomicWriteJson のリトライなし）は同一根本原因であり、lock-utils.ts への修正で解消できる。この修正は Windows 環境での信頼性向上に直接寄与する。修正コードは acquireLockSync と同様のリトライパターンを採用することで実装可能である。

### ドキュメント整備として対応すべき課題

CLAUDE.md への追記は、今回と同様の問題（subagent がルートに一時ファイルを作成して削除できず残存させる）を防ぐためのガイダンスとして有用である。refactoring フェーズのテンプレートに「一時検証スクリプトはルート直下ではなく .tmp/ ディレクトリに作成すること」「検証後は Write ツールで空ファイルを書き込んでから git 管理外に配置する等の手段を使うこと」といった具体的な指示を追加することが有効である。

---

## 調査対象ファイルの確認結果まとめ

### state/manager.ts

writeTaskState（404〜420行目）は acquireLockSync でロックを取得後、atomicWriteJson を呼び出す。updateTaskPhase（840〜870行目）も同様のパターンを使用する。どちらも atomicWriteJson の例外を catch せずに上位に伝播させる設計のため、renameSync 失敗がそのままフェーズ遷移失敗につながる。

### state/lock-utils.ts

atomicWriteJson（115〜127行目）はリトライロジックを持たない。acquireLockSync（29〜103行目）はリトライあり（最大3回、指数バックオフ）。この非対称性が問題の根本である。

### ルート残存の3ファイル

verify-templates.js（48行）、full-template-verify.js（105行）、detailed-verify.js（92行）はいずれも Node.js CommonJS スクリプトで、definitions.ts のテンプレートに禁止指示セクションが含まれているかを検証する目的で作成された。これらは検証スクリプトであり、プロダクションコードではない。

### .claude-phase-guard-log.json

直近のログには、refactoring フェーズで python3 ブロック後に .js ファイルをルートに作成し、rm コマンドがブロックされた経緯が時系列で記録されている。この記録から subagent の行動を正確にトレースできた。

### definitions.ts の FR-19 実装状況

ログから implementation フェーズ（2026-02-24 11:17〜11:21）で definitions.ts が16回以上編集されており、FR-19 の実装（全フェーズへのワークフロー制御ツール禁止指示追加）が大規模な変更であったことがわかる。verify-templates.js 等の検証スクリプトはその後の refactoring フェーズで作成されたもの。
