# Refactoring Analysis: harness-report-fb-fixes

phase: refactoring
task: harness-report-fb-fixes
status: complete
taskId: 1e5d5b52-88a4-4bb6-89c2-c4ce995cdf5f
sessionToken: 3863e933bc46f108bec536b95c421d1d6f0af8183457c0c7923fb862dcad6b71

input: docs/workflows/harness-report-fb-fixes/planning.md
       docs/workflows/harness-report-fb-fixes/impact-analysis.md

## 修正レビュー概要

### FB-1+5: readonlyフェーズでWrite/Edit除外 (delegate-coordinator.ts)

- **変更行数**: 3行追加（L121-125）
- **既存パターン**: planOnlyフィルタ（allowedTools.filter()で'Write'/'Edit'を除外）
- **修正内容**: isReadonlyPhase判定をplanOnlyチェックと論理OR統合。bashCategoriesが['readonly']のみの場合、Write/Editを除外する条件を追加。
- **重複チェック**: coordinatorBase定義時点でWrite/Editは既に除外されており、phaseGuide.allowedToolsも通常それに従う。修正は安全側の二重チェック。パターン重複なし。

```typescript
// 修正前（L121-125）
const allowedTools = planOnly
  ? baseAllowedTools.split(',').filter(t => !['Write', 'Edit'].includes(t)).join(',')
  : baseAllowedTools;

// 修正後
const isReadonlyPhase = phaseGuide.bashCategories.length === 1
  && phaseGuide.bashCategories[0] === 'readonly';
const allowedTools = (planOnly || isReadonlyPhase)
  ? baseAllowedTools.split(',').filter(t => !['Write', 'Edit'].includes(t)).join(',')
  : baseAllowedTools;
```

---

### FB-2: テストケースID行パターン追加 (dod-helpers.ts)

- **変更行数**: 1行追加（L26直前に挿入）
- **既存パターン**: isStructuralLine()内の複数パターン（見出し、区切り線、コードフェンス、テーブル、ラベル行等）
- **修正内容**: テストケースID形式（TC-001:, AC-1:, F-001: 等）を構造行として認識する正規表現を追加。checkDuplicateLines()で構造行はcountMapにカウントされないため、テストケースID行の重複誤検出が防止される。
- **複雑度**: 低。正規表現1行。既存パターン群と独立。

```typescript
// 挿入箇所（L26直前）
if (/^(?:[-*]\s+)?[A-Z]{1,5}-\d{1,4}[:：]/.test(trimmed)) return true;
```

**パターン仕様**: `[A-Z]{1,5}`（AC, TC, F, REQ等）+ `-`（ハイフン）+ `\d{1,4}`（1～4桁の数字）+ `[:：]`（コロン）
- TC-001:テスト内容 → マッチ
- - AC-5: 受入基準 → マッチ（`[-*]`オプションで対応）
- F-001: 要件 → マッチ
- 通常テキスト → 非マッチ

---

### FB-4: RTM ID重複時の上書き処理 (manager-write.ts)

- **変更行数**: 5行変更（L126-130）
- **既存パターン**: 無条件push（state.rtmEntries.push(entry)）
- **修正内容**: findIndex()で既存IDを検索し、存在すればsplice()で置換、存在しなければpush()。いわゆるupsert(update or insert)パターン。
- **標準性**: findIndex + spliceはTypeScript/JavaScriptの標準配列操作。多くのフレームワークで採用される一般的なパターン。

```typescript
// 修正前（L126-130）
state.rtmEntries.push(entry);

// 修正後
const existingIdx = state.rtmEntries.findIndex(e => e.id === entry.id);
if (existingIdx >= 0) {
  state.rtmEntries.splice(existingIdx, 1, entry);
} else {
  state.rtmEntries.push(entry);
}
```

**動作保証**:
- applyUpdateRTMStatus()はfilter()で同一IDエントリを取得。重複排除により、filterは0or1件を返す。既存の同時更新機構に影響なし。
- normalizeForSigning()はrtmEntriesに依存しない。HMAC署名への影響なし。

---

### FB-6: goBack時のartifactHashesクリア (manager-lifecycle.ts)

- **変更行数**: 1行追加（L126直後）
- **修正内容**: goBack()実行時にstate.artifactHashes = {}を追加。retryCount={} のクリアと同様に、全成果物ハッシュを空オブジェクトにリセット。
- **初期化処理**: シンプル。オブジェクトリテラル`{}`への代入のみ。

```typescript
// 修正後（L126直後に追加）
state.artifactHashes = {};
```

**安全性**:
- normalizeForSigning()は空オブジェクト{} をdelete処理する。HMAC署名への影響なし。
- artifact_driftチェック: goBack後の次フェーズ進行で新しいハッシュが記録されるため、古いハッシュクリアにより誤検出が防止される。
- resetTask()はcompletedPhases全クリアを行うため、goBackのみの修正で十分。

---

## 判定

### 1. FB-1 + FB-5 — 既存パターンとの整合性確認、重複チェック

**判定**: **リファクタリング不要**

**理由**:
- 修正は既存のplanOnlyフィルタと完全に同じパターン（allowedTools.filter()）を使用。パターン重複なし。
- isReadonlyPhase判定の追加は論理的な拡張。変数命名も明確で可読性が高い。
- 責務分離: delegate-coordinator.ts内のallowedTools算出責務内での完結。外部依存なし。
- 行数: 3行追加は軽微。変更理由の説明コメント追加のみで十分。

---

### 2. FB-2 — 正規表現パターンの複雑度

**判定**: **リファクタリング不要**

**理由**:
- isStructuralLine()は既に複数の正規表現パターンを管理。新パターン追加は既存の設計に合致。
- パターンは簡潔かつ明確。`[A-Z]{1,5}-\d{1,4}[::］`はテストケースID形式として十分なカバレッジ。
- パターン集約化（複合正規表現への統合）は可読性を低下させるため見送り。
- 1行の追加で新機能を実現するため、改善の余地なし。

---

### 3. FB-4 — findIndex+splice標準パターンの妥当性

**判定**: **リファクタリング不要**

**理由**:
- findIndex + spliceはTypeScript標準で、フレームワーク横断的に採用される汎用パターン。
- 代替案（Map構造への移行等）は影響範囲が大きく、他の関数との結合度が高い（refreshCheckpointTraceability, applyUpdateRTMStatus）。既存インターフェース（配列）の維持が設計上有利。
- 5行の変更は軽微。メソッド抽出や専用ヘルパー関数化は逆にコード分散につながる。
- 既存テストパターンで十分カバー可能。テスト追加のみで検証完結。

---

### 4. FB-6 — 初期化処理の簡潔性

**判定**: **リファクタリング不要**

**理由**:
- 1行の単純な代入`state.artifactHashes = {}`。これ以上の簡潔化は不可能。
- clearArtifactHashesなどのヘルパー関数化は、呼び出し1回のために過度なカプセル化。
- retryCount = {} とパタール統一的。コード理解が容易。
- goBack()全体の責務（phaseロールバック、状態クリア）内での自然な配置。

---

## 制約維持確認

### 全ファイル200行以下の維持

| ファイル | 修正前 | 修正後 | 制約 |
|---------|--------|--------|------|
| delegate-coordinator.ts | - | +3行 | ✓維持 |
| dod-helpers.ts | - | +1行 | ✓維持 |
| manager-write.ts | - | +5行 | ✓維持 |
| manager-lifecycle.ts | - | +1行 | ✓維持 |

各ファイルは200行以下の成約を満たす。既存の責務分離に変更なし。

### 各修正の独立性

| 修正 | 依存関係 | リスク |
|-----|---------|--------|
| FB-1+5 | coordinatorBase, phaseGuide.bashCategories | 低 |
| FB-2 | checkDuplicateLines(), DoD検証全体 | 低 |
| FB-4 | applyUpdateRTMStatus(), refreshCheckpointTraceability() | 中（ただし上書き意図は明確） |
| FB-6 | artifact_driftチェック、normalizeForSigning() | 中（全クリアは安全設計） |

相互依存なし。並列実装可能。

### 既存パターンとの重複確認

| 修正 | 既存パターン | 重複 |
|-----|-------------|------|
| FB-1+5 | planOnly filter chain | なし（パターン同一のため冪等） |
| FB-2 | isStructuralLine内パターン群 | なし（新パターンは独立） |
| FB-4 | 他のRTM操作 | なし（一意な期待値） |
| FB-6 | retryCount クリア | なし（並列クリア） |

---

## 最終結論

### リファクタリング: **スキップ**

### 理由

各修正は以下の基準を満たすため、リファクタリングは不要：

1. **単純性**: 最小限の変更行数（合計10行）。各修正は単一責務内での自然な拡張。

2. **既存パターンとの整合性**: FB-1+5は既存planOnlyフィルタを再利用。FB-2は既存isStructuralLineパターン群の拡張。FB-4はTypeScript標準のfindIndex+splice。FB-6はretryCountクリアと並列。

3. **複雑度**: 修正内容に新規ロジック導入なし。既存の確立されたパターンの応用のみ。保守性に悪影響なし。

4. **責務分離**: 各修正は修正ファイルの既存責務内で完結。外部への責務拡散なし。

5. **テスト可能性**: 各修正は既存のユニットテストフレームワーク内で十分検証可能。メソッド抽出や関数分割は逆に複雑度を増加させる。

### 推奨事項

- テスト追加: 各修正に対応するユニットテストを既存テストファイルに追加する（planning.mdで計画済み）。
- ドキュメント: 修正理由をコード内コメント（1行程度）で記述。CLAUDE.mdでの詳細説明は不要。
- レビュー: FB-4（upsert化）とFB-6（全クリア）はMediumリスク。テスト結果とリグレッション確認が重要。

---

## artifacts

- docs/workflows/harness-report-fb-fixes/refactoring.md (this file)
- docs/workflows/harness-report-fb-fixes/planning.md (input)
- docs/workflows/harness-report-fb-fixes/impact-analysis.md (input)

## next

design_reviewフェーズで各修正の設計整合性（AC-1~AC-4とF-001~F-004）を検証し、実装フェーズへ進行。
