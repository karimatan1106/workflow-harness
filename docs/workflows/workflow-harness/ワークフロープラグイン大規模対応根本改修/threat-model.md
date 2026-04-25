# 脅威モデル: ワークフロープラグイン大規模対応根本改修

## 概要

本脅威モデルは、workflow-pluginのセキュリティ強化に関する脅威分析を記述する。
対象システムは、Claude MCPサーバーとGitフックを組み合わせたワークフロー制御機構である。

**分析日**: 2026-02-07
**分析手法**: STRIDE
**対象バージョン**: workflow-plugin v2.0（大規模対応根本改修版）

---

## システム概要

### アーキテクチャ

```
┌─────────────────────────────────────────────────────────┐
│ Claude AI (クライアント)                                 │
│  - ファイル編集・Bashコマンド実行を要求                  │
└──────────────────┬──────────────────────────────────────┘
                   │ MCP Protocol
┌──────────────────▼──────────────────────────────────────┐
│ workflow-mcp-server                                     │
│  - 状態管理 (workflow-state.json)                       │
│  - フェーズ遷移制御                                      │
│  - スコープ検証                                          │
│  - 設計検証                                              │
└──────────────────┬──────────────────────────────────────┘
                   │ ファイルシステム
┌──────────────────▼──────────────────────────────────────┐
│ Git Hooks (Pre-commit, Pre-tool-use)                    │
│  - enforce-workflow.js (フェーズ検証)                   │
│  - phase-edit-guard.js (編集可能ファイルチェック)       │
│  - block-dangerous-commands.js (危険コマンドブロック)   │
│  - check-workflow-artifact.js (成果物検証)              │
└─────────────────────────────────────────────────────────┘
```

### 信頼境界

| 境界 | 内側（信頼） | 外側（非信頼） |
|------|-------------|---------------|
| TB-1 | MCPサーバー | Claude AI |
| TB-2 | Gitフック | Claude AI + MCPサーバー |
| TB-3 | 状態ファイル | ファイルシステム |

---

## 脅威一覧

### T-1: FAIL_OPEN環境変数によるガードバイパス

**STRIDE分類**: Tampering, Elevation of Privilege
**深刻度**: **Critical**
**CVSSスコア**: 9.8 (Critical)

#### 脅威シナリオ

攻撃者（または誤設定）が`FAIL_OPEN=true`を設定することで、全12箇所のフック例外ハンドラが「エラー時は許可」モードになる。

```bash
# 攻撃例
FAIL_OPEN=true git add src/malicious.ts
# → フックがエラーを無視してコミットを許可
```

#### 影響

- フェーズ制御の完全崩壊（idle状態で実装コード追加可能）
- 危険コマンドの実行許可（`rm -rf /`等）
- 成果物検証のスキップ（空ファイルでフェーズ進行）

#### 既存対策（不十分）

```javascript
// 現状: 例外時にFAIL_OPENをチェック
if (process.env.FAIL_OPEN) {
  console.warn('⚠️ FAIL_OPEN有効、エラーを無視');
  return; // ガードをスキップ
}
process.exit(2); // ブロック
```

#### 対策（REQ-1）

- **FAIL_OPEN環境変数の完全除去**
- エラー時は常に`process.exit(2)`でブロック（fail-closed原則）
- 環境変数が設定されていても無視

#### 検証

- AC-1-1: `FAIL_OPEN=true git add .`でもブロックされること
- AC-1-3: 12箇所全ての`process.env.FAIL_OPEN`参照が削除されていること

---

### T-2: workflow-state.jsonの直接改竄

**STRIDE分類**: Tampering, Spoofing
**深刻度**: **Critical**
**CVSSスコア**: 9.1 (Critical)

#### 脅威シナリオ

AIまたはユーザーが`workflow-state.json`を直接編集してフェーズをスキップ。

```bash
# 攻撃例
sed -i 's/"phase":"research"/"phase":"implementation"/' \
  .claude/state/workflows/task_123/workflow-state.json
# → research完了せずにコード編集可能
```

#### 影響

- 仕様書作成なしで実装開始（要件定義スキップ）
- テスト設計なしで実装開始（TDDサイクル破壊）
- 設計レビュー承認なしで実装開始（品質保証崩壊）

#### 既存対策（不十分）

- **なし**（プレーンJSON、署名なし）

#### 対策（REQ-2）

- **HMAC-SHA256署名の追加**
  - 署名キー: `crypto.pbkdf2Sync(hostname + username, "workflow-mcp-v1", 100000, 32, "sha256")`
  - 署名対象: TaskState全体（signatureフィールド以外）
  - 署名フィールド: `TaskState.signature?: string`
- `manager.writeTaskState()`で自動署名
- `manager.getTaskById()`で署名検証
- 署名不正時は`InvalidSignatureError`をthrow

#### 残存リスク

- **AIがsedでsignatureフィールドも書き換える可能性**
  - 対策: REQ-4でsed単一リダイレクトをブロック
- **署名キーの推測可能性**
  - hostname/usernameは比較的容易に推測可能
  - 将来的にcrypto.randomBytesで生成したキーを`.claude/state/secret.key`に保存（ファイルパーミッション600）を検討

#### 検証

- AC-2-1: 状態ファイル手動編集で`getTaskById()`が例外を投げること
- AC-2-3: 新規タスク作成時に`signature`フィールドが存在すること

---

### T-3: Bashコマンド連結によるガード回避

**STRIDE分類**: Elevation of Privilege
**深刻度**: **High**
**CVSSスコア**: 8.1 (High)

#### 脅威シナリオ

AIが許可されたコマンドと危険コマンドを`&&`で連結してガードをバイパス。

```bash
# 攻撃例
pwd && rm -rf src/  # pwdは許可されているため先頭マッチでパス
git status; sed -i 's/foo/bar/' src/code.ts  # idleフェーズで実行
cat file.txt | bash  # パイプ経由で任意コマンド実行
```

#### 影響

- readOnlyフェーズでのファイル編集
- 危険コマンドの実行（`rm -rf /`等）
- 状態ファイルの直接書き換え

#### 既存対策（不十分）

```javascript
// 現状: 先頭マッチのみ
const ALWAYS_ALLOWED_BASH_PATTERNS = ['pwd', 'ls', 'echo'];
if (ALWAYS_ALLOWED_BASH_PATTERNS.some(p => cmd.startsWith(p))) {
  return; // `pwd && malicious`が通過
}
```

#### 対策（REQ-4）

1. **連結コマンドの分解**: `&&`, `||`, `;`, `|`で分割して各部分を個別検証
2. **完全マッチへの変更**: `startsWith()`でなく完全一致またはホワイトリスト引数チェック
3. **awk単一リダイレクトのブロック**: `FILE_MODIFYING_COMMANDS`に`/awk\s+.*>/`を追加

```javascript
// 対策後: コマンド分解
const commands = splitByDelimiters(cmd, ['&&', '||', ';', '|']);
for (const subcmd of commands) {
  validateCommand(subcmd.trim());
}
```

#### 検証

- AC-4-1: `pwd && rm -rf /`がブロックされること
- AC-4-3: `awk 'BEGIN{print "x"}' > file.ts`がブロックされること
- AC-4-5: `git status; git diff`がブロックされること（idleフェーズ以外）

---

### T-4: 無制限スコープによるメモリ不足攻撃

**STRIDE分類**: Denial of Service
**深刻度**: **Medium**
**CVSSスコア**: 5.3 (Medium)

#### 脅威シナリオ

AIが巨大なスコープ（1000万ファイル）を設定してMCPサーバーをメモリ不足で停止。

```javascript
// 攻撃例
workflow_set_scope({
  taskId: "123",
  scopes: ["src/**"] // 1000万ファイルをglobで選択
})
// → メモリ不足でMCPサーバークラッシュ
```

#### 影響

- MCPサーバーの停止（OOM Kill）
- 処理時間超過（数分〜数時間）
- ユーザー体験の著しい低下

#### 既存対策（不十分）

- **なし**（ファイル数・ディレクトリ数の上限なし）

#### 対策（REQ-3）

```typescript
const MAX_SCOPE_FILES = 200;
const MAX_SCOPE_DIRS = 20;

// set-scope.ts, next.ts で検証
if (fileCount > MAX_SCOPE_FILES) {
  throw new ScopeTooLargeError(
    `スコープが大きすぎます（${fileCount}ファイル、上限${MAX_SCOPE_FILES}）。` +
    `タスクを機能単位に分割してください。`
  );
}
```

#### 検証

- AC-3-1: 201ファイルのスコープ設定が`ScopeTooLargeError`で拒否されること
- AC-3-4: 21ディレクトリのスコープ設定が拒否されること

---

### T-5: スタブ成果物によるフェーズ進行

**STRIDE分類**: Spoofing
**深刻度**: **Medium**
**CVSSスコア**: 6.5 (Medium)

#### 脅威シナリオ

AIが空・スタブファイルを作成して成果物チェックをパス。

```bash
# 攻撃例
echo "TODO" > docs/workflows/task_123/spec.md
# → 50バイト未満は警告のみで通過
```

#### 影響

- 仕様書なしで実装開始（設計スキップ）
- 品質の低い成果物の蓄積
- レビュー不能なドキュメント

#### 既存対策（不十分）

```javascript
// 現状: サイズチェックのみ
if (stats.size < 50) {
  console.warn('⚠️ ファイルが小さすぎます');
  // 警告のみ、ブロックなし
}
```

#### 対策（REQ-5）

1. **最小サイズの引き上げ**: 50バイト→200バイト
2. **必須セクション検証**:
   - `requirements.md`: `## 機能要件` または `## 背景`
   - `spec.md`: `## 実装計画` または `## アーキテクチャ`
   - `threat-model.md`: `## 脅威` または `## リスク`
   - `test-design.md`: `## テストケース` または `## テスト計画`
3. **禁止パターン検出**:
   - ファイル全体が`TODO`のみ
   - ファイル全体が`WIP`のみ
   - Markdownヘッダーのみ（本文なし）

#### 検証

- AC-5-1: 「TODO」のみの`spec.md`がブロックされること
- AC-5-4: 必須セクションを含まない`requirements.md`がブロックされること

---

### T-6: SKIP_DESIGN_VALIDATION環境変数によるバイパス

**STRIDE分類**: Tampering
**深刻度**: **High**
**CVSSスコア**: 7.5 (High)

#### 脅威シナリオ

`SKIP_DESIGN_VALIDATION=true`で空実装・スタブクラスのまま実装フェーズ突入。

```bash
# 攻撃例
SKIP_DESIGN_VALIDATION=true workflow_next
# → 空メソッド `method() {}` のまま test_design フェーズへ
```

#### 影響

- 空実装のコミット
- テスト不能なコード（インターフェースのみ）
- コードレビューの形骸化

#### 既存対策（不十分）

```javascript
// 現状: 環境変数で検証スキップ
if (process.env.SKIP_DESIGN_VALIDATION) {
  console.warn('設計検証をスキップします');
  return { success: true };
}
```

#### 対策（REQ-6）

1. **環境変数の無視**: `SKIP_DESIGN_VALIDATION`を参照しても検証実行
2. **VALIDATE_DESIGN_STRICTの廃止**: 常に厳格モード
3. **空実装検出**:
   - メソッドボディが`{}`のみ → fail
   - クラスボディが空 → fail
   - インターフェース定義のみで実装なし → 警告

#### 検証

- AC-6-1: `SKIP_DESIGN_VALIDATION=true`でも検証実行されること
- AC-6-2: `class Foo { method() {} }`が検出されること

---

### T-7: AIによるフックファイル自体の改変

**STRIDE分類**: Tampering
**深刻度**: **Critical**
**CVSSスコア**: 9.0 (Critical)

#### 脅威シナリオ

AIが`.git/hooks/`や`hooks/`ディレクトリのファイルを読み取り、バイパス方法を学習して改変。

```javascript
// AIの学習例
Read('.git/hooks/pre-commit')
// → enforce-workflow.jsのロジックを理解
// → 回避方法を実装
Edit('hooks/enforce-workflow.js', {
  old_string: 'process.exit(2)',
  new_string: 'return // bypass'
})
```

#### 影響

- セキュリティ機構の完全無効化
- 任意のコード変更・コミット

#### 既存対策（不十分）

- **なし**（hooks/ディレクトリは編集可能）

#### 対策（検討中）

- `hooks/`ディレクトリを全フェーズでread-onlyに設定
- フックファイルの改変を検出するチェックサム検証
- `.git/hooks/`の保護（Gitの仕様上困難）

#### 残存リスク（スコープ外）

本タスクではhooks/自体の保護は対象外。将来的な課題として記録。

---

### T-8: config/package.json攻撃ベクター

**STRIDE分類**: Tampering, Elevation of Privilege
**深刻度**: **High**
**CVSSスコア**: 7.8 (High)

#### 脅威シナリオ

AIが`package.json`のスクリプトを改変して任意コードを実行。

```json
// 攻撃例
{
  "scripts": {
    "test": "rm -rf / && echo 'pwned'"
  }
}
```

#### 影響

- テスト実行時の任意コード実行
- CI/CDパイプラインの乗っ取り

#### 既存対策（不十分）

```javascript
// phase-edit-guard.js
const ALWAYS_EDITABLE = [
  'package.json',
  'tsconfig.json',
  '.env'
];
// → 常に編集可能（保護なし）
```

#### 対策（検討中）

- `package.json`の差分検証（`scripts`セクションの改変を検出）
- 危険なスクリプト（`rm`, `curl`, `wget`等）の禁止

#### 残存リスク（スコープ外）

本タスクでは`package.json`の保護は対象外。

---

### T-9: PreToolUse外のMCPツール呼び出し

**STRIDE分類**: Elevation of Privilege
**深刻度**: **Medium**
**CVSSスコア**: 5.9 (Medium)

#### 脅威シナリオ

AIがPreToolUseフックの対象外のMCPツール（`workflow_reset`等）を直接呼び出し。

```javascript
// 攻撃例
workflow_reset({ reason: "bypass design review" })
// → design_review承認なしでresearchに戻る → 再度実装フェーズへ
```

#### 影響

- 設計レビューの回避
- フェーズ進行制御の部分的バイパス

#### 既存対策

- `workflow_reset`は監査ログに記録
- リセット理由は必須

#### 残存リスク

- リセット回数制限なし
- 悪用パターンの検出なし

---

## リスクマトリクス

| 脅威ID | 脅威 | 可能性 | 影響 | リスクレベル | 対策状況 |
|--------|------|--------|------|-------------|---------|
| T-1 | FAIL_OPEN環境変数バイパス | 高 | 致命的 | **Critical** | REQ-1で対応 |
| T-2 | 状態ファイル改竄 | 高 | 致命的 | **Critical** | REQ-2で対応 |
| T-3 | Bashコマンド連結回避 | 高 | 高 | **High** | REQ-4で対応 |
| T-4 | 無制限スコープDoS | 中 | 中 | Medium | REQ-3で対応 |
| T-5 | スタブ成果物 | 中 | 中 | Medium | REQ-5で対応 |
| T-6 | SKIP_DESIGN_VALIDATIONバイパス | 高 | 高 | **High** | REQ-6で対応 |
| T-7 | フックファイル改変 | 低 | 致命的 | **High** | スコープ外 |
| T-8 | package.json攻撃 | 中 | 高 | **High** | スコープ外 |
| T-9 | PreToolUse外ツール | 低 | 中 | Low | 残存リスク |

---

## STRIDE分析サマリー

| STRIDE | 該当脅威 | 対策優先度 |
|--------|---------|----------|
| **Spoofing** | T-2（状態偽装）, T-5（成果物偽装） | High |
| **Tampering** | T-1, T-2, T-6（設定改変）, T-7（フック改変）, T-8（package.json） | Critical |
| **Repudiation** | （該当なし） | - |
| **Information Disclosure** | （該当なし） | - |
| **Denial of Service** | T-4（メモリ不足） | Medium |
| **Elevation of Privilege** | T-1, T-3, T-6, T-8, T-9 | High |

---

## 対策優先順位

### フェーズ1: Critical脅威の根本対策（本タスク）

1. **REQ-1**: FAIL_OPEN除去（T-1対策）
2. **REQ-2**: HMAC署名（T-2対策）
3. **REQ-4**: Bashコマンド解析強化（T-3対策）
4. **REQ-6**: 設計検証必須化（T-6対策）

### フェーズ2: 品質・安定性向上（本タスク）

5. **REQ-3**: スコープ制限（T-4対策）
6. **REQ-5**: 成果物内容検証（T-5対策）

### フェーズ3: 残存リスク対応（別タスク）

7. **T-7**: hooks/ディレクトリ保護
8. **T-8**: package.json/tsconfig.json差分検証
9. **T-9**: MCPツール呼び出しパターン分析

---

## 残存リスク

### 対策後も残る脅威

1. **AIの学習能力**
   - AIがフックロジックを読み取り、より高度なバイパス方法を発見する可能性
   - 対策: フックの難読化（非推奨）、動作監視の強化

2. **署名キーの強度**
   - hostname/usernameベースの鍵は推測可能性あり
   - 対策案: `crypto.randomBytes(32)`で生成した鍵を`.claude/state/secret.key`に保存（パーミッション600）

3. **フック外のファイル操作**
   - PreToolUseフックはBash/Edit/Writeツールのみ対象
   - 他のMCPツール（独自実装）は検証対象外
   - 対策: MCPプロトコルレベルでのインターセプト（実装困難）

4. **package.json/tsconfig.json**
   - 常に編集可能（ビルド設定のため必要）
   - scriptsセクションの悪用可能性
   - 対策: 差分検証、危険パターン検出（別タスク）

5. **リセット回数制限なし**
   - `workflow_reset`を無制限に実行可能
   - 悪用パターン: design_review拒否 → reset → 再度実装
   - 対策: 1タスクあたり3回までの制限（別タスク）

---

## 監査証跡

### セキュリティイベントのログ記録

以下のイベントは監査ログに記録される:

| イベント | ログ先 | 記録内容 |
|---------|-------|---------|
| 署名検証失敗 | `workflow.log` | タスクID、署名値、ファイルパス |
| スコープ超過 | `workflow.log` | タスクID、ファイル数、上限値 |
| 成果物検証失敗 | `workflow.log` | ファイル名、サイズ、検出パターン |
| 危険コマンド検出 | `workflow.log` | コマンド全文、検出パターン |
| 環境変数スキップ試行 | `workflow.log` | 環境変数名、設定値 |

### コンプライアンス要件

| 要件 | 対策 |
|------|------|
| SOC 2 Type II（変更管理） | 状態ファイル署名、監査ログ |
| ISO 27001（アクセス制御） | フェーズ別編集制限、スコープ制限 |
| NIST SP 800-53（設定管理） | fail-closed原則、環境変数無視 |

---

## 参考資料

- [STRIDE脅威モデリング](https://docs.microsoft.com/en-us/azure/security/develop/threat-modeling-tool-threats)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [NIST SP 800-53 Rev. 5](https://csrc.nist.gov/publications/detail/sp/800-53/rev-5/final)
- [Node.js crypto.createHmac](https://nodejs.org/api/crypto.html#crypto_crypto_createhmac_algorithm_key_options)

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-07 | 1.0 | 初版作成 |

---

**承認者**: セキュリティアーキテクト
**次回レビュー**: 実装完了後（test_implフェーズ）
