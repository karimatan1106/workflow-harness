# Threat Model: hearing-worker-real-choices

taskId: 47bc7d35-75db-4c52-a5a8-1b42edf9f83e
phase: threat_modeling
size: large

## 脅威分析

### 変更対象の攻撃面

hearing-worker.mdはClaude Codeエージェント定義ファイルである。ランタイムコード実行なし。LLMプロンプトとして読み込まれるMarkdownテキスト。攻撃面はプロンプトインジェクション経由の指示無効化のみ。リスクは極低(内部開発ツール、外部ユーザー入力なし)。

defs-stage0.tsはTypeScript定数文字列(subagentTemplate)である。コンパイル時に静的文字列として評価される。ランタイムロジック変更なし。攻撃面はテンプレートインジェクション。リスクはなし(プレースホルダ置換はMCPプロトコル層で制御)。

### STRIDE分析

Spoofing: 該当なし。認証メカニズムに変更なし。
Tampering: 該当なし。ファイル内容の改ざんリスクは全ソースファイルと同等。
Repudiation: 該当なし。ログ機構に変更なし。
Information Disclosure: 該当なし。機密情報を扱わない変更。
Denial of Service: 該当なし。テンプレート文字列長の微増はパフォーマンスに影響しない。
Elevation of Privilege: 該当なし。権限モデルに変更なし。

### プロンプトインジェクションリスク

hearing-worker.mdに追加する品質ルールがLLMの自由度を制約する。意図的に無視される可能性はあるが、これはプロンプトエンジニアリングの一般的課題であり、本変更で新たに導入されるリスクではない。defs-stage0.tsのテンプレート指示も同様。

## decisions

- TM-001: 本変更は純粋なテキスト変更であり、セキュリティ脅威は検出されない。STRIDE全項目で該当なし。
- TM-002: hearing-worker.mdはエージェント定義であり外部攻撃面を持たない。内部開発チームのみがアクセスする。
- TM-003: defs-stage0.tsの変更は静的テンプレート文字列の書き換えのみ。ランタイムロジック変更なし。
- TM-004: プロンプトインジェクションリスクは本変更で増減しない。既存のプロンプト構造を維持。
- TM-005: テンプレート文字列へのユーザー入力の直接注入はMCPプロトコル層で防止されており、本変更で新たな注入ベクターは発生しない。

## artifacts

- docs/workflows/hearing-worker-real-choices/threat-model.md: spec: STRIDE分析全項目該当なし。テキスト変更のみでセキュリティ脅威なし。

## next

- criticalDecisions: TM-001(セキュリティ脅威なし)
- readFiles: .claude/agents/hearing-worker.md, workflow-harness/mcp-server/src/phases/defs-stage0.ts
- warnings: なし
