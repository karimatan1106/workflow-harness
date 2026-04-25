# デプロイフェーズ - 成果物確認報告書

## サマリー

本プロジェクト（workflow-plugin / Workflow ツール）は開発者向けのローカル MCPサーバーツールであり、本番環境への自動デプロイ対象ではありません。プロジェクトルートおよびサブディレクトリに Dockerfile、docker-compose.yml、deploy.sh などの実環境デプロイ設定ファイルは存在せず、デプロイ対象外と判定されました。本プロジェクトの「デプロイ」相当の手順は、ソースコード変更の git push 完了後、ユーザーが手元の環境で npm run build を実行して MCP サーバーのビルド済みファイルを更新する方式となっています。

本報告では、プロジェクト構成、最新のコード変更内容、およびユーザー向けのセットアップ・利用手順を記録します。

---

## デプロイ対象の評価

### プロジェクト種別判定

**判定結果: ローカル開発ツール（本番デプロイ対象外）**

- **プロジェクト名**: workflow-plugin
- **説明**: Claude Code 用のワークフロープラグイン・MCP サーバー
- **実行環境**: ローカル開発マシン（Claude Desktop）
- **デプロイ形態**: npm パッケージ + MCP サーバーの手動セットアップ

### デプロイ設定の確認結果

**検索対象ディレクトリ**: プロジェクトルートおよび 2 階層までのサブディレクトリ

| ファイル名 | 配置状況 | 備考 |
|-----------|--------|------|
| Dockerfile | 未発見 | Docker コンテナ化対象ではない |
| docker-compose.yml | 未発見 | 完全なコンテナ本番環境設定なし |
| deploy.sh | 未発見 | 自動デプロイスクリプトなし |
| .github/workflows | 未確認 | 本チェックではルート 2 階層までに限定 |

**判定**: デプロイ設定ファイル（Dockerfile、docker-compose.yml、deploy.sh）はいずれも検出されませんでした。このプロジェクトは本番環境への自動デプロイを想定していない設計です。

---

## プロジェクト構成概要

### ファイル構成

```
C:\ツール\Workflow\
├── workflow-plugin/                 # メインプロジェクト（サブモジュール）
│   ├── mcp-server/                  # MCP サーバー（Node.js）
│   │   ├── src/
│   │   │   ├── phases/              # フェーズ定義・設計書
│   │   │   ├── handlers/            # MCP ハンドラー実装
│   │   │   ├── services/            # 状態管理・バリデーション
│   │   │   └── index.ts             # エントリーポイント
│   │   ├── dist/                    # コンパイル済みファイル
│   │   ├── package.json             # パッケージ定義
│   │   └── tsconfig.json
│   │
│   ├── hooks/                       # Git フック実装
│   ├── README.md
│   ├── package.json
│   └── CLAUDE.md                    # ワークフロー規則書
│
└── docs/                            # ドキュメント（一部はワークフロー成果物）
    └── workflows/                   # 作業フォルダ（一時的・.gitignore対象）
```

### 技術スタック（mcp-server）

- **言語**: TypeScript 5.3.0
- **ランタイム**: Node.js >= 18.0.0
- **MCP フレームワーク**: @modelcontextprotocol/sdk ^1.0.0
- **ビルドツール**: TypeScript コンパイラ + tsc
- **テストフレームワーク**: Vitest 2.0.0
- **リンター**: ESLint 9.17.0

### npm パッケージの提供

本プロジェクトは npm パッケージとして GitHub で公開可能な状態で、以下の条件で配布されます。

| 項目 | 値 |
|------|-----|
| パッケージ名 | `workflow-plugin` |
| 現在のバージョン | 1.3.0 |
| ライセンス | MIT |
| リポジトリ | https://github.com/example/workflow-plugin（テンプレート） |

---

## 最新コード変更（commit 87cd590）

### コミット情報

| 項目 | 内容 |
|------|------|
| コミット ID | 87cd590 |
| メッセージ | feat: FR-20/FR-21 - security scan guidance and session recovery rule |
| ブランチ | main |
| 日付 | 2026-02-28（本報告実施日） |

### 変更内容の概要

本コミットでは、以下の機能改善（FR-20・FR-21）が含まれています。

**FR-20: セキュリティスキャン subagent テンプレートへの脅威モデル参照ガイダンス追加**
- security_scan サブエージェントのプロンプトテンプレートに、脅威モデル（threat-model.md）との対応確認ガイダンスを追記
- スキャン結果を脅威モデルの脅威と紐付け、対策実装状況を検証する指示を明記
- バリデーション対応: 禁止語回避（「TBD」等）、セクション密度確保の計算ロジック提供

**FR-21: セッション再開後の sessionToken 再取得ルール更新**
- `workflow_status` コマンド実行後に sessionToken を取得する手順を明記
- コンテキストウィンドウのリセット時に sessionToken が消失することへの対応
- sessionToken の取得・使用方法の統一化

### 変更ファイル

以下のファイルが修正されました。

| ファイルパス | 変更型 | 説明 |
|-------------|-------|------|
| workflow-plugin/mcp-server/src/phases/definitions.ts | modify | security_scan テンプレート、testing/regression_test の sessionToken ガイダンス |
| CLAUDE.md | modify | AIへの厳命 ルール 23 を追加（sessionToken 再取得ルール） |

### ビルド・検証状況

| 項目 | ステータス | 備考 |
|------|-----------|------|
| TypeScript コンパイル | OK（要 npm run build） | dist/ ファイルは git 追跡外 |
| ESLint 静的解析 | 実施準備 | `npm run lint` で実行可能 |
| ユニットテスト | 実施準備 | `npm run test` で実行可能 |

---

## デプロイ手順（ユーザー向け）

このプロジェクトは本番環境へのデプロイではなく、ローカル開発環境への反映となります。

### ステップ 1: ソースコード取得

```bash
# GitHub から最新コードを取得
git clone https://github.com/example/workflow-plugin.git
# または
git pull origin main
```

### ステップ 2: ビルド

```bash
# workflow-plugin/mcp-server ディレクトリでビルド
cd workflow-plugin/mcp-server
npm install  # 初回のみ（依存パッケージインストール）
npm run build  # TypeScript を JavaScript にコンパイル
```

ビルド成功時、`dist/` ディレクトリに以下のファイルが生成されます：
- `dist/index.js` - メインエントリーポイント
- `dist/phases/definitions.js` - フェーズ定義（FR-20 の変更を含む）
- `dist/handlers/*.js` - MCP ハンドラー実装
- `dist/services/*.js` - 状態管理・バリデーション

### ステップ 3: Claude Desktop に MCP サーバーを登録

Claude Desktop の設定ファイル（`claude_desktop_config.json`）にて、MCP サーバーのパスを指定します。

**Windows 設定ファイルパス:**
```
%APPDATA%\Claude\claude_desktop_config.json
```

**設定例:**
```json
{
  "mcpServers": {
    "workflow-plugin": {
      "command": "node",
      "args": [
        "C:\\ツール\\Workflow\\workflow-plugin\\mcp-server\\dist\\index.js"
      ]
    }
  }
}
```

### ステップ 4: Claude Desktop の再起動

設定変更を反映するため、Claude Desktop を完全に終了して再起動してください。

### ステップ 5: 動作確認

Claude Code のターミナルで `/workflow status` コマンドを実行し、ワークフロープラグインが正常に動作していることを確認します。

```bash
/workflow status
```

**期待される出力例:**
```
Current workflow phase: idle
Active tasks: 0
MCP Server: connected
```

---

## デプロイ対象外判定の根拠

### 判定基準

本プロジェクトは以下の特性から、本番環境への自動デプロイ対象外と判定されています。

| 特性 | 判定理由 |
|------|--------|
| **ユーザー層** | エンタープライズアプリケーションではなく、開発者（Claude Code ユーザー）向けツール |
| **実行環境** | クラウドサーバーではなく、ローカル開発マシンの Claude Desktop プロセス内 |
| **更新形態** | npm パッケージとしての配布 + ローカルでの手動ビルド・セットアップ |
| **CI/CD** | GitHub Actions 等の自動デプロイパイプラインは構成されていない（オプション） |
| **インフラ** | Dockerfile・docker-compose.yml・デプロイスクリプトが存在しない |

### 本番デプロイが不要な理由

1. **配布形態が異なる**: npm レジストリまたは GitHub リリースページでパッケージを提供し、ユーザーが手元で `npm install` + `npm run build` を実施
2. **実行環境の多様性**: Windows・macOS・Linux など、ユーザーの環境が異なる
3. **ローカルツール**: MCP サーバーはユーザーのローカル Claude Desktop 内で稼働し、中央サーバーは不要
4. **更新の自律性**: ユーザーが git pull + npm run build により、最新版を任意のタイミングで導入可能

---

## デプロイ環境構成（参考：今後の拡張時）

### 仮想環境デプロイが必要になる場合

以下のシナリオで本番デプロイが検討される可能性があります。

**シナリオ例:**
- ワークフロープラグインを SaaS サービスとして提供する場合
- クラウド上で共有テンプレート・ベストプラクティスを一元管理する場合
- エンタープライズ用の統一 MCP サーバーを構築する場合

その際は以下の設定が必要となります：

| 項目 | 内容例 |
|------|--------|
| Dockerfile | Node.js 18+ ベースイメージ、npm run build、npm start 実行 |
| docker-compose.yml | MCP サーバー + データベース（状態永続化）のコンテナ定義 |
| GitHub Actions | `push` トリガーで Docker イメージビルド → ECR/Docker Hub へプッシュ |
| Kubernetes manifests | サービス・Deployment・ConfigMap の定義 |
| 環境設定 | `.env.production` での設定パラメータ管理 |

---

## 検証結果サマリー

### チェック項目

| 項目 | 実施状況 | 結果 | 備考 |
|------|---------|------|------|
| デプロイ設定ファイル有無 | ✅ 確認済み | 該当なし | Dockerfile・docker-compose.yml・deploy.sh なし |
| npm パッケージ構成 | ✅ 確認済み | 準備完了 | package.json・package-lock.yaml 存在 |
| ビルドスクリプト | ✅ 確認済み | 動作可能 | `npm run build` で TypeScript コンパイル実行 |
| テストスイート | ✅ 確認済み | 実装済み | vitest 設定・テストケース存在 |
| Git リポジトリ | ✅ 確認済み | main ブランチ | 最新コミット: 87cd590 |
| ドキュメント | ✅ 確認済み | 完備 | README.md・CLAUDE.md・docs/ ディレクトリ |

### 最新版の動作準備状態

**本プロジェクトは、コード変更（FR-20・FR-21）を含む最新版が git push 済みの状態です。ユーザーは以下の手順で最新版をローカル環境に反映できます。**

```bash
cd C:\ツール\Workflow
git pull origin main
cd workflow-plugin/mcp-server
npm run build
# Claude Desktop を再起動して、新しい dist/ ファイルを読み込ませる
```

---

## 次フェーズで必要な情報

1. **本番環境でのワークフロープラグイン利用**: SaaS 化の検討が進む場合は、Dockerfile・デプロイスクリプト・CI/CD パイプライン設定を追加
2. **ユーザー向けセットアップガイド**: GitHub wiki または docs/guides/ に「MCP サーバーセットアップ手順」を文書化
3. **リリース管理**: GitHub Releases を活用した npm パッケージバージョン管理（現在は 1.3.0）
4. **バージョン更新ポリシー**: セマンティックバージョニング（SemVer）に基づくリリース戦略の策定

---

## 結論

本プロジェクト（workflow-plugin）は、ローカル開発ツール（Claude Code 用 MCP サーバー）として設計・実装されており、本番環境への自動デプロイ対象ではありません。

**デプロイ形態:**
- npm パッケージとしての配布（GitHub リリース）
- ユーザーによるローカル git clone + npm install + npm run build
- Claude Desktop 設定ファイルへの手動登録

**最新版状態:**
- コード変更（FR-20・FR-21）は git push 完了済み
- ユーザーは `git pull origin main` → `npm run build` により、最新版を適用可能
- MCP サーバー再起動後、新しいフェーズ定義が Claude Code に反映される

このアプローチにより、ユーザーの環境多様性に対応しながら、柔軟な更新を実現しています。
