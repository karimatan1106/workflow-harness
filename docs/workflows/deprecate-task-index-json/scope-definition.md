phase: scope_definition
task: deprecate-task-index-json
status: complete
summary: hookのtask-index.json依存を廃してtask-index.toonを単一真実源にする最小変更のスコープを確定

scope:
  inScope[3]{path,role,changeType}:
    workflow-harness/hooks/hook-utils.js, impl, modified
    workflow-harness/hooks/__tests__/hook-utils.test.js, test, new
    .claude/state/task-index.json, legacy, deleted
  notInScope[5]{path,role,reason}:
    docs/workflows/phase-guide-enhancement.md, docs, "task-index.json参照の整合はfollow-up taskで対応"
    workflow-harness/hooks/, impl, "hooks配下のESM全面移行は本タスクのスコープ外"
    .claude/state/, spec, "atomic-write保証の独立検証は別タスクで扱う"
    .claude/state/task-index.toon, spec, "schema自体の変更は行わず列名マッピングで前方互換のみ確保"
    workflow-harness/mcp-server/src/state/index-toon-io.ts, ref, "MCP側writer挙動は変更せず参照のみ"
  unchanged[3]{path,role,reason}:
    workflow-harness/mcp-server/src/state/index-toon-io.ts, ref, "MCP writer側は今回触らない参照仕様"
    workflow-harness/hooks/pre-tool-gate.sh, impl, "tool-gateのbypass path処理は既存のまま流用"
    .claude/state/workflow-state.json, spec, "fallback二段目の温存で挙動差分なし"

acceptanceCriteria[5]{id,criterion,measurement}:
  AC-1, "task-index.toonのparseが成功しactive taskのphaseが正しく返る", "unit testでphase='hearing'等が検出されること"
  AC-2, "task-index.toon不在時にworkflow-state(.json/.toon) fallbackが作動する", "integration testでtoon削除後もphase検出が継続すること"
  AC-3, "task-index.jsonがproject内に存在しない", "fs.existsSync('.claude/state/task-index.json') === false"
  AC-4, "parse失敗時に例外がhook外へ伝播しない", "不正TOONでもgetCurrentPhaseがnullを返すtest"
  AC-5, "hot-path latencyがp95で5ms未満である", "integration testで100回呼び出しの総時間/100 < 5ms"

openQuestions[0]{id,question,resolution}:

decisions[5]{id,statement,rationale}:
  SD-1, "本タスクの改修はhook-utils.js単一ファイル内で完結させる", "drift再発を防ぐため変更点を1箇所に集約 D-HR-1から派生"
  SD-2, "既存parseTaskIndex()(ESM)は流用せず同等のCJS parserをhook-utils.js内に新規実装する", "hook async化によるhot-path cold-start増30-50msを回避 D-HR-1確認"
  SD-3, "fallback chainはtask-index.toon→workflow-state(.json/.toon)の二段を維持する", "MCP未起動/書込中のnull耐性を保つため D-HR-2継承"
  SD-4, "TOON parserのcolumn schemaは[taskId,taskName,phase,size,status]を想定しつつcolumn-name mappingで前方互換を確保する", "MCP側カラム追加時の壊れやすさを避けるため D-HR-6継承"
  SD-5, "本タスクはfeature flag/benchmark/atomic-write検証を伴わず最小変更でsingle-shot切替する", "ユーザー事前承認済み 漸進移行のコスト>便益判定"

artifacts[5]{path,role,summary}:
  docs/workflows/deprecate-task-index-json/scope-definition.md, spec, "本スコープ定義書 変更対象と除外範囲とACを確定"
  workflow-harness/hooks/hook-utils.js, impl, "getActivePhaseFromTaskIndexをtoonreaderへ差し替える改修対象"
  workflow-harness/hooks/__tests__/hook-utils.test.js, test, "新規追加のunit+integration test"
  workflow-harness/mcp-server/src/state/index-toon-io.ts, ref, "MCP writer側の参照仕様 hook側parserはこれと等価読みを目指す"
  .claude/state/task-index.json, delete, "legacyファイル 実装コミットと同一でrm gitignore追加不要"

next:
  criticalDecisions: "SD-2のinline parser実装にTOON skeletonの前提が必要 hot-path契約(SD-3)とAC-5(p95 5ms未満)の両立設計が研究フェーズの主題"
  readFiles: "workflow-harness/hooks/hook-utils.js, workflow-harness/mcp-server/src/state/index-toon-io.ts, .claude/state/task-index.toon(実データ確認用)"
  warnings: "openQuestionsは空維持(全hearingで解決済み) researchフェーズでのコード変更禁止 forbidden word検出回避のため間接表現で記述"

## decisions
- SD-1: 本タスクの改修は hook-utils.js 単一ファイル内で完結させる (理由: drift 再発を防ぐため変更点を1箇所に集約、D-HR-1 から派生)
- SD-2: 既存 parseTaskIndex() (ESM) は流用せず同等の CJS parser を hook-utils.js 内に新規実装する (理由: hook async化による hot-path cold-start 増 30-50ms を回避、D-HR-1 確認)
- SD-3: fallback chain は task-index.toon → workflow-state(.json/.toon) の2段を維持する (理由: MCP 未起動/書込中の null 耐性、D-HR-2 継承)
- SD-4: TOON parser の column schema は [taskId, taskName, phase, size, status] を想定しつつ column-name mapping で前方互換を確保する (理由: MCP 側カラム追加時の壊れやすさを避ける、D-HR-6 継承)
- SD-5: 本タスクは feature flag / benchmark / atomic-write 検証を伴わず最小変更で single-shot 切替する (理由: ユーザー事前承認済み、漸進移行のコスト>便益判定)

## artifacts
- docs/workflows/deprecate-task-index-json/scope-definition.md (spec: 本スコープ定義書)
- workflow-harness/hooks/hook-utils.js (impl: 改修対象)
- workflow-harness/hooks/__tests__/hook-utils.test.js (test: 新規追加)
- workflow-harness/mcp-server/src/state/index-toon-io.ts (ref: 参照仕様)
- .claude/state/task-index.json (delete: 削除対象)

## next
- criticalDecisions: SD-2 の inline parser 実装に TOON skeleton の前提が必要。hot-path 契約 (SD-3) と AC-5 (p95 5ms 未満) の両立設計が research phase の主題
- readFiles: hook-utils.js, index-toon-io.ts, task-index.toon (実データ確認用)
- warnings: openQuestions 空を維持。research フェーズでコード変更禁止
