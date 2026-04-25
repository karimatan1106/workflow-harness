## サマリー

本調査は、ワークフロー実行時にサブエージェントが繰り返しバリデーション失敗する7つの問題の根本原因を特定することを目的とした。

主要な調査対象ファイル:
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts` — バリデーションロジック全体を定義
- `workflow-plugin/mcp-server/src/phases/definitions.ts` — フェーズ定義とbuildPrompt関数を収録
- `workflow-plugin/hooks/phase-edit-guard.js` — Bash/Edit操作のフェーズ制限を実装

主要な発見事項:
- 問題1（禁止パターン）: artifact-validator.tsの12語リストは`exportGlobalRules()`経由でbuildPrompt()に注入されているが、CLAUDE.md記載のリストと微差が生じるリスクがある
- 問題2（同一行繰り返し）: `isStructuralLine()`の8ルールはCLAUDE.mdの記述と実装の間で正規表現レベルの差異が存在する
- 問題3（必須セクション/行数）: `PHASE_ARTIFACT_REQUIREMENTS`の定義はCLAUDE.mdの記述と一部乖離している
- 問題4（出力パス）: buildPrompt()がdocsDirを明示するが、Orchestratorのプロンプト構築精度に依存する
- 問題5（Bashコマンド）: buildPrompt()は動的に展開するが、フェーズ別許可リストの網羅性に改善余地がある
- 問題6（Orchestrator直接編集）: phase-edit-guard.jsにOrchestratorの直接編集を技術的にブロックする機構が存在しない
- 問題7（設計-実装整合性チェック）: code_reviewのPhaseGuideにチェックリストは存在するが、subagentTemplateが最小限のため具体性が低い

次フェーズで必要な情報:
- 各問題の修正案と実装計画
- artifact-validator.ts、definitions.ts、CLAUDE.mdの整合性を取る具体的な変更内容

---

## 調査結果

### 問題1: 禁止パターン検出の繰り返し

`artifact-validator.ts`の`FORBIDDEN_PATTERNS`配列（343〜356行）に定義された完全なリストは以下の通り:

```
'TODO', 'TBD', 'WIP', 'FIXME',
'未定', '未確定', '要検討', '検討中', '対応予定', 'サンプル', 'ダミー', '仮置き'
```

英語4語・日本語8語の合計12語が`content.includes(pattern)`（部分一致）で検出される。この12語はCLAUDE.mdの「禁止パターン（完全リスト）」セクションに記述されており、exportGlobalRules()関数がこのリストをGlobalRules型として出力し、buildPrompt()のセクション5（成果物品質要件）へ動的注入している。

問題の根本原因として、サブエージェントがCLAUDE.mdの「禁止語を含む複合語も検出対象」という記述を軽視し、禁止語を別の文脈で使い続けるケースが観察される。特にリトライプロンプトでOrchestratorがエラーメッセージから禁止語を直接引用し、成果物に転記されるケースも報告されている。buildRetryPromptがエラー内容をコードブロックで囲む設計になっているが、サブエージェントが改善要求セクションで禁止語を再使用する事態が発生している。

### 問題2: 同一行繰り返し（重複行検出）

`isStructuralLine()`の実装（artifact-validator.ts 92〜111行）と、CLAUDE.mdの説明文には微差がある。実装の8ルールを正確に示す:

ルール1: `^#+\s`で始まるヘッダー行（`#`, `##`, `###`等）を除外する。
ルール2: `^[-*_]{3,}$`にマッチする水平線行を除外する。ハイフン・アスタリスク・アンダースコアが3文字以上連続する行が対象。
ルール3: バッククォート3つ（` ``` `）で始まるコードフェンス境界行を除外する。コードフェンス内の全行も除外（内部行管理フラグで制御）。
ルール4: `^\s*\|[\s:-]+(\|[\s:-]+)*\|\s*$`にマッチするテーブルセパレータ行を除外する。
ルール5: `^\s*\|.+\|.+\|\s*$`にマッチするテーブルデータ行（2列以上）を除外する。
ルール6: `^\*\*[^*]+\*\*[:：]?\s*$`にマッチする太字ラベル行（行末がコロン）を除外する。
ルール7: `^[-*]\s+\*\*[^*]+\*\*[:：]?\s*$`にマッチするリスト形式の太字ラベル行を除外する。
ルール8: `^(?:[-*]\s+)?.{1,50}[:：]\s*$`にマッチする50文字以内でコロン終端のラベル行を除外する。

ルール6の重要な限定条件として、行末の状態が問題になる: `**text**: 値` のように太字ラベルの後にコンテンツが続く行はルール6の除外対象にならず、重複検出の対象となる。これがCLAUDE.mdの「対象になる行」の注記で述べられている。

### 問題3: 必須セクション・行数不足

`PHASE_ARTIFACT_REQUIREMENTS`の定義（artifact-validator.ts 159〜234行）を確認した結果:

research.mdには`minLines: 20`（遷移条件は`minLinesForTransition: 16`）と、`## 調査結果`・`## 既存実装の分析`の2セクションが必須とされる。requirements.mdには`minLines: 30`と、`## 背景`・`## 機能要件`・`## 受入条件`の3セクションが必須。spec.mdには`minLines: 50`（遷移条件は`minLinesForTransition: 5`）と、`## 概要`・`## 実装計画`・`## 変更対象ファイル`の3セクションが必須。manual-test.md・security-scan.md・performance-test.md・e2e-test.mdの各検証ファイルには`minLines: 20`と各固有セクションが必須。

セクション密度チェック（checkSectionDensity関数）では、各`##`見出しセクション内に実質行が最低5行、かつ密度30%以上が要求される。実質行のカウント対象外となる行のルールがCLAUDE.mdに詳述されているが、これがbuildPrompt()のセクション5に反映されているか確認が必要。

### 問題4: 出力パスの誤り

buildPrompt()のセクション9（パス警告）には以下のテキストが埋め込まれる: 「★重要: 出力先のパスは必ず ${docsDir}/ を正確に使用すること。タスク名から独自にパスを構築しないこと。」という明示的な注意書きがある。

しかし実際の問題はOrchestratorが`Task()`ツール呼び出し時にこのパラメータを省略または誤指定するケースにある。定義済みの`resolvePlaceholders()`関数がテンプレート内の`${変数名}`を置換するが、OrchestratorがTask起動時に渡すdocsDirパラメータの精度に依存している。ワークフロー状態管理ファイル（workflow-state.json）にはdocsDirが記録されており、workflow_statusツールで取得可能だが、Orchestratorが明示的に読み込まない限り省略される。

### 問題5: Bashコマンドブロック

buildPrompt()のセクション6はbash-whitelist.jsから動的にコマンドリストを展開する。フェーズ別の許可カテゴリは`PHASE_GUIDES[phase].bashCategories`で定義されており、以下のカテゴリが存在する: readonly（ls, pwd, cat等の読み取り）、testing（npm test, vitest等）、implementation（npm install, build, mkdir, rm等）、git（git add, git commit, git tag）。

問題の根本は、サブエージェントがreadonly制限のあるフェーズ（research, requirements等）で実装系コマンドを試みること。特にresearchフェーズでnpm testを実行しようとする事例が確認されている。buildPrompt()はカテゴリ外コマンドのブロックを警告しているが、サブエージェントがブロックされた後の代替手段（Read/Write/Glob/Grep等の専用ツール）への切り替えが不十分なケースがある。

### 問題6: Orchestratorによるルール21違反

phase-edit-guard.jsの実装を精査した結果、`ALWAYS_ALLOWED_PATTERNS`には`workflow-state.json`のみが含まれており、`docs/workflows/`配下のファイルに対するOrchestratorの直接編集を技術的にブロックする機構は存在しない。フックはフェーズ外の編集を警告または拒否するが、アクティブなフェーズの成果物ファイル（docsDir配下）への編集は許可されている。

ルール21（CLAUDE.md「AIへの厳命」21番）は「workflow_nextまたはworkflow_complete_subで成果物バリデーション失敗メッセージを受け取った場合、OrchestratorはEdit/WriteツールでArtifactを直接修正してはならない」と規定するが、これは技術的強制ではなく指示ベースの制約にとどまる。バリデーション失敗が何度も繰り返されるとOrchestratorがルール21を意識的に回避する傾向が観察される。

現在の設計上の制約として、check-workflow-artifact.jsフック（PostToolUse）はworkflow_next実行後にバリデーション結果をチェックするが、Orchestratorが直接Writeした後のworkflow_next呼び出し時点では既に成果物が「修正済み」状態になっているため、直接編集の検出が困難。

### 問題7: 設計-実装整合性チェックの不完全性

code_reviewのPhaseGuide（definitions.ts内）には7項目のchecklistが定義されている:
1. spec.mdの全機能が実装されているか
2. state-machine.mmdの全状態遷移が実装されているか
3. flowchart.mmdの全処理フローが実装されているか
4. ui-design.mdの全UI要素が実装されているか
5. 設計書にない追加機能が実装されていないか
6. 未実装項目がある場合はimplementationフェーズへ差し戻すこと
7. code-review.mdに設計-実装整合性セクションを記載すること

buildPrompt()のセクション8はこのchecklistを動的展開するが、code_reviewのsubagentTemplateは最小限の数行にとどまる。実際の課題は、code_reviewサブエージェントが設計書ファイル（spec.md, state-machine.mmd, flowchart.mmd, ui-design.md）を入力ファイルとして明示的に受け取らない場合、設計書と実装コードの差分検証が形式的になること。definitions.tsのcode_review PhaseGuideに記載されたinputFilesが最新の状態を保持しているかの確認も必要。

---

## 既存実装の分析

### artifact-validator.tsの構造

`validateArtifact()`関数は主に6つのチェックを実行する。禁止パターンチェックでは、コードフェンス内のコンテンツは除外されるが、インラインコード（シングルバックティック）内も除外対象となる。セクション密度チェックでは、各`##`セクションの開始から次の`##`までの範囲で実質行をカウントし、5行未満または密度30%未満の場合にエラーを返す。重複行チェックでは、`isStructuralLine()`で除外されない行をトリム後に比較し、同一行が3回以上出現した場合にエラーとなる。

`exportGlobalRules()`関数はGlobalRules型オブジェクトを返し、以下のプロパティを含む: `forbiddenPatterns`（12語配列）、`isStructuralLineRules`（8ルールのテキスト説明）、`sectionDensityRules`（セクション密度要件）、`duplicateDetectionRules`（重複検出ルール）、`phaseRequirements`（フェーズ別要件マップ）。

### definitions.tsのbuildPrompt実装

`buildPrompt(phase, context)`関数は`GlobalRules`オブジェクトを引数に取り、9セクションの構造化プロンプトを生成する。セクション5では全禁止パターンをリスト形式で展開し、isStructuralLine()の8ルールを説明文として含む。セクション6では該当フェーズのbashCategoriesに基づいてコマンドリストを動的生成する。セクション8では`guide.checklist`が存在する場合に各項目を展開する。

個々のPhaseGuideの`subagentTemplate`文字列は最小限（7〜15行程度）であり、OrchestratorがbuildPrompt()を経由せず直接テンプレートを使用した場合、品質要件の大部分が欠落する。この問題はCLAUDE.mdの「subagent起動テンプレート」セクションにTask()ツール呼び出しの形式が示されているが、buildPrompt()の呼び出しが明示されていないことに起因する可能性がある。

### phase-edit-guard.jsのフェーズ検証

`findTaskByFilePathUnified()`関数はファイルパスとタスクのdocsDir・workflowDir・scopeを照合し、編集中のファイルが属するタスクを特定する。フェーズ別のALLOWED_FILE_TYPESを`PHASE_FILE_PERMISSIONS`から取得し、拡張子マッチングで許否を判定する。

現在の設計では、アクティブなフェーズがresearchであっても、docsDir配下のMarkdownファイルへの書き込みは許可されている（readonlyカテゴリはBashコマンドの制限であり、Write/Editツールの制限ではない）。これはOrchestratorによる直接編集を技術的に防止できない根本的な原因となっている。

### CLAUDE.mdとの整合性ギャップ

CLAUDE.mdの成果物品質要件セクションには「禁止語の完全リストはCLAUDE.mdの『禁止パターン（完全リスト）』を参照すること」と記述されているが、CLAUDE.md自身にはその完全リストのセクション見出しが存在しない（artifact-validator.tsに定義があるのみ）。サブエージェントがCLAUDE.mdを参照する際に完全リストを確認できない状態になっている。

また、`isStructuralLine()`の8ルールについてCLAUDE.mdの説明とartifact-validator.tsの実装では表現の差異があり、特にルール8（50文字以内コロン終端）がCLAUDE.mdでは`- **前提条件**:`のような具体例で示されているが、実装では`^(?:[-*]\s+)?.{1,50}[:：]\s*$`という正規表現で定義される。この差異がサブエージェントの成果物作成時に誤解を生む可能性がある。

### buildRetryPromptの11エラーパターン

buildRetryPrompt()には以下のエラーパターンが定義されており、各パターンに対する改善指示テンプレートが用意されている: FORBIDDEN_PATTERN（禁止語検出）、DUPLICATE_LINE（同一行繰り返し）、SECTION_MISSING（必須セクション欠落）、SECTION_DENSITY（セクション密度不足）、MIN_LINES（最低行数不足）、PLACEHOLDER（角括弧プレースホルダー）、STRUCTURAL_VIOLATION（構造違反）、CODE_FENCE（コードフェンス問題）、TABLE_FORMAT（テーブル形式問題）、SUMMARY_MISSING（サマリーセクション欠落）、DESIGN_IMPL_MISMATCH（設計-実装不整合）。

これらのパターンは問題の診断精度向上に寄与するが、Orchestratorがエラーメッセージからパターンを正確に分類し、適切なテンプレートを選択する実装が必要となる。現状ではOrchestratorがbuildRetryPrompt()を呼び出す実装コードがCLAUDE.mdのサブエージェント起動テンプレートセクションには示されておらず、Orchestratorが独自にリトライプロンプトを構築している可能性がある。
