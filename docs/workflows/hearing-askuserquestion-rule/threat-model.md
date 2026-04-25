# Threat Model: hearing-askuserquestion-rule

taskId: d113c137-c400-401c-9e3e-bb968f5e84e9

## summary

workflow-phases.md に hearing フェーズセクション(約3行)を挿入する変更に対する脅威分析。変更対象は単一のドキュメントファイルであり、ランタイムコードへの影響はない。脅威は全て低リスクで、既存の制約と形式遵守により緩和される。

## threat-inventory

### T-001: 200行制限超過リスク

- 深刻度: 低 (追加後81行で上限200行に対し59%の余裕あり)
- 発生確率: 低 (現在78行で追加は約3行のみ)
- description: workflow-phases.md (現在78行) に約3行追加で81行となる。200行制限に対し59%の余裕がある。
- mitigation: AC-4 で200行以下を検証する。DoD ゲート (L1) で自動検出される。
- residual-risk: none (83行は上限の半分以下)

### T-002: 既存フェーズ記述との整合性リスク

- 深刻度: 中 (形式不一致はLLMパース失敗に直結する)
- 発生確率: 低 (既存セクション構造を踏襲するため逸脱しにくい)
- description: hearing セクションの記述形式が既存フェーズと異なると、LLM がフェーズ一覧を統一的にパースできなくなる。
- mitigation: AC-5 で形式の一致を検証する。research フェーズで既存パターン (見出し + 作業概要 + Output + DoD) を調査済み。D-003 (requirements) で同一形式を決定済み。
- residual-risk: negligible (形式パターンは明確に定義されている)

### T-003: 他スキルファイルとの矛盾リスク

- 深刻度: 中 (矛盾があるとLLM判断が分岐し挙動が不安定化する)
- 発生確率: 低 (researchで delegation.md との矛盾なしを確認済み)
- description: workflow-delegation.md の Phase Parameter Table に既に hearing 行 (L97) が存在する。phases.md の記述が delegation.md と矛盾すると LLM の判断が分岐する。
- mitigation: research フェーズで delegation.md の hearing 行を確認済み。hearing-worker エージェント型と AskUserQuestion ツールの記述は delegation.md と一致させる。AC-2, AC-3 で文字列レベルの検証を行う。
- residual-risk: negligible (参照元が単一で明確)

### T-004: 挿入位置の誤りによるセクション構造破壊リスク

- 深刻度: 低 (見出しベースの構造は挿入に対してロバスト)
- 発生確率: 低 (D-001で挿入位置を確定済みかつMarkdown見出しで区切られる)
- description: L11 付近への挿入が既存の Stage 0: scope_definition セクションの構造を壊す可能性。
- mitigation: D-001 (scope-definition) で挿入位置を scope_definition 直前に決定済み。Markdown の見出しレベル (###) で区切られるため、位置ずれがあっても構造は保持される。
- residual-risk: none (見出しベースの構造は挿入に対してロバスト)

### T-005: ロールバック不能リスク

- 深刻度: 低 (単一ファイルへのadditive changeでrevert副作用なし)
- 発生確率: 極低 (git revertで即時ロールバック可能と判断済み)
- description: 変更後に問題が発覚した場合にロールバックできない可能性。
- mitigation: impact-analysis D-004 で git revert による即時ロールバックが可能と判断済み。単一ファイルへの additive change であり、他ファイルとの依存関係がないため revert の副作用もない。
- residual-risk: none

## overall-risk-assessment

- overall-severity: low
- rationale: 変更対象は単一のドキュメントファイルであり、コード実行パスに影響しない。全脅威は既存の AC/DoD ゲートで検出可能であり、残存リスクは全て negligible 以下。

## decisions

- D-001: 全脅威を low/negligible と判定し、追加の緩和策は不要とする -- ドキュメント追加のみでランタイム影響がないため
- D-002: 既存の AC-1 から AC-5 が全脅威をカバーしており、脅威固有の新規 AC は追加しない -- T-001 は AC-4、T-002 は AC-5、T-003 は AC-2/AC-3 で検証済み
- D-003: セキュリティレビューは不要とする -- 認証・認可・データ処理に関わる変更がないため
- D-004: パフォーマンス影響の評価は対象外とする -- ドキュメントファイルの変更であり、実行時パフォーマンスに無関係なため
- D-005: 脅威モデルの再評価トリガーは「変更ファイルの追加」または「コード変更への拡大」とする -- 現スコープが維持される限り再評価不要

## artifacts

- C:/ツール/Workflow/docs/workflows/hearing-askuserquestion-rule/threat-model.md (本ファイル)

## next

phase: planning
action: F-001 の実装仕様を定義し、hearing セクションの具体的な記述内容を確定する
readFiles: "docs/workflows/hearing-askuserquestion-rule/requirements.md"
