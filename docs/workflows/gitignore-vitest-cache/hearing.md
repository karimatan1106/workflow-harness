# Hearing: gitignore-vitest-cache

taskId: c1fce747-120d-47fd-81a4-a45de9cea3c9
phase: hearing
status: complete
size: small
mode: express
date: 2026-04-25

summary: workflow-harness submodule の persistent dirty marker (`m workflow-harness`) を解消するため、vitest が生成する一時キャッシュ/出力ファイルを `workflow-harness/.gitignore` に追記する。Express mode 適用、AskUserQuestion 不要 (HANDOFF にて事前確定済み)。

userResponse: User-explicit: Express mode、3-pattern ignore で gitignore に追記、submodule dirty marker 解消。AskUserQuestion 不要 (HANDOFF で事前確定済み)。

## intent-analysis

problem: vitest 実行時に submodule (`workflow-harness`) 配下へ `node_modules/.vite/` キャッシュおよび `mcp-server/vitest-out.json` 出力が生成される。これらは git tracked ではないが、submodule の working tree が dirty になり、親リポジトリの `git status` に常時 `m workflow-harness` が表示される。
impact: ハンドオフ生成時のノイズ、誤った変更検知、コミット前確認の手間増。
rootCause: `.gitignore` に vitest 由来の transient artifact が登録されていない。
constraints:
- 既存の ignore ルールを破壊しない (append-only)
- node_modules 全体の ignore は既存設定を尊重し、`.vite` 限定の追加で十分
- `mcp-server/vitest-out.json` は単一パスで指定可能

## implementation-plan

target: workflow-harness/.gitignore (append のみ)
patterns:
- `**/node_modules/.vite/` — vitest の依存解析キャッシュ (任意の深さの node_modules 配下)
- `**/.vite/` — ルート配下や非 node_modules 階層の vite キャッシュ
- `mcp-server/vitest-out.json` — vitest 出力レポートファイル (固定パス)
verification:
- `git status` で `workflow-harness` が clean になること
- vitest 実行後も dirty にならないこと
- 既存の tracked ファイルが untrack されないこと (`git check-ignore -v` で意図しない一致がないこと)

## decisions

- HR-001: 3 パターン (`**/node_modules/.vite/`, `**/.vite/`, `mcp-server/vitest-out.json`) を append する。vite キャッシュは深さ可変のため glob `**/` を採用し、出力ファイルは固定パス指定で曖昧性を排除する。
- HR-002: Express mode を採用し phase 数を最小化する。変更対象が単一ファイルへの append のみで影響範囲が確定しているため、full hearing/scope/research の 30 phase 走行は過剰。
- HR-003: AskUserQuestion を発行しない。ユーザーが action / patterns / reasoning を事前確定済 (HANDOFF.toon にて) であり、追加合意事項なし。userResponse フィールドへ事前合意内容をそのまま記録する。

## artifacts

- docs/workflows/gitignore-vitest-cache/hearing.md: spec: ユーザーヒアリング結果。Express mode 採用、3 パターン append、submodule dirty marker 解消が目的。

## next

- criticalDecisions: HR-001 (3 パターン append), HR-002 (Express mode), HR-003 (AskUserQuestion 不要)
- readFiles: workflow-harness/.gitignore
- warnings: append 時に既存の最終行と空行衝突しないよう末尾改行を確認する。`**/` glob が想定外のディレクトリへ波及していないか `git check-ignore` で事後検証する。
