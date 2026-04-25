## 概要

本タスクは、親リポジトリおよびサブモジュール workflow-harness において、バージョン管理すべきでないファイルを
適切に .gitignore で除外し、既に追跡済みのファイルを git rm --cached で追跡対象から除去する作業である。
対象ファイルには自動生成されるビルド成果物、ユーザー固有のローカル設定、およびセキュリティ上機密性の高い
HMAC秘密鍵ファイルが含まれる。これらのファイルがバージョン管理に含まれていることで、不要な差分の発生、
機密情報の意図しない共有、リポジトリサイズの肥大化といった問題が生じている。本タスクではこれらの問題を
.gitignore の整備と git rm --cached による追跡解除の組み合わせで解決する。ファイル自体はワーキングツリーに
残したまま Git の追跡対象からのみ除去するため、ローカル環境への影響は発生しない。

## 変更対象ファイル

親リポジトリの .gitignore には3つのエントリを新規追加する。具体的には .claude-phase-guard-log.json、
.claude/settings.local.json、.claude/generated-files.json の3パターンである。このうち
.claude-phase-guard-log.json は既にGitで追跡済みのため、.gitignore への追記に加えて git rm --cached に
よる追跡解除が必要となる。残りの2ファイルは現時点で未追跡（?? 状態）であるため .gitignore への追記のみで
将来の誤追加を防止できる。

サブモジュール workflow-harness 内では、mcp-server/dist/ 配下の192ファイル（ビルド成果物）と
mcp-server/.claude/state/ 配下の3ファイル（hmac-keys.json、reflector-log.json、task-index.json）が
追跡済みである。サブモジュールの .gitignore には既に dist/ と mcp-server/.claude/state/ のパターンが
記載されているが、一度追跡されたファイルには .gitignore の除外ルールが適用されないため、
git rm -r --cached による明示的な追跡解除が必須である。

### 親リポジトリ .gitignore（追記内容）

```
.claude-phase-guard-log.json
.claude/settings.local.json
.claude/generated-files.json
```

### 親リポジトリ（git rm --cached 対象）

- .claude-phase-guard-log.json

### サブモジュール workflow-harness（git rm -r --cached 対象）

- mcp-server/dist/ （192ファイル）
- mcp-server/.claude/state/ （3ファイル）

## 実装手順

実装は厳密な順序で行う必要がある。まず親リポジトリの .gitignore にパターンを追記することで、
以降の git add 操作で対象ファイルが誤って追加されることを防ぐ。次に親リポジトリで
.claude-phase-guard-log.json を git rm --cached で追跡解除する。この操作はファイルをディスクから
削除せず、Gitのインデックスからのみ除去する。

続いてサブモジュール workflow-harness のディレクトリに移動し、mcp-server/dist/ と
mcp-server/.claude/state/ をそれぞれ git rm -r --cached で追跡解除する。この2つの操作を分離して
実行する理由は、各操作の影響範囲を明確にし、問題発生時の切り分けを容易にするためである。
サブモジュール内での変更は先にサブモジュール内でコミットし、その後親リポジトリでサブモジュール参照の
更新と .gitignore の変更をまとめてコミットする。この順序を逆にするとサブモジュールの不整合が発生する。

操作の全体的な流れは以下のとおりである。
1. 親リポジトリの .gitignore に3行追記する
2. 親リポジトリで git rm --cached .claude-phase-guard-log.json を実行する
3. サブモジュールディレクトリへ移動する
4. git rm -r --cached mcp-server/dist/ を実行する
5. git rm -r --cached mcp-server/.claude/state/ を実行する
6. サブモジュール内で変更をコミットする
7. 親リポジトリに戻り .gitignore 変更とサブモジュール参照更新をコミットする

## 受入基準との対応

AC-1 は親リポジトリの .gitignore に3つのパターンが存在することを検証する。grep コマンドで
.claude-phase-guard-log.json、.claude/settings.local.json、.claude/generated-files.json の
3パターンが .gitignore ファイル内に含まれていることを確認する。これは .gitignore への追記操作（手順1）の
完了によって充足される。

AC-2 はサブモジュール内の追跡済みファイルが除去されていることを検証する。workflow-harness ディレクトリ内で
git ls-files mcp-server/dist/ および git ls-files mcp-server/.claude/state/ を実行し、出力が空であることを
確認する。これは手順4と手順5の git rm -r --cached 操作の完了によって充足される。

AC-3 は親リポジトリの .claude-phase-guard-log.json が追跡対象から除去されていることを検証する。
git ls-files .claude-phase-guard-log.json を実行し出力が空であることを確認する。これは手順2の
git rm --cached 操作の完了によって充足される。

AC-4 は git status の出力で対象ファイルの状態が正しく表示されることを検証する。git rm --cached で
除去されたファイルは staged deletion として表示され、.gitignore に記載されたパターンに一致するファイルは
Untracked files セクションに表示されないことを確認する。これは全手順の完了とコミット前の状態で検証する。

## リスクと緩和策

最大のリスクはサブモジュール内の git rm -r --cached が意図しないファイルに影響することである。
この操作は --cached オプションにより Git のインデックスのみを変更しワーキングツリーのファイルには
触れないため、データ損失のリスクは実質的にない。仮にインデックスの状態が不正になった場合でも
git checkout や git reset で復元可能である。

二番目のリスクはサブモジュールのコミット順序の誤りによる不整合である。サブモジュール内の変更を
コミットせずに親リポジトリをコミットすると、親リポジトリが存在しないサブモジュールコミットを参照する
状態になる。この問題は実装手順でサブモジュールコミットを親コミットより先に配置することで防止する。

三番目のリスクとして hmac-keys.json がGit履歴に残存することが挙げられる。git rm --cached は
現在のインデックスから除去するのみで過去のコミット履歴には影響しない。履歴からの完全削除には
BFG Repo-Cleaner や git filter-repo などの専用ツールが必要であるが、これは破壊的操作であるため
本タスクのスコープ外として別タスクに分離している（REQ-007）。現時点ではプライベートリポジトリであることから
外部への露出リスクは限定的である。

四番目のリスクは .gitignore パターンの不足による将来のファイル追跡である。追記する3パターンは
research フェーズで網羅的に調査済みであり、git status の出力と照合して漏れがないことを確認している。
サブモジュール側は既存の .gitignore に必要なパターンが記載済みであるため追記は不要である。
