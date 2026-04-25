phase: design_review
task: harness-report-fb-fixes
status: complete
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/planning.md

## acDesignMapping

| AC | RTM | Design Ref | Status |
|---|---|---|---|
| AC-1 | F-001 | delegate-coordinator.ts L121-125 planOnlyフィルタ拡張(isReadonlyPhase論理OR) | Aligned |
| AC-2 | F-002 | dod-helpers.ts isStructuralLine() テストケースIDパターン追加 | Aligned |
| AC-3 | F-003 | manager-write.ts applyAddRTM() findIndex+splice upsert化 | Aligned |
| AC-4 | F-004 | manager-lifecycle.ts goBack() artifactHashes={}全クリア | Aligned |
| AC-5 | F-005 | 全対象ファイル テストスイート全パス(リグレッションなし) | Aligned |

## Cross-Reference Verification

### AC-RTM Coverage

AC-1~AC-4はそれぞれF-001~F-004と1:1で対応する。AC-5はFR-5(リグレッションなし)に対応し、RTMの個別エントリではなく全体の検証条件として機能する。requirements.mdのRTM表とplanning.mdのrtmEntriesの内容が一致することを確認済み。

### Threat Model Alignment

- F-001(AC-1): T-1(REGISTRY偽装), T-2(空配列), T-3(planOnly冪等性)の3脅威を分析済み。planning.mdのCD-1がbashCategories.length===1条件で空配列を安全に除外する設計はT-2に対処。
- F-002(AC-2): T-4(ReDoS), T-5(偽陽性)の2脅威を分析済み。CD-2の正規表現が左アンカー付き固定長要素のみでT-4をクリア。既存パターンの部分集合でT-5の偽陽性増加なし。
- F-003(AC-3): T-6(IDコリジョン), T-7(checkpoint整合性)の2脅威を分析済み。T-6に対しTM-004でupsertログ追加を決定。planning.mdにログ追加タスクが未記載の点を指摘(DR-005参照)。
- F-004(AC-4): T-8(署名検証), T-9(部分クリア漏れ)の2脅威を分析済み。normalizeForSigning()による空オブジェクトdelete処理でT-8は対処済み。

### Planning Coverage

planning.mdのPL-01~PL-04がF-001~F-004の実装ステップに対応。PL-05~PL-08がテストファイル作成に対応。codeDiffsのCD-1~CD-4が具体的な変更箇所を示し、requirements.mdの検証条件を満たす設計であることを確認済み。

## decisions

- DR-001: AC-1~AC-5とF-001~F-004の対応は完全。各ACに対応するFR、RTMエントリ、テストファイルが存在し、トレーサビリティチェーンが成立している。
- DR-002: T-6(RTM IDコリジョン)の緩和策としてTM-004でupsertログ追加が決定されているが、planning.mdのimplementationSteps PL-03にログ出力が含まれていない。implementationフェーズでCD-3にconsole.warnを追加すること。
- DR-003: CD-1のreadonly判定条件(bashCategories.length===1 && bashCategories[0]==='readonly')はREQ-003の安全側設計と一致。空配列時はlength===1がfalseとなりフィルタ非適用(fail-open)だが、buildPhaseGuide()のフォールバックがreadonly返却するためfail-safeが維持される。
- DR-004: CD-4のartifactHashes全クリアはREQ-006/TM-006の設計判断に合致。normalizeForSigning()による空オブジェクトdelete(L90)でHMAC署名整合性が保証される。
- DR-005: planning.mdのcodeDiffs CD-3はsplice置換のみ記載されているが、threat-model.md TM-004で決定されたupsert時のログ出力が反映されていない。これはplanning成果物の軽微な不整合であり、implementation時にCD-3にログ追加を含めること。
- DR-006: 全4件の修正が相互独立(PL-006/REQ-007)であることはcodeDiffsの変更箇所が異なるファイル/異なる関数に限定されていることから確認済み。並列実装に支障なし。

## artifacts

- docs/workflows/harness-report-fb-fixes/design-review.md (this file)
- docs/workflows/harness-report-fb-fixes/planning.md (input)
- docs/workflows/harness-report-fb-fixes/requirements.md (reference)
- docs/workflows/harness-report-fb-fixes/threat-model.md (reference)

## next

implementationフェーズでPL-01~PL-08を実装する。DR-002/DR-005で指摘したupsertログ追加をCD-3に含めること。
