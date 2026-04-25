# Requirements: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: requirements
size: small
fullIntent: レポーティング分析結果に基づくハーネス改善2件: (1) test_implフェーズのtdd_red_evidenceをscopeFilesが.md/.mmdのみの場合に免除するロジック追加、(2) harness_get_subphase_templateが返すテンプレートに全行ユニーク制約を標準注入

## acceptanceCriteria

- AC-1: scopeFilesが全て.md/.mmdの場合、test_implフェーズのcheckTDDRedEvidenceがpassed:trueを返すこと。evidenceに免除理由(ドキュメントのみのスコープ)を含めること。
- AC-2: scopeFilesに.ts/.js/.tsx/.jsx/.mts/.cts/.mjs/.cjsのいずれかが含まれる場合、既存のcheckTDDRedEvidenceロジックが変更されず同一の判定結果を返すこと。
- AC-3: definitions-shared.tsのARTIFACT_QUALITY_RULES定数に全行ユニーク制約(同一内容の行は2回まで)が追記されていること。
- AC-4: 既存テスト(dod-tdd.test.ts, handler-templates-validation.test.ts含む全テスト)が全てパスすること(回帰なし)。
- AC-5: dod-l1-l2.tsとdefinitions-shared.tsが200行以下を維持していること。

## rtm

- F-001: checkTDDRedEvidence scopeFiles拡張子チェック追加 -> AC-1, AC-2, AC-4
- F-002: ARTIFACT_QUALITY_RULES全行ユニーク制約追記 -> AC-3, AC-4
- F-003: 変更対象ファイルの200行以下維持 -> AC-4, AC-5

## notInScope

- checkTDDRedEvidenceのwarningレベル出力(researchフェーズD-001で提案されたがスコープ定義D-001に基づきpassed:trueで免除する方針を採用)
- ドキュメント拡張子(.md/.mmd)以外の非コードファイル(.json, .yaml等)の免除判定
- checkDuplicateLinesの閾値変更(バックエンドロジックは変更しない)
- 他のDoDチェック関数への拡張子チェック波及

## openQuestions

なし

## ユーザー意図との整合性確認

P1の意図: ドキュメントのみのタスク(scopeFilesが.md/.mmdのみ)でtest_implフェーズに入った際、TDD Red証拠が取得不可能であるにも関わらずcheckTDDRedEvidenceがfailする問題を解消する。scopeFilesの拡張子を判定し、コードファイルが存在しない場合はpassed:trueで免除する。

P2の意図: checkDuplicateLinesがバックエンドで全行ユニーク制約を検証しているが、subagentがテンプレートからこの制約を認識できていないため重複行を含む成果物を生成してしまう問題を解消する。ARTIFACT_QUALITY_RULESに制約を明示して事前回避を促す。

両修正とも既存の判定ロジックを破壊せず、条件追加(P1)と文字列追記(P2)で対応する。後方互換性を維持する設計である。

## decisions

- D-001: scopeFilesが全て.md/.mmdの場合にcheckTDDRedEvidenceをpassed:trueで免除する(warningレベルではなく完全免除)。理由: ドキュメントのみのタスクにはテストコードが存在せず、TDD Redの証拠取得が原理的に不可能であるため。
- D-002: 免除判定に使用するドキュメント拡張子は.mdと.mmdの2種のみとする。理由: ハーネスが成果物として出力するドキュメント拡張子がこの2種に限定されており、.json/.yaml等は設定ファイルとして別途扱うべきであるため。
- D-003: ARTIFACT_QUALITY_RULESに「同一内容の行は2回まで(3回以上の重複禁止)」を追記する。理由: checkDuplicateLinesの閾値(3回以上で検出)と数値を整合させ、subagentに具体的な制約値を伝えるため。
- D-004: scopeFilesが空配列の場合は既存ロジック(免除しない)を維持する。理由: scopeFiles未設定のタスクは拡張子判定が不可能であり、安全側に倒して既存動作を保つため。
- D-005: checkTDDRedEvidenceのevidenceフィールドに免除理由と拡張子情報を含める。理由: デバッグ容易性の確保とproofLogの可読性向上のため。
- D-006: 既存テストケースの期待値は一切変更しない。理由: 後方互換性を保証し、新規追加ケースのみで新条件をカバーするため。

## artifacts

- docs/workflows/harness-reporting-fixes/requirements.md: spec: AC定義、RTM、スコープ外定義、意図整合性確認
