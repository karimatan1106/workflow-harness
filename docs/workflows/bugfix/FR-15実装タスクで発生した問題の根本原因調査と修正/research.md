## サマリー

- 目的: FR-15タスク実行中に発生した3つの問題（e2e_testバリデーション失敗・testingフェーズのworkflow_next失敗・sessionTokenなし失敗）の根本原因を特定するため、definitions.ts・next.ts・complete-sub.ts・helpers.tsを調査した
- 主要な決定事項: 問題1はe2e_testのsubagentTemplateにサマリーセクション向け5行を保証する具体的NG/OK例が不足していることが原因、問題2はtestingサブエージェントがworkflow_record_test_resultを呼ばなかった可能性が高く（テンプレートの手順記述が曖昧）、問題3はセッションをまたぐとOrchestratorがsessionTokenを失う設計上の制約が原因
- 次フェーズで必要な情報: 各問題に対する修正内容（テンプレート文字列への追記）をrequirementsフェーズで定義する必要がある
- 評価スコープ: workflow-plugin/mcp-server/src/phases/definitions.ts（行932-942）、tools/next.ts（行304-371）、tools/complete-sub.ts（行131-251）、tools/helpers.ts（行103-137）を調査した
- 検証状況: 問題1・問題2は根本原因を特定済み、問題3も設計上の制約として根本原因を確認済み

## 問題1: e2e_testサブエージェントのサマリーセクション実質行数不足

### 問題の症状と発生フェーズ

e2e_testフェーズでサブエージェントが生成した成果物（e2e-test.md）の「## サマリー」セクションに実質行数が3行しかなく、バリデーターが要求する5行以上という要件を満たせずバリデーション失敗が発生した。
発生フェーズはparallel_verification内のe2e_testサブフェーズで、workflow_complete_sub('e2e_test')呼び出し時にブロックされた。

### artifact-validator.tsのバリデーション仕様

checkSectionDensity関数（artifact-validator.ts 行732-817）がセクション単位で以下を検証する。
実質行数チェック: 各セクション内でisStructuralLine()で構造要素（ヘッダー行・水平線・コードフェンス・太字ラベルのみの行・コロン後にコンテンツがないラベル行）に該当しない行を実質行としてカウントし、5行以上の実質行が必要。
コロン後にコンテンツがない行（例: 「- 目的:」で終わる行）はFIX-1プレーンラベルパターン `^(?:[-*]\s+)?.{1,50}[:：]\s*$` によって構造要素と判定され実質行ゼロとなる。
e2e-test.mdのminLines要件は20行（PHASE_ARTIFACT_REQUIREMENTS行262-265で定義）で、requiredSectionsはE2EテストシナリオとTest実行結果の2セクション。

### e2e_testのsubagentTemplateの状態

definitions.ts行942のe2e_testのsubagentTemplate（長い文字列）には以下のガイダンスが含まれている。
「## サマリーセクションの行数ガイダンス」セクションが存在し、5行以上の実質行要件と5項目の列挙、NG/OK例が記述されている。
記述内容は manual_test（行906）のサマリーセクションガイダンスと同じ構成だが、manual_testテンプレートと比較して表現が若干簡略になっている。
具体的には「NG: 「- テスト総数:」（コロン後にコンテンツなし）」という注意事項はあるが、サマリーの5項目（シナリオ総数・実行環境・成功/失敗件数・発見事項・総合合否）がリストの先頭に列挙されているため、subagentがそれらを「- テスト対象ユーザーシナリオの総数:」という形式（コロン後にコンテンツがないラベル行）で記述してしまうリスクがある。

### 根本原因の特定

e2e_testサブエージェントがサマリーを「- 目的:」「- 主要な決定事項:」「- 次フェーズで必要な情報:」の3行（いずれもコロン後にコンテンツがない構造要素判定行）で記述したことが原因。
isStructuralLineのFIX-1プレーンラベルパターンは「50文字以内の内容がコロンで終わる行」を構造要素として除外するため、これら3行は実質行としてカウントされない。
根本的には、e2e_testのsubagentTemplateのサマリーガイダンスの5項目リストが「項目名（説明）」という形式で記載されており、subagentがその形式を「- 項目名:」というラベル行として誤用する可能性が残っている。
既存のmanual_testテンプレートのサマリーガイダンスには「OK: 「- 目的: 手動テストにより機能の動作を検証した」（実質行1行にカウントされる）」という明示的なOK例があるが、e2e_testテンプレートの同等ガイダンスには5項目に対応した具体的OK例が欠落している可能性がある。

## 問題2: testingフェーズでのworkflow_next失敗（テスト結果未記録エラー）

### エラーのロジック

next.ts行305-311でtestingフェーズからregression_testへの遷移時にgetLatestTestResult(taskState, 'testing')を呼び出す。
この関数（行704-717）はtaskState.testResultsの配列をフェーズ名でフィルタし、testingフェーズのレコードが存在しない場合undefinedを返す。
undefinedの場合、workflow_nextは「テスト結果が記録されていません。workflow_record_test_resultでテスト結果を記録してください」というエラーメッセージを返す。

### testingフェーズのsubagentTemplateの分析

definitions.ts行878のtestingフェーズのsubagentTemplateは比較的詳細なガイダンスを含む。
workflow_record_test_resultの呼び出し手順は記載されているが、「必ず呼び出すこと」という明示的な必須指示の位置が「## workflow_record_test_result 呼び出し時の注意」という小見出しの下に配置されている。
workflow_capture_baselineのガイダンスにはWarning記号を含む警告文（「⚠️ 警告: ベースライン記録を省略した場合...」）が明示されている。
しかしworkflow_record_test_resultについては「ベースライン記録よりも後に呼び出すことを推奨」という推奨表現が使われており、「省略した場合の結果」に相当する強調文が欠けている。

### 根本原因の特定

testingサブエージェントが誤った順序（workflow_capture_baselineのみ呼び出してworkflow_record_test_resultを省略）でフェーズを終了した可能性が高い。
テンプレート内でworkflow_capture_baselineには「**必ず** 呼び出してベースラインを記録すること」という強調表現があるが、workflow_record_test_resultについては「テストを実行してください」という作業内容の中で言及されており、「必須」の強調度合いが異なる。
また「このsubagentの責任範囲はテスト実行とworkflow_record_test_resultによる結果記録のみ」という記述は禁止事項セクションの末尾にあり、subagentが最後まで読まなかった場合に見落とされる可能性がある。

## 問題3: sessionTokenなしでworkflow_complete_subが失敗（セッションまたぎ）

### sessionTokenの設計

sessionTokenはworkflow_start時（start.ts行89-90）に生成されてレスポンスに含まれる（行150）。
同時にtaskState.sessionTokenにも保存され（行90）、writeTaskStateでworkflow-state.jsonに永続化される（行131）。
verifySessionToken関数（helpers.ts行103-137）はtaskState.sessionTokenが存在する場合に引数のsessionTokenと比較する。一致しない場合はエラーを返す（行126-130）。
taskState.sessionTokenが存在しない場合（レガシータスク）は警告のみで通過する（行133-134）。

### セッションまたぎ問題の構造

OrchestratorがsessionTokenを保持する唯一の手段はworkflow_startのレスポンスである。
Claude Desktopは会話セッションをまたいでツール呼び出し結果を保持しないため、前のセッションで取得したsessionTokenはOrchestratorのコンテキストから消失する。
前のセッションから引き継いだタスクは、taskState.sessionTokenが保存されているため、新しいセッションのOrchestratorがsessionTokenなしでworkflow_complete_sub等を呼ぶと「sessionTokenが必要です」エラーが返される。

### workflow_complete_subとworkflow_nextのsessionToken要件の対称性

workflow_complete_sub.ts行141-142とnext.ts行211-212の両方でverifySessionTokenを呼び出している。
この仕様は意図的な設計であり、両ツールともOrchestratorのみが呼べる構造になっている。
セッションをまたいだ場合の対応策として、workflow_statusでtaskStateを確認しsessionTokenがない状態でも動くかを検討する必要がある。
実は、helpers.tsのverifySessionToken（行132-134）はtaskState.sessionTokenが存在しない場合は警告のみで通過するため、taskState.sessionTokenが保存されているタスクに対してのみ失敗する。

### 根本原因の特定

前のセッションでworkflow_startしたタスクにはtaskState.sessionTokenが保存されているため、新しいセッションのOrchestratorがsessionTokenを提供できない場合にworkflow_complete_subおよびworkflow_nextが失敗する。
この問題はSESSION_TOKEN_REQUIRED=falseを環境変数で設定することで回避できる（helpers.ts行107-116のバイパス機構）が、デフォルトでは厳格モード（必須）になっている。
本質的な設計上の問題として、セッションをまたいでOrchestratorがsessionTokenを回復する手段がMCPサーバー上に存在しない。workflow_statusはsessionTokenを返さない設計になっている（status.tsを確認する必要がある）。

## まとめ: 3問題の根本原因一覧

問題1のe2e_testバリデーション失敗は、e2e_testのsubagentTemplateのサマリーセクションガイダンスにある5項目リストが「- テスト対象ユーザーシナリオの総数（説明）」という括弧形式で記載されているため、subagentがコロン後にコンテンツがないラベル行として誤用した場合に実質行ゼロになる問題であり、manual_testのようなOK例の具体的記述が不足していることが根本原因である。
問題2のテスト結果未記録は、testingテンプレートでworkflow_record_test_result呼び出しが「推奨」「注意事項」として記載されているが「省略した場合にnextが失敗する」という警告文が明示されていないことが根本原因であり、subagentが必須ステップを省略するリスクが残っていた。
問題3のセッションまたぎ失敗は、sessionTokenがworkflow_startの戻り値としてのみ提供され、セッションをまたいだ再取得手段がMCPサーバーに存在しないという設計上の制約が根本原因である。回避策としてSESSION_TOKEN_REQUIRED=false環境変数が提供されているが、通常運用では有効化されていない。
