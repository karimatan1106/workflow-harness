# Hearing: article-insights-harness-improvements

userResponse: "4件すべて承認。P1(assumptionタグ)、P2(code_review独立分離)、P3(AI slopパターンL4検出)、P4(planningからコード例排除)。Anthropic記事の知見をharnessに反映する"

## overview

Anthropic engineering article (GAN-inspired agent architecture) の10知見とworkflow-harness現行実装のギャップ分析から、ユーザーが承認した4件の改善をharnessに適用する。各改善は既存アーキテクチャ(L1-L4決定的ゲート、ADR-001 L5禁止、30フェーズ構造)との整合性を維持しつつ導入する。

## intent-analysis

- surfaceRequest: Anthropic記事の知見から厳選した4改善をworkflow-harnessに反映する
- deepNeed: harnessの複雑化を抑止し(P1)、評価の独立性を高め(P2)、成果物品質を実質的に向上させ(P3)、planningフェーズの過剰詳細によるカスケード障害を防止する(P4)

## unclearPoints

- P2(code_review分離)の実装粒度: delegate_coordinatorとして完全分離するか、既存code_reviewフェーズ内でコンテキスト分離のみ行うか
- P3(AI slopパターン)の初期パターン数: 網羅性と偽陽性のバランス。既存禁止語12種との統合方法
- P1(assumptionタグ)の棚卸しトリガー: モデルアップグレード時の自動検出か、手動レビューサイクルか

## assumptions

- 4件は独立に実装可能であり、相互依存は低い
- P1, P3, P4はルール/設定ファイルの変更が主。P2はdelegate-coordinator.tsの拡張が必要
- 既存ADR(ADR-001 L5禁止, ADR-003 簡素化前例, ADR-004 Why/What/How分離)との整合性を維持する
- harnessサブモジュール内のファイル変更が対象

## approved-items

### P1: assumptionタグ導入 (知見#8: harness簡素化原則)

- currentState: 30フェーズ、23ルール、22禁止アクション。各ルール/ゲートが「どのモデル能力不足を補っているか」のアノテーションがない。定期棚卸し機構なし
- proposedChange: ルール/ゲート定義にassumptionタグ(例: `assumption: "モデルが禁止語を自発的に回避できないため"`)を付与し、モデル更新時の棚卸しプロセスを導入する
- expectedEffect: harness肥大化の抑止。ADR-003の前例(3層→2層簡素化)を体系的に再現可能にする
- referenceGap: 知見#8(harness簡素化原則)、ADR-003前例

### P2: code_review独立分離 (知見#1,9: Generator/Evaluator分離 + Self-evaluation問題)

- currentState: code_reviewフェーズでopusモデルを使用するが、生成と評価が同一ワークフロー内で逐次実行。生成コンテキストにアクセス可能で独立性が不完全
- proposedChange: code_reviewを独立delegate_coordinatorプロセスとして分離し、生成時の中間状態を一切渡さない。fresh contextで評価を実行する
- expectedEffect: 評価の独立性向上。自己評価バイアス(confirmation bias, anchoring)の構造的排除。記事のGAN的「対立構造」に近づく
- referenceGap: 知見#1(Generator/Evaluator分離)、知見#9(Self-evaluation問題)

### P3: AI slopパターン検出 (知見#4: 4軸重み付き評価基準)

- currentState: DoD ゲートは機能的正当性(L1-L4)のみ。禁止語12種で品質最低ラインを保証。AI slopパターン(generic filler, boilerplate, repetitive structure)の検出なし
- proposedChange: L4正規表現パターンとしてAI slopパターンをartifact qualityチェックに追加する。既存のduplicate lines検出(L4)の拡張として実装
- expectedEffect: 成果物の実質的品質向上。ADR-001(L5禁止)との整合性を維持しつつ、意味的品質の一部をL4で捕捉可能にする
- referenceGap: 知見#4(4軸重み付き評価基準のうちAI slop検出部分)

### P4: planningフェーズのコード例排除 (知見#7: Planner agent)

- currentState: planningフェーズはF-NNN with specで詳細な技術仕様を要求。具体的なコード例を含むことが可能で、技術的指示がGeneratorを誤誘導するカスケード障害リスクがある
- proposedChange: planningフェーズの出力からコード例を排除するルールを追加する。planningは「What」に限定し「How」をimplementationに委ねる
- expectedEffect: カスケード障害(Plannerの技術的指示がGeneratorを誤誘導)の防止。ADR-004(Why/What/How 3層分離)との整合性強化
- referenceGap: 知見#7(Planner agent、技術詳細の意図的省略)

## implementation-plan

4件を独立タスクとして並行実装可能:
- (A) P1: workflow-rules.md / workflow-gates.md 内のルール/ゲート定義にassumptionタグを付与。棚卸しチェックリストを新規作成
- (B) P2: delegate-coordinator.ts のcode_reviewフェーズ処理を独立プロセス化。buildCoordinatorPromptから生成時中間状態を除外
- (C) P3: llm-quality-gates.ts またはDoD検証ロジックにAI slopパターン(L4正規表現)を追加。初期パターン5-10個
- (D) P4: workflow-phases.md のplanningフェーズ定義にコード例排除ルールを追加。DoDゲートにコードブロック検出(L4)を追加

estimatedScope: 4-6ファイル変更。推定差分100-150行。テストファイル2-3個追加または拡張

## risks

- P2(code_review分離)はdelegate-coordinator.tsの構造変更を伴い、既存30フェーズ構造との整合性調整が必要。変更範囲が最も大きい
- P3(AI slopパターン)は偽陽性リスクがある。正当なコード内のパターンを誤検出する可能性。初期は警告のみで、ゲートブロックは段階的に導入する
- P1(assumptionタグ)は全ルール/ゲートへの横断的アノテーションが必要で、一括変更のレビューコストが高い
- 4件同時実装の場合、code_review関連(P2, P3)に依存関係が生じる可能性がある

## decisions

- D-HR-1: 4件すべてをユーザー承認済みとしてスコープに含める
- D-HR-2: P2の実装はdelegate_coordinator既存機構を活用し、新規インフラは作らない
- D-HR-3: P3のAI slopパターンはL4(正規表現)で実装し、ADR-001(L5禁止)を遵守する
- D-HR-4: P4はADR-004(Why/What/How分離)の具体的適用として位置づける
- D-HR-5: 情報源はAnthropicエンジニアリング記事のギャップ分析(.agent/article-gap-analysis.md)

## artifacts

- docs/workflows/article-insights-harness-improvements/hearing.md: 本ヒアリング結果。4件の承認済み改善のスコープと判断を記録

## next

readFiles: "workflow-harness/mcp-server/src/tools/delegate-coordinator.ts, workflow-harness/CLAUDE.md, .claude/skills/workflow-harness/workflow-rules.md, .claude/skills/workflow-harness/workflow-gates.md, .claude/skills/workflow-harness/workflow-phases.md"
warnings: "P2(code_review分離)は変更範囲が最も大きい。requirements定義時にP2の実装粒度を明確化する必要あり"
