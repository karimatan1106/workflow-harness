# 要件定義: ワークフロープラグイン大規模対応根本改修

## 背景

workflow-pluginの評価で以下の問題が判明:

1. **FAIL_OPEN=trueで全ガードが崩壊する** - 12箇所の例外ハンドラでFAIL_OPENが参照され、エラー時にフックが無効化される
2. **状態ファイルに暗号署名がなく改竄可能** - workflow-state.jsonがプレーンJSONで署名なし、手動編集でフェーズスキップが可能
3. **スコープサイズ制限がなく1000万ファイルでも通過する** - ファイル数・ディレクトリ数に上限がなく、巨大プロジェクトでメモリ不足の危険
4. **Bashコマンド解析がパターンベースで回避容易** - `pwd && rm -rf /`のような連結コマンドが検出されない
5. **成果物チェックが「存在」のみで品質未検証** - 50バイト未満は警告のみ、内容の妥当性検証なし
6. **設計検証がオプショナルで無効化可能** - SKIP_DESIGN_VALIDATION=trueで検証スキップ

これらはエンタープライズ環境での採用を妨げる致命的欠陥である。

## 機能要件

### REQ-1: FAIL_OPEN環境変数の除去

**目的**: エラー時のfail-closed原則を強制

**対象ファイル**:
- `hooks/enforce-workflow.js` (5箇所)
- `hooks/phase-edit-guard.js` (4箇所)
- `hooks/block-dangerous-commands.js` (3箇所)

**要求**:
- 全フックから`process.env.FAIL_OPEN`参照を完全除去
- エラー時は必ず`process.exit(2)`でブロック（fail-closed）
- FAIL_OPEN環境変数が設定されていても無視

**受入条件**:
- AC-1-1: `FAIL_OPEN=true git add .`を実行してもフックがブロックすること
- AC-1-2: エラー発生時に`process.exit(2)`が呼ばれること
- AC-1-3: 12箇所全てのFAIL_OPEN参照が削除されていること

---

### REQ-2: 状態ファイルのHMAC署名

**目的**: workflow-state.jsonの改竄検出

**対象ファイル**:
- `mcp-server/src/state/manager.ts`
- `mcp-server/src/state/types.ts`

**技術仕様**:
- アルゴリズム: HMAC-SHA256
- 署名対象: TaskState全体（signatureフィールド以外）
- 署名キー: `crypto.pbkdf2Sync(hostname + username, "workflow-mcp-v1", 100000, 32, "sha256")`
- 署名フィールド: `TaskState.signature?: string`

**要求**:
- `manager.writeTaskState()`で署名を自動付与
- `manager.getTaskById()`で署名を検証
- 署名不正時は`InvalidSignatureError`をthrow
- 署名なしファイル（既存）は初回アクセス時に署名追加（後方互換性）

**受入条件**:
- AC-2-1: workflow-state.jsonを手動編集すると`getTaskById()`が例外を投げること
- AC-2-2: 正常な`workflow_next`経由の遷移では署名検証に成功すること
- AC-2-3: 新規タスク作成時に`signature`フィールドが存在すること
- AC-2-4: 署名計算が10ms以内に完了すること

---

### REQ-3: スコープサイズ制限

**目的**: メモリ不足・処理時間超過の防止

**対象ファイル**:
- `mcp-server/src/tools/set-scope.ts`
- `mcp-server/src/tools/next.ts`

**制限値**:
```typescript
const MAX_SCOPE_FILES = 200;
const MAX_SCOPE_DIRS = 20;
```

**要求**:
- `set-scope.ts`でファイル数・ディレクトリ数をカウント
- 上限超過時はエラーメッセージでタスク分割を推奨
- `next.ts`のparallel_analysis→parallel_design遷移時にも同様のチェック
- エラーメッセージ: 「スコープが大きすぎます（{actual}ファイル、上限{MAX_SCOPE_FILES}）。タスクを機能単位に分割してください。」

**受入条件**:
- AC-3-1: 201ファイルのスコープ設定が`ScopeTooLargeError`で拒否されること
- AC-3-2: 200ファイル以下は通過すること
- AC-3-3: エラーメッセージに「タスクを分割してください」が含まれること
- AC-3-4: 21ディレクトリのスコープ設定が拒否されること

---

### REQ-4: Bashコマンド解析の強化

**目的**: パイプ・連結コマンドによる検出回避を防止

**対象ファイル**:
- `hooks/phase-edit-guard.js`

**問題点**:
```javascript
// 現状: 先頭マッチのみ
if (ALWAYS_ALLOWED_BASH_PATTERNS.some(p => cmd.startsWith(p))) {
  return; // `pwd && rm -rf /` が通過してしまう
}
```

**要求**:
1. **連結コマンドの分解**: `&&`, `||`, `;`, `|`で分割して各部分を個別に検証
2. **完全マッチへの変更**: `startsWith()`でなく完全一致またはホワイトリスト引数チェック
3. **awk単一リダイレクトのブロック**: `FILE_MODIFYING_COMMANDS`に`/awk\s+.*>/`を追加

**具体例**:
```javascript
// 分解前: pwd && rm -rf /
// 分解後: ["pwd", "rm -rf /"]
// → "rm -rf /" が FILE_MODIFYING_COMMANDS に該当してブロック
```

**受入条件**:
- AC-4-1: `pwd && rm -rf /` がブロックされること
- AC-4-2: `cat file.txt | bash` がブロックされること
- AC-4-3: `awk 'BEGIN{print "x"}' > file.ts` がブロックされること
- AC-4-4: 単純な`ls -la` は引き続き許可されること
- AC-4-5: `git status; git diff` がブロックされること（idleフェーズ以外）

---

### REQ-5: 成果物内容検証の強化

**目的**: スタブファイル・空ファイルのコミットを防止

**対象ファイル**:
- `hooks/check-workflow-artifact.js`

**要求**:
1. **最小サイズの引き上げ**: 50バイト→200バイトに変更
2. **必須セクション検証**:
   - `requirements.md`: `## 機能要件` または `## 背景` を含むこと
   - `spec.md`: `## 実装計画` または `## アーキテクチャ` を含むこと
   - `threat-model.md`: `## 脅威` または `## リスク` を含むこと
   - `test-design.md`: `## テストケース` または `## テスト計画` を含むこと
3. **禁止パターン検出**:
   - ファイル全体が`TODO`のみ
   - ファイル全体が`WIP`のみ
   - ファイル全体がMarkdownヘッダーのみ（本文なし）

**受入条件**:
- AC-5-1: 「TODO」のみの`spec.md`がブロックされること
- AC-5-2: 必須セクションを含む`requirements.md`は通過すること
- AC-5-3: 200バイト未満の`requirements.md`が警告されること
- AC-5-4: 「## 機能要件」を含まない`requirements.md`がブロックされること

---

### REQ-6: 設計検証の必須化

**目的**: 空実装・スタブクラスの実装フェーズ突入を防止

**対象ファイル**:
- `mcp-server/src/tools/next.ts`
- `mcp-server/src/validation/design-validator.ts`

**要求**:
1. **環境変数の無視**:
   - `SKIP_DESIGN_VALIDATION`を参照しても検証を実行（無視）
   - `VALIDATE_DESIGN_STRICT`を廃止（常に厳格モード）
2. **空実装検出の追加**:
   - メソッドボディが`{}`のみの場合はfailを返す
   - クラスボディが空の場合はfailを返す
   - インターフェース定義のみで実装がない場合は警告
3. **検証対象の拡大**:
   - TypeScript: クラス、関数、インターフェース
   - Python: クラス、関数、型ヒント

**受入条件**:
- AC-6-1: `SKIP_DESIGN_VALIDATION=true`でも検証が実行されること
- AC-6-2: `class Foo { method() {} }` が検出されること
- AC-6-3: 正当な実装は検証に通過すること
- AC-6-4: parallel_design→test_designの遷移時に検証が実行されること

---

## 非機能要件

### NFR-1: 後方互換性

**要求**:
- 既存の425テスト（13ファイル）が全て通過すること
- 既存のワークフロー状態ファイル（署名なし）との互換性維持
- 署名なしファイルは初回アクセス時に署名追加（移行ロジック）

**受入条件**:
- NFR-1-1: `npm test`が全て通過すること
- NFR-1-2: 署名なし状態ファイルを読み込むと自動的に署名が追加されること

---

### NFR-2: パフォーマンス

**要求**:
- HMAC署名の計算が10ms以内
- スコープ検証の実行時間が100ms以内
- フックの実行時間が現在の3秒タイムアウト内に収まること

**受入条件**:
- NFR-2-1: 100ファイルのスコープ設定が100ms以内に完了すること
- NFR-2-2: 署名検証が5ms以内に完了すること

---

### NFR-3: テスト

**要求**:
- 新規テストケースを各REQに対して5件以上作成
- テストカバレッジ90%以上（新規コード）
- 既存テストの回帰なし

**テストファイル**:
- `mcp-server/src/__tests__/hmac-signature.test.ts` (REQ-2)
- `mcp-server/src/__tests__/scope-limits.test.ts` (REQ-3)
- `hooks/__tests__/bash-command-parser.test.ts` (REQ-4)
- `hooks/__tests__/artifact-content-validation.test.ts` (REQ-5)
- `mcp-server/src/__tests__/design-validation-strict.test.ts` (REQ-6)

**受入条件**:
- NFR-3-1: 新規テストが30件以上追加されること
- NFR-3-2: 全テストが通過すること

---

## スコープ

### 変更対象ファイル（9ファイル）

**優先度1: セキュリティ根本修正**
1. `hooks/enforce-workflow.js` (REQ-1)
2. `hooks/phase-edit-guard.js` (REQ-1, REQ-4)
3. `hooks/block-dangerous-commands.js` (REQ-1)
4. `hooks/check-workflow-artifact.js` (REQ-5)
5. `mcp-server/src/state/manager.ts` (REQ-2)
6. `mcp-server/src/state/types.ts` (REQ-2)

**優先度2: スコープ・検証強化**
7. `mcp-server/src/tools/next.ts` (REQ-3, REQ-6)
8. `mcp-server/src/tools/set-scope.ts` (REQ-3)
9. `mcp-server/src/validation/design-validator.ts` (REQ-6)

### 変更対象外

以下は本タスクのスコープ外とし、別タスクで対応:
- `workflow-phases/*.md` (フェーズガイダンス文書)
- `CLAUDE.md` (プロジェクト指示書)
- その他のスキップ環境変数（SKIP_PHASE_GUARD等）

---

## ユーザーストーリー

### US-1: セキュリティ監査担当者として
「環境変数でセキュリティ機構を無効化できないこと」を確認したい。
→ REQ-1, REQ-6で対応

### US-2: 大規模プロジェクト開発者として
「巨大なスコープ設定でメモリ不足にならないよう」制限されたい。
→ REQ-3で対応

### US-3: コードレビュアーとして
「スタブ実装や空ファイルがコミットされないこと」を保証したい。
→ REQ-5, REQ-6で対応

### US-4: 監査ログ管理者として
「状態ファイルの改竄を検出できること」を確認したい。
→ REQ-2で対応

---

## 用語定義

| 用語 | 定義 |
|------|------|
| FAIL_OPEN | エラー時にセキュリティ検証を通過させる設計（本修正で廃止） |
| FAIL_CLOSED | エラー時にセキュリティ検証で拒否する設計（本修正で採用） |
| HMAC | Hash-based Message Authentication Code（署名アルゴリズム） |
| スコープ | ワークフローで編集可能なファイル・ディレクトリの集合 |
| 成果物 | 各フェーズで作成が必須のドキュメント（research.md等） |

---

## リスク

| リスク | 影響度 | 対策 |
|--------|--------|------|
| 既存テストの破壊 | 高 | 全テストを実行してから次フェーズへ |
| パフォーマンス劣化 | 中 | 署名計算の最適化、ベンチマーク実施 |
| 後方互換性喪失 | 高 | 署名なしファイルの自動移行ロジック |
| 過剰な制限によるユーザビリティ低下 | 中 | MAX_SCOPE_FILESを200に設定（調整可能） |

---

## 成果物

1. 修正されたフックファイル（4ファイル）
2. 修正されたMCPサーバーファイル（5ファイル）
3. 新規テストファイル（5ファイル）
4. 本要件定義書

---

## 受入基準（全体）

以下の全てを満たすこと:
- ✅ 全機能要件（REQ-1〜REQ-6）の受入条件を満たす
- ✅ 全非機能要件（NFR-1〜NFR-3）の受入条件を満たす
- ✅ 既存の425テストが全て通過
- ✅ 新規テストが30件以上追加され、全て通過
- ✅ セキュリティ監査で致命的欠陥なし
