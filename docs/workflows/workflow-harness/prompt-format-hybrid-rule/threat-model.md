# Threat Model: prompt-format-hybrid-rule

## STRIDE分析

### Spoofing (なりすまし)
- 脅威: 形式ルールを悪意あるプロンプトインジェクションに利用
- 評価: LOW - workflow-delegation.mdはClaude Code agentのシステムプロンプトとして読み込まれる。外部入力ではなく、リポジトリ管理者のみが変更可能
- 対策: git管理下で変更履歴を追跡

### Tampering (改ざん)
- 脅威: 形式ルールの改ざんによるsubagent出力品質の低下
- 評価: LOW - リポジトリ書き込み権限が必要。PRレビューで検出可能
- 対策: コードレビューフェーズで整合性検証

### Repudiation (否認)
- 脅威: 形式ルール変更の否認
- 評価: NEGLIGIBLE - git commitで変更者と日時を記録
- 対策: gitログが監査証跡

### Information Disclosure (情報漏洩)
- 脅威: 形式ルール内に機密情報が含まれる
- 評価: NONE - ルールは形式ガイドラインのみ。秘密鍵やトークンを含まない
- 対策: 不要

### Denial of Service (サービス拒否)
- 脅威: 過大なルールセクションによるコンテキストウィンドウ圧迫
- 評価: LOW - 15-20行追加（約300トークン）。200行制限で自然に上限が設定される
- 対策: 200行制限の遵守

### Elevation of Privilege (権限昇格)
- 脅威: 形式ルールを通じたツール権限の拡張
- 評価: NONE - 形式ルールはプロンプトのフォーマットを規定するだけで、ツール権限に影響しない
- 対策: 不要

## リスクサマリー

全STRIDE項目でLOW以下。Markdown設定ファイルへの15-20行追加は攻撃面を実質的に拡大しない。

## decisions

- STRIDE網羅性: 6カテゴリ全て分析 -- 形式ルール追加は低リスクだが網羅的分析で見落としを防止
- 最大リスク: Tampering(LOW) -- リポジトリ書き込み権限+PRレビューで十分に軽減
- コンテキスト圧迫: 300トークン増加は0.15% -- 200行制限が自然な上限として機能
- 権限影響: なし -- 形式ルールはフォーマット規定のみでツール権限に干渉しない
- 追加対策: 不要 -- 既存のgit管理+コードレビュー+200行制限で十分

## artifacts

| # | file | status |
|---|------|--------|
| 1 | docs/workflows/prompt-format-hybrid-rule/threat-model.md | new |

## next

- planning phase
