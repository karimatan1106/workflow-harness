## サマリー

このドキュメントは、前タスク（FR-1〜FR-7修正）の実行中に発生した5つの問題について、
関連するソースコードを調査して根本原因を特定し、修正方針をまとめたものである。

- 目的: 5つの問題の根本原因を特定し、再発防止のための修正対象を明確にする
- 主要な決定事項: 全問題とも `definitions.ts` のコード修正で対応可能と判断した
- 次フェーズで必要な情報: 各問題の対応ファイル・行番号・修正内容の詳細

---

## 調査結果

### 問題1: code_reviewのphaseGuideに必須セクション「パフォーマンス」が欠落

#### 調査対象ファイル

- `workflow-plugin/mcp-server/src/phases/definitions.ts`（818〜847行目）
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`（246〜249行目）

#### 事実確認

`artifact-validator.ts` の246〜249行目には以下の定義がある。

```
'code-review.md': {
  minLines: 30,
  requiredSections: ['設計-実装整合性', 'コード品質', 'セキュリティ', 'パフォーマンス'],
},
```

一方 `definitions.ts` の821行目、`code_review` サブフェーズの phaseGuide では以下のように定義されている。

```
requiredSections: ['## サマリー', '## 設計-実装整合性', '## コード品質', '## セキュリティ'],
```

`'## パフォーマンス'` が phaseGuide の `requiredSections` から欠落している。

#### 根本原因

`buildPrompt()` 関数（1063〜1071行目）は phaseGuide の `requiredSections` をもとに
「必須セクション」をsubagentプロンプトに展開する。subagentはプロンプト内の必須セクション
一覧をもとに成果物を構成するため、`'## パフォーマンス'` が一覧になければ当該セクションを
作成しない。結果として artifact-validator の要求と subagent の出力が食い違い、バリデーション失敗となる。

`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` と `definitions.ts` の
phaseGuide は独立したデータ構造であり、一方を変更しても他方が自動更新されない設計となっている。
この二重管理の構造が本問題の根本原因である。

#### 修正方針

`definitions.ts` の821行目の `requiredSections` 配列に `'## パフォーマンス'` を追加することで
artifact-validator の定義と整合させる。コード修正後はMCPサーバーの再起動が必要。
修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（821行目）

---

### 問題2: code_reviewのsubagentが禁止語をプレーンテキストで列挙

#### 調査対象ファイル

- `workflow-plugin/mcp-server/src/phases/definitions.ts`（1093〜1098行目）

#### 事実確認

`buildPrompt()` 関数の1093〜1098行目において、禁止パターンを以下のように展開している。

```
qualitySection += `\n### 禁止パターン（完全リスト）\n`;
qualitySection += `成果物内に以下のパターンが1つでも含まれるとエラーになります...`;
for (const pattern of rules.forbiddenPatterns) {
  qualitySection += `- ${pattern}\n`;
}
```

`rules.forbiddenPatterns` は `definitions.ts` の33行目のフォールバック値で、
以下の12語を含む配列として定義されている。

```
['TODO', 'TBD', 'WIP', 'FIXME', '未定', '未確定', '要検討', '検討中', '対応予定', 'サンプル', 'ダミー', '仮置き']
```

このリストがプロンプト内に直接展開されるため、subagentはこれらの禁止語を「説明すべき対象」
として認識し、成果物内にそのまま引用・言及してしまうリスクがある。

#### 根本原因

「禁止語の存在をsubagentに伝えるために禁止語を列挙する」というセルフレファレンシャルな問題が
存在する。プロンプト内に禁止語が直接列挙されることで、subagentが成果物を書く際にそれらの語句を
「参照」として転記するパスが生じる。特に code_review では複数の観点（設計・コード品質・
セキュリティ・パフォーマンス）を記述するため長文になりやすく、禁止語を含む入力ファイルから
の転記リスクが高まる。

#### 修正方針

`buildPrompt()` の禁止語列挙部分を修正し、禁止語そのものをリスト形式で埋め込むのではなく、
「英語系略語グループ（4語）」「検討系グループ（4語）」「予定・仮値系グループ（4語）」という
グループ名称と数のみをプロンプトに含める形式に変更する。個別の語句の直接列挙をやめることで、
subagentが禁止語を成果物に転記するリスクを低減できる。
修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（1093〜1098行目）

---

### 問題3: manual_testで同一ファイルパス行が3回重複

#### 調査対象ファイル

- `workflow-plugin/mcp-server/src/phases/definitions.ts`（880〜891行目）
- `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`（92〜111行目）

#### 事実確認

`definitions.ts` の890行目にある `manual_test` フェーズの `subagentTemplate` は以下の通りである。

```
subagentTemplate: '# manual_testフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\n手動テストを実施してください。\n\n## 出力\n${docsDir}/manual-test.md'
```

このテンプレートには「手動テストを実施してください」という最低限の指示しかなく、
複数シナリオで共通要素をどのように記述するかのガイダンスが含まれていない。

`artifact-validator.ts` の108〜109行目にある「FIX-1プレーンラベルパターン」は
「50文字以内のコロン終端行」を構造要素として重複検出から除外するが、
ファイルパスを含む行（例えば50文字を超える長さの `対象ファイル:` 行）はこの除外対象外となる。

#### 根本原因

テストシナリオが3つ以上あり、各シナリオで同じファイルを検証対象とした場合、
`- 対象ファイル: \`...definitions.ts\`` のような行が3回以上出現する。この行は
50文字を超えるため `isStructuralLine()` の除外対象外となり、重複行検出エラーとなる。

`buildPrompt()` が生成する汎用の重複行禁止ガイダンス（1126〜1141行目）は存在するが、
「複数シナリオで同一ファイルパスを検証対象として繰り返し記載するとエラーになる」という
manual_test固有の具体的なシナリオに対する注意喚起が `subagentTemplate` に含まれていない。

#### 修正方針

`definitions.ts` の `manual_test` フェーズの `subagentTemplate` または `checklist` を拡充し、
複数シナリオで共通のファイルパスや対象を記述する場合はシナリオ番号や具体的な操作内容を
含めて各行を一意にすること、という指示を追加する。
修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（890行目付近）

---

### 問題4: commitサブエージェントがsubmodule内変更を見落とし

#### 調査対象ファイル

- `workflow-plugin/mcp-server/src/phases/definitions.ts`（939〜946行目）

#### 事実確認

`definitions.ts` の939〜946行目にある `commit` フェーズの `subagentTemplate` は以下の通りである。

```
subagentTemplate: '# commitフェーズ\n\n## タスク情報\n- ユーザーの意図: ${userIntent}\n- 出力先: ${docsDir}/\n\n## 作業内容\n変更をコミットしてください。'
```

このテンプレートには「変更をコミットしてください」という最低限の指示のみで、
サブモジュール構造や変更ファイルの系統的な確認手順に関する説明が一切含まれていない。

`CLAUDE.md` のルール19「commitフェーズでは全変更ファイルを系統的に確認すること」には
サブモジュールへの言及があるが、これはOrchestratorへの指示である。
subagentのプロンプトにはこの内容が展開されていない。

#### 根本原因

commitフェーズのsubagentは `git status --short` で変更一覧を確認するが、
サブモジュール内の変更は `modified: workflow-plugin (modified content)` という
形式で表示されるため、個別ファイルの変更として認識されにくい。

subagentへのプロンプト（`subagentTemplate`）にサブモジュール構造への言及がなく、
サブモジュール内のファイル変更を個別にステージングする手順の指示がないため、
サブモジュール内の変更が見落とされる。

#### 修正方針

`definitions.ts` の `commit` フェーズの `subagentTemplate` を拡充し、以下の内容を含める。
- `git status --short` で全変更ファイルを確認する手順
- サブモジュール（`workflow-plugin/` など）内の変更は個別の `git add` が必要であること
- スコープ設定で指定されたディレクトリの変更をすべて含めることの確認
修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（939行目付近）

---

### 問題5: workflow_record_test_resultのバリデーション制約の文書化不足

#### 調査対象ファイル

- `workflow-plugin/mcp-server/src/tools/record-test-result.ts`

#### 事実確認

`record-test-result.ts` には以下の3つのバリデーションロジックが存在する。

**制約（a）: 失敗キーワードを含む出力のブロック（34〜214行目）**

`BLOCKING_FAILURE_KEYWORDS` として `FAIL`, `FAILED`, `ERROR`, `ERRORS`, `failing`,
`failures` などが定義されている（35〜45行目）。exitCode=0 でもこれらのキーワードが
特定のコンテキスト（集計行など）で検出されると整合性エラーとしてブロックされる。
ただし行分類ロジック（144〜171行目）により、インデントされたテスト名行やスタックトレース行は
除外され、否定語（`isKeywordNegated()`）で「0 failures」「no errors」などは除外される。

**制約（b）: 同一出力の重複チェック（420〜429行目）**

`recordTestOutputHash()` を使って出力のハッシュを記録し、同じハッシュが既に存在する場合は
「出力重複検証エラー」としてブロックする。ただし `regression_test` フェーズでは同一ハッシュの
再記録を許可する条件分岐がある（422行目）。

**制約（c）: テスト件数抽出パターン（276〜320行目）**

件数抽出が失敗した場合でも `reliable=false` フラグで記録され、ブロックにはならない。
つまり制約（c）は実際にはブロックではなく警告扱いである（464〜466行目）。

#### 根本原因

これらのバリデーションルールはソースコードに実装されているが、`definitions.ts` の
`regression_test` フェーズの `subagentTemplate`（871行目）にも `testing` フェーズの
`subagentTemplate`（862行目）にも一切記載されていない。

subagentが `workflow_record_test_result` を呼び出す際にこれらの制約を知らないため、
制約（a）と（b）のエラーで試行錯誤が発生する。特に制約（a）は複雑な行分類ロジック
を持つため、subagentが直感的に予測できない動作を示す可能性がある。

#### 修正方針

`definitions.ts` の `regression_test` フェーズおよび `testing` フェーズの
`subagentTemplate` に、`workflow_record_test_result` の主要な制約を明記する。
特に制約（a）（exitCode=0でも集計行に失敗キーワードがあるとブロックされる）と
制約（b）（同じ出力を再度送信するとブロックされる、ただし regression_test は除外）を
注意書きとして含める。
修正対象ファイル: `workflow-plugin/mcp-server/src/phases/definitions.ts`（862行目・871行目）

---

## 既存実装の分析

### phaseGuideとartifact-validatorの二重管理（問題1の詳細）

`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` と、
`definitions.ts` の phaseGuide における `requiredSections` は独立して管理されている。
この二重管理の構造が問題1の根本原因であり、設計上の改善点として認識すべき事項である。
即時の修正として `definitions.ts` の `requiredSections` を `artifact-validator.ts` の
定義と一致させる対症療法的修正を実施する。将来的には単一の定義を参照する構造が望ましい。

### buildPromptの禁止語列挙とセルフレファレンシャルな問題（問題2の詳細）

`buildPrompt()` 関数が禁止語を直接プロンプトに埋め込む実装は、subagentがその語句を
成果物内で言及するリスクを生む。グループ名称と数のみを伝え、個別の語句は記載しない方式に
変更することでこのリスクを低減できる。

### subagentTemplateの簡素さとフェーズ固有ガイダンスの欠如（問題3・4の詳細）

`manual_test`、`commit`、`regression_test`、`testing` 等の `subagentTemplate` が非常に短く、
フェーズ固有の重要な注意事項が含まれていない。`buildPrompt()` が生成する汎用セクション
（禁止語、密度要件等）はすべてのフェーズに追加されるが、フェーズ固有の制約（ファイルパスの
一意化、サブモジュール対応、APIのバリデーション制約）は `subagentTemplate` や
`checklist` フィールドで補う必要がある。

### workflow_record_test_resultの文書化ギャップ（問題5の詳細）

実装されたバリデーションロジックとプロンプト内の説明に大きな乖離がある。制約（a）は
複雑なフィルタリングロジック（行コンテキスト分類A〜D、否定語判定、ハイフン結合語除外）を
持ち、subagentが直感的に予測できない動作を示す可能性がある。`subagentTemplate` に
これらの制約を明記することが再発防止に有効である。

---

## 修正方針まとめ

| 問題 | 修正種別 | 修正対象ファイル | 対象行 |
|------|----------|----------------|--------|
| 問題1: code_review requiredSections欠落 | コード修正 | definitions.ts | 821行目 |
| 問題2: 禁止語の直接列挙 | コード修正 | definitions.ts | 1093〜1098行目 |
| 問題3: manual_test重複行 | コード修正 | definitions.ts | 890行目付近 |
| 問題4: commitサブモジュール見落とし | コード修正 | definitions.ts | 939行目付近 |
| 問題5: record_test_result制約の文書化不足 | コード修正 | definitions.ts | 862・871行目 |

全問題が `workflow-plugin/mcp-server/src/phases/definitions.ts` の修正で対応可能である。
コード修正後はMCPサーバーの再起動が必須となる。
`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` との整合性維持が最優先事項となる。
