# ワークフロー実行時バグ修正 - UI/インターフェース設計

## サマリー

本ドキュメントはワークフロー実行時バグ修正タスクのUI・インターフェース設計書です。
対象システムはMCP Serverとフックシステムで構成されるバックエンドのみであり、グラフィカルなUIは存在しません。
代わりにMCPツールのCLIインターフェース、エラーメッセージ、APIレスポンス、設定ファイルスキーマを設計します。

- 目的: FQ-1からFQ-4の4バグ修正に伴い、各インターフェースが正しく動作することを仕様として明確化する
- 主要な決定事項: FQ-1ではworkflow_nextの成功レスポンス条件を明確化、FQ-2ではhasRedirectionの判定ロジックを設計、FQ-3ではallowedBashCategoriesのスキーマを統一、FQ-4ではpushフェーズのsubagentTemplateインターフェースを拡張する
- 次フェーズで必要な情報: 各MCPツールのレスポンス形式（成功/失敗）、エラーメッセージの文言、allowedBashCategoriesの正しい値を参照すること

---

## CLIインターフェース設計

### workflow_next ツールのインターフェース

`workflow_next` はworkflowフェーズを次のフェーズへ進めるMCPツールです。
FQ-1の修正により、testingフェーズからの遷移時にハッシュ重複チェックがスキップされます。
このツールはtaskIdとoptionalなsessionTokenを引数として受け取ります。

引数スキーマ（TypeScript型として記述）:
```typescript
interface WorkflowNextInput {
  taskId?: string;         // タスクID（省略時はアクティブタスクを自動選択）
  sessionToken?: string;   // Orchestratorセッション認証トークン
  forceTransition?: boolean; // ベースライン未設定時の強制遷移フラグ（regression_test専用）
}
```

testingフェーズでの呼び出し例（FQ-1修正後の動作）:
```
1. subagentが workflow_record_test_result を呼び出す
2. subagentが workflow_next を呼び出す（ハッシュ重複チェックはスキップされる）
3. フェーズがtestingからregression_testへ正常に遷移する
```

### workflow_record_test_result ツールのインターフェース

`workflow_record_test_result` はテスト実行結果をタスク状態に記録するMCPツールです。
FQ-1の修正後も、このツール自体の動作は変更されません。
記録されたテスト結果はtestOutputHashesに蓄積され、後続フェーズの重複チェックに利用されます。

引数スキーマ:
```typescript
interface RecordTestResultInput {
  taskId: string;    // タスクID（必須）
  exitCode: number;  // テスト終了コード（0が成功）
  output: string;    // テスト出力全文（50文字以上必須）
  summary?: string;  // テスト結果サマリー（省略可）
}
```

testingフェーズ完了後のデータフロー:
- exitCodeが0のとき: テスト成功として記録し、次フェーズへの遷移を許可する
- exitCodeが非0のとき: テスト失敗として記録し、次フェーズへの遷移前に確認を促す

### workflow_next の呼び出しシーケンス（FQ-1修正後）

testingフェーズにおけるworkflow_nextの動作フローを示します。

```
workflow_next(taskId) が呼ばれる
  ↓
currentPhase を取得（"testing"）
  ↓
testResult のバリデーション（test-authenticityチェックは継続）
  ↓
ハッシュ重複チェック: currentPhase が "testing" または "regression_test" の場合はスキップ
  ↓（スキップ）
フェーズ遷移ロジックへ進む
  ↓
"regression_test" フェーズへ正常遷移
```

---

## エラーメッセージ設計

### FQ-1: ハッシュ重複チェックエラーメッセージ

FQ-1修正後、testingフェーズでは以下のエラーは発生しなくなります。
testingフェーズおよびregression_testフェーズ以外のフェーズでのみ、このエラーメッセージが表示されます。

既存エラーメッセージ（testingフェーズ以外で引き続き使用）:
```
テスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。
```

このエラーが表示される条件:
- フェーズが "testing" でも "regression_test" でもないこと
- testOutputHashesにすでに同一ハッシュが存在すること
- testStrictフラグがtrueであること（デフォルト）

修正前にtestingフェーズで誤って表示されていたエラーの説明:
修正前は `record_test_result` の直後に `workflow_next` を呼ぶと、直前に記録したハッシュを自分自身と比較するため常に重複と判定されていました。修正後はtestingフェーズでこのチェックをスキップするため、上記エラーは表示されなくなります。

### FQ-2: リダイレクト誤検出エラーメッセージ

bash-whitelist.jsの `hasRedirection` 関数の修正前後でエラーメッセージは変化しません。
変更されるのはエラーが発生するトリガー条件であり、誤検出が排除される点が改善内容です。

リダイレクト誤検出時のエラーメッセージ（既存、変更なし）:
```
ブロックされたコマンド: {コマンド文字列}
理由: リダイレクトを含むコマンドは許可されていません (awk-redirect)
```

修正前に誤検出されていたコマンドの例:
- `awk 'NR >= 2' file` は `>=` を含むためブロックされていたが、修正後はブロックされない
- `node -e "if (a >= 0) { console.log(a); }"` も同様に修正後は通過する

修正後も正しくブロックされるコマンドの例:
- `echo hello > output.txt` はリダイレクトとして正しく検出され続ける
- `cat file >> log.txt` は追記リダイレクトとして正しく検出され続ける

### FQ-4: detached HEAD状態エラーメッセージ

pushフェーズのsubagentTemplateに追加されたdetached HEAD検出時の報告メッセージを設計します。
subagentがこの状態を検出した場合に報告する内容は以下の通りです。

```
エラー: detached HEAD状態のためpushを中止しました。
検出方法: git branch --show-current の出力が空文字でした。
対処方法: git checkout {ブランチ名} でブランチに切り替えてからpushしてください。
```

このエラーは親リポジトリとサブモジュールのどちらに対しても報告される構成です。
detached HEAD状態での誤ったpushを防ぐ安全装置として機能します。

---

## APIレスポンス設計

### workflow_next の成功レスポンス形式

FQ-1修正後、testingフェーズからの正常遷移時に返されるレスポンスの形式を示します。

成功レスポンス（testingフェーズからregression_testへ遷移した場合）:
```typescript
interface WorkflowNextSuccess {
  success: true;
  message: string;          // 例: "testing フェーズを完了しました。次のフェーズ: regression_test"
  previousPhase: string;    // 遷移前のフェーズ名: "testing"
  currentPhase: string;     // 遷移後のフェーズ名: "regression_test"
  remainingPhases: string[]; // 残りのフェーズ名一覧
}
```

具体的なレスポンス例（testingフェーズ完了時）:
```json
{
  "success": true,
  "message": "testing フェーズを完了しました。次のフェーズ: regression_test",
  "previousPhase": "testing",
  "currentPhase": "regression_test",
  "remainingPhases": ["regression_test", "parallel_verification", "docs_update", "commit", "push", "ci_verification", "deploy", "completed"]
}
```

### workflow_next の失敗レスポンス形式

バリデーション失敗時に返されるレスポンスの形式を示します。
FQ-1修正後もtestingフェーズ以外でのハッシュ重複検出エラーはこの形式で返されます。

失敗レスポンス（ハッシュ重複検出時、testing/regression_testフェーズ以外）:
```typescript
interface WorkflowNextFailure {
  success: false;
  message: string;  // エラーの説明文
  phase: string;    // 現在のフェーズ名
  hint?: string;    // 修正方法のヒント（省略可）
}
```

具体的な失敗レスポンス例（テスト出力が以前と同一の場合）:
```json
{
  "success": false,
  "message": "テスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。",
  "phase": "some_other_phase",
  "hint": "新しいテストを実行して workflow_record_test_result を呼び直してください"
}
```

### workflow_record_test_result の成功レスポンス形式

testingフェーズでテスト結果を記録した後に返されるレスポンスの形式です。
このツールのレスポンス形式自体はFQ-1の修正で変更されません。

```typescript
interface RecordTestResultResponse {
  success: true;
  message: string;       // 例: "テスト結果を記録しました"
  exitCode: number;      // 記録したexitCode（0が成功）
  hashRecorded: boolean; // ハッシュが記録されたかどうか
}
```

---

## 設定ファイル設計

### definitions.ts の allowedBashCategories スキーマ

FQ-3の修正対象であるdefinitions.tsのallowedBashCategoriesフィールドのスキーマを定義します。
このフィールドはフェーズ定義の一部として、subagentへ送信するプロンプトに埋め込まれる許可カテゴリを規定します。

フェーズ定義のスキーマ（allowedBashCategoriesに関連する部分）:
```typescript
type BashCategory = 'readonly' | 'testing' | 'implementation' | 'git';

interface PhaseDefinition {
  name: string;
  allowedBashCategories: BashCategory[];  // FQ-3修正後の正しい型
  subagentTemplate?: string;              // subagentへ送信するプロンプトテンプレート
  // その他フィールドは省略
}
```

各フェーズの正しいallowedBashCategories設定値（FQ-3修正後）:
```
commit フェーズ: ['readonly', 'git']       ← 修正: 'implementation' を 'git' に変更
push   フェーズ: ['readonly', 'git']       ← 修正: 'implementation' を 'git' に変更
```

gitカテゴリに含まれるコマンド（参照用）:
```
git add, git commit, git push, git pull, git fetch, git branch, git status, git log, git diff
```

### allowedBashCategories のフェーズ別設定表（修正後の完全版）

ドキュメント・フック・フェーズ定義の三者が一致すべき設定を以下に示します。
この表はCLAUDE.mdの「フェーズ別Bashコマンド許可カテゴリ」セクションと整合している必要があります。

```
research          : ['readonly']
requirements      : ['readonly']
threat_modeling   : ['readonly']
planning          : ['readonly']
state_machine     : ['readonly']
flowchart         : ['readonly']
ui_design         : ['readonly']
design_review     : ['readonly']
test_design       : ['readonly']
code_review       : ['readonly']
manual_test       : ['readonly']
docs_update       : ['readonly']
test_impl         : ['readonly', 'testing']
testing           : ['readonly', 'testing']
regression_test   : ['readonly', 'testing']
security_scan     : ['readonly', 'testing']
performance_test  : ['readonly', 'testing']
e2e_test          : ['readonly', 'testing']
ci_verification   : ['readonly']
implementation    : ['readonly', 'testing', 'implementation']
refactoring       : ['readonly', 'testing', 'implementation']
build_check       : ['readonly', 'testing', 'implementation']
commit            : ['readonly', 'git']   ← FQ-3修正後の正しい値
push              : ['readonly', 'git']   ← FQ-3修正後の正しい値
deploy            : ['readonly']
```

### pushフェーズ subagentTemplate の設計（FQ-4）

FQ-4で追加されるpushフェーズのsubagentTemplateの設計を示します。
テンプレートには動的プレースホルダーとして波括弧形式（{変数名}）を使用します。
以下のプレースホルダーが展開されてsubagentへ送信されます。

テンプレート変数の定義:
```typescript
interface PushSubagentTemplateVariables {
  userIntent: string;    // ユーザーの意図（タスク開始時に設定された値）
  docsDir: string;       // ドキュメント出力先ディレクトリのパス
  taskName: string;      // タスク名（ワークフロー開始時に設定された名前）
}
```

subagentTemplateの構造設計（FQ-4修正後）:
```
セクション1: タスク情報（userIntentとdocsDir）
セクション2: 作業内容（リモートリポジトリへのpush）
セクション3: ブランチ確認と実行手順（FQ-4で追加）
  ステップ1: git branch --show-current でカレントブランチ名を確認
  ステップ2: 確認したブランチ名を使って git push origin を実行
  ステップ3: サブモジュールが存在する場合は各サブモジュールのブランチも確認してpush
セクション4: 注意事項（ブランチ名のハードコード禁止）
```

detached HEAD状態の検出ロジック設計:
- `git branch --show-current` の出力が空文字列の場合をdetached HEAD状態と判断する
- detached HEAD状態が検出された場合はpushを中止してエラーを報告する
- サブモジュールについても同様の検出を行い、個別に報告する
