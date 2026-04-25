## サマリー

- 目的: 並列サブフェーズの `subagentTemplate` 取得不能・`requiredSections` 形式不整合・`minLines` 二重管理の3問題を解決するためのアーキテクチャ改善調査
- 主要な決定事項:
  - 問題1（最重要）: `slimSubPhaseGuide()` が `workflow_next` のサブフェーズから `subagentTemplate` を削除しているため、Orchestrator は並列フェーズで `workflow_next` を呼んでも個々のサブフェーズの `subagentTemplate` を受け取れない。しかし `resolvePhaseGuide()` 内で各サブフェーズにも `buildPrompt()` でテンプレートが生成されており、別途 API を追加すれば取得できる
  - 問題2（重要）: `definitions.ts` の `requiredSections` は `## セクション名` 形式（`##` プレフィックス付き）。`artifact-validator.ts` の `validateRequiredSections()` は `content.includes(section)` でマッチするため、成果物に `## セクション名` の行が存在すれば合格となり、実質的に不整合は発生していない
  - 問題3（推奨）: `PHASE_GUIDES` の各サブフェーズに `minLines` が定義されており、`artifact-validator.ts` にも `PHASE_ARTIFACT_REQUIREMENTS` という独立した `minLines` が存在する。二重管理の実態は確認されたが、参照系が分離されているため実害はない
- 次フェーズで必要な情報:
  - `slimSubPhaseGuide()` の削除フィールドリスト（`subagentTemplate`, `content`, `claudeMdSections`）
  - `resolvePhaseGuide()` がサブフェーズの `subagentTemplate` を生成する実装箇所（行1548-1561）
  - `PHASE_ARTIFACT_REQUIREMENTS` と `PHASE_GUIDES[phase].requiredSections` の双方の値の一覧
  - `PHASE_ARTIFACT_REQUIREMENTS[fileName].minLines` と `PHASE_GUIDES[phase].minLines` の値の比較

---

## 調査結果

### 問題1: 並列サブフェーズの subagentTemplate が取得できない

#### slimSubPhaseGuide() の実装

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\next.ts` の行50-55 に以下の実装がある。

```typescript
function slimSubPhaseGuide(subPhaseGuide: Record<string, unknown>): void {
  const fieldsToRemove = ['subagentTemplate', 'content', 'claudeMdSections'] as const;
  for (const field of fieldsToRemove) {
    delete subPhaseGuide[field];
  }
}
```

この関数は行619-624 で `workflow_next` のレスポンス構築時に呼ばれる。

```typescript
if (phaseGuide?.subPhases) {
  for (const sp of Object.values(phaseGuide.subPhases)) {
    // workflow_nextのサブフェーズからはサイズの大きなフィールドを除外する
    // サブフェーズ個別のsubagentTemplateが必要な場合はworkflow_statusで取得すること
    slimSubPhaseGuide(sp as unknown as Record<string, unknown>);
  }
}
```

コメントには「サブフェーズ個別のsubagentTemplateが必要な場合はworkflow_statusで取得すること」と記載されているが、`status.ts` も同様の削除処理を実施しているため実際には `workflow_status` でも取得できない。

#### status.ts での同様の削除処理

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\status.ts` の行127-140 に以下がある。

```typescript
const slimGuide = { ...phaseGuide } as Record<string, unknown>;
delete slimGuide['subagentTemplate'];
delete slimGuide['content'];
delete slimGuide['claudeMdSections'];
if (slimGuide['subPhases'] && typeof slimGuide['subPhases'] === 'object') {
  for (const subPhase of Object.values(slimGuide['subPhases'] as Record<string, unknown>)) {
    if (subPhase && typeof subPhase === 'object') {
      const sub = subPhase as Record<string, unknown>;
      delete sub['subagentTemplate'];
      delete sub['content'];
      delete sub['claudeMdSections'];
    }
  }
}
```

`workflow_status` でも `subPhases` 内の各サブフェーズから `subagentTemplate` が削除されている。結果として、Orchestrator が並列フェーズに遷移した後、個々のサブフェーズの `subagentTemplate` を取得する手段が現在存在しない。

#### resolvePhaseGuide() でのサブフェーズ subagentTemplate 生成

`definitions.ts` の行1547-1562 では、`docsDir` が設定されていれば各サブフェーズにも `buildPrompt()` でテンプレートが動的生成されている。

```typescript
// サブフェーズのsubagentTemplateもbuildPromptで動的生成
if (resolved.subPhases) {
  for (const [subPhaseName, subPhase] of Object.entries(resolved.subPhases)) {
    try {
      subPhase.subagentTemplate = buildPrompt(subPhase, subPhaseName, userIntent || '', docsDir);
    } catch (e) {
      // ...フォールバック処理...
    }
  }
}
```

つまりサーバー内部では各サブフェーズの `subagentTemplate` が生成されているが、レスポンスに含まれる前に `slimSubPhaseGuide()` で削除されてしまう構造になっている。

#### 解決策の選択肢

選択肢Aとして、新規 API `workflow_get_subphase_template` を追加してサブフェーズ名を引数として `subagentTemplate` を個別取得できるようにする方法がある。この方式では既存 API の後方互換性を保ちつつ問題を解決できる。

選択肢Bとして、`workflow_next` レスポンスに `subagentTemplate` のみを含む軽量版サブフェーズ情報を含める方法がある。レスポンスサイズへの影響を最小化するために `content` と `claudeMdSections` は引き続き除外する。

選択肢Cとして、並列フェーズ遷移時にのみ `subagentTemplate` を含める特別な処理を `next.ts` に追加する方法がある。コードの条件分岐が複雑になるデメリットがある。

---

## 既存実装の分析

### 問題2: requiredSections の形式不整合

#### definitions.ts での requiredSections 定義

`PHASE_GUIDES` の各フェーズに定義された `requiredSections` の値を調査した結果、以下の形式が使われていることを確認した。

並列フェーズ外の定義（`## ` プレフィックス付き）:

```
research:        ['## サマリー', '## 調査結果', '## 既存実装の分析']
requirements:    ['## サマリー', '## 機能要件', '## 非機能要件']
test_design:     ['## サマリー', '## テスト方針', '## テストケース']
```

サブフェーズの定義（`## ` プレフィックス付き）:

```
threat_modeling: ['## サマリー', '## 脅威シナリオ', '## リスク評価', '## セキュリティ要件']
planning:        ['## サマリー', '## 概要', '## 実装計画', '## 変更対象ファイル']
state_machine:   (requiredSectionsの定義なし、またはstateDiagram等)
code_review:     ['## サマリー', '## 設計-実装整合性', '## コード品質', '## セキュリティ', '## パフォーマンス']
manual_test:     ['## テストシナリオ', '## テスト結果']
security_scan:   ['## 脆弱性スキャン結果', '## 検出された問題']
performance_test:['## パフォーマンス計測結果', '## ボトルネック分析']
e2e_test:        ['## E2Eテストシナリオ', '## テスト実行結果']
```

全て `## セクション名` 形式であり、`## ` プレフィックスが付いている点は一貫している。

#### artifact-validator.ts での照合ロジック

`PHASE_ARTIFACT_REQUIREMENTS` の `requiredSections` も調査した。

```
'threat-model.md': requiredSections: ['## 脅威', '## リスク']
'manual-test.md':  requiredSections: ['テストシナリオ', 'テスト結果']
'security-scan.md':requiredSections: ['脆弱性スキャン結果', '検出された問題']
```

`manual-test.md` や `security-scan.md` では `## ` プレフィックスなしの文字列が定義されている。

`validateRequiredSections()` 関数は `content.includes(section)` でマッチする（行882-888）。

`## テストシナリオ` という行が成果物にあれば、`includes('テストシナリオ')` でも `includes('## テストシナリオ')` でも両方マッチする。このため、`definitions.ts` で `## ` 付きで定義していても、`artifact-validator.ts` で `## ` なしで定義していても、成果物に `## テストシナリオ` 行があれば両方の検証を通過できる。

ただし問題が一つある。`buildPrompt()` 内で `requiredSections` から `## ★★★ 必須セクション` のプロンプト部分を生成する際（行1080-1086）、`definitions.ts` の `requiredSections` の値がそのままサブエージェントへの指示として埋め込まれる。`definitions.ts` は `## ` 付きで定義されているため、サブエージェントは `## テストシナリオ` というヘッダーを成果物に含めるように正しく指示される。

結論として、現在の仕組みは実用上は動作しているが、`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` と `definitions.ts` の `PHASE_GUIDES` の間に定義の二重管理がある。

### 問題3: minLines の二重管理

#### PHASE_GUIDES での minLines 定義

`definitions.ts` の `PHASE_GUIDES` に含まれる `minLines` の値は以下の通り。

```
research:        minLines: 50
requirements:    minLines: 50
threat_modeling: minLines: 50
planning:        minLines: 50
state_machine:   minLines: 15
flowchart:       minLines: 15
ui_design:       minLines: 50
test_design:     minLines: 50
code_review:     minLines: 30
manual_test:     minLines: 20
security_scan:   minLines: 20
performance_test:minLines: 20
e2e_test:        minLines: 20
```

#### PHASE_ARTIFACT_REQUIREMENTS での minLines 定義

`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` に含まれる `minLines` の値は以下の通り。

```
'research.md':      minLines: 20
'requirements.md':  minLines: 30
'spec.md':          minLines: 50
'test-design.md':   minLines: 30
'threat-model.md':  minLines: 20
'state-machine.mmd':minLines: 5
'flowchart.mmd':    minLines: 5
'ui-design.md':     minLines: 50
'code-review.md':   minLines: 30
'manual-test.md':   minLines: 20
'security-scan.md': minLines: 20
'performance-test.md':minLines: 20
'e2e-test.md':      minLines: 20
```

#### 二重管理の実態

`research.md` の場合、`definitions.ts` では 50 行が要求されているが、`artifact-validator.ts` では 20 行が要求されている。ただしさらに `minLinesForTransition: 16` という値も `PHASE_ARTIFACT_REQUIREMENTS` に存在する。

実際の動作としては、フェーズ遷移チェック（`next.ts` の `checkPhaseArtifacts()`）では `PHASE_ARTIFACT_REQUIREMENTS` の値が参照される。`definitions.ts` の `minLines` は `buildPrompt()` によってサブエージェントへのプロンプト内で行数要件として伝達されるが、バリデーション実行時には `PHASE_ARTIFACT_REQUIREMENTS` の値が使われる。

これは実質的に二種類の使われ方をする別の設定として機能しており、修正が必要な場合はどちらを変更すべきかが不明確という問題がある。

### buildPrompt() の requiredSections 利用

`definitions.ts` の `buildPrompt()` 関数（行1022-）では、行1080-1086 で `guide.requiredSections` を使って必須セクションのプロンプト指示を生成している。

```typescript
if (guide.requiredSections && guide.requiredSections.length > 0) {
  let reqSection = '\n## ★★★ 必須セクション（含まれていない場合はバリデーション失敗）★★★\n';
  reqSection += '⚠️ 以下のMarkdownセクションヘッダーを成果物に**必ず**含めてください。...\n';
  for (const sec of guide.requiredSections) {
    reqSection += `- \`${sec}\`\n`;
  }
```

`guide.requiredSections` は `definitions.ts` の `PHASE_GUIDES` から来るので、`## テストシナリオ` のように `## ` プレフィックス付きの形式でサブエージェントに伝達される。これは正しい。

一方、`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` では `テストシナリオ`（プレフィックスなし）で定義されており、`content.includes()` による照合でもプレフィックス付きの行に対してマッチするため実用上は問題ない。ただし定義の不整合は潜在的な混乱の原因となる。

### 現在の並列フェーズ対応の全体像

`workflow_next` を呼んで並列フェーズに遷移した場合のレスポンス構造は以下の通り。

```
phaseGuide:
  phaseName: 'parallel_verification'
  description: '...'
  subagentTemplate: '...'  ← 並列フェーズ全体のテンプレート（あれば）
  subPhases:
    manual_test:
      phaseName: 'manual_test'
      description: '...'
      requiredSections: ['## テストシナリオ', '## テスト結果']
      outputFile: '...'
      minLines: 20
      # subagentTemplate: DELETED by slimSubPhaseGuide()
    security_scan:
      phaseName: 'security_scan'
      # subagentTemplate: DELETED by slimSubPhaseGuide()
    ...
```

`subPhases` の各エントリには `requiredSections`・`outputFile`・`minLines`・`allowedBashCategories` は残るが、`subagentTemplate` が削除されるため、Orchestrator は `buildPrompt()` で生成された完全なプロンプトを受け取れない。

この問題の影響として、MEMORY.md に記載されている「★★★ Orchestrator の subagentTemplate 使用ルール」が実際には並列フェーズで機能しないことが示されている。
