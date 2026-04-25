# 要件定義書: regression_test サブエージェントの workflow_capture_baseline 誤用防止ガイダンス追加

## サマリー

- 目的: regression_test フェーズの subagentTemplate に `workflow_capture_baseline` の誤用防止ガイダンスを追加し、設計上エラーになる呼び出しをsubagent自身が未然に防ぐことを目的とする
- 問題の背景: 現在の regression_test テンプレートの「ワークフロー制御ツール禁止」リストに `workflow_capture_baseline` が含まれておらず、subagent が testing フェーズでのみ有効なこのツールを誤用する可能性がある
- 主要な決定事項: 2つの機能要件（FR-13・FR-14）を definitions.ts の regression_test テンプレートへ追記することで対応する。MCP サーバーの再起動が修正後に必要となる
- 影響範囲: definitions.ts の regression_test.subagentTemplate フィールド（880行目付近）のみ
- 次フェーズで必要な情報: 現在の regression_test テンプレートの末尾文字列位置と、追記すべき具体的な文字列内容

## 機能要件

### FR-13: regression_test の subagentTemplate の禁止ツールリストへの workflow_capture_baseline 追加

既存の「ワークフロー制御ツール禁止」セクションの禁止対象リストに `workflow_capture_baseline` を明示的に追加する。

現在の禁止対象リストには以下が含まれている:
- workflow_next、workflow_approve、workflow_complete_sub、workflow_start、workflow_reset

上記リストに `workflow_capture_baseline` を加え、禁止の根拠として「ベースライン記録は testing フェーズでのみ MCP サーバーが受け付ける設計であり、regression_test フェーズからの呼び出しはアーキテクチャ上エラーとなる」という説明を添える。

このガイダンスが追加されることで、subagent は禁止ツールリストを参照した時点で `workflow_capture_baseline` の呼び出しを自律的に回避できる。

### FR-14: regression_test の subagentTemplate への「ベースライン前提条件」セクション追加

regression_test テンプレートに新規セクション「## ベースライン前提条件」を追加する。

このセクションに記載すべき内容は以下の通りである:
- ベースラインは testing フェーズで `workflow_capture_baseline` を呼び出して記録済みであることが前提条件であるという説明
- regression_test フェーズでは `workflow_capture_baseline` を再度呼び出す必要はなく、呼び出してもアーキテクチャ上エラーになるという説明
- ベースライン情報の確認方法として `workflow_get_test_info` を使用できるという説明（このツールは regression_test フェーズでも使用可能）
- ベースラインが未設定の状態で regression_test フェーズに遷移してきた場合、Orchestrator が testing フェーズへ差し戻すべきであるという説明

このセクションは既存の「## sessionTokenの取得方法と使用制限」セクションの直前、または「## ★ワークフロー制御ツール禁止★」セクションの直前に配置する。

## 非機能要件

### NF-1: 既存テンプレートとの一貫性

FR-5 で追加された既存の「ワークフロー制御ツール禁止」セクションの文体・記述スタイルと一貫性を保つこと。
具体的には、FR-5 で使用した「禁止対象:」に続けて禁止ツール一覧をカンマ区切りで列挙する形式を踏襲する。

### NF-2: 後方互換性の維持

regression_test テンプレートへの追記は、既存のガイダンス内容（sessionToken 使用制限、workflow_record_test_result の注意事項等）の書き換えを行わない追記のみとすること。
既存の subagentTemplate の動作を壊さないよう、テンプレート末尾への追加または適切な挿入位置への追加に限定する。

### NF-3: MCP サーバー再起動要件への対応

definitions.ts を変更した後は CLAUDE.md のルール22に従い MCP サーバーを再起動すること。
再起動なしでは変更がキャッシュに反映されず、バリデーション失敗が継続するため、実装フェーズ完了時に再起動手順を実施することを明記する。

### NF-4: 過剰な修正の回避

本タスクは regression_test テンプレートのガイダンス欠落という局所的な問題の修正であり、testing テンプレートや他のフェーズテンプレートへの変更は原則として不要である。
修正範囲は definitions.ts の regression_test エントリの subagentTemplate フィールドに限定すること。

## 受入条件

### AC-1: FR-13 の検証方法

実装後、definitions.ts の regression_test.subagentTemplate の文字列に以下の内容が存在することを確認する:
- 文字列 `workflow_capture_baseline` が禁止対象として言及されていること
- 言及の文脈が「禁止」を明示するものであること（「使用しないこと」「呼び出してはならない」等の否定形を含む）
- 禁止の根拠として testing フェーズでのみ有効であるという説明が付与されていること

### AC-2: FR-14 の検証方法

実装後、definitions.ts の regression_test.subagentTemplate の文字列に以下の内容が存在することを確認する:
- ベースラインが testing フェーズで記録済みであることを前提とする説明が含まれていること
- regression_test フェーズで `workflow_capture_baseline` を呼び出す必要がないことが明記されていること
- `workflow_get_test_info` を使用してベースライン情報を確認できることが案内されていること

### AC-3: 既存テストの通過

本修正後に mcp-server のテストスイートを実行し、修正前と同数以上のテストが通過することを確認する。
特に regression_test に関連するテストケース（TC-FIX-1・TC-FIX-2 を含む新規テスト）が追加された場合、それらも含めて全テストが通過すること。

### AC-4: MCP サーバーの再起動完了

修正・ビルド完了後に MCP サーバープロセスを再起動し、`workflow_status` を実行して現在のフェーズ情報が正常に返却されることを確認する。
再起動未実施のまま次フェーズに進むことは禁止とする。

### AC-5: 既存テンプレートとの一貫性確認

追加したガイダンスの文体が、FR-5 で追加された testing フェーズの「ワークフロー制御ツール禁止」セクションと同等の明確さ・強度で記述されていることをコードレビューで確認する。
