# Research: harness-template-reliability

phase: research
task: harness-template-reliability

## decisions

- R-001: FIX-1のuserResponseキー欠落原因はTOON_SKELETON_HEARING(toon-skeletons-a.ts L151-186)に
  userResponseフィールドが定義されていないこと。dod-l2-hearing.ts L32の正規表現 `/^userResponse:/m` が
  hearing.md内を検索するが、スケルトンにはこのキーの出力指示がないため、hearing-workerがキーを出力しない。
  スケルトンの:section intent-analysis内に`:userResponse [AskUserQuestionの回答全文]`行を追加する。

- R-002: FIX-2のbaseline_captureチェックはdod-l3.ts L178-190のcheckBaselineRequired関数が
  regression_testフェーズでのみ実行される設計。defs-stage5.ts L17-30のtestingテンプレートには
  baseline手順が記載済み(L22: harness_capture_baselineでベースラインを記録)。
  テンプレートの冒頭に「baseline_captureは必須ステップ」の強調文を追加し見落としを防止する。

- R-003: FIX-3のharness_back処理フローはscope-nav.ts L82-96のhandleHarnessBack関数で実装。
  sm.goBack(taskId, targetPhase)を呼出し、manager-lifecycle.ts L111-133のgoBack関数が
  completedPhasesをスライスしretryCountをリセットする。goBack後の再承認は未実装。
  cascadeオプション追加にはdefs-a.ts L99-110のharness_backスキーマにcascadeプロパティを追加し、
  scope-nav.ts内でPHASE_APPROVAL_GATES(handler-shared.ts L19-26)を参照して
  goBack対象範囲の承認済みゲートを特定し再承認を実行するループが必要。

- R-004: FIX-4のhearingテンプレート(defs-stage0.ts L12-41)はSUMMARY_SECTIONフラグメントを参照していない。
  他フェーズ(scope_definition, research, impact_analysis等)はすべて`{SUMMARY_SECTION}`を含むが、
  hearingテンプレートは`{TOON_SKELETON_HEARING}`と`{ARTIFACT_QUALITY}`のみ。
  definitions.ts L113のreplace処理で`{SUMMARY_SECTION}`追加すればSUMMARY_SECTION_RULEが展開される。

- R-005: FIX-5のphase-analytics.ts generateAdvice関数(L129-153)には5種類のルールが存在:
  (1) ADVICE_RULES配列によるパターンマッチ(L119-127, 7ルール)
  (2) tdd_red_evidence 3回以上失敗の閾値チェック(L139-140)
  (3) フェーズ別リトライ3回以上の警告(L141-143)
  (4) 個別フェーズ600s超過の分割推奨(L144-148)
  (5) 総所要時間1800s超過のサイズ見直し推奨(L149-151)
  completedフェーズの滞留検出ルールは存在しない。timings引数のphaseTimingsから
  current===falseのフェーズ経過時間を取得し3600s超過でadvice警告を追加する。

- R-006: definitions.ts L119-122のスケルトン展開処理はskelAとskelBの全エクスポートを
  key-valueで走査し`{KEY_NAME}`パターンを置換する。TOON_SKELETON_HEARINGも同仕組みで
  展開されるためスケルトンへのフィールド追加はそのまま最終プロンプトに反映される。

- R-007: handler-shared.ts PHASE_APPROVAL_GATES(L19-26)は以下の6フェーズに対応:
  requirements -> 'requirements', design_review -> 'design', test_design -> 'test_design',
  code_review -> 'code_review', acceptance_verification -> 'acceptance', hearing -> 'hearing'。
  FIX-3のcascade-reapproveではgoBackのtargetPhase以降でcompletedPhasesから除外される
  フェーズのうちPHASE_APPROVAL_GATESに含まれるものを再承認対象として特定する。

- R-008: manager-lifecycle.ts L111-133のgoBack関数はcompletedPhasesのスライスと
  retryCountリセットのみ実行し、state.approvalsオブジェクトの変更は行わない。
  FIX-3のcascade実装ではgoBack実行後にstate.approvalsから対象フェーズのエントリを
  削除する処理を追加する必要がある。handleHarnessBack内でapproval削除と
  reapproveを一括処理する設計とする。

- R-009: approval.ts handleHarnessApprove関数(L18-120)には3つの前提条件チェックが含まれる:
  IA-1(openQuestions検証 L37-53), IA-2(AC最低数検証 L56-62),
  IA-6(AC全met/RTM全tested検証 L85-100)。
  cascade-reapproveでは再承認対象がrequirements承認の場合IA-1/IA-2が、
  acceptance承認の場合IA-6が発動するため、前提条件が満たされない場合cascade処理が中断する。

## artifacts

- docs/workflows/harness-template-reliability/research.md: report: FIX-1からFIX-5の既存コードパターン調査結果。変更対象ファイル13件の既存ロジック動作仕様と必要な変更内容を行番号付きで特定。

## next

- criticalDecisions: R-003(cascade-reapproveはgoBack後にPHASE_APPROVAL_GATESマップを走査して再承認対象を特定する設計), R-001(TOON_SKELETON_HEARINGにuserResponseフィールドを追加しdod-l2-hearingチェックを通過可能にする), R-008(goBack関数はstate.approvalsを変更しないため再承認前にapproval削除が必要)
- readFiles: src/phases/toon-skeletons-a.ts, src/phases/defs-stage0.ts, src/phases/definitions.ts, src/phases/definitions-shared.ts, src/tools/handlers/scope-nav.ts, src/tools/handlers/approval.ts, src/tools/handler-shared.ts, src/gates/dod-l3.ts, src/gates/dod-l2-hearing.ts, src/tools/phase-analytics.ts, src/tools/defs-a.ts, src/state/manager-lifecycle.ts, src/phases/defs-stage5.ts
- warnings: FIX-3のcascade-reapprove実装ではapproval.tsのhandleHarnessApprove関数がIA-1/IA-2/IA-6の前提条件チェックを含むため再承認ループでこれらが失敗すると処理中断する。manager-lifecycle.ts goBack関数はcompletedPhasesスライスとretryCountリセットのみ行い承認状態(state.approvals)は変更しないため再承認前にapprovalsから対象エントリを削除する処理が必要。FIX-4でhearingにSUMMARY_SECTIONを追加する場合SUMMARY_SECTION_RULEのTOON形式指示とTOON_SKELETON_HEARINGの記述に重複が生じうるためhearing固有のスケルトン指示を優先する調整が必要になる場合がある。
