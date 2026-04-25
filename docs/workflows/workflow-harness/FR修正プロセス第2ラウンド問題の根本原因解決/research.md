## サマリー

- 目的: 前回（FR修正プロセス第1ラウンド）の実行中に発生した4件の問題（regression_testの繰り返し拒否、manual_testサマリー不足、security_scanの重複行、performance_testサマリー不足）の根本原因を特定し、次フェーズ以降で実施すべき修正方針を示す
- 主要な決定事項: 問題の根本はdefinitions.tsのsubagentTemplateが品質要件ガイダンスを省略していることに集約されており、regression_testに限ってはvalidateTestAuthenticity関数の要求仕様との不一致が追加的な根本原因として存在する
- 次フェーズで必要な情報: 各問題の直接原因・根本原因・修正方針（definitions.tsのどのフィールドをどのように変更するか）を requirements フェーズに引き渡す

---

## 調査結果

### 問題1: regression_testフェーズでworkflow_nextが繰り返し拒否された

#### 症状の詳細

症状Aとして「リグレッションテスト出力が以前と同一です（コピペの可能性）」が返され、症状Bとして「テスト出力にテストフレームワークの構造が含まれていません」が返された。最終的に `RUN` ヘッダーと個別テストファイル行を含めることで解決したが、3回以上のリトライが発生した。

#### コード調査結果: next.tsのregression_test遷移チェック

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts` の339行目付近で以下の処理が実行される。

1. `recordTestOutputHash` でSHA-256ハッシュを計算し、既存ハッシュと比較する。同一ハッシュが存在すると「リグレッションテスト出力が以前と同一です（コピペの可能性）」を返す（348行目）。
2. `validateTestAuthenticity` でテスト出力の真正性を検証する。この関数は `TEST_OUTPUT_INDICATORS` パターンに出力が一致しない場合、または `TEST_FRAMEWORK_PATTERNS` で数値が抽出できない場合に「テスト出力にテストフレームワークの構造が含まれていません」を返す（104行目）。

#### コード調査結果: validateTestAuthenticityの詳細

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\test-authenticity.ts` を調査した。

`TEST_FRAMEWORK_PATTERNS` には以下が含まれる。vitest / jest などが出力する集計行パターン（`Test Files N passed`、`Tests: N passed`）、カスタムランナー向けパターン（`passed: N`、`failed: N`、`total: N`）が含まれている。このため、サマリー行に「passed」「failed」「total」のいずれかが含まれていれば数値抽出に成功する。

`TEST_OUTPUT_INDICATORS` には単純文字列 `'passed'`、`'failed'`、`'total'` が含まれるため、これらのいずれかが出力に含まれていれば「テスト出力らしい」と判定される。

一方、`recordTestOutputHash` は出力の完全なSHA-256ハッシュで重複チェックを行うため、testing フェーズで記録した出力と1文字でも異なれば別ハッシュになる。regression_test フェーズで testing フェーズと同一テキストを渡した場合のみ重複判定が発生する。

#### 根本原因の特定

症状Bの「テスト出力にテストフレームワークの構造が含まれていません」が最初に発生した原因は、subagentが出力として「テスト結果の要約を人間向けに整形したもの」を提出していたからと推測される。たとえば「テストが完了しました。全X件成功」のような日本語サマリーだけでは `TEST_FRAMEWORK_PATTERNS` も `TEST_OUTPUT_INDICATORS` も一致しない。

症状Aの「以前と同一です」は、修正後の出力が直前の提出と偶然一致した場合、または testing フェーズの出力と同一テキストを流用した場合に発生する。

definitions.tsのregression_testフェーズの `subagentTemplate`（871行目）には「workflow_record_test_result 呼び出し時の注意」セクションが記載されているが、以下の点が不足していた。

- 出力テキストに必ず `passed` / `failed` / `total` のいずれかの語句と数値を含めることの明示
- vitest / jest 形式の集計行（`Test Files N passed`、`Tests: N passed` 等）の形式例の提示
- テストコマンドの実際の標準出力をそのまま渡すこと（整形・翻訳しないこと）の指示

testing フェーズ（862行目）にも同様のテンプレートが存在するが、どちらも同じ不足点を抱えている。

---

### 問題2: manual_testのサマリーが4行で5行要件を満たさなかった

#### コード調査結果: セクション密度チェック

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\validation\artifact-validator.ts` の `checkSectionDensity` 関数（729行目）は、各 `##` セクション内の実質行数（空行・水平線・コードフェンス除外）が 5行以上であること、かつ密度が0.3以上であることを要求する。

`isStructuralLine` 関数（92行目）の判定により、以下の行は実質行としてカウントされない。

- `- **ラベル**:` 形式（コロン後にコンテンツがない行）
- 水平線（`---`）
- 空白行
- コードフェンス内の行
- 50文字以内でコロン終端のラベル行（「目的:」「検証方法:」など）

#### 根本原因の特定

manual_test の `subagentTemplate`（889行目）はサマリーセクションの最低行数要件を記載していない。CLAUDE.md の subagentTemplate には「## サマリー（200行以内）」と書かれているが、5行以上の実質行を含めるという制約は成果物品質要件セクションに記述されており、subagentTemplateには含まれていない。

subagentはCLAUDE.mdのpromptから品質要件を読み取るが、定義ファイル内のテンプレートには詳細なガイダンスが不足しており、「目的:」「主要な決定事項:」「次フェーズで必要な情報:」の3つのラベル行のみを書けば要件を満たすと誤解するリスクがある。これらラベル行はすべて50文字以内のコロン終端のため実質行としてカウントされない。

---

### 問題3: security_scanで同一行が5回重複検出された

#### コード調査結果: 重複行検出ロジック

`artifact-validator.ts` の384行目の重複行検出は、コードフェンス外の行においてトリム後に完全一致する行が3回以上出現するとエラーを返す。`isStructuralLine` で除外される行のパターンに「50文字を超える行」は含まれない。

前回の security-scan.md を確認すると、各 FR（FR-A から FR-E）に対して同じフォーマットで記述されており、「セキュリティ判定: 問題なし」という50文字以内のコロン終端行がルール8（プレーンラベル行）により除外対象となったが、「外部入力の関与:」という行は50文字以内のコロン終端のため除外された一方、長い評価文（50文字超）が5項目で同一内容になった場合に重複検出された。

#### 根本原因の特定

security_scan の `subagentTemplate`（902行目）には「重複行回避の注意事項」が存在しない。manual_test のテンプレートには重複行回避のガイダンスが追記済み（前回の FR-C で修正済み）だが、security_scan は同様の修正が適用されていない。

複数の対象（FR-A〜FR-E）を同一フォーマットで評価する性質上、subagentは各項目で類似した構造の行を生成しやすく、テンプレートに指示がなければ重複が発生する。

---

### 問題4: performance_testのサマリーが3行で5行要件を満たさなかった

#### 根本原因の特定

performance_test の `subagentTemplate`（914行目）にはサマリーセクションの最低行数ガイダンスが存在しない。問題2（manual_test）と同じ構造的な原因であり、ラベル行のみを列挙した短いサマリーを生成した場合に5行の実質行要件を満たせない。

performance_test のテンプレートは「パフォーマンステストを実施してください」という最小限の指示のみで、サマリーを充実させる指示が欠如している。

---

## 既存実装の分析

### definitions.tsのsubagentTemplate比較

調査した7つのサブフェーズ（manual_test, security_scan, performance_test, e2e_test, testing, regression_test）のテンプレートを比較した結果、以下のパターンが判明した。

manual_testは前回の FR-C 修正により重複行回避のガイダンスが追記されたが、security_scan、performance_test、e2e_test の3フェーズには同様のガイダンスが存在しない。複数シナリオや複数評価対象を扱う可能性がある全フェーズに対して重複行回避の注意事項を追記する必要がある。

testing と regression_test のテンプレートには「テスト結果を整形してから渡すこと」という注意事項が記載されているが、「実際のテストフレームワーク出力形式（`Test Files N passed` など）を含めること」という具体的なフォーマット例が不足している。subagentが日本語サマリー形式で提出することを防ぐには、フレームワーク集計行の形式例の明示が必要である。

### artifact-validator.tsのisStructuralLine挙動

50文字以内でコロン終端の行がすべて実質行としてカウントされないという挙動は、複数フェーズの成果物に影響している。特に以下の行形式は注意が必要である。

- 「- 目的:」「- 方法:」「- 結果:」などの箇条書きラベル行（コロン後にコンテンツがないとカウントされない）
- 「セキュリティ判定:」「外部入力の関与:」のような評価行（コロン後の内容が空白のみ）

subagentTemplateに「ラベル行のみでなくコロン後に実際のコンテンツを続けること」という明示的な指示を追記することで、この問題を防げる。

### テスト真正性検証の要求仕様

`validateTestAuthenticity` は `passed`、`failed`、`total` のいずれかの語句を含む出力を「テスト出力らしい」と判定するため、純粋な日本語サマリー（例:「テストが正常完了しました」）では判定に失敗する。subagentが実際のテストコマンド出力を加工せずにそのまま記録するよう指示することが、この問題の根本的な解決策となる。
