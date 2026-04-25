# Code Review: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: code_review
reviewer: coordinator-L2

## サマリー

本タスクは2件のハーネス改善を実施した。(1) checkTDDRedEvidenceにscopeFilesがドキュメントのみ(.md/.mmd)の場合の免除ロジックを追加、(2) ARTIFACT_QUALITY_RULESに全行ユニーク制約を明示追記。変更は4ファイル、合計約20行の追加で、既存ロジックの破壊なく後方互換を維持している。/simplifyによるレビュー済みで、level/checkフィールド追加、DOC_ONLY_EXTENSIONS定数化、path.extname使用の3件が修正適用済み。

## 設計-実装整合性

requirements.md D-001からD-006の設計判断が実装に正確に反映されている。

dod-l1-l2.ts 77-106行: checkTDDRedEvidenceにscopeFilesの拡張子判定を追加。D-001(passed:trueで免除)、D-002(.md/.mmdの2種のみ)、D-004(空配列は免除しない: length > 0ガード)、D-005(evidenceに免除理由を含む)が全て実装されている。DOC_ONLY_EXTENSIONS定数(108行)でマジック文字列を排除し、path.extnameで拡張子判定を行う設計は/simplify指摘を反映した改善である。

definitions-shared.ts 28行: ARTIFACT_QUALITY_RULESにD-003の制約「各行の内容をユニークにすること（同一内容の行は最大2回まで。3回以上出現でDoD L4失敗）」を追記。checkDuplicateLinesの閾値(3回)と数値が整合している。

dod-tdd.test.ts 81-117行: 4テスト追加。TC-AC1-01(全.md/.mmd免除)、TC-AC1-02(空配列は免除しない)、TC-AC2-01(.ts含むと免除しない)、TC-AC2-02(混在拡張子で免除しない)。正常系と異常系の両方をカバーしている。

handler-templates-validation.test.ts 170-176行: TC-AC3-01でARTIFACT_QUALITY_RULESにユニーク制約が含まれることを正規表現で検証。

## ユーザー意図との整合性

P1意図(ドキュメントのみタスクでTDD Redが原理的に取得不可能な問題の解消): scopeFiles全件がDOC_ONLY_EXTENSIONSに該当する場合にpassed:trueを返す実装で解消。scopeFilesが空や未設定の場合は安全側に倒して既存動作を維持しており、意図に対して過不足ない。

P2意図(subagentがユニーク制約を認識できない問題の解消): ARTIFACT_QUALITY_RULESに具体的な閾値(2回まで)を明示し、subagentのテンプレート経由で事前に制約を伝達。バックエンドのcheckDuplicateLinesロジックは変更なし。

## AC Achievement Status

- AC-1: PASS -- checkTDDRedEvidenceがscopeFiles全.md/.mmd時にpassed:trueを返す。TC-AC1-01で検証済み。
- AC-2: PASS -- .ts含有時は既存ロジック維持。TC-AC2-01, TC-AC2-02で検証済み。
- AC-3: PASS -- ARTIFACT_QUALITY_RULES 28行にユニーク制約追記。TC-AC3-01で検証済み。
- AC-4: PASS -- 全15テストパス(既存11 + 新規4テスト含む回帰なし)。
- AC-5: PASS -- dod-l1-l2.ts 177行、definitions-shared.ts 136行。両方200行以下。

## decisions

- D-001: DOC_ONLY_EXTENSIONS定数をcheckTDDRedEvidence関数の直後(108行)に配置。関数内ではなくモジュールスコープに定義することで、将来他の関数からも参照可能にした。
- D-002: scopeFilesのevery()で全件がドキュメント拡張子であることを確認する設計を採用。some()ではなくevery()を使うことで、1件でもコードファイルが含まれれば免除しない安全側の判定となる。
- D-003: path.extnameを使用した拡張子判定は、ファイルパスに複数のドットが含まれる場合(例: file.test.ts)でも正しく最後の拡張子(.ts)を取得する。endsWith()やsplit('.')より堅牢。
- D-004: テストケースIDにTC-AC{N}-{NN}形式を採用し、AC番号との追跡性を確保。各ACに対して少なくとも1つのテストケースが対応している。
- D-005: ARTIFACT_QUALITY_RULES の追記行に「DoD L4失敗」と明記し、subagentに違反時の具体的な結果を伝えることで制約の遵守率向上を狙った。
- D-006: handler-templates-validation.test.tsのTC-AC3-01では正規表現`/ユニーク|unique|重複.*2回/i`を使用し、日本語・英語どちらの表記でも検出可能にした。将来の国際化にも対応可能。
- D-007: dod-l1-l2.tsの全DoDCheckResult返却値にlevelとcheckフィールドを統一的に付与(/simplify指摘)。これにより下流のログ分析やフィルタリングが一貫したスキーマで実施可能になった。

## artifacts

- dod-l1-l2.ts: impl: checkTDDRedEvidence免除ロジック追加(177行)
- definitions-shared.ts: impl: ARTIFACT_QUALITY_RULESユニーク制約追記(136行)
- dod-tdd.test.ts: test: scopeFiles免除テスト4件追加(117行)
- handler-templates-validation.test.ts: test: ユニーク制約テスト1件追加(176行)

## next

criticalDecisions: D-002(every判定で安全側), D-003(path.extname採用)
readFiles: docs/workflows/harness-reporting-fixes/code-review.md
warnings: なし。全ACがPASSであり、回帰なし。
