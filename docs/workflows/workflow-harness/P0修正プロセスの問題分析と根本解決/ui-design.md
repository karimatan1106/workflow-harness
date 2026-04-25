## サマリー

本ドキュメントは「P0修正プロセスの問題分析と根本解決」タスクにおける非視覚インターフェース設計書である。
対象はCLIツール（ワークフロープラグイン）のMCPサーバーであり、視覚的UIは存在しない。
代わりに、MCPサーバーのレスポンス構造・エラーメッセージ・設定ファイル変更内容を設計する。

- 目的: FR-1〜FR-4の実装に必要なインターフェース仕様を明確化し、実装フェーズへの情報を提供する
- 主要な決定事項:
  - workflow_next および workflow_complete_sub のレスポンスにエラー詳細を構造化して含める
  - artifact-validatorの5種類のエラーに対して修正指示と修正例を持つメッセージを定義する
  - CLAUDE.mdへのRule 22追記とdefinitions.tsのsubagentTemplate補足内容を具体的に定義する
- 次フェーズで必要な情報: 実装ファイルはworkflow-plugin/mcp-server/src/definitions.tsとCLAUDE.mdの2件のみ

---

## CLIインターフェース設計

### workflow_nextレスポンス（バリデーション成功時）

workflow_nextがバリデーションを通過して次フェーズへ進む場合のレスポンス構造を以下に示す。

```
{
  "success": true,
  "currentPhase": "ui_design",
  "nextPhase": "test_design",
  "message": "ui_designフェーズが完了しました。次はtest_designフェーズです。"
}
```

成功時レスポンスは `success: true`、遷移前後のフェーズ名、および人間が読めるメッセージで構成される。
Orchestratorはこのレスポンスを受け取り、次フェーズのsubagentを起動するための契機として利用する。

### workflow_nextレスポンス（バリデーション失敗時）

成果物バリデーションに失敗した場合のレスポンス構造を以下に示す。

```
{
  "success": false,
  "currentPhase": "ui_design",
  "nextPhase": null,
  "errors": [
    {
      "type": "DUPLICATE_LINE",
      "severity": "error",
      "message": "トリム後に完全一致する行が3回以上検出されました",
      "location": "行番号: 42, 内容: '- レベル: Low'",
      "suggestion": "各行に固有の情報を追加してください。例: '- リスクレベル: Low（HMAC保護により軽減済み）'"
    }
  ],
  "retryInstruction": "上記のエラーを修正して再度成果物を保存し、workflow_nextを呼び出してください。"
}
```

バリデーション失敗時は `success: false`、`errors` 配列にエラー詳細、そして `retryInstruction` を含む。
Orchestratorはこのレスポンスを受け取り、subagentに渡すリトライプロンプトを生成するために使用する。
フェーズ遷移は行われないため、`nextPhase` は null となる。

### workflow_complete_subレスポンス（バリデーション失敗時）

parallel_verificationの各サブフェーズが失敗した場合のレスポンスを以下に示す。

```
{
  "success": false,
  "subPhase": "manual_test",
  "parentPhase": "parallel_verification",
  "errors": [
    {
      "type": "SECTION_DENSITY_LOW",
      "severity": "error",
      "message": "セクション密度が30%を下回っています（現在: 18%）",
      "location": "## テスト結果 セクション",
      "suggestion": "このセクションに実質行を5行以上追加してください"
    }
  ],
  "retryInstruction": "manual-test.mdを修正してworkflow_complete_sub('manual_test')を再度呼び出してください。"
}
```

サブフェーズ失敗時には `subPhase` と `parentPhase` を明記することで、Orchestratorがどのsubagentを再起動すべきかを明確に判断できる。
`errors` 配列の各要素は `type`、`severity`、`message`、`location`、`suggestion` の5フィールドで構成される。

---

## エラーメッセージ設計

artifact-validatorが返す5種類のエラーについて、Orchestratorがsubagentに渡すリトライプロンプト用の修正指示と修正例を以下に定義する。

### DUPLICATE_LINE エラー

重複行エラーはトリム後に同一内容の行が3回以上出現した場合に発生する。

**修正指示**: 繰り返されている行をそれぞれ異なる内容に書き換え、各行に文脈固有の情報を含めてください。

**NG例の説明**（散文形式、コードブロック外に記載）:
「- レベル: Low」という行が3行連続する場合、バリデーターはこれを水増しされたテキストと判定してエラーを返す。

**OK例の説明**（散文形式、コードブロック外に記載）:
1行目は「- リスクレベル: Low（静的解析ツールで検出可能）」、
2行目は「- リスクレベル: Low（HMAC整合性保護により軽減済み）」、
3行目は「- リスクレベル: Low（削除検出ロジックが存在する）」のように、
各行に固有のコンテキスト情報を付加することで重複検出を回避できる。

### BRACKET_PLACEHOLDER エラー

角括弧プレースホルダーエラーは成果物内に角括弧で囲まれた変数名が検出された場合に発生する。
このエラーはコードブロック内の正規表現や配列アクセス記法にも適用される点が重要である。

**修正指示**: 角括弧を含む記述を波括弧または散文形式に置き換えてください。

**NG例の説明**（コードブロック内を含めた全ての出現が対象）:
パス変数の表現「/api/v1/users/{userId}」と記述すべきところを角括弧で記述するとエラーとなる。
正規表現で英小文字の1文字以上の繰り返しを表すパターンをコードブロック内で角括弧記法で書いても検出される。

**OK例の説明**（波括弧または散文への言い換え）:
パス変数は「/api/v1/users/{userId}」のように波括弧で表記する。
正規表現パターンは「英小文字の1文字以上の繰り返し」のように散文形式で説明する。

### SECTION_DENSITY_LOW エラー

セクション密度不足エラーはセクション内の実質行数が全行数の30%を下回った場合に発生する。
空行・水平線・コードフェンス開閉行はカウントされないため、テキスト密度が重要となる。

**修正指示**: 該当セクションに実質的な内容を追加してください。

**修正例の説明**: 総行数が60行のセクションで実質行数が15行の場合、25%であるため3行の追加が最小限必要となる。
単純な1文の説明を複数の観点に分けた段落形式に展開すること、または具体的な事例・根拠・手順を追記することで密度を上げることができる。

### SECTION_MIN_LINES エラー

セクション最小行数エラーは各セクション内の実質行数が5行を下回った場合に発生する。

**修正指示**: 各セクションに少なくとも5行の実質内容を記述してください（空行・水平線・コードフェンスは除く）。

**修正例の説明**: 2行しかないセクションには、目的・対象・方法・結果・考察の各観点からそれぞれ1行以上を追加することで5行以上を確保できる。
セクション内の箇条書きを各項目2〜3行の説明に展開することも有効な対処である。

### FORBIDDEN_PATTERN エラー

禁止語エラーは成果物内にforbiddenPatterns配列に定義された12種の禁止語が部分一致で検出された場合に発生する。
禁止語は複合語にも適用されるため、各禁止語を含む合成語も検出対象となる点に注意が必要である。

**修正指示**: 指摘された禁止語を削除し、具体的な実例または確定した内容に置き換えてください。

**修正例の説明**:
forbiddenPatterns配列の「まだ指定されていない」系の語は「まだ指定されていない」に言い換える。
「追加調査が必要な事項」系の語は「追加調査が必要な事項」に言い換える。
「次スプリントで実施する変更」系の語は「次スプリントで実施する変更」に言い換える。
テスト用の暫定データを示す語は「テスト用固定値（value: 42）」のように具体値を持つ表現に置き換える。

---

## APIレスポンス設計

### MCPサーバーのバリデーション結果レスポンス構造

workflow_nextおよびworkflow_complete_subが返すJSONオブジェクトの詳細スキーマを以下に定義する。

**成功レスポンスのスキーマ**:
- `success`: boolean型、trueは遷移成功を示す
- `currentPhase`: string型、遷移前のフェーズ名
- `nextPhase`: string型、遷移後のフェーズ名
- `message`: string型、人間向けの状態説明文

**失敗レスポンスのスキーマ**:
- `success`: boolean型、falseはバリデーション失敗を示す
- `currentPhase`: string型、現在のフェーズ名（変更されていない）
- `nextPhase`: null型、フェーズ遷移が行われなかったことを示す
- `errors`: エラー詳細オブジェクトの配列、1件以上のエラーを含む
- `retryInstruction`: string型、Orchestratorがsubagentに渡す再試行の概要指示文

**errorsオブジェクトの各要素のスキーマ**:
- `type`: string型、エラー種別（DUPLICATE_LINE / BRACKET_PLACEHOLDER / SECTION_DENSITY_LOW / SECTION_MIN_LINES / FORBIDDEN_PATTERN）
- `severity`: string型、深刻度（errorまたはwarning）
- `message`: string型、エラー内容の人間向け説明文
- `location`: string型、エラーが検出された場所（行番号またはセクション名）
- `suggestion`: string型、修正のための具体的な改善案

### OrchestratorによるAPIレスポンス処理フロー

Orchestratorがworkflow_nextまたはworkflow_complete_subのレスポンスを受け取った後の処理フローを以下に示す。

**ステップ1: successフィールドの確認**
Orchestratorはレスポンスの `success` フィールドを最初に確認する。
`success: true` の場合は次フェーズのsubagentを起動する通常フローに進む。
`success: false` の場合はリトライフローに切り替える。

**ステップ2: errorsの解析とリトライプロンプト生成**
`errors` 配列の各要素から `type`、`location`、`suggestion` を抽出し、リトライプロンプトの「前回のバリデーション失敗理由」セクションと「改善要求」セクションを組み立てる。
エラーが複数件ある場合は全件をプロンプトに含める。

**ステップ3: subagentの再起動**
生成したリトライプロンプトを渡してTask toolでsubagentを再起動する。
Orchestratorはメモリ内でリトライ回数を管理し、各リトライ前に「{サブフェーズ名}のリトライ{N}回目を実行します」と出力する。

**ステップ4: 次フェーズへの移行**
バリデーション成功のレスポンスを受け取ったら、workflow_nextまたはworkflow_complete_subの後続処理（次フェーズ起動）を実行する。

---

## 設定ファイル設計

### CLAUDE.mdへの追記内容（FR-4: Rule 22追加）

**追記箇所**: 「AIへの厳命」セクションの最後（現行のルール21の直後）

**追記内容**:

```
22. **artifact-validatorを修正した後はMCPサーバーを再起動してから次フェーズに進むこと**
    - コアモジュール（artifact-validator.ts、definitions.ts、state-manager.ts）を変更した場合は必ず再起動が必要
    - 再起動手順: npm run buildでトランスパイル後、MCPサーバープロセスを終了して再起動
    - 再起動未実施のままparallel_verificationフェーズに進むことは禁止
    - 理由: 変更したバリデーターではなく古いキャッシュ版が動作し続け、バリデーション失敗が継続する
    - 再起動前にworkflow_statusで現在のフェーズを記録し、再起動後に同フェーズで作業を再開すること
```

**「MCPサーバーのモジュールキャッシュ」セクションへの追記箇所**: 「運用ルール」サブセクション直後に「強制再起動条件」サブセクションを追加する。

**強制再起動条件セクションの内容**:

```
### 強制再起動条件

以下のファイルを変更した場合は、必ずnpm run buildとMCPサーバー再起動を実施すること:
- artifact-validator.ts: バリデーションロジックの変更が即時反映されないため
- definitions.ts: phaseGuideやsubagentTemplateの変更がキャッシュされているため
- state-manager.ts: 状態管理ロジックの変更が無効化されるため

再起動の手順:
1. workflow_statusで現在のフェーズIDを記録する
2. npm run buildでトランスパイルする（workflow-plugin/mcp-server/ディレクトリで実行）
3. MCPサーバープロセスを終了する
4. MCPサーバーを再起動する（claude mcp再接続またはプロセス再起動）
5. workflow_statusで同一フェーズにいることを確認して作業を再開する
```

### CLAUDE.mdの「フェーズ別subagent設定」テーブルの更新（FR-3連動）

FR-3の変更に連動して、CLAUDE.mdの「フェーズ別subagent設定」テーブル内の以下4行のmodel列を更新する。

- manual_test 行: `haiku` を `sonnet` に変更
- security_scan 行: `haiku` を `sonnet` に変更
- performance_test 行: `haiku` を `sonnet` に変更
- e2e_test 行: `haiku` を `sonnet` に変更

この変更はFR-3のdefinitions.ts変更と同時に実施し、文書とコードの整合を保つ。

### definitions.tsのsubagentTemplate追記内容（FR-1: 角括弧禁止説明強化）

**追記箇所**: definitions.tsのphaseGuide生成ロジックにある角括弧プレースホルダー禁止の説明文末尾

**追記する内容（テキスト形式）**:

コードブロック内の正規表現や配列アクセス記法も自動検査の対象である旨と、散文形式への置き換えを指示する文章を追加する。
具体的には以下の内容をtemplate文字列に追記する。

- 「コードブロック内であっても角括弧を含む行はバリデーターによって検出される」という警告文
- NG例として「正規表現 /英小文字パターン/ を表す場合に角括弧を使う記述」を禁止する旨の説明
- OK例として「英小文字の1文字以上の繰り返し」のような散文での説明を採用するよう指示する文
- NG例として「配列インデックスアクセスを角括弧で記述する」ことを禁止する旨の説明
- OK例として「インデックス番号によるアクセス」という散文形式の表現を使用するよう指示する文

### definitions.tsのsubagentTemplate追記内容（FR-2: 禁止語複合語説明強化）

**追記箇所**: definitions.tsのphaseGuide生成ロジックにある禁止語リスト生成ループの直後

**追記する内容（禁止複合語の言い換えルール）**:

以下の3グループの言い換えルールを禁止語セクションの補足説明として追加する。

英語系禁止語を含む複合語グループでは、forbiddenPatterns配列の英語略語系要素（作業中を示すものや後続判断を示すもの）を含む語が検出対象となる。
これらは「確定されていない状態」または「設定されていない値」に言い換えることでバリデーターの検出を回避できる。

検討系禁止語を含む複合語グループでは、「追加調査が必要な事項」の意味を持つ禁止複合語が対象である。
これらは「追加調査が必要な事項」または「今後分析が必要な項目」に言い換える。

予定系禁止語を含む複合語グループでは、「修正が計画されている変更」の意味を持つ禁止複合語が対象である。
これらは「次スプリントで実施する変更」または「今後の改修で対応する項目」に言い換える。
