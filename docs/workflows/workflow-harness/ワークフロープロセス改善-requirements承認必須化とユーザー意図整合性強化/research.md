## サマリー

- 目的: 3つのプロセス改善実装に必要な現状把握と変更箇所の特定
- 主要な決定事項: requirements承認チェックは既に実装済み（REQ-B1）であり、追加では無くcode-reviewとspec.mdへの要件追加が必要
- 次フェーズで必要な情報: definitions.tsのcode_review subagentTemplatとspec.mdのrequiredSectionsへの追加、およびbuildRetryPromptの重複行検出ロジック

## 既存実装の分析

### requirements承認チェックの現状

next.tsの222-230行目でREQ-B1として既に実装されている。
- 実装位置: `src/tools/next.ts` の220-230行目
- 実装内容: `if (currentPhase === 'requirements') { if (!taskState.approvals?.requirements) { ... return error } }`
- チェック対象: `taskState.approvals?.requirements` フィールドの有無
- エラーメッセージ: 「requirements承認が必要です。workflow_approve requirements を実行してください」
- 現在の状況: requirementsフェーズから次フェーズへの遷移時に、必ず承認フラグのチェックが行われている

この実装により、requirementsフェーズの承認は既に必須化されている。ユーザーがworkflow_nextを呼び出す際、approvals.requirementsフラグが設定されていないと遷移がブロックされる。

### code-review.mdの現在のrequiredSections

artifact-validator.tsの246-248行目で定義されている。
- 現在のrequiredSections: 『設計-実装整合性』『コード品質』『セキュリティ』『パフォーマンス』（計4項目）
- 最小行数要件: minLines = 30行
- 各セクションの実質行数要件: 各セクションに最低5行の実質行を含める必須

definitions.tsの834-862行目のcode_review subagentTemplatには以下の詳細なガイダンスが既に含まれている。
- サマリーセクション（5行必須）のガイダンス: 「## サマリー」セクション先頭への配置を明記
- 設計-実装整合性セクション（5行必須）の各観点を詳細に列挙
- コード品質セクション（5行必須）の5観点ガイダンス
- セキュリティセクション（5行必須）の5観点ガイダンス
- パフォーマンスセクション（5行必須）の5観点ガイダンス
- 重複行回避ガイダンス: 複数のFR評価で同一フォーマットを繰り返すと重複検出エラーが発生し、FR番号や対象ファイル名を行に含めて一意化すること

### spec.mdの現在のrequiredSections

artifact-validator.tsの211-219行目で定義されている。
- 現在のrequiredSections: 『## 概要』『## 実装計画』『## 変更対象ファイル』（計3項目、英語版も並行）
- 最小行数要件: minLines = 50行、フェーズ遷移時は minLinesForTransition = 5行
- P0-2コメント: フェーズ遷移時は最低5行のみ必須であり、full validation時は50行必須を維持

現在のrequiredSectionsに「脅威モデル対処」「セキュリティ対応」などのセクションは含まれていない。

## 変更が必要な箇所

### FR-1: requirements承認チェック必須化

**判定**: 既に実装済み

既存実装で完全に対応されている。next.tsの222-230行目（REQ-B1）により、requirementsフェーズからの遷移時に承認フラグが必須チェックされている。追加の変更不要。

### FR-2: code_review成果物へのユーザー意図整合性チェック追加

**変更対象**: `definitions.ts`のcode_review subagentTemplate（834-862行目）

現在のsubagentTemplateには設計-実装整合性チェック項目が詳細に記述されている。ただし、以下の追加が検討される。

**追加検討事項**:
- ユーザーの意図（${userIntent}）との整合性確認セクションの追加
- code-review.mdの「## サマリー」セクションにユーザー意図との合致判定を記載するガイダンス
- artifact-validator.tsの246-248行目のrequiredSectionsに「## ユーザー意図整合性」セクションを追加するか、または現在の「設計-実装整合性」セクションに統合するか

実装場所: `definitions.ts` の834-862行目のsubagentTemplate内のガイダンスセクション末尾に追加ガイダンスを挿入

**具体的な変更内容**:
- subagentTemplate内の「設計-実装整合性セクションの行数ガイダンス」の直後に新規セクション「ユーザー意図整合性確認ガイダンス」を追加
- 新規セクションの内容: 「code-review実施時、userIntentに記載されたタスク目的と実装内容の合致を確認すること。設計書に基づく実装と異なり、ユーザーの原初的なタスク目的を満たしているかを検証する観点」
- 新規セクションの行数ガイダンス: 「『ユーザー意図整合性』行には最低3行の実質行を記述すること。userIntentの要約、実装とuserIntentの合致判定、乖離がある場合の説明をそれぞれ記述すること」

### FR-3: 脅威モデルクロスチェック項目のspec.mdへの追加

**変更対象**: `artifact-validator.ts`のspec.mdのrequiredSections（211-219行目）

現在のrequiredSections: 『## 概要』『## 実装計画』『## 変更対象ファイル』

**追加検討事項**:
- planningフェーズでthreat_modelingと並列実行されるため、spec.mdの仕様書にもセキュリティ関連セクションを追加すべきか
- 脅威モデルで検出された脅威への対応がspec.md実装計画に反映されているかを確認するセクションが必要

**変更内容の検討**:
- 新しいrequiredSectionとして『## セキュリティ対応』を追加するか、または『## 実装計画』内に「脅威モデル対応」項目を統合するか
- ただし、artifact-validator.tsの記述体系では複数言語対応（ja/en）が必要であり、新規セクション追加時はこれを考慮する必要がある

実装場所: `artifact-validator.ts` の211-219行目のspec.mdのrequiredSections配列

**実装時の検討事項**:
- lang記法を確認（現在は `{ ja: '##...', en: '##...'}` 形式）
- 新規セクション追加位置は『## 変更対象ファイル』の直後が適切
- セクション名案: 『## セキュリティ対応方針』（既存の脅威モデルとの連携を明示）

## 実装作業の推奨順序

1. FR-1: 既に実装済みのため確認のみ（修正不要）
2. FR-2: definitions.tsのcode_review subagentTemplate末尾にユーザー意図整合性ガイダンスセクションを追加
3. FR-3: artifact-validator.tsのspec.mdのrequiredSections配列に新規セクションを追加

## リスク評価と検討事項

**FR-2実装時の重複行検出リスク**:
subagentTemplate内の新規ガイダンスセクションでは、複数のFRやファイル評価のフォーマットが繰り返される場合、バリデーターが重複行を検出する可能性がある。既存コードの「評価結論フレーズの重複回避（特化ガイダンス）」セクション（862行目付近）に記載されている対策を参照し、FR番号や対象ファイル名を各行に含めて一意性を確保する必要がある。

**FR-3実装時のバリデーション影響**:
spec.mdのrequiredSectionsを増加させると、既存タスクのバリデーション結果が変わる可能性がある。新規セクション『## セキュリティ対応方針』を追加する場合、artifact-validator.tsの修正後にMCPサーバーの再起動が必須となる。

**MCPサーバーキャッシュ対策**:
definitions.tsまたはartifact-validator.tsを修正した場合、必ずMCPサーバープロセスを再起動すること。キャッシュが残っていると、修正前のバリデーション規則が継続して適用され、バリデーション失敗が継続する可能性がある。
