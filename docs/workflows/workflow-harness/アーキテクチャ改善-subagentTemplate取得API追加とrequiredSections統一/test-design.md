## サマリー

本ドキュメントはアーキテクチャ改善タスク（FR-1〜FR-3）に対するテスト設計書である。

- 目的: 3つの機能要件（新規MCPツール追加、requiredSectionsフォーマット統一、minLines単一ソース化）に対して、実装前にテストケースを網羅的に定義し、TDDサイクルのRedフェーズを明確化する。
- 主要な決定事項:
  - テストファイルの配置先を `workflow-plugin/mcp-server/src/tools/__tests__/` に統一する。
  - FR-1のユニットテストは `get-subphase-template.test.ts` として新規作成する。
  - FR-2の既存テストファイル `artifact-quality-check.test.ts` に必須セクション変更テストを追記する方針を採用する。
  - FR-3のテストは `next-artifact-check.test.ts` に隣接する新規ファイルとして作成する。
- 次フェーズで必要な情報:
  - テストファイルのパス一覧（3ファイル）
  - 各テストが参照するモジュールのimportパス
  - `vi.mock` を使用した stateManager のモックパターン（既存テストと同様の方式）

---

## テスト方針

本タスクでは3つの機能要件（FR-1〜FR-3）に対して独立したテストファイルを用意する。テストフレームワークはvitest（既存テストスイートと同一）を使用し、全テストはTDDのRedフェーズとして実装フェーズより先に作成する。

テストの範囲は以下の3層を対象とする。まずユニットテストとして各関数の正常系・異常系を網羅する。次に統合テストとしてMCPツール全体の呼び出し経路（引数バリデーション → ビジネスロジック → 返り値）を検証する。最後に境界値テストとして無効な入力、存在しないタスクID、空文字列などのエッジケースを扱う。

テストファイルの配置方針は以下の通りである。FR-1の新規ツールは `workflow-plugin/mcp-server/src/tools/__tests__/get-subphase-template.test.ts` に配置する。FR-2のバリデーター変更は `workflow-plugin/mcp-server/src/tools/__tests__/artifact-quality-check.test.ts` に追記する。FR-3のminLines単一ソース化は `workflow-plugin/mcp-server/src/tools/__tests__/next-min-lines-phase-guide.test.ts` に新規作成する。

モックの方針として、stateManagerは `vi.mock('../../state/manager.js', ...)` でモック化する。ファイルシステムアクセスが必要なテストは `tmp` ディレクトリに一時ファイルを作成して検証し、テスト終了後に削除する。auditLogger および design-validator も既存テストパターンに準拠してモック化する。

---

## テストケース

### FR-1: workflow_get_subphase_template ツール

テストファイルパス: `workflow-plugin/mcp-server/src/tools/__tests__/get-subphase-template.test.ts`

#### TC-1-1: 有効なサブフェーズ名を指定した場合にsuccessが返ること

- 分類: 正常系ユニットテスト
- 入力: `{ subPhaseName: 'planning' }` を指定し、stateManager.getTaskById がアクティブなタスク状態を返すようにモックする
- 期待値: `success === true` かつ `subPhaseName === 'planning'` かつ `subagentTemplate` が空でない文字列（50文字以上）
- 確認方法: `workflowGetSubphaseTemplate({ subPhaseName: 'planning' })` を呼び出してアサーションする

#### TC-1-2: 全11種類のサブフェーズ名に対してsuccessが返ること

- 分類: 正常系ユニットテスト（パラメータ化）
- 入力: `VALID_SUB_PHASE_NAMES` 配列の11要素をループで指定する（threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test）
- 期待値: 全てのサブフェーズ名で `success === true` かつ `subagentTemplate` が非空文字列
- 確認方法: 各サブフェーズ名でループしてアサーションする

#### TC-1-3: 無効なサブフェーズ名を指定した場合にエラーが返ること

- 分類: 異常系ユニットテスト
- 入力: `{ subPhaseName: 'invalid_phase' }`
- 期待値: `success === false` かつ返り値オブジェクトに `message` プロパティが存在する
- 確認方法: `workflowGetSubphaseTemplate({ subPhaseName: 'invalid_phase' })` を呼び出して `success === false` をアサーションする

#### TC-1-4: 空文字列のサブフェーズ名を指定した場合にエラーが返ること

- 分類: 境界値テスト
- 入力: `{ subPhaseName: '' }`
- 期待値: `success === false` かつエラーメッセージが含まれる
- 確認方法: 空文字列を指定して呼び出し、失敗結果をアサーションする

#### TC-1-5: アクティブなタスクが存在しない状態でtaskIdを省略した場合にエラーが返ること

- 分類: 異常系統合テスト
- 前提: stateManager.getTaskById がタスクなしを返すようにモックする
- 入力: `{ subPhaseName: 'planning' }` のみ（taskIdなし）
- 期待値: `success === false` かつタスクが見つからない旨のメッセージが含まれる
- 確認方法: stateManagerのモックを調整してからアサーションする

#### TC-1-6: taskIdを明示的に指定した場合に該当タスクのテンプレートが返ること

- 分類: 正常系統合テスト
- 前提: stateManager.getTaskById が特定タスクIDに対応する状態を返すようにモックする
- 入力: `{ subPhaseName: 'threat_modeling', taskId: 'task-001' }`
- 期待値: `success === true` かつ `subagentTemplate` に taskId または taskName のプレースホルダーが展開済みの値が含まれる
- 確認方法: 返り値の `subagentTemplate` に展開済み文字列が含まれることをアサーションする

#### TC-1-7: slimSubPhaseGuideが適用されないことの確認

- 分類: 正常系ユニットテスト（設計仕様確認）
- 目的: workflow_next とは異なり、このツールではフルテンプレートが返されることを確認する
- 入力: `{ subPhaseName: 'code_review' }`
- 期待値: 返り値の `subagentTemplate` フィールドが存在し、かつ空でない文字列であること
- 確認方法: `subagentTemplate` のプロパティ存在と長さをアサーションする

#### TC-1-8: SUB_PHASE_TO_PARENT_PHASEマッピングの網羅性確認

- 分類: 静的解析テスト
- 目的: VALID_SUB_PHASE_NAMES の全要素が SUB_PHASE_TO_PARENT_PHASE に含まれることを確認する
- 入力: VALID_SUB_PHASE_NAMES 配列の各要素
- 期待値: 全要素が SUB_PHASE_TO_PARENT_PHASE のキーとして存在する
- 確認方法: 配列のlengthと対応するマッピングオブジェクトのキー数を比較する

#### TC-1-9: planner サブフェーズのrequiredSectionsが返り値に含まれること

- 分類: 正常系ユニットテスト
- 入力: `{ subPhaseName: 'planning' }`
- 期待値: 返り値に `requiredSections` プロパティが存在するか、または `subagentTemplate` 内に必須セクション指示が含まれること
- 確認方法: 返り値オブジェクトのプロパティを確認するか、subagentTemplate を文字列として検査する

---

### FR-2: requiredSectionsフォーマット統一

テストファイルパス: `workflow-plugin/mcp-server/src/tools/__tests__/artifact-quality-check.test.ts`（既存ファイルに追記）

#### TC-2-1: manual-test.md のバリデーション - `## テストシナリオ` 見出しを含む場合に通過すること

- 分類: 正常系統合テスト
- 前提: `PHASE_ARTIFACT_REQUIREMENTS['manual-test.md'].requiredSections` が `'## テストシナリオ'` を含む状態（FR-2変更後）
- 入力: `## テストシナリオ` と `## テスト結果` の両見出しを含み、各セクションに5行以上の実質行を持つコンテンツ
- 期待値: `validateArtifactQuality()` が `{ passed: true }` を返す
- 確認方法: 一時ファイルに内容を書き込み、 `validateArtifactQuality(filePath, requirements)` を呼び出す

#### TC-2-2: manual-test.md のバリデーション - プレフィックスなしで `テストシナリオ` のみを含む場合にバリデーション失敗となること

- 分類: 後方互換性確認テスト（変更後の破壊的変更の意図的確認）
- 目的: FR-2変更後は `## ` プレフィックスが必須になったことを確認する
- 入力: `テストシナリオ` という文字列は含むが `## テストシナリオ` という見出し形式のないコンテンツ
- 期待値: `validateArtifactQuality()` が `{ passed: false }` を返し、エラーメッセージに必須セクション欠如が含まれる
- 確認方法: 一時ファイルに内容を書き込み、アサーションする

#### TC-2-3: security-scan.md のバリデーション - `## 脆弱性スキャン結果` と `## 検出された問題` を含む場合に通過すること

- 分類: 正常系統合テスト
- 入力: `## 脆弱性スキャン結果` と `## 検出された問題` の両見出しを含み、各セクションに実質行を持つコンテンツ
- 期待値: `validateArtifactQuality()` が `{ passed: true }` を返す
- 確認方法: 一時ファイルに内容を書き込み、 `validateArtifactQuality(filePath, requirements)` を呼び出す

#### TC-2-4: security-scan.md のバリデーション - プレフィックスなしの場合にバリデーション失敗となること

- 分類: 後方互換性確認テスト
- 入力: `脆弱性スキャン結果` という文字列は含むが `## ` プレフィックスのない形式のコンテンツ
- 期待値: `validateArtifactQuality()` が `{ passed: false }` を返す
- 確認方法: 一時ファイルに内容を書き込み、アサーションする

#### TC-2-5: threat-model.md のバリデーション - `## 脅威シナリオ` と `## リスク評価` を含む場合に通過すること

- 分類: 正常系統合テスト
- 目的: FR-2でのthreat-model.md のrequiredSections変更後の動作確認
- 入力: `## 脅威シナリオ` と `## リスク評価` の両見出しを含み、各セクションに実質行を持つコンテンツ
- 期待値: `validateArtifactQuality()` が `{ passed: true }` を返す
- 確認方法: 一時ファイルに内容を書き込み、アサーションする

#### TC-2-6: PHASE_ARTIFACT_REQUIREMENTS の requiredSections 定義値の確認

- 分類: 静的解析テスト
- 目的: FR-2変更後の定数値が期待通りであることをコード側から確認する
- 入力: `PHASE_ARTIFACT_REQUIREMENTS['manual-test.md'].requiredSections` を参照する
- 期待値: 配列の先頭要素が `'## テストシナリオ'` であること（`'## '` プレフィックスが付与されていること）
- 確認方法: `PHASE_ARTIFACT_REQUIREMENTS` を直接インポートして値をアサーションする

---

### FR-3: minLines単一ソース化

テストファイルパス: `workflow-plugin/mcp-server/src/tools/__tests__/next-min-lines-phase-guide.test.ts`（新規作成）

#### TC-3-1: getMinLinesFromPhaseGuide - research.md を渡した場合に50が返ること

- 分類: 正常系ユニットテスト
- 入力: `getMinLinesFromPhaseGuide('research.md')`
- 期待値: 戻り値が `50`
- 確認方法: `next.ts` から `getMinLinesFromPhaseGuide` をエクスポートして直接呼び出し、アサーションする
- 備考: PHASE_ARTIFACT_REQUIREMENTS の minLines が 20 であるのに対し、PHASE_GUIDES の値が 50 を上書きすることを確認する

#### TC-3-2: getMinLinesFromPhaseGuide - requirements.md を渡した場合に50が返ること

- 分類: 正常系ユニットテスト
- 入力: `getMinLinesFromPhaseGuide('requirements.md')`
- 期待値: 戻り値が `50`
- 確認方法: 直接呼び出してアサーションする

#### TC-3-3: getMinLinesFromPhaseGuide - 対応するフェーズが存在しないファイル名を渡した場合にundefinedが返ること

- 分類: 境界値テスト
- 入力: `getMinLinesFromPhaseGuide('unknown-file.md')`
- 期待値: 戻り値が `undefined`
- 確認方法: 直接呼び出してアサーションする

#### TC-3-4: checkPhaseArtifacts - research.md が40行の場合にバリデーション失敗となること

- 分類: 統合テスト（フル検証パス）
- 目的: PHASE_GUIDES の minLines（50行）が PHASE_ARTIFACT_REQUIREMENTS の minLines（20行）より優先されることを確認する
- 前提: 40行のコンテンツを持つ一時 research.md ファイルを作成する（20行を超えるが50行には満たない状態）
- 入力: `checkPhaseArtifacts('research', docsDir)` を呼び出す（docsDir は一時ディレクトリ）
- 期待値: 戻り値の配列が空でない（行数不足エラーが含まれる）
- 確認方法: 一時ファイルを作成し、 `workflowNext` を経由してフェーズ遷移を試み、エラーメッセージに行数不足が含まれることを確認する

#### TC-3-5: checkPhaseArtifacts - PHASE_GUIDES に定義のないファイルはPHASE_ARTIFACT_REQUIREMENTSのminLinesを使用すること

- 分類: フォールバック確認テスト
- 目的: manual-test.md など PHASE_GUIDES に minLines が定義されていない場合に PHASE_ARTIFACT_REQUIREMENTS のフォールバックが動作することを確認する
- 前提: 15行のコンテンツを持つ一時 manual-test.md ファイルを作成する（PHASE_ARTIFACT_REQUIREMENTS の 20行を下回る）
- 期待値: バリデーション失敗（行数不足エラーが含まれる）
- 確認方法: `validateArtifactQuality()` を直接呼び出してアサーションする

#### TC-3-6: checkPhaseArtifacts - research.md が55行の場合にバリデーション通過すること

- 分類: 正常系統合テスト
- 目的: PHASE_GUIDES の minLines（50行）を上回る行数で通過することを確認する
- 前提: 55行以上の実質行を持つ一時 research.md ファイルを作成する
- 入力: `workflowNext` を経由して research フェーズ遷移を試みる
- 期待値: 行数不足エラーが発生しない（その他のエラーは別途対処）
- 確認方法: 一時ファイルを作成してアサーションする

#### TC-3-7: getMinLinesFromPhaseGuide - spec.md を渡した場合にplanningサブフェーズのminLinesが返ること

- 分類: 正常系ユニットテスト
- 目的: spec.md が parallel_analysis → planning のサブフェーズガイドを参照することを確認する
- 入力: `getMinLinesFromPhaseGuide('spec.md')`
- 期待値: 戻り値が PHASE_GUIDES の planning サブフェーズの minLines 値（50）と一致すること
- 確認方法: 直接呼び出してアサーションする

#### TC-3-8: getMinLinesFromPhaseGuide - threat-model.md を渡した場合にthreat_modelingサブフェーズのminLinesが返ること

- 分類: 正常系ユニットテスト
- 入力: `getMinLinesFromPhaseGuide('threat-model.md')`
- 期待値: 戻り値が PHASE_GUIDES の threat_modeling サブフェーズの minLines 値と一致すること
- 確認方法: 直接呼び出してアサーションする

---

## テスト実施順序と依存関係

### 実施順序

テストはspec.mdの実装順序（FR-2 → FR-3 → FR-1）に合わせて、対応するテストを先に作成してから実装を行う。

FR-2の変更は artifact-validator.ts のみを対象とするため、最初に `TC-2-*` のテストコードを作成する。これらは変更前の段階では `TC-2-2` と `TC-2-4` が通過し、変更後に `TC-2-1` と `TC-2-3` が通過する状態になる点が特徴的である（既存の動作から新しい動作への移行を表す）。

FR-3の変更は next.ts に `getMinLinesFromPhaseGuide` 関数を追加するため、その後に `TC-3-*` のテストコードを作成する。実装前はこれらのテストは関数が存在しないためコンパイルエラーとなる（TDD Red）。

FR-1の変更は最も変更箇所が多いため最後に `TC-1-*` のテストコードを作成する。`get-subphase-template.ts` が存在しない状態では全テストがimportエラーで失敗する（TDD Red）。

### 依存関係

TC-1-5 と TC-1-6 は stateManager のモック設定に依存するため、モックパターンを先に確立してから実装する。TC-2-1〜TC-2-5 は一時ファイルの作成・削除を伴うため、`beforeEach` と `afterEach` でファイル管理を行う。TC-3-4 と TC-3-6 は workflowNext の動作確認であるため、stateManager のモック設定と一時ファイル作成の両方が必要になる。

---

## テスト環境と前提条件

テストランナーは vitest を使用する。実行コマンドは `cd workflow-plugin/mcp-server && npx vitest src/tools/__tests__/` であり、テスト出力はルートディレクトリに散らかさない。

一時ファイルの作成先は `workflow-plugin/mcp-server/src/tools/__tests__/fixtures/` ディレクトリを使用し、テスト終了後に `afterEach` 内で削除する。

モジュールモックは以下の対象に適用する。stateManager（`../../state/manager.js`）、auditLogger（`../../audit/logger.js`）、design-validator（`../../validation/design-validator.js`）、scope-validator（`../../validation/scope-validator.js`）、そして test-authenticity（`../../validation/test-authenticity.js`）。これらは `vi.mock` を使用した既存テストパターンと同一の方式で実装する。

TypeScriptの型安全性を確保するため、各テストファイルの先頭には `import type` による型インポートを含める。テスト対象の実装関数は `.js` 拡張子付きのパスでインポートする（ESMモジュール規約）。
