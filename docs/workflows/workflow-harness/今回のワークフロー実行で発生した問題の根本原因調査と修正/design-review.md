# 設計レビュー - 今回のワークフロー実行で発生した問題の根本原因調査と修正

## サマリー

本レビューは、FR-6・FR-7・FR-8の3件の設計成果物（spec.md、state-machine.mmd、flowchart.mmd、ui-design.md）を対象に実施した。

評価スコープは `workflow-plugin/mcp-server/src/phases/definitions.ts` の3フェーズ（testing・test_impl・docs_update）に対するsubagentTemplate修正設計である。

主要な決定事項として、設計は全3件の要件を適切に網羅しており、実装可能性・一貫性・完全性の各観点でレビュー合格基準を満たしていると判断する。特筆すべき問題は2点確認されたが、いずれも実装フェーズで対処可能な軽微な課題である。

検証状況として、definitions.tsの現行コードを実際に参照し、行番号・現在の内容・設計が想定する追記位置の整合性を確認済みである。行番号は現行コードと仕様書の記述（行782・行878・行953）が一致していることを確認した。

次フェーズ（test_design）では本レビューで指摘した2点の軽微な課題に留意しつつ、テスト設計を進めることを推奨する。承認可とする。

## 設計の完全性

### FR-6: testingフェーズへのworkflow_capture_baseline呼び出し手順追加

FR-6に関する設計内容は要件書（requirements.md）の受け入れ条件を全て満たしている。

spec.mdのFR-6実装計画では、追記する5項目（呼び出し義務・4パラメータ説明・数値抽出方法・遷移ブロック警告・記録結果活用案内）が明確に定義されている。ui-design.mdにはworkflow_capture_baselineのパラメータ仕様と成功レスポンス形式が詳細に記述されており、実装担当者が迷わない水準の具体性が確保されている。

requirements.mdの受け入れ条件「testingサブエージェントがテスト実行後にworkflow_capture_baselineを呼び出すこと」に対し、spec.mdは「テスト実行後にworkflow_capture_baselineを呼び出すことが必須であるという明示的な指示」を追記内容として定義しているため、対応関係が明確である。

既存の`workflow_record_test_result`に関する指示を変更しない後方互換性への配慮もspec.md行76に明示されており、NFR-3（後方互換性の確保）に対応している。

### FR-7: test_implフェーズへの出力ファイル指定と作成指示追加

FR-7の設計はrequirements.mdの要件を全て反映している。spec.mdのFR-7実装計画（行79〜103）には追記する4セクションが列挙されており、それぞれの内容が具体的に記述されている。

プロジェクト固有のテストディレクトリ構造（`src/phases/__tests__/`・`src/tools/__tests__/`・`src/validation/__tests__/`・`src/__tests__/`）の案内がspec.md行101〜103に記載されている点は、汎用的なテンプレートよりも実用的な設計判断として評価できる。手動確認手順のみの場合の取り扱い（テストファイル不作成のケース）についても設計に含まれており、FR-7の補足要件（requirements.md行58〜62）が漏れなく反映されている。

ただし、requirements.mdの行51に「`workflow-plugin/mcp-server/src/tests/`が標準テストディレクトリである」と記述されているが、spec.mdの行93では`__tests__`サブディレクトリ方式として定義が変更されている。この変更は実際のディレクトリ構造を調査した結果として正当化されているが、requirements.mdの記述との乖離が生じている点は実装フェーズで留意が必要である。この乖離は要件定義上の情報不足によるものであり、spec.mdの定義を正式なものとして採用することを推奨する。

### FR-8: docs_updateフェーズへの更新対象範囲明示

FR-8の設計はrequirements.mdの受け入れ条件を全て満たしている。spec.mdのFR-8実装計画（行106〜127）では4セクション（更新対象ドキュメント・更新禁止ファイル・更新対象が存在しない場合の取り扱い・ワークフロー制御ツール禁止）が明確に定義されている。

ui-design.mdの「設定ファイル設計」セクションには更新許可パスリストと更新禁止パスリストが詳細に記述されており、requirements.mdの「docs/workflows/{taskName}/配下・MEMORY.md・.claude/state/配下が更新対象外」という受け入れ条件と完全に対応している。

NFR-7（内部状態ファイルの保護）に対して、.claude/state/配下ファイルをHMAC整合性チェックと結びつけて禁止理由を説明する設計になっている点は、技術的根拠が明確であり質が高い。

## 設計の一貫性

### spec.mdとstate-machine.mmdの一貫性

state-machine.mmdはtestingフェーズのサブエージェントが辿る処理フローを表現しており、FR-6で追加するworkflow_capture_baselineの呼び出しがRecordBaselineステップとして正確に図式化されている。

ステートマシン図の各状態（PrepareTest・RunTests・RecordBaseline・ExtractMetrics・RecordTestResult・UpdateReport）はspec.mdのFR-6実装計画で定義した5項目と整合している。特に`CheckBaseline`状態と`Error1`状態が定義されており、ベースライン記録失敗時のエラーハンドリングも設計に含まれている点は一貫している。

一点、state-machine.mmdでは`Error1`・`Error2`が共に最終状態`End`に遷移する設計になっているが、spec.md行70には「遷移ブロック警告」として「ベースライン記録を省略した場合にregression_testフェーズへの遷移がブロックされる」と記述されている。これはsubagentが呼び出しを省略するケースの警告であり、呼び出しを試みてエラーとなった場合のフローを示すstate-machine.mmdと矛盾するものではないが、設計書上の区別が曖昧になっている。実装担当者が混乱しないよう、test_designフェーズでの補足説明を推奨する。

### spec.mdとflowchart.mmdの一貫性

flowchart.mmdはFR-6・FR-7・FR-8の3つの修正を直列処理フローとして表現しており、spec.mdの「実装は3ステップ（FR-6・FR-7・FR-8の順）で行う」という実装計画と整合している。

FR-7の`FR7_TestDirGuide`ノードがspec.mdの「テストディレクトリ選択のガイダンス」セクション（行101〜103）に対応していることを確認した。FR-8の5つのノード（FR8_PermittedDocs・FR8_ProhibitedFiles・FR8_NoTargetCase・FR8_ToolProhibit・FR8_Verify）がspec.mdのFR-8追記内容4セクションと対応している点も確認した（FR8_PermittedDocsとFR8_ProhibitedFilesが「更新対象ドキュメント」セクションに、FR8_NoTargetCaseと FR8_ToolProhibitが残り3セクションに対応）。

ビルド・テスト・MCPサーバー再起動の手順（BuildCheck・BuildVerify・TestRun・TestVerify・MCPRestart・FinalVerify）がflowchart.mmdに含まれており、spec.md行149〜151の実装手順4に記述された内容と完全に一致している。

### spec.mdとui-design.mdの一貫性

ui-design.mdはFR-6・FR-7・FR-8それぞれのMCPツール呼び出し仕様を詳細に定義しており、spec.mdで定義した「CLIインターフェース設計」としての役割を正確に担っている。

ui-design.mdのworkflow_capture_baselineパラメータ仕様（taskId・totalTests・passedTests・failedTests）はspec.mdのFR-6追記内容（行66〜67）と完全に対応している。workflow_record_testのパラメータ仕様もspec.mdのFR-7追記内容（行95）と一致している。

エラーメッセージ設計セクションには3種類のエラーパターンが定義されており、仕様書がハッピーパスのみでなくエラーケースもカバーしている点は設計の完成度が高いと評価できる。

## 実装可能性

### definitions.tsへの実装の技術的検証

実際にdefinitions.tsを参照し、以下を確認した。

行782のtest_implテンプレートは現在「テストコードを実装してください（TDD Red）。」で終わる文字列であり、spec.mdが想定する追記位置（末尾の引用符の前）への文字列追記が技術的に実現可能である。追記量は4セクション分であり、テンプレート文字列の長さが著しく増加するものの、TypeScriptの文字列リテラルとしての上限を超えない範囲であることを確認した。

行878のtestingテンプレートは既に詳細なセクション構造（workflow_record_test_result・sessionToken・ワークフロー制御ツール禁止の3セクション）を持っており、spec.mdが指定する挿入位置「workflow_record_test_resultセクションの末尾とsessionTokenセクションの先頭の間」への挿入が可能であることを確認した。

行953のdocs_updateテンプレートは現在「ドキュメントを更新してください。」のみの極めて短いテンプレートであり、末尾への4セクション追記が最も容易な修正対象である。

3件の修正はいずれもEditツールによるstring置換で実現可能であり、JavaScriptの動的なコード生成や関数分割を必要としない。

### ビルドとMCPサーバー再起動の手順

spec.md行149〜151の実装手順4（ビルドとMCPサーバー再起動）は技術的に正確であり、CLAUDE.mdの「コアモジュール変更後はMCPサーバーを再起動してからフェーズに進むこと」というルール22に準拠している。

## リスク評価

### リスク1: state-machine.mmdのスコープ限定

state-machine.mmdがtestingフェーズのサブエージェントの状態遷移のみを表現しており、test_implおよびdocs_updateフェーズの設計が図式化されていない。FR-7とFR-8の修正はsubagentTemplateへの文字列追記のみであり、サブエージェントの状態遷移が変化するわけではないため、この省略は合理的な判断と評価できる。実装フェーズでの混乱を防ぐため、test_designフェーズでこの補足を行うことを推奨する。

### リスク2: requirements.mdとspec.mdのテストディレクトリパス不一致

requirements.mdの行51では「`workflow-plugin/mcp-server/src/tests/`が標準テストディレクトリ」と記述されているが、spec.mdでは「`__tests__`サブディレクトリ方式」として定義が変更されている。これはresearchフェーズでのディレクトリ構造調査により実際の構造に合わせた修正であり、設計上は正当である。ただし、test_implサブエージェントが参照するパスがspec.mdのものでなくrequirements.mdのものであった場合、テストファイルが誤ったディレクトリに配置されるリスクがある。実装フェーズでは必ずspec.mdのパスを参照するよう指示することを推奨する。

### リスク3: subagentTemplateの行数増加によるコンテキスト負荷

3件の修正後、特にtestingフェーズのsubagentTemplateは追記前の文字列（約1800文字）に5項目分が追加されるため、最終的に2500文字程度になることが予測される。他フェーズのsubagentTemplate（regression_testの約1200文字等）と比較して長くなるが、subagentのコンテキストウィンドウ（1Mトークン）の観点では問題のない範囲である。

### リスク4: docs_updateフェーズのエラーハンドリング設計の欠如

ui-design.mdにはworkflow_capture_baselineとworkflow_record_testのエラーメッセージが定義されているが、docs_updateフェーズの「更新対象が存在しない場合」以外のエラーパターンは定義されていない。実装フェーズで追加のエラーハンドリングが必要になる可能性は低いが、念のためtest_designフェーズで考慮することを推奨する。

## 承認推奨

本レビューの結論として、設計を承認可とする。

3件の設計は互いに矛盾せず、要件書との対応関係が明確であり、definitions.tsへの実装が技術的に実現可能であることを確認した。

指摘した2件の軽微な課題（テストディレクトリパスの不一致・state-machine.mmdのスコープ限定）は実装フェーズまたはtest_designフェーズで解消可能な水準であり、設計の根本的な欠陥ではない。

test_designフェーズ以降では、FR-7のテストディレクトリパスとしてspec.mdが定義する`__tests__`サブディレクトリ方式（`src/phases/__tests__/`等）を参照パスとして採用し、requirements.mdの`src/tests/`という記述は上書きされたものとして扱うことを推奨する。
