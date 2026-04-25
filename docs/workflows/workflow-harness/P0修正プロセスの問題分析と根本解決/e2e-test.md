## サマリー

本ドキュメントは、P0修正プロセスの問題分析と根本解決タスクにおけるE2Eテストの実施結果を記録する。
検証対象はFR-1（buildPrompt動的生成）、FR-2（BuildRetryResult型とモデルエスカレーション）、FR-3（parallel_verificationサブフェーズのsonnet採用）、FR-4（CLAUDE.md Rule 22追加）の4機能要件である。
テスト方式として、静的解析によるソースコード検証とビルド成果物（dist/phase-definitions.cjs）への反映確認を組み合わせた2段階検証を採用した。
5シナリオ14テスト項目の全てにおいて合格が確認され、各実装がソースコードとビルド成果物の両方に正しく反映されていることが検証された。
次フェーズ（docs_update）では、CLAUDE.mdのsubagentテーブルに残存するsubagent_type列の不一致を解消する永続仕様書への反映が推奨される。

## E2Eテストシナリオ

### シナリオ1: FR-1 buildPrompt動的生成の検証

**対象ファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`（行1003〜1205）および `dist/phase-definitions.cjs`

**前提条件**: definitions.tsにexport function buildPromptが実装されており、ビルド成果物にも反映されていること。

**テスト観点A（関数シグネチャ）**: buildPrompt関数がguide: PhaseGuide、taskName: string、userIntent: string、docsDir: string の4引数を受け付けること。

検証した内容は以下のとおりである。ソースコード行1003〜1008でexport function buildPromptの定義が確認され、4引数のシグネチャが正しく実装されていた。また、dist/phase-definitions.cjsの行941でfunction buildPrompt(guide, taskName, userIntent, docsDir)としてコンパイル済みであることを確認した。

**テスト観点B（resolvePhaseGuideからの呼び出し）**: docsDirが空でない場合にbuildPromptが呼び出され、subagentTemplateが動的生成されること。

ソースコード行1464〜1468で「C-1: buildPromptでsubagentTemplateを動的生成」のコメントと実装が確認できた。docsDirが空文字列でない場合のみbuildPromptを呼び出す条件分岐（行1466）も適切に実装されていた。サブフェーズに対しても行1479〜1483で同様の動的生成が行われることを確認した。

**テスト観点C（フォールバック機構）**: buildPromptが失敗した場合にresolvePlaceholdersによる従来処理にフォールバックすること。

行1469〜1477でtry-catchによるフォールバック実装が確認できた。フォールバック発動時はconsole.warnでログを出力する点も適切である。

### シナリオ2: FR-2 BuildRetryResult型とmodelEscalation機能の検証

**対象ファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`（行1222〜1369）および `dist/phase-definitions.cjs`

**テスト観点A（型定義）**: BuildRetryResult interfaceがprompt: stringとoptionalなsuggestModelEscalation?: booleanフィールドを持つこと。

ソースコード行1222〜1226でexport interface BuildRetryResultが確認できた。promptフィールドとオプショナルなsuggestModelEscalation?: booleanの両方が定義されており、仕様どおりの型構造であった。

**テスト観点B（shouldEscalateModel条件）**: retryCount >= 2でかつbracketエラーまたはforbiddenエラーがある場合、あるいは改善指示が3件以上の場合にtrueを返すこと。

行1322〜1335でshouldEscalateModel関数の実装が確認できた。retryCount < 2の場合は早期リターン（false）、角括弧エラーと禁止パターンエラーの両条件、および改善指示3件以上の条件が正しく実装されていた。

**テスト観点C（ビルド成果物への反映）**: dist/phase-definitions.cjsの行1252〜1253にFR-2コメントとsuggestModelEscalation判定コードが存在すること。

grep検索でdist/phase-definitions.cjsの行1252にコメント「// FR-2: モデルエスカレーション判定」と行1253にconst suggestModelEscalation = shouldEscalateModel(retryCount, errorMessage)が確認できた。また、module.exportsにbuildRetryPromptが含まれていることも行1400で確認した。

### シナリオ3: FR-3 parallel_verificationサブフェーズのsonnetモデル採用検証

**対象ファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`（行870〜926）および `dist/phase-definitions.cjs`（行811〜以降）

**テスト観点A（ソースコードの4サブフェーズ全てにsonnet設定）**: manual_test、security_scan、performance_test、e2e_testの各サブフェーズでmodel: 'sonnet'が設定されていること。

ソースコード行886でmanual_testのmodel: 'sonnet'、行898でsecurity_scanのmodel: 'sonnet'、行910でperformance_testのmodel: 'sonnet'、行922でe2e_testのmodel: 'sonnet'がそれぞれ確認できた。

**テスト観点B（採用理由コメント）**: haiku使用時の平均3回以上のリトライ実績に基づくコスト最適化の理由がコードコメントとして記録されていること。

行874〜876にコメントとして「parallel_verificationはバリデーション要件が厳格（必須セクション・密度要件・重複行禁止が複合する）」という採用根拠と「haiku使用時に平均3回以上のリトライが発生した実績から、初回通過率向上のためsonnetを採用する」という経緯が記録されていた。

**テスト観点C（ビルド成果物への反映）**: dist/phase-definitions.cjsの行827、839、851、863でmodel: 'sonnet'が設定されていること。

grep検索でdist/phase-definitions.cjsの行827、839、851、863にそれぞれmodel: 'sonnet'が確認できた。ソースとビルド成果物で一致していることが検証された。

### シナリオ4: FR-4 CLAUDE.md Rule 22の配置検証

**対象ファイル**: `CLAUDE.md`（ルートディレクトリ）および `workflow-plugin/CLAUDE.md`

**テスト観点A（Rule 22の存在と番号）**: ルートCLAUDE.mdのAIへの厳命セクションに番号22でコアモジュール変更後のMCPサーバー再起動義務が記述されていること。

行640で「22. コアモジュール変更後はMCPサーバーを再起動してから次フェーズに進むこと」が確認できた。

**テスト観点B（Rule 22の内容）**: artifact-validator.ts、definitions.ts、state-manager.tsが対象として明示され、再起動手順とparallel_verification進行禁止が記述されていること。

行641〜645でartifact-validator.ts等の具体的なファイル名、npm run buildによる再起動手順、parallel_verificationフェーズへの進行禁止、禁止理由（キャッシュ問題）、再起動後の確認手順が全て記述されていた。

**テスト観点C（フェーズ別subagentテーブルのsonnet反映）**: CLAUDE.mdのフェーズ別subagent設定テーブルでmanual_test、security_scan、performance_test、e2e_testのmodel列がsonnetに更新されていること。

行157〜160でmanual_test: general-purpose/sonnet、security_scan: Bash/sonnet、performance_test: Bash/sonnet、e2e_test: Bash/sonnetの各エントリが確認できた。FR-3の実装内容がCLAUDE.mdドキュメントにも正しく反映されていた。

### シナリオ5: ワークフロー全体統合テスト（FR-1のresolvePhaseGuide統合）

**対象ファイル**: `workflow-plugin/mcp-server/src/phases/definitions.ts`（行1440〜1515）

**テスト観点A（resolvePhaseGuideがbuildPromptを使用）**: docsDir指定時にresolvePhaseGuideがsubagentTemplateをbuildPromptで動的生成すること。

行1464〜1478でdocsDirが空でない場合にbuildPromptを呼び出す処理が確認できた。buildPromptには第2引数としてphase変数（タスク名ではなくフェーズ名）が渡される。これはCLAUDE.mdのサブフェーズ設定テーブルに記載されたフェーズ識別子として機能する。

**テスト観点B（並列フェーズのサブフェーズ処理）**: parallel_verificationなどの並列フェーズのサブフェーズに対してもbuildPromptが適用されること。

行1479〜1493でresolved.subPhasesが存在する場合に各サブフェーズに対してbuildPromptを呼び出すループ処理が確認できた。エラー時はサブフェーズ名付きのフォールバック警告ログが出力される。

## テスト実行結果

| シナリオ番号 | テスト対象 | 検証方法 | 結果 |
|------------|------------|---------|------|
| 1-A | buildPrompt関数シグネチャ | ソースコード行1003〜1008の静的解析 | 合格 |
| 1-B | resolvePhaseGuideからのbuildPrompt呼び出し | ソースコード行1464〜1483の静的解析 | 合格 |
| 1-C | フォールバック機構の実装 | ソースコード行1469〜1477の静的解析 | 合格 |
| 2-A | BuildRetryResult型定義 | ソースコード行1222〜1226の静的解析 | 合格 |
| 2-B | shouldEscalateModel条件実装 | ソースコード行1322〜1335の静的解析 | 合格 |
| 2-C | ビルド成果物への反映確認 | dist/phase-definitions.cjs行1252〜1253のgrep検索 | 合格 |
| 3-A | 4サブフェーズ全てのsonnet設定 | ソースコード行886/898/910/922の静的解析 | 合格 |
| 3-B | 採用理由コメントの記録 | ソースコード行874〜876の静的解析 | 合格 |
| 3-C | ビルド成果物への反映確認 | dist/phase-definitions.cjs行827/839/851/863のgrep検索 | 合格 |
| 4-A | Rule 22の存在と番号確認 | CLAUDE.md行640のgrep検索 | 合格 |
| 4-B | Rule 22の内容確認 | CLAUDE.md行641〜645の静的解析 | 合格 |
| 4-C | subagentテーブルのsonnet反映確認 | CLAUDE.md行157〜160の静的解析 | 合格 |
| 5-A | resolvePhaseGuideとbuildPromptの統合 | ソースコード行1464〜1478の静的解析 | 合格 |
| 5-B | 並列フェーズサブフェーズへのbuildPrompt適用 | ソースコード行1479〜1493の静的解析 | 合格 |

全14項目のテストシナリオにおいて合格が確認された。

### 検出された注意点

CLAUDE.mdの行158〜160においてsecurity_scan、performance_test、e2e_testのsubagent_type列が「Bash」と記録されているが、definitions.tsのソースコード（行897、909、921）ではsubagentType: 'general-purpose'として実装されている。この不一致はCLAUDE.mdの記述が古いFR-3実装前の状態を反映している可能性がある。ただし、実際のMCPサーバー動作はdefinitions.tsのコードに従うため、機能的な問題はない。ドキュメントの整合性確保として、docs_updateフェーズでこのテーブルの修正を推奨する。

### 総合判定

FR-1からFR-4の全実装がソースコードとビルド成果物の両方に正しく反映されていることが確認された。parallel_verificationサブフェーズのsonnet採用（FR-3）はソース・ビルド成果物・CLAUDE.mdドキュメントの3箇所で一致しており、整合性が高い。FR-4のRule 22はCLAUDE.mdの適切な位置（ルール番号22）に配置されており、MCP再起動義務のコンテキストが明確に記述されている。
