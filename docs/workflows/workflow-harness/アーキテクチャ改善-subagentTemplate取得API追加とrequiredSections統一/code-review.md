## サマリー

本レビューはアーキテクチャ改善タスク（FR-1: 新規MCPツール追加、FR-2: requiredSections形式統一、FR-3: minLines単一ソース化）の実装コードを対象とした設計-実装整合性検証および品質評価の結果である。

- 目的: 設計書（spec.md, state-machine.mmd, flowchart.mmd, ui-design.md）に定義された3つの機能要件が実装コードに正しく反映されているかを検証し、コード品質・セキュリティ・パフォーマンス上の問題点を識別する。
- 主要な決定事項:
  - 設計-実装整合性は概ねOKだが、FR-1の詳細実装（エラーメッセージ英語化、タスクID未検出時の成功レスポンス）に設計との差異が確認された。
  - FR-2のrequiredSections修正は仕様書と完全に一致しており問題なし。
  - FR-3のminLines単一ソース化はコールバック注入ではなくnext.ts内でPHASE_GUIDESを直接参照する形で実装されており、設計意図と整合している。
- 次フェーズで必要な情報: 今回指摘した設計との差異（エラーメッセージ形式・タスク未検出時挙動）については軽微なため、implementationフェーズへの差し戻しは不要と判断する。テストフェーズでカバレッジを確認することを推奨する。

---

## 設計-実装整合性

spec.mdに定義された3つの機能要件（FR-1, FR-2, FR-3）の実装状況をフェーズごとに検証した。

### FR-1: workflow_get_subphase_template ツール追加

設計書（spec.md 1-A〜1-F）と実装（get-subphase-template.ts, tools/index.ts, server.ts）を照合した結果を以下に示す。

実装済み項目の確認結果:
- `get-subphase-template.ts` が新規作成されており、`@spec` コメントも付与されている（spec.md 1-Aの要件を充足）。
- `VALID_SUB_PHASE_NAMES` 定数（11種類）が定義されており、実行時バリデーションに使用されている（spec.md 1-Bの要件を充足）。
- `SUB_PHASE_TO_PARENT_PHASE` マッピングが全11サブフェーズ分定義されており、spec.mdの仕様と一致する（spec.md 1-Dの要件を充足）。
- `resolvePhaseGuide()` を呼び出して親フェーズガイドを取得し、`subPhases[subPhaseName]` でサブフェーズガイドを取り出すフローが実装されている（spec.md 1-D手順3の要件を充足）。
- `slimSubPhaseGuide()` を適用せずフルテンプレートを返している（spec.md 1-D手順6の要件を充足）。
- `tools/index.ts` に `workflowGetSubphaseTemplate` と `getSubphaseTemplateToolDefinition` のエクスポートが追加されている（spec.md 1-Fの要件を充足）。
- `server.ts` の import文、`TOOL_DEFINITIONS`、`ToolArguments`、`validateToolArgs.requiredParams`、ルーティングロジックの5箇所が変更されており、spec.md 1-Fに記載された全登録箇所を網羅している。

設計との差異として確認された項目:
- エラーメッセージが日本語で記述されているが、spec.md（ui-design.md「エラーメッセージ設計」）では英語形式（`"Invalid subPhaseName: ..."` など）が指定されている。機能的な影響はないが、設計書との不一致がある。
- プレースホルダー展開について、spec.md 1-D手順5では `${taskName}` と `${taskId}` と `${docsDir}` の3種類を置換すると記述されているが、実装では `resolvePhaseGuide()` に `docsDir` と `userIntent` を渡す形で処理しており、直接的な文字列置換ではなく `resolvePhaseGuide` 内部の展開ロジックに委譲している。設計意図の達成は同等と判断する。
- タスクIDが指定されず、かつアクティブタスクが存在しない場合、実装では `docsDir` と `userIntent` が `undefined` のまま処理を続行して `resolvePhaseGuide()` を呼び出す。spec.md 1-D手順2では「タスクが見つからない場合は `success: false` を返す」とある。ただし `resolvePhaseGuide()` は `docsDir` が `undefined` でも動作するため、機能上は問題が生じにくい設計となっている。

### FR-2: requiredSections 形式統一

artifact-validator.ts の `PHASE_ARTIFACT_REQUIREMENTS` 変更内容をspec.md（2-A, 2-B）と照合した結果:

- `manual-test.md` の `requiredSections` が `['## テストシナリオ', '## テスト結果']` に更新されており、spec.md 2-Aの仕様と完全一致している。
- `security-scan.md` の `requiredSections` が `['## 脆弱性スキャン結果', '## 検出された問題']` に更新されており、spec.md 2-Aの仕様と完全一致している。
- `threat-model.md` の `requiredSections` が `['## 脅威シナリオ', '## リスク評価']` に更新されており、spec.md 2-Bの仕様と完全一致している。
- `performance-test.md` と `e2e-test.md` の `requiredSections` は `## ` プレフィックスなしのままであるが、これらはFR-2の変更対象外としてspec.mdに明記されている。

設計-実装整合性の評価: FR-2については差異なし（OK）。

### FR-3: minLines 単一ソース化

next.ts の変更内容をspec.md（3-A, 3-B）と照合した結果:

- `getMinLinesFromPhaseGuide()` ヘルパー関数が next.ts に追加されており、`FILE_TO_PHASE` マッピング定数（6エントリ）がspec.md 3-Bの仕様と完全一致している。
- `checkPhaseArtifacts()` 内で `getMinLinesFromPhaseGuide()` を呼び出し、`phaseGuideMinLines` が `undefined` でない場合は `effectiveRequirements` として上書きする実装がspec.md 3-Bのコード例と完全一致している。
- spec.md 3-Cの確定値表（research.md: 50行, requirements.md: 50行など）に基づくminLines値が `PHASE_GUIDES` に存在することが前提となっており、next.tsがPHASE_GUIDESを直接参照することで循環参照を回避するspec.md 3-Aの方針が実装されている。

設計-実装整合性の評価: FR-3については差異なし（OK）。

### state-machine.mmd の状態遷移との整合性

state-machine.mmdに定義された主要フロー（ValidatingSubPhaseName → ResolveTask → RetrievingTemplate → ResolvingPhaseGuide → GettingSubPhaseGuide → ExpandingTemplate → ReturnTemplate）が get-subphase-template.ts の処理順序と対応している。

SubPhaseInvalid, TaskNotFound, NoSubPhaseGuide の各エラー状態も実装に反映されており、適切なエラーレスポンスが返される構造になっている。なお、state-machine.mmdの注記に「forkflow_nextとは異なり slimSubPhaseGuide を適用してフルテンプレートを返す点が重要」という誤字（forkflow）があるが、実装側は正しく「slimSubPhaseGuide を適用しない」として実装されている。

### flowchart.mmd の処理フローとの整合性

flowchart.mmdに定義された実装順序（FR-2 → FR-3 → FR-1 → テスト → ビルド）が本タスクの実装で踏襲されている。ビルドチェックおよびMCPサーバー再起動フローはbuild_checkフェーズで実施される前提のため、code_reviewフェーズでの確認対象外となる。

設計-実装整合性の総合評価: 軽微な差異（エラーメッセージ言語、タスク未検出時の続行挙動）を除き、設計と実装は整合している。差し戻し不要と判断する。

---

## コード品質

各ファイルのコード品質について確認した結果を以下に示す。

### get-subphase-template.ts

命名規則は既存ファイル（next.ts, status.ts）のパターンに準拠しており、関数名・定数名・インターフェース名が一貫している。`export const VALID_SUB_PHASE_NAMES = [...] as const` による型安全な定数定義が適切に行われており、`ValidSubPhaseName` 型を `typeof VALID_SUB_PHASE_NAMES[number]` で導出している点も適切である。

`SUB_PHASE_TO_PARENT_PHASE` のキー型を `Record<ValidSubPhaseName, string>` とすることで、11種類のサブフェーズが漏れなく定義されていることをコンパイル時に保証している。この設計は将来サブフェーズを追加した場合に型エラーとして検出できるため、保守性が高い。

エラーハンドリングについては全エラーケースで `{ success: false, message: string }` の統一形式が使われており、呼び出し元での判別が容易である。ただし、`stateManager.getTaskById()` が例外を投げる可能性がある場合（データ破損など）の try-catch が存在しない点はリスクがある。既存の他ツールが同様のパターンを使用しているため一貫性はあるが、堅牢性向上のためにエラーハンドリングの追加を将来的に検討することを推奨する。

### next.ts の追加コード

`getMinLinesFromPhaseGuide()` 関数は `export` が付与されており、テストからの直接呼び出しが可能な設計となっている。内部の `FILE_TO_PHASE` 定数は関数スコープに閉じており、不必要なグローバル汚染を避けている点が良好である。

`spec.md` と `threat-model.md` の処理でサブフェーズガイドを `(typeof guide | undefined)` にキャストしている箇所については、型安全性が若干弱い。`PHASE_GUIDES[phaseName].subPhases` の型が `Record<string, unknown>` 相当の場合、アクセス後のキャストが `any` に近い挙動をする可能性がある。spec.md の実装例でも同様のキャストが使われていたため設計上の意図ではあるが、型定義の改善を将来的に検討することを推奨する。

### artifact-validator.ts の変更

変更は `PHASE_ARTIFACT_REQUIREMENTS` の3エントリに限定されており、ロジックの変更は一切なく、最小限の変更に留まっている。変更前後の値はspec.md 2-A, 2-Bと一致しており、意図しない副作用のリスクが低い。

### tools/index.ts および server.ts の変更

`tools/index.ts` は既存パターン（`/** FR-1: サブフェーズテンプレート取得ツール */` コメントつきエクスポート）に従った追記が行われており、一貫性が保たれている。`allToolDefinitions` 配列にもエントリが追加されている点が見落とされがちなポイントであり、正しく追記されていることを確認した。

`server.ts` の変更は5箇所（import, TOOL_DEFINITIONS, ToolArguments, requiredParams, routing）の全てが正しく実装されており、既存ツールと同一のパターンに従っている。

---

## セキュリティ

ワークフロープラグインのセキュリティ特性を踏まえ、新規コードの潜在的なリスクを評価した。

### 入力検証の評価

`workflowGetSubphaseTemplate()` の入力検証は適切に実装されている。`subPhaseName` は `VALID_SUB_PHASE_NAMES` との照合によって文字列の範囲が制限されており、任意文字列の注入リスクは低い。`taskId` は省略可能なパラメータであり、内部では `stateManager.getTaskById()` に渡されるのみで、外部システムへの直接的な影響はない。

`PHASE_ARTIFACT_REQUIREMENTS` の `requiredSections` 変更（FR-2）については、バリデーションロジックが `content.includes(section)` による部分一致検索を使用しているため、`## ` プレフィックスの追加によってより正確なマッチングが行われるようになった。これはセキュリティ上の改善ではなく機能的な修正であるが、誤検出の減少という観点では品質向上となる。

### 情報漏洩リスクの評価

`workflowGetSubphaseTemplate()` のレスポンスには `subagentTemplate`（Orchestratorが使用するプロンプトテンプレート）が含まれる。このテンプレートには `taskName`・`taskId`・`docsDir` といったタスク固有の情報が展開される。MCPサーバーはローカルプロセスとして動作し、外部公開されない前提であるため、テンプレート内容の漏洩リスクは現状では低い。ただし、将来的にMCPサーバーをネットワーク越しに公開する場合は認証・認可の検討が必要となる。

### 既存ツールとの一貫性

新規ツールのセキュリティパターンは既存ツール（`workflowStatus`, `workflowNext` など）と同一であり、既知のセキュリティ考慮事項（HMACによるstate整合性保護、セッショントークン検証）の適用範囲外となる読み取り専用ツールとして設計されている点が適切である。

---

## パフォーマンス

新規コードのパフォーマンス特性を評価した。

### get-subphase-template.ts のパフォーマンス特性

`workflowGetSubphaseTemplate()` は同期処理で完結する設計となっており、非同期処理によるオーバーヘッドが存在しない。`resolvePhaseGuide()` 呼び出しはメモリ上の `PHASE_GUIDES` 定数へのアクセスであり、ファイルIOや外部通信を行わないため、応答時間は非常に短時間（数ミリ秒以下）となる見込みである。

`stateManager.discoverTasks()` のパフォーマンスはタスク数に依存する。アクティブタスクが多数存在する場合でも、`taskId` を明示的に渡すことで自動検索をスキップできるため、パフォーマンスクリティカルな場面では `taskId` を明示することを推奨する。

### getMinLinesFromPhaseGuide() のパフォーマンス特性

`getMinLinesFromPhaseGuide()` は `FILE_TO_PHASE` マッピング（6エントリ）への直接アクセスと `PHASE_GUIDES` への定数アクセスのみで構成されており、O(1)の処理時間となる。`checkPhaseArtifacts()` のループ内で呼び出されるが、成果物ファイルの数は通常1〜3個であるため、実質的なパフォーマンスへの影響はない。

### artifact-validator.ts 変更のパフォーマンス影響

FR-2の変更（`requiredSections` の文字列変更）はバリデーションロジック自体には影響しない。`validateRequiredSections()` の `content.includes(section)` 検索が `'テストシナリオ'`（7文字）から `'## テストシナリオ'`（10文字）に変わることで、わずかにパターン長が増加するが、測定可能な差は生じない。
