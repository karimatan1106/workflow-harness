# scope-definition: gitignore整備

## 背景

親リポジトリおよび workflow-harness サブモジュールにおいて、バージョン管理すべきでないファイルが Git の追跡対象に含まれている。
親リポジトリでは `.claude-phase-guard-log.json` が追跡済み(modified)状態で存在し、`.claude/generated-files.json` と `.claude/settings.local.json` が untracked 状態で毎回 git status に表示される。
サブモジュール側では `mcp-server/dist/` 配下に 119 ファイルのビルド成果物が追跡済みであり、`mcp-server/.claude/state/` 配下に reflector-log.json と task-index.json が追跡済みである。
これらのファイルは実行時に自動生成されるものであり、開発者ごとに内容が異なるため、リポジトリに含めるべきではない。
サブモジュールの `.gitignore` には `dist/` と `mcp-server/.claude/state/` が既に記載されているが、`git rm --cached` が未実施のため引き続き追跡されている状態である。
現状では `git status` 実行時に常に変更ファイルとして表示され、本来注目すべき変更が埋もれる原因となっている。
親リポジトリの既存 `.gitignore` には `.claude/state/` パターンが存在するが、これは `.claude/` 直下の `generated-files.json` や `settings.local.json` をカバーしない。

## 目的

親リポジトリとサブモジュールの両方で `.gitignore` を正しく設定し、自動生成ファイルやビルド成果物を Git の追跡対象から除外する。
これにより `git status` の出力がクリーンになり、意図した変更のみが表示される状態を実現する。
親リポジトリでは `.gitignore` に3パターンを追加し、追跡済みの `.claude-phase-guard-log.json` を `git rm --cached` で除去する。
サブモジュールでは `mcp-server/dist/` と `mcp-server/.claude/state/` を `git rm -r --cached` で untrack し、既存の `.gitignore` パターンを有効化する。
最終的に、親リポジトリとサブモジュールの両方で `git status` がクリーンな状態になることをゴールとする。

## スコープ

本タスクの対象は2リポジトリにおける `.gitignore` の整備と、追跡済み不要ファイルの untrack 操作である。
親リポジトリ (`C:/ツール/Workflow`) では `.gitignore` に `.claude-phase-guard-log.json`、`.claude/generated-files.json`、`.claude/settings.local.json` の3パターンを追加する。
親リポジトリで追跡済みの `.claude-phase-guard-log.json` は `git rm --cached` でインデックスから除去する。`.claude/generated-files.json` と `.claude/settings.local.json` は未 staged のため `.gitignore` 追加のみで対応可能である。
workflow-harness サブモジュール (`C:/ツール/Workflow/workflow-harness`) では `mcp-server/dist/` と `mcp-server/.claude/state/` を `git rm -r --cached` で追跡解除する。
サブモジュールの `.gitignore` には該当パターンが既に記載済みのため、エントリ追加は不要である。
スコープ外として、`mcp-server/node_modules/` の untrack、`workflow-plugin` サブモジュールの整備、git 履歴からの秘密鍵除去は今回の対象に含めない。

## 影響範囲

親リポジトリのルートにある `.gitignore` ファイルにコメント行1行とパターン3行を追加する。既存のエントリには変更を加えない。
`.claude-phase-guard-log.json` はワークフローガードが自動生成するログファイルであり、`git rm --cached` でインデックスから除去する。ワーキングツリーのファイルは保持される。
workflow-harness サブモジュールの `mcp-server/dist/` 配下の `.js` および `.js.map` ファイル群がインデックスから除去される。TypeScript コンパイル成果物であり、ソース管理対象外が原則である。
同サブモジュールの `mcp-server/.claude/state/` 配下の状態ファイルがインデックスから除去される。HMAC 鍵ファイルが含まれている可能性がありセキュリティ上の優先度が高い。
サブモジュールへの変更はコミット後に親リポジトリのサブモジュール参照（コミットハッシュ）の更新コミットを必要とする。
本タスクの成果物 `docs/workflows/gitignore整備/` は親リポジトリの `**/docs/workflows/` パターンにより VCS から自動除外される。

## 前提条件

`git rm --cached` はインデックスからのみファイルを除去し、ワーキングツリーのファイルには影響しない。操作はすべて可逆であり `git add` で再追跡が可能である。
サブモジュールの `.gitignore` には `dist/`、`mcp-server/.claude/state/`、`mcp-server/.claude/generated-files.json` が既に記載されており、`git rm --cached` 後は自動的に除外パターンが有効になる。
親リポジトリの `.gitignore` には `.claude/state/` が既に記載されているが、`.claude-phase-guard-log.json` 等はリポジトリルート直下または `.claude/` 直下であるため既存パターンではカバーされない。
親リポジトリの変更とサブモジュールの untrack 操作は独立しており並行実行が可能である。完了後に親リポジトリでサブモジュール参照の更新コミットが必要となる。
他の開発者がプルした際にローカルの該当ファイルが削除される可能性があるが、自動生成ファイルであるため再生成により復元可能である。
`.claude/settings.json` はチーム共有の設定ファイルとして VCS 管理対象であり、今回の除外対象には含めない。
