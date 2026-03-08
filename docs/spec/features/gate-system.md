# Gate System Specification (FR-3, AC-3)

baseCommit: c01d689

L1-L4 DoDゲートシステムの全仕様。全チェックは決定的(L5 LLM判断は禁止)。

## Orchestrator

`runDoDChecks` が22チェックを順次実行し、全passで遷移許可。
- Source: `dod.ts:24-59`
- Formatter: `dod.ts:61-71` (`formatDoDResult`)

## L1 Checks (File Existence)

| Check | Source | Applicable | Logic |
|-------|--------|------------|-------|
| output_file_exists | `dod-l1-l2.ts:11-26` | outputFile定義フェーズ | PHASE_REGISTRY.outputFileパスの`existsSync` |
| input_files_exist | `dod-l1-l2.ts:29-44` | inputFiles定義フェーズ | 全inputFilesの`existsSync`、欠損リスト返却 (IFV-1) |

## L2 Checks (Execution Evidence)

| Check | Source | Applicable | Logic |
|-------|--------|------------|-------|
| exit_code_zero | `dod-l1-l2.ts:46-59` | L2 proof記録フェーズ | proofLog最新L2エントリの`result===true` |
| tdd_red_evidence | `dod-l1-l2.ts:62-80` | test_impl | proofLogにresult=falseのL2エントリ存在確認 (TDD-1) |

## L3 Checks (Quality / Completeness)

| Check | Source | Applicable | Logic |
|-------|--------|------------|-------|
| artifact_quality | `dod-l3.ts:13-35` | outputFile定義フェーズ | `toonDecode`成功確認。Markdown##検出時に専用エラー |
| rtm_completeness | `dod-l3.ts:41-57` | code_review/acceptance_verification/completed | RTMステータスチェーン(後述)の最低水準確認 |
| ac_completeness | `dod-l3.ts:59-77` | acceptance_verification/completed | 全AC-Nがmet(not_met/openなし) |
| artifact_freshness | `dod-l3.ts:80-101` | inputFiles定義フェーズ | mtime比較: >7日=警告, >30日=ブロック (AFV-1) |
| invariant_completeness | `dod-l3.ts:103-122` | acceptance_verification/completed | 全INV-Nがheld状態 |
| baseline_required | `dod-l3.ts:124-135` | regression_test | baseline.totalTests>=0記録済み |
| tc_coverage | `dod-l4-ia.ts:61-83` | test_design | TC-ACN-NN正規表現マッチ数>=AC数 (CRV-1) |

## L4 Checks (Content Validation)

| Check | Source | Applicable | Logic |
|-------|--------|------------|-------|
| content_validation | `dod-l4-content.ts:39-68` | outputFile定義フェーズ | 禁止語+プレースホルダー+重複行+必須TOONキー |
| ac_format | `dod-l4-requirements.ts:25-46` | requirements | requirements.toonのacceptanceCriteria配列>=3件 (IA-2) |
| not_in_scope_section | `dod-l4-requirements.ts:48-67` | requirements | requirements.toonにnotInScopeキー存在 (IA-2) |
| open_questions_section | `dod-l4-requirements.ts:105-124` | requirements | requirements.toonにopenQuestionsキー存在 (IA-1) |
| intent_consistency | `dod-l4-requirements.ts:70-103` | requirements | userIntentキーワード(>=3文字,stopWords除外,上位10語)の未反映3語以上でNG (CIC-1) |
| delta_entry_format | `dod-l4-delta.ts:20-66` | 19成果物フェーズ | decisions[]配列>=5件。対象: `dod-l4-delta.ts:13-18` |
| ac_design_mapping | `dod-l4-ia.ts:12-37` | design_review | design-review.toonにacDesignMappingキー+全AC-N参照 (IA-3) |
| ac_tc_mapping | `dod-l4-ia.ts:40-58` | test_design | test-design.toonにacTcMappingキー存在 (IA-4) |
| ac_achievement_table | `dod-l4-ia.ts:86-123` | code_review | code-review.toonにacAchievementStatusキー+not_metなし (IA-5) |
| artifact_drift | `dod-l4-art.ts:19-40` | 8後続フェーズ | SHA-256ハッシュ比較で承認後変更検出 (ART-1)。対象: `dod-l4-art.ts:13-16` |
| package_lock_sync | `dod-l4-commit.ts:16-36` | commit | package.json mtime - lock mtime > 60秒でNG (DEP-1) |
| dead_references | `dod-l4-refs.ts:23-52` | 5レビュー/設計フェーズ | 相対MDリンク`[text](./path.md)`のresolve+existsSync (DRV-1)。対象: `dod-l4-refs.ts:14-17` |

## Approval Gates (5種)

| Phase | Gate Type | Source |
|-------|-----------|--------|
| requirements | requirements | `handler-shared.ts:20` |
| design_review | design | `handler-shared.ts:21` |
| test_design | test_design | `handler-shared.ts:22` |
| code_review | code_review | `handler-shared.ts:23` |
| acceptance_verification | acceptance | `handler-shared.ts:24` |

Handler: `approval.ts:16-74`
- Session検証 (`approval.ts:23-24`)
- Phase-Gate一致検証 (`approval.ts:25-33`)
- IA-1: openQuestions非空でブロック (`approval.ts:35-52`)
- IA-2: AC<3件でブロック (`approval.ts:54-60`)
- ART-1: SHA-256ハッシュ記録 (`approval.ts:63-69`)
- 承認後自動フェーズ遷移 (`approval.ts:71-73`)

## Intent Accuracy Chain (IA-1 to IA-7)

| ID | Check | Phase | Source | Gate |
|----|-------|-------|--------|------|
| IA-1 | openQuestions空確認 | requirements | `dod-l4-requirements.ts:105-124`, `approval.ts:35-52` | approval+DoD |
| IA-2 | AC>=3件+notInScope必須 | requirements | `dod-l4-requirements.ts:25-67`, `approval.ts:54-60` | approval+DoD |
| IA-3 | acDesignMapping全AC対応 | design_review | `dod-l4-ia.ts:12-37` | DoD |
| IA-4 | acTcMappingキー存在 | test_design | `dod-l4-ia.ts:40-58` | DoD |
| IA-5 | acAchievementStatus+not_metなし | code_review | `dod-l4-ia.ts:86-123` | DoD |
| IA-6 | 全AC met+RTM最低水準 | acceptance_verification | `dod-l3.ts:59-77`, `dod-l3.ts:41-57` | DoD |
| IA-7 | impact_analysisはresearch後 | - | `registry.ts:12` (stage:1, parallelGroupなし) | 構造的保証 |

IA-1/IA-2はapprovalハンドラとDoDの両方で検証(二重チェック)。

## RTM Status Chain

Status progression: `pending(0) -> implemented(1) -> tested(2) -> verified(3)`
- Source: `dod-l3.ts:37-39` (RTM_PHASE_MIN_STATUS, RTM_STATUS_RANK)

| Phase | Minimum Status |
|-------|---------------|
| code_review | implemented |
| acceptance_verification | tested |
| completed | verified |

## Helper Functions

Source: `dod-helpers.ts:7-61`

| Function | Lines | Logic |
|----------|-------|-------|
| FORBIDDEN_PATTERNS | 7-9 | 12語: 英語4種(完了判断不能語句)+日本語8種(不確定・仮置系語句) |
| BRACKET_PLACEHOLDER_REGEX | 12 | `/\[#[^\]]{0,50}#\]/` |
| isStructuralLine | 14-25 | ##見出し/水平線/コードフェンス/テーブル/太字ラベル判定 |
| extractNonCodeLines | 27-37 | コードフェンス内行を除外+インラインコード除去 |
| checkForbiddenPatterns | 39-42 | 非コード行での禁止語検出 |
| checkBracketPlaceholders | 44-46 | 非コード行でのプレースホルダー検出 |
| checkDuplicateLines | 48-61 | 構造行除外後、同一行3回以上出現を検出 |

## Execution Order

`dod.ts:34-56` の呼出順序:
1. L1: output_file_exists, input_files_exist
2. L2: exit_code_zero
3. L3: artifact_quality
4. L4: content_validation
5. L3: rtm_completeness, ac_completeness, invariant_completeness
6. L4: ac_format, not_in_scope, open_questions, intent_consistency
7. L3: baseline_required, artifact_freshness
8. L4: delta_entry, ac_design_mapping, ac_tc_mapping, ac_achievement_table
9. L3: tc_coverage
10. L4: artifact_drift, package_lock_sync
11. L2: tdd_red_evidence
12. L4: dead_references

全チェックの結果を集約し `errors.length === 0` で合否判定 (`dod.ts:58`)。
