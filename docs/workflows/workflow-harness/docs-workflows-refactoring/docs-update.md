# docs_update: docs-workflows-refactoring

## decisions

1. CLAUDE.md は変更不要 -- docs/workflows/ のパスを直接ハードコードしている箇所がないことを確認済み。ルールファイル群(.claude/rules/)も同様に docs/workflows/ 内の個別ディレクトリパスに依存していない。
2. ADR は変更不要 -- ADR-001 から ADR-009 までの全件を確認し、いずれも docs/workflows/ の具体的なディレクトリ名を参照していない。ADR はイミュータブルであり、仮に参照していても歴史的記録として修正対象外となる(ADR-004)。
3. ハーネスの docsDir パス解決は動的生成のため変更不要 -- workflow-state.toon の docsDir フィールドは taskId ベースで動的に設定され、カテゴリサブディレクトリの有無に関わらず正しいパスを解決する。defs-stage6.ts の `{docsDir}` プレースホルダも同様。
4. MEMORY.md のインデックスは変更不要 -- ユーザーのメモリファイルは docs/workflows/ のディレクトリ構造を直接参照しておらず、ハーネスのサブシステム別に構造化されている。
5. README.md および CHANGELOG.md への記載は不要 -- 本タスクはファイルシステム操作のみでありAPIやコード変更を含まない。外部利用者に影響するインターフェース変更がないため、変更ログへの記録対象外と判断した。
6. スキルファイル(.claude/skills/workflow-harness/)は変更不要 -- workflow-docs.md, workflow-phases.md 等のスキルファイルは docs/workflows/ の内部ディレクトリ構造ではなく、フェーズ定義とテンプレート仕様を記述しており、ディレクトリ再編の影響を受けない。
7. .agent/handoff/ のハンドオフファイルは変更不要 -- ハンドオフはセッション間の引き継ぎ情報であり、docs/workflows/ の旧ディレクトリパスを永続的に参照する仕組みではない。

## impact-analysis-summary

本タスクの変更範囲は docs/workflows/ ディレクトリ内のファイル移動・削除・リネームに限定される。

変更の性質:
- 半角カタカナ重複ディレクトリの削除(24件)
- 半角のみディレクトリの全角リネーム(43件)
- 旧プロジェクトディレクトリの削除(32件)
- カテゴリ別サブディレクトリへの再配置(195件、4カテゴリ: bugfix/feature/workflow-harness/investigation)
- 散在 .md ファイルのディレクトリ化(14件)

影響を受けないもの:
- ソースコード: 変更なし
- API: 変更なし
- 設定ファイル: 変更なし
- テスト: 変更なし
- CI/CD: 変更なし

ドキュメント更新が不要である理由:
本タスクはドキュメント管理ディレクトリ自体の構造整理であり、ソフトウェアの振る舞いに影響しない。ハーネスが docs/workflows/ 配下のパスを参照する際は taskId ベースの動的解決を用いるため、カテゴリサブディレクトリの追加は透過的に処理される。

## artifacts

| 確認対象 | 判定 | 根拠 |
|---------|------|------|
| CLAUDE.md | 変更不要 | docs/workflows/ の個別パス参照なし |
| .claude/rules/*.md | 変更不要 | ポリシー定義のみ、パス依存なし |
| docs/adr/ADR-001 - ADR-009 | 変更不要 | イミュータブル、パス参照なし |
| .claude/skills/workflow-harness/*.md | 変更不要 | テンプレート変数 {docsDir} で動的解決 |
| workflow-harness/mcp-server/src/ | 変更不要 | docsDir は taskId から動的生成 |
| README.md | 変更不要 | コード変更・API変更なし |
| CHANGELOG.md | 変更不要 | ユーザー向けインターフェース変更なし |
| MEMORY.md | 変更不要 | docs/workflows/ 内部構造の参照なし |
| .agent/handoff/ | 変更不要 | セッション一時情報、永続パス参照なし |

更新したドキュメント: なし(全項目で変更不要と判定)

## next

commit フェーズへ進む。docs/workflows/ のディレクトリ再編結果を git add してコミットする。コミットメッセージは refactor: restructure docs/workflows into category subdirectories の形式を推奨する。
