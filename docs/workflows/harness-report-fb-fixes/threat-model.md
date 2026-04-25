# Threat Model: harness-report-fb-fixes

phase: threat_modeling
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/requirements.md
scope: FB-1+5, FB-2, FB-4, FB-6の4件修正に対するSTRIDE脅威分析

## Threat Analysis

### T-1: phaseGuide偽装によるreadonly制限バイパス (FB-1+5: F-001)

STRIDE: Tampering / Elevation of Privilege (T-1)
Severity: High (T-1)

攻撃シナリオ: delegate-coordinator.tsのL120-125で、readonlyフィルタはphaseGuide.bashCategoriesの値に依存する。buildPhaseGuide()はPHASE_REGISTRYから値を取得するため、PHASE_REGISTRYが改ざんされた場合、readonlyフェーズでもWrite/Editが許可される。

現状の緩和: PHASE_REGISTRYはTypeScriptのconstオブジェクトであり、ランタイムでの変更はimport元モジュールの直接操作が必要。MCPサーバーはサーバーサイドで実行されるため、クライアントからのphaseGuide注入経路はない。

残存リスク: PHASE_REGISTRYのインメモリ改ざんはNode.jsモジュールシステム上で理論的に可能（Object.freeze未適用）。ただし攻撃者がサーバープロセスにコード注入可能な状態は、readonly制限以前の問題。

Mitigation: PHASE_REGISTRYをObject.freeze()で凍結することで多層防御を強化可能。現時点では実装コストに対しリスクが低いため、次スプリントで検討。

### T-2: bashCategories配列の空配列・undefined時の挙動 (FB-1+5: F-001)

STRIDE: Elevation of Privilege (T-2)
Severity: Medium (T-2)

攻撃シナリオ: bashCategoriesが空配列[]またはundefinedの場合、readonlyフィルタが適用されずWrite/Editが許可される。requirements.md REQ-003で「空配列やプロパティ不在はフィルタ対象外（安全側）」と定義しているが、未知のフェーズがbuildPhaseGuideのフォールバック（L114: bashCategories: ['readonly']）を通るため、未知フェーズではreadonlyがデフォルト適用される。

現状の緩和: buildPhaseGuide()のフォールバックがbashCategories: ['readonly']を返すため、PHASE_REGISTRYに存在しないフェーズではreadonlyが適用される。既知フェーズは全てbashCategoriesが明示定義済み。

残存リスク: 新フェーズ追加時にbashCategoriesの定義漏れがあると、フォールバックでreadonlyになる（fail-safe）。意図せずreadonlyになるリスクはあるが、権限昇格方向ではないため許容。

Mitigation: TypeScript型定義でbashCategoriesを必須フィールドにすることでコンパイル時に検出可能（既に実装済み: PhaseConfig型）。

### T-3: planOnly条件との論理OR冪等性 (FB-1+5: F-001)

STRIDE: Tampering (T-3)
Severity: Low (T-3)

攻撃シナリオ: delegate-coordinator.ts L121-125で、現状planOnlyのみでWrite/Editフィルタを実行。readonlyフェーズ判定を追加する際、planOnly=trueかつreadonlyフェーズの場合にフィルタが二重適用される。

現状の緩和: Array.filter + includes による除外は冪等。既に除外済みのツールを再度除外しても結果は同一。

残存リスク: なし。冪等操作のため副作用なし。

Mitigation: 不要（冪等性が保証済み）。

### T-4: ReDoS（正規表現DoS）リスク (FB-2: F-002)

STRIDE: Denial of Service (T-4)
Severity: Medium (T-4)

攻撃シナリオ: isStructuralLine()に追加する正規表現 `/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/` に対し、悪意ある入力で指数的バックトラッキングが発生する可能性。

分析: このパターンは左アンカー(^)付きで、ネストした量指定子がない。`(?:[-*]\s+)?` は0-1回の非貪欲マッチ、`[A-Z]{1,5}` は最大5文字、`\d{1,4}` は最大4文字。バックトラッキングの深さは定数上界を持つため、ReDoSは発生しない。

現状の緩和: 正規表現が固定長要素のみで構成されており、入力長に対する指数的計算量を持たない。

残存リスク: なし。計算量はO(n)（nは行の文字数）。

Mitigation: 不要（ReDoSパターンに該当しない）。

### T-5: 偽陽性による構造行誤認 (FB-2: F-002)

STRIDE: Information Disclosure / Tampering (T-5)
Severity: Medium (T-5)

攻撃シナリオ: 通常のテキスト行が `[A-Z]{1,5}-\d{1,4}[:：]` にマッチし、構造行と誤認される。例: "HTTP-200: レスポンス正常" や "UTF-8: エンコーディング" が構造行と判定され、checkDuplicateLines()の重複検出から除外される。

現状の緩和: 既存のisStructuralLine()にも同様の偽陽性リスクがある（例: `^(?:[-*]\s+)?.{1,50}[:：]\s*$` は短いラベル行を広く構造行と判定する）。新パターンの偽陽性範囲は既存パターン `^(?:[-*]\s+)?.{1,50}[:：]\s*$` のサブセットであるため、実質的な偽陽性増加はない。

残存リスク: 新パターンは既存の広いパターンに包含されるため、新たな偽陽性は発生しない。ただし、既存パターン自体の偽陽性は残存。

Mitigation: 新パターンは既存パターンの部分集合のため追加対策不要。既存パターンの偽陽性改善は本タスクスコープ外。

### T-6: RTM IDコリジョンによる意図しない上書き (FB-4: F-003)

STRIDE: Tampering / Repudiation (T-6)
Severity: High (T-6)

攻撃シナリオ: applyAddRTM()をupsert動作に変更すると、同一IDのRTMエントリが既存エントリを無警告で上書きする。意図しないIDの重複（例: 別タスクからコピーしたF-001）により、正しいRTMエントリが消失する。

現状の緩和: RTM IDはharness_add_rtmハンドラ経由で登録され、手動入力ではない。IDはタスク内で一意に管理される。上書き時のupdatedAtタイムスタンプ更新により、変更履歴が追跡可能。

残存リスク: 同一タスク内で同一IDを再登録した場合、前の値が警告なく失われる。proofLogには記録されないため、変更の監査証跡が不完全。

Mitigation: upsert実行時にログ出力（console.warnまたはtrace記録）を追加し、上書き発生を可視化する。これはimplementationフェーズで実装する。

### T-7: upsert後のcheckpoint整合性 (FB-4: F-003)

STRIDE: Tampering (T-7)
Severity: Medium (T-7)

攻撃シナリオ: applyAddRTM()内でrefreshCheckpointTraceability()が呼ばれるが、upsertで配列内のオブジェクト参照が変わる（splice置換）。checkpoint.rtmEntriesはスプレッド演算子で浅いコピーされるため、参照先のオブジェクトはstate.rtmEntriesと共有される。

現状の緩和: refreshCheckpointTraceability()は`[...state.rtmEntries]`で浅いコピーを作成。RTMEntryオブジェクト自体は変更されない（spliceで新オブジェクトに置換されるため）。checkpointのsha256はcomputeCheckpointHashで再計算されるため整合性は維持される。

残存リスク: RTMEntryオブジェクトの参照共有自体は問題ないが、後続のmutationで両方が変更されるリスクはある。ただし現行コードではRTMEntryの直接mutation箇所はapplyUpdateRTMStatus()のみで、こちらもrefreshCheckpointTraceability()を呼ぶため整合性は保たれる。

Mitigation: 不要（現行設計で整合性が保証されている）。

### T-8: artifactHashesクリア後の署名検証影響 (FB-6: F-004)

STRIDE: Tampering (T-8)
Severity: High (T-8)

攻撃シナリオ: goBack()でstate.artifactHashes = {}を追加した後、signAndPersist()が呼ばれる。normalizeForSigning()はemptyObj()チェックで空オブジェクトをdeleteするため、artifactHashes={}はHMAC署名計算から除外される。一方、goBack先のフェーズで成果物が再生成されると新しいハッシュが追加され、署名に含まれる。

現状の緩和: normalizeForSigning()（manager-write.ts L83-91）が空オブジェクトを明示的にdeleteする。signAndPersist()はnormalize後に署名するため、artifactHashes={}とプロパティ不在の状態が同一の署名を生成する。これは正しい動作。

残存リスク: normalizeForSigning()がartifactHashesのemptyObj判定を行わない場合、空オブジェクトが署名に含まれ、serialize-parse往復でキーが消失した後に署名不一致が発生する。しかし現行コードL90で明示的にartifactHashesのemptyObjチェックが実装済み。

Mitigation: 不要（normalizeForSigning()で既に対処済み）。

### T-9: artifactHashesの部分クリア漏れ (FB-6: F-004)

STRIDE: Information Disclosure (T-9)
Severity: Low (T-9)

攻撃シナリオ: goBack()で全クリア(artifactHashes={})を採用する設計判断（REQ-006）。goBack先フェーズ以前の成果物ハッシュも消失するため、前フェーズの成果物改ざん検出能力が一時的に低下する。

現状の緩和: goBack操作自体がフェーズを巻き戻す操作であり、以降のフェーズで成果物が再生成・再署名される。advancePhase()時にDoDゲートが成果物の完全性を再検証するため、改ざんはフェーズ遷移時に検出される。

残存リスク: goBack後、nextフェーズに進むまでの間に前フェーズの成果物が改ざんされた場合、ハッシュによる即時検出ができない。ただしDoDゲートが遷移時に検出するため、実害は限定的。

Mitigation: 全クリアは安全側の設計選択であり許容。部分クリアはハッシュキー形式の保証がないため実装困難（REQ-006で決定済み）。

## Risk Summary

| ID | STRIDE | Severity | FB | Mitigation Status |
|---|---|---|---|---|
| T-1 | Tampering, EoP | High | FB-1+5 | 許容（多層防御はObject.freezeで強化可能） |
| T-2 | EoP | Medium | FB-1+5 | 対処済み（フォールバックがfail-safe） |
| T-3 | Tampering | Low | FB-1+5 | 不要（冪等性保証） |
| T-4 | DoS | Medium | FB-2 | 不要（ReDoS該当なし） |
| T-5 | Info Disclosure, Tampering | Medium | FB-2 | 不要（既存パターンの部分集合） |
| T-6 | Tampering, Repudiation | High | FB-4 | 実装時にupsertログ追加 |
| T-7 | Tampering | Medium | FB-4 | 不要（整合性保証済み） |
| T-8 | Tampering | High | FB-6 | 不要（normalizeForSigning対処済み） |
| T-9 | Info Disclosure | Low | FB-6 | 許容（全クリアはfail-safe設計） |

## decisions

- TM-001: T-1のPHASE_REGISTRY凍結（Object.freeze）は本タスクスコープ外。効果は限定的（攻撃にはサーバープロセスへのコード注入が前提）であり、次スプリントで多層防御として検討。
- TM-002: T-4のReDoSリスクは、追加パターンが左アンカー付き・固定長要素のみで構成されるため該当しないと判定。
- TM-003: T-5の偽陽性は、新パターンが既存の広いパターン（.{1,50}[:：]）の部分集合であるため、実質的な偽陽性増加なしと判定。
- TM-004: T-6のupsert上書き時にログ出力を追加する。implementationフェーズでconsole.warnまたはappendTraceによる記録を実装。
- TM-005: T-8のartifactHashes={}はnormalizeForSigning()によりHMAC署名から正しく除外されるため、署名検証への影響なしと判定。
- TM-006: T-9の全クリア方式はREQ-006の設計判断を支持。部分クリアはハッシュキー形式の保証がなく実装困難であり、全クリアがfail-safe。

## artifacts

- docs/workflows/harness-report-fb-fixes/threat-model.md (this file)
- docs/workflows/harness-report-fb-fixes/requirements.md (input)

## next

planningフェーズで脅威分析結果を踏まえた実装計画を作成する。T-6のupsertログ追加をplanning.mdのタスクに含める。
