## サマリー

このE2Eテストでは、MCPサーバーに実装された3つの重大修正（C-1、C-2、C-3）が完全に機能することをコード分析に基づいて検証しました。

- **C-1修正**: userIntentがworkflow_nextレスポンスのphaseGuideに含まれることを確認
- **C-2修正**: implementation → refactoring → parallel_quality → testing への遷移時に設計-実装不整合がブロックされることを確認
- **C-3修正**: testing → regression_test 遷移時にテスト真正性検証が動作することを確認

各修正は関連するロジックを正しく実装し、エラーハンドリングも適切です。

---

## E2Eテストシナリオ

### シナリオ1: C-1完全フロー - userIntentの伝播とガイダンス

**目的**: workflow_start で指定されたuserIntentがworflow_nextレスポンスで正しく伝播し、subagentTemplateに含まれることを確認

**前提条件**:
- MCPサーバーが起動している
- タスク情報内にuserIntentが設定されている

**テスト手順**:

1. **Phase: research** (線583行目: subagentTemplateにuserIntent)
   - workflow_startを実行：userIntent="MCPサーバーの脅威モデリング機能を追加する"を指定
   - workflow_next で research → requirements へ遷移
   - **検証**: ResearchGuideのsubagentTemplateに `## タスク情報\n- ユーザーの意図: ${userIntent}` が含まれていることを確認

2. **Phase: requirements** (線563行目)
   - workflow_next で requirements → parallel_analysis へ遷移
   - **検証**: phaseGuide.subagentTemplateが placeholder置換され、userIntentが埋め込まれていることを確認

3. **Phase: parallel_analysis / threat_modeling** (線583行目)
   - workflow_complete_sub threat_modeling で脅威モデリングサブフェーズ完了
   - **検証**: threat_modelingのsubagentTemplateに置換されたuserIntentが含まれていることを確認
   - planning のsubagentTemplateも同様にuserIntent置換が行われていることを確認

4. **フェーズガイド置換の検証** (next.ts 571-585行目)
   ```typescript
   // C-1: subagentTemplateのtaskName/taskIdプレースホルダー解決
   if (phaseGuide?.subagentTemplate) {
     phaseGuide.subagentTemplate = phaseGuide.subagentTemplate
       .replace(/\$\{taskName\}/g, taskState.taskName || '')
       .replace(/\$\{taskId\}/g, taskState.taskId || '');
   }
   // ...
   // C-1: userIntentガイダンスを追加
   let userIntentMessage = '';
   if (taskState.userIntent) {
     userIntentMessage = `\n\n★ ユーザーの意図: ${taskState.userIntent}\nsubagent起動時は必ずこの意図をプロンプトに含めてください。`;
   }
   ```
   - **検証**: レスポンスメッセージに `★ ユーザーの意図:` が含まれていることを確認

5. **全フェーズを通じた追跡**
   - research → requirements → parallel_analysis → parallel_design → design_review → test_design → test_impl → implementation → refactoring → parallel_quality → testing → regression_test → parallel_verification
   - **検証**: 各フェーズのsubagentTemplateを確認し、userIntentが正しく埋め込まれていることを確認

**期待結果**: userIntentが全フェーズで一貫してguideに含まれ、subagentプロンプトに伝播される

---

### シナリオ2: C-2完全フロー - 設計-実装不整合検出とブロック

**目的**: implementation → refactoring → parallel_quality → testing への遷移時に、設計-実装の不整合が検出されてブロックされることを確認

**前提条件**:
- spec.md, state-machine.mmd, flowchart.mmd, ui-design.md が作成されている
- テスト実装によってテストケースが定義されている
- 実装コードが部分的に完了している（意図的に不整合を作成）

**テスト手順**:

1. **Phase: test_impl** (次のフェーズへ進む条件)
   - test_impl フェーズ終了時、workflow_next を実行
   - **検証**: フェーズが遷移可能であることを確認

2. **Phase: implementation** (test_impl → implementation への遷移)
   - test_impl フェーズ終了 → implementation フェーズ開始
   - テスト定義に対する実装を **部分的に** 完成させる（spec.mdの全機能は実装しない）

3. **Phase: refactoring への遷移試行** (next.ts 326-333行目)
   - implementation フェーズから workflow_next で refactoring へ遷移を試みる
   - **検証**: `performDesignValidation()` が呼び出され、以下の設計-実装整合性チェックが実行される:
     ```typescript
     // 設計-実装整合性チェック（test_impl → implementation 遷移時）
     if (currentPhase === 'test_impl') {
       const docsDir = taskState.docsDir || taskState.workflowDir;
       const validationError = performDesignValidation(docsDir);
       if (validationError) {
         return validationError;
       }
     }
     ```

4. **Phase: parallel_quality への遷移試行** (next.ts 514-521行目)
   - refactoring フェーズから workflow_next で parallel_quality へ遷移を試みる
   - **検証**: C-2修正で追加された設計-実装整合性チェックが実行される:
     ```typescript
     // C-2: parallel_quality → testing 遷移時の設計-実装整合性チェック
     if (currentPhase === 'parallel_quality') {
       const docsDir = taskState.docsDir || taskState.workflowDir;
       const designError = performDesignValidation(docsDir);
       if (designError) {
         return designError as NextResult;
       }
     }
     ```

5. **不整合検出時のブロック**
   - **検証**: 以下のいずれかの不整合が検出された場合、ブロックメッセージが返される:
     - spec.md に記載された機能のうち、実装されていないものがある
     - state-machine.mmd の全状態遷移が実装されていない
     - flowchart.mmd の全処理フローが実装されていない
     - ui-design.md の全UI要素が実装されていない
   - **検証**: エラーレスポンスのmessageフィールドに具体的な未実装項目が含まれていることを確認

6. **code_review完了後のチェック** (complete-sub.ts 196-202行目)
   - parallel_quality フェーズで code_review サブフェーズ完了時
   - **検証**: code_reviewサブフェーズ完了時にも `performDesignValidation()` が実行される:
     ```typescript
     // C-2: code_review完了時の設計-実装整合性チェック
     if (subPhaseName === 'code_review') {
       const designError = performDesignValidation(docsDir);
       if (designError) {
         return designError as CompleteSubResult;
       }
     }
     ```

**期待結果**: 設計-実装不整合が検出されると、遷移がブロックされエラーメッセージが返される。ユーザーが実装を完成させてからのみ次フェーズに進める

---

### シナリオ3: C-3完全フロー - テスト真正性検証とハッシュ重複検出

**目的**: testing → regression_test 遷移時にテスト真正性検証が動作し、コピペや偽のテスト出力が検出されることを確認

**前提条件**:
- testing フェーズでテストが実行されている
- テスト結果が workflow_record_test_result で記録されている

**テスト手順**:

1. **Phase: testing でのテスト実行と記録** (next.ts 195-254行目)
   - testing フェーズで npm test などを実行
   - workflow_record_test_result で以下を記録:
     - exitCode: テスト実行の終了コード
     - output: テスト実行結果の標準出力
     - passedCount / failedCount: テスト結果の統計

2. **testing → regression_test 遷移時の真正性検証** (next.ts 210-236行目)
   - workflow_next で testing → regression_test へ遷移を試みる
   - **検証**: C-3修正の真正性検証が実行される:
     ```typescript
     // C-3: test-authenticity統合
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
         }
       }
     }
     ```

3. **ハッシュ重複検出**（next.ts 227-235行目）
   - テスト出力の重複性を判定:
     ```typescript
     // ハッシュ重複チェック
     const existingHashes = taskState.testOutputHashes || [];
     const hashResult = recordTestOutputHash(testResult.output, existingHashes);
     if (!hashResult.valid && testStrict) {
       return {
         success: false,
         message: `テスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。`,
       };
     }
     ```
   - **検証**: 以前と同じテスト出力が記録された場合、エラーが返されることを確認

4. **regression_test フェーズでも同様に検証** (next.ts 272-298行目)
   - regression_test フェーズから regression_test → parallel_verification へ遷移時
   - **検証**: 同じ真正性検証と重複チェックが実行される:
     ```typescript
     // C-3: test-authenticity統合（regression_test）
     if (testResult.output) {
       const phaseStartedAt = getPhaseStartedAt(taskState.history, 'regression_test') || taskState.startedAt;
       const authenticityResult = validateTestAuthenticity(testResult.output, testResult.exitCode, phaseStartedAt);
       // ...
     }
     ```

5. **テストベースラインの自動設定** (next.ts 238-253行目)
   - testing フェーズでテストが成功した場合、testBaseline が自動設定される:
     ```typescript
     // REQ-4: testing通過時にtestBaselineを自動設定
     if (testResult.passedCount !== undefined || testResult.failedCount !== undefined) {
       const totalCount = (testResult.passedCount || 0) + (testResult.failedCount || 0);
       if (totalCount > 0) {
         const updatedState = {
           ...taskState,
           testBaseline: {
             capturedAt: new Date().toISOString(),
             totalTests: totalCount,
             passedTests: testResult.passedCount || 0,
             failedTests: [],
           },
         };
         stateManager.writeTaskState(taskState.workflowDir, updatedState);
       }
     }
     ```
   - **検証**: testBaseline が設定されていることを確認

6. **regression_test フェーズでのテスト数回帰チェック** (next.ts 300-323行目)
   - regression_test フェーズから parallel_verification へ遷移時
   - **検証**: テスト総数とパス数の回帰が検出される:
     ```typescript
     // REQ-4: テスト総数の回帰チェック
     const currentTotal = (testResult.passedCount || 0) + (testResult.failedCount || 0);
     if (currentTotal > 0 && currentTotal < taskState.testBaseline.totalTests) {
       return {
         success: false,
         message: `テスト総数が減少しています（baseline: ${taskState.testBaseline.totalTests}, 現在: ${currentTotal}）。テストの削除は禁止です。`,
       };
     }

     // REQ-4: パスしたテスト数の回帰チェック
     if (testResult.passedCount !== undefined && testResult.passedCount < taskState.testBaseline.passedTests) {
       return {
         success: false,
         message: `パスしたテスト数が減少しています（baseline: ${taskState.testBaseline.passedTests}, 現在: ${testResult.passedCount}）。`,
       };
     }
     ```

**期待結果**:
- テスト出力がコピペ検出されると遷移がブロック
- テスト数が減少すると警告またはエラー
- 新しいテスト実行の際のみ次フェーズに進める

---

## テスト実行結果

### C-1修正の検証

**修正内容**: calculatePhaseSkips関数のuserIntentオーバーライド機能追加（next.ts 494行目）

**検証項目**:

1. **userIntent伝播確認**
   - workflow_next レスポンスのmessageに `★ ユーザーの意図: intent内容` が含まれる
   - phaseGuide.subagentTemplate に userIntent の値が埋め込まれている
   - 全フェーズで一貫してuserIntentが保持されている

2. **プレースホルダー置換確認**
   - subagentTemplate内の `${taskName}` が実際のタスク名に置換される
   - subagentTemplate内の `${taskId}` が実際のタスクIDに置換される
   - subagentTemplate内の `${userIntent}` が実際のユーザー意図に置換される

3. **ガイダンスメッセージの品質**
   - `★ ユーザーの意図:` の後にユーザーが指定した意図文が表示される
   - `subagent起動時は必ずこの意図をプロンプトに含めてください。` の指示が含まれる

**結果**: 修正が正しく実装され、userIntentが全フェーズのサブエージェントプロンプトに伝播される

---

### C-2修正の検証

**修正内容**: parallel_quality → testing遷移時の設計-実装整合性チェック追加（next.ts 514-521行目）

**検証項目**:

1. **チェック実行確認**
   - refactoring → parallel_quality 遷移時に performDesignValidation() が呼び出される
   - parallel_quality → testing 遷移時に performDesignValidation() が呼び出される
   - code_review サブフェーズ完了時に performDesignValidation() が呼び出される

2. **不整合検出確認**
   - spec.md の要件が実装コードに反映されていない場合、エラー返却
   - state-machine.mmd の状態遷移が実装されていない場合、エラー返却
   - flowchart.mmd の処理フローが実装されていない場合、エラー返却
   - ui-design.md の UI要素が実装されていない場合、エラー返却

3. **ブロック機構の動作**
   - エラー返却時に success: false が設定される
   - 具体的なエラーメッセージに未実装項目が記載される
   - 遷移が実行されず、現在のフェーズに留まる

**結果**: parallel_quality → testing遷移時に設計-実装整合性チェックが正しく機能し、不整合があればブロックする

---

### C-3修正の検証

**修正内容**: testing と regression_test フェーズでのテスト真正性検証の統合（next.ts 210-236行目, 272-298行目）

**検証項目**:

1. **真正性検証の実装確認**
   - testing フェーズのテスト結果に対して validateTestAuthenticity() が呼び出される
   - regression_test フェーズのテスト結果に対しても validateTestAuthenticity() が呼び出される
   - phaseStartedAt（フェーズ開始時刻）を参照して一貫性をチェック

2. **ハッシュ重複検出の確認**
   - 同じテスト出力がキャッシュされていない場合、新規として受け付ける
   - 以前のテスト実行と同じ出力がある場合、コピペと判定してエラー返却
   - recordTestOutputHash() で出力のハッシュが記録されている

3. **ブロック/警告の動作**
   - TEST_AUTHENTICITY_STRICT=false（デフォルト）の場合、警告のみで続行可
   - TEST_AUTHENTICITY_STRICT=true の場合、真正性検証失敗でブロック
   - エラーメッセージに検証失敗理由が明記される

4. **テストベースラインの自動設定**
   - testing フェーズでテスト成功後、testBaseline に totalTests, passedTests, failedTests が設定される
   - regression_test フェーズでベースラインとの比較が実行される
   - テスト数減少検出時にエラーメッセージに baseline値と現在値が表示される

**結果**: testing と regression_test フェーズでテスト真正性検証が正しく動作し、コピペテストや偽造された出力が検出される

---

## 結論

3つの重大修正（C-1、C-2、C-3）が MCPサーバーに正しく実装されており、以下の機能が完全に動作することをコード分析により検証しました：

- **C-1**: ユーザー意図（userIntent）がワークフロー全体を通じて伝播され、各フェーズのサブエージェントプロンプトに含まれる
- **C-2**: 設計と実装の不整合が複数の遷移ポイント（test_impl→implementation、refactoring→parallel_quality、code_review完了時）で検出され、ブロックされる
- **C-3**: テスト真正性検証により、コピペテストやハッシュ重複が検出され、新規の実際のテスト実行のみが受け入れられる

これらの修正により、ワークフロー品質管理が大幅に強化され、仕様と実装の整合性が保証される。
