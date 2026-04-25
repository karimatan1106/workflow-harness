## サマリー

本タスクは `definitions.ts` の `manual_test` および `security_scan` のsubagentTemplateに存在するガイダンス不足を修正する。
`manual_test` では `## 総合評価` セクションへの記述ガイダンスが完全に欠落しており、subagentが自己判断で追加した際に実質行数（minSectionLines=5）を満たせない問題が発生している。
`security_scan` では `minLines: 20` を達成するための行数計算ロジックの説明が不足しており、subagentが各セクションを最低限の行数で記述した際に全体行数が不足する問題が生じている。
修正対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` のsubagentTemplateと、`definitions-subagent-template.test.ts` のテストスイートである。
両問題とも既存の性能テスト（performance_test）で実施済みのFR-9・FR-10と同様のアプローチで解決可能であり、一貫したガイダンスパターンを適用する。

## 問題の全体像

### 問題1: manual_testの `## 総合評価` セクション実質行数不足

subagentTemplateには `## テストシナリオ` と `## テスト結果` のガイダンスのみ記述されており、`## 総合評価` セクションへのガイダンスが存在しない。
subagentが自己判断でこのセクションを追加した場合、ガイダンスなしでは1段落（実質1行）程度の記述に留まることが多く、minSectionLines（5行）要件を満たせない。
`performance_test` にはFR-9として同等のガイダンスが追加済みだが、`manual_test` には横展開されていない。
現状のrequiredSectionsは `['## テストシナリオ', '## テスト結果']` のみで、`## 総合評価` は必須ではないため、バリデーターも警告を出しにくい状況にある。
テストスイートにもFR-11に相当する検証テストが存在せず、ガイダンス欠落が検知されていない。

### 問題2: security_scanの全体行数不足

`minLines: 20` が設定されているが、行数達成のための具体的な計算例がsubagentTemplateに存在しない。
subagentが3つの必須セクション（`## 脆弱性スキャン結果`・`## 検出された問題`・`## サマリー`）それぞれに5行ずつ書いた場合、合計15行となるが、これだけでは目標の20行に届かない。
既存のガイダンスは「内容を充実させて非空行を確保すること」という抽象的な表現のみであり、具体的な数値目標や計算根拠が示されていない。
FR-12に相当するテストスイートも存在せず、ガイダンスの充実度が定量的に検証されていない。

### テストの欠落

`definitions-subagent-template.test.ts`（161行）には以下のテストスイートが存在する。
FR-9（performance_test総合評価ガイダンス）3テスト、FR-10（performance_testテスト実行証拠ガイダンス）2テストが実装済みである。
一方、FR-11（manual_testの総合評価ガイダンス）とFR-12（security_scanの行数確保ガイダンス）は欠落しており、今回の修正に合わせて追加が必要である。

## 根本原因分析

### manual_testガイダンス欠落の根本原因

parallel_verificationフェーズのサブフェーズ（manual_test・security_scan・performance_test・e2e_test）は過去に個別の問題が発見されたタイミングで修正が積み重ねられてきた。
performance_testにはFR-9として `## 総合評価` セクションの記述ガイダンスが追加されたが、同様の問題が将来発生しうるmanual_testへの横展開が行われなかった。
ガイダンス追加はその時点で問題が報告されたフェーズのみに適用されており、類似フェーズへの予防的な適用がなされていない設計方針が原因である。
artifact-validatorのminSectionLines要件（5行）は全ての `## ` セクションに適用されるが、subagentTemplateが想定していないセクションへのガイダンスは当然存在しない。
この非対称性が、subagentの自己判断による追加セクションでバリデーション失敗を引き起こす構造的な問題となっている。

### security_scan行数不足の根本原因

`minLines: 20` という数値目標はバリデーターの設定として存在するが、その達成方法をsubagentに教えるガイダンスとの接続が不十分である。
必須セクションが3つあり、各セクションで最低5行（合計15行）を確保しても、全体の20行には5行分のギャップが生じる。
このギャップを埋めるためには追加のセクション（サマリー等）でさらに5行以上書く必要があるが、その計算ロジックがsubagentに伝達されていない。
subagentは各セクションを個別に満たすことに集中するあまり、全体の行数目標を俯瞰する視点を持てないという認知上の問題がある。
セクション別の目標と全体目標の両方を明示したガイダンスが必要であることが分かる。

## 修正方針

### definitions.tsへの修正（manual_test）

`manual_test` のsubagentTemplateに `## 総合評価` セクションの記述ガイダンスを追加する。
追加するガイダンスの内容は以下の5観点以上をそれぞれ1行以上で記述するよう指示するものとする。
観点1: 全テストシナリオの合否サマリー（何件実施して何件合格・不合格か）。
観点2: 検出された問題の有無と件数、深刻度の概要。
観点3: 未実施シナリオがある場合の理由と代替措置。
観点4: 次フェーズ（security_scan等）への引き継ぎ事項。
観点5: 全体的な品質評価（合格・条件付き合格・不合格の判定と根拠）。
このガイダンスはperformance_testのFR-9で採用したパターンと一貫したフォーマットで記述する。

### definitions.tsへの修正（security_scan）

`security_scan` のsubagentTemplateの行数ガイダンスを具体的な計算例を含む表現に強化する。
修正後のガイダンスには「3必須セクション × 最低5行 = 15行 + サマリーセクション最低5行 = 合計20行以上」という計算ロジックを明示する。
各セクションの行数目標をリスト形式で示し、合計が20行に達することを定量的に確認できる形式にする。

### テストファイルへの修正

`definitions-subagent-template.test.ts` に以下の2テストスイートを追加する。
FR-11（manual_test総合評価ガイダンス）: `## 総合評価` のキーワードが含まれること、5観点ガイダンスのキーワードが含まれること、の2テスト。
FR-12（security_scan行数確保ガイダンス）: 計算ロジックのキーワード（「20行」等）が含まれること、の1テスト。
テスト追加後にテストスイート全体（912件）がパスすることを確認する。

## requirementsフェーズへの引き継ぎ

### 修正対象ファイル

修正が必要なファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` と `workflow-plugin/mcp-server/src/tests/definitions-subagent-template.test.ts` の2ファイルである。
`definitions.ts` の修正箇所は `manual_test` フェーズと `security_scan` フェーズのsubagentTemplate文字列内の特定箇所である。

### 既存FRとの整合性

FR-1〜FR-10が既にdefinitions.tsに実装済みであるため、今回の修正はFR-11（manual_test）とFR-12（security_scan）として番号付けする。
performance_testのFR-9（総合評価ガイダンス）のパターンをmanual_testに横展開することで、フェーズ間の一貫性を確保する。

### MCPサーバー再起動要件

definitions.tsはMCPサーバーのコアモジュールであるため、修正後は必ずビルド（`npm run build`）とMCPサーバーの再起動が必要である。
再起動なしでは変更が反映されず、バリデーション失敗が継続するリスクがある。

### スコープ設定

影響範囲は `workflow-plugin/mcp-server/src/phases/definitions.ts` と `workflow-plugin/mcp-server/src/tests/definitions-subagent-template.test.ts` の2ファイルに限定されており、他のファイルへの影響はない。
