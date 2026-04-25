# Test Design: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: test_design
date: 2026-03-24
inputArtifact: docs/workflows/docs-workflows-refactoring/planning.md

## summary

docs/workflows/ ディレクトリリファクタリングのテスト設計。コード変更なしのファイルシステム操作タスクのため、全テストケースはbashコマンドによる検証とする。AC-1からAC-7の各受入基準に対応するテストケースをTC形式で定義し、acTcMappingで追跡可能にする。

## testStrategy

- テスト種別: bashコマンドによるファイルシステム状態検証(L1チェック)およびvitest実行(L2チェック)
- テスト実行タイミング: 全実装ステップ(PL-01からPL-06)完了後に一括実行
- 判定基準: 全TCのExpectedが一致すればPASS。1件でも不一致があればFAILとしロールバック検討
- 前提条件: docs/workflows/ がgit check-ignoreでignore対象であること

## testCases

### TC-AC1-01: 半角カタカナ重複ディレクトリが存在しないこと (AC-1)

- 目的: 半角カタカナ版ディレクトリ24件が全て削除されていることを確認する
- コマンド: `find docs/workflows -maxdepth 3 -type d | LC_ALL=C grep -P '[\uFF66-\uFF9F]' | wc -l`
- 期待値: 0
- 失敗時の意味: 半角カタカナディレクトリが残存しており、PL-01が未完了

### TC-AC2-01: 全角カタカナディレクトリが存在すること (AC-2)

- 目的: 半角のみだった45件が全角カタカナにリネームされていることを確認する
- コマンド: research.mdのSection 1に記載の全角版45件について、各ディレクトリが存在することをlsで確認する。`ls -d "docs/workflows/*/全角名"` で存在チェック。1件でもNo such fileが出ればFAIL。
- 期待値: 全45件が存在(exit code 0)
- 失敗時の意味: リネーム漏れがあり、PL-02が未完了

### TC-AC3-01: 旧プロジェクトディレクトリが削除されていること (AC-3)

- 目的: 旧プロジェクト関連33件が全て削除されていることを確認する
- コマンド: research.mdのSection 2に記載の33件について、各ディレクトリが存在しないことを確認する。`ls -d "docs/workflows/対象名" 2>&1 | grep "No such file" | wc -l`
- 期待値: 33(全件が"No such file"を返す)
- 失敗時の意味: 削除漏れがあり、PL-03が未完了

### TC-AC4-01: カテゴリディレクトリに正しい数のサブディレクトリが存在すること (AC-4)

- 目的: 4カテゴリへの分類が正しく行われたことを確認する
- コマンド:
  - `ls docs/workflows/bugfix/ | wc -l` (期待: 約77件、許容範囲70-110)
  - `ls docs/workflows/feature/ | wc -l` (期待: 約50件、許容範囲40-60)
  - `ls docs/workflows/workflow-harness/ | wc -l` (期待: 約60件、許容範囲50-100)
  - `ls docs/workflows/investigation/ | wc -l` (期待: 約21件、許容範囲10-30)
- 期待値: 各カテゴリの件数が許容範囲内
- 失敗時の意味: カテゴリ分類が不正確、またはPL-04が未完了
- 備考: 件数はresearch.md/requirements.mdの集計に基づく概算。PL-01からPL-03の削除結果により変動するため許容範囲で判定する。

### TC-AC5-01: ルート直下にルーズ.mdファイルが存在しないこと (AC-5)

- 目的: 散在.mdファイル14件が全てディレクトリ化されていることを確認する
- コマンド: `find docs/workflows -maxdepth 1 -name "*.md" -type f | wc -l`
- 期待値: 0(README.mdが存在する場合は1を許容)
- 失敗時の意味: ルーズ.mdのディレクトリ化が未完了、PL-05が未完了

### TC-AC6-01: docs/workflows/直下にカテゴリディレクトリのみ存在すること (AC-6)

- 目的: ルート直下にタスクディレクトリが直接配置されていないことを確認する
- コマンド: `ls docs/workflows/ | sort`
- 期待値: 出力が以下の4行のみ(順不同): bugfix, feature, investigation, workflow-harness
- 失敗時の意味: カテゴリ外のディレクトリがルートに残存、PL-04またはPL-05が未完了
- 補助コマンド: `ls docs/workflows/ | wc -l` の結果が4であること

### TC-AC7-01: ハーネステストが全件パスすること (AC-7)

- 目的: ディレクトリ移動によりハーネスの既存機能が破壊されていないことを確認する
- コマンド: `cd workflow-harness && npx vitest run`
- 期待値: 全テストPASS(exit code 0)
- 失敗時の意味: ディレクトリ構造変更がハーネスのパス参照に影響した。planning.md PL-D5に従いgit revertで対処する。

## edgeCases

- EC-01: パス長260文字超過ディレクトリ。カテゴリ配下に移動後のパスが長くなりすぎる場合がある。TC-AC4-01でカテゴリ内のlsが成功すること自体が暗黙的な検証となる。
- EC-02: 半角/全角の混在ディレクトリ名(一部半角、一部全角)。TC-AC1-01の正規表現パターンで半角カタカナ文字を含むディレクトリが0件であることを検証する。
- EC-03: 空ディレクトリの存在。削除対象が既に空であっても rm -rf は正常終了するため、TC-AC3-01で存在しないことの確認のみで十分。

## acTcMapping

| AC | テストケースID | テスト内容 |
|----|---------------|-----------|
| AC-1 | TC-AC1-01 | 半角カタカナディレクトリが0件であること |
| AC-2 | TC-AC2-01 | 全角カタカナ版45件が全て存在すること |
| AC-3 | TC-AC3-01 | 旧プロジェクト33件が全て存在しないこと |
| AC-4 | TC-AC4-01 | 4カテゴリの件数が許容範囲内であること |
| AC-5 | TC-AC5-01 | ルート直下のルーズ.mdが0件であること |
| AC-6 | TC-AC6-01 | ルート直下がカテゴリディレクトリ4件のみであること |
| AC-7 | TC-AC7-01 | vitest run が全件PASSすること |

## decisions

- TD-01: 全テストをbashコマンドベースとする。コード変更なしのファイルシステム操作タスクであり、ユニットテストやE2Eテストのフレームワークは不要。
- TD-02: TC-AC4-01のカテゴリ件数は許容範囲で判定する。requirements.mdとresearch.mdで件数に差異があり(DR-07参照)、PL-01からPL-03の削除結果により変動するため、厳密な件数一致ではなく妥当な範囲での検証とする。
- TD-03: TC-AC1-01の半角カタカナ検出にUnicodeプロパティ正規表現を使用する。半角カタカナの文字範囲(U+FF66-U+FF9F)を明示的に指定し、全角カタカナとの誤判定を防止する。
- TD-04: TC-AC5-01でREADME.mdの存在は許容する。カテゴリ分類の説明を記載するREADME.mdがルートに配置される可能性があり(REC-01)、これはルーズ.mdとは異なる。
- TD-05: TC-AC7-01はハーネスの非影響確認であり、impact-analysis.mdで動的パス生成によりコード参照への影響なしと分析済み。vitest実行は念のための回帰テストとして位置付ける。
- TD-06: テスト実行順序はTC-AC1-01からTC-AC6-01を並列実行可能、TC-AC7-01は独立実行とする。ファイルシステム検証(TC-AC1-01からTC-AC6-01)とテスト実行(TC-AC7-01)は相互依存がない。

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/docs-workflows-refactoring/test-design.md | spec | 本ファイル: テスト設計(TC-AC1-01からTC-AC7-01) |
| docs/workflows/docs-workflows-refactoring/planning.md | input | 実装計画(PL-01からPL-06) |
| docs/workflows/docs-workflows-refactoring/requirements.md | input | 要件定義(AC-1からAC-7) |
| docs/workflows/docs-workflows-refactoring/research.md | reference | 操作対象一覧(重複ペア、削除対象、分類リスト) |

## next

- test_selectionフェーズに進行
- 全7テストケースがbashベースのため、テスト選択は全件実行が妥当
- TC-AC1-01からTC-AC6-01は並列実行可能、TC-AC7-01は独立実行
