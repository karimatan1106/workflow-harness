## サマリー

- 目的: FR修正プロセス中に発生した5つの問題について、`definitions.ts`の修正を中心とした具体的な修正要件を定義する
- 主要な決定事項: 全5問題の修正対象は `workflow-plugin/mcp-server/src/phases/definitions.ts` に集約される。問題1〜5はいずれもコード変更であり、修正後はMCPサーバーの再起動が必須。問題3については `definitions.ts` の `manual_test` の `subagentTemplate` 拡充で対応し、CLAUDE.mdへの変更は行わない。
- 次フェーズで必要な情報: 各問題の修正対象行番号（821行目、1093〜1098行目、890行目付近、939行目付近、862行目と871行目）、各要件の受け入れ条件

---

## 機能要件

### 要件1: code_reviewフェーズのrequiredSectionsに「パフォーマンス」セクションを追加

#### 背景と目的

`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` では `code-review.md` に
`'パフォーマンス'` セクションを必須と定義しているが、`definitions.ts` の
`code_review` サブフェーズ（821行目）の `phaseGuide.requiredSections` に
`'## パフォーマンス'` が含まれていない。

この欠落によりsubagentはパフォーマンスセクションを成果物に含めず、バリデーションが失敗する。
バリデーターと `definitions.ts` は独立したデータ構造を持つ二重管理の設計となっており、
今回は対症療法的に両者を一致させることで問題を解消する。

#### 修正内容

`definitions.ts` の821行目の `requiredSections` 配列に `'## パフォーマンス'` を末尾に追加する。
変更後の配列は5要素となり、`artifact-validator.ts` の `requiredSections` と一致する。

#### 受け入れ条件

- `definitions.ts` の `code_review` サブフェーズの `requiredSections` に `'## パフォーマンス'` が含まれること
- `artifact-validator.ts` の `code-review.md` 定義と `requiredSections` の内容が一致すること
- MCPサーバー再起動後にcode_reviewフェーズのsubagentプロンプトに「## パフォーマンス」が必須セクションとして表示されること

---

### 要件2: buildPromptの禁止語列挙をグループ名称による間接参照に変更

#### 背景と目的

`buildPrompt()` 関数の1093〜1098行目は `rules.forbiddenPatterns` 配列をループで展開し、
12語の禁止語を直接プロンプトに埋め込んでいる。このプロンプトを受け取ったsubagentは
禁止語を「説明すべき対象」として認識し、成果物本文に転記するリスクがある。

code_reviewフェーズなど複数の観点を記述する長文フェーズでは、入力ファイルから
語句を引用するパスが多く、このリスクが特に顕在化する。

#### 修正内容

`buildPrompt()` の1093〜1098行目のループ処理を削除し、以下の3グループ名称と語数のみを
プロンプトに含める形式に書き換える。

- 英語系略語グループ（4語）: 作業中・課題管理で使われる英語略語
- 検討系グループ（4語）: 検討・未確定の状態を表す日本語表現
- 予定・仮値系グループ（4語）: 暫定的な状態や架空データを示す日本語表現

既存の1099〜1108行目にあるグループ説明と言い換え例はそのまま保持する。

#### 受け入れ条件

- `buildPrompt()` が生成するプロンプトに禁止語の個別語句（12語それぞれ）が
  プレーンテキストとして埋め込まれていないこと
- グループ名称と語数の説明が代わりに含まれていること
- 言い換えパターン（1099〜1108行目の内容）がプロンプトに引き続き含まれること
- MCPサーバー再起動後にsubagentプロンプトの該当セクションに個別語句の列挙が存在しないこと

---

### 要件3: manual_testのsubagentTemplateに重複行回避の具体的指示を追加

#### 背景と目的

`definitions.ts` の890行目にある `manual_test` フェーズの `subagentTemplate` は
「手動テストを実施してください」という最低限の指示のみを含んでいる。

複数シナリオ（3つ以上）で同一のファイルやコンポーネントを検証対象とした場合、
「対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`」のような
50文字超の行が3回以上出現し、重複行検出エラーとなる。現在のテンプレートには
この状況への対処方法が記述されていない。

#### 修正内容

`definitions.ts` の890行目の `manual_test` フェーズ `subagentTemplate` に以下の内容を追加する。

追加する指示の要点:
- 複数のテストシナリオで同じ対象ファイルや操作内容を記述する場合、
  各行の先頭にシナリオ番号または具体的な操作内容を含めて一意性を確保すること
- 具体例として「シナリオ1の確認対象: definitions.tsのコード品質」のような形式を示すこと
- 50文字を超える行は3回以上同一内容が出現すると重複行エラーとなることを明示すること

#### 受け入れ条件

- `manual_test` の `subagentTemplate` に複数シナリオで同一対象を記述する際の
  一意化指示が含まれること
- 具体的な回避例（シナリオ番号や操作内容を含める例）が記載されていること
- MCPサーバー再起動後にmanual_testフェーズのプロンプトに当該ガイダンスが反映されること

---

### 要件4: commitフェーズのsubagentTemplateにサブモジュール対応手順を追加

#### 背景と目的

`definitions.ts` の939〜946行目にある `commit` フェーズの `subagentTemplate` は
「変更をコミットしてください」という最低限の指示のみを含んでいる。

Gitのサブモジュール内変更は `git status` において `modified: workflow-plugin (modified content)` の
形式で表示されるため、個別ファイルの変更として認識されにくい。
subagentへのプロンプトにサブモジュール構造への言及がないため、
サブモジュール内変更のステージングが見落とされた実績がある。

#### 修正内容

`definitions.ts` の939行目付近の `commit` フェーズ `subagentTemplate` を拡充し、
以下の内容を含める。

- `git status --short` で全変更ファイルを確認する手順を明示すること
- `modified: {サブモジュール名} (modified content)` という表示の意味を説明し、
  サブモジュール内ディレクトリに移動して変更ファイルを個別に `git add` する必要があることを記載すること
- `workflow_set_scope` で設定されたスコープ内のディレクトリの変更をすべてステージングすることの確認を促すこと

#### 受け入れ条件

- `commit` フェーズの `subagentTemplate` に `git status --short` の実行指示が含まれること
- サブモジュール内変更の確認手順（サブモジュールディレクトリへの移動と個別ステージング）が記載されること
- MCPサーバー再起動後にcommitフェーズのプロンプトに当該ガイダンスが反映されること

---

### 要件5: testing/regression_testのsubagentTemplateにworkflow_record_test_resultのバリデーション制約を追記

#### 背景と目的

`record-test-result.ts` には2つのブロッキングバリデーション制約が実装されている。

制約（a）: 失敗を示す語句を含む出力のブロック。exitCode=0であっても集計行に
失敗を示す語句が含まれると整合性エラーとしてブロックされる。行コンテキスト分類や
否定語判定などの複雑なフィルタリングロジックを持つため、subagentが直感的に
予測できない動作を示す可能性がある。

制約（b）: 同一出力の重複チェック。同じハッシュが既に記録されている場合はブロックされる。
ただし `regression_test` フェーズでは再記録が許可されている例外がある。

これらの制約が `testing` フェーズ（862行目）および `regression_test` フェーズ（871行目）の
`subagentTemplate` に記載されていないため、subagentが制約に気づかず試行錯誤が発生した。

#### 修正内容

`definitions.ts` の862行目（`testing` フェーズ）と871行目（`regression_test` フェーズ）の
各 `subagentTemplate` に以下を追記する。

共通の追記内容:
- `workflow_record_test_result` を呼び出す際、exitCode=0であっても
  テスト集計行（例: 「2 failures」「3 errors」のような語句）が出力に含まれる場合は
  ツールがブロックエラーを返すことを明示すること
- この場合の対処として、出力テキストをサマリー形式に整形してから渡す方法を示すこと

`regression_test` フェーズ固有の追記内容:
- 同一の出力を再度送信した場合は重複エラーとなるが、
  `regression_test` フェーズでは再記録が許可されていること（制約（b）の例外）を明示すること

#### 受け入れ条件

- `testing` フェーズの `subagentTemplate` に制約（a）の説明と対処方法が含まれること
- `regression_test` フェーズの `subagentTemplate` に制約（a）の説明と
  制約（b）の `regression_test` フェーズにおける例外規定が含まれること
- MCPサーバー再起動後に各フェーズのプロンプトに当該ガイダンスが反映されること

---

## 非機能要件

### 修正範囲の限定

全5件の修正はいずれも `definitions.ts` 単一ファイルへの変更に限定される。
`artifact-validator.ts`、`state-manager.ts`、その他のコアモジュールへの変更は含まない。
修正の影響範囲はsubagentプロンプト生成ロジックと `code_review` の必須セクション定義に限定され、
バリデーターのロジック変更は一切行わない。

### MCPサーバー再起動の義務

`definitions.ts` を変更した後、Node.jsのモジュールキャッシュにより変更が即座に反映されない。
implementationフェーズ完了後、以下の手順でMCPサーバーを再起動してから次フェーズに進むこと。

- 手順1: `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行してトランスパイルする
- 手順2: Claude Desktopのサーバー再起動機能でMCPサーバープロセスを再起動する
- 手順3: `workflow_status` で現在のフェーズを確認してから作業を再開する

### ビルド成功要件

`definitions.ts` の変更後、TypeScriptのコンパイルエラーが発生しないこと。
修正内容は文字列リテラルの変更と配列要素の追加のみであり、
型定義や関数シグネチャの変更は行わないこと。

### 将来の保守性

問題1の根本原因である `artifact-validator.ts` と `definitions.ts` の二重管理構造については、
今回の修正では対症療法的な対応（両者の整合）に留める。将来的には単一の定義を
参照する統合構造への移行を検討することが望ましい。

### 修正対象ファイルまとめ

| 問題番号 | 修正種別 | 修正対象ファイル | 対象行 |
|----------|----------|----------------|--------|
| 問題1 | 配列に要素追加 | definitions.ts | 821行目 |
| 問題2 | ループを間接参照に変更 | definitions.ts | 1093〜1098行目 |
| 問題3 | subagentTemplateに指示追記 | definitions.ts | 890行目付近 |
| 問題4 | subagentTemplateに指示追記 | definitions.ts | 939行目付近 |
| 問題5 | subagentTemplateに説明追記 | definitions.ts | 862行目と871行目 |
