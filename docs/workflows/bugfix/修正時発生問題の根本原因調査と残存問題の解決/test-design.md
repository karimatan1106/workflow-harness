# テスト設計: 修正時発生問題の根本原因調査と残存問題の解決

## サマリー

- 目的: 本タスクで実施する2件のコード修正（definitions.tsのsecurity_scanテンプレート追記・status.tsのphaseGuideレスポンス削減）が正しく動作することを検証するテストケースを定義する。
- 評価スコープ: 変更対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` と `workflow-plugin/mcp-server/src/tools/status.ts` の2ファイルのみであり、テストはこの2ファイルの変更箇所に集中して設計する。
- 主要な決定事項: 両修正はロジック変更の有無が異なるため、検証戦略も分けて設計する。修正1（definitions.ts）はテンプレート文字列の内容確認を主とする静的検証であり、修正2（status.ts）はMCPレスポンス構造の動的検証を主とする。
- 検証状況: テストはtest_implフェーズで実装され、implementationフェーズ後に実行される。本フェーズはテスト設計のみを行い、実際のテスト実行は行わない。
- 次フェーズで必要な情報: テストファイルの配置先パス（`workflow-plugin/mcp-server/src/tests/` 以下）、実行コマンド（`npm test`）、テストケースIDと検証する具体的なフィールド名（subagentTemplate・content・claudeMdSections）。

## テスト方針

本タスクの変更は独立した2件のファイル修正で構成されており、それぞれ異なる性質のテストが必要となる。

### 修正1のテスト方針: テンプレート文字列の内容検証

`definitions.ts` に追記する文字列は、TypeScriptのテンプレートリテラル内の静的テキストである。
ロジックの変更は一切ないため、テストの目的は「追記後の文字列が期待する内容を含んでいること」の確認に絞る。
具体的には、security_scanサブフェーズのsubagentTemplateに「BUG番号」「評価結論フレーズ」「NG/OK例」のキーワードが含まれることを確認する。
また、既存のNGパターン例（FR-A・FR-Bパターン）が引き続き存在することも検証し、追記によって既存内容が消えていないことを確認する。

### 修正2のテスト方針: APIレスポンス構造の検証

`status.ts` の変更はMCPツールのレスポンス構造を変更するロジック修正である。
テストの目的は「workflow_statusのレスポンスから重量フィールドが除外されていること」と「workflow_nextのレスポンスには引き続き重量フィールドが含まれること」の2点を確認することにある。
前者は修正の主目的であり、後者は後方互換性の確認であり、どちらも同等に重要である。
subPhasesエントリの各フィールドについても同様の検証を行い、parallel_verificationのような複数サブフェーズを持つフェーズでの動作を確認する。

### テスト種別と配置先

ユニットテストを主体として設計し、統合テストは補助的に使用する。
テストファイルの配置先は `workflow-plugin/mcp-server/src/tests/unit/` とする。
テスト実行コマンドは `npm test` または `npx vitest` を使用する。
テストフレームワークは既存プロジェクトで使用されているものに準拠する。

## テストケース

### 修正1: definitions.ts テンプレート文字列検証

#### TC-001: security_scanテンプレートにBUGパターンNG例が含まれること

- 対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 対象箇所: security_scanサブフェーズのsubagentTemplateフィールド
- 検証内容: 追記されたNG例の文字列「評価結果: リスクなし」を含む行の存在確認を行う。
- テスト種別: ユニットテスト（静的文字列検証）
- 期待結果: subagentTemplateの文字列値に「評価結果: リスクなし」という文言が含まれており、これをBUG番号付き行の3件以上繰り返しが問題となる旨のNG例として記載されていること。

#### TC-002: security_scanテンプレートにBUGパターンOK例が含まれること

- 対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 対象箇所: security_scanサブフェーズのsubagentTemplateフィールド
- 検証内容: 追記されたOK例の文字列「BUG-1」「BUG-2」を含む行の存在確認を行う。
- テスト種別: ユニットテスト（静的文字列検証）
- 期待結果: subagentTemplateに「BUG-1（definitions.ts」および「BUG-2（flowchart」のような形式のOK例文字列が含まれること。

#### TC-003: 既存のFR-AパターンのNG/OK例が保持されていること

- 対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 対象箇所: security_scanサブフェーズのsubagentTemplateフィールド
- 検証内容: 追記前から存在するNG/OK例（FR-A・FR-Bパターン）が引き続き含まれていることを確認する。
- テスト種別: ユニットテスト（回帰確認）
- 期待結果: subagentTemplateに「FR-A（state_machine定義）のセキュリティリスク」の文言が含まれており、既存内容が追記によって消去されていないこと。

#### TC-004: 追記テキストが重複行回避の注意事項セクション内に配置されていること

- 対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 対象箇所: security_scanサブフェーズのsubagentTemplateフィールド
- 検証内容: 「## 重複行回避の注意事項」というセクション見出しの後に、BUGパターンのNG/OK例が配置されていることを確認する。
- テスト種別: ユニットテスト（文字列順序検証）
- 期待結果: subagentTemplateの文字列において、「重複行回避の注意事項」の出現位置が「BUG-1」の出現位置より前であること。

#### TC-005: manual_testテンプレートが変更されていないこと

- 対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 対象箇所: manual_testサブフェーズのsubagentTemplateフィールド
- 検証内容: manual_testテンプレートの文字列長または特定の識別文字列が変更されていないことを確認する。
- テスト種別: ユニットテスト（回帰確認）
- 期待結果: manual_testのsubagentTemplateが「# manual_testフェーズ」で始まり、security_scan固有のBUGパターン例を含まないこと。

### 修正2: status.ts phaseGuideレスポンス構造検証

#### TC-006: workflow_statusのレスポンスにsubagentTemplateが含まれないこと

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: phaseGuide設定ブロック（121〜127行目付近）
- 検証内容: workflow_statusのレスポンスオブジェクトのphaseGuideプロパティにsubagentTemplateキーが存在しないことを確認する。
- テスト種別: ユニットテスト（レスポンス構造検証）
- 期待結果: phaseGuideオブジェクトに対してhasOwnPropertyまたはinキーワードで確認したとき、subagentTemplateが存在しないこと。

#### TC-007: workflow_statusのレスポンスにcontentフィールドが含まれないこと

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: phaseGuide設定ブロック（121〜127行目付近）
- 検証内容: workflow_statusのレスポンスのphaseGuideにcontentキーが存在しないことを確認する。
- テスト種別: ユニットテスト（レスポンス構造検証）
- 期待結果: phaseGuideオブジェクトにcontentプロパティが存在しないこと。

#### TC-008: workflow_statusのレスポンスにclaudeMdSectionsが含まれないこと

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: phaseGuide設定ブロック（121〜127行目付近）
- 検証内容: workflow_statusのレスポンスのphaseGuideにclaudeMdSectionsキーが存在しないことを確認する。
- テスト種別: ユニットテスト（レスポンス構造検証）
- 期待結果: phaseGuideオブジェクトにclaudeMdSectionsプロパティが存在しないこと。

#### TC-009: workflow_statusのphaseGuideに必須メタ情報が残っていること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: phaseGuide設定ブロック
- 検証内容: phaseGuideにphaseName・description・requiredSections・allowedBashCategories等のメタ情報フィールドが残存していることを確認する。
- テスト種別: ユニットテスト（レスポンス構造検証）
- 期待結果: phaseGuideにphaseNameプロパティが存在しており、その値が対象フェーズ名と一致すること。またrequiredSectionsが配列として存在し、空ではないこと。

#### TC-010: parallel_verificationフェーズのsubPhasesから重量フィールドが除外されていること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: subPhases処理ブロック
- 検証内容: workflow_statusをparallel_verificationフェーズで呼んだときに、phaseGuide.subPhasesの各エントリ（manual_test・security_scan等）からsubagentTemplate・content・claudeMdSectionsが除外されていることを確認する。
- テスト種別: ユニットテスト（ネストオブジェクト検証）
- 期待結果: phaseGuide.subPhases.security_scanにsubagentTemplateプロパティが存在しないこと。同様にmanual_test・performance_test・e2e_testの各エントリについても確認する。

#### TC-011: subPhasesの各エントリに必須メタ情報が残っていること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: subPhases処理ブロック
- 検証内容: subPhasesの各エントリにphaseNameやrequiredSections等のメタ情報が残存していることを確認する。
- テスト種別: ユニットテスト（ネストオブジェクト検証）
- 期待結果: phaseGuide.subPhases.security_scanにphaseNameとrequiredSectionsプロパティが存在しており、値が正しいこと。

#### TC-012: idle/completedフェーズではphaseGuideが返されないこと

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: phase判定条件（122行目のif文）
- 検証内容: タスクフェーズがidleまたはcompletedの場合、レスポンスにphaseGuideが含まれないことを確認する。
- テスト種別: ユニットテスト（条件分岐検証）
- 期待結果: idleフェーズのタスクでworkflow_statusを呼んだときにphaseGuideが結果オブジェクトに存在しないこと。completedフェーズでも同様であること。

### 後方互換性検証

#### TC-013: workflow_nextのレスポンスにsubagentTemplateが引き続き含まれること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`（変更しないファイル）
- 対象箇所: phaseGuide設定ブロック
- 検証内容: workflow_nextのレスポンスのphaseGuideにsubagentTemplateが含まれることを確認する。
- テスト種別: ユニットテスト（後方互換性確認）
- 期待結果: workflow_nextのレスポンスのphaseGuideにsubagentTemplateプロパティが存在し、空文字列でない値を持つこと。

#### TC-014: workflow_nextのsubPhasesエントリにもsubagentTemplateが残っていること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`（変更しないファイル）
- 対象箇所: parallel_verificationフェーズのsubPhases処理
- 検証内容: workflow_nextのレスポンスのphaseGuide.subPhasesの各エントリにsubagentTemplateが含まれることを確認する。
- テスト種別: ユニットテスト（後方互換性確認）
- 期待結果: workflow_nextのphaseGuide.subPhases.security_scanにsubagentTemplateが存在し、内容が空でないこと。

### ビルド・統合検証

#### TC-015: npm run buildが正常終了すること

- 対象: MCPサーバーのビルドプロセス全体
- 検証内容: 2件の修正を適用した後にnpm run buildを実行し、TypeScriptコンパイルがエラーなく完了することを確認する。
- テスト種別: 統合テスト（ビルド検証）
- 期待結果: ビルドコマンドの終了コードが0であり、dist/以下のJavaScriptファイルが更新されること。

#### TC-016: TypeScript未使用変数エラーが発生しないこと

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 検証内容: delete演算子を使用した実装においてTypeScriptの型エラーが発生しないことをビルドログで確認する。
- テスト種別: 統合テスト（コンパイルエラー検証）
- 期待結果: ビルドログに「unused variable」や「implicitly has type 'any'」等の警告・エラーが含まれないこと。

## 境界値・エラーケーステスト

### subPhasesがnullまたは未定義の場合の安全性確認

#### TC-017: subPhasesが存在しないフェーズでワークフローステータスが正常に返ること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: subPhases処理の null-safe 分岐
- 検証内容: researchフェーズのようなsubPhasesを持たないフェーズでworkflow_statusを呼んだときに例外が発生しないことを確認する。
- テスト種別: ユニットテスト（エラーハンドリング検証）
- 期待結果: subPhasesがないフェーズでもワークフローステータスが正常なレスポンスオブジェクトを返し、例外が発生しないこと。

#### TC-018: subPhasesのエントリが空オブジェクトの場合に安全に処理されること

- 対象ファイル: `workflow-plugin/mcp-server/src/tools/status.ts`
- 対象箇所: subPhases内のforループとdelete処理
- 検証内容: サブフェーズエントリが空オブジェクトや予期しない型の場合でもエラーが発生しないことを確認する。
- テスト種別: ユニットテスト（境界値検証）
- 期待結果: subPhase要素がnullや非オブジェクトの場合でも処理が継続し、例外が発生しないこと。

## テスト実行計画

テストの実行順序として、まずTC-001〜TC-005の静的検証を実行して修正1が正しく適用されていることを確認する。
次にTC-006〜TC-014のレスポンス構造検証を実行して修正2の動作と後方互換性を確認する。
最後にTC-015〜TC-016のビルド検証とTC-017〜TC-018のエラーケース検証を実行する。

テストがすべてパスした後、実装フェーズ完了の判断基準として以下の3点を確認する。
まずdist/phases/definitions.jsがinitialバージョンより後の更新日時を持っていること。
次にdist/tools/status.jsが同様に更新されていること。
最後にMCPサーバーの再起動後にworkflow_statusを実際に呼び出してphaseGuideにsubagentTemplateが存在しないことを目視確認すること。

実装フェーズでのテストファイル配置先は `workflow-plugin/mcp-server/src/tests/unit/` とし、ファイル名は以下の通りとする。
修正1のテスト: `definitions-security-scan-template.test.ts`
修正2のテスト: `status-phase-guide-slim.test.ts`
後方互換性テスト: `next-phase-guide-backward-compat.test.ts`
