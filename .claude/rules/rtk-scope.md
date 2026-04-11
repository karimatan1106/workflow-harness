# RTK (Rust Token Killer) Scope

rtk hook は Bash ツール呼び出しのみ書き換える。以下のツール/構文は効かないため、圧縮を期待した設計をしない。

## 効く: Bash tool 経由のコマンド
- `git status`, `ls`, `cat`, `grep`, `find` 等100+コマンドが自動で `rtk <cmd>` に書き換わる
- Worker の test/lint/git 実行で顕著

## 効かない: Claude Code 組込ツール
- Read — ファイル読み取り。rtk hook は発火しない
- Grep — ripgrep 検索。bypass
- Glob — ファイルパターンマッチ。bypass
- 圧縮したい場合は Bash 経由で `rtk read` / `rtk grep` / `rtk find` を明示呼び出しする

## 効かない: heredoc 内部
- `bash <<'EOF' ... EOF` 内の git/grep/cat はそのまま実行される
- git commit の HEREDOC メッセージ運用は rtk bypass される

## 効かない: 未登録コマンドと `rtk ` 既付与
- 登録されていないコマンドは pass-through
- すでに `rtk ` prefix 済みは二重書き換えしない

## lossy compression の注意
- rtk は filter/truncate/dedupe する lossy 圧縮
- デバッグで raw 出力が必要な場面は `~/.local/share/rtk/tee/` に失敗時のみ保存される
- DoD ゲートや AC 検証で完全な出力が要るときは素コマンドを使う

## Overhead
- コマンドあたり +5〜15ms
- 大量ループや超高速コマンドでは相対的に効いてくる

## Telemetry opt-out
- デフォルトで匿名 usage metrics を1日1回送信
- 送信内容: device hash (salted SHA-256), OS, arch, rtk version, top command names, 推定 savings%
- 送信されないもの: source code, file paths, command args, secrets, 環境変数, PII
- `~/.config/rtk/config.toml` で `[telemetry] enabled = false` に設定済み
- 環境変数での追加遮断は `RTK_TELEMETRY_DISABLED=1`

## パッケージ識別
- crates.io の `rtk` は別物 (Rust Type Kit)
- rtk-ai/rtk (Rust Token Killer) は GitHub release または `cargo install --git` で取得
- `rtk gain` が動けば正しい

## Disclaimer
- rtk は AS IS 無保証で提供される。ファイルシステムや外部コマンドと対話するため、環境適合性の検証は利用者責任
- 事前ビルド binary は利便性目的であり、checksum 検証は利用者責任
