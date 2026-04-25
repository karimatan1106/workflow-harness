# UI設計書: Critical Issues C1-C3根本解決

## サマリー

本UI設計書は、CLIツールであるワークフローMCPサーバーのインターフェース改善を定義します。
C-1ではworkflow_nextレスポンスにuserIntentガイダンスとsubagentTemplateを追加し、Orchestratorへの情報提供を強化します。
C-2ではworkflow_complete_sub（code_review完了時）とworkflow_next（parallel_quality通過時）にdesign-validatorの結果を統合し、未実装項目の通過を防止します。
C-3ではworkflow_next（testing通過時、regression_test通過時）にtest-authenticityの結果を統合し、形骸化テストの通過を防止します。
全てのバリデーション失敗時には厳格モード（ブロック）と警告モード（続行可能）の2段階で対応し、環境変数により切り替え可能とします。
エラーメッセージには具体的な修正ガイダンスを含め、開発者がすぐに問題を解決できる情報を提供します。

---

## CLIインターフェース設計

### workflow_next レスポンスメッセージ（C-1対応）

workflow_next成功時のレスポンスメッセージに、以下の要素を追加します。

#### 基本構造

レスポンスメッセージは3つのセクションで構成されます。
第1セクションではフェーズ遷移の成功を報告し、現在のフェーズ名と次のフェーズ名を明示します。
第2セクションではuserIntentガイダンスとして、ユーザーの意図をsubagentプロンプトに埋め込むことの重要性を説明します。
第3セクションではsubagentTemplateを提示し、具体的なプロンプト例をコードブロックで表示します。

#### メッセージフォーマット例

成功メッセージの第1行には「フェーズ遷移: research → requirements」のような形式で表示します。
第2段落では「重要: ユーザーの意図（userIntent）をsubagentプロンプトに必ず含めてください」という警告文を表示します。
続けて「userIntentには以下の内容が含まれています:」として、実際のuserIntent文字列を引用ブロックで表示します。
第3段落では「推奨されるTask toolプロンプトテンプレート:」という見出しの後、MarkdownコードブロックでsubagentTemplateの内容を表示します。
テンプレート内のプレースホルダー（taskNameやuserIntentなど）は既に実際の値に置換された状態で表示されます。

#### レスポンスJSON構造（phaseGuideフィールド）

StatusResult型のレスポンスにphaseGuideフィールドが追加されます。
phaseGuideオブジェクトにはphaseName、description、requiredSections、outputFile、allowedBashCategories、そしてsubagentTemplateが含まれます。
subagentTemplateフィールドには、プレースホルダーが置換済みの完全なプロンプトテンプレート文字列が格納されます。
Orchestratorは、このsubagentTemplateをTask tool呼び出しのprompt引数として直接使用できます。

---

### workflow_complete_sub レスポンスメッセージ（C-2対応）

workflow_complete_sub成功時（特にcode_reviewサブフェーズ完了時）のレスポンスメッセージに、design-validatorの検証結果を統合します。

#### 検証成功時のメッセージ

第1行では「サブフェーズ完了: code_review」のように表示します。
第2段落では「設計-実装整合性検証: 完了」という見出しの後、検証結果のサマリーを表示します。
サマリーには「全ての設計項目が実装されています」や「検証項目: spec.md（全項目実装済み）、state-machine.mmd（全遷移実装済み）、flowchart.mmd（全フロー実装済み）」のような具体的な情報を含めます。
最終行では「次のフェーズに進む準備ができました」と表示します。

#### 検証失敗時（厳格モード）のメッセージ

検証失敗時のメッセージについては、後述の「エラーメッセージ設計」セクションで詳述します。

---

## エラーメッセージ設計

### C-2: design-validator失敗時のエラーメッセージ

#### 厳格モード（DESIGN_VALIDATION_STRICT=true、デフォルト）

エラーメッセージは5つのセクションで構成されます。

**第1セクション: エラー通知**
冒頭には「エラー: 設計-実装整合性検証に失敗しました」という明確なエラー表明を配置します。
次の行では「フェーズ遷移がブロックされました」と表示し、続行不可能であることを明示します。

**第2セクション: 失敗理由**
「失敗理由:」という見出しの後、具体的な未実装項目をリスト形式で表示します。
例として「spec.mdの未実装項目: 3件」や「状態遷移図の未実装遷移: 2件」のように、ドキュメント別に分類して表示します。
各項目には具体的な未実装内容（例: 「ユーザー認証API」「ログイン→ホーム画面遷移」など）を含めます。

**第3セクション: 未実装項目詳細**
「詳細:」という見出しの後、各ドキュメントから抽出された未実装項目を階層的に表示します。
spec.mdからの抽出項目は「機能: ユーザー認証API」「エンドポイント: POST /api/auth/login」のように具体的に記載します。
state-machine.mmdからの抽出項目は「状態遷移: ログイン中 → 認証済み」のように遷移の始点と終点を明示します。
flowchart.mmdからの抽出項目は「処理フロー: パスワード検証 → トークン生成」のように処理ステップを明示します。

**第4セクション: 修正ガイダンス**
「修正方法:」という見出しの後、具体的な対応手順を番号付きリストで表示します。
手順1では「未実装項目を実装してください」と指示し、具体的なファイル名を列挙します。
手順2では「実装後、再度code_reviewサブフェーズを実行してください」と指示します。
手順3では「または、設計内容に誤りがある場合は /workflow back design を実行して設計フェーズに戻ってください」という代替案を提示します。

**第5セクション: 警告モードへの切り替え方法**
「注: 環境変数 DESIGN_VALIDATION_STRICT=false を設定すると、警告モードに切り替わり続行可能になります」という情報を提供します。

#### 警告モード（DESIGN_VALIDATION_STRICT=false）

警告メッセージは厳格モードと類似の構造を持ちますが、冒頭のメッセージが異なります。
第1行では「警告: 設計-実装整合性検証で問題が検出されました」と表示します。
第2行では「フェーズ遷移は続行可能ですが、修正を推奨します」と表示し、ブロックされないことを明示します。
第2セクション以降（失敗理由、詳細、修正ガイダンス）は厳格モードと同じ内容を表示します。
最終行には「続行する場合は /workflow next を再度実行してください」という指示を追加します。

---

### C-3: test-authenticity失敗時のエラーメッセージ

#### 厳格モード（TEST_AUTHENTICITY_STRICT=true、デフォルト）

エラーメッセージは5つのセクションで構成されます。

**第1セクション: エラー通知**
冒頭には「エラー: テスト実行の真正性検証に失敗しました」という明確なエラー表明を配置します。
次の行では「フェーズ遷移がブロックされました」と表示し、続行不可能であることを明示します。

**第2セクション: 失敗理由**
「失敗理由:」という見出しの後、具体的な検証失敗内容をリスト形式で表示します。
例として「testingフェーズ開始時刻: 2026-02-17T10:00:00Z」「最新のBash実行時刻: 2026-02-17T09:55:00Z」のように、時系列情報を提供します。
結論として「Bash実行がtestingフェーズ開始より前のため、テストが実行されていません」のように判定結果を説明します。

**第3セクション: 検出された問題**
「検出された問題:」という見出しの後、具体的な問題内容を箇条書きで表示します。
例として「testingフェーズ中にBash実行が記録されていません」や「workflow_record_test_result呼び出しが記録されていません」のように、欠落している証拠を列挙します。

**第4セクション: 修正ガイダンス**
「修正方法:」という見出しの後、具体的な対応手順を番号付きリストで表示します。
手順1では「testingフェーズ中に実際にテストを実行してください（npm test、vitest、jestなど）」と指示します。
手順2では「テスト実行後、workflow_record_test_result を呼び出して結果を記録してください」と指示します。
手順3では「または、testingフェーズに戻る場合は /workflow back testing を実行してください」という代替案を提示します。

**第5セクション: 警告モードへの切り替え方法**
「注: 環境変数 TEST_AUTHENTICITY_STRICT=false を設定すると、警告モードに切り替わり続行可能になります」という情報を提供します。

#### 警告モード（TEST_AUTHENTICITY_STRICT=false）

警告メッセージは厳格モードと類似の構造を持ちますが、冒頭のメッセージが異なります。
第1行では「警告: テスト実行の真正性検証で問題が検出されました」と表示します。
第2行では「フェーズ遷移は続行可能ですが、テスト実行を推奨します」と表示し、ブロックされないことを明示します。
第2セクション以降（失敗理由、検出された問題、修正ガイダンス）は厳格モードと同じ内容を表示します。
最終行には「続行する場合は /workflow next を再度実行してください」という指示を追加します。

---

## APIレスポンス設計

### StatusResult型の拡張（C-1対応）

StatusResult型にphaseGuideフィールドを追加します。

#### TypeScript型定義

```typescript
interface StatusResult {
  success: boolean;
  message: string;
  taskId?: string;
  taskName?: string;
  phase?: string;
  subPhase?: string | null;
  completedSubPhases?: string[];
  remainingSubPhases?: string[];
  requiresApproval?: boolean;
  phaseGuide?: PhaseGuide;  // 新規追加
}

interface PhaseGuide {
  phaseName: string;
  description: string;
  requiredSections?: string[];
  outputFile?: string;
  allowedBashCategories?: string[];
  subagentTemplate?: string;  // 新規追加（C-1対応）
}
```

#### フィールド説明

phaseGuideフィールドはオプショナルで、フェーズ遷移成功時にのみ含まれます。
phaseGuide.subagentTemplateには、プレースホルダーが置換済みの完全なプロンプトテンプレートが格納されます。
Orchestratorは、このテンプレートをTask tool呼び出しのprompt引数としてそのまま使用できます。
subagentTemplateが含まれない場合（古いバージョンとの互換性維持）でも、既存のフローは影響を受けません。

---

### ValidationResult型（C-2, C-3対応）

design-validatorとtest-authenticityの結果を統一的に扱うため、ValidationResult型を定義します。

#### TypeScript型定義

```typescript
interface ValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
  details?: Record<string, any>;
}
```

#### フィールド説明

validフィールドは検証が成功したか否かを示すブール値です。
errorsフィールドには検証エラーメッセージの配列が格納され、厳格モード時のブロック理由として使用されます。
warningsフィールドには警告メッセージの配列が格納され、警告モード時の情報提供に使用されます。
detailsフィールドにはオプショナルで、具体的な未実装項目やタイムスタンプなどの詳細情報を格納できます。

---

## 設定ファイル設計

### 環境変数

以下の環境変数を新規に導入します。

#### DESIGN_VALIDATION_STRICT

**説明:** 設計-実装整合性検証の動作モードを制御します。
**デフォルト値:** true（厳格モード）
**動作:**
- true: 検証失敗時にフェーズ遷移をブロックし、エラーメッセージを表示します。
- false: 検証失敗時に警告メッセージを表示しますが、フェーズ遷移を許可します。

**対象フェーズ:** workflow_complete_sub（code_review）、workflow_next（parallel_quality→testing）

**使用例（Windows）:**
```bash
set DESIGN_VALIDATION_STRICT=false
```

**使用例（Unix系）:**
```bash
export DESIGN_VALIDATION_STRICT=false
```

#### TEST_AUTHENTICITY_STRICT

**説明:** テスト実行真正性検証の動作モードを制御します。
**デフォルト値:** true（厳格モード）
**動作:**
- true: 検証失敗時にフェーズ遷移をブロックし、エラーメッセージを表示します。
- false: 検証失敗時に警告メッセージを表示しますが、フェーズ遷移を許可します。

**対象フェーズ:** workflow_next（testing→regression_test）、workflow_next（regression_test→parallel_verification）

**使用例（Windows）:**
```bash
set TEST_AUTHENTICITY_STRICT=false
```

**使用例（Unix系）:**
```bash
export TEST_AUTHENTICITY_STRICT=false
```

---

### .env ファイルサポート（オプション）

環境変数の設定を永続化するため、.envファイルからの読み込みをサポートします。

#### .env ファイル例

プロジェクトルートに.envファイルを作成し、以下の内容を記述できます。

```
DESIGN_VALIDATION_STRICT=false
TEST_AUTHENTICITY_STRICT=false
```

#### 読み込みタイミング

MCPサーバー起動時に.envファイルを読み込み、process.envに設定します。
既に環境変数が設定されている場合は、環境変数が優先されます（.envファイルの内容は上書きされません）。
.envファイルが存在しない場合は、デフォルト値（true）が使用されます。

---

## CLI操作フロー

### 正常フロー（C-1, C-2, C-3全て成功）

手順1: ユーザーが /workflow next を実行します。
手順2: MCPサーバーがworkflow_nextを処理し、phaseGuide.subagentTemplateを含むレスポンスを返します。
手順3: Orchestratorがレスポンスメッセージを読み、subagentTemplateをTask toolのprompt引数として使用します。
手順4: subagentが実行され、userIntentを反映した成果物を作成します。
手順5: code_reviewサブフェーズ完了時、workflow_complete_subがdesign-validatorを実行し、成功メッセージを返します。
手順6: testing→regression_test遷移時、workflow_nextがtest-authenticityを実行し、成功メッセージを返します。

### エラーフロー（C-2失敗、厳格モード）

手順1: ユーザーが /workflow complete-sub code_review を実行します。
手順2: MCPサーバーがdesign-validatorを実行し、未実装項目を検出します。
手順3: 環境変数DESIGN_VALIDATION_STRICTがtrueのため、エラーメッセージを返しフェーズ遷移をブロックします。
手順4: Orchestratorがエラーメッセージを表示し、修正ガイダンスをユーザーに提示します。
手順5: ユーザーが未実装項目を実装し、再度 /workflow complete-sub code_review を実行します。
手順6: 検証が成功し、次のフェーズに進めるようになります。

### 警告フロー（C-3失敗、警告モード）

手順1: ユーザーがDESIGN_VALIDATION_STRICT=falseを設定します。
手順2: ユーザーが /workflow next（testing→regression_test）を実行します。
手順3: MCPサーバーがtest-authenticityを実行し、テスト未実行を検出します。
手順4: 環境変数TEST_AUTHENTICITY_STRICTがfalseのため、警告メッセージを表示しますが遷移を許可します。
手順5: Orchestratorが警告メッセージをユーザーに表示します。
手順6: ユーザーが続行を選択し、次のフェーズに進みます（テスト未実行のまま続行可能）。

---

## メッセージテンプレート一覧

本セクションでは、C-1、C-2、C-3の各機能で使用するメッセージテンプレートを定義します。
テンプレート内のプレースホルダーはMCPサーバー側で実際の値に置換されてからレスポンスに含まれます。
C-1テンプレートはworkflow_next成功時にOrchestratorへuserIntentの反映を促すメッセージです。
C-2テンプレートはdesign-validatorの検証結果を報告する成功・失敗の2パターンがあります。
C-3テンプレートはtest-authenticityの検証結果を報告するもので、テスト実行の証跡が不足した場合に表示されます。
警告モード用テンプレートは厳格モードの冒頭文言のみ変更し、詳細部分は共通の構造を使用します。

### C-1: userIntentガイダンステンプレート

C-1テンプレートは以下の構造で生成されます。フェーズ遷移成功メッセージの後にuserIntentの引用とsubagentTemplateの内容が続きます。

    フェーズ遷移: (fromPhase) → (toPhase)
    重要: ユーザーの意図をsubagentプロンプトに必ず含めてください。
    userIntentには以下の内容が含まれています:
    引用: (userIntent の内容)
    推奨されるTask toolプロンプトテンプレート:
    (subagentTemplate の内容がここに展開されます)

### C-2: design-validator成功テンプレート

```
サブフェーズ完了: code_review

設計-実装整合性検証: 完了
- 全ての設計項目が実装されています
- 検証項目: spec.md（全項目実装済み）、state-machine.mmd（全遷移実装済み）、flowchart.mmd（全フロー実装済み）

次のフェーズに進む準備ができました。
```

### C-2: design-validator失敗テンプレート（厳格モード）

```
エラー: 設計-実装整合性検証に失敗しました
フェーズ遷移がブロックされました。

失敗理由:
- spec.mdの未実装項目: {count}件
- 状態遷移図の未実装遷移: {count}件
- フローチャートの未実装フロー: {count}件

詳細:
{detailedList}

修正方法:
1. 未実装項目を実装してください: {fileList}
2. 実装後、再度 /workflow complete-sub code_review を実行してください
3. または、設計内容に誤りがある場合は /workflow back design を実行してください

注: 環境変数 DESIGN_VALIDATION_STRICT=false を設定すると、警告モードに切り替わり続行可能になります。
```

### C-3: test-authenticity失敗テンプレート（厳格モード）

```
エラー: テスト実行の真正性検証に失敗しました
フェーズ遷移がブロックされました。

失敗理由:
- testingフェーズ開始時刻: {phaseStartTime}
- 最新のBash実行時刻: {lastBashTime}
- {reason}

検出された問題:
- testingフェーズ中にBash実行が記録されていません
- workflow_record_test_result呼び出しが記録されていません

修正方法:
1. testingフェーズ中に実際にテストを実行してください（npm test、vitest、jestなど）
2. テスト実行後、workflow_record_test_result を呼び出して結果を記録してください
3. または、testingフェーズに戻る場合は /workflow back testing を実行してください

注: 環境変数 TEST_AUTHENTICITY_STRICT=false を設定すると、警告モードに切り替わり続行可能になります。
```

---

## アクセシビリティ考慮事項

### コマンドラインインターフェースの可読性

エラーメッセージは80文字以内で改行し、ターミナルでの可読性を確保します。
重要な情報（エラー、警告、成功）は行頭に明示的なラベルを配置します。
階層構造は適切なインデント（2スペースまたは4スペース）で表現します。
コードブロックはMarkdown形式で明確に区切り、コピー&ペースト可能にします。

### スクリーンリーダー対応

エラーメッセージの構造は論理的な順序（問題の特定→詳細→解決策）で配置します。
リストは番号付きリストまたは箇条書きリストを使用し、順序関係を明確にします。
技術用語には簡潔な説明を添え、初見のユーザーでも理解できるようにします。

---

## 今後の拡張ポイント

### C-1拡張: subagentTemplateの動的カスタマイズ

将来的に、ユーザーが独自のsubagentTemplateを定義できる仕組みを追加できます。
.claude/settings.jsonにphaseTemplatesセクションを追加し、フェーズごとのテンプレートオーバーライドをサポートします。

### C-2拡張: design-validatorのカスタムルール

特定のプロジェクトに固有の検証ルールを追加できるプラグインシステムを構築できます。
docs/validation-rules/ディレクトリにJavaScriptまたはTypeScriptファイルを配置し、カスタム検証ロジックを実装できるようにします。

### C-3拡張: test-authenticityの高度な分析

テストカバレッジレポートの自動解析機能を追加し、カバレッジが閾値を下回る場合に警告を表示できます。
テストファイルの変更履歴を追跡し、実装変更後にテストが更新されていない場合に警告を表示できます。

---

## 設計完了チェックリスト

以下の項目が全て本UI設計書に含まれていることを確認します。

- CLIインターフェース設計: workflow_nextレスポンスメッセージ（C-1対応）
- CLIインターフェース設計: workflow_complete_subレスポンスメッセージ（C-2対応）
- エラーメッセージ設計: C-2（厳格モードと警告モード）
- エラーメッセージ設計: C-3（厳格モードと警告モード）
- APIレスポンス設計: StatusResult型拡張とPhaseGuide型拡張
- APIレスポンス設計: ValidationResult型定義
- 設定ファイル設計: 環境変数（DESIGN_VALIDATION_STRICT、TEST_AUTHENTICITY_STRICT）
- CLI操作フロー: 正常フロー、エラーフロー、警告フロー
- メッセージテンプレート一覧: C-1、C-2、C-3の全テンプレート
- アクセシビリティ考慮事項: 可読性とスクリーンリーダー対応

---

## 次フェーズへの引き継ぎ

state_machineフェーズでは、C-2とC-3のバリデーション統合による状態遷移ブロックをステートマシン図に反映してください。
flowchartフェーズでは、workflow_nextとworkflow_complete_sub内でのバリデーション実行フローをフローチャートに追加してください。
test_designフェーズでは、本UI設計書で定義した全てのメッセージフォーマットとエラーケースをテストシナリオに含めてください。
test_implフェーズでは、環境変数による厳格モード/警告モードの切り替えが正しく動作することを確認するテストを作成してください。
implementationフェーズでは、本UI設計書のメッセージテンプレートを文字列定数として実装し、プレースホルダー置換ロジックを実装してください。
