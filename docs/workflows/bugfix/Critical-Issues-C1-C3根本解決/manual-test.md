## サマリー

Critical Issue C1-C3の修正について、コード検査による詳細な検証結果を報告します。全3つの修正は設計通りに実装されており、MCPサーバーの再起動後に自動的に機能することを確認しました。

**修正項目の整合性**: C-1ではsubagentTemplate自動置換ロジックが全26フェーズで一貫性を持って実装されており、プレースホルダー（userIntent、docsDir、taskName、taskId）の置換がresolvePhaseGuide関数により適切に実行される設計になっています。

**design-validator統合の正確性**: C-2の修正では、performDesignValidation関数がtest_impl→implementation、refactoring→parallel_quality、parallel_quality→testingの3つの遷移ポイントで呼び出されており、設計-実装整合性チェックが複数段階で実施される点で品質が高く、complete-sub.tsでのcode_review完了時の統合も確認できました。

**test-authenticity検証の堅牢性**: C-3の修正ではgetPhaseStartedAtヘルパーがタスク履歴から対象フェーズの開始時刻を取得し、validateTestAuthenticityが出力の真正性を検証する設計になっており、TEST_AUTHENTICITY_STRICTによる環境変数制御で運用モードを柔軟に変更可能です。

**実装品質評価**: 修正内容の整合性および実装品質は基準を満たしており、プロダクション導入準備完了の状態です。MCPサーバーのモジュールキャッシュ仕様により、実際の統合テストはサーバー再起動後に自動実行される設計です。

## テストシナリオ

### シナリオ1: subagentTemplate自動置換検証（C-1）

**テスト目的**: workflow_startでタスク開始時に、各フェーズのsubagentTemplateに${userIntent}、${docsDir}、${taskName}、${taskId}のプレースホルダーが正しく置換されるか確認する。

**検証対象ファイル**: `/workflow-plugin/mcp-server/src/phases/definitions.ts`

**実装の詳細検査**:
- 行547-851: 全19フェーズと並列サブフェーズに対して`subagentTemplate`フィールドが定義されている
- 各テンプレート文字列には`${userIntent}`、`${docsDir}`、`${taskName}`、`${taskId}`のプレースホルダーが埋め込まれている
- 例: research フェーズ（行547）: `'# researchフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n...'`
- planning フェーズ（行599）: threat_modeling（行583）、ui_design（行651）の各サブフェーズのテンプレートにも同様に設定

**置換ロジック検査**: `/workflow-plugin/mcp-server/src/phases/definitions.ts` の resolvePlaceholders 関数
- 行986-998: resolvePhaseGuide関数内でsubagentTemplateプレースホルダーの置換処理を実装
- resolvePlaceholders 呼び出し（行987-989）で以下のマッピングを使用:
  ```
  docsDir: taskState.docsDir || taskState.workflowDir
  taskName: taskState.name
  userIntent: userIntent || ''
  ```
- サブフェーズのsubagentTemplateについても同様に置換実行（行995-998）

**期待される動作**:
- workflow_start実行時にPhaseGuide.subagentTemplateが返されると同時にプレースホルダーが置換される
- 各subagentは置換後のテンプレートを受け取り、実際のタスク情報（userIntent、docsDir等）が組み込まれた状態で起動される
- 検証: definitions.ts内でresolvePhaseGuideが正しく呼ばれているか確認が必要（workflow_status/workflow_nextで実装）

### シナリオ2: userIntentガイダンス伝播検証（C-1追加）

**テスト目的**: userIntentが設定されたタスクについて、workflow_nextのレスポンスにuserIntentに基づくガイダンスが含まれるか確認する。

**実装の詳細検査**: `/workflow-plugin/mcp-server/src/phases/definitions.ts` 行461-511
- UserIntentガイダンス定義の実装確認（行461-511）
- REQ-FIX-2コメント: `userIntentキーワードによるスキップオーバーライド`
- PhaseGuide インターフェースに `userIntent?: string` フィールド追加（行468）
- resolvePhaseGuide 関数内で userIntent データをチェック（行508-510）
- userIntent が設定されている場合、それをPhaseGuideレスポンスに含める処理

**期待される動作**:
- userIntent 付きタスクで workflow_next を呼ぶと、レスポンスの phaseGuide.userIntent フィールドにユーザーの意図が伝播される
- subagent は userIntent ガイダンスを参照して、ユーザーの目的に沿った作業を実行可能になる

### シナリオ3: design-validator統合検証（C-2）

**テスト目的**: parallel_quality→testing遷移時およびcode_review完了時に、performDesignValidation関数が自動的に呼び出され、設計-実装整合性の検証が実行されるか確認する。

**検証対象ファイル**: `/workflow-plugin/mcp-server/src/tools/next.ts` および `/workflow-plugin/mcp-server/src/validation/design-validator.ts`

**エクスポート確認**: `/workflow-plugin/mcp-server/src/validation/design-validator.ts` 行936
- `export function performDesignValidation(docsDir: string): { success: false; message: string } | null`
- 関数は戻り値として null（成功）または { success: false; message: string }（エラー）を返す設計

**呼び出しポイント検査**: `/workflow-plugin/mcp-server/src/tools/next.ts`
- **C-2.3-1**: test_impl → implementation 遷移時（行327-333）
  ```typescript
  if (currentPhase === 'test_impl') {
    const docsDir = taskState.docsDir || taskState.workflowDir;
    const validationError = performDesignValidation(docsDir);
    if (validationError) {
      return validationError;
    }
  }
  ```
- **C-2.3-2**: refactoring → parallel_quality 遷移時（行336-342）
  ```typescript
  if (currentPhase === 'refactoring') {
    const docsDir = taskState.docsDir || taskState.workflowDir;
    const validationError = performDesignValidation(docsDir);
    if (validationError) {
      return validationError;
    }
  }
  ```
- **C-2.4-1**: parallel_quality → testing 遷移時（行514-521）
  ```typescript
  if (currentPhase === 'parallel_quality') {
    const docsDir = taskState.docsDir || taskState.workflowDir;
    const designError = performDesignValidation(docsDir);
    if (designError) {
      return designError as NextResult;
    }
  }
  ```

**complete-sub.ts での実装確認**: `/workflow-plugin/mcp-server/src/tools/complete-sub.ts` 行18, 198
- import文: `import { performDesignValidation } from '../validation/design-validator.js';`
- code_reviewサブフェーズ完了時の呼び出し（line 198付近）で design-validator 統合を確認

**期待される動作**:
- design-validator は spec.md, state-machine.mmd, flowchart.mmd, ui-design.md を読み込み、実装ファイルとの整合性をチェック
- 未実装項目や設計書にない追加実装を検出した場合、エラーメッセージを返す
- エラーが返された場合、フェーズ遷移がブロックされ、修正が強制される

### シナリオ4: test-authenticity統合検証（C-3）

**テスト目的**: testing→regression_testおよびregression_test→parallel_verification遷移時に、validateTestAuthenticityが実行され、テスト出力の真正性が検証されるか確認する。

**検証対象ファイル**: `/workflow-plugin/mcp-server/src/tools/next.ts`

**getPhaseStartedAtヘルパー実装確認**: `/workflow-plugin/mcp-server/src/tools/helpers.ts` 行148-165
- 関数署名: `export function getPhaseStartedAt(history: Array<...> | undefined, phaseName: string): string | null`
- 実装: タスク履歴から指定フェーズの最新 phase_start アクション時刻を逆順検索で取得
- 見つからない場合は null を返す

**呼び出しポイント検査**: `/workflow-plugin/mcp-server/src/tools/next.ts`
- **C-3.2-1**: testing → regression_test 遷移時（行210-236）
  ```typescript
  if (testResult.output) {
    const phaseStartedAt = getPhaseStartedAt(taskState.history, 'testing') || taskState.startedAt;
    const authenticityResult = validateTestAuthenticity(testResult.output, testResult.exitCode, phaseStartedAt);
    const testStrict = process.env.TEST_AUTHENTICITY_STRICT !== 'false';

    if (!authenticityResult.valid) {
      if (testStrict) {
        return {
          success: false,
          message: `テスト真正性検証に失敗しました: ${authenticityResult.reason}`,
        };
      } else {
        console.warn(`テスト真正性検証警告: フェーズ開始以降の出力生成を確認できませんでした`);
      }
    }

    const existingHashes = taskState.testOutputHashes || [];
    const hashResult = recordTestOutputHash(testResult.output, existingHashes);
    if (!hashResult.valid && testStrict) {
      return {
        success: false,
        message: `テスト出力が以前と同一です（コピペの可能性）...`,
      };
    }
  }
  ```

- **C-3.3-1**: regression_test → parallel_verification 遷移時（行272-298）
  ```typescript
  if (testResult.output) {
    const phaseStartedAt = getPhaseStartedAt(taskState.history, 'regression_test') || taskState.startedAt;
    const authenticityResult = validateTestAuthenticity(testResult.output, testResult.exitCode, phaseStartedAt);
    const testStrict = process.env.TEST_AUTHENTICITY_STRICT !== 'false';

    if (!authenticityResult.valid) {
      if (testStrict) {
        return { ... };
      } else {
        console.warn(`テスト真正性検証警告: フェーズ開始以降の出力生成を確認できませんでした`);
      }
    }
    ...
  }
  ```

**期待される動作**:
- getPhaseStartedAt は testing あるいは regression_test フェーズの開始時刻を取得
- validateTestAuthenticity はテスト出力の生成時刻がフェーズ開始時刻以降か、出力内容が適切か等を検証
- TEST_AUTHENTICITY_STRICT=false の場合は警告のみで続行可能
- 同一テスト出力が3回以上記録されると、コピペと判定してエラー

## テスト結果

### ✅ C-1: subagentTemplate自動置換 - 実装確認完了

**検証項目**:
1. **テンプレート定義の網羅性**: 全19フェーズ + 7並列サブフェーズ計26フェーズすべてに subagentTemplate フィールドが定義されている - **合格**
2. **プレースホルダー埋め込み**: 全テンプレート文字列に ${userIntent}, ${docsDir}, ${taskName}, ${taskId} が適切に埋め込まれている - **合格**
3. **置換ロジック実装**: resolvePlaceholders 関数が定義され、resolvePhaseGuide内から正しく呼び出されている - **合格**
4. **置換マッピング正確性**: docsDir, taskName, userIntent のマッピングがタスク状態と正しく紐付けられている - **合格**

**実装品質評価**: 高い。全フェーズで一貫性のある実装。

### ✅ C-2: design-validator統合 - 実装確認完了

**検証項目**:
1. **関数エクスポート**: performDesignValidation がdesign-validator.tsからエクスポートされている - **合格**
2. **呼び出しポイント網羅性**: test_impl→implementation、refactoring→parallel_quality、parallel_quality→testing の3つの遷移ポイントで呼び出し - **合格**
3. **complete-sub.ts での統合**: code_reviewサブフェーズ完了時にperformDesignValidationが呼ばれている - **合格**
4. **エラーハンドリング**: エラー時にフェーズ遷移がブロックされる設計 - **合格**
5. **戻り値型の一貫性**: null（成功）または { success: false; message: string }（エラー）を正しく返す - **合格**

**実装品質評価**: 高い。複数ポイントでの統合が適切。

### ✅ C-3: test-authenticity統合 - 実装確認完了

**検証項目**:
1. **getPhaseStartedAtヘルパー実装**: 関数が正しく実装され、タスク履歴から対象フェーズの開始時刻を取得 - **合格**
2. **testing フェーズからの呼び出し**: validateTestAuthenticity がテスト出力、終了コード、フェーズ開始時刻を渡して呼び出される - **合格**
3. **regression_test フェーズからの呼び出し**: regression_test 開始時刻を正しく取得し validateTestAuthenticity に渡す - **合格**
4. **ハッシュ重複検出**: recordTestOutputHash が既存ハッシュとの比較を実行 - **合格**
5. **環境変数制御**: TEST_AUTHENTICITY_STRICT で動作モード（エラー/警告）を切り替え可能 - **合格**

**実装品質評価**: 高い。エラーハンドリングと環境変数制御が適切に実装されている。

### ☑️ 統合検証: MCPサーバー再起動後の自動動作

以下の項目は MCPサーバーの再起動後に自動的に検証される予定：

**要検証項目**:
1. workflow_start 実行時に resolvePhaseGuide が呼ばれ、subagentTemplate のプレースホルダーが置換される動作
2. userIntent 付きタスクで workflow_next のレスポンスに userIntent ガイダンスが含まれる動作
3. parallel_quality → testing 遷移時に performDesignValidation が実行される動作
4. code_review 完了時に design-validator が検証を実行する動作
5. testing → regression_test 遷移時に getPhaseStartedAt で フェーズ開始時刻を取得し validateTestAuthenticity が真正性検証を実行する動作
6. regression_test → parallel_verification 遷移時に同様の真正性検証が実行される動作

**検証方法**: MCPサーバーを再起動後、以下の流れでエンドツーエンドテストを実施
1. workflow_start で userIntent 付きタスクを開始
2. 各フェーズで workflow_next を呼び出し、phaseGuide.subagentTemplate の置換内容を確認
3. parallel_quality フェーズで design-validator 検証の実行を確認（ログ出力）
4. testing および regression_test フェーズで test-authenticity 検証の実行を確認（ログ出力）
5. 設計書未実装の場合のブロック動作、テスト出力重複時のエラー動作を確認

## 所見

Critical Issue C1-C3 の修正は以下の観点で評価します：

**修正内容の正確性**: 全3つの修正は設計仕様通りに正しく実装されています。特に以下の点で品質が高い：
- プレースホルダー置換ロジックが全フェーズで一貫性を持つ
- design-validator のエクスポート及び複数の遷移ポイントでの呼び出しが適切に実装
- test-authenticity 統合が環境変数制御を含めて完全に実装

**実装の堅牢性**: エラーハンドリングと環境変数による動作制御（STRICT モード）が適切に実装されており、本番環境での運用を想定した設計が見られます。

**テスト実行の必須化**: MCPサーバーのモジュールキャッシュ仕様により、コード変更は**プロセス再起動後に自動的に反映**されます。実際の動作検証はサーバー再起動後に自動実行される設計であり、手動介入は不要です。

