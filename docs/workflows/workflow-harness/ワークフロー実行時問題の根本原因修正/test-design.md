# ワークフロー実行時問題の根本原因修正 - テスト設計書

## サマリー

本テスト設計書は FR-1 から FR-5 の5つの修正要件に対するテストケースを定義する。
修正対象は `CLAUDE.md`（FR-1）と `definitions.ts`（FR-2〜FR-5）の2ファイルである。
テストはすべて実装後の手動確認（grep 確認・ファイル内容検証）として設計する。
主要な決定事項として、TypeScript ユニットテストは不要とし、実ファイルの内容確認を中心とする。
次フェーズ（test_impl）では本設計書に基づくテストコードを作成し、implementation フェーズでの実装後に検証する。
既存テスト 912 件の全件パスをリグレッション確認の最終基準とする。

---

## テストケース一覧

各 FR に対して「変更前の状態確認」と「変更後の期待値確認」をセットとして定義する。

### TC-FR1-1: CLAUDE.md 必須コマンド一覧の変更後確認

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`
**確認方法:** Grep ツールで `workflow approve` を含む行を全件抽出し行数を数える。
**変更後の期待状態:** 以下の4行が全て存在することを確認する。
- `/workflow approve requirements` を含む行が1件存在すること。
- `/workflow approve design` を含む行が1件存在すること。
- `/workflow approve test_design` を含む行が1件存在すること。
- `/workflow approve code_review` を含む行が1件存在すること。
**判定基準:** 合計4行が存在し、それぞれのフェーズ名が正確に記載されていること。

### TC-FR1-2: CLAUDE.md の AIへの厳命7番目の変更後確認

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md`
**確認方法:** Grep ツールで `requirements/design_review/test_design/code_review` を含む行を検索する。
**変更後の期待状態:** 7番目の厳命として4フェーズの承認必要性を明記した行が存在すること。
加えて `workflow_approve type="requirements"` の記述が含まれることを確認する。
**判定基準:** 4フェーズ名が1つの項目内に全て記載されており、各フェーズの呼び出し方が明記されていること。

### TC-FR1-3: CLAUDE.md の承認コマンド記述が REVIEW_PHASES と整合していることの確認

**対象ファイル:** `C:\ツール\Workflow\CLAUDE.md` および `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** definitions.ts の REVIEW_PHASES 配列に含まれる4フェーズ名を Read ツールで確認した後、CLAUDE.md の記述と照合する。
**変更後の期待状態:** REVIEW_PHASES の4フェーズ（requirements・design_review・test_design・code_review）が CLAUDE.md の必須コマンド行にも漏れなく記載されていること。
**判定基準:** コードとドキュメントの一致が確認できること。

### TC-FR2-1: definitions.ts の testing テンプレートに sessionToken 説明が存在することの確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `sessionTokenの取得方法` または `Orchestratorからプロンプトの引数` を含む行を検索する。
**変更後の期待状態:** testing フェーズの `subagentTemplate` 文字列内に sessionToken の取得方法説明が含まれること。
具体的には「OrchestratorからプロンプトのA引数として渡される値」という趣旨の記述が存在すること。
**判定基準:** 878行目付近の testing テンプレートで該当文字列が見つかること。

### TC-FR2-2: testing テンプレートの sessionToken フォールバック記述確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `sessionToken引数を省略` または `subagent自身がMCPツールを呼び出して取得するものではない` に類する記述を検索する。
**変更後の期待状態:** subagent が自力で sessionToken を取得しないことを明示した記述が testing テンプレート内に存在すること。
さらに sessionToken を受け取れなかった場合に引数を省略して呼び出すフォールバック説明が含まれること。
**判定基準:** 取得元の明示とフォールバック説明の両方が testing テンプレートの文字列範囲内に存在すること。

### TC-FR3-1: definitions.ts の testing テンプレートに生出力要件が存在することの確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `100文字以上` を含む行を検索する。
**変更後の期待状態:** testing テンプレート内に「100文字以上の生の標準出力」という要件記述が存在すること。
加えて「要約したり短縮したりした文字列ではなく」という禁止事項も含まれること。
**判定基準:** 100文字以上の要件と加工禁止の両方の記述が testing テンプレートの文字列内で検出されること。

### TC-FR3-2: testing テンプレートへの validateTestAuthenticity 言及確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `validateTestAuthenticity` を含む行を検索し、testing テンプレートの文字列範囲に含まれることを確認する。
**変更後の期待状態:** testing テンプレート内に `validateTestAuthenticity` 検証が実施されることへの言及が存在すること。
**判定基準:** testing フェーズの subagentTemplate 文字列内で1件以上検出されること。

### TC-FR4-1: definitions.ts の testing テンプレートにワークフロー制御ツール禁止指示が存在することの確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `ワークフロー制御ツール禁止` を含む行を検索し、testing テンプレート内の位置を確認する。
**変更後の期待状態:** `## ★ワークフロー制御ツール禁止★` というセクション見出しが testing テンプレートに存在すること。
禁止対象として `workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset` の5ツールが明示されていること。
**判定基準:** セクション見出しと5ツールの列挙が両方とも testing テンプレートの文字列内に含まれること。

### TC-FR4-2: testing テンプレートの Orchestrator 専権事項記述確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `Orchestratorの専権事項` を含む行を testing テンプレートの文字列範囲内で検索する。
**変更後の期待状態:** フェーズ遷移制御が Orchestrator の専権事項であることと、処理完了後に制御を返却することの両方が testing テンプレートに含まれること。
**判定基準:** 2種類の記述が testing テンプレートの文字列範囲内に存在すること。

### TC-FR5-1: definitions.ts の regression_test テンプレートにワークフロー制御ツール禁止指示が存在することの確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** Grep ツールで `ワークフロー制御ツール禁止` の出現位置を全て取得し、testing と regression_test の両テンプレートに存在することを確認する。
**変更後の期待状態:** `## ★ワークフロー制御ツール禁止★` が regression_test テンプレートにも存在し、禁止対象5ツールが明示されていること。
regression_test サブエージェントの責任範囲として「テスト実行と workflow_record_test_result による結果記録のみ」が記載されていること。
**判定基準:** regression_test の subagentTemplate 文字列内で禁止指示と責任範囲記述の両方が検出されること。

### TC-FR5-2: regression_test テンプレートの sessionToken 記述確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** 887行目付近の regression_test テンプレートを Read ツールで読み込み、sessionToken 関連記述の存在を確認する。
**変更後の期待状態:** `sessionTokenの取得方法と使用制限` セクションが regression_test テンプレートに含まれること。
記述内容が FR-2 で testing テンプレートに追記した内容と整合していること（NFR-2 準拠）。
**判定基準:** sessionToken の取得方法と使用制限の両方が regression_test テンプレートで確認できること。

### TC-FR4-FR5-PARITY: FR-4 と FR-5 の禁止指示文言一貫性確認

**対象ファイル:** `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`
**確認方法:** testing テンプレートと regression_test テンプレートの禁止指示セクションを Read ツールで読み出して比較する。
**変更後の期待状態:** 禁止対象5ツールの列挙順序と表現が両テンプレートで完全に一致していること。sessionToken 使用制限の説明文が両テンプレートで同一の表現であること。
**判定基準:** 両テンプレートの禁止指示文言が完全に一致すること。差異がある場合は NFR-2 違反として記録する。

### TC-BUILD-1: npm run build コンパイル成功確認

**対象ディレクトリ:** `C:\ツール\Workflow\workflow-plugin\mcp-server\`
**確認方法:** `npm run build` コマンドを実行し、終了コードが0であることを確認する。
**変更後の期待状態:** TypeScript コンパイルエラーが0件であること。`dist/` ディレクトリ内の `definitions.js` が更新日時の新しいファイルとして存在すること。
**判定基準:** ビルドコマンドが正常終了し、コンパイルエラーメッセージが出力されないこと。

### TC-REGR-1: 既存テスト 912 件の全件パス確認

**対象ディレクトリ:** `C:\ツール\Workflow\workflow-plugin\mcp-server\`
**確認方法:** `npm test` を実行し、全テストが正常終了することを確認する。
**変更後の期待状態:** テスト結果の集計行に passed: 912（またはそれ以上）が表示され、failed が 0 件であること。
**判定基準:** 失敗テストが 0 件であり、既存テスト数が変更前と同等以上であること。

---

## テスト実施手順

### 手順1: 変更前の状態確認（implementation フェーズ開始前）

CLAUDE.md の `workflow approve` 関連行を Grep ツールで確認し、変更前の行数が1行であることを記録する。
definitions.ts の testing テンプレート（878行目付近）を Read ツールで確認し、FR-2〜FR-4 の追記前の末尾文字列を記録する。
definitions.ts の regression_test テンプレート（887行目付近）を Read ツールで確認し、FR-5 の追記前の末尾文字列を記録する。

### 手順2: FR-1 の実装後確認

実装担当者が CLAUDE.md の必須コマンド一覧と AIへの厳命7番目を変更した後に実施する。
TC-FR1-1 の検索コマンドを実行し、4行の承認コマンドが全て存在することを確認する。
TC-FR1-2 の検索コマンドを実行し、4フェーズ名が1つの項目に含まれることを確認する。
TC-FR1-3 の照合を実施し、definitions.ts の REVIEW_PHASES と CLAUDE.md の記述が一致することを確認する。

### 手順3: FR-2〜FR-5 の実装後確認

実装担当者が definitions.ts のテンプレートを変更した後に実施する。
TC-FR2-1 から TC-FR5-2 の各テストケースに記載した Grep 検索を順番に実行する。
各検索で期待する文字列が検出されることを確認し、見つからない場合は実装の修正を依頼する。
TC-FR4-FR5-PARITY の照合を実施し、両テンプレートの禁止指示文言が一致することを確認する。

### 手順4: ビルドと既存テストの実行

`C:\ツール\Workflow\workflow-plugin\mcp-server` ディレクトリで `npm run build` を実行し、TC-BUILD-1 の判定基準を満たすことを確認する。
ビルド成功後に MCP サーバーを再起動し、`npm test` を実行して TC-REGR-1 の判定基準を満たすことを確認する。
テスト結果の標準出力全体を記録し、passed 件数と failed 件数を明記する。

### 手順5: 確認結果の記録

各テストケースの確認結果（合格・不合格）を記録する。
不合格のテストケースが存在する場合は、implementation フェーズへの差し戻しを依頼する。
全テストケース合格後に testing フェーズの成果物として結果を提出する。

---

## リグレッション確認方針

### 変更の影響範囲の評価

FR-1（CLAUDE.md 更新）は実行ロジックに影響しない純粋なドキュメント変更である。
MCP サーバーのテストスイートは CLAUDE.md を参照しないため、FR-1 によるリグレッションリスクは実質ゼロと評価する。

FR-2〜FR-5（definitions.ts の文字列追記）はテンプレート文字列への追記のみであり、既存の関数・クラス・ロジックを変更しない。
テンプレート文字列は `subagentTemplate` プロパティに格納されており、読み取り系のテストが主体である。
追記による文字列の構文破壊（シングルクォートのエスケープ漏れ等）がないかどうかを TC-BUILD-1 で確認する。

### リグレッションとして扱うケース

`npm test` の実行結果で失敗テストが 1 件以上発生した場合は、リグレッション発生として処理する。
失敗テストのファイル名と definitions.ts の変更箇所の依存関係を分析し、今回の変更に起因する失敗かどうかを判定する。
今回の変更（テンプレート文字列追記）に起因する失敗が特定された場合は、実装を修正して再テストを実施する。
今回の変更とは無関係な既存の失敗が確認された場合は `workflow_record_known_bug` で記録し、既知不具合として管理する。

### テスト件数の増減確認

本タスクでは新規テストファイルを追加しないため、テスト件数は 912 件のままであることが期待される。
テスト件数が減少した場合は、削除操作が誤って行われていないかを git diff で確認する。
テスト件数が増加した場合は、テストファイルの誤作成がないかを git status で確認する。

### ベースライン比較の基準

本タスクの testing フェーズでテストを実行した時点の結果を変更後のベースラインとして記録する。
記録には `workflow_capture_baseline` を使用し、totalTests・passedTests・failedTests の3項目を必ず登録する。
regression_test フェーズでは記録したベースラインと比較し、失敗テストが増加していないことを最終確認する。
