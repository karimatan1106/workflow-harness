# 脅威モデル: ワークフロー大規模対応根本改修

## 概要

ワークフロー強制ルール実装における認可制御とデータ整合性に関する脅威分析。対象範囲はMCPプラグイン内のフェーズ管理、state management、ファイル編集制御。

---

## STRIDE分析

### Spoofing（なりすまし）

| 脅威 | リスク | 説明 | 緩和策 |
|------|--------|------|--------|
| AIがユーザーになりすまし | 低 | MCP経由のローカルツール。外部攻撃面なし。MCPプラグインはClaudeプロセス内で実行される。 | 制御なし（外部攻撃面なし） |
| 別タスクの状態を利用 | 低 | タスクIDはワークスペース内で一意。外部からのアクセス不可。 | タスク認証なし（ローカル環境） |

### Tampering（改ざん）

| 脅威 | リスク | 説明 | 緩和策 |
|------|--------|------|--------|
| **AIが workflow-state.json を直接編集してフェーズをスキップ** | **高** | AIがphase-edit-guardをバイパスし、state.jsonのcurrentPhaseを直接改ざん。例: `implementation` → `completed`へジャンプ。テスト・レビュー等の品質ゲートを迂回。 | 1. state.jsonへの直接編集を禁止リストに追加<br>2. フェーズ遷移は workflow_next コマンド経由のみ<br>3. Edit/Write ツールでの .json 編集をブロック（phase-edit-guard拡張） |
| **テスト結果の偽装（REQ-2）** | **中** | testResultsの件数やstatusを手動で改ざん。例: failedCount を 0 に編集。整合性チェックの無効化。 | 1. テスト出力ファイルのハッシュ検証<br>2. キーワード抽出ロジックで件数確認<br>3. テスト実行ログの改ざん検出 |
| 仕様書との整合性チェックの偽装 | 中 | code-review.md で「設計-実装整合性: OK」と記載しても実装がない場合。 | 1. implementation フェーズでの設計チェックリスト検証<br>2. code_review フェーズでの相互チェック<br>3. 未実装項目の詳細リスト化 |
| 成果物ファイルの削除 | 低 | requirements.md削除後に requirements を再度確認しようとする。 | 1. GitでVersionControl<br>2. 各フェーズの入力ファイル存在チェック<br>3. 前フェーズの成果物参照ロジック |

### Repudiation（否認）

| 脅威 | リスク | 説明 | 緩和策 |
|------|--------|------|--------|
| **AIが「実装した」と主張してもコードがない** | **中** | implementationフェーズ完了と宣言しても、src/配下に新規ファイルがない場合。 | 1. フェーズ完了時に成果物の存在確認<br>2. implementation フェーズ完了前にコミット未実行をチェック<br>3. 実装件数・新規ファイル数を記録 |
| **操作ログの不在** | 低 | workflow操作がlog.mdに記録されていない。 | 1. 全フェーズ遷移をlog.mdに自動記録<br>2. resetHistoryで履歴追跡可能<br>3. timestamps の確認 |
| フェーズスキップの証拠隠滅 | 低 | SKIP_*環境変数使用履歴が記録されない。 | 環境変数設定時に警告ログ + audit trail に記録 |

### Information Disclosure（情報漏洩）

| 脅威 | リスク | 説明 | 緩和策 |
|------|--------|------|--------|
| .env ファイルのコミット | 低 | 秘密鍵・APIキーが成果物に含まれる。 | 1. git add --force 不可（Bashツール確認）<br>2. .gitignore チェック<br>3. 機密ファイル検出スクリプト |
| workflow-state.json の外部公開 | 低 | state.json が GitHub に push される。 | 1. workflow-state.json を .gitignore に追加<br>2. docs/workflows/ のみ commit 対象<br>3. .claude/state/ は commit禁止 |
| ドキュメント内の機密情報 | 低 | docs/workflows/ に秘密情報が記載される。 | レビュー時の人的チェック（AI操作ではなくユーザー承認） |

### Denial of Service（サービス拒否）

| 脅威 | リスク | 説明 | 緩和策 |
|------|--------|------|--------|
| **Fail Closed による永続的な作業停止（REQ-3）** | **中** | フックエラーでフェーズロックがONのまま修復不可。AIが操作を継続できない。 | 1. FAIL_OPEN=true 環境変数でDebugモード有効化<br>2. /workflow reset で強制リセット<br>3. 管理者による手動state.json修正 |
| 無限ループ検出による作業中断 | 低 | 同一ファイルの5回編集→永続ブロック。実装中に引っかかる可能性。 | 1. SKIP_LOOP_DETECTION=true で一時的に無効化<br>2. カウンターのリセット機構<br>3. ファイル別（行別）の細粒度ロック |
| phase-edit-guard による過度なブロック | 中 | 正当な編集（テスト修正等）が誤ってブロックされる。 | 1. 編集可能フェーズの具体的リスト化<br>2. ホワイトリスト方式の厳密設定<br>3. エラーメッセージに回避方法を記載 |

### Elevation of Privilege（権限昇格）

| 脅威 | リスク | 説明 | 緩和策 |
|------|--------|------|--------|
| **SKIP_* 環境変数による自主的な制限解除** | **高** | AIが `SKIP_PHASE_GUARD=true` を自己設定して全ての制限をバイパス。品質ゲートが無効化。 | 1. SKIP_* の廃止を将来の P1 タスクに登録<br>2. 現在は「AI の自主的な解除は禁止」と明記<br>3. 監査ログに SKIP_* 使用を強制記録<br>4. ユーザー承認なしの SKIP_* 使用を禁止 |
| 環境変数による workflow コマンド呼び出し | 高 | AI が workflow_next を直接呼び出す環境変数を設定。ツールの本来用途外使用。 | 1. workflow_* コマンドは Skill ツール経由のみ<br>2. Bash での直接呼び出し禁止<br>3. MCP プラグイン側で Skill ガード実装 |

---

## 要件別リスク分析

### REQ-1: scope変数による編集範囲制限

**脅威:**
- scope が未設定のまま編集フェーズに進入
- AIが誤って scope外のファイルを編集可能に
- planning完了時のチェック漏れ

**リスク:** 中

**緩和策:**
1. planning フェーズ完了時に必須チェック（scope設定確認）
2. scope が空の場合は design_review に進めない
3. エラーメッセージに「/workflow set-scope <pattern>」の正しい使用方法を記載
4. テンプレート化で初期値設定

**責務:**
- MCPプラグイン: scope値の必須チェック
- AI: planning完了前に明示的に scope 設定

---

### REQ-2: テスト結果の偽装検出（test_impl → testing）

**脅威:**
- testResults の件数を改ざん（例: failed=5 → failed=0）
- テスト実行ログを削除して「テストが通った」と主張
- code-review.md で「テスト成功」と記載してもテスト出力ファイルが存在しない

**リスク:** 高

**緩和策:**

#### 1. キーワード検証（testing フェーズ）
```typescript
// テスト結果ファイル（test-results.md）から以下をキーワード抽出
const keywords = [
  { pattern: /Total.*?(\d+)/i, label: 'totalTests' },
  { pattern: /Passed.*?(\d+)/i, label: 'passedTests' },
  { pattern: /Failed.*?(\d+)/i, label: 'failedTests' },
  { pattern: /PASS|✓|success/i, label: 'hasPassedIndicator' },
  { pattern: /FAIL|✗|error/i, label: 'hasFailedIndicator' }
];
```

#### 2. 整合性チェック
```
□ testResults.passed + testResults.failed === testResults.total
□ keywordExtraction結果 === testResults
□ テスト出力ファイル（.test.ts実行ログ）が存在するか
□ code-review.md の「テスト: OK」と整合するか
```

#### 3. テスト実行ログの保存
- 全テスト実行結果を `docs/testing/reports/{taskName}-{date}.md` に保存
- stdout/stderr を capするBashコマンド例
- ハッシュ値（SHA256）で改ざん検出

#### 4. 失敗時の処理
- `testResults.failed > 0` の場合、testing フェーズで停止
- implementation に差し戻し（修正対象リスト を明示）

---

### REQ-3: Fail Closed → Fail Open 移行（フェーズロック）

**脅威:**
- フックエラー → フェーズロック ON
- AI が操作を継続できない（DoS状態）
- 修復方法不明でタスク中断

**リスク:** 中

**緩和策:**

#### 1. FAIL_OPEN=true 環境変数
```bash
# デバッグモード
export FAIL_OPEN=true
/workflow next  # エラーがあってもフェーズ遷移を許可
```
- ログに `[FAIL_OPEN] フックエラーは警告のみ` と記録
- 監査証跡に FAIL_OPEN=true 使用を記録

#### 2. /workflow reset コマンド
```bash
/workflow reset [理由]
# research フェーズにリセット
# resetHistory に理由を記録
```
- 強制リセット時にユーザー確認を推奨（AI実行時の判断基準をログに記載）

#### 3. 段階的な Fail Open
| フェーズ | ロック強度 | 説明 |
|---------|-----------|------|
| design_review | Fail Closed | 絶対に進めない |
| testing | Fail Closed | テスト失敗で進めない |
| parallel_quality | Fail Closed | ビルド失敗で進めない |
| その他 | Fail Open | 警告でも進行可能 |

#### 4. 復旧手順の明示
- フェーズロック状態でのエラーメッセージに以下を記載：
  ```
  フェーズがロックされています。

  選択肢:
  1. FAIL_OPEN=true を設定して実行: export FAIL_OPEN=true && /workflow next
  2. リセットして最初からやり直す: /workflow reset
  3. 手動修復: workflow-state.json を編集
  ```

---

## リスク評価マトリックス

| # | 脅威 | リスク | 影響 | 対応優先度 | 緩和策 |
|---|------|--------|------|-----------|--------|
| 1 | state.json 直接編集によるフェーズスキップ | 高 | 品質ゲート無視 | P0 | Edit/Write ツール側で .json 編集ブロック |
| 2 | SKIP_* 環境変数の自主的解除 | 高 | ルール無視 | P1 | SKIP_* を廃止または ユーザー承認必須に |
| 3 | テスト結果の偽装 | 高 | 欠陥見逃し | P0 | キーワード検証 + ハッシュ検証 |
| 4 | Fail Closed による作業停止 | 中 | タスク中断 | P1 | FAIL_OPEN=true + /workflow reset |
| 5 | 仕様-実装整合性の見落とし | 中 | 未実装機能 | P0 | code_review での相互チェック + チェックリスト |
| 6 | phase-edit-guard による誤ブロック | 中 | 作業効率低下 | P2 | ホワイトリスト精密化 |
| 7 | scope 未設定によるファイル全編集 | 中 | 意図しない変更 | P1 | planning 完了時の必須チェック |
| 8 | 同一ファイル5回編集による永続ロック | 低 | 実装中断 | P2 | SKIP_LOOP_DETECTION + カウンターリセット |
| 9 | 操作ログの不記録 | 低 | 監査不可 | P2 | 全操作を log.md に自動記録 |

---

## 実装チェックリスト

### Phase Guard 拡張
- [ ] Edit/Write ツール側で `.json` ファイルの編集をブロック（phase-edit-guard統合）
- [ ] エラーメッセージに「workflow_next を使用してください」を記載
- [ ] 監査ログに ブロック試行を記録

### テスト整合性チェック
- [ ] testing フェーズで testResults キーワード抽出ロジック実装
- [ ] test-design.md との比較マトリックス作成
- [ ] テスト実行ログ（stdout）をハッシュ値で検証
- [ ] 失敗時の差し戻しプロセス明確化

### Fail Open 環境変数
- [ ] FAIL_OPEN=true フラグの実装
- [ ] log.md に FAIL_OPEN=true 使用時に警告ログ記録
- [ ] resetHistory と連携

### scope 必須チェック
- [ ] planning 完了時に scope != null チェック
- [ ] 空の scope で design_review に進めない
- [ ] テンプレート化で初期値設定

### 監査ログ
- [ ] 全フェーズ遷移を log.md に自動記録
- [ ] SKIP_* 使用時は赤フラグで記録
- [ ] resetHistory との連携

---

## セキュリティ境界

```
┌─────────────────────────────────────────────────────────────┐
│           Claude Code プロセス内（信頼できる）              │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  AI (Claude) - MCP Plugins - Filesystem (local)             │
│                                                             │
│  - ローカルツール（Bash, Read, Edit, Write等）            │
│  - workflow-state.json（内部状態）                         │
│  - docs/workflows/（成果物）                               │
│                                                             │
│  制御: phase-edit-guard（Edit/Write ツール側）             │
│       workflow_* command（Skill ツール側）                 │
│       scope検証（各フェーズ開始時）                         │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**外部攻撃面**: なし（ローカル環境のみ）

**内部攻撃面（AI自身による）**:
- state.json 直接編集
- SKIP_* 環境変数設定
- テスト結果改ざん
- 仕様-実装整合性チェックの無視

**対策**: ツール側のガード + ユーザー承認（design_review等）

---

## 今後の改善

### P1（次ワークフロー改修タスク）
- [ ] SKIP_* 環境変数の廃止検討
  - 代替: ユーザー承認フロー（design_review等で既に実装）
- [ ] environment variable での workflow コマンド呼び出し禁止
  - MCP側で Bash → workflow_* 直接呼び出し検出
- [ ] テスト結果ハッシュ検証の自動化
  - SHA256 による改ざん検出ツール

### P2（運用改善）
- [ ] phase-edit-guard の ホワイトリスト精密化
  - ファイル単位から行単位への細粒度ロック
- [ ] 監査ログダッシュボード
  - workflow操作履歴の可視化
- [ ] loop-detection カウンターの自動リセット
  - フェーズ遷移時にリセット

---

## 参考資料

- STRIDE フレームワーク: Microsoft Threat Modeling Tool
- OWASP Top 10: Web Application Security
- ローカル開発環境のセキュリティベストプラクティス: NIST SP 800-153

---

**脅威モデル作成日**: 2026-02-07
**対象プロジェクト**: ワークフロー大規模対応根本改修
**ステータス**: 完成（実装予定）
