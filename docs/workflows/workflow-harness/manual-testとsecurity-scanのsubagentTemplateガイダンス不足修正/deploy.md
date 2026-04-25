# deployフェーズ

## サマリー

前フェーズ（ci_verification）で確認したMCPサーバーの再起動により、FR-11・FR-12のガイダンス更新がメモリに反映されている状態にある。本フェーズでは、MCPサーバープロセスがコミット361fb5cの最新コード（manual_testおよびsecurity_scanのサブエージェントテンプレート改善）を実行していることを確認し、デプロイの完了をステータス化する。

**主要な成果:**
- MCP サーバーが最新のFR-11・FR-12ガイダンスを適用した状態で動作していることが実証されている
- workflow-plugin/mcp-serverのmainブランチがorigin/mainと同期済みで安定状態
- definitions.tsに含まれるmanual_testとsecurity_scanのサブエージェントテンプレートが最新版のガイダンス（角括弧禁止パターンの具体例、スクリーンショットファイルの配置ガイダンス等）を提供している

**次フェーズで必要な情報:**
- タスク完了。全19フェーズが終了し、deployフェーズで最新コード確認を完了したため、completedフェーズへ移行可能
- workflow-plugin内のコード変更は全てgitで管理されており、submoduleの更新により親リポジトリから参照可能

---

## デプロイ確認結果

### 1. MCPサーバーのコミット状態確認

workflow-plugin/mcp-serverのヘッド状態を確認：

```
最新コミット（HEAD）: 361fb5c
コミットメッセージ: feat: update FR-11/FR-12 subagent template guidance for manual_test and security_scan phases
ブランチ: main
リモート同期状態: origin/main と同期済み（最新）
```

このコミット361fb5cでは、manual_testフェーズとsecurity_scanフェーズのサブエージェントテンプレートに対して、以下のガイダンス改善が実装されている：

- **FR-11 (manual_test向け改善)**: スクリーンショットファイルの配置ガイダンス、テスト実行環境情報の一意化方法、複数シナリオ報告時の行の一意性確保方法を追記
- **FR-12 (security_scan向け改善)**: 脆弱性報告時の具体的なセクション構成ガイダンス、角括弧禁止パターン（regex表記や配列参照）をコードフェンス内に限定する明示

### 2. ワークツリー状態確認

```
ブランチ: main
リモートトラッキング: [origin/main] でワークツリーが最新
変更状況: nothing to commit, working tree clean
```

ワークツリーにファイル変更や未ステージング変更がなく、全てコミット・プッシュ済み。デプロイ対象のコード変更が全てリポジトリに記録されている。

### 3. MCPサーバープロセスの状態

前フェーズ（ci_verification）において、MCPサーバープロセスが正常に再起動され、最新のTypeScriptコンパイル結果（dist/*.js）をメモリに読み込んだ状態が確認されている。Node.jsのモジュールキャッシュにより、definitions.ts から各フェーズ用のサブエージェントテンプレートが正常に読み込まれている。

### 4. サブエージェントテンプレートの実装確認

definitions.ts で定義される各フェーズ別テンプレートは、以下の品質要件を満たしている状態で運用されている：

- **manual_test**: テストシナリオの実行時刻・環境情報を各行に付加して一意性を確保するガイダンス、スクリーンショット出力先（src/backend/tests/screenshots/ または src/frontend/test/screenshots/）の具体的な指定
- **security_scan**: 「## 脆弱性スキャン結果」「## 検出された問題」の必須セクション、脆弱性ID・CWE参照・修正手順を含むテーブル形式での報告ガイダンス

### 5. リモートリポジトリとの同期確認

```
親リポジトリ（Workflow）: main ブランチ（最新）
サブモジュール（workflow-plugin）: main ブランチ（最新）
同期状態: 両者ともorigin と同期済み
```

サブモジュールの最新版がメインリポジトリの参照に使用されるよう、submoduleポインタが更新されている。

### 6. デプロイ完了の定義達成状況

デプロイフェーズでは、本プロジェクト（MCPサーバープラグイン）のデプロイが「最新コードで動作していること」を意味する。以下の3項目全てが確認されたため、デプロイ完了状態にある：

- ✅ workflow-plugin のコードが main ブランチにマージ・プッシュされている（コミット361fb5c）
- ✅ MCPサーバーが再起動されて最新コード（definitions.ts, subagent template等）で動作している（前フェーズで実施）
- ✅ FR-11・FR-12 のガイダンスが実際のサブエージェントテンプレートに反映されている（definitions.tsで確認）

### 7. 成果物の永続性確認

タスク開始以降の全成果物（definitions.ts更新、test.ts追加等）が以下の場所に永続化されている：

- ディスク上: workflow-plugin/mcp-server/src/ 以下の全ファイル（npm run buildでコンパイル済み）
- Gitリポジトリ: コミット361fb5cで記録済み、origin/mainにプッシュ済み
- MCPサーバープロセス: 最新版のコンパイル結果がメモリ上で動作中

---

## デプロイ成功指標

本タスク「manual_testとsecurity_scanのsubagentTemplateガイダンス不足修正」のデプロイ成功を示す指標は、以下の通り満たされている：

| 指標 | 状態 | 確認方法 |
|------|------|---------|
| MCP サーバーコード最新化 | ✅ 完了 | git log --oneline: コミット361fb5c |
| サブモジュール同期 | ✅ 完了 | git -C workflow-plugin status: 最新 |
| ワークツリークリーン | ✅ 完了 | working tree clean 確認 |
| MCPサーバープロセス再起動 | ✅ 完了 | 前フェーズで実施 |
| ガイダンス実装確認 | ✅ 完了 | definitions.ts確認 |
| リモート同期 | ✅ 完了 | origin/main同期済み |

---

## 運用上の留意事項

### 今後のガイダンス変更時の手順

1. definitions.ts で新規ガイダンスを追加・修正
2. npm run build でTypeScriptをトランスパイル
3. MCPサーバープロセスを再起動（重要）
4. git add, git commit でコミット
5. git push で親リポジトリの参照を更新
6. 次のワークフローフェーズへ移行

### モジュールキャッシュの再確認

MCPサーバーが起動後にdist/*.jsを変更しても、プロセス終了までメモリキャッシュが優先される。ガイダンス変更を反映させるには、必ずプロセス再起動が必須。

### サブエージェントテンプレートの配布

本タスクで改善されたmanual_test・security_scanのテンプレートは、workflow_nextまたはworkflow_status MCP呼び出しで自動的に次フェーズのサブエージェントに配布される。テンプレートが古い形式のままの場合は、MCPサーバー再起動未実施を疑うこと。

