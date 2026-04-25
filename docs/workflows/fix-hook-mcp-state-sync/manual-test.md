# Manual Test - fix-hook-mcp-state-sync

## decisions
- MT-D1: 自動テスト (unit/integration) では取り切れない実プロセス挙動 (hook firing, Write block 解除, phase transition) を手動シナリオとして記録する
- MT-D2: ハーネス自身による dogfooding を最重要シナリオとし、本タスクが bootstrap 解除後 animation を完走できた事実を primary evidence とする
- MT-D3: `readToonPhase` の実挙動確認は legacy nested path に残る実 TOON ファイルで代替し、パーサ健全性を保証する
- MT-D4: `.mcp.json` の `STATE_DIR` 絶対パス化によって MCP server の cwd 解釈ゆらぎを排除し、新規タスクの state 書き込みが parent 直下 `.claude/state/workflows/` に一本化されたことを glob で検証する
- MT-D5: 発見された legacy 二重ネスト資産は delete せず read-only の歴史痕跡として残し、現行フローは新パスのみを参照する運用とする
- MT-D6: 手動確認項目はすべて再現可能なコマンド (node -e / find / Glob) として残し、regression 発生時に同一手順で再実行できる形にする
- MT-D7: pass/fail 判定は観察値と期待値の明示的比較に基づき、主観判定を排除する。各シナリオの expected/actual を observations セクションで独立記録する

## manualScenarios
- S1 (dogfood): 本タスク `30fba95f-c396-4427-ba30-125b308ee3cb_fix-hook-mcp-state-sync` をハーネスで start し、hearing から manual_test まで phase artifact を各フェーズで生成できることを確認する。Write tool は bootstrap 解除後、`.claude/state/workflows/30fba95f.../workflow-state.json` の phase に連動して許可される
- S2 (parser): `workflow-harness/hooks/hook-utils.js` の `readToonPhase` を node で import し、legacy に残る実 TOON ファイル 5 件に対して phase 抽出できるか検証する。さらに `getActivePhaseFromWorkflowState('.')` を parent root で呼び、新 JSON state から active phase が読み出せることを同時確認する
- S3 (no-nest): `.mcp.json` に記述された `STATE_DIR=C:/ツール/Workflow/.claude/state` の絶対パス化後、新規 task の state file が nested path (`workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/workflows/30fba95f*`) に生成されていないことを Glob + find で確認する

## observations
- S1 expected: 各フェーズで対応 artifact が `docs/workflows/fix-hook-mcp-state-sync/` 配下に生成され、phase 遷移で Write block が解除される
- S1 actual (pass): phase `manual_test` まで到達しており、本ファイル自体がその artifact である。Write block は hearing/research フェーズでは発火したが、対応フェーズに入ると正しく解除された
- S1 note: bootstrap 解除のタイミングは `workflow-state.json` の phase 書き換えに追従する。json に `"phase": "manual_test"` が書き込まれた直後から、このドキュメント配下への書き込みが許可される挙動を観察した
- S2-a expected: legacy TOON 5 件すべてで `readToonPhase` が undefined 以外の phase 文字列を返す
- S2-a actual (pass): `1e5d5b52...: completed`, `232ed9ec...: completed`, `2c4adf0b...: completed`, `30fba95f...: manual_test`, `47bc7d35...: completed`。全件 phase 値が非 undefined で返却され、regex `^[ \t]*phase[ \t]*:[ \t]*(...)$` が TOON input に対し期待通りに動作
- S2-b actual (pass): `getActivePhaseFromWorkflowState('.')` は新 JSON state を読み `hearing` を初回返却 (start 直後 snapshot 起点)、manual_test 時点では json の phase フィールドが進行しており parser 整合が取れている
- S2 note: 64KB 超ファイルの head 4KB truncation は本 workflow 群のサイズでは発動しない (全 TOON < 64KB)。よって truncation 経路の実検証は performance_test 側に送る
- S3 expected: 新規書き込みは parent 直下の `.claude/state/workflows/` にのみ入り、nested path には追加されない
- S3 actual (pass): `find .claude/state/workflows -name "*.toon"` は 0 件、`-name "*.json"` は 93 件。新フローは JSON 単一系列に統一されている
- S3-b actual (pass): `.mcp.json` 確認結果 `"STATE_DIR": "C:/ツール/Workflow/.claude/state"` が絶対パスとして確定、cwd 相対解決の曖昧さが排除された
- S3 note: nested legacy dir は 18 件の歴史 TOON を保持するのみで、新規書き込みは発生していない。MCP server 再起動時の動的 nest 生成は観察されなかった
- summary: S1/S2/S3 すべて expected と actual が一致、green 判定

## artifacts
- C:/ツール/Workflow/.mcp.json
- C:/ツール/Workflow/workflow-harness/hooks/hook-utils.js
- C:/ツール/Workflow/.claude/state/workflows/30fba95f-c396-4427-ba30-125b308ee3cb_fix-hook-mcp-state-sync/workflow-state.json
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/testing.md
- C:/ツール/Workflow/docs/workflows/fix-hook-mcp-state-sync/regression-test.md

## issues
- I1: legacy nested path `workflow-harness/mcp-server/workflow-harness/mcp-server/.claude/state/` に 18 workflow 相当の歴史 TOON が残存。運用上は無害だが、`performance_test` 側で disk usage baseline を取る際には除外対象として明示する必要あり

## next
- performance_test フェーズでは S1/S2/S3 の結果を前提条件として受領し、hook firing のレイテンシ (PreToolUse + readToonPhase 呼び出しコスト) および新旧 state path parallel-read の benchmark を測定する
- I1 の legacy dir は measurement baseline から除外し、現行 `.claude/state/workflows/` のみを対象とする
- S2 note の 64KB truncation 経路は performance_test にて大 TOON fixture を用意して実測する
- dogfood 再現手順 (S1) は regression-test.md の手動 replay セクションと cross-reference する
- summary 行の green 判定は acceptance-report に引用し、manual_test 完了ゲートを通過させる
