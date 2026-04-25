## サマリー

本ドキュメントは、subagentプロンプト情報不足とOrchestrator直接編集の根本解決タスク（FR-1〜FR-7）の実装仕様書である。

目的:
- 各FRについて修正対象ファイル・修正箇所・修正前後の記述を行番号レベルで特定する
- 変更は文字列リテラルの追記・修正のみとし、ロジック変更は行わない
- NFR-2に従い各FRの追加行数は50行以内に収める
- artifact-validator.ts、definitions.ts、CLAUDE.mdの三者間の情報不整合を解消し、サブエージェントが正確にバリデーション要件を理解できる仕組みを確立する

主要な決定事項:
- FR-1: CLAUDE.md（ルート）の「成果物品質要件」セクション内に「### 禁止パターン完全リスト（12語）」小見出しを新設する
- FR-2: CLAUDE.md（ルート）の「重複行禁止」セクションの8ルール説明に正規表現パターンを付記する
- FR-3: definitions.tsのrequirementsとplanningのsubagentTemplateに必須セクション名と最低行数指示を明示する
- FR-4: definitions.tsのbuildPrompt()のパス警告を冒頭と末尾の2箇所に強化し、docsDirの値を具体的なパスとして明示する
- FR-5: definitions.tsのbuildPrompt()にブロック時の代替ツール案内（コマンドリストに加えてRead/Write/Glob/Grep）を拡充する
- FR-6: CLAUDE.md（ルート）のルール21にリトライ回数別エスカレーション手順を追記する
- FR-7: definitions.tsのcode_review subagentTemplateに設計書4ファイルの読み込み指示を追加する

次フェーズで必要な情報:
- 各変更ファイルの対象行番号（本仕様書で特定済み）
- definitions.ts変更後のMCPサーバー再起動タイミング（FR-3〜FR-7完了後、実装フェーズ末尾で実施）
- テスト設計での受け入れ基準の確認方法（静的検証：ファイル内容の文字列照合で確認可能）

---

## 変更対象ファイル

本仕様書で特定した変更対象ファイルと変更の種類を以下に整理する。変更対象外ファイルも明示することで副作用を最小化する。

変更対象ファイルの全リスト:
- `CLAUDE.md`: FR-1（禁止パターン完全リスト追加）、FR-2（8ルール正規表現付記）、FR-6（ルール21エスカレーション手順追加）の3箇所を変更する
- `workflow-plugin/mcp-server/src/phases/definitions.ts`: FR-3（requirements・planningのsubagentTemplate拡張）、FR-4（buildPrompt()セクション1・セクション9強化）、FR-5（buildPrompt()セクション6代替ツール追加）、FR-7（code_reviewのsubagentTemplate・inputFileMetadata拡張）の4箇所を変更する

変更対象外のファイル（副作用防止のため明示する）:
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`: バリデーション動作は変更しない
- `workflow-plugin/mcp-server/src/state/state-manager.ts`: HMAC整合性に影響するため変更しない
- `workflow-plugin/hooks/phase-edit-guard.js`: フック動作は変更しない

definitions.ts変更後の起動手順（4ステップ）:
- ステップ1: `workflow-plugin/mcp-server`ディレクトリで`npm run build`を実行してトランスパイルする
- ステップ2: dist/*.jsの更新日時を確認して変更が反映されたことを確認する
- ステップ3: Claude DesktopのMCPサーバー再起動ボタンでサーバーを再起動する
- ステップ4: 再起動後にworkflow_statusを実行して現在フェーズを確認する

---

## 禁止語完全リスト（参照情報）

以下はartifact-validatorが検出する禁止語の完全リストである。`artifact-validator.ts`の`FORBIDDEN_PATTERNS`定数に定義されており、`includes()`による部分一致で検出される。
英語4語と日本語8語で構成された合計12語が対象であり、複合語に含まれる場合も検出対象となる。
コードフェンス内への記載は安全だが、コードフェンス外での使用は成果物全体でブロックの対象となる。
サブエージェントが禁止語を使いたい場合は、下記の言い換えパターン（概要のみ）を参照すること。
言い換えの詳細はCLAUDE.mdの「成果物品質要件」セクションの「禁止パターン」項目に記載されている。

```
禁止語完全リスト（英語4語・日本語8語）:
英語グループ: TODO, TBD, WIP, FIXME
日本語グループ: 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き
合計12語。これらを含む複合語も部分一致（includes）で検出される。
コードブロック外での使用全般が禁止対象となる。
```

上記リストは`artifact-validator.ts`のFORBIDDEN_PATTERNS配列の内容と完全に一致させる必要がある。
FORBIDDEN_PATTERNSが変更された場合、このセクションおよびCLAUDE.mdの対応リストも合わせて更新すること。
definitions.tsの`buildPrompt()`経由でサブエージェントのプロンプトに展開される仕組みにより、三者間（validator・definitions・CLAUDE.md）の整合性を維持することが重要である。

---

## 技術仕様

### FR-1: CLAUDE.mdへの禁止パターン完全リスト追加

**修正対象ファイル（FR-1）:** `CLAUDE.md`（プロジェクトルート・成果物品質要件セクション）

**修正箇所の特定と変更箇所の記述:**
CLAUDE.mdの「成果物品質要件（artifact-validator準拠）」セクション内の「### 禁止パターン」という小見出しが存在する。現在この見出し直後のテキストは参照先セクションへの誘導のみで、実際のリストが存在しない状態である。サブエージェントがCLAUDE.mdを読んでも完全リストを確認できない情報不整合が発生している。

**修正前の問題箇所:**
「### 禁止パターン」見出しの直後に「禁止語の完全リストはCLAUDE.mdの『禁止パターン（完全リスト）』を参照すること」と書かれているが、参照先セクション見出し「禁止パターン（完全リスト）」は実際には存在しない。

**修正後の記述方針（追加内容）:**
上記「### 禁止パターン」の記述の直後に「### 禁止パターン（完全リスト）」小見出しブロックを追加する。この追加によりサブエージェントが参照できる完全リストが実際に存在するようになる。

追加する内容の概要:
- 小見出し「### 禁止パターン（完全リスト）」を新設する
- 英語4語グループ（artifact-validator.tsのFORBIDDEN_PATTERNSの英語部分）を列挙する
- 日本語8語グループ（同FORBIDDEN_PATTERNSの日本語部分）を列挙する
- 「禁止語を含む複合語も検出対象」である旨を明記する
- 「artifact-validator.tsのFORBIDDEN_PATTERNSが変更された場合、本リストも更新すること」という保守ルールを明記する
- 各グループへの言い換えパターンを1〜2行で補足する

**追加行数:** 約20行（NFR-2の50行以内を満たす）

**FR-1の受け入れ基準の検証手順:**
CLAUDE.mdをReadツールで読み込み、「### 禁止パターン（完全リスト）」という文字列が存在すること、12語全てが箇条書きで列挙されていることを確認する。実装フェーズでは`workflow-plugin/mcp-server/src/validation/artifact-validator.ts`のFORBIDDEN_PATTERNS配列の値をそのまま転記することで、整合性を確保する。

---

### FR-2: isStructuralLine()の8ルールに正規表現パターンを追加

**修正対象ファイル（FR-2）:** `CLAUDE.md`（プロジェクトルート・重複行禁止セクション）

**修正箇所の特定:**
CLAUDE.mdのsubagent起動テンプレート内の「### 重複行禁止（3回以上の同一行でエラー）」セクションに8ルールの説明がある。現状はルール名と具体例のみで、isStructuralLine()が使用する正規表現パターンが省略されている。この不明確さにより、ルール境界を誤解したサブエージェントが重複行検出エラーを繰り返す原因となっている。

**修正前の記述（現状の8ルール、抜粋）:**
ルール6の説明は「2連アスタリスクで囲まれたラベルのみの行（`**ラベル**:` の形式）」という形式で、正規表現パターンの記載がない。ルール8の説明は「50文字以内の内容がコロンで終わるラベル行」という形式で、50文字制限の正規表現パターンの記載がない。

**修正後の記述方針（各ルールに正規表現を付記）:**
ルール6の説明に正規表現パターンを付記する。このパターンは「行頭から2連アスタリスク、任意の非アスタリスク文字、2連アスタリスク、コロン（省略可能）、空白のみ、行末」という構造を表す。「太字ラベルの後にコンテンツが続く場合（例: `**深刻度**: Medium` など）は除外されない」という境界条件を明記する。

ルール8の説明に正規表現パターンを付記する。「50文字を超える場合は除外されない」という境界条件と具体例を明記する。太字なしのラベル行も対象となるケースがあることを明示的に説明する。

各ルールへの付記形式（実装フェーズで正確な文字列を挿入する）:
- ルール6の末尾に正規表現（英語表記）と「行末がコロンのみかつ後続コンテンツなしの場合に除外される」説明を追加する
- ルール8の末尾に正規表現（英語表記）と「50文字超の行は除外されないため3回以上の繰り返しでエラー」の説明を追加する

**追加行数:** 約10行（各ルールに1〜2行の付記）

**FR-2の受け入れ基準の検証手順:**
CLAUDE.mdをReadツールで読み込み、ルール6とルール8の説明に正規表現パターンが記載されていること、「行末がコロンのみ」「50文字超は除外されない」という境界条件の記述が存在することを確認する。

---

### FR-3: subagentTemplateに必須セクション名を動的に埋め込む

**修正対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（622行目・658行目付近）

**修正箇所の特定:**
definitions.tsの622行目（requirementsフェーズ）と658行目（planningフェーズ）のsubagentTemplateの文字列リテラル。現状はどちらも最低行数指示も必須セクション名の指示もなく、作業内容の最小限の記述のみである。フェーズ定義の中にある必須セクション名をサブエージェントに伝えるフォーマットが欠落している。

**現状の記述（requirementsフェーズ、622行目付近の構造）:**
`subagentTemplate`フィールドが「requirementsフェーズ」というヘッダーと「タスク情報」「入力」「作業内容」「出力」の4セクションのみで構成されており、必須セクション名の案内がない。

**現状の記述（planningフェーズ、658行目付近の構造）:**
同様に「planningフェーズ」というヘッダーと基本4セクションのみで構成されており、必須セクション名の案内がない。

**修正後の記述方針（実装フェーズで正確な文字列を修正する）:**
requirementsフェーズのsubagentTemplateの末尾に以下を追加する:
- 「## 必須セクション（成果物に含めること）」というセクションを追記する
- `## 背景`・`## 機能要件`・`## 受入条件`の3セクション名を明示する
- 最低行数50行以上であることを明記する
- `## 非機能要件`も必須セクションに含まれる旨を補足する

planningフェーズのsubagentTemplateの末尾に以下を追加する:
- 「## 必須セクション（成果物に含めること）」というセクションを追記する
- `## 概要`・`## 実装計画`・`## 変更対象ファイル`の3セクション名を明示する
- 最低行数50行以上であることを明記する

**追加行数:** requirementsで約8行、planningで約8行（合計約16行でNFR-2を満たす）

**FR-3の受け入れ基準の検証手順:**
`workflow-plugin/mcp-server/src/phases/definitions.ts`をReadツールで読み込み、requirementsのsubagentTemplateに「## 背景」「## 機能要件」「## 受入条件」という文字列が含まれること、planningのsubagentTemplateに「## 概要」「## 実装計画」「## 変更対象ファイル」という文字列が含まれることを確認する。

---

### FR-4: buildPrompt()のパス警告を冒頭と末尾の両方に配置する

**修正対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（1023行目・1205行目付近）

**修正箇所の特定:**
definitions.tsの1205行目（セクション9「★重要★ サマリーセクション必須化」内）に現在1箇所のみパス警告が存在する。プロンプト冒頭のタスク情報セクションには同様の警告がないため、サブエージェントが誤ったパスに成果物を保存する問題が発生している。

**現状の記述（1205行目付近の構造）:**
`importantSection`変数に「★重要: 出力先のパスは必ず ${docsDir}/ を正確に使用すること。タスク名から独自にパスを構築しないこと。」という1行が存在するが、プロンプト冒頭にはない。

**修正後の記述方針:**
セクション1（フェーズ情報ヘッダー、1023〜1030行目付近）の末尾に、追加のパス強調警告を挿入する。

追加する内容（セクション1末尾への追記）:
「- ★★出力パス確認★★: 成果物は必ず ${docsDir}/ に保存すること。上記パス以外への保存は禁止。」という行を追加する。

セクション9（末尾のimportantSection）については既存の記述を以下のように強化する:
- 現在の警告「★重要: 出力先のパスは必ず...」を残しつつ
- 「workflow_statusで確認したdocsDirの値: ${docsDir}/ — この値をそのまま出力ファイルパスのプレフィックスに使用すること」という1行を追加する
- これにより冒頭（タスク情報）と末尾（重要事項）の2箇所に同一パスが明示される

**追加行数:** 約4行（NFR-2の50行以内を満たす）

**FR-4の受け入れ基準の検証手順:**
`workflow-plugin/mcp-server/src/phases/definitions.ts`をReadツールで読み込み、buildPrompt()関数内でdocsDirの値がセクション1とセクション9の両方に含まれていることを確認する。また、各設計書ファイルを出力する際のパスが正確に指定されることを検証する。

---

### FR-5: Bashコマンドブロック時の代替ツール案内を拡充する

**修正対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（1172〜1173行目付近）

**修正箇所の特定:**
definitions.tsの1172〜1173行目（セクション6「Bashコマンド制限」末尾）に現在1行の代替手段案内が存在する。カテゴリ別の具体的な代替ツール対応表は存在せず、サブエージェントが実装系コマンドをブロックされた後に代替手段への切り替えが不十分なケースが確認されている。

**現状の記述（1172〜1173行目の構造）:**
`bashSection`変数の末尾に「上記カテゴリ外のBashコマンドはフックによりブロックされます。」という行と「ブロックされた場合は代替手段（Read/Write/Edit/Glob/Grepツール）を使用してください。」という行がある。カテゴリコマンドと代替手段の対応が明示されていない。

**修正後の記述方針:**
上記2行の後ろに、カテゴリ別の具体的な代替ツール対応表を追加する。追加内容の概要:

- readonlyフェーズでnpm testを試みてブロックされた場合の対処として「このフェーズではtestingカテゴリは許可されていません。テスト実行はtestingまたはimplementationフェーズで行ってください」という説明を加える
- ファイル読み取りの代替として「cat/head/tailがブロックされた場合 → Readツールを使用する」を追加する
- ファイル書き込みの代替として「echo/tee/sed/awkがブロックされた場合 → Writeツール（新規作成）またはEditツール（部分修正）を使用する」を追加する
- ファイル検索の代替として「find/grepがブロックされた場合 → Globツール（パターン検索）またはGrepツール（内容検索）を使用する」を追加する
- ファイルコピー/移動の代替として「cp/mvがブロックされた場合 → Read+Write（コピー）またはRead+Write+rm（移動）のツール組み合わせを使用する」を追加する

**追加行数:** 約12行（NFR-2の50行以内を満たす）

**FR-5の受け入れ基準の検証手順:**
`workflow-plugin/mcp-server/src/phases/definitions.ts`をReadツールで読み込み、buildPrompt()のbashSection生成部分に「Readツール」「Writeツール」「Editツール」「Globツール」「Grepツール」という5つの代替ツール名が全て明記されていることを確認する。

---

### FR-6: ルール21のリトライエスカレーション手順を強化する

**修正対象ファイル（FR-6）:** `CLAUDE.md`（プロジェクトルート・AIへの厳命ルール21）

**修正箇所の特定:**
CLAUDE.mdの「AIへの厳命」セクションのルール21。現状は「バリデーション失敗時のsubagent再起動義務」として約250文字の説明があるが、リトライ回数別のエスカレーション手順が明記されていない。失敗回数が増えるとOrchestratorがルール21を無視して直接編集する行動パターンが観察されている。

**現状の記述（ルール21の概要）:**
「workflow_nextまたはworkflow_complete_subで成果物バリデーション失敗メッセージを受け取った場合、OrchestratorはEdit/Writeツールで修正してはならない。」という禁止指示と「リトライ回数に上限はない。バリデーションが成功するまでsubagentを再起動し続けること。」という再起動義務の記述がある。しかし各リトライでOrchestratorが取るべき具体的な行動の手順が欠落している。

**修正後の記述方針（追記内容の概要）:**
ルール21の既存記述の末尾に「リトライ回数別エスカレーション手順」を追記する（段落追加の形式）。

リトライテンプレートセクションへの参照を含む手順書形式で記述する:
- 1回目のリトライ: エラーメッセージをそのままsubagentに渡す（buildRetryPromptを使用）
- 2回目のリトライ: Orchestratorが成果物ファイルをReadで読み込み、問題箇所を特定して行番号レベルの具体的修正指示をプロンプトに追加する。haikuモデル使用時はsonnetへのモデルエスカレーションを検討する
- 3回目以降のリトライ: 必ずsonnetモデルを使用する。Orchestratorが成果物の問題セクションを引用し、具体的な書き換え例を含む詳細な改善指示をプロンプトに含める
- 直接編集の禁止: どの回数においても、OrchestratorがEdit/Writeツールで成果物を直接修正することは禁止である

また、buildRetryPromptの11エラーパターン（FORBIDDEN_PATTERN、DUPLICATE_LINE、SECTION_MISSING、SECTION_DENSITY、MIN_LINES、PLACEHOLDER、STRUCTURAL_VIOLATION、CODE_FENCE、TABLE_FORMAT、SUMMARY_MISSING、DESIGN_IMPL_MISMATCH）がCLAUDE.mdに明示されていないため、ルール21の参照情報として「詳細なエラーパターン対応はdefinitions.tsのbuildRetryPrompt()を参照すること」という注釈を追加する。

**追加行数:** 約20行（NFR-2の50行以内を満たす）

**FR-6の受け入れ基準の検証手順:**
CLAUDE.mdをReadツールで読み込み、ルール21に「3回以上」「行番号レベルの修正指示」「sonnetへエスカレーション」という3つのキーワードが含まれていることを確認する。リトライテンプレートセクションのフォーマットとの整合性も確認する。

---

### FR-7: code_review subagentTemplateに設計書4ファイルの読み込み指示を追加する

**修正対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts`（843行目・824〜828行目付近）

**修正箇所の特定:**
definitions.tsの843行目（code_reviewフェーズのsubagentTemplate）。現状はspec.mdのみ読み込みを指示し、state-machine.mmd・flowchart.mmd・ui-design.mdの3ファイルが入力として明示されていない。サブエージェントが設計書ファイルを参照しない場合、全機能・全項目の対応関係を検証できず、整合性チェックが形式的になる問題が発生している。

**現状の記述（843行目の構造）:**
`subagentTemplate`フィールドが「code_reviewフェーズ」というヘッダーと基本4セクションのみで構成されており、入力ファイルがspec.mdの1ファイルのみになっている。inputFileMetadataにも3設計図ファイルが含まれていない。

**修正後の記述方針:**
code_reviewのsubagentTemplateを以下のように拡張する（文字列リテラルの修正）。

入力セクションを「## 入力（設計書4種を全文読み込みすること）」に変更し、以下の4ファイルを列挙する:
- `${docsDir}/spec.md`（全文読み込み必須）
- `${docsDir}/state-machine.mmd`（全文読み込み必須）
- `${docsDir}/flowchart.mmd`（全文読み込み必須）
- `${docsDir}/ui-design.md`（全文読み込み必須）

作業内容セクションを「2段階手順」として再記述する:
- 第1段階: 設計書4種を全文読み込み、「機能一覧」「状態遷移リスト」「処理フロー一覧」「UI要素一覧」を抽出してリストアップする
- 第2段階: 実装コードを走査し、上記リストの各項目が実装されているかを照合してcode-review.mdに記録する。未実装項目の解決確認まで行うこと。

inputFileMetadataへの追記（並行して行う、ロジック変更ではなくデータ追記）:
- 824行目付近のinputFileMetadata配列にstate-machine.mmdのエントリ（`importance: 'high', readMode: 'full'`）を追加する
- 同様にflowchart.mmdのエントリを追加する
- 同様にui-design.mdのエントリを追加する

**追加行数:** subagentTemplateで約15行相当の文字列追加、inputFileMetadata追記で約6行（合計約21行でNFR-2を満たす）

**FR-7の受け入れ基準の検証手順:**
`workflow-plugin/mcp-server/src/phases/definitions.ts`をReadツールで読み込み、code_reviewのsubagentTemplateに「state-machine.mmd」「flowchart.mmd」「ui-design.md」の3ファイル名が含まれること、inputFileMetadataに同3ファイルのエントリが追加されていることを確認する。

---

## 実装チェックリスト

implementationフェーズでの作業順序と確認項目を以下に示す。

FR-1の実装確認項目:
- CLAUDE.mdの「### 禁止パターン」の直後に「### 禁止パターン（完全リスト）」が追加されているか
- 12語全て（英語4語・日本語8語）が箇条書きで列挙されているか（`workflow-plugin/mcp-server/src/validation/artifact-validator.ts`のFORBIDDEN_PATTERNS配列から転記）
- 保守ルール（FORBIDDEN_PATTERNS変更時にCLAUDE.mdの対応セクションも更新）が明記されているか

FR-2の実装確認項目:
- ルール6の説明に正規表現パターンが付記されているか
- ルール8の説明に正規表現パターンと「50文字超は除外されない」が付記されているか
- 除外される例と除外されない例が各ルールに併記されているか

FR-3の実装確認項目:
- `workflow-plugin/mcp-server/src/phases/definitions.ts`のrequirementsのsubagentTemplateに「## 背景」「## 機能要件」「## 受入条件」が含まれているか
- 同ファイルのplanningのsubagentTemplateに「## 概要」「## 実装計画」「## 変更対象ファイル」が含まれているか
- 両フェーズの最低行数50行の指示が含まれているか

FR-4の実装確認項目:
- `workflow-plugin/mcp-server/src/phases/definitions.ts`のbuildPrompt()のセクション1にdocsDirパスの警告が追加されているか
- 同ファイルのbuildPrompt()のセクション9に既存警告に加えてworkflow_status参照の説明が追加されているか

FR-5の実装確認項目:
- `workflow-plugin/mcp-server/src/phases/definitions.ts`のbashSectionに5種の代替ツール（Read/Write/Edit/Glob/Grep）が全て明記されているか
- readonlyフェーズでtestingカテゴリがブロックされる旨の説明が追加されているか

FR-6の実装確認項目:
- CLAUDE.mdのルール21に1回目・2回目・3回目以降のリトライ手順が明記されているか
- sonnetへのモデルエスカレーション条件が記述されているか
- どの回数でもOrchestratorの直接編集禁止が明記されているか

FR-7の実装確認項目:
- `workflow-plugin/mcp-server/src/phases/definitions.ts`のcode_reviewのsubagentTemplateにstate-machine.mmd・flowchart.mmd・ui-design.mdが含まれているか
- inputFileMetadataに同3ファイルのエントリが追加されているか
- 2段階手順（設計書リスト化→実装コード照合）が記述されているか

---

## 非機能要件対応

### MCPサーバー再起動の要否判断基準

artifact-validator.ts、definitions.ts、state-manager.tsのいずれかを変更した場合、MCPサーバーの再起動が必須となる。CLAUDE.mdおよびphase-edit-guard.jsのみを変更する場合、MCPサーバーの再起動は不要である（ディスクから直接読み込まれるファイルのため）。本タスクの変更対象は主にCLAUDE.mdと`workflow-plugin/mcp-server/src/phases/definitions.ts`であり、definitions.tsの変更後にはnpm run buildとMCPサーバー再起動を実施する。

再起動の仕組みはNode.jsのモジュールキャッシュに起因する。ディスク上のdist/*.jsファイルを変更しても、実行中のMCPサーバーには変更が反映されない。MCPサーバープロセスを再起動することで、キャッシュが破棄されて新しいコードが読み込まれる。この手順はCLAUDE.mdの「強制再起動条件」セクションに記載されている内容と整合させること。

### プロンプトサイズ制約の遵守

buildPrompt()が生成するプロンプトは既に9セクション・数百行の規模に達している。FR-1からFR-7の変更によるプロンプトサイズの増加を最小限に抑えるため、追加するテキストは各FRで50行以内とする。重複する説明はCLAUDE.md参照へのリンクで代替し、プロンプト本体への重複埋め込みを避けること。

特に禁止パターン完全リスト（FR-1）については、buildPrompt()のセクション5で既にリスト展開されているため、CLAUDE.mdの新設セクションとの一致確認を行うことで十分であり、二重掲載を避けること。

### 副作用最小化の原則

本タスクで変更するファイルの範囲は以下に限定する。CLAUDE.md（プロンプト品質ルールの追記・修正）と`workflow-plugin/mcp-server/src/phases/definitions.ts`（PhaseGuide.subagentTemplateの拡張）のみを変更する。`workflow-plugin/mcp-server/src/validation/artifact-validator.ts`（バリデーション動作）とstate-manager.ts（HMAC整合性）とphase-edit-guard.js（フック動作）は修正対象外とすることで、既存のバリデーション動作への副作用を防ぐ。

CLAUDE.mdの変更は追記（セクション追加）を主体とし、既存のルール番号（厳命1〜22）を変更しない。既存のsubagent起動テンプレートへの変更は最小限とし、必須セクション名と最低行数の修正のみとする。

### 整合性維持ルールの文書化

`workflow-plugin/mcp-server/src/validation/artifact-validator.ts`のFORBIDDEN_PATTERNSやPHASE_ARTIFACT_REQUIREMENTSが将来変更された場合に、CLAUDE.mdの対応セクションも合わせて更新するルールをCLAUDE.mdに明記する。このルールは「コアモジュール変更後はCLAUDE.mdの対応セクションも更新すること」という形で「強制再起動条件」セクションの次に配置することで、保守担当者が参照しやすい構成にする。三者間（artifact-validator.ts・definitions.ts・CLAUDE.md）の整合性を継続的に維持するための設計案として、コアモジュール変更時に同期作業を義務化する手順書形式でルールを記述する。

---

## 受入条件まとめ

以下は全FRの受け入れ基準を整理したものである。

受入条件1（FR-1・禁止パターン問題）: CLAUDE.mdの「禁止パターン完全リスト（12語）」セクションが存在し、artifact-validator.tsのFORBIDDEN_PATTERNS配列と完全に一致する。サブエージェントがCLAUDE.mdを読み込んだ際に12語全ての把握ができる状態になっている。

受入条件2（FR-2・重複行検出問題）: CLAUDE.mdの8ルール説明に正規表現パターンが付記されており、ルール6とルール8の境界条件が明確に記述されている。サブエージェントが太字ラベル後にコンテンツが続く行を重複検出の対象と認識し、各行に固有情報を含める設計ができる。

受入条件3（FR-3・必須セクション問題）: requirementsフェーズのsubagentプロンプトに「## 背景」「## 機能要件」「## 受入条件」が必須セクションとして明示されている。artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSとsubagentテンプレートの必須セクション名・最低行数が一致している。

受入条件4（FR-4・出力パス問題）: buildPrompt()がdocsDirの実際のパス値をプロンプトの複数箇所に埋め込んでいる。Orchestratorのsubagent起動手順にworkflow_statusによるdocsDir取得ステップが明記されている。

受入条件5（FR-5・Bashコマンド問題）: buildPrompt()のBash制限セクションにブロック時の代替ツール（Read/Write/Glob/Grep）が明記されている。CLAUDE.mdのBashカテゴリ表に代替手段の説明が追加されている。

受入条件6（FR-6・Orchestrator直接編集問題）: CLAUDE.mdのルール21にリトライ回数別のエスカレーション手順が追記されている。buildRetryPrompt()の11エラーパターンとCLAUDE.mdのリトライテンプレートが整合している。Orchestratorが3回以上リトライ失敗した場合に取るべき行動（行番号レベルの修正指示生成）が明記されている。

受入条件7（FR-7・code_review整合性問題）: definitions.tsのcode_review subagentTemplateに4つの設計書ファイルが入力として明示されている。code-review.mdのPHASE_ARTIFACT_REQUIREMENTSに「設計-実装整合性チェック結果」セクションが必須として追加されている。設計書と実装コードの差分検証手順が2段階で明記されている。
