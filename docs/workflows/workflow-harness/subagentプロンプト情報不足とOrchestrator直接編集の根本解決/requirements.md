## サマリー

本ドキュメントは、ワークフロー実行中にsubagentが繰り返しバリデーション失敗する7つの問題の根本解決に向けた機能要件・非機能要件・受け入れ基準を定義する。

目的:
- artifact-validator.ts、definitions.ts、CLAUDE.mdの三者間の情報不整合を解消する
- subagentがバリデーション要件を正確に理解できるプロンプト設計を確立する
- Orchestratorのルール21違反（直接編集）を技術的または構造的に抑止する

主要な決定事項:
- FR-1: CLAUDE.mdに「禁止パターン完全リスト」セクションを新設し、artifact-validator.tsと同期を保つ
- FR-2: CLAUDE.mdのisStructuralLine()説明に正規表現パターンを明示し、実装との乖離を防ぐ
- FR-3: requirements.mdの必須セクション名をartifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSに合わせて修正する
- FR-4: buildPrompt()のパス警告セクションを強化し、docsDirを具体的なパスとして埋め込む
- FR-5: Bashコマンド許可カテゴリ表の見直しと、代替手段の明示をプロンプトに追加する
- FR-6: ルール21をCLAUDE.mdのphase-edit-guardセクションに移動し、フック連携の可能性を示す
- FR-7: code_reviewのsubagentTemplateに設計書ファイル読み込み指示と検証手順を追加する

次フェーズで必要な情報:
- 各FRに対応するファイルの変更箇所（行番号レベルの特定）
- MCPサーバー再起動が必要かどうかの判断基準
- テスト設計のための受け入れ基準の具体化

---

## 機能要件

### FR-1: CLAUDE.mdへの禁止パターン完全リスト追加

**背景**: CLAUDE.mdは「禁止パターン（完全リスト）はCLAUDE.mdの該当セクションを参照」と記述しているが、そのセクション見出しが実際には存在しない。subagentがCLAUDE.mdを読んでも完全リストを確認できない状態が継続している。

**要件内容**:
CLAUDE.mdの「成果物品質要件」セクション内に「### 禁止パターン完全リスト（12語）」という小見出しを新設し、artifact-validator.tsのFORBIDDEN_PATTERNS配列と完全に一致する12語を箇条書きで列挙する。英語4語（TODO, TBD, WIP, FIXME）と日本語8語（未定、未確定、要検討、検討中、対応予定、サンプル、ダミー、仮置き）を別グループで記載する。また、「禁止語を含む複合語」や「コードブロック外での使用全般」が検出対象である旨を明記する。

**受け入れ基準**:
- CLAUDE.mdの「禁止パターン」参照先として「### 禁止パターン完全リスト（12語）」セクションが存在すること
- 同セクションに12語が正確に列挙されていること
- buildPromptのセクション5またはCLAUDE.mdのsubagent起動テンプレートが、このセクションへの参照を含むこと
- artifact-validator.tsのFORBIDDEN_PATTERNSが変更された場合、CLAUDE.mdの同セクションも更新するルールが明記されていること

### FR-2: isStructuralLine()の8ルールに正規表現パターンを追加

**背景**: CLAUDE.mdに記載されているisStructuralLine()の説明は具体例ベースであり、artifact-validator.tsの実際の正規表現との対応が不明確である。subagentがルール境界を誤解し、重複行検出エラーを繰り返す原因となっている。

**要件内容**:
CLAUDE.mdの「重複行禁止」セクション内の8ルール説明を、各ルールに正規表現パターンを付記した形式に更新する。ルール6（太字ラベル行）の正規表現は`^\*\*[^*]+\*\*[:：]?\s*$`であり、「行末がコロンのみ、かつ後続コンテンツなし」という条件を明記する。ルール8（50文字以内コロン終端）の正規表現は`^(?:[-*]\s+)?.{1,50}[:：]\s*$`であり、リスト記号の有無を問わないことを明記する。各ルールに「除外される例」と「除外されない例」を1行ずつ併記する。

**受け入れ基準**:
- CLAUDE.mdの8ルール説明に各ルールの正規表現パターンが記載されていること
- ルール6の「太字ラベル後にコンテンツが続く場合は除外されない」ことが明記されていること
- ルール8の「50文字超の場合は除外されない」ことが明記されていること
- subagent起動テンプレートの品質要件セクションがCLAUDE.mdの8ルール説明と一致すること

### FR-3: requirements.mdの必須セクション名をPHASE_ARTIFACT_REQUIREMENTSと一致させる

**背景**: artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSではrequirements.mdの必須セクションとして「背景」「機能要件」「受入条件」の3セクションが定義されている。しかしCLAUDE.mdのsubagent起動テンプレートの必須セクション指定と一致しない場合、バリデーション失敗が発生する。

**要件内容**:
requirementsフェーズのsubagent起動テンプレートにおいて、`## 背景`、`## 機能要件`、`## 受入条件`の3セクションが必須セクションとして明示されていることを確認し、不一致があれば修正する。また、PHASE_ARTIFACT_REQUIREMENTSのminLines（30行）をsubagentテンプレートの最低行数指示に反映させる。spec.mdについても同様に`## 概要`、`## 実装計画`、`## 変更対象ファイル`の3セクションが必須であることをplanningフェーズのテンプレートに明記する。

**受け入れ基準**:
- requirementsフェーズのsubagentプロンプトに「## 背景」「## 機能要件」「## 受入条件」の3セクションが必須と明記されていること
- planningフェーズのsubagentプロンプトに「## 概要」「## 実装計画」「## 変更対象ファイル」の3セクションが必須と明記されていること
- 各フェーズの最低行数指示がPHASE_ARTIFACT_REQUIREMENTSのminLines値と一致すること
- manual_test、security_scan、performance_test、e2e_testの必須セクションがartifact-validator.tsと一致していること

### FR-4: buildPrompt()のパス警告セクションでdocsDirを具体的パスとして埋め込む

**背景**: buildPrompt()のセクション9にはdocsDirを動的に展開するパス警告が含まれているが、Orchestratorがresolvingした実際のパス値を確認しにくい場合、subagentが誤ったパスに成果物を保存する。

**要件内容**:
definitions.tsのbuildPrompt()において、subagentTemplateの中にdocsDirの値を実際のパスとして明示的に埋め込む箇所を追加する。「★重要: 出力先のパスは `{docsDir}/` を正確に使用すること」というメッセージを、プロンプトの冒頭（タスク情報セクション）と末尾（出力セクション）の両方に配置する。Orchestratorのsubagent起動テンプレート（CLAUDE.md）においても、Task()呼び出し前にworkflow_statusでdocsDirを取得し、プロンプトに埋め込む手順を明記する。

**受け入れ基準**:
- buildPrompt()が生成するプロンプトにdocsDirの実際のパス値が含まれること
- CLAUDE.mdのsubagent起動テンプレートに「workflow_statusでdocsDirを取得してTask()に渡す」という手順が明記されていること
- subagentがworkflow_statusを呼ばずともdocsDirを把握できるプロンプト設計になっていること

### FR-5: Bashコマンドブロック時の代替手段をプロンプトに明示する

**背景**: subagentがreadonly制限フェーズで実装系コマンド（npm test等）を試み、ブロックされた後に代替手段への切り替えが不十分なケースが確認されている。buildPrompt()のセクション6には許可コマンドリストはあるが、ブロックされた場合の具体的な代替手段が明確でない。

**要件内容**:
buildPrompt()のBashコマンド制限セクションに、カテゴリ外コマンドがブロックされた場合の代替手段を明示するサブセクションを追加する。ファイル読み取りはReadツール、ファイル書き込みはWriteツール、ファイル検索はGlob/Grepツールを使用することを明記する。特にreadonlyフェーズでnpm test等のtestingカテゴリコマンドを試みた場合、そのフェーズではテスト実行が許可されていない旨のエラーメッセージに代替手段の説明を追加する。

**受け入れ基準**:
- buildPrompt()の出力にBashブロック時の代替ツール（Read/Write/Glob/Grep）が明記されていること
- CLAUDE.mdのBashコマンドカテゴリ表に「ブロック時の対処」列または説明を追加すること
- subagentがBashブロックを受けた後、Readツール等への切り替えを自律的に実行できる記述になっていること

### FR-6: ルール21の構造的強化とフック連携の文書化

**背景**: phase-edit-guard.jsにOrchestratorによるdocsDir直接編集を技術的にブロックする機構がなく、ルール21は指示ベースの制約にとどまる。Orchestratorがバリデーション失敗を繰り返すうちにルール21を無視して直接編集する行動パターンが観察されている。

**要件内容**:
CLAUDE.mdの「AIへの厳命」セクションのルール21に、具体的なエスカレーション手順を追加する。バリデーション失敗回数が3回以上の場合にOrchestratorが取るべき行動（問題箇所の特定、行番号レベルの修正指示を含むリトライプロンプト生成、モデルエスカレーション）を手順書形式で明記する。また、Orchestratorが直接編集したことを事後検出する仕組みの設計案（例: バリデーション前後のHASH比較ログ）を検討事項として記載する。

**受け入れ基準**:
- CLAUDE.mdのルール21にリトライ回数別のエスカレーション手順が明記されていること
- buildRetryPrompt()の11エラーパターンと改善指示テンプレートをCLAUDE.mdのリトライテンプレートセクションに反映すること
- Orchestratorがリトライ時に問題箇所の行番号と具体的修正指示をsubagentに渡す手順が明記されていること

### FR-7: code_reviewサブエージェントへの設計書読み込み指示を強化する

**背景**: code_reviewのsubagentTemplateが最小限（7〜15行程度）のため、subagentが設計書ファイルを入力として受け取らない場合、整合性検証が形式的になる。spec.md、state-machine.mmd、flowchart.mmd、ui-design.mdの4ファイルを入力として明示する必要がある。

**要件内容**:
definitions.tsのcode_review PhaseGuideのsubagentTemplateを拡張し、入力ファイルとして`{docsDir}/spec.md`、`{docsDir}/state-machine.mmd`、`{docsDir}/flowchart.mmd`、`{docsDir}/ui-design.md`の4ファイルを明示する。code_review実行手順として、各設計書の全機能・状態遷移・処理フロー・UI要素をリストアップしてから実装コードと照合する2段階手順を追加する。code-review.mdの出力フォーマットに「設計-実装整合性チェック結果」セクションを必須セクションとして追加することをPHASE_ARTIFACT_REQUIREMENTSに反映する。

**受け入れ基準**:
- code_review PhaseGuideのsubagentTemplateに4つの設計書ファイルが入力として明記されていること
- code-review.mdに「設計-実装整合性チェック結果」セクションが含まれること
- 設計書に記載された全項目と実装コードの対応関係が検証されていること
- 未実装項目がある場合はimplementationフェーズへの差し戻しが発生すること

---

## 非機能要件

### NFR-1: MCPサーバー再起動の要否判断基準

artifact-validator.ts、definitions.ts、state-manager.tsのいずれかを変更した場合、MCPサーバーの再起動が必須となる。CLAUDE.mdおよびphase-edit-guard.jsのみを変更する場合、MCPサーバーの再起動は不要である（ディスクから直接読み込まれるファイルのため）。本タスクの変更対象は主にCLAUDE.mdとdefinitions.tsであり、definitions.tsの変更後にはnpm run buildとMCPサーバー再起動を実施する。

再起動の手順は4ステップで構成される: トランスパイル実行（npm run build）、dist/*.jsの更新日時確認、MCPサーバープロセス再起動、workflow_statusによる現在フェーズの確認。この手順をCLAUDE.mdの「強制再起動条件」セクションに記載されている内容と整合させること。

### NFR-2: プロンプトサイズ制約

buildPrompt()が生成するプロンプトは既に9セクション・数百行の規模に達している。FR-1からFR-7の変更によるプロンプトサイズの増加を最小限に抑えるため、追加するテキストは各FRで50行以内とすること。重複する説明はCLAUDE.md参照へのリンクで代替し、プロンプト本体への重複埋め込みを避ける。

特に禁止パターン完全リスト（FR-1）については、buildPrompt()のセクション5で既にリスト展開されているため、CLAUDE.mdの新設セクションとの一致確認を行うことで十分であり、二重掲載を避ける。

### NFR-3: 副作用最小化

本タスクで変更するファイルの範囲は以下に限定する: CLAUDE.md（プロンプト品質ルールの追記・修正）、definitions.ts（PhaseGuide.subagentTemplateの拡張）、PHASE_ARTIFACT_REQUIREMENTS（code-review.mdの必須セクション追加）。phase-edit-guard.js、artifact-validator.ts、state-manager.tsは修正対象外とすることで、既存のバリデーション動作に対する副作用を防ぐ。

CLAUDE.mdの変更は追記（セクション追加）を主体とし、既存のルール番号（厳命1〜22）を変更しない。既存のsubagent起動テンプレートへの変更は最小限とし、必須セクション名と最低行数の修正のみとする。

### NFR-4: 整合性維持ルールの文書化

artifact-validator.tsのFORBIDDEN_PATTERNSやPHASE_ARTIFACT_REQUIREMENTSが将来変更された場合に、CLAUDE.mdの対応セクションも合わせて更新するルールをCLAUDE.mdに明記する。このルールは「コアモジュール変更後はCLAUDE.mdの対応セクションも更新すること」という形で「強制再起動条件」セクションの次に配置する。

---

## 受入条件

### 受入条件1: 禁止パターン問題の解決確認

CLAUDE.mdの「禁止パターン完全リスト（12語）」セクションが存在し、artifact-validator.tsのFORBIDDEN_PATTERNS配列と完全に一致する。subagent起動テンプレートがこのセクションへの参照を明示している。requirementsフェーズのsubagentを起動したとき、12語全てを把握した状態で成果物を作成できる。

### 受入条件2: 重複行検出問題の解決確認

CLAUDE.mdの8ルール説明に正規表現パターンが付記されており、ルール6とルール8の境界条件が明確に記述されている。subagentが太字ラベル後にコンテンツが続く行を重複検出の対象と認識し、各行に固有情報を含める設計ができる。

### 受入条件3: 必須セクション問題の解決確認

requirementsフェーズのsubagentプロンプトに「## 背景」「## 機能要件」「## 受入条件」が必須セクションとして明示されている。artifact-validator.tsのPHASE_ARTIFACT_REQUIREMENTSとsubagentテンプレートの必須セクション名・最低行数が一致している。

### 受入条件4: 出力パス問題の解決確認

buildPrompt()がdocsDirの実際のパス値をプロンプトの複数箇所に埋め込んでいる。Orchestratorのsubagent起動手順にworkflow_statusによるdocsDir取得ステップが明記されている。

### 受入条件5: Bashコマンド問題の解決確認

buildPrompt()のBash制限セクションにブロック時の代替ツール（Read/Write/Glob/Grep）が明記されている。CLAUDE.mdのBashカテゴリ表に代替手段の説明が追加されている。

### 受入条件6: Orchestrator直接編集問題の緩和確認

CLAUDE.mdのルール21にリトライ回数別のエスカレーション手順が追記されている。buildRetryPrompt()の11エラーパターンとCLAUDE.mdのリトライテンプレートが整合している。Orchestratorが3回以上リトライ失敗した場合に取るべき行動（行番号レベルの修正指示生成）が明記されている。

### 受入条件7: code_review整合性問題の解決確認

definitions.tsのcode_review subagentTemplateに4つの設計書ファイルが入力として明示されている。code-review.mdのPHASE_ARTIFACT_REQUIREMENTSに「設計-実装整合性チェック結果」セクションが必須として追加されている。設計書と実装コードの差分検証手順が2段階で明記されている。
