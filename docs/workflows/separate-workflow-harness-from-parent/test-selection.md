# Test Selection: separate-workflow-harness-from-parent

## 選定方針

test_design フェーズで定義した 10 件のテストケース全件を実行対象とする。除外なし。

## 選定理由

- 全 TC が 1 秒以内で完了する軽量 bash 検証
- 外部依存なし (ローカルファイル・git 状態のみ参照)
- コスト低・実行時間短・並列化不要
- TDD サイクルで Red/Green 2 回実行しても総実行時間は数秒以内
- カバレッジ確保のため全 AC に対応する TC を漏れなく実行する

## 実行対象テストケース (10 件)

| # | TC ID | 対象 AC | 概要 |
|---|-------|---------|------|
| 1 | TC-AC1-01 | AC-1 | 親リポジトリから workflow-harness ファイル群が除外されている |
| 2 | TC-AC2-01 | AC-2 | submodule 参照が正しく解決される |
| 3 | TC-AC3-01 | AC-3 | 親 settings.json に hook mirror が存在する |
| 4 | TC-AC3-02 | AC-3 | hook mirror のパスがサブモジュール実体を指す |
| 5 | TC-AC4-01 | AC-4 | .gitignore に workflow-harness 関連除外が含まれる |
| 6 | TC-AC5-01 | AC-5 | setup.sh がサブモジュール初期化コマンドを含む |
| 7 | TC-AC5-02 | AC-5 | setup.sh が実行可能属性を持つ |
| 8 | TC-AC6-01 | AC-6 | README に submodule 運用手順が記載されている |
| 9 | TC-AC7-01 | AC-7 | 親リポジトリ CLAUDE.md がサブモジュール CLAUDE.md を参照する |
| 10 | TC-AC7-02 | AC-7 | サブモジュール側 CLAUDE.md が独立して読み込み可能 |

## 実行順

TC-AC1-01 → TC-AC2-01 → TC-AC3-01 → TC-AC3-02 → TC-AC4-01 → TC-AC5-01 → TC-AC5-02 → TC-AC6-01 → TC-AC7-01 → TC-AC7-02

依存関係は存在しないため辞書順 (AC 番号順) で直列実行する。

## テストスクリプト

配置先: `docs/workflows/separate-workflow-harness-from-parent/test-separate.sh`

testing フェーズで 1 ファイルにまとめて作成する。bash スクリプト内で各 TC を関数化し、失敗時は TC 識別子を stderr に出力して exit 1 を返す。

## decisions

- D-TS-1: 全 10 TC を選択 (除外なし)。全ての AC に対し最低 1 TC を割り当てる方針を崩さない
- D-TS-2: TC は単一 bash スクリプト `test-separate.sh` で実行する。ランナー分散によるオーバーヘッドを避ける
- D-TS-3: 実行順は AC 番号順の直列。TC 間の依存関係がなく、順序による結果変動なし
- D-TS-4: 並列化は不要。総実行時間が数秒以内であり、並列化の複雑性が利益を上回る
- D-TS-5: テスト失敗時は個別 TC 識別子 (例 `TC-AC3-02`) で報告し、どの AC の検証が失敗したか即座に特定可能にする
- D-TS-6: TDD サイクル採用。実装前に Red 実行 (全 FAIL 期待) → 実装後に Green 実行 (全 PASS 期待) の 2 回実行する
- D-TS-7: exit code 規約: 0 = 全 PASS、1 = 1 件以上 FAIL。CI/ハーネスゲートでの判定を単純化する

## artifacts

- `docs/workflows/separate-workflow-harness-from-parent/test-selection.md` (本ファイル)
- `docs/workflows/separate-workflow-harness-from-parent/test-separate.sh` (testing フェーズで作成)

## next

testing フェーズにて `test-separate.sh` を作成し、Red 実行で全 TC が FAIL することを確認する。その後 implementation フェーズで修正を加え、Green 実行で全 TC が PASS することを検証する。
