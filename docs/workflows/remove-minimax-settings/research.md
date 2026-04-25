# research

phase: research
task: remove-minimax-settings
status: complete

## summary

live 参照 4 ファイルの MiniMax 記述を実測調査し、削除対象の正確な行範囲と削除後影響を確定する。CLAUDE.md は lines 19-28 のセクション全体を削除対象とし、他 3 ファイルはピンポイント削除で完結する。4 操作はファイル間依存が無く並列実行可能で、AC-1..AC-5 はいずれも grep + file-exists の組合せで決定的に検証できる。

## findings

### targetFiles

- file: CLAUDE.md
  path: C:\ツール\Workflow\CLAUDE.md
  section: `## workflow-harness/.claude/settings.json 注意事項`
  lines: 19-28
  content: セクション見出し 1 行、MiniMax 注記 1 行、hooks 不在注記 1 行 + 入れ子 3 行、permissions 注記 2 行、末尾空行 1 行
  next_section_start: line 30 (空行) / line 31 (`## rtk (Rust Token Killer) 使用上の注意`)
  contextBefore: line 18 = `## セッション終了時` 配下の本文末尾
  contextAfter: line 30-31 = rtk セクション開始部
  note: セクションには MiniMax 以外の hooks 不在/permissions 警告も含まれるが scope D-SC-2 によりセクション全体削除で合意済み

- file: feedback_no-minimax.md
  path: C:\Users\owner\.claude\projects\C------Workflow\memory\feedback\feedback_no-minimax.md
  size: 15 lines
  frontmatter: `name: Do not use MiniMax backend`, `type: feedback`
  body: Why / How to apply 節で MiniMax 不使用ルールを記述
  operation: ファイル物理削除

- file: MEMORY.md
  path: C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md
  line: 96
  content: `| `feedback_no-minimax.md` | MiniMaxバックエンド使用禁止 |`
  contextBefore: line 95 = `| `feedback_recommended-option-first.md` | 推奨オプションは常にA（先頭）に配置 |`
  contextAfter: line 97 = `` (空行) + `## Key Facts`
  operation: 行 96 単独削除、表ヘッダと他行保持

- file: canboluk.md
  path: C:\Users\owner\.claude\projects\C------Workflow\memory\patterns\canboluk.md
  line: 67
  content: `| MiniMax | 2倍以上の成功率に改善 |`
  contextBefore: line 66 = `| Grok Code Fast 1 | 6.7% → **68.3%**（+61.6ポイント） |`
  contextAfter: line 68 = `| Grok 4 Fast | 出力トークン **61% 削減** |`
  operation: 行 67 単独削除、表ヘッダ (line 62-63) と他ベンチマーク行保持

- file: workflow-harness/.claude/settings.json
  path: C:\ツール\Workflow\workflow-harness\.claude\settings.json
  state: clean (grep -i minimax = 0 hits)
  operation: 変更なし (INV-1 / scope outOfScope)

### impact

- CLAUDE.md section 削除による hooks 不在情報の喪失は ADR-024 および workflow-harness/CLAUDE.md 本文で冗長記録済みのため致命的欠落にならない
- feedback_no-minimax.md 削除によるガード喪失はユーザー側の明示指示「全部消せ」を優先する (D-SC-3)
- MEMORY.md:96 削除後、Key Facts セクションに孤立参照なし (grep `feedback_no-minimax` は MEMORY.md 内で 96 行のみ)
- canboluk.md:67 削除後、表構造は Markdown table として valid、前後行で表は継続、ヘッダ列数と body 列数が一致
- live 参照の最終確認 grep は CLAUDE.md:21 の 1 箇所のみヒット、docs/ 配下と .claude/ 配下は 0 件、submodule settings.json は clean

### verification

- AC-1: `grep -c "workflow-harness/.claude/settings.json 注意事項" C:/ツール/Workflow/CLAUDE.md` が 0
- AC-2: `test ! -f "C:/Users/owner/.claude/projects/C------Workflow/memory/feedback/feedback_no-minimax.md"` で true
- AC-3: `grep -c "feedback_no-minimax" "C:/Users/owner/.claude/projects/C------Workflow/memory/MEMORY.md"` が 0
- AC-4: `grep -c "MiniMax" "C:/Users/owner/.claude/projects/C------Workflow/memory/patterns/canboluk.md"` が 0
- AC-5: 4 ファイル (CLAUDE.md + memory 配下 3 ファイル + feedback_no-minimax.md は非存在) に対する `grep -iE "minimax|m2\.7|ミニマックス"` が 0 件

## procedure

- step-1: CLAUDE.md を Edit で lines 19-29 の該当セクションを削除 (末尾空行を含め 11 行削除、次 `##` 見出し前に空行 1 行を残す)
- step-2: feedback_no-minimax.md を Bash `rm` で物理削除
- step-3: MEMORY.md を Edit で line 96 の `| feedback_no-minimax.md |...` 行を削除
- step-4: canboluk.md を Edit で line 67 の `| MiniMax |...` 行を削除
- step-5: AC-1..AC-5 の verification コマンドを Bash readonly で一括実行し 0 件 / 非存在を確認
- parallelism: step-1..step-4 はファイル間依存なしで並列実行可能、step-5 は全ステップ後に 1 回実行

## risks

- R-RS-1: CLAUDE.md の hooks 不在警告を削除すると他セッションで hooks 運用誤解が再発する可能性があるが、ADR-024 と workflow-harness/CLAUDE.md に冗長記録ありで許容
- R-RS-2: user 領域の memory ファイル (MEMORY.md / canboluk.md) は git 管理外のため変更差分がレビュー不能、手動確認が必要
- R-RS-3: canboluk.md の表で列区切り `|` の個数が削除後も一致することを目視確認する必要がある
- R-RS-4: CLAUDE.md セクション削除時に前後の空行数を誤ると次セクションとの間隔が崩れる軽微リスクあり

## decisions

- D-RS-1: 削除操作はファイル間依存が無く並列実行可能、Worker は単一 Edit バッチで 4 操作を連続実行する
- D-RS-2: 検証は grep 文字列一致と file exists の組合せで決定的に判定、曖昧な一致判定は行わない
- D-RS-3: CLAUDE.md セクション削除は見出し `## workflow-harness/.claude/settings.json 注意事項` から次の `## rtk` 見出し直前の空行まで完全削除、部分置換は行わない
- D-RS-4: canboluk.md と MEMORY.md は該当 1 行のみの削除、表の並び替えや列幅調整は行わず他行に影響を与えない
- D-RS-5: 削除後 verification は research 手順書に記載の grep コマンドを test フェーズで逐語的に再利用する

## artifacts

- path: docs/workflows/remove-minimax-settings/research.md
  role: research
  summary: 削除対象 4 ファイルの実測行範囲、削除影響分析、AC 検証手段、並列実行可能な手順を確定する
- path: docs/workflows/remove-minimax-settings/scope-definition.md
  role: input
  summary: 前フェーズ成果物、AC-1..AC-5 と INV-1..INV-5 の出所
- path: docs/workflows/remove-minimax-settings/hearing.md
  role: input
  summary: ユーザー意図と削除対象合意の出所

## next

- next: requirements
- input: docs/workflows/remove-minimax-settings/hearing.md, docs/workflows/remove-minimax-settings/scope-definition.md, docs/workflows/remove-minimax-settings/research.md
- readFiles:
  - C:\ツール\Workflow\CLAUDE.md
  - C:\Users\owner\.claude\projects\C------Workflow\memory\MEMORY.md
  - C:\Users\owner\.claude\projects\C------Workflow\memory\patterns\canboluk.md
- criticalDecisions: CLAUDE.md lines 19-28 全削除、4 操作並列可、検証は grep + file exists で決定的判定
- warnings: user 領域 memory ファイルは git diff でレビュー不可、手動確認が必要

