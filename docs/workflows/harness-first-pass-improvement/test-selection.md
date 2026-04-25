# Test Selection: harness-first-pass-improvement

taskId: ce320677-d107-4cc9-ad90-978291c61666
phase: test_selection

## Selection Criteria

全13テストケースを分析し、検証手段と実行順序を決定する。
本タスクはテキスト追加のみの変更であり、grep/wcコマンドベースの手動検証が主軸。
TC-AC5-01のみvitest実行による自動テスト。

## Test Classification

### 手動検証（grep/wcベース）: 12件

| TC ID | 検証手段 | 実行順序 | 理由 |
|-------|---------|---------|------|
| TC-AC1-01 | grep | 1 | Phase Output Rules見出し存在の基本確認 |
| TC-AC1-02 | grep | 2 | decisions定量ルールの文字列マッチ |
| TC-AC1-03 | grep | 3 | artifacts列挙ルールの文字列マッチ |
| TC-AC1-04 | grep | 4 | next空欄禁止ルールの文字列マッチ |
| TC-AC2-01 | grep | 5 | Edit Completeness見出し存在確認 |
| TC-AC2-02 | grep | 6 | 部分適用禁止ルールの文字列マッチ |
| TC-AC2-03 | grep | 7 | 全件適用原則の文字列マッチ |
| TC-AC3-01 | grep | 8 | baseline手順の存在確認 |
| TC-AC3-02 | grep | 9 | RTM更新手順の存在確認 |
| TC-AC4-01 | wc -l | 10 | coordinator.md行数の閾値検証 |
| TC-AC4-02 | wc -l | 11 | worker.md行数の閾値検証 |
| TC-AC4-03 | wc -l | 12 | defs-stage4.ts行数の閾値検証 |

### 自動テスト（vitest）: 1件

| TC ID | 検証手段 | 実行順序 | 理由 |
|-------|---------|---------|------|
| TC-AC5-01 | vitest run | 13 | 既存テストスイート全パス。実行時間が長いため最後 |

## Execution Strategy

- グループA（順序1-9）: grepベース。対象ファイルの内容存在を確認する。即時実行可能で依存関係なし
- グループB（順序10-12）: wc -lベース。ファイル行数が200以下であることを確認する
- グループC（順序13）: vitest run。既存テスト全件パスを確認する。最も実行時間が長いため最後に配置

グループA/Bは並列実行可能。グループCはA/B完了後に実行する。

## decisions

- TS-001: 全12件のgrep/wc検証は手動実行とする。新規テストファイル作成は不要
- TS-002: TC-AC5-01のみvitestによる自動テスト実行とする
- TS-003: grep検証（グループA）を先行し、行数検証（グループB）、vitest（グループC）の順で実行する
- TS-004: グループA/Bは独立しており並列実行可能。グループCは最後に単独実行する
- TS-005: 新規vitestテストファイルは作成しない。既存スイートの回帰確認のみ実施する
- TS-006: 全TCが失敗した場合の切り分けは、対象ファイル単位（coordinator.md / worker.md / defs-stage4.ts）で実施する

## artifacts

- docs/workflows/harness-first-pass-improvement/test-selection.md: spec: 13TC分類完了、実行順序決定、3グループ構成

## next

- implementationフェーズで3ファイル（coordinator.md, worker.md, defs-stage4.ts）を変更する
- test_executionフェーズでグループA→B→Cの順にテストを実行する
