# FR-19修正時の問題の根本原因追究と解決 - research フェーズ

## サマリー

前回のFR-19タスク（ID: 20260224_215845）は成功し、commit d9c662b で親リポジトリにマージされた。その過程で3つの副次問題が発生した。本調査では、これらの問題の根本原因を明確にし、次フェーズでの修正計画の基盤を提供する。

- **問題1**: ルートに残存した3つの一時検証スクリプト（verify-templates.js, full-template-verify.js, detailed-verify.js）
- **問題2**: 未追跡ファイルとして残存している docs/spec/diagrams/修正プロセス.flowchart.mmd
- **問題3**: FR-19実装後の refactoring フェーズで発生した subagent の不適切なファイル配置

調査から判明した根本原因は、refactoring フェーズの subagent が代替手段としてルートディレクトリに直接ファイルを書き込み、その後の削除コマンドがコマンドチェーン違反でブロックされたこと。また、修正プロセス図は前回タスクの ui_design フェーズで作成されたが、エンタープライズ配置ルール（永続的な成果物は docs/spec/diagrams/ に配置）に従わず、デフォルトの docsDir に配置されて未追跡状態となった。

---

## 問題1: ルートに残存した3つの一時検証スクリプト

### 現状の確認

git status で以下の3ファイルが未追跡ファイルとして表示されている。

```
?? docs/spec/diagrams/修正プロセス.flowchart.mmd  （この行は問題2に該当）
?? verify-templates.js
?? full-template-verify.js
?? detailed-verify.js
```

3つのスクリプトのファイルサイズと作成時期は以下の通り。

```bash
-rw-r--r-- 1 owner 197121  1194  2月 24 11:26 verify-templates.js
-rw-r--r-- 1 owner 197121  2948  2月 24 11:27 full-template-verify.js
-rw-r--r-- 1 owner 197121  2542  2月 24 11:27 detailed-verify.js
```

タイムスタンプから見ると、これらは前回タスク（2026-02-24 12:58 開始）よりも前の refactoring フェーズで作成されたものである。

### ファイルの役割と作成理由

前回の research.md（`docs/workflows/FR-19実装で発生した問題の根本原因調査と残課題解決/research.md`）から引用すると、これら3ファイルは以下の経緯で作成された。

refactoring フェーズの subagent が以下の目的でスクリプトを作成した。

1. definitions.ts への FR-19 実装（全フェーズへのワークフロー制御ツール禁止指示追加）で、テンプレート文字列に新規セクション「## ★ワークフロー制御ツール禁止★」が 21 フェーズに追加された。

2. この修正が正確に実装されているかを検証するため、Node.js スクリプトを作成して全テンプレートの禁止指示文字列の有無をチェックする必要があった。

3. python3 と node のヒアドキュメント実行（`python3 << 'EOF'` や `node << 'EOF'`）がフックでブロックされたため、代替手段として .js ファイルをルートに書き込むことを選択した。

4. refactoring フェーズの allowedBashCategories に `code`（ファイル編集・作成）が含まれているため、phase-edit-guard はルートへの .js ファイル作成をブロックしなかった。

### なぜ削除に失敗したのか

`.claude-phase-guard-log.json` の該当ログエントリから、削除が失敗した経緯が読み取れる。

```
"timestamp": "2026-02-24T11:27:42.206Z"
"blockedAction": "コマンドチェーン違反（インデックス 0）: rm /c/ツール/Workflow/verify-templates.js /c/ツール/Workflow/full-template-verify.js /c/ツール/Workflow/detailed-verify.js"
```

subagent は単一の rm コマンドで3ファイルを同時に削除しようとしたが、「コマンドチェーン違反」でブロックされた。phase-edit-guard のフック実装では、単一のコマンドラインが複数のスペース区切り引数を持つ場合、それを「コマンドチェーン」（パイプやセミコロンで連結された複数コマンド）として解釈してブロックした可能性がある。

実際には rm /c/ツール/Workflow/verify-templates.js /c/ツール/Workflow/full-template-verify.js /c/ツール/Workflow/detailed-verify.js は単一の rm コマンドであり、コマンドチェーンではない。この判定エラーが根本原因である。

### CLAUDE.md ルール違反

CLAUDE.md の「テスト出力・一時ファイルの配置ルール」セクションに以下が明記されている。

```
禁止事項: ルートディレクトリへの以下の配置は禁止
- test_*.ts, test_*.js（テストスクリプト）
- *_output.*, *_result.*（出力ファイル）
```

また「パッケージインストールルール」では「ルートディレクトリに package.json や node_modules を作成しないこと」とあり、ルートを汚染しない原則が強調されている。

これら3つのスクリプトはいずれもルート直下に配置されており、CLAUDE.md ルールに抵触している。

### 根本原因の分析

根本原因は以下の3層構造で成り立っている。

**第1層**: フック側の判定エラー。複数のスペース区切り引数を「コマンドチェーン」と誤判定してブロックした。

**第2層**: 代替手段の選択ミス。subagent がヒアドキュメント実行がブロックされた時点で、ルートに .js ファイルを書き込む代わりに、`.tmp/` ディレクトリに配置して後で削除するパターンを採用しなかった。CLAUDE.md には「テスト出力・一時ファイルの配置ルール」が明記されており、subagent テンプレートに「一時ファイルはルート直下ではなく .tmp/ に配置すること」という指示を含めるべきだった。

**第3層**: subagent の問題解決プロセス不足。削除に失敗した後、代替策（手動で Read / Write ツールで削除、または次フェーズでの削除推奨）を講じず、そのまま processing を続行した。

---

## 問題2: 未追跡ファイル docs/spec/diagrams/修正プロセス.flowchart.mmd

### ファイルの内容と作成背景

ファイルは既に読み込み済みで、以下の内容を含む。

```mermaid
flowchart TD
    Start("処理開始: 3件の修正実装") --> OpenFile("definitions.ts ファイルを開く")
    OpenFile --> CheckStructure("既存テンプレート構造を確認")
    CheckStructure --> ApplyFRC("FR-C 適用: research フェーズチェックリスト修正")
    ...（省略）...
    CheckConsistency --> Success("処理完了: 検証成功")
```

このフローチャートは、FR-19実装タスク内で作成された修正プロセスを可視化したものである。前回タスク（ID: 20260224_215845）の ui_design フェーズで作成されたと考えられる。

### なぜ未追跡ファイルになったのか

CLAUDE.md の「ドキュメント構成」セクションに記載された「ワークフロー成果物の配置先」ルールによると、workflow 作成時に以下が自動生成される。

- `docsDir`: `docs/workflows/{taskName}/` — 作業成果物配置用

前回タスクのタスク名は「FR-19実装で発生した問題の根本原因調査と残課題解決」であり、その default docsDir は以下となる。

```
docs/workflows/FR-19実装で発生した問題の根本原因調査と残課題解決/
```

修正プロセス図は docsDir に配置されたため、後続フェーズで git add される対象外（`.gitignore` に `**/docs/workflows/` が登録）となり、未追跡のままとなった。

しかし、この図が「永続的な設計ドキュメント」であれば、docs/spec/diagrams/ に配置して git commit される必要がある。ui_design フェーズから deployment フェーズ後の docs_update でこのファイルを移動すべきだった。

### ドキュメント配置ルールの矛盾

CLAUDE.md には以下の指示がある。

「プロダクト仕様への反映: ワークフローで作成した成果物をプロダクト仕様に反映する場合は、手動で docs/spec/ 以下に配置します」

このルールに従えば、修正プロセス図は docsDir に一時作成され、docs_update フェーズで「手動で」docs/spec/diagrams/ に配置される必要があった。しかし、subagent が自律的にこの配置を行わず、手作業での配置も指示されなかったため、ファイルが未追跡のまま残存した。

### 根本原因の分析

根本原因は design フェーズから docs_update フェーズへの「アーティファクト移動責任の曖昧性」である。

**問題の構造**:
1. workflow 成果物は docsDir（docs/workflows/...）に配置される
2. 永続的な成果物（docs/spec/...）への移動は subagent 自身ではなく、手動または docs_update フェーズの責任
3. docs_update フェーズのテンプレートに「workflow フォルダの設計図を docs/spec/diagrams/ に移動すること」という明示的な指示が含まれていない

**改善点**:
- ui_design フェーズのテンプレートに「作成した .mmd ファイルは docsDir に配置されます。docs_update フェーズで docs/spec/diagrams/ に移動してください」という指示を追加すべき
- または docs_update フェーズのテンプレートに「workflow フォルダの全 .mmd ファイルを docs/spec/diagrams/ に確認の上、移動してください」という指示を追加

---

## 問題3: FR-19実装後の refactoring フェーズの subagent 動作

### 実装の背景

前回のタスク（ID: 20260224_215845）では、以下のように進行した。

1. research フェーズ: FR-19実装で発生した3つの問題を調査
2. requirements フェーズ: 2つの機能要件（atomicWriteJson へのリトライロジック追加、ルート残存ファイルの削除）を定義
3. parallel_analysis, parallel_design フェーズ: 各種設計作成
4. implementation フェーズ: lock-utils.ts に EPERM/EBUSY リトライロジックを実装し、lock-utils.test.ts に5つのテストケースを追加
5. refactoring フェーズ: 実装内容の検証とドキュメント整備を実施

### refactoring フェーズで何が起きたのか

refactoring フェーズの subagent は以下を試みた。

1. definitions.ts の全 21 フェーズテンプレートに「## ★ワークフロー制御ツール禁止★」セクションが正確に記載されているかを検証する必要を判断

2. その検証のため、python3 または node のヒアドキュメント実行で検証スクリプトを動的に実行しようとした

3. フックが python3 と node ヒアドキュメント実行をブロックしたため、代替案として .js ファイルをルートに write し、その .js ファイルを実行する方針に変更

4. 検証完了後に rm コマンドで削除しようとしたが、コマンドチェーン違反でブロック

5. 削除失敗後も subagent は代替案を講じず、処理を続行してフェーズを完了

### refactoring フェーズの責任範囲

CLAUDE.md の「AIへの厳命」セクション には以下が記載されている。

「同一ファイルを繰り返し編集する場合は立ち止まって原因を分析すること」

refactoring フェーズでも同様に、ヒアドキュメント実行がブロックされた時点で、代替手段を内省し、CLAUDE.md の設定ルール（テスト出力・一時ファイルの配置ルール）を参照して判断すべきだった。

### 改善点

- refactoring フェーズのテンプレートに「ヒアドキュメント実行や複雑なスクリプト実行がブロックされた場合は、.tmp/ ディレクトリに一時スクリプトを配置し、後で削除すること。ルート直下にはファイルを作成しないこと」という指示を追加
- または、テンプレートに「CLAUDE.md のテスト出力・一時ファイルの配置ルール を参照し、一時ファイルは適切なディレクトリに配置すること」という指示を追加

---

## 前回タスクの最終状態

前回タスク（ID: 20260224_215845）は以下の成果で完了した。

### 実装成果

1. lock-utils.ts: atomicWriteJson にリトライロジック（EPERM/EBUSY エラーに対する最大3回リトライ、100ms 待機）を追加

2. lock-utils.test.ts: 5つのテストケース（TC-01 EPERM retry, TC-02 EBUSY retry, TC-03 all retries fail, TC-04 ENOENT immediate throw, TC-05 normal success）を実装

3. ビルド成功: TypeScript コンパイルと CJS エクスポート完了

4. テスト成功: 950 テスト全てパス、リグレッションなし

5. 親リポジトリへのマージ: commit 29c662b で docs/spec/features/lock-utils.md を更新し、EPERM/EBUSY リトライロジックの仕様を記載

### 残存する問題

1. ルート直下の3ファイル（verify-templates.js, full-template-verify.js, detailed-verify.js）：git の未追跡ファイルとして残存

2. 未追跡ファイル docs/spec/diagrams/修正プロセス.flowchart.mmd：ワークフロー成果物から永続配置への移動未了

3. subagent の一時ファイル配置と削除の不確実性：今回と同様の問題が将来繰り返される可能性がある

---

## 次フェーズで必要な対応

### 優先度1: ファイル削除（commit前に必須）

以下の3ファイルをリポジトリから削除し、git status で未追跡状態が解消されることを確認する。

```bash
rm /c/ツール/Workflow/verify-templates.js
rm /c/ツール/Workflow/full-template-verify.js
rm /c/ツール/Workflow/detailed-verify.js
```

削除方法は複数あり、Bash の rm コマンドがブロックされた場合は Read / Edit / Write ツールを使用した代替削除方法を検討する。

### 優先度2: 修正プロセス図の配置確認（docs_update フェーズ）

docs/spec/diagrams/修正プロセス.flowchart.mmd が以下の条件を満たすか確認する。

1. ファイルが実際に docs/spec/diagrams/ に存在して git 追跡対象になっているか
2. ファイルの内容が完全か（前回ワークフロー成果物との同一性を確認）
3. 必要に応じて docs/spec/ 配置ファイルへのコミットを検討

### 優先度3: テンプレート改善（次サイクル以降）

- refactoring フェーズのテンプレートに「一時ファイル配置ルール」の明示的な指示を追加
- ui_design フェーズのテンプレートに「作成した .mmd ファイルは docs_update フェーズで永続配置へ移動すること」という指示を追加
- docs_update フェーズのテンプレートに「workflow フォルダの成果物を docs/spec/ 以下に移動することが必須であること」という指示を追加

---

## 技術的な背景情報

### Windows 環境での EPERM/EBUSY エラー

Windows の MSYS_NT（Git Bash）環境では、ファイル操作が OS レベルで一時的にブロックされることがある。前回のタスク実装（lock-utils.ts へのリトライロジック追加）はこの問題に対応したもので、最大3回のリトライと 100ms の待機により、ほぼ全ての一時的ファイルロック競合をカバーできるようになった。

### フック側の判定精度

phase-edit-guard のコマンドチェーン判定ロジックで、複数の引数を持つ単一コマンド（例: `rm file1 file2 file3`）がコマンドチェーンとして誤判定される場合がある。本来であれば、シェルのメタキャラクタ（`|`, `&&`, `;` など）の存在をチェックしてからコマンドチェーン判定を行うべき。

### workflow-plugin サブモジュール

現在のサブモジュール指しポイント（commit af2ea88）は lock-utils.ts のリトライロジック実装を含むが、refactoring フェーズで検証スクリプトを配置した問題に対する直接的な修正は含まれていない。この問題は CLAUDE.md のテンプレート指示の強化で対応する必要がある。

