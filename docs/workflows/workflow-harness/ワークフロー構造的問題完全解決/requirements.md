# 要件定義書 - ワークフロー構造的問題完全解決

## サマリー

本プロジェクトは、ワークフロープラグインの6つの構造的問題を根本的に解決するための要件定義である。

**主要な決定事項:**
- HMAC署名検証を厳格化し、データ整合性を保証する
- 複数フェーズに承認ゲートを追加し、品質ゲートを強化する
- 成果物の内容品質を検証し、形式的な文書を防止する
- テスト回帰チェックで品質低下を防止する
- スコープ事後検証でAI申告と実変更の乖離を検出する
- セッショントークン方式でsubagentのフェーズ遷移を技術的にブロックする

**次フェーズで必要な情報:**
- 各要件に対する技術設計（アルゴリズム、データ構造、API仕様）
- セキュリティ上の考慮事項（トークン生成方式、保存方法）
- 後方互換性の担保方法（環境変数、移行期間）

---

## 前提条件

### 対象システム
- **プロジェクト**: ワークフロープラグイン
- **主要コンポーネント**: MCPサーバー、状態管理、検証モジュール
- **技術スタック**: TypeScript, Node.js, MCP Protocol

### 現状の課題
1. HMAC署名検証が移行期間のまま放置され、データ整合性が保証されていない
2. 承認ゲートがdesign_reviewの1箇所のみで、品質ゲートが不十分
3. 成果物検証が表面的で、AIが形式的な文書を生成しても通過する
4. テスト数・カバレッジの回帰チェックがなく、品質低下を検出できない
5. スコープ検証がAI自己申告のみで、実際の変更ファイルとの乖離を検出できない
6. subagentの制御がプロンプト依存で、技術的ブロックがない

---

## REQ-1: HMAC署名検証の厳格化

### 目的
移行期間を終了し、HMAC署名検証を厳格化することで、状態ファイルのデータ整合性を保証する。

### 背景
現在の`verifyStateHmac()`実装では、以下の4箇所全てで`return true`となっており、署名検証が完全に無効化されている：
- 署名なし（`!hmac`）
- 署名不一致（`hmac !== calculated`）
- 計算エラー（`error`）
- 検証エラー（`hmacVerifyError`）

これにより、以下のリスクが存在する：
- 状態ファイルが外部で改ざんされても検出できない
- デバッグ時に手動編集した状態ファイルが正規のものと区別できない
- セキュリティ上の脆弱性となる

### 機能要件

#### FR-1-1: 厳格モードでの署名検証
- **条件**: 環境変数`HMAC_STRICT`が`false`以外（デフォルト動作）
- **動作**:
  - 署名なし（`!hmac`）→ `false`を返す
  - 署名不一致（`hmac !== calculated`）→ `false`を返す
  - 計算エラー（`error`）→ `false`を返す
  - 検証エラー（`hmacVerifyError`）→ `false`を返す
  - 署名一致 → `true`を返す

#### FR-1-2: 緩和モードでの署名検証
- **条件**: 環境変数`HMAC_STRICT=false`が設定されている
- **動作**: 現在の実装と同様、常に`true`を返す
- **用途**: デバッグ時、移行期間、開発環境での利便性のため

#### FR-1-3: readTaskStateの動作
- **条件**: `verifyStateHmac()`が`false`を返す
- **動作**: `readTaskState()`は`null`を返す
- **影響範囲**: 署名不一致の状態ファイルは存在しないものとして扱われる

### 非機能要件

#### NFR-1-1: パフォーマンス
- 署名検証の追加による状態読み込みのオーバーヘッドは5%以内

#### NFR-1-2: ログ出力
- 署名検証失敗時は、ログレベル`warn`でワークフローディレクトリを出力
- 緩和モード動作時は、ログレベル`debug`で「HMAC strict mode disabled」を出力

#### NFR-1-3: エラーメッセージ
- 署名検証失敗時、ユーザー向けには「状態ファイルが破損しているか、改ざんされている可能性があります」と表示
- 開発者向けには、計算済み署名と実際の署名をログ出力（デバッグ用）

### 受入条件

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| AC-1-1 | HMAC_STRICT未設定、署名なし状態ファイルをreadTaskState | `null`を返す |
| AC-1-2 | HMAC_STRICT未設定、署名不一致の状態ファイルをreadTaskState | `null`を返す |
| AC-1-3 | HMAC_STRICT=false、署名なし状態ファイルをreadTaskState | 状態を正常に読み込む |
| AC-1-4 | HMAC_STRICT=false、署名不一致の状態ファイルをreadTaskState | 状態を正常に読み込む |
| AC-1-5 | HMAC_STRICT未設定、署名一致の状態ファイルをreadTaskState | 状態を正常に読み込む |

### 制約事項
- 既存の状態ファイルに署名がない場合、緩和モード（`HMAC_STRICT=false`）で起動するか、状態をリセットする必要がある
- 署名アルゴリズム（SHA-256）の変更は本要件のスコープ外

---

## REQ-2: 複数承認ゲートの追加

### 目的
requirements, test_design, code_reviewフェーズにユーザー承認を追加し、品質ゲートを強化する。

### 背景
現在の承認ゲートは`design_review`フェーズの1箇所のみであり、以下の問題が存在する：
- 要件定義（requirements）が不十分でも次フェーズに進める
- テスト設計（test_design）が不適切でも実装に入れる
- コードレビュー（code_review）で問題が指摘されても次に進める

これにより、手戻りが発生し、開発効率が低下する。

### 機能要件

#### FR-2-1: 承認フェーズの拡張
- **対象**: `REVIEW_PHASES`定数を拡張
- **追加フェーズ**:
  - `requirements`
  - `test_design`
  - `code_review`
- **既存**: `design_review`（維持）

#### FR-2-2: 承認タイプのマッピング
- **対象**: `APPROVE_TYPE_MAPPING`定数を拡張
- **追加マッピング**:
  - `requirements` → `'requirements'`
  - `test_design` → `'test_design'`
  - `code_review` → `'code_review'`
- **既存**: `design_review` → `'design'`（維持）

#### FR-2-3: workflow_approveの拡張
- **対象**: `workflowApprove()`関数のtype引数
- **追加型**: `'requirements' | 'test_design' | 'code_review'`
- **検証**: 未知のtype値に対してはエラーを返す

#### FR-2-4: workflow_nextの承認チェック
- **対象**: `requiresApproval()`関数の判定
- **動作**: 追加した3つのフェーズで承認が必須
- **未承認時**: workflow_nextがエラーを返す
- **エラーメッセージ**: 「{フェーズ名}フェーズは承認が必要です。/workflow approve {type}を実行してください」

### 非機能要件

#### NFR-2-1: 承認状態の永続化
- 各承認は`taskState.approvals`オブジェクトに記録
- フォーマット: `{ [approveType]: { approved: boolean, approvedAt: string } }`

#### NFR-2-2: ログ出力
- 承認実行時: 「{type} approval granted for task {taskId}」
- 未承認で遷移試行時: 「Transition blocked: {currentPhase} requires approval」

#### NFR-2-3: ユーザー体験
- 承認待ち状態は`workflow_status`で明示的に表示
- 例: 「現在のフェーズ: requirements（承認待ち）」

### 受入条件

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| AC-2-1 | requirementsフェーズで未承認状態でworkflow_next | エラー「requirementsフェーズは承認が必要です」 |
| AC-2-2 | requirementsフェーズでworkflow_approve requirements実行後にworkflow_next | parallel_analysisフェーズに遷移成功 |
| AC-2-3 | test_designフェーズで未承認状態でworkflow_next | エラー「test_designフェーズは承認が必要です」 |
| AC-2-4 | test_designフェーズでworkflow_approve test_design実行後にworkflow_next | test_implフェーズに遷移成功 |
| AC-2-5 | code_reviewフェーズで未承認状態でworkflow_next | エラー「code_reviewフェーズは承認が必要です」 |
| AC-2-6 | code_reviewフェーズでworkflow_approve code_review実行後にworkflow_next | testingフェーズに遷移成功 |
| AC-2-7 | design_reviewフェーズの既存動作 | 既存の承認機能が正常に動作 |

### 制約事項
- 承認のキャンセル機能は本要件のスコープ外
- 複数ユーザーによる承認（多段承認）は本要件のスコープ外

---

## REQ-3: 成果物品質検証の強化

### 目的
AIが「形式的に正しいが中身のない文書」を生成するのを防止し、実用的な成果物を保証する。

### 背景
現在の`validateArtifactQuality()`は以下のみチェック：
- 総行数（最小50行）
- セクション存在（見出しがあるか）
- 禁止パターン（「TODO」「後で実装」等）

これにより、以下の問題が発生：
- 各セクションが見出しのみで本文が空
- 本文が1行だけ形式的な文言（「詳細は別途検討」等）
- Mermaid図が状態1個、遷移0個等の形式的な内容
- ヘッダー行ばかりで本文が少ない文書

### 機能要件

#### FR-3-1: セクション最小文字数チェック
- **対象**: Markdownの各セクション（`## `以降、次の`##`まで）
- **最小文字数**: 50文字（ヘッダー行、空白行を除く）
- **検証ロジック**:
  1. 文書を`## `で分割してセクションを抽出
  2. 各セクションから見出し行、空白行を除去
  3. 残りの文字数をカウント
  4. 50文字未満のセクションがあればエラー
- **エラーメッセージ**: 「セクション'{セクション名}'の本文が不十分です（最小50文字）」

#### FR-3-2: コンテンツ比率チェック
- **目的**: ヘッダー行ばかりで本文が少ない文書を検出
- **計算**:
  - ヘッダー行数: `#`, `-`, `|`, `>`, `*`で始まる行
  - 本文行数: 上記以外の非空白行
  - コンテンツ比率 = 本文行数 / 総行数
- **閾値**: コンテンツ比率 ≥ 60%
- **エラーメッセージ**: 「本文の比率が低すぎます（{比率}%、最小60%）」

#### FR-3-3: Mermaid図の構文検証
- **対象**: state-machine.mmd, flowchart.mmd
- **検証項目**:
  - stateDiagram-v2: 状態数 ≥ 3、遷移数 ≥ 2
  - flowchart: ノード数 ≥ 3、エッジ数 ≥ 2
- **検証ロジック**:
  1. `[*]`（初期状態）以外の状態宣言をカウント
  2. `-->`で遷移をカウント
  3. 閾値未満ならエラー
- **エラーメッセージ**: 「Mermaid図が不十分です（状態数: {数}, 最小3）」

#### FR-3-4: 禁止パターンの強化
- **既存パターン**: TODO, TBD, 後で, あとで, 仮実装, 一旦
- **追加パターン**:
  - 大文字小文字バリエーション: `todo`, `tbd`, `TODO`, `TBD`
  - スペース挿入: `T O D O`, `後 で`
  - 全角英数字: `ТОＤ０`
- **検証ロジック**: 正規表現で大文字小文字を無視、スペースを許容
- **例**: `/t\s*o\s*d\s*o/i`, `/後\s*で/`

#### FR-3-5: 検証対象ファイル
- **requirements.md**: セクション最小文字数、コンテンツ比率、禁止パターン
- **spec.md**: セクション最小文字数、コンテンツ比率、禁止パターン
- **state-machine.mmd**: Mermaid図構文検証
- **flowchart.mmd**: Mermaid図構文検証
- **test-design.md**: セクション最小文字数、禁止パターン

### 非機能要件

#### NFR-3-1: パフォーマンス
- 検証処理は1ファイルあたり100ms以内
- 大規模ファイル（10,000行超）でも500ms以内

#### NFR-3-2: ログ出力
- 検証開始時: 「Validating artifact quality: {ファイル名}」
- 検証失敗時: 各エラーを箇条書きで出力
- 検証成功時: 「Artifact quality validation passed」

#### NFR-3-3: エラーの詳細度
- セクション名、行番号、検出パターンを含む詳細なエラーメッセージ
- ユーザーが修正箇所を特定しやすい情報を提供

### 受入条件

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| AC-3-1 | 見出しのみで本文が空のセクションがあるspec.md | エラー「セクション'XXX'の本文が不十分です」 |
| AC-3-2 | 各セクション50文字以上の本文があるspec.md | 検証成功 |
| AC-3-3 | ヘッダー行90%、本文行10%のrequirements.md | エラー「本文の比率が低すぎます（10%）」 |
| AC-3-4 | 状態1個、遷移0個のstate-machine.mmd | エラー「Mermaid図が不十分です（状態数: 1）」 |
| AC-3-5 | 状態4個、遷移3個のstate-machine.mmd | 検証成功 |
| AC-3-6 | 「T O D O」（スペース挿入）を含むspec.md | エラー「禁止パターン検出: TODO」 |
| AC-3-7 | 「todo」（小文字）を含むrequirements.md | エラー「禁止パターン検出: TODO」 |

### 制約事項
- コードブロック内のTODOは検証対象外（false positive防止）
- Mermaid図のコメント行は検証対象外

---

## REQ-4: テスト回帰チェックの実装

### 目的
テスト数の減少やパス率の低下を検出し、品質低下を防止する。

### 背景
現在のtesting/regression_test遷移チェックは`exitCode === 0`のみであり、以下の問題が存在：
- テスト数が0件でもexitCode=0なら通過
- 前回100件だったテストが今回10件でも検出されない
- パス率が100%から50%に低下しても検出されない
- `TestBaseline`型は定義済だが、実際には使用されていない

### 機能要件

#### FR-4-1: testBaselineの必須化
- **条件**: testing → regression_test 遷移時
- **検証**: `taskState.testBaseline`が存在するか
- **未設定時**: エラー「テストベースラインが設定されていません。testingフェーズでテストを実行してください」

#### FR-4-2: テスト総数の回帰チェック
- **条件**: regression_test → parallel_verification 遷移時
- **検証**: `latestTestResult.totalCount >= testBaseline.totalCount`
- **失敗時**: エラー「テスト総数が減少しています（baseline: {baseline}, current: {current}）」

#### FR-4-3: パスしたテスト数の回帰チェック
- **条件**: regression_test → parallel_verification 遷移時
- **検証**: `latestTestResult.passedCount >= testBaseline.passedCount`
- **失敗時**: エラー「パスしたテスト数が減少しています（baseline: {baseline}, current: {current}）」

#### FR-4-4: テスト結果の必須フィールド
- **対象**: `latestTestResult`
- **必須フィールド**:
  - `totalCount`: テスト総数（number）
  - `passedCount`: パスしたテスト数（number）
  - `failedCount`: 失敗したテスト数（number）
  - `exitCode`: 終了コード（number）
- **検証**: いずれかが未定義の場合はエラー

#### FR-4-5: testBaselineの自動設定
- **タイミング**: testingフェーズ完了時（testing → regression_test 遷移時）
- **条件**: `exitCode === 0` かつ `totalCount > 0`
- **設定内容**:
  ```typescript
  taskState.testBaseline = {
    totalCount: latestTestResult.totalCount,
    passedCount: latestTestResult.passedCount,
    timestamp: new Date().toISOString()
  };
  ```

### 非機能要件

#### NFR-4-1: ログ出力
- baseline設定時: 「Test baseline set: {totalCount} tests, {passedCount} passed」
- 回帰検出時: 「Test regression detected: {詳細}」

#### NFR-4-2: 回帰許容モード（オプション）
- 環境変数`TEST_REGRESSION_STRICT=false`で警告のみに変更
- デフォルトは厳格モード（エラー）

#### NFR-4-3: baseline更新
- testingフェーズを再実行するたびにbaselineを更新
- 手動でbaselineをリセットする機能は本要件のスコープ外

### 受入条件

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| AC-4-1 | testBaselineが未設定でtesting→regression_test遷移 | エラー「テストベースラインが設定されていません」 |
| AC-4-2 | testing完了時、exitCode=0、totalCount=50 | testBaseline設定（totalCount=50） |
| AC-4-3 | regression_testでtotalCount=30、baseline=50 | エラー「テスト総数が減少しています」 |
| AC-4-4 | regression_testでpassedCount=40、baseline=50 | エラー「パスしたテスト数が減少しています」 |
| AC-4-5 | regression_testでtotalCount=50、passedCount=50、baseline=50 | 遷移成功 |
| AC-4-6 | regression_testでtotalCount=60、passedCount=60、baseline=50 | 遷移成功（増加は許容） |
| AC-4-7 | latestTestResultにpassedCountフィールドなし | エラー「テスト結果に必須フィールドがありません」 |

### 制約事項
- カバレッジ率のチェックは本要件のスコープ外
- テストスイート別の詳細な回帰分析は本要件のスコープ外

---

## REQ-5: スコープ事後検証（git diff照合）

### 目的
実際の変更ファイルがスコープ宣言と一致することを検証し、AI申告と実変更の乖離を検出する。

### 背景
現在の`workflowSetScope()`は以下のみチェック：
- ファイル存在確認
- ディレクトリ深度
- ファイルサイズ

実装後の実際の変更ファイルとの照合はなく、以下の問題が存在：
- AIがスコープに「src/feature/login.ts」と申告
- 実際には「src/feature/auth.ts」「src/utils/crypto.ts」も変更
- スコープ外の変更を検出できない

### 機能要件

#### FR-5-1: commit遷移時のスコープ照合
- **タイミング**: docs_update → commit 遷移時
- **検証ロジック**:
  1. `git diff --name-only HEAD`で変更ファイル一覧を取得
  2. `taskState.scope.files`と照合
  3. スコープ外ファイルの変更を検出
  4. 検出されたファイルをリストアップ

#### FR-5-2: 厳格モードでのブロック
- **条件**: 環境変数`SCOPE_STRICT=true`
- **動作**: スコープ外ファイル変更があればcommit遷移をブロック
- **エラーメッセージ**: 「スコープ外のファイルが変更されています: {ファイルリスト}」

#### FR-5-3: 警告モード（デフォルト）
- **条件**: 環境変数`SCOPE_STRICT`が未設定または`false`
- **動作**: スコープ外ファイル変更があれば警告を出すが遷移は許可
- **警告メッセージ**: 「警告: スコープ外のファイルが変更されています: {ファイルリスト}。commit前に確認してください」

#### FR-5-4: 除外パターン
- **対象**: 以下のファイルはスコープ外でも警告しない
  - `package.json`, `package-lock.json`, `pnpm-lock.yaml`（依存関係）
  - `*.md`（ドキュメント）
  - `.claude/state/**/*`（ワークフロー内部状態）
  - `docs/workflows/**/*`（ワークフロー成果物）
- **理由**: これらは実装に伴う自然な変更

#### FR-5-5: 未コミット変更の検出
- **検証**: `git status --porcelain`でステージング済み・未ステージングの変更を取得
- **用途**: スコープ照合に使用（HEADとの差分だけでなく作業ディレクトリの変更も含む）

### 非機能要件

#### NFR-5-1: Gitリポジトリ検証
- スコープ照合前に`.git`ディレクトリの存在を確認
- Gitリポジトリでない場合はスキップ（エラーにしない）

#### NFR-5-2: ログ出力
- スコープ照合開始時: 「Verifying scope consistency...」
- スコープ外ファイル検出時: 「Out-of-scope changes detected: {ファイルリスト}」
- スコープ一致時: 「Scope verification passed」

#### NFR-5-3: パフォーマンス
- git diffコマンド実行は500ms以内
- ファイル数が1000個を超える場合でも1秒以内

### 受入条件

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| AC-5-1 | スコープ: [a.ts]、実変更: [a.ts]、SCOPE_STRICT未設定 | 遷移成功、警告なし |
| AC-5-2 | スコープ: [a.ts]、実変更: [a.ts, b.ts]、SCOPE_STRICT未設定 | 遷移成功、警告「b.tsがスコープ外」 |
| AC-5-3 | スコープ: [a.ts]、実変更: [a.ts, b.ts]、SCOPE_STRICT=true | エラー「スコープ外のファイルが変更されています: b.ts」 |
| AC-5-4 | スコープ: [a.ts]、実変更: [a.ts, package.json] | 遷移成功、警告なし（除外パターン） |
| AC-5-5 | スコープ: [a.ts]、実変更: [a.ts, docs/workflows/xxx.md] | 遷移成功、警告なし（除外パターン） |
| AC-5-6 | Gitリポジトリでないディレクトリ | スコープ検証スキップ、遷移成功 |

### 制約事項
- ファイルのリネーム検出は本要件のスコープ外（git diff --name-statusで対応可能だが複雑化）
- サブモジュールの変更検出は本要件のスコープ外

---

## REQ-6: subagentのフェーズ遷移ブロック（セッショントークン方式）

### 目的
subagentがworkflow_next等のフェーズ遷移APIを呼び出すのを技術的にブロックし、Orchestrator（メインClaude）のみが制御できるようにする。

### 背景
現在のMCPサーバーには呼び出し元を識別する機構がなく、以下の問題が存在：
- subagentがworkflow_nextを呼び出してフェーズをスキップ可能
- subagentがworkflow_resetを呼び出してタスクをリセット可能
- プロンプトのみで制御しており、技術的な強制力がない

### 機能要件

#### FR-6-1: セッショントークンの生成
- **タイミング**: `workflow_start`実行時
- **生成方法**: `crypto.randomBytes(32).toString('hex')`（64文字の16進数文字列）
- **保存先**: `taskState.sessionToken`
- **返却**: workflow_startのレスポンスに含める
- **例**:
  ```json
  {
    "taskId": "abc123",
    "sessionToken": "a1b2c3d4...（64文字）",
    "message": "ワークフロー開始しました"
  }
  ```

#### FR-6-2: フェーズ遷移APIへのトークン検証追加
- **対象API**:
  - `workflow_next`
  - `workflow_approve`
  - `workflow_reset`
  - `workflow_start`（新規タスク作成時は不要、既存タスク再開時は必要）
- **新規引数**: `sessionToken: string`（必須）
- **検証ロジック**:
  1. `taskState.sessionToken`と引数`sessionToken`を比較
  2. 不一致または未指定の場合はエラー
  3. 一致の場合のみ処理続行

#### FR-6-3: エラー処理
- **トークン未指定**: エラー「sessionTokenが必要です」
- **トークン不一致**: エラー「sessionTokenが無効です」
- **タスク存在しない**: エラー「タスクが見つかりません」（既存動作維持）

#### FR-6-4: トークン不要なAPI
- **対象**: 以下のAPIはトークン不要（読み取り専用）
  - `workflow_status`
  - `workflow_list`
  - `workflow_get_scope`
- **理由**: subagentが状態を確認することは許可

#### FR-6-5: トークンのセキュリティ
- **保存**: taskState.jsonにプレーンテキストで保存（ファイルシステム権限で保護）
- **送信**: MCPプロトコル経由でのみ送信（HTTPS等のトランスポート層で保護）
- **有効期限**: タスク完了までトークンは不変（再生成なし）

### 非機能要件

#### NFR-6-1: 後方互換性
- 既存のタスク（sessionTokenなし）に対しては警告を出すがブロックしない
- 環境変数`SESSION_TOKEN_STRICT=false`で緩和モード有効（デフォルトは厳格）

#### NFR-6-2: ログ出力
- トークン生成時: 「Session token generated for task {taskId}」
- トークン検証失敗時: 「Session token verification failed for task {taskId}」
- トークン検証成功時: ログなし（パフォーマンス考慮）

#### NFR-6-3: エラーメッセージの明確性
- Orchestratorへの指示: 「このAPIはOrchestratorのみ実行可能です。subagentから呼び出さないでください」
- 開発者向け詳細: トークンの生成方法、保存場所をドキュメント化

### 受入条件

| ID | テストケース | 期待結果 |
|----|-------------|---------|
| AC-6-1 | workflow_start実行 | sessionTokenが返却される |
| AC-6-2 | workflow_next（sessionToken未指定） | エラー「sessionTokenが必要です」 |
| AC-6-3 | workflow_next（sessionToken不一致） | エラー「sessionTokenが無効です」 |
| AC-6-4 | workflow_next（sessionToken一致） | 遷移成功 |
| AC-6-5 | workflow_approve（sessionToken未指定） | エラー「sessionTokenが必要です」 |
| AC-6-6 | workflow_reset（sessionToken一致） | リセット成功 |
| AC-6-7 | workflow_status（sessionTokenなし） | 正常に状態を返す |
| AC-6-8 | 既存タスク（sessionTokenなし）にworkflow_next | 警告を出すが遷移成功（緩和モード） |
| AC-6-9 | SESSION_TOKEN_STRICT=true、既存タスクにworkflow_next | エラー「sessionTokenが必要です」 |

### 制約事項
- トークンのローテーション（定期的な再生成）は本要件のスコープ外
- 複数Orchestratorによる同時制御は本要件のスコープ外
- トークンの暗号化保存は本要件のスコープ外（将来的な拡張として検討）

---

## 優先順位

以下の順序で実装することを推奨：

1. **REQ-6（セッショントークン）**: 最も重要なセキュリティ強化
2. **REQ-1（HMAC署名検証）**: データ整合性の基盤
3. **REQ-2（複数承認ゲート）**: 品質ゲートの強化
4. **REQ-4（テスト回帰チェック）**: 品質低下防止
5. **REQ-3（成果物品質検証）**: AIの出力品質向上
6. **REQ-5（スコープ事後検証）**: 最も影響範囲が限定的

---

## 依存関係

```
REQ-6（トークン）
  ↓
REQ-1（HMAC） ← REQ-2（承認ゲート）
  ↓              ↓
REQ-4（テスト回帰） → REQ-3（成果物検証）
                       ↓
                    REQ-5（スコープ検証）
```

- REQ-6は他の全ての要件の前提（セキュリティ基盤）
- REQ-1とREQ-2は並行実装可能
- REQ-4はREQ-1のデータ整合性に依存
- REQ-3とREQ-5は独立だが、REQ-4の後が望ましい

---

## リスクと対策

### リスク1: HMAC厳格化による既存タスクの読み込み不可
- **影響度**: 高
- **対策**: 緩和モード（`HMAC_STRICT=false`）を提供、移行手順をドキュメント化

### リスク2: 承認ゲート追加による開発速度低下
- **影響度**: 中
- **対策**: 承認スキップモード（開発環境のみ）の検討、承認基準の明確化

### リスク3: セッショントークン導入による既存ワークフローの破壊
- **影響度**: 高
- **対策**: 緩和モード（`SESSION_TOKEN_STRICT=false`）、既存タスクへの自動トークン付与

### リスク4: 成果物検証の厳格化によるfalse positive
- **影響度**: 中
- **対策**: 検証ルールの段階的導入、除外パターンの充実

---

## 成功基準

1. **セキュリティ**: subagentによるフェーズスキップが技術的に不可能
2. **データ整合性**: 改ざんされた状態ファイルが確実に検出される
3. **品質ゲート**: 要件定義、テスト設計、コードレビューで品質が担保される
4. **品質維持**: テスト数・パス率の低下が自動検出される
5. **成果物品質**: 形式的な文書が自動検出され、実用的な内容が保証される
6. **スコープ整合性**: AI申告と実変更の乖離が可視化される

---

## 関連ドキュメント

- `docs/workflows/ワークフロー構造的問題完全解決/research.md`: 調査結果
- `mcp-server/src/state/manager.ts`: 状態管理実装
- `mcp-server/src/validation/artifact-validator.ts`: 成果物検証実装
- `mcp-server/src/tools/next.ts`: フェーズ遷移ロジック
