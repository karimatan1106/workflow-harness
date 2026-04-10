# workflow-harness セットアップ

## 前提

- bash (Git Bash on Windows 可)
- Node.js 18+ / npm
- curl または wget
- unzip

## 自動インストール

以下を実行すると rtk / Claude Code hooks / skill・rule・agent 同期 / MCP サーバー build が一括で走る。

    bash workflow-harness/setup.sh

setup.sh は以下を自動で行う:

- rtk (Rust Token Killer) バイナリを GitHub releases から取得し `${HOME}/.local/bin/` に配置
  - 既にインストール済みの場合はスキップ
  - サポート OS: Linux (x86_64/aarch64), macOS (x86_64/aarch64), Windows (x86_64)
- jq の存在確認 (無い場合は警告のみ、自動導入はしない)
- Claude Code hooks の登録
- MCP サーバーの npm install + build

## 手動で必要なもの

### jq

setup.sh では自動導入しない。OS 別に:

- Linux: `sudo apt install jq` (Debian/Ubuntu) 等
- macOS: `brew install jq`
- Windows: `scoop install jq` または `winget install jqlang.jq`

### $PATH の確認

`${HOME}/.local/bin` を $PATH に追加しておくこと。`.bashrc` / `.zshrc` 等に:

    export PATH="$HOME/.local/bin:$PATH"

## 動作確認

    rtk --version    # 0.23.0 以降
    jq --version
    bash -n workflow-harness/setup.sh

## トラブルシューティング

- rtk または jq が見つからない場合、`workflow-harness/.claude/hooks/rtk-rewrite.sh` は警告を stderr に出して pass-through する (fatal ではない)。rtk 圧縮が効いていないだけなので、setup.sh の出力を確認して手動で対処する。
- 詳細な rtk スコープ/制約は `.claude/rules/rtk-scope.md` を参照。
