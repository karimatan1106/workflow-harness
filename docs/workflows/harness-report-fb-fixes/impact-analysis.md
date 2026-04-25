# Impact Analysis: harness-report-fb-fixes

phase: impact_analysis
date: 2026-03-30
input: docs/workflows/harness-report-fb-fixes/research.md

## FB-1+5: readonlyフェーズでWrite/Edit除外

risk-level: Low

### 影響範囲

変更箇所: delegate-coordinator.ts L121-125のallowedToolsフィルタリング

影響フェーズ: hearing, scope_definition, research, impact_analysis, requirements (bashCategories=['readonly']の全フェーズ)

### 分析

1. coordinatorBase (coordinator-prompt.ts L22-26) にWrite/Editは含まれない。readonlyフェーズではphaseGuide.allowedToolsも通常Write/Editを含まない。
2. phaseGuide.allowedToolsはPHASE_REGISTRYから取得される。readonlyフェーズのallowedToolsにWrite/Editが含まれるケースが万一あった場合、現行ではフィルタされず通過する。本修正でそれを防止する。
3. planOnly=trueとの論理OR統合により、既存のplanOnly動作に影響なし。planOnlyでも同じfilter処理が適用されるため、二重フィルタになるが冪等。
4. implementation/test_impl等の書き込みフェーズではbashCategoriesに'readonly'以外も含まれるため、フィルタ対象外。正常動作に影響なし。

### 依存関係

- buildPhaseGuide() (handler-shared.ts): phaseGuide.bashCategoriesを参照。既にL113で構築済み。追加コスト: なし。
- coordinator-prompt.ts buildAllowedTools(): マージ後の文字列を返す。フィルタはdelegate-coordinator.ts側で適用するため変更不要。
- PHASE_REGISTRY (phases/registry.ts): bashCategoriesの定義元。変更不要。

### リスク評価

既存のplanOnlyフィルタパターンを再利用するため、新規ロジック導入リスクは極小。readonlyフェーズでWrite/Editが使えなくなることは意図通りの制限強化。

## FB-2: isStructuralLine()テストケースIDパターン追加

risk-level: Low

### 影響範囲

変更箇所: dod-helpers.ts isStructuralLine()にテストケースIDパターン追加

影響対象: checkDuplicateLines()のすべての呼び出し元(DoD検証全体)

### 分析

1. 新パターン `/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/` は "TC-001: テスト名" 形式にマッチ。既存パターンL26 `/^(?:[-*]\s+)?.{1,50}[:：]\s*$/` は行末`:\s*$`制約があるため、説明文付き行にはマッチしない。パターン間の競合なし。
2. isStructuralLine()がtrueを返す行はcheckDuplicateLines()のcountMapに追加されない。テストケースID行が重複チェックから除外される効果。
3. false negative分析: パターンが緩すぎると本来重複検出すべき行を見逃す可能性。"ABC-1:" で始まる非テストケース行があり得るが、成果物フォーマット上そのようなパターンの出現は極めて稀。
4. false positive分析: パターンが厳しすぎるとテストケースID行を構造行として認識できない。[A-Z]{1,5}は一般的なプレフィックス(TC, AC, F, REQ, BUG等)を網羅。十分。

### 依存関係

- checkDuplicateLines() (同ファイルL100-113): isStructuralLine()を呼び出し。変更不要。
- checkForbiddenPatterns() (同ファイルL61-73): isStructuralLine()を使用しない。影響なし。
- DoD検証フロー全体: checkDuplicateLines()結果を使用。false negativeが減少する方向のため品質向上。

### リスク評価

追加パターンは既存パターンと独立。既存の構造行判定に影響なし。テストケースID行の重複誤検出を防ぐ目的に合致。

## FB-4: applyAddRTM upsert化

risk-level: Medium

### 影響範囲

変更箇所: manager-write.ts applyAddRTM() L126-130

影響対象: harness_add_rtm MCPツールの全呼び出し元

### 分析

1. 現行: 無条件push。同一IDで複数回呼ぶと配列に重複エントリが蓄積。
2. 修正後: findIndex + splice方式。同一ID存在時は上書き、非存在時はpush。
3. applyUpdateRTMStatus() (L148-157): filter()で同一IDの全エントリを取得。重複がなくなるとfilterは0or1件を返す。動作は正常だが、複数エントリを同時更新する"意図的な"重複利用がないか確認が必要。
4. refreshCheckpointTraceability() (L109-117): state.rtmEntriesをスプレッドでcheckpoint.rtmEntriesにコピー。重複排除により正確なRTMが保持される。改善方向。
5. normalizeForSigning() (L83-91): rtmEntriesには関与しない。HMAC署名への影響なし。

### 依存関係

- harness_add_rtm MCPツール: applyAddRTMの直接呼び出し元。upsert動作は呼び出し元にとって透過的(戻り値void)。
- state-toon-io.ts: rtmEntries配列のシリアライズ。要素数が減る方向のため問題なし。
- checkpoint: refreshCheckpointTraceabilityで同期。影響なし。

### リスク評価

Medium: upsert化は意図通りだが、同一IDで異なるrequirement/designRef/codeRef/testRefを持つエントリが意図的に作られるケースがあれば、上書きにより情報が失われる。researchで確認した限りそのようなユースケースは存在しないが、注意点として記録。

## FB-6: goBack時artifactHashesクリア

risk-level: Medium

### 影響範囲

変更箇所: manager-lifecycle.ts goBack() L126付近

影響対象: harness_back MCPツール、artifact_driftチェック

### 分析

1. 現行: goBack()でretryCount={}をクリアするが、artifactHashesはクリアしない。goBack後に古いフェーズの成果物ハッシュが残り、artifact_driftチェックで不整合が発生する可能性。
2. 修正: state.artifactHashes = {} をretryCountクリアの次行に追加。
3. クリア範囲の妥当性: artifactHashesは全フェーズの成果物ハッシュを保持するRecord。goBackは特定フェーズへの巻き戻しのため、targetPhase以降のハッシュのみクリアすべきとも考えられる。ただし、ハッシュはフェーズ進行時に再計算されるため、全クリアでも実害なし。再計算コストも軽微。
4. resetTask() (L135-156): artifactHashesを明示的にクリアしていないが、全フェーズクリアのためcompletedPhases=[]となり成果物不整合は発生しない。resetTaskへの修正は不要(scope-definitionの判断を維持)。
5. normalizeForSigning() (L90): 空オブジェクトの場合deleteする。artifactHashes={}は署名前に削除されるためHMAC署名に影響なし。
6. updateCheckpoint() (L100-107): artifactHashesはcheckpointに含まれない。checkpoint整合性に影響なし。

### 依存関係

- normalizeForSigning(): artifactHashes={}を適切にdelete。整合性維持。
- signAndPersist(): normalizeForSigning経由で処理。影響なし。
- artifact_driftチェック(DoD): goBack後のフェーズ進行で新しいハッシュが記録される。古いハッシュがクリアされることでdrift誤検出を防止。

### リスク評価

Medium: 全クリアは安全側の設計だが、goBackで戻らなかったフェーズ(targetPhaseより前)のハッシュも失われる。ただしこれらはフェーズ再実行時に再計算されるため実害なし。部分クリア(targetPhase以降のみ)はハッシュキーにフェーズ名が含まれる保証がないため、全クリアが安全。

## 影響フェーズ一覧

| FB | 影響フェーズ | 影響範囲 |
|---|---|---|
| FB-1+5 | hearing, scope_definition, research, impact_analysis, requirements | coordinator起動時のallowedTools |
| FB-2 | 全フェーズ(DoD検証実行時) | checkDuplicateLines結果 |
| FB-4 | requirements, planning, implementation(RTM登録時) | rtmEntries配列の構造 |
| FB-6 | 全フェーズ(goBack実行時) | artifactHashesの状態 |

## decisions

- IA-001: FB-1+5はLowリスク。既存のplanOnlyパターンの拡張であり、新規ロジック導入なし。readonlyフェーズでのWrite/Edit制限は意図通りの強化。
- IA-002: FB-2はLowリスク。パターン追加は既存パターンと独立。false negative増加リスクは軽微(テストケースID形式の非テスト行は極めて稀)。
- IA-003: FB-4はMediumリスク。upsert化により同一IDエントリの上書きが発生するが、意図的な重複利用ユースケースは確認されていない。リグレッションテストで検証必要。
- IA-004: FB-6はMediumリスク。全クリアは安全側だが、部分クリアの方がデータ保全性が高い。ただしハッシュキー形式の保証がないため全クリアを採用。
- IA-005: 4件の修正は相互に独立。並列実装可能。依存関係による実装順序制約なし。
- IA-006: テスト戦略: 各修正にユニットテスト追加。FB-4のupsert動作は特にエッジケース(同一ID上書き、異なるID追加)のテストが重要。
- IA-007: normalizeForSigning()のartifactHashes={}削除動作はFB-6の全クリアと整合。HMAC署名への影響なし。

## artifacts

- docs/workflows/harness-report-fb-fixes/impact-analysis.md (this file)
- docs/workflows/harness-report-fb-fixes/research.md (input)

## next

planningフェーズで4件の修正の実装順序、具体的なコード差分、テストファイル構成を設計する。
