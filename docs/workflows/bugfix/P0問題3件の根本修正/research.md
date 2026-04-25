# P0問題3件の根本修正 - 調査レポート

## サマリー

本調査はworkflow-pluginのレビューで発見されたP0（致命的）問題3件の根本原因を特定するために実施した。
各問題の影響範囲とコード上の具体的な箇所を明確にし、次フェーズ（要件定義・設計）に必要な情報を整理する。

### 目的

P0問題3件（ユーザー意図マッピング欠如、バリデーション形式チェックのみ、レース条件）の根本原因を特定し、
修正方針の策定に必要な情報をコードレベルで収集する。

### 主要な発見事項

- P0-1: `resolvePhaseGuide`でuserIntentが伝播されるが、自動スコープ設定がなく、scopeが空の場合test_implがスキップされる致命的な欠陥がある
- P0-2: `PHASE_TO_ARTIFACT`にはresearch/requirements/test_designの3フェーズのみ登録されており、他フェーズの成果物バリデーションが欠落している
- P0-3: `writeTaskIndexCache`はfs.writeFileSyncで非アトミックに書き込むため、並行実行するフック間でレース条件が発生する

### 次フェーズで必要な情報

- P0-1修正: userIntentからスコープを自動推定する機能をresearchフェーズ完了時に実装する必要がある
- P0-2修正: PHASE_TO_ARTIFACTを全フェーズに拡張し、意味的品質チェックを追加する必要がある
- P0-3修正: write-then-renameパターン（アトミック書き込み）でtask-index.jsonの書き込みを保護する必要がある

---

## 調査結果

### 調査対象ファイル一覧

本調査では以下のファイルを重点的に調査した。

| ファイル | 役割 |
|---------|------|
| workflow-plugin/mcp-server/src/phases/definitions.ts | フェーズ定義・PHASE_GUIDESを含む中核ファイル |
| workflow-plugin/mcp-server/src/phases/next.ts | フェーズ遷移ロジック・PHASE_TO_ARTIFACTを含む |
| workflow-plugin/mcp-server/src/phases/set-scope.ts | スコープ設定APIの実装 |
| workflow-plugin/hooks/discover-tasks.js | タスクインデックスキャッシュ管理 |
| workflow-plugin/mcp-server/src/artifact-validator.ts | 成果物品質バリデーション |

### P0-1の根本原因

`workflow_set_scope`が呼ばれない場合、スコープが空のまま`parallel_analysis`フェーズに到達してブロックされる。
subagentのchecklistにスコープ設定指示が存在しないため、Orchestratorが忘れた場合に必ずこの問題が発生する。

### P0-2の根本原因

`PHASE_TO_ARTIFACT`に登録済みのフェーズが3件のみであるため、大多数のフェーズで成果物品質チェックが実行されない。
`checkPhaseArtifacts`関数はPHASE_TO_ARTIFACTを参照するため、登録されていないフェーズはスキップされる。

### P0-3の根本原因

`fs.writeFileSync`は非アトミック操作であり、複数フックプロセスが同時実行された場合に書き込み競合が発生する。
30秒のTTLが切れるタイミングで複数プロセスが同時にディレクトリスキャンを実行し、競合が頻発する。

---

## P0-1調査結果: ユーザー意図からコードへの自動マッピング欠如

### workflow_set_scopeが呼ばれない場合の影響

`calculatePhaseSkips`関数（definitions.ts 511行目）はscopeのaffectedFilesが空の場合、スキップ判定を行わず空のオブジェクトを返す。

この関数の内部では、まずscopeからaffectedFilesまたはfilesを取得し、それらが空であればスキップ理由のオブジェクトをそのまま返す。
取得できたファイルリストが空でない場合のみ、各ファイルの拡張子や名称を分析してスキップ対象フェーズを決定する。

一方、next.tsの166-172行目には以下のチェックが存在する。
`parallel_analysis`フェーズにいる状態で`parallel_design`へ遷移しようとした際、
scopeFileCountとscopeDirCountがともに0であれば「スコープが設定されていません」エラーを返してブロックする。

つまり`parallel_analysis → parallel_design`遷移時にスコープ未設定のままではエラーになる。
一方、**researchフェーズ → requirementsフェーズ**の遷移時にはスコープチェックがなく、
researchフェーズ中に`workflow_set_scope`が呼ばれなくても次フェーズには進める。

その結果、`calculatePhaseSkips`にファイルリストが空のまま渡り、test_implがスキップされない（正常に見える）が、
実際にはスコープが未設定のままparallel_analysisに到達してブロックされる問題が発生する。

### researchフェーズのsubagent設定（PHASE_GUIDESより）

`PHASE_GUIDES.research`（definitions.ts 582-598行目）の設定を以下に示す。

| 設定項目 | 設定値 |
|---------|-------|
| subagentType | general-purpose |
| model | haiku |
| allowedBashCategories | readonly のみ |
| checklist最終項目 | workflow_capture_baselineの実行 |

注目点として、researchのsubagentTemplateにはuserIntentプレースホルダーは含まれているが、
スコープ設定（`workflow_set_scope`呼び出し）を**促す指示がない**。

### buildPromptでuserIntentがどう使われているか

`resolvePhaseGuide`（definitions.ts 1257行目）は以下の処理を行う。

1. PHASE_GUIDESからフェーズ名をキーにガイドを取得してシャローコピーを作成する
2. `userIntent`が渡された場合、`resolved.userIntent = userIntent`を設定する
3. `docsDir`が設定されている場合、`buildPrompt(resolved, phase, userIntent, docsDir)`でsubagentTemplateを動的生成する

しかし`buildPrompt`の出力はOrchestratorが参照する`phaseGuide.subagentTemplate`フィールドに格納されるだけで、
**userIntentからスコープファイルを自動マッピングする処理は存在しない**。

### 現在scopeが使われている全箇所

| ファイル | 行 | 用途 |
|---------|-----|------|
| start.ts | 126-129行目 | preExistingChangesをscope.preExistingChangesとして保存 |
| next.ts | 162-163行目 | scopeFileCount/scopeDirCountの取得 |
| next.ts | 166-173行目 | parallel_analysis遷移時のスコープ必須チェック（ブロック） |
| next.ts | 494行目 | calculatePhaseSkipsへのscope渡し |
| next.ts | 463-487行目 | implementation/refactoring/parallel_quality時の早期警告 |
| next.ts | 425-458行目 | docs_update→commit遷移時のスコープ事後検証 |
| set-scope.ts | 全体 | スコープ設定API（research/requirements等のフェーズでのみ呼び出し可能） |

---

## P0-2調査結果: 成果物バリデーションが形式チェックのみ

### PHASE_TO_ARTIFACTの現在の定義（next.ts 49-53行目）

next.tsの49-53行目に定義されているPHASE_TO_ARTIFACTは以下の3エントリのみを持つ。
- researchフェーズ: research.md
- requirementsフェーズ: requirements.md
- test_designフェーズ: test-design.md

登録されているのは**3フェーズのみ**。以下のフェーズは成果物チェックが**完全に欠落**している。

| フェーズ | 期待される成果物 | チェック状況 |
|---------|----------------|------------|
| parallel_analysis（planning） | spec.md | チェックなし |
| parallel_design（state_machine） | state-machine.mmd | チェックなし |
| parallel_design（flowchart） | flowchart.mmd | チェックなし |
| parallel_design（ui_design） | ui-design.md | チェックなし |
| parallel_quality（code_review） | code-review.md | チェックなし |
| parallel_verification（manual_test） | manual-test.md | チェックなし |
| parallel_verification（security_scan） | security-scan.md | チェックなし |
| parallel_verification（performance_test） | performance-test.md | チェックなし |
| parallel_verification（e2e_test） | e2e-test.md | チェックなし |

### PHASE_ARTIFACT_REQUIREMENTSの全定義（artifact-validator.ts 118-190行目）

`PHASE_ARTIFACT_REQUIREMENTS`には以下のキーが定義されている。

| ファイル名 | minLines | 必須セクション数 |
|-----------|---------|---------------|
| research.md | 20行 | 2セクション（多言語対応） |
| requirements.md | 30行 | 3セクション（多言語対応） |
| spec.md | 50行 | 3セクション（多言語対応） |
| test-design.md | 30行 | 2セクション（多言語対応） |
| threat-model.md | 20行 | 2セクション（日本語のみ） |
| state-machine.mmd | 5行 | stateDiagram含有 |
| flowchart.mmd | 5行 | flowchart含有 |
| ui-design.md | 50行 | 5セクション（日本語のみ） |
| code-review.md | 30行 | 4セクション（日本語のみ） |
| manual-test.md | 20行 | 2セクション（日本語のみ） |
| security-scan.md | 20行 | 2セクション（日本語のみ） |
| performance-test.md | 20行 | 2セクション（日本語のみ） |
| e2e-test.md | 20行 | 2セクション（日本語のみ） |
| test-impl-result.md | 20行 | 2セクション（日本語のみ） |

**根本問題**: `PHASE_ARTIFACT_REQUIREMENTS`には多くのファイルが定義されているが、
`PHASE_TO_ARTIFACT`（next.tsでの呼び出し元）にはresearch/requirements/test_designの3件しか登録されていない。
`checkPhaseArtifacts`はPHASE_TO_ARTIFACTを参照するため、大多数のフェーズで品質チェックが実行されない。

### validateSemanticConsistency()がnext.tsでどう呼ばれているか

next.ts 354-396行目では、意味的チェックを行うフェーズのリストとして
test_design, test_impl, implementation, refactoring, parallel_qualityの5フェーズが定義されている。
現在のフェーズがそのリストに含まれる場合、`validateSemanticConsistency(docsDir)`を呼び出す。

環境変数`SEMANTIC_CHECK_STRICT`がfalse以外の場合（デフォルト）、warningsが1件以上あればブロックし、
falseに設定されている場合は警告のみを出力して続行する。

`semanticResult.valid`はerrorsが空かどうかで決まり、warningsはブロックしない。
`validateSemanticConsistency`は実際にはwarningsのみを返す設計（errors配列は例外発生時のみ）。
つまりstrictMode=true（デフォルト）の場合でも**warningsが出た時のみブロック**され、
warningsがゼロなら意味的整合性チェックはパスする。

このwarningは「requirements→spec間のキーワード追跡率が低い場合」か「個別キーワードが見つからない場合」に発生する。
しかしCRLF環境ではN-gramから移行したキーワード方式でも、見出し行・太字・箇条書きから抽出するため
**実際のコード実装との整合性は検証されない**（テキスト文書間の整合性のみ）。

### validateKeywordTraceability()の全呼び出し箇所

next.ts 398-422行目に以下のマッピングが定義されている。
- parallel_analysisフェーズ: requirementsを参照元、specを参照先として整合性を確認
- test_implフェーズ: specを参照元、test-designを参照先として整合性を確認

呼び出し対象フェーズは`parallel_analysis`と`test_impl`の2フェーズのみ。
実装フェーズ（implementation、refactoring等）とコードの整合性チェックは**行われていない**。

### checkPhaseArtifacts()の実装

next.ts 69-100行目の実装は以下の順序で処理を行う。

1. PHASE_TO_ARTIFACTマッピングからフェーズ名をキーにファイル名リストを取得する（未登録フェーズは空リスト扱いでスキップ）
2. 各ファイルの存在を確認する
3. PHASE_ARTIFACT_REQUIREMENTSマッピングからファイル名をキーに品質要件を取得する
4. `validateArtifactQuality`で品質検証（行数/必須セクション/禁止パターン/重複行/セクション密度）を実行する

`validateArtifactQuality`が実施する検証は**形式的品質チェック**のみ:
行数・必須セクション見出しの存在・禁止ワード・テンプレート的テキスト・セクション密度。
**成果物の内容がユーザーの意図に沿っているかどうか**はチェックされない。

---

## P0-3調査結果: task-index.jsonの非アトミック書き込みによるレース条件

### writeTaskIndexCache()の実装（discover-tasks.js 106-133行目）

discover-tasks.js 106-133行目の`writeTaskIndexCache`関数は以下の処理を行う。

まず現在時刻を取得し、task-index.jsonが存在する場合は既存キャッシュの`updatedAt`を確認する。
`updatedAt`が現在時刻から1秒以内であれば書き込みをスキップして早期リターンする。
スキップ対象でない場合、schemaVersion 2・tasksリスト・updatedAtを含むオブジェクトをJSON文字列化し、
`fs.writeFileSync`でtask-index.jsonに直接書き込む。

`fs.writeFileSync`はPOSIXのアトミック保証がなく、書き込み途中のファイルを別プロセスが読む可能性がある。
mtimeチェックの「1秒以内にスキップ」は競合を低減するが、**1秒以上かかる処理では競合が発生する**。

### discoverTasks()でのtask-index.json読み書きフロー

1. `getCached('discover-tasks', undefined, generator)`でメモリキャッシュを確認する
2. メモリキャッシュヒットなら即座に返す（TTLはHOOK_CACHE_TTLに基づく、デフォルト300秒）
3. キャッシュミスの場合、`readTaskIndexCache()`でファイルキャッシュを確認する（TTL 30秒）
4. ファイルキャッシュミスの場合、ディレクトリスキャンを実行する
5. スキャン後、`writeTaskIndexCache(tasks)`でファイルに書き込む

**問題点**: 複数のフックプロセスが同時起動すると（Claudeは複数ツール呼び出しを並行実行する）、
各プロセスが独立したメモリキャッシュを持ち、同時にファイルスキャンを実行して
同時に`writeTaskIndexCache`を呼び出す可能性がある。

### readTaskIndexCache()の実装（discover-tasks.js 48-97行目）

`readTaskIndexCache`は以下の順序で処理を行う。

まずtask-index.jsonをJSONとして読み込み、tasksプロパティとupdatedAtプロパティの存在を確認する。
schemaVersionが2でない場合はnullを返してキャッシュを無効化する。
現在時刻との差分がTTLを超えている場合もnullを返す。
ファイルのmtimeがupdatedAtより新しい場合（外部から書き換えられた可能性）もnullを返す。
最後に各タスクエントリにtaskId, taskName, workflowDir, phaseの全4フィールドが存在するか検証し、
いずれかが欠ける場合はnullを返す。

`safeReadJsonFile`はJSON.parseを使うため、書き込み途中の不完全なJSONを読んだ場合は`null`を返す。
しかし**読み取りが書き込みの中断部分を読む**と（例えばJSONが途中で切れた状態）、
`null`が返って全タスクが見えなくなる。これが「タスクがないのでフックがブロック」という現象を引き起こす。

### レース条件が発生する具体的なシナリオ

**シナリオ1: 並行フック実行による書き込み競合**

1. フックA（phase-edit-guard）がキャッシュミスを検出してディレクトリスキャンを開始する
2. フックB（enforce-workflow）が同タイミングでキャッシュミスを検出してスキャンを開始する
3. フックAが`writeFileSync`でtask-index.jsonを書き込み始める
4. フックBが**書き込み途中**のtask-index.jsonを読み取り、JSONパース失敗でnullを返す
5. フックBはタスクが存在しないと判断して誤動作する

**シナリオ2: MCP server更新との競合（既知バグFIX-1）**

1. MCP serverがフェーズ遷移時にworkflow-state.jsonを更新する（task-index.jsonは更新しない）
2. フックがtask-index.jsonのキャッシュを読み、古いフェーズ（例: "implementation"）を返す
3. 実際のフェーズは"commit"なのに、hooks側では"implementation"と判断して誤ったブロックが発生する

**この問題はメモリ内のキャッシュ（task-cache.js）があるため頻度は低いが**、
30秒のTTLが切れるタイミングで競合が発生しやすい。

---

## 既存実装の分析

### scope使用箇所の完全リスト

scopeオブジェクト（`TaskState.scope`）を参照・更新する箇所を体系的に整理する。

| 操作 | ファイル | 主な用途 |
|------|---------|---------|
| 初期化 | start.ts | affectedFiles/affectedDirsを空配列で初期化しpreExistingChangesを保存 |
| 設定 | set-scope.ts | userが明示的にAPIを呼んだ場合のみスコープを設定する |
| 読み取り | next.ts | フェーズ遷移時の検証（並列analysis必須チェック・スコープ違反チェック） |
| スキップ判定 | definitions.ts | calculatePhaseSkipsでfiles配列を使用してスキップ対象を決定する |

### 修正設計への制約事項

P0-1の修正では、researchフェーズsubagentのchecklistに`workflow_set_scope`の呼び出しを追加するか、
parallel_analysis遷移時のスコープ必須チェックを維持しつつ、
**userIntentからのキーワードで変更対象ファイルを自動検索する機能**を追加する方針が考えられる。

P0-2の修正では、`PHASE_TO_ARTIFACT`にサブフェーズ（complete-sub経由で遷移するフェーズ）の
成果物もチェックできるよう、`complete-sub.ts`にも同様のチェックを追加する必要がある。

P0-3の修正では、Node.jsでのアトミック書き込みはtmpファイルへの書き込み後にfs.renameSyncで
最終パスへ移動する方式で実現できる。`fs.renameSync`は同一ファイルシステム上ではアトミック操作として機能する。
