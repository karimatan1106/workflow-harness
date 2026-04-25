# Test Selection: agent-delegation-prompt-templates

## テスト選定方針

本タスクはMarkdownファイル(.md)の追加・編集のみであり、TypeScript/JavaScriptのソースコード変更を含まない。
そのため vitest --related による自動テスト選定の対象はない。

## 選定結果

| カテゴリ | 対象 | 理由 |
|---------|------|------|
| vitest自動テスト | なし | コード変更なし |
| 構造検証(grep/wc) | test-design.md TC-AC1-01〜TC-AC6-06 (22件) | 成果物の構造をコマンドで検証可能 |
| レビュー検証 | test-design.md TC-AC2-02等 | 内容の意味的検証はレビューで実施 |

## 既存テストへの影響

変更対象ファイルはスキルファイル(.claude/配下)とルールファイルのみ。
これらはビルド対象に含まれず、既存テスト(vitest 776件)に影響しない。

## decisions

- vitest不使用: コード変更がないためユニットテスト/統合テスト不要 -- Markdownの検証にvitestは不適切
- grep/wc -lベースの検証: test-design.mdで定義した全TCをシェルコマンドで実行 -- 再現可能で自動化可能
- 既存テスト回帰なし: .claude/配下のMarkdownファイルはビルド・テストパイプラインの対象外
- 全22TCを構造検証で実施: 手動レビューのみのTCも含め、可能な限りコマンドで検証
- regression_testフェーズでの既存テスト全実行は維持: 変更影響がないことの証明として

## artifacts

| ファイル | 内容 |
|---------|------|
| test-design.md | TC定義元(22件) |

## next

- test_implフェーズで検証スクリプト作成
