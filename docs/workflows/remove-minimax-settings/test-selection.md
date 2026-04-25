# Test Selection: remove-minimax-settings

本フェーズでは test-design.md で定義した 5 件のテストケース (TC-AC1-01..TC-AC5-01) の実行可否を判定し、今回のワークフローで実行対象とするテストを確定する。本変更は workflow-harness/.claude/settings.json から MiniMax 関連 env エントリを削除する設定ファイル変更であり、TypeScript/JS のコード変更を含まない。したがって既存 vitest ユニットテストの再実行・lint・typecheck は除外し、AC 検証に直結する JSON 構造チェックのみを対象とする。

## selectedTests

- TC-AC1-01 (AC-1 MiniMax env 削除検証): status=run。settings.json の env セクションに MINIMAX で始まるキーが存在しないことを確認する。
- TC-AC2-01 (AC-2 非 MiniMax env 保持): status=run。MiniMax 以外の env エントリが削除前と同一であることを確認する。
- TC-AC3-01 (AC-3 hooks 保持): status=run。hooks 配下の全エントリが変更前と同一順序で存在することを確認する。
- TC-AC4-01 (AC-4 permissions 保持): status=run。permissions.allow の内容が変更前と同一であることを確認する。
- TC-AC5-01 (AC-5 JSON 形式妥当性): status=run。settings.json が JSON.parse 可能であり、最上位キー構造が既存と一致することを確認する統合検証。

## excludedTests

- 既存 vitest スイート全体: コード変更なしのため実行不要。設定ファイルの削除のみで import graph に影響しない。
- lint (eslint) / typecheck (tsc): TS/JS 変更なしのため対象外。
- E2E ハーネス実行テスト: MiniMax バックエンドは既に未使用であり、env 削除による挙動変化がないため除外。
- パフォーマンス / セキュリティ追加スキャン: threat-model.md で新規脅威なしと判定済みのため再実行不要。

## executionOrder

- TC-AC1-01..TC-AC4-01 は互いに独立で並列実行可能。
- TC-AC5-01 は AC-1..4 の検証内容を包含する統合チェックであり、AC-1..4 完了後に最終検証として実行する順序が推奨される。
- Red 証拠として削除前の settings.json に対して TC-AC1-01 を実行し失敗することを記録し、Green 証拠として削除後に全 TC が成功することを記録する。

## decisions

- D-TS-1: test-design.md で定義した全 5 件の TC (TC-AC1-01..TC-AC5-01) を status=run として選定する。AC-1..5 の受入検証に不可欠であり除外理由がないため。
- D-TS-2: 既存 vitest スイート・lint・typecheck はコード無変更のため実行対象から除外する。実行コストに見合う検出価値がない。
- D-TS-3: TC-AC1-01..TC-AC4-01 の 4 件は相互依存がなく並列実行可能と判定する。共有状態は参照のみの settings.json 読み取りに限定される。
- D-TS-4: TC-AC5-01 は JSON 構造全体の統合検証であり、AC-1..4 の個別チェック完了後に最終ゲートとして実行する。
- D-TS-5: Red/Green 証拠記録は削除前 (Red: TC-AC1-01 fail 期待) と削除後 (Green: 全 TC pass 期待) の 2 回実行方式で harness_record_test_result に渡す。

## artifacts

- test-selection.md (本ファイル): 実行対象テスト一覧、除外判断、実行順序、選定根拠を記録する成果物。

## next

- next: test_implementation
- input: test-design.md, test-selection.md
- 備考: TC-AC1-01..TC-AC5-01 はスクリプト実装不要の構造チェックであり、test_implementation では jq / node による 1 行検証コマンドを harness_record_proof で記録する軽量実装とする。
