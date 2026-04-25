# Threat Model: fix-failing-quality-rule-tests

taskId: 516baef8-f09e-45d9-a654-fb70c308f925

## Change Overview

3つのagent定義Markdownファイル (.claude/agents/coordinator.md, worker.md, hearing-worker.md) にテキストセクションを追記する。コード変更なし、ランタイム依存変更なし。

## Threat Analysis

### T-001: Agent Behavior Drift from Ambiguous Rule Wording

Severity: Medium
対象: coordinator.md, worker.md, hearing-worker.md
追加するルールテキストの文言が曖昧な場合、LLMが意図と異なる解釈をしてagent動作がドリフトする可能性がある。
Mitigation: テスト正規表現パターン (research.md記載) に厳密に合致する文言のみ使用し、解釈の余地を最小化する。テストがPASSすることで文言の正確性を機械的に検証する。

### T-002: Existing Section Corruption by Misplaced Insertion

Severity: Medium-High
対象: 全3ファイル
追記位置を誤ると既存セクションの構造が破壊され、他のテスト (現在PASS中の6件) がFAILに転じる可能性がある。
Mitigation: 既存セクション内容は一切変更せず末尾追記のみとする方針 (D-002)。追記後に全16テストを実行し、既存PASSテストの退行がないことを確認する。

### T-003: 200-Line Limit Violation

Severity: Low-Medium
対象: worker.md (現在57行、追記後65行予定)
追加テキスト量が想定を超えた場合、200行制限テスト (TC-AC4-01〜03) が失敗する可能性がある。
Mitigation: impact-analysisで各ファイルの追記後行数を算出済み (最大65行)。200行制限に対し67.5%以上の余裕がある。

### T-004: Regex Pattern Mismatch Leading to False PASS

Severity: Low
対象: hearing-worker.md
テスト正規表現パターンに「表面的に」合致するが、実質的にルールとして機能しないテキストを追加してしまうリスク。テストはPASSするが、agentの品質ルールとしては無意味になる。
Mitigation: research.mdで特定済みのテストパターンと、requirements.mdで定義されたルールの意図 (F-001〜F-003) の両方を満たすテキストを設計する。

### T-005: Markdown Heading Hierarchy Conflict

Severity: Low-Medium
対象: coordinator.md
追加するセクション見出し (## Phase Output Rules) が既存の見出し階層と衝突し、ドキュメントパーサーやLLMの構造認識を混乱させる可能性がある。
Mitigation: 既存ファイルの見出し構造を事前確認し、同一階層 (##) で末尾に追加する。他に同名見出しがないことをGrepで検証する。

## Attack Surface

本変更はMarkdownテキスト追加のみであり、以下のカテゴリの攻撃面は存在しない:

- ネットワーク通信: なし (外部API/サービス呼び出しなし)
- 認証/認可: なし (クレデンシャル操作なし)
- データ永続化: なし (DB/ストレージ操作なし)
- コード実行: なし (スクリプト/バイナリの変更なし)
- 依存関係: なし (パッケージ追加/更新なし)

agentプロンプトとして読み込まれるMarkdownファイルへの追記であるため、唯一の攻撃面はLLMの振る舞いへの間接的影響に限定される。

## decisions

- D-001: T-001〜T-005の5脅威を特定。全てMedium-High以下であり、ブロッキングリスクなしと判定
- D-002: 最大リスクはT-002 (既存セクション破壊) であり、末尾追記のみ方針+全テスト実行で緩和する
- D-003: コード実行パスへの影響がゼロであるため、セキュリティレビューは不要と判定
- D-004: 各脅威の緩和策はimplementationフェーズの手順に組み込む (テスト全件実行を必須化)
- D-005: Markdown追記のみのため、ロールバック手段はgit revertで十分 (追加のロールバック設計は不要)
- D-006: T-004 (パターン偽合致) への対策として、テストパターンだけでなくルール意図との整合性も設計時に検証する

## artifacts

- `docs/workflows/fix-failing-quality-rule-tests/threat-model.md` (本ファイル)

## next

design フェーズ: 各ファイルへの追加テキストの詳細設計。テスト正規表現パターンとのマッチング検証、見出し階層の整合性確認を含む。
