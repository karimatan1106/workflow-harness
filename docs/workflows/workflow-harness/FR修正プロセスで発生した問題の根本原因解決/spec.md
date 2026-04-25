## サマリー

- 目的: FR修正プロセス中に顕在化した5つの問題について、`definitions.ts` を対象とした具体的な修正仕様を定義する
- 対象ファイル: 全5件の修正は `workflow-plugin/mcp-server/src/phases/definitions.ts` 単一ファイルに集約される
- 影響範囲: subagentプロンプト生成ロジックと `code_review` の必須セクション定義のみであり、バリデーターやコアモジュールへの変更は含まない
- 修正後の手順: `npm run build` によるトランスパイルと MCPサーバープロセスの再起動が必須である
- 次フェーズで必要な情報: 各修正の対象行番号（821行・862行・871行・890行・945行・1093〜1098行）と修正前後のコードスニペット、受け入れ条件

---

## 概要

本仕様書は `workflow-plugin/mcp-server/src/phases/definitions.ts` に対する5件の修正内容を定義する。
修正の背景は、parallel_verificationフェーズで発生した連続バリデーション失敗の根本原因調査から得られた知見である。
調査の結果、subagentプロンプトに記載すべき情報が欠落していること、および `code_review` の必須セクション定義が
`artifact-validator.ts` の定義と不一致であることが判明した。
今回の修正はいずれも `definitions.ts` 内の文字列リテラル変更・配列要素追加・ループ削除であり、
型定義や関数シグネチャを変更しないため TypeScript コンパイルエラーのリスクは低い。
修正後は Node.js のモジュールキャッシュを無効化するために MCP サーバーの再起動が不可欠となる。

---

## 変更対象ファイル

修正対象は1ファイルのみに限定されている。

- ファイルパス: `workflow-plugin/mcp-server/src/phases/definitions.ts`
- 修正件数: 計6箇所（FR-A × 1、FR-B × 1、FR-C × 1、FR-D × 1、FR-E × 2）
- 修正種別: 配列要素追加（FR-A）、ループ処理の3行間接参照への置き換え（FR-B）、subagentTemplateへの注意事項追記（FR-C・FR-D・FR-E）
- 変更後に必要な作業: `npm run build` によるトランスパイルと MCPサーバープロセスの再起動
- 変更対象外: `artifact-validator.ts`・`state-manager.ts`・その他コアモジュールは今回の修正範囲に含まない

---

## 実装計画

修正は以下の順序で `definitions.ts` の各箇所に対して実施する。

1. FR-A（821行目）: `code_review` サブフェーズの `requiredSections` 配列に `'## パフォーマンス'` を末尾追加し、配列を5要素にする
2. FR-B（1093〜1098行目）: `buildPrompt()` 内のループ処理を削除し、3グループ名称と語数を示す3行の文字列に置き換える
3. FR-C（890行目）: `manual_test` フェーズの `subagentTemplate` に重複行回避ガイダンスセクションを追記する
4. FR-D（945行目）: `commit` フェーズの `subagentTemplate` にサブモジュール確認の3ステップ手順を追記する
5. FR-E（862行目・871行目）: `testing` フェーズと `regression_test` フェーズ各 `subagentTemplate` に `workflow_record_test_result` の制約説明を追記する
6. 全修正後に `npm run build` を実行し TypeScript コンパイルが成功することを確認する
7. MCPサーバーを再起動し、`workflow_status` で現在フェーズを確認する

---

## FR-A: code_reviewのrequiredSectionsに「パフォーマンス」を追加

### 修正対象行

- 修正対象: definitions.tsのcode_reviewサブフェーズ定義部（821行目付近）
- 対象行番号: 821行目

### 修正前のコード

```typescript
requiredSections: ['## サマリー', '## 設計-実装整合性', '## コード品質', '## セキュリティ'],
```

### 修正後のコード

```typescript
requiredSections: ['## サマリー', '## 設計-実装整合性', '## コード品質', '## セキュリティ', '## パフォーマンス'],
```

### 変更内容の説明

`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` では `code-review.md` に `'パフォーマンス'` セクションを必須と定義しているが、`definitions.ts` の phaseGuide 側の配列に同セクションが含まれていなかった。この欠落により、`buildPrompt()` 関数がsubagentプロンプトに生成する「必須セクション一覧」にパフォーマンスが表示されず、subagentが当該セクションを作成しないままバリデーション失敗が発生する。配列の末尾に要素を1件追加することで両者の定義を一致させる。

### 受け入れ条件

- `code_review` サブフェーズの `requiredSections` 配列が5要素（サマリー・設計-実装整合性・コード品質・セキュリティ・パフォーマンス）になること
- MCPサーバー再起動後にcode_reviewフェーズのsubagentプロンプトに「## パフォーマンス」が必須セクションとして表示されること
- `artifact-validator.ts` の `code-review.md` 定義との整合が取れること

---

## FR-B: buildPromptの禁止語列挙をグループ名間接参照に変更

### 修正対象行

- 修正対象: definitions.tsのbuildPrompt関数内ループ処理部（1093〜1098行目）
- 対象行番号: 1093〜1098行目（ループ処理部分）

### 修正前のコード

```typescript
qualitySection += `\n### 禁止パターン（完全リスト）\n`;
qualitySection += `成果物内に以下のパターンが1つでも含まれるとエラーになります（includes()による部分一致検索のため、禁止語を含む複合語も検出対象）:\n`;
qualitySection += `言い換え例: 「定義されていない」「型が確定していない」「追加調査が必要な事項」のように具体的表現を使用すること\n`;
for (const pattern of rules.forbiddenPatterns) {
  qualitySection += `- ${pattern}\n`;
}
```

### 修正後のコード

```typescript
qualitySection += `\n### 禁止パターン（グループ別参照）\n`;
qualitySection += `成果物内に特定の語句グループが1つでも含まれるとエラーになります（部分一致検索のため、禁止語を含む複合語も検出対象）:\n`;
qualitySection += `- 英語系略語グループ（4語）: 作業中・課題管理で使われる英語略語\n`;
qualitySection += `- 検討系グループ（4語）: 検討・未確定の状態を表す日本語表現\n`;
qualitySection += `- 予定・仮値系グループ（4語）: 暫定的な状態や架空データを示す日本語表現\n`;
qualitySection += `言い換え例: 「定義されていない」「型が確定していない」「追加調査が必要な事項」のように具体的表現を使用すること\n`;
```

### 変更内容の説明

`buildPrompt()` 関数の1096〜1098行目は `rules.forbiddenPatterns` 配列をループして12語の禁止語をそのままプロンプトに展開する。このプロンプトを受け取ったsubagentは禁止語リストを「説明すべき対象」として認識し、成果物本文に転記するリスクがある。特にcode_reviewフェーズのような長文成果物では、入力ファイルから語句を引用するパスが多く顕在化しやすい。ループ処理を削除し、グループ名称と語数のみを3行で示す形式に変更することでこのセルフレファレンシャルな問題を回避する。1099行目以降の複合語言い換えルールセクションはそのまま保持する。

### 受け入れ条件

- `buildPrompt()` が生成するプロンプトに、禁止語の個別語句（12語それぞれ）がプレーンテキストとして埋め込まれていないこと
- 3グループの名称と語数の説明がプロンプトに含まれること
- 1099行目以降の言い換えパターンセクションが引き続きプロンプトに含まれること
- MCPサーバー再起動後にsubagentプロンプトの該当セクションで個別語句の列挙が存在しないこと

---

## FR-C: manual_testのsubagentTemplateに重複行回避ガイダンス追加

### 修正対象行

- 修正対象: definitions.tsのmanual_testフェーズsubagentTemplate定義部（890行目付近）
- 対象行番号: 890行目（`manual_test` フェーズの `subagentTemplate` フィールド）

### 修正前のコード

```typescript
subagentTemplate: '# manual_testフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\n手動テストを実施してください。\n\n## 出力\n${docsDir}/manual-test.md',
```

### 修正後のコード

```typescript
subagentTemplate: '# manual_testフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\n手動テストを実施してください。\n\n## 重複行回避の注意事項\n複数のテストシナリオで同一のファイルや操作内容を記述する場合、各行の先頭にシナリオ番号や具体的な操作内容を含めて行を一意にすること。50文字を超える行が3回以上同一内容で出現すると重複行エラーとなる。\n- NG: 同一の対象ファイルパス行を3シナリオで繰り返す\n- OK: 「シナリオ1の確認対象: definitions.tsのcode_review requiredSections定義」\n- OK: 「シナリオ2の確認対象: definitions.tsのbuildPrompt禁止語ループ部分」\n\n## 出力\n${docsDir}/manual-test.md',
```

### 変更内容の説明

テストシナリオが3件以上あり、それぞれで同じ対象ファイルを検証する場合、「確認対象: `...definitions.ts`」のような50文字を超える行が3回以上出現して重複行検出エラーになる。`buildPrompt()` が生成する汎用ガイダンスには複数シナリオでの重複行問題が記載されているが、`subagentTemplate` 側の指示が「手動テストを実施してください」の1文のみであり、フェーズ固有の状況に対する具体的な注意喚起が欠けていた。テンプレートに注意事項セクションと具体例を追加することでsubagentが事前に対策を取れるようにする。

### 受け入れ条件

- `manual_test` の `subagentTemplate` に重複行回避の指示が含まれること
- 一意化のための具体的な記述例（シナリオ番号や操作内容を含める形式）が記載されていること
- MCPサーバー再起動後にmanual_testフェーズのプロンプトに当該ガイダンスが反映されること

---

## FR-D: commitのsubagentTemplateにサブモジュール対応手順追加

### 修正対象行

- 修正対象: definitions.tsのcommitフェーズsubagentTemplate定義部（945行目付近）
- 対象行番号: 945行目（`commit` フェーズの `subagentTemplate` フィールド）

### 修正前のコード

```typescript
subagentTemplate: '# commitフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\n変更をコミットしてください。',
```

### 修正後のコード

```typescript
subagentTemplate: '# commitフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\n変更をコミットしてください。\n\n## 変更ファイルの確認手順\n1. まず git status --short で全変更ファイルをリストアップすること\n2. 出力に「modified: workflow-plugin (modified content)」のような行があればサブモジュール内に変更ファイルが存在する。サブモジュールディレクトリに移動して変更ファイルを個別に git add してからサブモジュール内でコミットすること\n3. スコープ設定で指定されたディレクトリの変更をすべてステージングしたことを確認してからコミットを実行すること',
```

### 変更内容の説明

`commit` フェーズの `subagentTemplate` は「変更をコミットしてください」の1文のみであり、サブモジュール構造への言及がなかった。Gitのサブモジュール内変更は `git status` で `modified: workflow-plugin (modified content)` の形式で表示されるため、個別ファイルの変更と見なされにくく、見落としの実績がある。テンプレートに3ステップの確認手順を追加することで、subagentがサブモジュール内変更を確実にステージングできるようにする。

### 受け入れ条件

- `commit` フェーズの `subagentTemplate` に `git status --short` の実行指示が含まれること
- サブモジュール内変更の確認手順（サブモジュールディレクトリへの移動と個別ステージング）が記載されること
- MCPサーバー再起動後にcommitフェーズのプロンプトに当該ガイダンスが反映されること

---

## FR-E: testing/regression_testのsubagentTemplateにworkflow_record_test_result制約文書化

### 修正対象行

- 修正対象: definitions.tsのtesting/regression_testフェーズsubagentTemplate定義部（862行目・871行目）
- testingフェーズ: 862行目（`testing` フェーズの `subagentTemplate` フィールド）
- regression_testフェーズ: 871行目（`regression_test` フェーズの `subagentTemplate` フィールド）

### testingフェーズの修正前のコード

```typescript
subagentTemplate: '# testingフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\nテストを実行してください。',
```

### testingフェーズの修正後のコード

```typescript
subagentTemplate: '# testingフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\nテストを実行してください。\n\n## workflow_record_test_result 呼び出し時の注意\n- exitCode=0であっても、出力テキストの集計行に失敗を示す語句が含まれるとツールがブロックエラーを返す\n- この場合は出力テキストを「テスト完了。失敗件数0、成功件数N」のようなサマリー形式に整形してから渡すこと\n- 同一の出力テキストを重複して送信した場合もブロックエラーとなる',
```

### regression_testフェーズの修正前のコード

```typescript
subagentTemplate: '# regression_testフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\nリグレッションテストを実行してください。',
```

### regression_testフェーズの修正後のコード

```typescript
subagentTemplate: '# regression_testフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\nリグレッションテストを実行してください。\n\n## workflow_record_test_result 呼び出し時の注意\n- exitCode=0であっても、出力テキストの集計行に失敗を示す語句が含まれるとツールがブロックエラーを返す\n- この場合は出力テキストを「テスト完了。失敗件数0、成功件数N」のようなサマリー形式に整形してから渡すこと\n- regression_testフェーズでは、同一の出力テキストを再送信した場合も記録が許可されている（他フェーズでは重複送信がブロックされるが、このフェーズは例外として扱われる）',
```

### 変更内容の説明

`record-test-result.ts` には2つのブロッキングバリデーション制約が実装されているが、`testing` および `regression_test` フェーズの `subagentTemplate` にこれらの制約が記載されていなかった。制約の一つは、exitCode=0であっても集計行に失敗を示す語句が含まれる場合のブロックであり、もう一つは同一出力ハッシュの重複記録ブロックである。後者については `regression_test` フェーズで再記録が許可される例外がある。両フェーズのテンプレートに注意事項を追記し、subagentが事前に対策を取れるようにする。

### 受け入れ条件

- `testing` フェーズの `subagentTemplate` に制約（exitCode=0でも集計行の語句によるブロック）の説明と対処方法が含まれること
- `regression_test` フェーズの `subagentTemplate` に同制約の説明と、再記録が許可される旨の説明が含まれること
- MCPサーバー再起動後に各フェーズのプロンプトに当該ガイダンスが反映されること

---

## 非機能要件と実施上の制約

### 修正範囲の限定

全5件の修正はいずれも `definitions.ts` 単一ファイルへの変更のみである。`artifact-validator.ts`・`state-manager.ts`・その他のコアモジュールへの変更は含まない。変更の影響範囲はsubagentプロンプト生成ロジックと `code_review` の必須セクション定義に限定される。

### ビルドと再起動の義務

`definitions.ts` 変更後は以下の手順を必ず実施すること。

- 手順1: `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行し、TypeScriptをトランスパイルする
- 手順2: Claude Desktopのサーバー再起動機能でMCPサーバープロセスを終了して再起動する
- 手順3: `workflow_status` で現在のフェーズを確認してから次フェーズに進む

### TypeScriptコンパイル要件

今回の修正内容は文字列リテラルの変更・配列要素追加・ループ削除のみであり、型定義や関数シグネチャの変更を伴わない。修正後に `npm run build` がエラーなく完了することが受け入れ条件に含まれる。

### 将来の技術的負債

FR-Aの根本原因である `artifact-validator.ts` と `definitions.ts` の二重管理構造については、今回は対症療法的対応（両者の整合）に留める。将来的には単一の定義ソースを参照する統合構造への移行が望ましい。

---

## 修正対象行番号まとめ

| 要件 | フェーズ | 行番号 | 変更内容 |
|------|---------|--------|---------|
| FR-A | code_review | 821 | requiredSections配列に5番目の要素を追加 |
| FR-B | buildPrompt関数 | 1093〜1098 | ループ処理を3行のグループ参照に置き換え |
| FR-C | manual_test | 890 | subagentTemplateに注意事項セクションを追記 |
| FR-D | commit | 945 | subagentTemplateに3ステップ確認手順を追記 |
| FR-E(1) | testing | 862 | subagentTemplateにAPI制約の注意事項を追記 |
| FR-E(2) | regression_test | 871 | subagentTemplateにAPI制約と例外規定を追記 |
