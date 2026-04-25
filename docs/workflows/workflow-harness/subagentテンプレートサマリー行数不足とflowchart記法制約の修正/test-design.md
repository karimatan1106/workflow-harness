## サマリー

本ドキュメントは、ワークフロープラグインに対する3修正（サマリーテンプレート拡張、flowchart記法制約追加、memory/パターン追加）の検証方針とテストケースを定義する。

- 目的: 3修正が仕様どおりに実装されていることをTDDサイクルで確認するためのテスト設計を提供する。
- 評価スコープ: 対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` と `workflow-plugin/hooks/enforce-workflow.js` の2ファイルに限定される。テスト配置先は `workflow-plugin/mcp-server/src/phases/__tests__/` 配下の既存テストファイル群と並置する。
- 主要な決定事項: 修正1と修正2aはユニットテスト（vitest）で自動検証し、修正2b/2cはコードレビューでの目視確認とし、修正3はユニットテストで自動検証する設計を採用した。既存の `definitions.test.ts` に追記するアプローチで新規ファイル作成を最小化する。
- 検証状況: この段階はテスト設計フェーズのみであり、実際のテスト実装はtest_implフェーズで行われる。テストの合否はtestingフェーズで確認される。
- 次フェーズで必要な情報: test_implフェーズでは本ドキュメントのテストケース一覧を参照してテストコードを実装すること。修正1のテストは `buildPrompt()` の戻り値にサマリーテンプレートの5項目が含まれることを文字列検索で確認する。修正3のテストは `isWorkflowConfigFile()` 関数にmemory/パスを渡してtrueが返ることを確認する。

## テスト方針

本タスクにおけるテスト方針は以下のとおりである。

### TDDサイクルの適用

test_implフェーズで先にテストコードを記述し（Red）、implementationフェーズで実装が通る状態（Green）に仕上げる。
修正対象がすでに挙動として定まっているため、テストケースは仕様から直接導出できる。
テストファイルの配置は既存テストスイートと同じディレクトリに統一し、独立したファイルとして追加する。

### テスト種別の選択根拠

修正1はdefinitions.tsの文字列テンプレートの内容変更であり、`buildPrompt()` 関数の出力を検証するユニットテストが適切である。
修正2aも同じ関数の出力を検証するユニットテストで対応できる。
修正3はenforce-workflow.jsの配列に正規表現パターンを追加する変更であり、`isWorkflowConfigFile()` 関数のユニットテストが適切である。
修正2b/2cはMarkdown文書の例示変更であり、バリデーターが検査しないため、目視によるコードレビューで確認する。

### テストファイルの配置

- 修正1・2aのテスト: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-prompt-template.test.ts`（新規作成）
- 修正3のテスト: `workflow-plugin/mcp-server/src/phases/__tests__/enforce-workflow-patterns.test.ts`（新規作成）

ファイル名を既存の `definitions.test.ts` とは別にする理由として、今回追加するテストは本タスク固有の新規検証であり、既存テストとのコンテキスト分離が保守性を高めるためである。

### 境界値とエラーハンドリング

修正1は「5項目が存在するか」という文字列包含テストであり、境界値は項目数の最小要件（5項目）である。
修正3は正規表現パターンマッチングの境界値テストとして、Windowsパス区切り文字とUnixパス区切り文字の両方を検証する。

## テストケース

### グループA: 修正1 — サマリーテンプレート5項目の検証

修正対象: `workflow-plugin/mcp-server/src/phases/definitions.ts` 行1251の `importantSection +=` の文字列リテラル。
テスト目的: buildPromptが出力するプロンプトに、5つの箇条書き項目が正しく含まれているかを確認する。

#### TC-A-1: 「評価スコープ」項目が出力に含まれること

テストID: TC-A-1
テスト種別: ユニットテスト
実行方法: `buildPrompt(guide, docsDir)` の戻り値を文字列として取得し、「評価スコープ」という文字列が含まれることをアサートする。
期待結果: `expect(prompt).toContain('評価スコープ')` がパスすること。
前提条件: `buildPrompt` に渡す `guide` はresearchフェーズのPhaseGuideを使用し、`docsDir` には任意の文字列（例示用のパス）を渡す。

#### TC-A-2: 「検証状況」項目が出力に含まれること

テストID: TC-A-2
テスト種別: ユニットテスト
実行方法: `buildPrompt(guide, docsDir)` の戻り値に「検証状況」という文字列が含まれることをアサートする。
期待結果: `expect(prompt).toContain('検証状況')` がパスすること。
前提条件: TC-A-1と同一のguide設定を使用する。

#### TC-A-3: 「目的」「評価スコープ」「主要な決定事項」「検証状況」「次フェーズで必要な情報」の5項目が全て含まれること

テストID: TC-A-3
テスト種別: ユニットテスト
実行方法: `buildPrompt(guide, docsDir)` の戻り値に5つの文字列が全て含まれることをアサートする。
期待結果: 5つの `toContain` アサートが全てパスすること（目的、評価スコープ、主要な決定事項、検証状況、次フェーズで必要な情報）。
前提条件: TC-A-1と同一の設定を使用する。

#### TC-A-4: 修正前の3項目構成から拡張されていること（リグレッション防止）

テストID: TC-A-4
テスト種別: ユニットテスト
実行方法: サマリーセクション内の箇条書き行数を数え、3項目のみの構成に戻っていないことを確認する。
期待結果: 「評価スコープ」と「検証状況」が同時に存在することで3項目構成への退行がないことを確認できる。
前提条件: TC-A-3と同一の設定を使用する。

### グループB: 修正2a — flowchart記法制約行の検証

修正対象: `workflow-plugin/mcp-server/src/phases/definitions.ts` 行1182の直後に追加される1行。
テスト目的: buildPromptの出力に、丸括弧形式を使うよう指示する制約行が含まれているかを確認する。

#### TC-B-1: flowchart丸括弧形式制約の文字列が含まれること

テストID: TC-B-1
テスト種別: ユニットテスト
実行方法: `buildPrompt(guide, docsDir)` の戻り値に「丸括弧形式」という文字列が含まれることをアサートする。
期待結果: `expect(prompt).toContain('丸括弧形式')` がパスすること。
前提条件: 任意のフェーズのPhaseGuideを使用する。サマリーセクションのほかMermaid図制約セクションを出力するフェーズ（例：state_machineフェーズ）を選択する。

#### TC-B-2: 角括弧形式禁止の記述が含まれること

テストID: TC-B-2
テスト種別: ユニットテスト
実行方法: `buildPrompt(guide, docsDir)` の戻り値に「角括弧形式は」という文字列が含まれることをアサートする。
期待結果: `expect(prompt).toContain('角括弧形式は')` がパスすること。
前提条件: TC-B-1と同一の設定を使用する。

#### TC-B-3: 既存のMermaid構造検証ルール行が引き続き存在すること（リグレッション防止）

テストID: TC-B-3
テスト種別: ユニットテスト
実行方法: `buildPrompt(guide, docsDir)` の戻り値に「stateDiagram-v2では開始・終了に名前付き状態」という文字列が含まれることをアサートする。
期待結果: `expect(prompt).toContain('名前付き状態')` がパスすること。修正2aの行追加により既存行が削除されていないことを確認する。
前提条件: TC-B-1と同一の設定を使用する。

### グループC: 修正2b/2c — CLAUDE.md例示の目視確認（手動）

修正対象: プロジェクトルートの `CLAUDE.md` と `workflow-plugin/CLAUDE.md` の「図式設計」セクション内のflowchart例示。
テスト目的: 例示コードの角括弧形式ノードが丸括弧形式に変更されていることを確認する。

#### TC-C-1: CLAUDE.mdのflowchart例示が丸括弧形式になっていること（目視確認）

テストID: TC-C-1
テスト種別: コードレビュー（手動確認）
確認方法: CLAUDE.mdの「図式設計」セクションのflowchart例示コードを読み、`A[開始]` や `C[処理A]` の形式が `A(開始)` や `C(処理A)` の形式に変更されていることを確認する。
期待結果: flowchart TDブロック内の全ノード定義が丸括弧形式であること。条件分岐ノードは菱形形式として許容する。
確認担当: code_reviewフェーズの担当エージェント。

#### TC-C-2: workflow-plugin/CLAUDE.mdのflowchart例示が丸括弧形式になっていること（目視確認）

テストID: TC-C-2
テスト種別: コードレビュー（手動確認）
確認方法: `workflow-plugin/CLAUDE.md` の同セクションを確認し、TC-C-1と同様の変更がされていることを確認する。
期待結果: TC-C-1と同様に全ノードが丸括弧形式であること。
確認担当: code_reviewフェーズの担当エージェント。

### グループD: 修正3 — enforce-workflow.jsパターン追加の検証

修正対象: `workflow-plugin/hooks/enforce-workflow.js` の `WORKFLOW_CONFIG_PATTERNS` 配列への5番目パターン追加。
テスト目的: `isWorkflowConfigFile()` 関数が、memory/ディレクトリ配下のファイルに対してtrueを返すことを確認する。

#### TC-D-1: Unixパス区切りのmemory/パスでtrueを返すこと

テストID: TC-D-1
テスト種別: ユニットテスト（Node.js/vitest）
実行方法: `isWorkflowConfigFile()` 関数をモジュールからインポートし、Unixパス形式の引数を渡す。
入力値: `.claude/projects/my-project/memory/MEMORY.md`（Unixパス区切り）
期待結果: 関数の戻り値が `true` であること。
前提条件: enforce-workflow.jsがESモジュールまたはCommonJSとして正しくインポートできること。

#### TC-D-2: Windowsパス区切りのmemory/パスでtrueを返すこと

テストID: TC-D-2
テスト種別: ユニットテスト
実行方法: TC-D-1と同じ関数に、バックスラッシュを含むパスを渡す。
入力値: `.claude\\projects\\my-project\\memory\\MEMORY.md`（Windowsパス区切り）
期待結果: 関数の戻り値が `true` であること。
前提条件: 関数内でパス正規化（replace処理）が行われていることを前提とする。

#### TC-D-3: 任意のプロジェクト名でmemory/パスがマッチすること

テストID: TC-D-3
テスト種別: ユニットテスト
実行方法: TC-D-1と同じ関数に、プロジェクト名が異なる複数のパスを渡す。
入力値（複数）: `.claude/projects/another-project/memory/notes.txt` および `.claude/projects/Cツール-Workflow/memory/MEMORY.md`
期待結果: 全ての入力値でtrueを返すこと。
前提条件: 正規表現の `[^\/\\]+` 部分が任意のプロジェクト名にマッチすることを確認する。

#### TC-D-4: memory/パターンに該当しないパスでfalseを返すこと（異常系）

テストID: TC-D-4
テスト種別: ユニットテスト
実行方法: memory/ディレクトリを含まないパスを渡し、パターンに誤りがないことを確認する。
入力値（複数）: `.claude/projects/my-project/docs/NOTES.md` および `/home/user/documents/memory/file.txt`（.claude/projects/以下でない）
期待結果: これらのパスに対してfalseを返すこと（他のパターンにもマッチしない前提）。
前提条件: 既存4パターンにもマッチしないパスを選定すること。

#### TC-D-5: 既存パターン（workflow-state.jsonなど）が引き続き機能すること（リグレッション防止）

テストID: TC-D-5
テスト種別: ユニットテスト
実行方法: 既存パターンにマッチする各パスを渡し、trueを返すことを確認する。
入力値（複数）: `workflow-state.json`、`.claude/settings.json`、`.claude/state/task-index.json`、`.claude-phase-guard-log.json`
期待結果: 全ての入力値でtrueを返すこと（既存パターンが削除されていないことの確認）。
前提条件: 修正3はパターンを追加するのみで既存エントリを削除しないことが前提である。

## テスト実装ガイダンス

### テストファイルの骨格

修正1・2aのテストは以下のファイルに記述する。

- ファイルパス: `workflow-plugin/mcp-server/src/phases/__tests__/definitions-prompt-template.test.ts`
- インポート対象: `buildPrompt` 関数および `PHASE_GUIDES` から任意フェーズのガイドをインポートする。
- テストフレームワーク: vitest（既存テストスイートと同一のフレームワークを使用する）。

修正3のテストは以下のファイルに記述する。

- ファイルパス: `workflow-plugin/mcp-server/src/phases/__tests__/enforce-workflow-patterns.test.ts`
- インポート対象: enforce-workflow.jsは現状CommonJSまたはESM非エクスポートの可能性があるため、`createRequire` または動的インポートを使用してモジュールをロードし、`isWorkflowConfigFile` 関数を取り出す。
- 代替案: 関数が直接エクスポートされていない場合は、パターン配列をファイルから抽出してNode.jsの正規表現テストを直接実行する形式に切り替える。

### 注意事項

buildPrompt関数の呼び出しにはPhaseGuideオブジェクトと docsDir 文字列が必要である。
PHASE_GUIDESの既存エントリから `resolvePhaseGuide('research', 'docs/workflows/test')` を呼んで得られるguideを使うと実装が簡潔になる。
enforce-workflow.jsはMCPサーバーのTypeScriptではなくNode.js直接実行のJavaScriptであるため、インポート方法に注意すること。
テスト実行コマンドは `cd workflow-plugin/mcp-server && npx vitest run src/phases/__tests__/` とすること。

## 後方互換性の確認観点

既存テストスイート（`definitions.test.ts` など）が全てパスし続けることを確認する。
修正1のテンプレート変更は他のフェーズの動作に影響しないことを確認する（サマリーテンプレートは全フェーズ共通のため、どのフェーズのguideで呼んでもテンプレートに5項目が含まれることを期待する）。
修正2aの行追加はMermaid構造検証ルールのセクション内に追加されるため、既存のstateDiagram-v2関連アサートへの影響がないことを確認する。
修正3の配列追加は既存4パターンを変更しないため、既存パターンへの影響がないことをTC-D-5で確認する。
