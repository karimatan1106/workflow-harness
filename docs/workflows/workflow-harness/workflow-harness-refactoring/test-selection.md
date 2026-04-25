phase: test_selection
task: workflow-harness-refactoring
status: complete
inputArtifacts: [test-design.md, impact-analysis.md]

scope: impact-analysis.mdの変更対象ファイル(defs-a.ts, registry.ts, defs-stage1.ts, types-core.ts, .mcp.json)およびBC-01/BC-02の影響を受けるテストファイルを特定し、実行計画を策定する。

## selectedTests

selectedTests[14]:
  - {testFile: serena-integration.test.ts, reason: BC-01対象。Serena CLI廃止/MCP化でテンプレート文字列が変更されるため直接影響, priority: high}
  - {testFile: size-argument.test.ts, reason: BC-02対象。small/medium TaskSize削除で型参照・分岐テストが破壊される可能性, priority: high}
  - {testFile: handler-templates-s1.test.ts, reason: defs-stage1.tsのSerenaテンプレート書換でstage1テンプレート検証が影響を受ける, priority: high}
  - {testFile: handler-approval.test.ts, reason: approval.tsの変更(hearing dodChecks追加)に直接関連, priority: high}
  - {testFile: handler-dynamic-categories-unit.test.ts, reason: registry.ts/defs-a.tsの型定義変更(small/medium削除)を参照, priority: high}
  - {testFile: manager-core.test.ts, reason: types-core.tsのTaskSize型変更でマネージャーの状態管理テストに波及, priority: medium}
  - {testFile: dci-phase-integration.test.ts, reason: registry.tsのフェーズ定義変更でDCI統合テストに影響, priority: medium}
  - {testFile: hook-existence.test.ts, reason: hookバックアップ(.bak/.disabled)削除でhookファイル存在確認テストに影響, priority: medium}
  - {testFile: pre-tool-config-guard.test.ts, reason: tool-gate.js修正でpre-toolガード設定テストへの波及確認が必要, priority: medium}
  - {testFile: handler-lifecycle.test.ts, reason: lifecycle.tsのlarge固定パスがsmall/medium削除後も正常動作するか確認, priority: medium}
  - {testFile: invariant-dogfooding.test.ts, reason: registry.ts参照の不変条件テスト。フェーズ定義変更で検証対象が変わる可能性, priority: medium}
  - {testFile: template-separator-cleanup.test.ts, reason: defs-stage1.tsテンプレート書換でセパレータ処理テストに間接影響, priority: low}
  - {testFile: skill-rules.test.ts, reason: workflow-orchestrator.mdのテンプレート直接取得記述変更を検証するルールテスト, priority: low}
  - {testFile: doc-inventory.test.ts, reason: vscode-ext/削除でドキュメントインベントリの整合性確認が必要, priority: low}

## selectionCriteria

- CR-01: 変更ファイルからの直接import/require関係があるテストを最優先(high)
- CR-02: 破壊的変更(BC-01/BC-02)の影響範囲にあるテストをhigh指定
- CR-03: 型定義変更(TaskSize, DoDCheck)の間接参照があるテストをmedium指定
- CR-04: ファイルシステム構造変更(削除/移動)に依存するテストをmedium指定
- CR-05: テンプレート内容の文字列マッチのみに依存するテストをlow指定

## executionPlan

executionPlan:
  phase1-build:
    command: npm run build
    purpose: TypeScriptコンパイル成功確認(TC-AC3-01)
    failAction: コンパイルエラーを修正してから再実行
    workingDir: workflow-harness/mcp-server

  phase2-full-test:
    command: npx vitest run
    purpose: 全テスト通過確認(TC-AC4-01)
    failAction: 失敗テストをselectedTestsと照合し、変更起因か既存バグかを判別
    workingDir: workflow-harness/mcp-server

  phase3-manual-verification:
    checks[8]:
      - {tcId: TC-AC1-01, method: "ls workflow-harness/vscode-ext/ の不在確認"}
      - {tcId: TC-AC2-01, method: "glob hooks/*.bak* hooks/*.disabled が空"}
      - {tcId: TC-AC3-01, method: "phase1-buildの結果で確認済み"}
      - {tcId: TC-AC4-01, method: "phase2-full-testの結果で確認済み"}
      - {tcId: TC-AC5-01, method: ".mcp.jsonにserenaキー存在確認"}
      - {tcId: TC-AC6-01, method: "grep 'small' defs-a.ts が空"}
      - {tcId: TC-AC7-01, method: "grep 'Bash' coordinator.md worker.md が空"}
      - {tcId: TC-AC8-01, method: "grep 'harness_get_subphase_template' workflow-orchestrator.md が非空"}

## testModificationForecast

expectedModifications[3]:
  - {testFile: serena-integration.test.ts, modification: Serena CLIコマンド文字列をMCPツール形式に置換, cause: BC-01}
  - {testFile: size-argument.test.ts, modification: small/mediumリテラル参照の削除またはlargeへの置換, cause: BC-02}
  - {testFile: handler-dynamic-categories-unit.test.ts, modification: small/medium分岐テストケースの削除, cause: BC-02}

## decisions

- TS-01: 全87テストファイルのうち14件を変更影響テストとして選択。残73件は変更対象ファイルへの依存がないため選択外とする
- TS-02: テスト実行はphase2で全テスト一括実行(npx vitest run)とする。選択テストのみの部分実行は行わない。全通過がAC-4の要件であるため
- TS-03: high優先度の5テストファイルのうち3件(serena-integration, size-argument, handler-dynamic-categories-unit)は実装フェーズでの修正が確実に必要(BC-01/BC-02)
- TS-04: hook-existence.testはhookバックアップ削除の影響を受ける可能性があるが、テスト対象が稼働中hookファイルのみであれば修正不要。実装時に確認する
- TS-05: phase1-build失敗時はphase2/phase3を実行しない。ビルドエラーの修正を優先する(test-design.md TD-03の早期中断方針に準拠)
- TS-06: testModificationForecastの3件は予測であり、実装フェーズで実際のコンパイルエラー/テスト失敗を基に確定する

## artifacts

- docs/workflows/workflow-harness-refactoring/test-selection.md, test-selection, テスト選択書(14テスト選択/5選択基準/3フェーズ実行計画/3件修正予測)

## next

- 実装フェーズでPL-01〜PL-08を実行後、phase1-build(npm run build)で型エラーを検出
- phase2-full-test(npx vitest run)で回帰テストを実施し、失敗テストをselectedTestsのtestModificationForecastと照合
- high優先度テスト(serena-integration, size-argument, handler-dynamic-categories-unit)の修正を実装ステップと同時に対応
