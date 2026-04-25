## サマリー

- [R-001][finding] 親リポジトリで .claude-phase-guard-log.json が追跡済み。.gitignore に除外パターンが存在しないため git rm --cached と .gitignore 追記の両方が必要である。
- [R-002][finding] 親リポジトリで .claude/settings.json と .mcp.json が追跡済み。機密設定ファイルであり VCS から除外すべきだが現行 .gitignore に除外パターンが存在しない。
- [R-003][finding] workflow-harness で mcp-server/dist/ 配下に 192 ファイルが追跡済みである。.gitignore の dist/ パターンはサブディレクトリ mcp-server/dist/ にマッチせず git rm --cached も未実施である。
- [R-004][finding] workflow-harness で mcp-server/.claude/state/ に hmac-keys.json・reflector-log.json・task-index.json の 3 ファイルが追跡済みである。hmac-keys.json には HMAC 秘密鍵ハッシュが含まれセキュリティリスク最高である。
- [R-005][finding] commit 13edf79 は .gitignore ファイルのみ追加し git rm --cached を実行しなかった。これが dist/ と state/ が追跡され続ける直接原因である。
- [R-006][risk] mcp-server/.claude/state/hmac-keys.json の current フィールドに 64 文字の SHA-256 ハッシュ値が平文で記録されている。今回の対応は untrack のみとし、Git 履歴からの完全削除は別タスクとする。
- [R-007][decision] 親リポジトリで .claude/settings.json と .mcp.json も .gitignore に追加する。settings.json はツール許可設定を含みローカル固有、mcp.json はローカルパスを含むため追跡不要である。
- [R-008][constraint] .gitignore に新規パターンを追加するだけでは既追跡ファイルへの効果はゼロである。Git は追跡済みファイルを .gitignore より優先するため git rm --cached が必須である。

## 調査結果

親リポジトリで追跡すべきでないファイルを git ls-files で確認した結果を以下に示す。
.claude-phase-guard-log.json はフックの実行ログで実行ごとに変わる内容であり VCS 管理対象外が適切である。
.claude/settings.json はツール許可設定でローカル環境固有のため VCS 管理対象外が適切である。
.mcp.json はローカルのパス設定を含むため VCS 管理対象外が適切である。
.claude/generated-files.json と .claude/settings.local.json は untracked 状態のため git rm --cached 不要で .gitignore 追記のみで対応できる。
workflow-harness サブモジュールでは mcp-server/dist/ 配下に 192 ファイルが追跡済みである。これらはビルド成果物であり TypeScript ソースから自動生成されるため VCS 管理対象外が原則である。
mcp-server/.claude/state/ には hmac-keys.json・reflector-log.json・task-index.json の 3 ファイルが追跡済みである。hmac-keys.json は HMAC 秘密鍵の SHA-256 ハッシュ値を平文で保持しておりセキュリティ上の問題がある。
.gitignore パターンが効かない理由は 3 つある。第 1 に親リポジトリの .gitignore に対象ファイルのパターンが欠落している。第 2 に .gitignore 追加コミット 13edf79 で git rm --cached が省略された。第 3 に workflow-harness の dist/ パターンが mcp-server/dist/ にマッチしない。
追跡対象の整理後は git status がクリーンな状態になり、今後のコミットにビルド成果物や秘密鍵が混入するリスクが解消される。
親リポジトリで untrack する 3 ファイルはいずれも機密または揮発性のファイルであり、コミット履歴に含まれるべきでない情報を持つ。
サブモジュールで untrack する 195 ファイルのうち dist/ 192 件は再ビルドで復元可能であり削除しても開発に影響しない。

## 既存実装の分析

親リポジトリの .gitignore は node_modules/・.claude/state/・docs/workflows/ 等を除外しているが .claude-phase-guard-log.json・.claude/settings.json・.mcp.json のパターンが欠落している。
.claude/state/ パターンは存在するが .claude/ 直下のファイルには適用されない。.claude/state/hmac.key も別途記載されているが hmac-keys.json は別ファイルであり追跡対象のままである。
workflow-harness/.gitignore は dist/ と記載しているが実際のパスは mcp-server/dist/ であり、dist/ パターンはルート直下の dist/ にのみマッチする。mcp-server/dist/ と明示的に記述する必要がある。
mcp-server/.claude/state/ パターンは .gitignore に正しく記載されているが commit 13edf79 で git rm --cached が省略されたため既追跡 3 ファイルが残り続けている。
実装フェーズでは 2 つの .gitignore を修正し、親リポジトリで 3 ファイルを git rm --cached、サブモジュールで 195 ファイルを git rm -r --cached してから commit する。
.gitignore の修正は既存の除外パターン構造を維持したまま末尾に追記する形式で行い、既存のコメントブロック（Workflow plugin state 等）との整合性を保つ。
サブモジュールの .gitignore は dist/ を mcp-server/dist/ に変更することで明示的にサブディレクトリを指定する。既存の mcp-server/.claude/state/ パターンはそのまま維持する。
実装後の確認手順として git ls-files で対象パスへの出力がゼロになることと git status がクリーンなことを検証する。

## 実装アクション一覧

実装フェーズで実施するアクションを依存順序に従って以下に示す。
Step 1: 親リポジトリで .gitignore に 5 パターンを追記する（.claude-phase-guard-log.json・.claude/settings.json・.mcp.json・.claude/generated-files.json・.claude/settings.local.json）。
Step 2: 親リポジトリで git rm --cached を実行して 3 ファイルを index から除外する。
Step 3: workflow-harness/.gitignore の dist/ パターンを mcp-server/dist/ に変更する。
Step 4: workflow-harness で git rm -r --cached mcp-server/dist/ mcp-server/.claude/state/ を実行して 195 ファイルを untrack する。
Step 5: 親リポジトリで git add .gitignore workflow-harness してコミットする。
Step 6: workflow-harness で git add .gitignore してコミットしてから親リポジトリのサブモジュール参照を更新する。
Step 7: git status と git ls-files で除外が正しく機能していることを確認する。
git rm -r --cached は index のみを変更しワーキングツリーのファイルは削除しない。dist/ のファイルはローカルに残り npm run build でいつでも再生成できる。
hmac-keys.json のセキュリティリスクについては今回の untrack によりコミット対象から除外されるが過去のコミット履歴への対応は別タスクとする。
今後 .gitignore に追加すべきパターンが発生した場合は同様に git rm --cached を忘れずに実行すること。
git status の出力が空になることで今後のコミット操作での誤混入を防止できる。
本タスク完了後に CLAUDE.md の gitignore 運用ルールに「追跡済みファイルは git rm --cached も必須」の注記を追加することを推奨する。
今後 workflow-harness 配下に新しいビルド成果物ディレクトリが生成された場合も同様のパターン追加と untrack 手順が必要になる。
.gitignore のパターンは glob 形式で記述されており mcp-server/dist/ のように明示的なパス指定が最も確実な除外方法である。

## 暗黙の制約・Magic Number 一覧

調査で判明した数値制約・固定値を以下に示す。これらは実装フェーズで untrack 対象数の確認に使用する。
192 はビルド成果物の総数であり TypeScript ソース約 48 件から .d.ts/.js/.js.map/.d.ts.map の 4 種が生成される。
3 は state/ 配下の追跡ファイル数であり hmac-keys.json が最もセキュリティリスクが高い。
13edf79 は .gitignore を追加したコミットであり git rm --cached を省略したことが追跡継続の原因である。
195 は untrack 総数（192 + 3）であり実装後に git ls-files の出力がゼロになることを確認する。

| 値 | 用途 | 根拠・出典 |
|----|-----|-----------|
| 192 | mcp-server/dist/ 配下の追跡ファイル総数 | git ls-files mcp-server/dist/ 実測値 |
| 3 | mcp-server/.claude/state/ 配下の追跡ファイル数 | git ls-files mcp-server/.claude/state/ 実測値 |
| 64 | hmac-keys.json の SHA-256 ハッシュ文字数 | ファイル内容確認 |
| 13edf79 | .gitignore 追加コミットハッシュ（git rm --cached 省略の原因コミット） | git log --oneline |
| 195 | サブモジュールで untrack するファイル総数（192 dist + 3 state） | 算出値 |

## 依存バージョン固有挙動

本タスクは .gitignore と git コマンドのみを使用するため、ランタイムバージョンへの依存は低い。
ただし TypeScript ビルド成果物の構成は Node.js バージョンに依存するため参考として記録する。
Node v22 では dist/ 以下に .d.ts/.js/.js.map/.d.ts.map の 4 種が生成され実ソース 48 件から 192 件に膨らむ。
npm v10 は lockfileVersion 3 を使用しており node_modules/ は既に .gitignore 除外済みである。
Git の「追跡済みファイルは .gitignore を無視する」仕様は全バージョン共通であり git rm --cached が必須である。

| ライブラリ/RT | バージョン | 固有の挙動・回避策 |
|-------------|---------|---------------|
| Node.js | v22.15.0 | LTS Iron。dist/ は CJS 形式で出力。4 種の成果物ファイルを生成 |
| npm | 10.9.2 | lockfileVersion 3。node_modules/ は既に .gitignore 済みで問題なし |
| Git | システム標準 | 追跡済みファイルは .gitignore を無視する（全バージョン共通仕様）。git rm --cached が必須 |
