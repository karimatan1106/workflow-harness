# Security Scan: separate-workflow-harness-from-parent

## scope
Phase A で workflow-harness submodule に移管された資産に対する secrets / permissions / config の検査を記録する。対象: ADR (docs/adr), workflow-phases (.claude/workflow-phases), hooks (.claude/hooks 配下の 13 本), commands (.claude/commands), rules (.claude/rules), .mcp.json 1 ファイル, .gitignore 1 ファイル。親リポから submodule へ cp -p 経由で持ち込んだ範囲と、submodule 既存ファイルのうち本 Phase の境界に影響する項目を含む。

## methodology
- secrets 検査: ripgrep 互換の grep -rIE で `api[_-]?key|secret|password|token|BEGIN (RSA|OPENSSH) PRIVATE KEY` を対象ディレクトリに対して再帰検索し、Binary 行を除外して先頭 20 行を確認。
- permissions 検査: `git ls-files -s .claude/hooks/` で Git に記録された mode bits を取得し、実行ビット (100755) の有無を個別に確認。`ls -la` の出力は NTFS + Git Bash 環境で信頼できないため採用しない。
- config 検査: `jq '.mcpServers["workflow-harness"].cwd' .mcp.json` で cwd 値を確認し、絶対パスや親ディレクトリ参照 (`..`) が含まれないことを確認。
- commit log 検査: `git log --all --format='%H %s'` に対し secrets 相当パターンを grep してメッセージ側への漏洩を確認。
- threat-model との整合: 同 Phase の threat-model.md の STRIDE 評価 (E のみ Medium, 他 Low) を参照。

## findings
- SC-1 [INFO] secrets grep 実行結果は 2 行のみヒット。いずれも false positive。
- SC-1a .claude/hooks/rtk-rewrite.sh: `# RTK Claude Code hook — rewrites commands to use rtk for token savings.` ヘッダコメントの "token" は rtk (Rust Token Killer) の一般名詞であり credential ではない。
- SC-1b .claude/rules/rtk-scope.md: `送信されないもの: source code, file paths, command args, secrets, 環境変数, PII` は telemetry opt-out 仕様の説明文であり credential そのものではない。
- SC-2 [WARN] hooks mode bits: 13 本すべてが Git index 上 `100644` で記録されており、`100755` の実行ビットは付いていない。Linux/macOS 環境で git checkout した直後は実行権限が付与されないため、setup.sh か hook 起動側で `chmod +x` するか、Git mode bits を `100755` に更新する必要がある。Windows の NTFS + Git Bash では実行可否が mode bits と独立して扱われるため、Phase A testing が Green になっても Linux 移植時に顕在化する可能性がある。
- SC-3 [INFO] .mcp.json cwd 値は `"."` 固定。絶対パス参照 (`C:/...`) や親ディレクトリ参照 (`..`) は含まれない。MCP サーバは submodule ルートを cwd として起動し、親リポのファイルへ暗黙アクセスしない。
- SC-4 [INFO] .gitignore は f834228 で MCP runtime state (debug log, metrics, task index 等) を除外済み。runtime に動的生成される情報がコミット経由で外部流出するリスクを低減している。
- SC-5 [INFO] git log 全履歴に対する secrets パターンの grep はヒット 0 件。commit メッセージ経由での漏洩なし。
- SC-6 [NOTE] submodule 既存ファイルのうち setup.sh, package.json, mcp-server/ 配下は本 Phase の移管対象ではなく、本スキャンの主対象外。ただし .mcp.json の cwd が submodule ルートを指すため mcp-server/dist/index.js の起動範囲は submodule 内部に閉じる。
- SC-7 [PASS] threat-model.md の STRIDE 評価 (S/T/R/I/D=Low, E=Medium) と本スキャンの結果は整合。E の Medium は hook 実行権限維持の要件に対応し、SC-2 がその実装不備を顕在化させた。

## decisions
- D-SC-1: secrets 検査結果 (SC-1) は false positive のみ。移管対象への credential 混入なしと判定し ACCEPT する。
- D-SC-2: hooks mode bits が 100644 のままである事実 (SC-2) は Phase A の受入基準に対する deviation として記録する。ただし Windows 開発環境での testing が Green であり、かつ Phase B で standalone clone + setup.sh 実行時に `chmod +x .claude/hooks/*.sh` を setup.sh 側で保証することで mitigate する方針に合意する。後続コミットで setup.sh に chmod ステップを追加するか、`git update-index --chmod=+x` で mode bits を更新するかは Phase B の implementation で決定する。
- D-SC-3: .mcp.json の cwd=`.` 固定 (SC-3) は submodule の可搬性と cwd 境界閉じ込めの両要件を満たす。変更不要。
- D-SC-4: .gitignore による MCP runtime state 除外 (SC-4) は secrets 流出リスクを低減する実装であり維持する。
- D-SC-5: commit log に機密文字列混入なし (SC-5) を確認したため履歴書き換えは不要。
- D-SC-6: 本スキャンの結果 SC-2 を条件付き mitigation として受入れ、残りは問題なしとして security_scan フェーズを通過させる。

## risks
- R-SC-1 [MED]: Linux/macOS で submodule を clone 直後、hooks に実行権限が付かず harness enforcement が無効化される可能性がある。mitigation は D-SC-2 参照。
- R-SC-2 [LOW]: Windows Git の改行処理差分 (CRLF vs LF) により shell script の shebang が機能しないケース。Phase B で standalone 検証時に確認する。
- R-SC-3 [LOW]: submodule の pre-existing hook (pre-tool-guard.sh の旧実装等) と本 Phase で移管した同名ファイルの差分に由来する regression は、Phase A testing の Green で検出されなかったが edge case で再発する可能性がある。
- R-SC-4 [LOW]: .mcp.json の cwd=`.` は submodule ルート前提であり、親リポから `cd workflow-harness && claude ...` の起動パターンに依存する。親リポルートから直接 MCP サーバを起動した場合は解決パスが異なる。

## artifacts
- workflow-harness@c5f5ce1: parent assets import (Phase A の本体コミット)
- workflow-harness@f834228: gitignore runtime state 追加
- docs/workflows/separate-workflow-harness-from-parent/threat-model.md: STRIDE 評価
- docs/workflows/separate-workflow-harness-from-parent/security-scan.md: 本ファイル
- .claude/hooks/ 配下 13 本 (context-watchdog, handoff-reader, handoff-validator, harness-enforce, post-commit-auto-push, post-tool-lint, pre-compact-context-save, pre-tool-config-guard, pre-tool-gate, pre-tool-guard, pre-tool-no-verify-block, rtk-rewrite, test-guard)
- .mcp.json: cwd=`.` 設定

## next
performance_test フェーズへ進む。本 Phase は既存資産の位置変更のみで計算量・I/O 量に変化はないため性能測定は軽量な baseline 記録に留める。加えて D-SC-2 で合意した hooks mode bits の恒久対応 (setup.sh 側の chmod or git mode bits 更新) を Phase B implementation のバックログに積む。
