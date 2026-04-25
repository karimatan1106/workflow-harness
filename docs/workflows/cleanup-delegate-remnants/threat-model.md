# Threat Model: cleanup-delegate-remnants

taskId: 7005fe0b-7a44-4496-9bd1-4bd7218944c2

## Summary

delegate-coordinator 関連の dead code / dead reference 除去に対する脅威分析。
全変更は既に到達不能なコード・参照の削除であり、新機能追加や既存ロジック変更を含まない。
STRIDE 各カテゴリおよび DREAD 評価の結果、実質的な脅威は検出されなかった。

## STRIDE Analysis

### Spoofing (なりすまし)

変更対象に認証・認可ロジックは含まれない。tool-gate.js の allowlist 縮小は攻撃面を削減する方向であり、なりすましリスクの増加はない。

### Tampering (改ざん)

JSDoc コメント修正とビルド成果物削除のみ。データフローやバリデーションロジックへの変更なし。改ざんリスクの変化はゼロ。

### Repudiation (否認)

監査ログやトレーサビリティに関わるコード変更なし。否認リスクへの影響はない。

### Information Disclosure (情報漏洩)

削除対象の dist/ ファイルに機密情報は含まれない。allowlist から不要エントリを除去することで、将来的に再利用される経路を予防的に閉じている。

### Denial of Service (サービス拒否)

hook パイプラインの allowlist サイズ縮小による性能影響は Set.has() O(1) のため無視できる。dist/ ファイル削除は実行時にロードされないため DoS リスクなし。

### Elevation of Privilege (権限昇格)

tool-gate.js の HARNESS_LIFECYCLE Set から harness_delegate_coordinator を除去することは、不要なツール名が allowlist に残存するリスクを解消する。権限昇格の攻撃面が縮小される（セキュリティ改善方向）。

## DREAD Rating

| Factor | Score | Rationale |
|--------|-------|-----------|
| Damage | 1 | dead code 除去のみ。損害ポテンシャルなし |
| Reproducibility | 1 | 脅威シナリオが再現不能（到達不能コードの削除） |
| Exploitability | 1 | 攻撃経路が存在しない |
| Affected Users | 1 | ハーネス利用者への影響なし |
| Discoverability | 1 | 露出する情報資産なし |
| Overall | 1.0 | 全カテゴリ最低スコア |

## Severity Assessment

Overall Severity: Low

根拠: 全変更が dead code 除去であり、新しいコードパス・データフロー・外部インターフェースの追加がない。tool-gate.js の allowlist 縮小はセキュリティポスチャの改善に該当する。

## decisions

- STRIDE 全6カテゴリで脅威該当なしと判定。変更が dead reference 除去に限定されるため
- DREAD 総合スコア 1.0（最低値）と判定。攻撃面の拡大要素が一切ないため
- tool-gate.js allowlist 縮小はセキュリティ改善と判定。存在しないツールの allowlist エントリは将来的な名前衝突リスクを孕むため除去が適切
- dist/ 削除は情報漏洩リスクなしと判定。ビルド成果物にシークレットやクレデンシャルが含まれていないことを確認済み
- JSDoc 修正はランタイム脅威ゼロと判定。コメント変更のみであり実行コードへの影響経路が存在しない
- 追加のセキュリティテストは不要と判定。変更がコード実行パスに影響しないため既存テストスイートで十分にカバーされる

## artifacts

- threat-model.md (本ファイル): STRIDE/DREAD 分析結果と脅威判定

## next

implementation フェーズへ進む。scope-definition.md で定義された3箇所の修正と dist/ 12ファイル削除を実施する。
