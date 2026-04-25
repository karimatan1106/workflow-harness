# Impact Analysis: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
date: 2026-03-24

## summary

docs/workflows ディレクトリの整理タスクであり、コード変更は一切不要。ハーネスコードはすべてtaskId/taskNameベースの動的パス生成を使用しているため、ディレクトリ構造変更による破壊的影響はゼロ。リスクは非重複ディレクトリの誤削除のみ。

## impactedFiles

| file | changeType | risk |
|------|-----------|------|
| docs/workflows/ 直下の半角重複ディレクトリ24件 | deleted | 低 |
| docs/workflows/ 直下の半角のみディレクトリ45件 | renamed | 中 |
| docs/workflows/ 直下の旧プロジェクト関連ディレクトリ33件 | deleted | 低 |
| docs/workflows/ 直下の残存ディレクトリ約194件 | moved | 低 |
| docs/workflows/ 直下のルーズ.mdファイル14件 | moved | 低 |

## unaffectedModules

| module | reason |
|--------|--------|
| workflow-harness/mcp-server/ | docs/workflows/{taskName}の動的パス生成のみ使用。個別ディレクトリ名のハードコードなし |
| workflow-harness/hooks/ | tool-gate.jsはincludes('docs/workflows/')パターンマッチのみ。サブディレクトリ構造に依存しない |
| .claude/rules/ | ワークフロールール定義。docs/workflows/への参照なし |
| .claude/skills/ | スキルファイル群。特定タスクディレクトリへの参照なし |
| .gitignore | **/docs/workflows/ パターンでディレクトリ全体をignore済み。構造変更の影響なし |

## breakingChanges

なし。本タスクはドキュメントディレクトリの整理のみであり、ソースコード・設定ファイル・テスト・APIに対する変更は発生しない。.gitignoreで既にdocs/workflows/全体がignoreされているため、git履歴への影響もない。

## decisions

- IA-01: コード変更は一切不要と判定（全パスが動的生成、ハードコード参照なし）
- IA-02: 半角のみディレクトリ45件はmv操作で全角カタカナにリネーム
- IA-03: 削除前に各重複ペアの内容同一性をdiffで検証、差分ありなら全角版にマージ後削除
- IA-04: カテゴリ移動は4分類（bugfix/feature/workflow-harness/investigation）で確定
- IA-05: 実装は5段階に分割しそれぞれgit commitする（ロールバック粒度確保）
- IA-06: テスト影響なし（vitestはdocs/workflows/の具体的内容に非依存）
- IA-07: .gitignoreによりステージング影響なし（ローカルファイルシステムのみの変更）

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/impact-analysis.md | report | 本ファイル: 影響分析結果 |

## next

- criticalDecisions: コード変更不要(IA-01)、削除前の内容同一性検証(IA-03)、5段階コミット分割(IA-05)
- readFiles: docs/workflows/docs-workflows-refactoring/research.md (重複ペア一覧), docs/workflows/docs-workflows-refactoring/scope-definition.md (スコープ確認)
- warnings: 半角のみディレクトリ45件のリネーム時にShellのエスケープに注意(日本語パス+特殊文字)。Windows環境でのmv操作はパス長制限(260文字)に留意。
