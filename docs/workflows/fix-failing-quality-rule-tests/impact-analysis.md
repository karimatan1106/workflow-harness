# Impact Analysis: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Change Summary

3つのagent定義ファイル (.claude/agents/ 配下) にルールセクションをテキスト追加する。
コード変更なし、テストファイル変更なし、依存関係変更なし。

## Impact Matrix

| Target File | Current Lines | Added Lines | Post Lines | 200行制限 | Risk |
|-------------|--------------|-------------|------------|-----------|------|
| coordinator.md | 38 | 8 | 46 | OK | Low |
| worker.md | 57 | 8 | 65 | OK | Low |
| hearing-worker.md | 28 | 12 | 40 | OK | Low |

## Affected Components

### Direct Impact (変更対象)

1. coordinator.md: Phase Output Rules セクション追加。L2 Coordinator の出力形式ルールが明示される。
2. worker.md: Edit Completeness セクション追加。L3 Worker の編集完全性ルールが明示される。
3. hearing-worker.md: AskUserQuestion Quality Rules セクション追加。ヒアリング品質ルールが明示される。

### Indirect Impact (影響を受ける可能性)

- Orchestrator (L1): coordinator/worker の振る舞い変更により、出力品質が向上する可能性あり。ただし追加されるルールは既存の暗黙知を明文化するものであり、破壊的変更ではない。
- テストスイート: 10件の失敗テストがPASSに変わる。既存6件のPASSテストへの影響なし。
- 他のagent定義ファイル: 影響なし。各ファイルは独立したagent定義。

### No Impact (影響なし)

- workflow-harness/ 配下のハーネス本体コード
- docs/adr/ 配下のADRドキュメント
- .claude/rules/ 配下のルールファイル
- MCP サーバー設定・ツール定義

## Risk Assessment

- 全変更がMarkdownテキスト追加のみであり、コード実行パスに影響しない
- 各ファイルの既存セクション内容は変更しない（末尾追記のみ）
- 200行制限に対して十分な余裕がある（最大でも65行）
- テスト正規表現パターンとの一致はresearchフェーズで確認済み

## Decisions

- D-001: 影響範囲は .claude/agents/ 配下の3ファイルに限定。他のコンポーネントへの波及なし。
- D-002: 各ファイルへの変更は末尾追記のみとし、既存セクションの編集は行わない。
- D-003: 3ファイルの変更は相互に独立しているため、並列実装が可能。
- D-004: 追加するルールテキストはテスト正規表現パターン (research.md 記載) に合致する文言を使用する。
- D-005: 追加後の行数は全ファイルで200行制限を十分に下回ることを確認済み。
- D-006: 既存の6件PASSテスト (AC-3系, AC-4系) への影響がないことを確認済み。
- D-007: テストコード自体の変更は不要であり、スコープ外を維持する。

## Artifacts

- `docs/workflows/fix-failing-quality-rule-tests/impact-analysis.md` (本ファイル)
- `.claude/agents/coordinator.md` (Phase Output Rules セクション追加予定)
- `.claude/agents/worker.md` (Edit Completeness セクション追加予定)
- `.claude/agents/hearing-worker.md` (AskUserQuestion Quality Rules セクション追加予定)

## Next

design フェーズ: 各ファイルへの追加テキストの詳細設計（テスト正規表現パターンとの照合を含む）
