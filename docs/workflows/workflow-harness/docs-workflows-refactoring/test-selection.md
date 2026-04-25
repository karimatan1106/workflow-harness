# Test Selection: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: test_selection
date: 2026-03-24
inputArtifact: docs/workflows/docs-workflows-refactoring/test-design.md

## summary

本タスクはコード変更を伴わないファイルシステム操作(ディレクトリ移動/削除/リネーム)のため、vitestで新規テストファイルを作成する必要はない。TC-AC1-01からTC-AC6-01はbashコマンドによるファイルシステム状態検証(L1チェック)であり、TC-AC7-01は既存vitest suiteの全件実行による回帰テスト(L2チェック)である。

## decisions

- TS-01: 新規テストファイルの作成は不要。本タスクのソースコード変更はゼロであり、vitestテストとして記述すべきロジックが存在しない。
- TS-02: TC-AC1-01からTC-AC6-01はbash検証コマンドとして実装フェーズ完了後に手動実行する。find/ls/grep/wcコマンドの組み合わせで十分な検証精度が得られる。
- TS-03: TC-AC7-01は `cd workflow-harness && npx vitest run` でフルスイート実行する。impact-analysis.mdで動的パス生成により影響なしと分析済みだが、AC-7の受入基準として回帰テストを実施する。
- TS-04: vitest --relatedによる差分テスト選択は適用しない。ソースコード変更がないため、--relatedに渡すファイルリストが空になり意味をなさない。
- TS-05: テスト実行順序はTC-AC1-01からTC-AC6-01を先行し、ファイルシステム状態が正しいことを確認した上でTC-AC7-01を実行する。ファイルシステム検証が失敗した状態でvitest実行しても診断が複雑になるため。
- TS-06: TC-AC1-01からTC-AC6-01の各コマンドは相互依存がなく並列実行可能。ただし全件を逐次実行しても合計10秒以内であるため、並列化の実装コストは不要。

## selectedTests

| テストケースID | 実行方法 | 対象AC | 新規/既存 |
|---------------|---------|--------|----------|
| TC-AC1-01 | bash: find + grep | AC-1 | 既存なし(bashコマンド) |
| TC-AC2-01 | bash: ls -d | AC-2 | 既存なし(bashコマンド) |
| TC-AC3-01 | bash: ls + grep | AC-3 | 既存なし(bashコマンド) |
| TC-AC4-01 | bash: ls + wc | AC-4 | 既存なし(bashコマンド) |
| TC-AC5-01 | bash: find + wc | AC-5 | 既存なし(bashコマンド) |
| TC-AC6-01 | bash: ls + sort | AC-6 | 既存なし(bashコマンド) |
| TC-AC7-01 | npx vitest run | AC-7 | 既存(フルスイート) |

## skippedTests

なし。全7テストケースを実行対象とする。

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/test-selection.md | spec | 本ファイル: テスト選択(全7TC実行、新規テストファイルなし) |
| docs/workflows/docs-workflows-refactoring/test-design.md | input | テスト設計(TC-AC1-01からTC-AC7-01の定義) |
| docs/workflows/docs-workflows-refactoring/requirements.md | input | 要件定義(AC-1からAC-7) |

## next

- implementationフェーズに進行
- 新規テストファイルの作成ステップはスキップし、直接実装ステップ(PL-01からPL-06)に着手する
- 実装完了後にTC-AC1-01からTC-AC7-01を順次実行して検証する
