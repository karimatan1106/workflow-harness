# Design Review: harness-first-pass-improvement

taskId: harness-first-pass-improvement
phase: design_review

## acDesignMapping

| AC | 設計カバレッジ | planning.md参照箇所 |
|----|--------------|-------------------|
| AC-1 | coordinator.md Phase Output Rulesセクション追加。decisions 5件以上、artifacts列挙義務、acDesignMapping/acAchievementStatus必須を明記 | File 1 (PL-001) |
| AC-2 | worker.md Edit Completenessセクション追加。全件適用義務、8箇所閾値、件数一致報告の3ルール | File 2 (PL-002) |
| AC-3 | defs-stage4.ts Edit 3a: implementationにharness_capture_baseline手順追加。Edit 3b: code_reviewにharness_update_rtm_status手順追加 | File 3 (PL-003, PL-004) |
| AC-4 | 行数見積もり: coordinator.md 38→52行、worker.md 57→63行、defs-stage4.ts 186→194行。全て200行以下 | PL-005 |
| AC-5 | テキスト追加のみでロジック変更なし。既存テスト843件への影響なし。build_check/testingフェーズで実証 | PL-006 |

## decisions

- DR-001: planning.mdのEdit差分はrequirements.mdのREQ-001〜REQ-008を全てカバーしている。coordinator.mdの挿入位置(Result Format直前)はREQ-001の「独立セクションとして追加」と整合する。
- DR-002: ui-design.mdのUI-004(必須語の使用)がplanning.mdの手順テキストに反映されている。「必須手順」「禁止」「未記録の場合...差し戻し」の語彙が確認できる。
- DR-003: defs-stage4.tsのEdit 3aはold_stringに`{BASH_CATEGORIES}`を含むが、同一パターンがrefactoringブロックにも存在する可能性がある。implementationブロック(82行目付近)であることがplanning.mdに明記されており、適用時にworkerへ位置指定が必要。
- DR-004: worker.mdのEdit Completeness Ruleは「8箇所以上でWrite推奨」としているが、本タスクのEdit数は4件(3ファイル×各1-2箇所)であり閾値未満。Edit方式で問題なし。
- DR-005: RTM F-004がAC-4とAC-5の両方にマッピングされている。AC-5(テスト全パス)は行数制限とは独立した検証項目であり、F-004の説明「全ファイル200行以下」はAC-4のみに対応する。ただしF-004のAC列にAC-5が含まれる点はrequirements.mdの記述であり、本フェーズでの修正対象外。implementationフェーズでの注意事項として申し送る。
- DR-006: ui-design.mdのUI-005(前提条件付き記載)がplanning.mdのEdit 3bに「全ACが合格の場合」として反映されている。条件付き実行フローが設計通り。
- DR-007: planning.mdの3つのEdit操作は全て挿入(既存行の前に新テキストを追加)であり、既存テキストの削除・変更を含まない。副作用リスクは最小。

## findings

- FND-001: planning.mdのEdit 3aのold_stringに含まれる`{BASH_CATEGORIES}`パターンがファイル内で一意であることの検証が必要。implementationフェーズでworkerに対してファイル内検索を指示すること。
- FND-002: requirements.mdのF-004がAC-4/AC-5の両方にマッピングされている件は、設計上の矛盾ではなく粒度の問題。AC-5のテスト検証はbuild_check/testingフェーズで独立して実施されるため、実運用上の影響はない。
- FND-003: coordinator.mdの新セクション名「Phase Output Rules」はDoDゲートの検証ロジック(dod-*.ts)と直接連動しない。ルールの実効性はLLMのプロンプト遵守に依存する。これは設計判断(UI-004の「必須」語使用)で対処済み。

## artifacts

| 成果物 | 状態 |
|-------|------|
| design-review.md (本ファイル) | 作成済み |
| planning.md | レビュー完了、承認 |
| requirements.md | レビュー完了、整合性確認済み |
| ui-design.md | レビュー完了、整合性確認済み |

## next

- implementationフェーズで3ファイルへのEdit適用を実施
- Edit 3a適用時、old_stringの一意性をworkerに検証させること(FND-001)
- F-004のAC-5マッピングについてはcode_reviewフェーズで再確認(DR-005)
- テスト実行(843件PASS)はbuild_checkフェーズで確認
