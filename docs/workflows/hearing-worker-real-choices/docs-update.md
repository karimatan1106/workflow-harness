# Docs Update: hearing-worker-real-choices

## decisions

- DU-001: hearing-worker.md自体が変更対象エージェント定義ドキュメントであり、planningフェーズで既に更新済み。追加のドキュメント更新は不要。
- DU-002: CLAUDE.mdへの追記は不要。hearing-workerの行動規範はエージェント定義ファイル(.claude/agents/hearing-worker.md)が単一権威であり、CLAUDE.mdに転記すると二重管理(ADR-004違反)になる。
- DU-003: ADR作成は不要。今回の変更は「確認形式禁止」「トレードオフ必須」という品質ルールの追加であり、既存のルール体系(AskUserQuestion Guidelines)の強化に過ぎない。新しいアーキテクチャ判断や設計方針の変更ではない。
- DU-004: READMEへの追記は不要。hearing-workerの質問品質向上は内部ツールの動作改善であり、外部ユーザー向けドキュメントの変更対象ではない。
- DU-005: defs-stage0.tsのテンプレート文言変更はコード内テンプレートであり、docsディレクトリ配下のドキュメントではない。ドキュメント観点での追加対応は不要。
- DU-006: workflow-harness/CLAUDE.mdへの追記は不要。hearingフェーズの具体的な質問品質ルールはエージェント定義とテンプレートが担い、ハーネス権威仕様は抽象度を維持する。
- DU-007: MEMORYインデックスへの追記は不要。hearing-workerの品質ルール追加は既存ファイル(feedback/配下)のスコープ内であり、新トピック・新ファイル追加を伴わない。

## artifacts

| artifact | status | reason |
|----------|--------|--------|
| .claude/agents/hearing-worker.md | updated (implementation phase) | AskUserQuestion Quality Rulesセクション追加済み |
| workflow-harness/mcp-server/src/phases/defs-stage0.ts | updated (implementation phase) | テンプレート文言に確認禁止・トレードオフ必須を反映済み |
| CLAUDE.md | no change needed | エージェント定義ファイルが単一権威(ADR-004) |
| docs/adr/ | no change needed | 新設計判断なし、既存ルール体系の強化のみ |
| README.md | no change needed | 内部ツール動作改善、外部向け記述不要 |

## next

1. DoD gate通過確認
2. acceptance_report フェーズへ進行
