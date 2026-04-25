# Code Review: harness-report-fb-fixes

phase: code_review
date: 2026-03-30
reviewer: coordinator
input: docs/workflows/harness-report-fb-fixes/requirements.md
scope: FB-1+5, FB-2, FB-4, FB-6の4件修正に対するコードレビュー

## acAchievementStatus

| AC | Description | Status | Evidence |
|---|---|---|---|
| AC-1 | readonlyフェーズWrite/Edit禁止 | met | coordinator-prompt.ts L29-34: bashCategories length===1 && [0]==='readonly'判定でmerged.delete実行 |
| AC-2 | isStructuralLine()テストケースID判定 | met | dod-helpers.ts L19: 正規表現 /^(?:[-*]\s+)?[A-Z]{1,5}-[A-Z0-9]{1,5}(?:-\d{1,4})?[:：]/ を先頭パターンとして追加 |
| AC-3 | applyAddRTM() upsert動作 | met | manager-write.ts L127-132: findIndex+splice(idx,1,entry)で既存ID置換、else pushで新規追加 |
| AC-4 | goBack() artifactHashesクリア | met | manager-lifecycle.ts L127: state.artifactHashes={} をretryCount={}の直後に配置 |
| AC-5 | 既存テスト全パス | met | 829テストパス、FB関連35件全Green |

## decisions

- CR-001: coordinator-prompt.ts (96行) 200行制限を十分に下回る。buildAllowedTools()の責務が明確で、readonly判定ロジックが既存のSet操作パターンと一貫している。
- CR-002: dod-helpers.ts L19の正規表現はisStructuralLine()の最初のチェックとして配置されている。テストケースID行は最も頻繁に誤検出される行種であり、先頭配置は早期リターンの観点で適切。
- CR-003: manager-write.ts applyAddRTM()のfindIndex+splice方式はO(n)だが、rtmEntries配列は通常10件以下であり性能上の懸念なし。Map構造への変更は既存コード影響が大きく、現行方式が妥当。
- CR-004: manager-lifecycle.ts goBack()のartifactHashes={}はretryCount={}と同じブロック(L126-127)に配置され、クリア操作の凝集度が高い。normalizeForSigning() L90でemptyObj判定→deleteされるため、HMAC署名への影響なし。
- CR-005: dod-helpers.ts L19の正規表現パターン [A-Z]{1,5}-[A-Z0-9]{1,5}(?:-\d{1,4})? は要件のパターンより広い(英数字を含むサフィックス部)。TC-AC1-01のようなハイフン付きサブIDにも対応しており、要件を適切にカバー。
- CR-006: 全4ファイルが200行制限内(96行, 154行, 163行, 158行)。責務分離が維持されている。
- CR-007: セキュリティ観点で問題なし。coordinator-prompt.tsのreadonly判定は防御的(bashCategoriesがundefinedやnullの場合はオプショナルチェーンで安全にfalse評価)。manager-write.tsのupsert操作は外部入力のサニタイズ済みRTMEntry型を受け取る。

## reviewFindings

### coordinator-prompt.ts (96行)
- readonly判定(L29-30): bashCategories?.length === 1 && bashCategories[0] === 'readonly' は配列完全一致チェック。bashCategoriesに'readonly'と他カテゴリが混在する場合はフィルタ対象外となり、安全側に倒れる設計。
- merged.delete(L32-33): Setから削除するため、coordinatorBaseにWrite/Editが含まれない現状では実質的にphaseToolsからの除外として機能。将来coordinatorBaseにWrite/Editが追加された場合にも正しく動作する防御的実装。
- コーディングスタイル: 既存のconst/if構文パターンと一貫。

### dod-helpers.ts (154行)
- 正規表現(L19): (?:[-*]\s+)? でリスト項目プレフィックスをオプショナルにカバー。[A-Z]{1,5}-[A-Z0-9]{1,5}(?:-\d{1,4})? でTC-001, AC-1, TC-AC1-01, FEAT-123等を網羅。
- 既存パターンとの重複なし: L20以降の既存パターン(見出し, 水平線, コードフェンス等)はテストケースIDをカバーしないため、追加パターンは必要十分。
- エッジケース: 小文字ID(tc-001:)は対象外だが、ハーネスの命名規約は大文字IDのため問題なし。

### manager-write.ts (163行)
- upsert実装(L127-132): findIndex+spliceパターンはJavaScript標準的なイディオム。splice(idx, 1, entry)で要素置換し配列長を維持。
- refreshCheckpointTraceability(L134): upsert後もpush後も同じ呼び出しパスを通り、チェックポイント整合性を保証。
- applyUpdateRTMStatus(L153-162): filter()で同一IDの全エントリを取得するが、upsert化により同一IDは常に1件。filterの動作に影響なし。

### manager-lifecycle.ts (158行)
- artifactHashes={} (L127): retryCount={}(L126)の直後に配置。goBack()のクリア操作が一箇所に集約されており保守性が高い。
- resetTask()(L136-157): artifactHashesクリアなし。completedPhases=[]で全フェーズ履歴をクリアするため、成果物ハッシュ不整合は発生しない(requirements.mdのnotInScopeに記載通り)。

## artifacts

- docs/workflows/harness-report-fb-fixes/code-review.md (this file)

## next

testing_strategyフェーズでテストケース設計とリグレッション確認を実施する。
