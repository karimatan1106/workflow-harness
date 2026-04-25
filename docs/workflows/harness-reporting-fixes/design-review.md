# Design Review: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: design_review

## AC-to-Design Coverage Matrix

| AC | Design Document | Section/Location | Coverage Status |
|----|----------------|------------------|-----------------|
| AC-1 | ui-design.md | P1: checkTDDRedEvidence戻り値変更 | Covered. scopeFiles全要素が.md/.mmdの場合にpassed:true返却、evidence に免除理由と拡張子一覧を含める仕様が明記されている。planning.md Step 1で実装箇所(L78-79直後)と追加行数(約10行)が特定されている。 |
| AC-2 | ui-design.md | P1: 既存の3つの戻り値パターン | Covered. 「既存の3つの戻り値パターンは変更しない」と明記。scopeFilesにコードファイルが含まれる場合はproofLogフィルタに到達する既存フローが維持される。planning.md Step 3テストケース2で混合scopeFilesの回帰確認も設計済み。 |
| AC-3 | ui-design.md | P2: ARTIFACT_QUALITY_RULES文字列定数変更 | Covered. 「同一内容の行は2回まで(3回以上の重複でDoD不合格)」に相当する行を追記する仕様。checkDuplicateLinesの閾値(3回以上)との数値整合がD-004で確認されている。 |
| AC-4 | planning.md | Step 3 + Step 4 | Covered. Step 3で新規テストケース4件を設計(doc-only/mixed/empty/evidence確認)。Step 4で全テストスイートの回帰確認をvitest runで実行する計画。handler-templates-validation.test.tsへの影響もriskMitigationで言及されている。 |
| AC-5 | planning.md | Step全体 + riskMitigation | Covered. dod-l1-l2.ts: 167行+約10行=177行(200行以下)。definitions-shared.ts: 135行+0-1行(200行以下)。両ファイルとも余裕をもって制約内に収まる見積もりが記載されている。 |

## RTM-to-Design Traceability

| RTM | AC参照 | 設計カバレッジ |
|-----|--------|---------------|
| F-001 | AC-1, AC-2, AC-4 | ui-design.md P1セクション + planning.md Step 1, Step 3 |
| F-002 | AC-3, AC-4 | ui-design.md P2セクション + planning.md Step 2 |
| F-003 | AC-4, AC-5 | planning.md Step 4 + riskMitigation |

## Design Consistency Check

設計文書間の一貫性を検証した結果:

- requirements.md D-001(完全免除)とui-design.md P1(passed:true返却)は整合している。warningレベルではなくpassed:trueが一貫して採用されている。
- requirements.md D-002(拡張子は.md/.mmdの2種)とui-design.md DOC_ONLY_EXTENSIONS定義は整合している。
- requirements.md D-004(空配列は免除しない)とui-design.md「scopeFilesが空配列の場合の扱い」セクションは整合している。
- planning.md D-002(extname比較)とui-design.md D-003(endsWith)に手段の差異がある。planning.mdはSet.hasによるextname比較、ui-design.mdはendsWithを採用している。ただしplanning.md D-002の記述「Set.hasによる完全一致」はendsWith+Set.has組合せとも解釈可能であり、実質的な動作差異はない。実装時にendsWith方式を採用すれば両文書の意図を満たす。

## decisions

- D-001: 全5件のACが設計文書(ui-design.md + planning.md)で網羅されており、カバレッジギャップはない。
- D-002: RTM F-001/F-002/F-003の全項目が設計ステップに対応付けられており、追跡可能性が確保されている。
- D-003: planning.md D-002とui-design.md D-003の拡張子判定手段に表記差異があるが、endsWithをベースにSet.hasで拡張子セットを管理する実装であれば両文書を満たす。実装時はui-design.md D-003(endsWith)を優先する。理由: ui-design.mdがより後のフェーズで作成されており、path import不要という技術的根拠が明記されているため。
- D-004: scopeFiles空配列の処理がrequirements.md D-004、ui-design.md、planning.md Step 3テストケース3の三箇所で一貫して「免除しない」と定義されている。設計文書間の矛盾はない。
- D-005: handler-templates-validation.test.tsがARTIFACT_QUALITY_RULES変更で失敗する可能性がriskMitigationで識別されている。Step 4での早期検出戦略は適切であり、追加の設計変更は不要と判断する。
- D-006: 並列実行計画(Step 1 || Step 2 -> Step 3 -> Step 4)は依存関係グラフと整合しており、Step 3がStep 1完了後に実行される順序制約が正しく定義されている。

## acDesignMapping

- AC-1: ui-design.md P1セクション — checkTDDRedEvidence にscopeFiles拡張子判定を追加し、全.md/.mmdの場合に passed:true を返す設計
- AC-2: ui-design.md P1セクション else分岐 — コードファイルが含まれる場合は既存ロジックをそのまま実行する設計
- AC-3: ui-design.md P2セクション — ARTIFACT_QUALITY_RULES定数に全行ユニーク制約文言を追記する設計
- AC-4: planning.md Step4 — 回帰テスト実行による既存テスト全パス確認
- AC-5: planning.md 全Step — 各変更ファイルの行数が200行以下を維持する制約

## artifacts

- docs/workflows/harness-reporting-fixes/design-review.md: review: AC-to-Design マッピング検証、RTM追跡性確認、設計文書間一貫性チェック

## next

- design_reviewゲート通過後、test_designフェーズでテストケース仕様を定義する
- planning.md Step 3の4テストケースをTC-AC1-01等の形式で正式化する
