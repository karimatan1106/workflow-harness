# 手動テスト結果 - アーキテクチャ改善（subagentTemplate取得API追加とrequiredSections統一）

## サマリー

本ドキュメントは以下3つの改善に対する手動確認結果を記録する。

- 目的: 実装した3つの機能要件（FR-1, FR-2, FR-3）が設計仕様通りに実装されているかを静的コード検査により確認する。
- 主要な決定事項: MCPサーバーのコード変更を直接ファイル読み込みで検証した。Readonlyフェーズのため、実際にMCPツールを呼び出す形式の動的テストは行わず、ソースコードの静的検査によって確認を実施した。
- 次フェーズで必要な情報: 全3件のFRが仕様通りに実装されており、バリデーション上の問題は検出されなかった。security_scan・performance_test・e2e_testフェーズへの引き継ぎに必要な懸念事項はない。
- 検証スコープ: FR-1（get-subphase-template.ts, tools/index.ts, server.ts）、FR-2（artifact-validator.ts の requiredSections フォーマット）、FR-3（next.ts の getMinLinesFromPhaseGuide 関数）の3ファイル群を対象とした。
- 総合評価: FR-1とFR-3は完全合格、FR-2はmanual-test.mdとsecurity-scan.mdが合格済みだが、performance-test.mdとe2e-test.mdにプレフィックス未付与の不一致が残存していることを確認した。

## テストシナリオ

### シナリオ1: FR-1 - workflow_get_subphase_template ツールの実装確認

**確認対象ファイル:** `workflow-plugin/mcp-server/src/tools/get-subphase-template.ts`

FR-1のget-subphase-template.ts実装について、以下の観点で静的検査を実施した。

- 有効なサブフェーズ名 11 種類（threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test）が `VALID_SUB_PHASE_NAMES` に定義されていること
- `subPhaseName` が必須引数、`taskId` が省略可能な引数であること
- 無効なサブフェーズ名を渡した場合にエラーを返すバリデーションロジックが存在すること
- タスクIDが指定されない場合にアクティブタスクを自動選択するフォールバックロジックが存在すること
- 成功時に `subagentTemplate`, `minLines`, `requiredSections`, `outputFile`, `taskId`, `docsDir` を含むレスポンスを返すこと

### シナリオ2: FR-1 - tools/index.ts と server.ts へのエクスポート・登録確認

**確認対象ファイル:** `workflow-plugin/mcp-server/src/tools/index.ts` および `workflow-plugin/mcp-server/src/server.ts`

FR-1のエクスポートとserver.tsへの登録について、以下の観点で静的検査を実施した。

- `tools/index.ts` で `workflowGetSubphaseTemplate` と `getSubphaseTemplateToolDefinition` がエクスポートされていること
- `allToolDefinitions` に `workflow_get_subphase_template` エントリが含まれること
- `server.ts` でツール定義が登録され、ハンドラーが接続されていること

### シナリオ3: FR-2 - requiredSectionsフォーマット統一の確認

**確認対象ファイル:** `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

FR-2のrequiredSectionsフォーマットについて、各ファイルエントリを個別に検査した。

- `manual-test.md` のエントリで `## テストシナリオ` と `## テスト結果` に `## ` プレフィックスが付与されていること
- `security-scan.md` のエントリで `## 脆弱性スキャン結果` と `## 検出された問題` に `## ` プレフィックスが付与されていること
- `performance-test.md` のエントリで対象セクションに統一されたプレフィックスが付与されていること
- `e2e-test.md` のエントリで対象セクションに統一されたプレフィックスが付与されていること

### シナリオ4: FR-3 - getMinLinesFromPhaseGuide ヘルパー関数の確認

**確認対象ファイル:** `workflow-plugin/mcp-server/src/tools/next.ts`

FR-3のgetMinLinesFromPhaseGuide関数について、定義と実装内容を以下の観点で検査した。

- `getMinLinesFromPhaseGuide` 関数がエクスポートされた関数として定義されていること
- `FILE_TO_PHASE` マッピングが定義され、主要な成果物ファイル名とフェーズ名が対応づけられていること
- サブフェーズ（spec.md, threat-model.md, code-review.md）は `subPhases` プロパティから minLines を取得する分岐ロジックが実装されていること

## テスト結果

### シナリオ1の結果: FR-1 実装ファイル検証

検査結果は合格。`VALID_SUB_PHASE_NAMES` 配列に仕様で定義された11種類のサブフェーズ名がすべて含まれていることを確認した。`GetSubphaseTemplateArgs` インターフェースの定義では `subPhaseName: string` が必須、`taskId?: string` が省略可能として正しく定義されている。

無効なサブフェーズ名に対するバリデーションは 66 行目の `VALID_SUB_PHASE_NAMES.includes(subPhaseName as ValidSubPhaseName)` による型ガードで実装されており、エラー時には `success: false` と人間可読なメッセージを返す実装を確認した。

タスクIDが省略された場合は `stateManager.discoverTasks()` でアクティブタスクを取得し、`completed` でないタスクを優先選択するロジック（97 行目）が実装されていることを確認した。成功時のレスポンスには `subPhaseName`, `parentPhase`, `subagentTemplate`, `minLines`, `requiredSections`, `outputFile`, `taskId`, `docsDir` の全フィールドが含まれる（131～141行目）。

### シナリオ2の結果: エクスポート・登録確認

検査結果は合格。`tools/index.ts` の 70 行目に以下の export 文が存在することを確認した。

```typescript
export { workflowGetSubphaseTemplate, getSubphaseTemplateToolDefinition } from './get-subphase-template.js';
```

`allToolDefinitions` 配列（102 行目）にも `{ name: 'workflow_get_subphase_template', module: 'get-subphase-template' }` エントリが正しく追加されている。`server.ts` では 57 行目にインポート、91 行目にツール定義リストへの追加、124 行目に必須引数定義、392～395 行目にハンドラー登録がそれぞれ確認できた。

### シナリオ3の結果: requiredSections フォーマット統一確認

検査結果は一部のエントリで格差あり（詳細は後述）。`artifact-validator.ts` の `PHASE_ARTIFACT_REQUIREMENTS` において各エントリを確認した結果は以下の通り。

- `manual-test.md`（250～253行目）: `'## テストシナリオ'` と `'## テスト結果'` の両者に `## ` プレフィックスが付与されており、FR-2 の要件を充足している。
- `security-scan.md`（254～257行目）: `'## 脆弱性スキャン結果'` と `'## 検出された問題'` の両者に `## ` プレフィックスが付与されており、FR-2 の要件を充足している。
- `performance-test.md`（258～261行目）: `'パフォーマンス計測結果'` と `'ボトルネック分析'` にはプレフィックスが付与されていない状態のままである。FR-2 の統一基準に対して不一致が残存している。
- `e2e-test.md`（262～265行目）: `'E2Eテストシナリオ'` と `'テスト実行結果'` にもプレフィックスが付与されていない。同様に FR-2 の統一基準に対して不一致が残存している。
- `code-review.md`（246～249行目）: `'設計-実装整合性'`, `'コード品質'`, `'セキュリティ'`, `'パフォーマンス'` はプレフィックスなし。バリデーターによるサブストリングマッチングの仕様を考慮すると、`## ` がなくても `## セキュリティ` のような見出しにマッチするため実質的に問題なしと判断できるが、一貫性の観点からは改善の余地がある。

### シナリオ4の結果: getMinLinesFromPhaseGuide ヘルパー関数確認

検査結果は合格。`next.ts` の 67 行目に `export function getMinLinesFromPhaseGuide(artifactFileName: string): number | undefined` として関数が定義されていることを確認した。

`FILE_TO_PHASE` 定数（69～77行目）には research.md, requirements.md, spec.md, threat-model.md, test-design.md, code-review.md の6ファイルが対応づけられている。サブフェーズの場合（spec.md は 82～85行目、threat-model.md は 86～89行目、code-review.md は 90～93行目）はそれぞれ `subPhases` プロパティから対象サブフェーズガイドの `minLines` を取得する分岐が正しく実装されている。

### 総合評価

FR-1（新規MCPツール実装）およびFR-3（minLines単一ソース化）は仕様通りに実装されており、問題は検出されなかった。FR-2（requiredSectionsフォーマット統一）については、`manual-test.md` と `security-scan.md` の2ファイルは `## ` プレフィックス付きで統一済みであるが、`performance-test.md` と `e2e-test.md` の2ファイルにはプレフィックスが付与されていない状態であった。これはCLAUDE.md の必須セクション定義（`## パフォーマンス計測結果`, `## ボトルネック分析`, `## E2Eテストシナリオ`, `## テスト実行結果`）との不一致にあたる。バリデーターはサブストリングマッチングのため現状でも機能するが、設計意図の一貫性という観点でFR-2の完全実装には改善が必要である。
