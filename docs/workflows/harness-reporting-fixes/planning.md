# Planning: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: planning
size: small

## decisions

- D-001: checkTDDRedEvidenceのシグネチャを(state, phase)から変更せず、state.scopeFilesから拡張子判定を行う。理由: 呼び出し元(dod.ts L62)の変更を不要にし、影響範囲を最小化するため。
- D-002: ドキュメント拡張子判定はextname比較(.md, .mmd)で実装し、正規表現は使用しない。理由: 拡張子が2種のみであり、Set.hasによる完全一致が最も明確で保守しやすいため。
- D-003: scopeFilesが空配列の場合は免除せず既存ロジックにフォールスルーする。理由: requirements D-004の決定に従い、拡張子判定不可能な場合は安全側に倒すため。
- D-004: ARTIFACT_QUALITY_RULESへの追記は既存の「密度>=30%」行に続けて同一行内ではなく、独立した箇条書き行として追加する。理由: 可読性優先(1行に複数文を詰め込む圧縮禁止ルール)に従うため。
- D-005: 新規テストケースはdod-tdd.test.tsに追加し、新規テストファイルは作成しない。理由: checkTDDRedEvidenceの既存テストと同一ファイルに集約することでテストの発見性を高めるため。
- D-006: テストではmakeMinimalStateのscopeFilesを直接設定してcheckTDDRedEvidence単体を呼び出す。理由: runDoDChecks経由だと他チェックの副作用を受けるため、単体関数テストが適切であるため。

## implementationSteps

### Step 1: checkTDDRedEvidence に scopeFiles 拡張子判定を追加

対象ファイル: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts
変更内容:
- checkTDDRedEvidence関数の先頭(phase !== 'test_impl'チェックの直後)に拡張子判定ロジックを挿入
- state.scopeFilesを取得し、長さ > 0 かつ 全要素の拡張子が DOC_ONLY_EXTENSIONS (.md, .mmd) に含まれる場合、passed: true を返す
- evidenceにはドキュメントのみスコープである旨と拡張子一覧を含める
- DOC_ONLY_EXTENSIONS定数をモジュールスコープで定義(Set<string>)

変更箇所の詳細:
- L76付近のcheckTDDRedEvidence関数内、L78-79の後(phase !== 'test_impl'チェックの後)に挿入
- 追加行数: 約10行(定数定義2行 + 判定ロジック8行)
- 既存ロジック(L80-95)は変更なし

AC対応: AC-1(免除判定), AC-2(既存ロジック維持), AC-5(200行以下)
RTM対応: F-001

### Step 2: ARTIFACT_QUALITY_RULES に全行ユニーク制約を追記

対象ファイル: workflow-harness/mcp-server/src/phases/definitions-shared.ts
変更内容:
- ARTIFACT_QUALITY_RULES定数(L26-29)の箇条書きに「同一内容の行は2回まで許容、3回以上の重複はDoD L3で失敗する」旨の行を追加
- 既存の「同一行3回以上繰り返し禁止」(L27)と整合する表現を使用

変更箇所の詳細:
- L27の既存行を確認: 既に「同一行3回以上繰り返し禁止」が含まれている
- 現状の表記を「同一内容の行は2回まで(3回以上の重複はDoDで検出・失敗)」に明確化する形で更新
- 追加行数: 0-1行(既存行の明確化 or 1行追加)

AC対応: AC-3(ユニーク制約追記), AC-5(200行以下)
RTM対応: F-002

### Step 3: テストケース追加

対象ファイル: workflow-harness/mcp-server/src/__tests__/dod-tdd.test.ts
変更内容:
- scopeFilesが全て.md/.mmdの場合にcheckTDDRedEvidenceがpassed:trueを返すテスト
- scopeFilesに.tsが含まれる場合に既存ロジックが維持されるテスト
- scopeFilesが空配列の場合に免除されないテスト
- scopeFilesに.mdと.tsが混在する場合に免除されないテスト

追加テストケース一覧:
1. 「passes TDD Red check when scopeFiles are all .md/.mmd (doc-only scope)」
   - scopeFiles: ['docs/planning.md', 'docs/diagram.mmd']、proofLog空 → passed: true
2. 「falls through to existing logic when scopeFiles contain .ts」
   - scopeFiles: ['src/index.ts', 'docs/readme.md']、proofLog空 → passed: false
3. 「falls through to existing logic when scopeFiles is empty」
   - scopeFiles: []、proofLog空 → passed: false
4. 「evidence includes doc-only exemption reason」
   - scopeFiles: ['docs/planning.md']、proofLog空 → evidence にドキュメントのみの旨を含む

AC対応: AC-1, AC-2, AC-4
RTM対応: F-001, F-003

### Step 4: 既存テスト全パス確認

実行コマンド: cd workflow-harness/mcp-server && npx vitest run
確認事項:
- 新規追加テスト4件がパスすること
- 既存テスト(dod-tdd.test.ts内の5件)がパスすること
- handler-templates-validation.test.tsがパスすること(ARTIFACT_QUALITY_RULES変更の影響確認)
- 全テストスイートが回帰なしでパスすること

AC対応: AC-4
RTM対応: F-003

## riskMitigation

- dod-l1-l2.tsの行数増加リスク: 現在167行。約10行追加で177行前後。200行以下を維持可能。
- definitions-shared.tsの行数増加リスク: 現在135行。0-1行追加で影響なし。
- ARTIFACT_QUALITY_RULES変更によるテンプレート検証テストへの影響: handler-templates-validation.testが文字列一致で検証している場合、文言変更で失敗する可能性あり。Step 4で早期検出し対応する。

## dependencyOrder

Step 1とStep 2は独立しており並列実行可能。Step 3はStep 1の実装後に実行。Step 4は全Step完了後に実行。

実行順序: (Step 1 || Step 2) → Step 3 → Step 4

## artifacts

- docs/workflows/harness-reporting-fixes/planning.md: design: 実装計画、AC-RTMマッピング、リスク軽減策

## next

- state_machine / flowchart / ui_design フェーズで設計を視覚化
- test_design フェーズで TC-AC1-01 ~ TC-AC5-01 のテストケースを定義
