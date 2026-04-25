phase: research
task: deprecate-task-index-json
status: complete
inputArtifact: docs/workflows/deprecate-task-index-json/scope-definition.md
summary: hook-utils.jsのtask-index.json読みをtask-index.toon読みへ差し替えるinline CJS parserの設計根拠と検証観点を確定

existingPatterns[4]{id,pattern,location,description}:
  EP-1, "silent-null on parse failure", "hook-utils.js:25-31 (getActivePhaseFromTaskIndex) と hook-utils.js:40-65 (readToonPhase)", "JSON/TOON解釈失敗時はcatchでnull/undefinedを返しhot-pathを停止させない既存規範"
  EP-2, "head-bounded read 4KB / 64KB", "hook-utils.js:8-9 TOON_HEAD_BYTES=4096 TOON_LARGE_FILE_THRESHOLD=65536", "大きなtoonファイルはfs.readSyncで頭部のみ取得しhotpath latencyを境界化する既存設計"
  EP-3, "fallback chain composition", "hook-utils.js:110-113 (getCurrentPhase) が taskIndex ||workflowState を直列合成", "1段目null時に2段目を即試行するnull-coalescing的連鎖パターン"
  EP-4, "toon table header format", ".claude/state/task-index.toon:1", "tasks[N]{col1,col2,...}:ヘッダ + インデント2スペースCSV行 + 末尾updatedAt行の3要素構造"

magicNumbers[3]{value,location,purpose,rationale}:
  4096, "hook-utils.js:8 TOON_HEAD_BYTES", "toon head部分読みバイト上限", "ADR-029 AC-2基準で設定済み 今回も流用しparse正規表現の入力サイズを境界化"
  65536, "hook-utils.js:9 TOON_LARGE_FILE_THRESHOLD", "64KB超で部分読みに切替える閾値", "task-index.toon実サイズは数百バイト前提 閾値未満なら全読みで安全"
  5, "scope-definition.md AC-5 の p95 latency budget (ms)", "PreToolUse hot-path予算", "D-HR-3でhearingが合意 Read/Edit/Bash全発火に乗算されるため"

implicitConstraints[5]{id,constraint,source,impact}:
  IC-1, "hooks/はCommonJS requireでしか関数を呼べない", "hook-utils.js:2-3 と scope-definition.md SD-2", "ESM専用のparseTaskIndexを直接import不可、inline CJS parserを新規実装する設計強制"
  IC-2, "hookはsyncのみ Promiseで遅延させない", "hook-utils.js全関数同期 / D-HR-1根拠", "dynamic importはasync化を誘発し採用不可"
  IC-3, "column schemaはMCP writerが事実上の仕様", "index-toon-io.ts:9-15 TaskIndexEntry", "hook側parserは同interfaceのphase/statusを最低限抽出できれば足りる"
  IC-4, "active判定はstatus not completed and not idle", "hook-utils.js:29 既存find条件", "新parserでも同一論理を保ち意味論退行を防ぐ"
  IC-5, "tool-gateはphase=nullでも動作継続", "ADR-029参照 + hook-utils.js:110-113", "TOON/workflow-state両方null時もhookがhardfailしない既存許容の温存が必要"

fileAnalysis[3]{path,lines,keyFindings}:
  "workflow-harness/hooks/hook-utils.js", "150", "getActivePhaseFromTaskIndex(22-32)が唯一のJSON reader、読み対象パスはprojectRoot/.claude/state/task-index.json固定、data.tasksまたはdata配列に対応、find条件でactive抽出、例外はcatch-allでnull"
  "workflow-harness/mcp-server/src/state/index-toon-io.ts", "37", "serializeTaskIndex=toonEncode(TaskIndex)、parseTaskIndex=toonDecodeSafe、TaskIndexEntryの5列はtaskId/taskName/phase/size/status、updatedAtをroot直下に保持"
  ".claude/state/task-index.toon", "7", "実データでheader=tasks[4]{taskId,taskName,phase,size,status}:、行は2スペインデントCSV、カンマ含む値はなし、末尾updatedAt=ISO8601文字列ダブルクオート付"

parserDesignPseudocode[1]{id,listing}:
  "PD-1", "function readTaskIndexToon(projectRoot){ p = join(projectRoot,'.claude','state','task-index.toon'); if(!existsSync(p)) return null; text = readToonHeadFromFile(p); if(!text) return null; header = text.match(/^tasks\\[(\\d+)\\]\\{([^}]+)\\}:\\s*$/m); if(!header) return null; cols = header[2].split(',').map(s=>s.trim()); phaseIdx = cols.indexOf('phase'); statusIdx = cols.indexOf('status'); if(phaseIdx<0||statusIdx<0) return null; lines = text.split(/\\r?\\n/).slice(headerLineNo+1).filter(l=>/^\\s+\\S/.test(l)); tasks = lines.map(l=>{ parts = splitCsv(l.trim()); return { phase: parts[phaseIdx], status: parts[statusIdx] }; }); active = tasks.find(t=>t.status!=='completed' && t.status!=='idle'); return active ? (active.phase||null) : null; }"

integrationPlan[1]{id,description}:
  "IP-1", "getActivePhaseFromTaskIndex関数名は維持しつつ実装のみ差し替える 呼び出し側(hook-utils.js:111 getCurrentPhase)は変更不要 signature(projectRoot)→stringOrNull完全互換 module.exportsも既存列をそのまま保つ"

risksVerified[4]{id,risk,mitigation}:
  "RV-1", "TOONファイル不在(MCP未起動等)", "existsSyncでnull即返 既存workflow-state fallback(hook-utils.js:86-108)が発動"
  "RV-2", "MCP書込中のpartial line混入", "正規表現がheader行を単独でアトミック検出できない場合nullを返しfallbackへ"
  "RV-3", "列順変更や新列追加", "cols.indexOfで名前解決 順序非依存 D-HR-6と整合"
  "RV-4", "不正値や非ASCIIでregex爆発", "quantifierは[^}]+と\\d+のみで有限 TOON_HEAD_BYTES(4KB)で入力を境界化"

testVectors[6]{id,description,expectation}:
  "TV-1", "1件activeタスクを含むvalid TOON", "active.phase文字列を返す"
  "TV-2", "全タスクcompleted", "null返却"
  "TV-3", "task-index.toonファイル不在", "null返却、getCurrentPhaseはworkflow-stateへ委譲"
  "TV-4", "header行欠損の不正TOON", "null返却で例外外漏なし"
  "TV-5", "tasks[0]{...}の空テーブル", "active未検出でnull"
  "TV-6", "taskNameにUnicodeと空白", "phase列は正しく抽出されstatus判定成立"

decisions[5]{id,statement,rationale}:
  "R-1", "既存readToonPhaseやreadToonHeadFromFileを再利用せず新規readTaskIndexToonを定義する", "readToonPhaseは単一phase:キー抽出 新関数はtableヘッダ解釈で責務が異なり混在させると200行制約にも抵触しやすい"
  "R-2", "header抽出は正規表現/^tasks\\[(\\d+)\\]\\{([^}]+)\\}:\\s*$/mを基本形とする", "TOON table formatはsimpleで完全parser不要 有限quantifierでAC-5の5ms予算に収まる"
  "R-3", "task-index.toonは既存readToonHeadFromFileで4KB/全読みの既存分岐に委ねる", "典型サイズ1KB前後 閾値未満は全読みで末尾途切れリスクなし readToonHeadFromFileの返却undefinedもnull扱いで吸収"
  "R-4", "列順は[taskId,taskName,phase,size,status]を既定としつつ実装はcols.indexOfで名前解決する", "index-toon-io.tsのTaskIndexEntryが事実上のsingle source of truthだが D-HR-6前方互換のため名前解決に統一"
  "R-5", "parse error時はログ出力せずnull返却する", "hot-path I/Oのレイテンシ悪化を避け readToonPhaseのsilent degradation規範と整合 D-HR-7継承"

artifacts[4]{path,role,summary}:
  "docs/workflows/deprecate-task-index-json/research.md", report, "本研究成果物 parser設計根拠とtest vectorをplanningへ引き渡す"
  "workflow-harness/hooks/hook-utils.js", ref, "改修対象の現行実装 22-32行のJSON reader置換範囲"
  "workflow-harness/mcp-server/src/state/index-toon-io.ts", ref, "MCP writer側schema参照元 TaskIndexEntry 5列定義"
  ".claude/state/task-index.toon", ref, "実データ参照 header形式とCSV行の現物実例"

next:
  criticalDecisions: "R-2の正規表現パターンはplanningで明文化し単体testで固定化する R-3の全読み方針はintegration testでサイズ境界ケースを追加する"
  readFiles: "workflow-harness/hooks/hook-utils.js(実装時参照) workflow-harness/mcp-server/src/state/index-toon-io.ts(schema確認) .claude/state/task-index.toon(実データ確認)"
  warnings: "research phaseではソースコード変更禁止の制約を最後まで遵守する 実装はimplementation phaseで着手する"

## decisions
- R-1: 既存 readToonPhase / readToonHeadFromFile を再利用せず新規 readTaskIndexToon を定義する (理由: readToonPhase は単一 `phase:` キー抽出用途で、tableヘッダ解釈とは責務が異なるため)
- R-2: header抽出は正規表現 /^tasks\[(\d+)\]\{([^}]+)\}:\s*$/m を基本形とする (理由: TOON table format は simple で full parser 不要、有限 quantifier で AC-5 の 5ms 予算クリア)
- R-3: task-index.toon は readToonHeadFromFile に委ね 4KB/全読みの既存分岐を流用する (理由: 典型サイズ 1KB 前後で全読みも安全、部分読みは末尾切断リスクを避ける)
- R-4: 列順は [taskId,taskName,phase,size,status] を既定としつつ実装は cols.indexOf で名前解決する (理由: index-toon-io.ts の TaskIndexEntry が single source of truth だが、D-HR-6 前方互換のため名前解決に統一)
- R-5: parse error 時はログ出力せず null を返却する (理由: hook hot-path で I/O レイテンシ増を避ける、既存 readToonPhase の silent degradation 規範と整合)

## artifacts
- docs/workflows/deprecate-task-index-json/research.md (report: 本研究成果物)
- workflow-harness/hooks/hook-utils.js (ref: 改修対象の現行実装)
- workflow-harness/mcp-server/src/state/index-toon-io.ts (ref: MCP writer 側 schema 参照元)
- .claude/state/task-index.toon (ref: 実データ参照)

## next
- criticalDecisions: R-2 の正規表現パターンを planning で明文化し単体 test で固定化する / R-3 の全読み方針は integration test でサイズ境界ケースを追加する
- readFiles: hook-utils.js (実装時参照), index-toon-io.ts (schema 確認), task-index.toon (実データ確認)
- warnings: research phase ではソースコード変更禁止の制約を遵守する。実装は implementation phase で着手する
