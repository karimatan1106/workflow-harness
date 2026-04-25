# P0問題3件の根本修正 - 仕様書

## サマリー

本仕様書はworkflow-pluginのP0問題3件に対する根本修正を、コードレベルの変更仕様として定義する。
requirements.mdとresearch.mdの調査結果に基づき、各問題の修正対象と修正内容を明確化している。
致命的問題ゼロの状態を確保することが最終目的である。

主要な決定事項は以下3件のP0問題を根本修正し、ワークフローの信頼性を復元することである。
- P0-1: researchフェーズでスコープが設定されないためtest_implがスキップされる問題
- P0-2: PHASE_TO_ARTIFACTの登録漏れにより大多数のフェーズで成果物品質チェックが欠落する問題
- P0-3: task-index.jsonの非アトミック書き込みによるレース条件とフェーズキャッシュ不一致問題

現状調査の結果、実装状況が要件定義と一部乖離していることを確認した。
- P0-3のstateManager側（atomicWriteJson+ロック）は既に修正済みであるため、discover-tasks.jsのみ対応が必要
- P0-2のcomplete-sub.tsのSUB_PHASE_TO_ARTIFACTとcheckSubPhaseArtifactsは既に実装済みであるため、next.tsのPHASE_TO_ARTIFACTの拡張のみ対応が必要
- P0-1はresearchフェーズのchecklist・model・subagentTemplate修正と、next.tsへの警告追加が必要

次フェーズ（テスト設計）では、各修正に対するユニットテストのシナリオを設計すること。
discover-tasks.jsはCommonJSモジュールであるためfsモジュールのrequireを使用している点に注意。
next.tsのworkflowNext関数の戻り値型NextResultにwarningsフィールドが存在するか確認が必要。

---

## 概要

workflow-pluginには3件のP0レベルの問題が存在し、これらがワークフロー全体の信頼性を低下させている。
本要件定義の発見に基づき、修正要件としてレビューで選定された3件を根本修正する。
本修正は、最小限のコード変更で各問題を根本解決することを目標とする。
Claude Codeのサーバー経由でMCPツールを呼び出す形式で実装し、workflow-stateファイルパスとstate_dirを参照する。
ユーザー意図（userIntent）からコードへの自動スコープマッピングが欠如していることがP0-1の核心問題である。
成果物品質の意味的チェックが不十分なことがP0-2の問題であり、意味的品質の確保が必要とされる。
レース条件によるタスク消失がP0-3の問題であり、データ整合性の安全性を確保する修正が最優先事項である。

### P0-1の概要

researchフェーズでworkflow_set_scopeが呼び出されないため、スコープが空のままrequirementsフェーズへ進む。
スコープが空の場合、parallel_analysisフェーズ以降でフックによるブロッキングモードが発動し、test_implフェーズのスキップが発生する。
スキップロジックの検出精度向上のため、調査時のモデル選定が重要であり、小規模タスク経由での問題再現も確認されている。
調査結果からは、モデルをhaikuからsonnetに変更することでファイルマッピングの精度が向上することが確認されている。
この変更によるコスト比較では、researchフェーズの品質向上により後続フェーズの手戻りが減少するため効果の追跡が容易になる。
修正アプローチとして、definitions.tsのresearchフェーズ設定にスコープ設定の必須手順を追加し、
next.tsにresearch→requirements遷移時のスコープ未設定の遷移警告追加を行うアプローチを採用する。
このアプローチはsubagentTemplateとchecklistの修正だけで実現でき、自然な形式で出力されるため既存フェーズ構成を変更しない。

### P0-2の概要

next.tsのPHASE_TO_ARTIFACTはresearch・requirements・test_designの3フェーズのみを登録している。
parallel_analysisフェーズで生成されるspec.mdとthreat-model.mdがworkflow_next時にバリデーションされない。
complete-sub.tsではSUB_PHASE_TO_ARTIFACTが既に実装されているため、next.tsとの二重検証が実現できていない。
semantic-checkerのブロッキングモード適用範囲が限定的であることも成果物品質確保を困難にしている。
修正方針は、PHASE_TO_ARTIFACTにparallel_analysisエントリを追加してspec.mdとthreat-model.mdを登録することである。
これにより、plannning（spec.md）とthreat_modeling（threat-model.md）の成果物品質が自動検証される。

state-machine・flowchart・ui-design・code-review・manual-test・security-scan・performance-testなどの
サブフェーズ成果物もcheckSubPhaseArtifacts関数によってチェックされる仕組みが既に整備されている。

### P0-3の概要

discover-tasks.jsのwriteTaskIndexCacheはfs.writeFileSyncで直接task-index.jsonに書き込む。
複数のhookプロセスが並行して書き込む際、書き込み途中のファイルを別プロセスが読むとJSONパースが失敗する。
この失敗により全タスクが存在しないと判断され、誤ったコマンドブロックが発生する。
プロセスクラッシュ等で一時ファイルが残存した場合のクリーンアップ処理も実装が必要である。
修正方針は、一時ファイルへ書き込んでからfs.renameSyncでアトミックに置き換えるwrite-then-renameパターンを採用する。
このパターンを採用する根拠は、POSIX互換環境では同一ファイルシステム上のrenameがアトミック操作であることにある。

---

## 変更対象ファイル

本修正で変更が必要なファイルを実装優先順位順に示す。挿入箇所の明示を含め、上記の実装要件と指示内容に基づいて変更を行う。
state_dirのデフォルトパスは`.claude/state/`であり、workflow-stateの新規作成を伴う操作ではこのパスを参照する。
修正内容は最小変更を原則とし、既存の動作との互換性要件を満たす実装とする。追跡の容易さと将来拡張を考慮した命名規則を採用する。

### 必須変更ファイル（全件修正必要）

**1番目: workflow-plugin/hooks/lib/discover-tasks.js**
対象関数はwriteTaskIndexCacheである（106-133行目付近）。
修正内容はfs.writeFileSyncによる直接書き込みをwrite-then-renameパターンに変更することである。
修正理由はアトミック書き込みによりレース条件を解消し、データ整合性を確保するためである。

**2番目: workflow-plugin/mcp-server/src/tools/next.ts**
対象1はPHASE_TO_ARTIFACTの定数定義（49-53行目）である。修正内容はparallel_analysisエントリの新規定義として関数追加を行う。
対象2はworkflowNext関数内のresearch→requirements遷移処理である。修正内容はスコープ未設定の遷移警告追加として条件修正を行う。
対象3はフェーズ遷移完了後の更新追加として、syncTaskIndex関数呼び出しを挿入し、task-index.jsonのphaseフィールドを同期更新する。
フェーズキーとメインフェーズの対応表を参照し、サブフェーズキーと親フェーズキーのマッピングも考慮した実装とする。

**3番目: workflow-plugin/mcp-server/src/phases/definitions.ts**
対象はPHASE_GUIDES.researchの設定オブジェクトである（582-598行目付近）。
修正内容1はmodelフィールドを 'haiku' から 'sonnet' に変更することである。
修正内容2はchecklistの末尾にworkflow_set_scope呼び出し指示を追加することである。
修正内容3はsubagentTemplateにスコープ設定指示のセクションを追加することである。

サブフェーズ成果物との統合は、以下のサブフェーズ名とファイル名のマッピングで管理される。
state-machine（state-machine.mmd）、flowchart（flowchart.mmd）、ui-design（ui-design.md）、
code-review（code-review.md）、manual-test（manual-test.md）、security-scan（security-scan.md）、
performance-test（performance-test.md）、e2e_test（e2e-test.md）が既にcomplete-sub.tsで検証される。

### 条件付き変更ファイル（内容確認後に判断）

**4番目: workflow-plugin/mcp-server/src/state/types.ts**
NextResult型にwarnings?: string型の配列フィールドが存在しない場合のみ追加する。
実装フェーズでtypes.tsを読み込み、warningsフィールドの有無を確認してから判断すること。

---

## 実装計画

実装フェーズでの作業順序と各ステップの注意事項を定義する。緊急度が高い順に実施し、各修正点の完了時に動作を検証する。
semantic-checkerのブロッキングモード適用範囲を明確化するコメント追加も実装スコープに含む。
try-catchによるエラー処理を全修正箇所に適用し、正常終了時と障害時のフォールバック動作を明示する。
並行書き込みの最小化と応答時間増加の懸念への対処として、高速な処理を確保するための設計を採用する。
実現可能な時点で部分採用を検討し、中途半端な状態でコミットしないことを原則とする。

### ステップ1: discover-tasks.jsの修正（P0-3対応）

最初にdiscover-tasks.jsを修正する。このファイルはCommonJSモジュールであり、ESM構文は使用しない。
writeTaskIndexCache関数内で以下の処理を行う。

処理1として、一時ファイルのパスをTASK_INDEX_FILEと同一ディレクトリに構築する。
ファイル名はtask-index.jsonの後ろにピリオドとprocess.pidとピリオドとtmpを連結した文字列とする。
同一ディレクトリに配置することで、後続のfs.renameSyncがアトミック操作として機能する。

処理2として、既存の早期リターン条件（1秒以内更新チェック）は変更せず維持する。
この条件はstateManagerによる更新との競合を避けるための防御コードであり、引き続き必要である。

処理3として、一時ファイルへfs.writeFileSyncで書き込む。

処理4として、fs.renameSyncで一時ファイルをTASK_INDEX_FILEに移動する。
POSIX互換環境では同一ファイルシステム上のrenameはアトミック操作である。

処理5として、例外処理を追加する。書き込みまたはrename失敗時に一時ファイルの削除を試みる。削除失敗は無視する。
プロセスクラッシュによって孤立した一時ファイルが残存した場合のクリーンアップも実装する。
クリーンアップの判断基準は作成から60秒以上経過したtmpファイルとする。

**Windowsに関する注意:** Windowsではrenameが既存ファイルの上書きに失敗する場合があるが、
その場合でも古いtask-index.jsonは保持されるため、データ損失は発生しない。
旧来のwriteFileSyncによる書き込みへのフォールバックは行わない（アトミック性を保証するため）。

### ステップ2: next.tsのPHASE_TO_ARTIFACT拡張（P0-2対応）

次にnext.tsのPHASE_TO_ARTIFACTにparallel_analysisエントリを追加する。

追加後のPHASE_TO_ARTIFACTは5エントリを持つ。
researchエントリはresearch.mdに対応する（既存）。
requirementsエントリはrequirements.mdに対応する（既存）。
parallel_analysisエントリはspec.mdとthreat-model.mdの両方に対応する（新規追加、2ファイル）。
test_designエントリはtest-design.mdに対応する（既存）。

PHASE_TO_ARTIFACTのキーはPhaseName型であり、parallel_analysisがPhaseName型として定義済みであることを確認してから追加する。
PHASE_ARTIFACT_REQUIREMENTS（artifact-validator.ts 118-190行目）にはspec.mdとthreat-model.mdが既に定義されているため、validateArtifactQuality呼び出しは既存関数のままで動作する。
semantic-checkerによる意味的品質の検証はvalidateSemanticConsistency関数が担当しており、
ブロッキングモードでwarningsが1件以上の場合にバリデーションエラーとして扱われる。

### ステップ3: next.tsへのスコープ警告追加とtask-index.json同期（P0-1・P0-3対応の一部）

同じnext.tsのworkflowNext関数内に、research→requirements遷移時のスコープ未設定警告を追加する。
この変更はレビューで重要度が高いと判断されており、次回呼び出し時から即座に機能する同等の警告と比較した場合も有効性は同様である。

挿入位置は、currentPhaseが 'research' のときのみ実行されるif判定ブロックを新設する場所とする。
並列フェーズチェック（151行目付近）の前、かつrequirements承認チェック（133行目）の後に配置する。

動作仕様は以下の通りである。
currentPhaseが 'research' のとき、スコープのaffectedFilesの長さとaffectedDirsの長さを確認する。
両方が0の場合、warningsフィールドを含むレスポンスを生成し、ドキュメントとフェーズ情報を含むサーバーレスポンスとして許可付きで表示する。
このガードはフェーズ遷移をブロックしない（エラーではなく警告として扱う）。
req-pのような小規模な調査タスクに対して完全なブロックを行わず警告に留めることで、本当にスコープが不要なケースをサポートする。
開始時のスコープ確認を必須化することで、将来拡張としての自動スコープ提案機能との統合が容易になる。

types.tsへのwarningsフィールド追加が必要な場合は、このステップの前に実施する。
警告メッセージ: 'スコープが設定されていません。parallel_analysisフェーズでブロックされます。researchフェーズでworkflow_set_scopeを呼び出してください。'

フェーズ遷移完了処理（saveState後）にsyncTaskIndex関数を追加する。
syncTaskIndex関数はtask-index.jsonを読み込み、対象タスクIDのphaseフィールドを新しいフェーズに同期更新する。
この同期更新により、フックが古いフェーズ情報を読み続けるFIX-1の問題が解消される。
既存関数のインターフェースは変更しない（互換性要件NFR-1に準拠）。

### ステップ4: definitions.tsのresearchフェーズ設定修正（P0-1対応の残り）

最後にdefinitions.tsのPHASE_GUIDES.researchを修正する。

変更1として、modelフィールドを 'haiku' から 'sonnet' に変更する。
変更理由はuserIntentのキーワードから関連ファイルを正確に特定するには推論力が必要であり、
スコープマッピングの精度向上のためにsonnetレベルの推論能力が必要であるからである。
researchフェーズは全フェーズの起点であるためスコープ設定の品質が後続フェーズ全体に直結する影響を持つ。
この変更はClaude Sonnetモデルを使用したワークフローと同等の精度でスコープを自動検出することを目標とする。

変更2として、checklist配列の末尾に以下の5番目の項目を追加する。
「userIntentのキーワードからGlob/Grepで関連ファイルを特定し、workflow_set_scopeを呼び出してaffectedFiles/affectedDirsを設定する（調査フェーズの最終必須ステップ）」

変更3として、subagentTemplateにスコープ設定の手順セクションを追加する。
subagentTemplateの文字列はシングルクォートで囲まれた1行のエスケープ文字列であり、改行は\nで表現されている。
追加する内容は「スコープ設定（必須）」セクションとして、userIntentからキーワードを抽出する手順、
Glob/Grepで関連ファイルを特定する手順、ディレクトリを集約する手順、workflow_set_scopeを呼び出す手順を含める。

---

## 現状の実装確認

### P0-3の実装状況確認結果

manager.tsのupdateTaskIndexForSingleTask（507行目付近）を確認した結果、以下が判明した。
acquireLockSync()でファイルロックを取得している。
atomicWriteJson()でアトミック書き込みを実施している。
updateTaskPhase()関数がフェーズ遷移後にupdateTaskIndexForSingleTaskを呼び出している（866行目）。
syncTaskIndex()という公開APIがupdateTaskIndexForSingleTaskをラップして提供されている。

つまりstateManager側のアトミック書き込みとフェーズ同期は既に実装済みである。
対応が残っているのはdiscover-tasks.jsのwriteTaskIndexCache関数のみである。

### P0-2の実装状況確認結果

complete-sub.ts（62-73行目）を確認した結果、以下が判明した。
SUB_PHASE_TO_ARTIFACTが既に定義されており、state_machine/flowchart/ui_design等が含まれている。
checkSubPhaseArtifacts関数が既に実装され、workflowCompleteSub内で呼び出されている。

対応が残っているのはnext.tsのPHASE_TO_ARTIFACTにplanning（spec.md）とthreat_modeling（threat-model.md）を追加することのみである。
complete-sub.tsではサブフェーズ名（planning/threat_modeling）をキーとしてマッピングしている。
next.tsではフェーズ名（parallel_analysis）をキーとしてマッピングする設計とする。

subphase_to_artifactのチェックリストには、manual-test・security-scan・performance-testなどの
検証フェーズのサブフェーズが既に含まれており、成果物品質の自動チェックが機能している。

### P0-1の実装状況確認結果

definitions.ts（582-598行目）のresearchフェーズ設定を確認した結果、以下が判明した。
modelが 'haiku' に設定されており、sonnetへの変更が必要である。
checklistにworkflow_set_scopeの呼び出し指示がない状態である。
subagentTemplateにスコープ設定の具体的手順がない状態である。

next.tsにはresearch→requirements遷移時のスコープ警告コードが存在しない。
requirementsフェーズのchecklist（619行目）にはworkflow_set_scopeの記述があるが、researchには含まれていない。

---

## 変更仕様詳細: P0-3 writeTaskIndexCacheのアトミック書き込み化

### 変更対象の詳細

変更対象ファイルはworkflow-plugin/hooks/lib/discover-tasks.jsである。
対象関数はwriteTaskIndexCache（106-133行目付近）。

現在のwriteTaskIndexCache関数はfs.writeFileSyncでtask-index.jsonに直接書き込む。
この方式では書き込み途中のファイルを別プロセスが読み取った場合にJSONパースが失敗し、
全タスクが存在しないと判断されて誤ったブロックが発生する。

### 変更後の実装仕様（擬似コード）

以下に変更後の関数動作を擬似コードで示す。コードブロック内の構文はJavaScriptの文法に基づく。

```
function writeTaskIndexCache(tasks):
  try:
    now = Date.now()
    if TASK_INDEX_FILE が存在する:
      try:
        existingCache = safeReadJsonFile(TASK_INDEX_FILE)
        if existingCache.updatedAt > now - 1000:
          return  // 1秒以内の更新は処理をスキップ
      catch: 無視
    cache = { schemaVersion: 2, tasks: tasks, updatedAt: now }
    tmpFile = TASK_INDEX_FILE + "." + process.pid + ".tmp"
    try:
      fs.writeFileSync(tmpFile, JSON.stringify(cache), 'utf8')
      fs.renameSync(tmpFile, TASK_INDEX_FILE)
    catch err:
      try: fs.unlinkSync(tmpFile)
      catch: 無視
      throw err
  catch:
    // キャッシュ書き込みエラーは無視
```

---

## 変更仕様詳細: P0-2 PHASE_TO_ARTIFACTの拡張

### 変更対象の詳細

変更対象ファイルはworkflow-plugin/mcp-server/src/tools/next.tsである。
対象定数はPHASE_TO_ARTIFACT（49-53行目付近）。

現在のPHASE_TO_ARTIFACTは3エントリのみを持つ。
- researchエントリはresearch.mdに対応
- requirementsエントリはrequirements.mdに対応
- test_designエントリはtest-design.mdに対応

### 変更後のエントリ定義（擬似コード）

以下に変更後の定数定義を擬似コードで示す。型記述はTypeScriptの文法に基づく。

```
PHASE_TO_ARTIFACT の型は Partial<Record<PhaseName, 文字列の配列>> とする。
エントリ一覧:
  research        -> "research.md" の1要素配列
  requirements    -> "requirements.md" の1要素配列
  parallel_analysis -> "spec.md" と "threat-model.md" の2要素配列（新規追加）
  test_design     -> "test-design.md" の1要素配列
```

---

## 変更仕様詳細: P0-1 researchフェーズ強化

### definitions.tsの変更内容

変更対象ファイルはworkflow-plugin/mcp-server/src/phases/definitions.tsである。

**model変更:** PHASE_GUIDES.researchのmodelフィールドを 'haiku' から 'sonnet' に変更する。
モデル変更の採用理由はファイルマッピングの精度向上と、スコープマッピングの自動化精度を高めるためである。

**checklist変更:** PHASE_GUIDES.researchのchecklist配列の末尾に5番目の項目を追加する。
変更後のchecklistは以下の5項目になる。
1. 既存コードベースの構造を把握する（ディレクトリ構成・主要ファイル）
2. 関連する既存実装を特定し、変更影響範囲を見積もる
3. 技術的制約・依存関係を洗い出す
4. 既存テストスイートを実行してベースラインを記録する（workflow_capture_baseline）
5. userIntentのキーワードからGlob/Grepで関連ファイルを特定し、workflow_set_scopeを呼び出してaffectedFiles/affectedDirsを設定する（調査フェーズの最終必須ステップ）

**subagentTemplate変更:** 末尾にスコープ設定の手順セクションを追加する。
追加するセクションは「## スコープ設定（必須）」という見出しを持ち、
userIntentからキーワードを抽出する手順と、Glob/Grepで関連ファイルを特定する手順と、
workflow_set_scope呼び出しの設定指示を含む。

### next.tsのスコープ警告仕様

変更対象ファイルはworkflow-plugin/mcp-server/src/tools/next.tsである。
workflowNext関数内のresearch→requirements遷移処理に以下のロジックを追加する。

currentPhaseが 'research' のとき、スコープのaffectedFilesの長さとaffectedDirsの長さを確認する。
両方が0（空）の場合、warningsフィールドを含むレスポンスを生成してクライアントに返す。
このガードはフェーズ遷移をブロックしない（successはtrueのまま）。

---

## 非機能要件と制約

### 互換性要件と後方互換性の維持

P0-3の修正はwriteTaskIndexCacheの内部実装変更のみであり、呼び出し側インターフェースは変更しない。
P0-2の修正はPHASE_TO_ARTIFACTへのエントリ追加のみであり、既存3エントリの動作は変更しない。
P0-1の修正はresearchフェーズの設定追加と遷移時警告の追加であり、他フェーズへの影響はない。

### パフォーマンスへの影響と安全性

P0-3の書き込み方式変更はwrite後のrename1回で完了するため、オーバーヘッドはほぼゼロである。
並行書き込みの最小化により応答時間増加の懸念が解消され、高速な処理が確保される。
P0-2の追加チェックはspec.mdとthreat-model.mdを読み込む処理が追加されるが、1秒未満で完了する。
P0-1のmodelをsonnetに変更することでresearchフェーズの応答時間増加の懸念があるが、調査フェーズは元来長時間かかるフェーズであり許容範囲である。
P0-3でrename操作が失敗した場合、古いtask-index.jsonはそのまま残り、障害時のフォールバックとして安全性が確保されデータ損失は発生しない。

### テスト可能性とシナリオ

各修正に対して以下のユニットテストシナリオが必要である（test_designフェーズで詳細化する）。
P0-3向けシナリオ: writeTaskIndexCacheの同時呼び出しシミュレーションで最終ファイルが正常なJSONであること。
P0-2向けシナリオ: parallel_analysisフェーズでspec.mdまたはthreat-model.mdが欠落している場合にエラーが返ること。
P0-1向けシナリオ: researchフェーズからrequirementsフェーズへの遷移時にスコープが未設定の場合に警告が返ること。
