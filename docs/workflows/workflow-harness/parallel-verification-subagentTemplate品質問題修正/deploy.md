# deployフェーズ成果物

## サマリー

本フェーズではコミット 526a1d6「feat: update workflow-plugin submodule for FR-1~FR-4 validation failure prevention guidance」が正常にプッシュされていることを確認した。

MCPサーバーの最新コードが GitHub の main ブランチに反映済みであり、ローカル開発環境がプッシュのタイミングで古いキャッシュを保持しないよう再起動手順を記録した。

本変更は parallel_verification フェーズのサブエージェントテンプレート品質問題の根本修正を含むもので、サブフェーズプロンプトの品質ガイダンスの充実により、以後のワークフロー実行でバリデーション失敗が軽減されることを期待している。

## デプロイ確認結果

### Git ブランチ確認
- リポジトリ: C:\ツール\Workflow（親リポジトリ）
- 現在のブランチ: main
- ブランチ状態: origin/main と同期済み（Your branch is up to date with 'origin/main'）

### 最新コミット確認
プッシュ完了済みのコミット:
- 526a1d6: feat: update workflow-plugin submodule for FR-1~FR-4 validation failure prevention guidance
- 194fb1b: feat: add ユーザー意図との整合性 as required section in code_review phase
- 33f4533: feat: add workflow_get_subphase_template MCP tool and update docs

これらのコミットは全て GitHub の main ブランチに正常に反映されており、pull リクエスト・マージプロセスを経て本流に統合されている。

### 変更内容の概要
本タスク「parallel-verification-subagentTemplate品質問題修正」では、parallel_verification フェーズのサブエージェントテンプレート（manual_test, security_scan, performance_test, e2e_test）に対し、バリデーション品質ガイダンスを強化した。

具体的には以下の改善を実施している：
1. 各サブフェーズの必須セクション定義の明確化
2. Markdown 本文内での角括弧プレースホルダー禁止ルールの強調
3. コードフェンス内での正規表現記述については許可する旨の追記
4. 行数・密度要件の詳細基準の統一

## 運用手順

### MCPサーバー再起動ガイダンス

**重要**: workflow-plugin サブモジュール内のコアファイル（definitions.ts, artifact-validator.ts, state-manager.ts）が更新された場合、MCPサーバーは Node.js のモジュールキャッシュに古いコンパイル結果を保持し続ける。

#### 再起動が必須となる条件
以下のファイルが更新された場合、MCPサーバーの再起動が必須である：
- workflow-plugin/mcp-server/src/artifact-validator.ts
- workflow-plugin/mcp-server/src/definitions.ts
- workflow-plugin/mcp-server/src/state-manager.ts

本タスク「parallel-verification-subagentTemplate品質問題修正」では definitions.ts が更新されているため、再起動手順の実行が推奨される。

#### 再起動手順（4ステップ）

**第1ステップ: TypeScript トランスパイル**

```bash
cd workflow-plugin/mcp-server
npm run build
```

コマンド実行後、src/*.ts ファイルが dist/*.js にコンパイルされる。ファイル更新日時を確認し、dist/artifact-validator.js, dist/definitions.js の timestamp が現在時刻付近であることを確認する。

**第2ステップ: MCPサーバープロセス終了**

Claude Desktop のサーバー管理画面からワークフロープラグインのサーバーを停止するか、または以下コマンドでプロセスを終了する：

```bash
pkill -f "workflow-plugin"
```

Windows 環境の場合、Task Manager から node.exe プロセスを検索し、該当プロセスを終了する。

**第3ステップ: MCPサーバー再起動**

Claude Desktop の設定画面でワークフロープラグインを再度起動する、または以下コマンドでサーバーを起動する：

```bash
cd workflow-plugin/mcp-server
npm start
```

サーバーのコンソール出力で「listening on」メッセージが表示されたら、再起動完了である。

**第4ステップ: 現在フェーズ確認**

MCPサーバー再起動後、以下コマンドで現在のタスク・フェーズが正常に読み込まれていることを確認する：

```bash
workflow status
```

コマンドレスポンスに現在のフェーズ（例: deploy, completed）が表示されれば、再起動成功である。

### 環境への影響

本タスクの変更は以下のシステムに影響を与える：
1. ワークフロー実行時のサブエージェントプロンプト生成ロジック
2. 各フェーズの成果物バリデーションルール（validator）
3. 既存のタスク・フェーズ状態には影響なし

ワークフロー実行中のタスクは手作業で中断される恐れがないため、本デプロイ直後の新規タスク開始から改善効果が期待できる。

### 検証ポイント

デプロイ後の検証項目：
- 新規タスク開始時に `/workflow start <タスク名>` が正常に実行されること
- parallel_verification フェーズでのサブエージェント起動が成功すること
- 各サブフェーズ（manual_test, security_scan, performance_test, e2e_test）の成果物がバリデーション要件を満たすこと
- 角括弧プレースホルダー違反に関するエラーが以前より減少することを確認すること

### ロールバック手順

万が一、新しいバージョンで問題が発生した場合の対応：

```bash
git revert 526a1d6
cd workflow-plugin/mcp-server
npm run build
# MCPサーバー再起動（第2-3ステップ参照）
```

このコマンドでコミット 194fb1b の状態に戻す。その後、MCPサーバーを再起動して旧バージョンが読み込まれることを確認する。

