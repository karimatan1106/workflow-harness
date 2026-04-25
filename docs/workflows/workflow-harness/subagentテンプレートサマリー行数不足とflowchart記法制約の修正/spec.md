## サマリー

本仕様書は、ワークフロープラグインで発生している3つの問題に対する実装仕様を定義する。
問題1はサブエージェントに渡すサマリーテンプレートの例示行数がバリデーター要件（最低5実質行）を下回ることによりバリデーション失敗が多発する問題である。
問題2はflowchartノードの記法として角括弧形式が使用されると角括弧プレースホルダー検出と干渉する問題であり、definitions.tsのMermaidガイダンスセクションに制約を明記することで解消する。
問題3はenforce-workflow.jsのWORKFLOW_CONFIG_PATTERNSにmemory/ディレクトリが含まれておらず、かつisWorkflowConfigFileチェックがゼロタスクブロックより前に実行されるため、memory/へのパターン追加だけで問題が解消できる。
主要な決定事項は修正1がテンプレート文字列を5項目に拡張し、修正2が行1182の直後に1行を追加し、修正3がWORKFLOW_CONFIG_PATTERNSに1エントリを追加する3点である。
次フェーズ（test_design）では修正1・修正2の効果を検証するためのユニットテストと修正3を手動検証するためのテストシナリオを設計する。

## 概要

### 問題の背景

ワークフローフェーズ実行中、subagentが生成する成果物が複数のバリデーションエラーに直面するケースが報告された。
根本原因の調査により、問題はコードの欠陥ではなく、テンプレートの不足とパターン定義の漏れに起因することが確認された。

問題1の核心は、definitions.ts 行1251のサマリーテンプレートが例示する bullet 項目が3件（実質4行）であるのに対して、
バリデーターの `minSectionLines` 設定値が5であるため、subagentがテンプレートを忠実に再現しただけでは1行不足する点にある。
この1行の不足が毎回のサマリーセクション生成時にバリデーション失敗リスクを生み出しており、高頻度で発生する問題となっている。

問題2の核心は、CLAUDE.md と definitions.ts の両方において flowchart ノードの記法形式（丸括弧 vs 角括弧）に関する
明示的な使い分けガイダンスが存在しない点にある。subagentが `NodeID["日本語テキスト"]` 形式を使用すると、
バリデーターの角括弧プレースホルダー検出に誤検知される潜在的リスクがある。

問題3の核心は、enforce-workflow.js の WORKFLOW_CONFIG_PATTERNS が `.claude/state/` 以下の JSON ファイルと
設定ファイルのみを許可しており、`memory/MEMORY.md` パスをカバーするパターンが欠落している点にある。
タスク未開始（ゼロタスク）状態でも MEMORY.md の Write/Edit 操作がhookにブロックされる結果、
ユーザーがメモを更新できない状況が発生していた。

### 修正方針の決定

3つの問題はそれぞれ独立しており、修正は最小変更の原則に従う方針とした。
既存のバリデーションルール値（minSectionLines 等）は変更せず、テンプレートと許可パターンの側を要件に合わせる設計を採用する。
TypeScriptの型定義や既存インターフェースへの変更は不要であり、コードの追記と文字列修正のみで対応できることを確認した。

## 実装計画

### ステップ1: サマリーテンプレートへの項目追加（問題1対応）

対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` の行1251の `importantSection +=` 文の文字列リテラルである。
現在のテンプレートは3つの箇条書き項目（目的・主要な決定事項・次フェーズで必要な情報）と1行の説明文を合わせた合計4実質行を例示しており、バリデーター要件の5実質行を1行下回る。

この不足を解消するため、テンプレートを以下の5項目構成に変更する。
追加する2項目の位置と内容として、「目的」の後に「評価スコープ: 対象となるシステム・ファイル・機能の範囲」を挿入し、
「主要な決定事項」の後に「検証状況: テスト実施の有無と結果の概要」を挿入する。

変更後の実質行カウントは説明文行1行と5項目の bullet 5行の合計6実質行となり、minSectionLines=5の要件を満たす。
この修正はimportantSectionブロック（行1249〜1255）内の1行のみの変更であり、全フェーズのsubagentに対して一律に適用される。

### ステップ2: flowchart 記法制約の追記（問題2対応）

対象ファイルは修正1と同じ `workflow-plugin/mcp-server/src/phases/definitions.ts` であり、変更箇所は行1182の直後である。
現在の行1182は stateDiagram-v2 の名前付き状態制約を示す行であり、その直後に flowchart ノード記法の制約を示す1行を挿入する。

追記する制約の内容は「flowchartノードは NodeID(text) の丸括弧形式を使うこと。.mmdファイルは全行がバリデーター検出対象となるため角括弧形式は角括弧プレースホルダーとして誤検出されるため禁止」とする。
丸括弧形式を採用する技術的根拠として、artifact-validator.tsの角括弧プレースホルダー検出は extractNonCodeLines でコードフェンス外の全行が対象となり、.mmdファイルはコードフェンスに囲まれていないためノード定義行がそのまま検出されることが確認されている。
また NodeID(text) 形式はMermaid仕様で角丸四角形としてレンダリングされ、視覚的な区別が保たれるため安全な代替として機能する。

あわせて CLAUDE.md の「図式設計」セクションにある flowchart の例示コードも角括弧形式から丸括弧形式に変更する。
変更対象はプロジェクトルートの `CLAUDE.md` と `workflow-plugin/CLAUDE.md` の両方にflowchart例示が含まれる場合はそれぞれ更新する。

### ステップ3: WORKFLOW_CONFIG_PATTERNS へのパターン追加（問題3対応）

対象ファイルは `workflow-plugin/hooks/enforce-workflow.js` の行219〜224のWORKFLOW_CONFIG_PATTERNS配列である。
memory/ ディレクトリへのアクセスを許可する正規表現パターンを1件追加する。

追加するパターンの設計方針として、特定のユーザー名やプロジェクト名をハードコードせず、
`.claude`配下の`projects`ディレクトリ以下の任意のプロジェクト内にある `memory/` サブディレクトリ配下のファイル全般に対応する汎用パターンとする。
このパターンは Windows パス区切り文字（バックスラッシュ）と Unix パス区切り文字（スラッシュ）の両方に対応する。

フック処理フローにおける位置を確認すると、`isWorkflowConfigFile(filePath)` チェックが行329で実行されており、
ゼロタスクブロック（行364）より前に位置するため、パターン追加だけで対応が完結することを確認済みである。

### ステップ4: ビルドと動作確認

definitions.ts の変更後は `cd workflow-plugin/mcp-server && npm run build` を実行してトランスパイルを確認する。
ビルド成功後、MCPサーバーを再起動して変更を反映させる。なお enforce-workflow.js はNode.jsスクリプトとして起動時に毎回読み込まれるため、MCPサーバー再起動なしで即時反映される。
各修正の効果確認はコードレビューフェーズで実施し、テストシナリオはtest_designフェーズで設計する。

## 変更対象ファイル

### 主要修正ファイル（コード変更あり）

変更対象ファイルは2ファイルである。TypeScriptの型定義や既存インターフェースへの変更は不要で、追記と文字列修正のみで構成される。

ファイル1: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 問題1対応として行1251のテンプレート文字列を3項目から5項目に拡張する。変更規模は1行の文字列修正にとどまる。
- 問題2対応として行1182の直後にflowchart記法制約を示す1行を挿入する。変更規模は1行の追加にとどまる。
- このファイルはMCPサーバーのコアモジュールであり、変更後は必ず `npm run build` を実行すること。
- ビルド完了後はMCPサーバーの再起動が必須である（Node.jsモジュールキャッシュのため）。
- `workflow-plugin/mcp-server/dist/phases/definitions.js` はビルド時に自動生成されるため直接編集しないこと。

ファイル2: `workflow-plugin/hooks/enforce-workflow.js`
- 問題3対応として行219〜224の `WORKFLOW_CONFIG_PATTERNS` 配列末尾に1件のパターンを追加する。
- このファイルは JavaScript であるためビルド不要。Claude Desktopのhook再読み込みで反映される。
- 既存の4パターンは削除しない。新パターンを5件目として末尾に追加するのみである。

### 変更箇所一覧

| 変更番号 | ファイルパス | 変更種別 | 変更行 | 内容概要 |
| --- | --- | --- | --- | --- |
| 修正1 | workflow-plugin/mcp-server/src/phases/definitions.ts | 文字列修正 | 行1251 | サマリーテンプレートを3項目から5項目に拡張 |
| 修正2a | workflow-plugin/mcp-server/src/phases/definitions.ts | 行追加 | 行1182の後 | flowchartノード記法制約の1行追加 |
| 修正2b | CLAUDE.md | 例示変更 | 図式設計セクション | flowchart例示の角括弧を丸括弧に変更 |
| 修正2c | workflow-plugin/CLAUDE.md | 例示変更 | 図式設計セクション | flowchart例示の角括弧を丸括弧に変更 |
| 修正3 | workflow-plugin/hooks/enforce-workflow.js | 配列要素追加 | 行219〜224 | WORKFLOW_CONFIG_PATTERNSに1エントリ追加 |

変更ファイル数の合計は3ファイル（definitions.ts、CLAUDE.md 2か所、enforce-workflow.js）であり、いずれも追記または既存文字列の置換のみで構成される。新規ファイルの作成は不要である。

### 後方互換性の確認

本修正は以下の数値および定義を変更しない。
バリデーターの minSectionLines 値（現在は5）、minSectionDensity 値（現在は0.3）、
Mermaidの構造検証ルール（mermaidMinStates, mermaidMinTransitions）、TypeScriptのインターフェース定義と型定義のいずれも変更しない。

修正1の変更により、既存の成果物（過去のsubagentが生成したresearch.md等）に対してバリデーションが再実行されることはない。
修正3に関してphase-edit-guard.jsのALWAYS_ALLOWED_PATTERNSへの変更は今回対象外とする。
enforce-workflow.jsのisWorkflowConfigFileチェックがゼロタスクブロックより先に実行されるため、enforce-workflow.js側の修正だけで主要な問題経路が解消されると判断した。

## 実装仕様詳細

### 修正1: definitions.ts サマリーテンプレートの拡張（行1251）

現在のテンプレートは「目的」「主要な決定事項」「次フェーズで必要な情報」の3項目で構成されている。
修正後は「目的」「評価スコープ」「主要な決定事項」「検証状況」「次フェーズで必要な情報」の5項目に拡張する。

変更後の文字列リテラル（行1251の右辺部分）は以下のとおりである。

```typescript
importantSection += `成果物の先頭には必ず以下のセクションを配置してください:\n\n## サマリー\n\n（${rules.maxSummaryLines}行以内で、このドキュメントの要点を記述）\n- 目的: このドキュメントの目的\n- 評価スコープ: 対象となるシステム・ファイル・機能の範囲\n- 主要な決定事項: 重要な設計決定や技術選定\n- 検証状況: テスト実施の有無と結果の概要\n- 次フェーズで必要な情報: 後続フェーズで必須となる情報\n\n`;
```

### 修正2a: definitions.ts Mermaidガイダンスへのflowchart記法制約追加（行1182の後）

現在の行1182の直後に以下の1行を挿入する。

```typescript
qualitySection += `- flowchartノードは NodeID(text) の丸括弧形式を使うこと。.mmdファイルは全行がバリデーター検出対象となるため NodeID[text] や NodeID["text"] の角括弧形式は角括弧プレースホルダーとして誤検出されるため禁止\n`;
```

### 修正3: enforce-workflow.js WORKFLOW_CONFIG_PATTERNSへのmemory/パターン追加

追加するパターン（5番目の要素）は以下のとおりである。

```javascript
/\.claude[\/\\]projects[\/\\][^\/\\]+[\/\\]memory[\/\\]/i,
```

このパターンは `.claude/projects/` の後に任意のプロジェクト名が続き、さらに `memory/` が続くパスに一致する。
パスの末尾部分（ファイル名）は指定しないため、MEMORY.md に限らず memory/ ディレクトリ配下の全ファイルが許可対象となる。
