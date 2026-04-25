# spec.md: 全フェーズへのワークフロー制御ツール呼び出し禁止指示追加

## サマリー

- **目的**: definitions.tsの全25フェーズのsubagentTemplateに「★ワークフロー制御ツール禁止★」セクションを追加し、subagentがworkflow_next等を自律呼び出しする問題を防止する
- **主要な決定事項**:
  - フェーズを4種別（直線フェーズ・並列サブフェーズ・承認フェーズ・git操作フェーズ）に分類し、種別ごとに異なる禁止指示テキストを定義する
  - 既存の禁止指示が存在する4フェーズ（test_impl・testing・regression_test・docs_update）は変更せず、残り21フェーズに新規追加する
  - セクションヘッダーは「## ★ワークフロー制御ツール禁止★」に統一し、既存フェーズとフォーマットを揃える
  - 変更対象ファイルは `workflow-plugin/mcp-server/src/phases/definitions.ts` の1ファイルのみ
- **次フェーズで必要な情報**:
  - 各フェーズの分類と適用する禁止指示種別の対応表（本ファイルの「実装計画」セクションに記載）
  - 禁止指示テキスト4種類の確定版（本ファイルの「実装計画」セクションに記載）
  - テスト実行コマンドとパス件数の確認基準（945件以上の合格が必要）

---

## 概要

### 背景と問題の本質

FR-15（docs_update→commit→push→ci_verificationの連鎖自律呼び出し）の発生は、subagentがworkflow_nextを呼び出してフェーズ遷移を行う技術的な手段を持っており、かつ呼び出し禁止の指示が不在であったことに起因する。

docs_updateフェーズのsubagentTemplateには「## ★ワークフロー制御ツール禁止★」セクションが追加されているが、commitフェーズとpushフェーズのsubagentTemplateにはこの禁止指示が存在しなかった。その結果、commitフェーズのsubagentが「作業完了後に次フェーズへ進む」という自律判断でworkflow_nextを呼び出し、pushフェーズ・ci_verificationフェーズへと連鎖した。

### 解決方針

全25フェーズのsubagentTemplateに禁止指示を追加することで、どのフェーズのsubagentも自律的にworkflow_nextを呼び出せないように明示的に制約する。フェーズ遷移の専権をOrchestratorに集中させる設計の徹底が目的である。

### 既存の禁止指示の有無確認

調査の結果、definitions.tsにおいて以下のフェーズには既に禁止指示セクションが存在することを確認した。

禁止指示が存在するフェーズ（変更不要）:
- test_impl: 「workflow_next, workflow_approve, workflow_start, workflow_reset, workflow_complete_sub」を禁止済み
- testing: 「workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset」を禁止済み（セッショントークン制限の説明も含む）
- regression_test: 「workflow_next, workflow_approve, workflow_complete_sub, workflow_start, workflow_reset, workflow_capture_baseline」を禁止済み
- docs_update: 「workflow_next, workflow_approve, workflow_start, workflow_reset, workflow_complete_sub」を禁止済み

禁止指示が存在しないフェーズ（新規追加対象の21フェーズ）:
- 直線フェーズ（6フェーズ）: research, requirements, implementation, refactoring, ci_verification, deploy
- 並列サブフェーズ（11フェーズ）: threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test
- 承認フェーズ（2フェーズ）: design_review, test_design
- git操作フェーズ（2フェーズ）: commit, push

---

## 実装計画

### フェーズ分類と禁止指示種別の対応表

| フェーズ種別 | 対象フェーズ | 禁止指示の特徴 |
|------------|------------|--------------|
| 直線フェーズ（FR-19-1） | research, requirements, implementation, refactoring, ci_verification, deploy | 標準禁止指示（5ツール禁止） |
| 並列サブフェーズ（FR-19-2） | threat_modeling, planning, state_machine, flowchart, ui_design, build_check, code_review, manual_test, security_scan, performance_test, e2e_test | workflow_complete_subへの特別説明を追加 |
| 承認フェーズ（FR-19-3） | design_review, test_design | workflow_approveの自律承認禁止を特別強調 |
| git操作フェーズ（FR-19-4） | commit, push | workflow_nextの連鎖禁止を特別強調 |

### FR-19-1: 直線フェーズ用禁止指示テキスト（確定版）

直線フェーズ（research・requirements・implementation・refactoring・ci_verification・deploy）のsubagentTemplateの末尾に追加するテキスト。

```
\n\n## ★ワークフロー制御ツール禁止★\n\nこのsubagentの責任範囲は上記の作業内容のみである。\nフェーズ遷移の制御はOrchestratorの専権事項であり、以下のMCPツールは呼び出し禁止:\n- workflow_next（フェーズを次に進めるツール）\n- workflow_approve（requirementsやdesign_review等のレビューフェーズを承認するツール）\n- workflow_complete_sub（並列フェーズのサブフェーズ完了を宣言するツール）\n- workflow_start（新規タスクを開始するツール）\n- workflow_reset（タスクをリセットするツール）\n作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

このテキストは既存の docs_update フェーズの禁止指示と同じ構成を採用しており、「## ★ワークフロー制御ツール禁止★」ヘッダー・禁止ツール列挙・終了指示の3要素で構成される。

### FR-19-2: 並列サブフェーズ用禁止指示テキスト（確定版）

並列サブフェーズ（threat_modeling・planning・state_machine・flowchart・ui_design・build_check・code_review・manual_test・security_scan・performance_test・e2e_test）のsubagentTemplateの末尾に追加するテキスト。

```
\n\n## ★ワークフロー制御ツール禁止★\n\nこのsubagentの責任範囲は上記の作業内容のみである。\nサブフェーズ完了宣言・フェーズ遷移はOrchestratorの専権事項であり、以下のMCPツールは呼び出し禁止:\n- workflow_next（フェーズを次に進めるツール）\n- workflow_approve（requirementsやdesign_review等のレビューフェーズを承認するツール）\n- workflow_complete_sub（並列フェーズのサブフェーズ完了を宣言するツール）: このツールは並列フェーズの各サブフェーズ完了をOrchestratorが宣言するためのものであり、subagentが呼び出してはならない\n- workflow_start（新規タスクを開始するツール）\n- workflow_reset（タスクをリセットするツール）\n作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

直線フェーズ用との差分は workflow_complete_sub の説明に「このツールは並列フェーズの各サブフェーズ完了をOrchestratorが宣言するためのものであり、subagentが呼び出してはならない」という特別な説明を追記している点である。subagentが並列フェーズのサブフェーズとして動作しているため、自分自身のサブフェーズ完了を宣言しようとする誤動作が特に発生しやすい。

### FR-19-3: 承認フェーズ用禁止指示テキスト（確定版）

承認フェーズ（design_review・test_design）のsubagentTemplateの末尾に追加するテキスト。

```
\n\n## ★ワークフロー制御ツール禁止★\n\nこのsubagentの責任範囲はレビュー成果物の作成のみである。\n承認・フェーズ遷移はOrchestratorがユーザー確認後に実行するものであり、以下のMCPツールは呼び出し禁止:\n- workflow_next（フェーズを次に進めるツール）\n- workflow_approve（requirementsやdesign_review等のレビューフェーズを承認するツール）: このフェーズはユーザー承認が必要であり、subagentが自律的にworkflow_approveを呼び出して承認を完了させてはならない。ユーザーの確認機会が失われる\n- workflow_complete_sub（並列フェーズのサブフェーズ完了を宣言するツール）\n- workflow_start（新規タスクを開始するツール）\n- workflow_reset（タスクをリセットするツール）\n作業が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

承認フェーズ用では workflow_approve への特別な説明として「このフェーズはユーザー承認が必要であり、subagentが自律的にworkflow_approveを呼び出して承認を完了させてはならない。ユーザーの確認機会が失われる」という文言を追加している。design_reviewとtest_designはOrchestratorがユーザーに確認を求めてから承認するフェーズであり、subagentが自律承認すると設計品質保証のための確認機会が失われる。

### FR-19-4: git操作フェーズ用禁止指示テキスト（確定版）

git操作フェーズ（commit・push）のsubagentTemplateの末尾に追加するテキスト。

```
\n\n## ★ワークフロー制御ツール禁止★\n\nこのsubagentの責任範囲はgit操作のみである。\nフェーズ遷移の制御はOrchestratorの専権事項であり、以下のMCPツールは呼び出し禁止:\n- workflow_next（フェーズを次に進めるツール）: git操作完了後に自律的に次フェーズへ移行することは禁止。commitフェーズのsubagentがworkflow_nextを呼び出すとpushフェーズが開始され、さらにpushフェーズのsubagentがworkflow_nextを呼び出すとci_verificationフェーズが開始される連鎖が発生する\n- workflow_approve（requirementsやdesign_review等のレビューフェーズを承認するツール）\n- workflow_complete_sub（並列フェーズのサブフェーズ完了を宣言するツール）\n- workflow_start（新規タスクを開始するツール）\n- workflow_reset（タスクをリセットするツール）\ngit操作が完了した後は、速やかに処理を終了してOrchestratorに制御を返すこと。
```

git操作フェーズ用では workflow_next への特別な説明として「git操作完了後に自律的に次フェーズへ移行することは禁止。commitフェーズのsubagentがworkflow_nextを呼び出すとpushフェーズが開始され、さらにpushフェーズのsubagentがworkflow_nextを呼び出すとci_verificationフェーズが開始される連鎖が発生する」という具体的な障害シナリオを記述している。FR-15で実際に発生したこの連鎖パターンを明示することで、subagentがなぜ禁止されているかを理解しやすくする。

### 実装順序

実装は以下の順序で行うことを推奨する。

1. 直線フェーズ6つへの追加（FR-19-1）: research・requirements・implementation・refactoring・ci_verification・deploy
2. 承認フェーズ2つへの追加（FR-19-3）: design_review・test_design
3. git操作フェーズ2つへの追加（FR-19-4）: commit・push
4. 並列サブフェーズ11フェーズへの追加（FR-19-2）: threat_modeling・planning・state_machine・flowchart・ui_design・build_check・code_review・manual_test・security_scan・performance_test・e2e_test

並列サブフェーズを最後にしているのはフェーズ数が最も多く、一括で編集する必要があるためである。

### テキスト追加位置の共通ルール

各フェーズのsubagentTemplateは1つの長い文字列リテラル（シングルクォートまたはバッククォート区切り）で定義されている。禁止指示テキストは文字列の末尾、クォート終端文字の直前に追加すること。改行は `\n` で表現されており、追加テキストの冒頭も `\n\n` で始めることで視覚的な区切りを確保する。

---

## 変更対象ファイル

変更対象のファイルは1ファイルのみである。

- `workflow-plugin/mcp-server/src/phases/definitions.ts`
  - 現在の行数: 1595行
  - 変更の性質: subagentTemplateプロパティの文字列末尾への追記のみ
  - 変更対象のフェーズ数: 21フェーズ（25フェーズのうち既存禁止指示が存在する4フェーズを除く）
  - フェーズ定義のロジック・フェーズ順序・その他プロパティは変更しない

変更後に実施が必要な確認事項を以下に列挙する。

- npm run build でTypeScriptのビルドが成功することを確認する（`workflow-plugin/mcp-server/` ディレクトリで実行）
- テストスイートを実行して945件以上のテストが全件パスすることを確認する
- 全25フェーズのsubagentTemplateに「## ★ワークフロー制御ツール禁止★」セクションが含まれることをGrepで確認する
- 既存の4フェーズ（test_impl・testing・regression_test・docs_update）の禁止指示が変更されていないことを確認する

---

## 非機能要件への対応設計

### NFR-1（一貫性）への対応

全フェーズで統一されたセクションヘッダー「## ★ワークフロー制御ツール禁止★」を使用することで、どのフェーズのsubagentも同じ形式で禁止指示を受け取ることができ、保守性が高まる。
フェーズ種別ごとに4種類のテンプレートを用意し、同一種別内では同一テキストを使用することで、種別をまたいだ記述の揺れを防ぐ。
禁止対象ツール一覧（workflow_next・workflow_approve・workflow_complete_sub・workflow_start・workflow_reset）は全テンプレートで共通化されており、一つのリストに変更が生じた場合は全種別のテンプレートに反映することで記述漏れを防ぐ。
禁止指示テキストの差分はフェーズ固有の誤動作パターンへの追加説明のみとし、基本構造は全種別で共通の3要素（ヘッダー・禁止ツール列挙・終了指示）を維持する。
この設計によってsubagentが禁止指示を見落とすリスクが低下し、フェーズ遷移制御がOrchestratorに集中する状態を技術的に支援できる。

### NFR-2（拡張性）への対応

今回の実装はすべてのフェーズのsubagentTemplateに個別に禁止指示テキストを追記するアプローチである。この方法は最もシンプルであり、既存のコード構造を変更せずに目的を達成できる。

将来的に新しいフェーズがdefinitions.tsに追加される場合の対策として、buildPrompt関数に禁止指示の自動追加ロジックを組み込む方法も考えられるが、本タスクの範囲外とする。コードレビュー時のチェック事項として「新規フェーズのsubagentTemplateに禁止指示セクションが含まれているか」を確認するルールをdocs_updateフェーズでCLAUDE.mdに追記することを推奨する。

### NFR-3（視認性）への対応

禁止指示セクションはsubagentTemplateの末尾（出力要件を示す「## 出力」セクションの後）に配置する。ただし、出力セクションが存在しないフェーズ（research・implementation等）ではテキストの最末尾に追加する。星マーク（★）入りのヘッダー「## ★ワークフロー制御ツール禁止★」により視覚的な注意喚起を確保する。

### NFR-4（影響範囲最小化）への対応

変更対象はdefinitions.tsのsubagentTemplateプロパティのみであり、フェーズ遷移ロジック・状態管理・バリデーション等のビジネスロジックには一切触れない。
既存の4フェーズ（test_impl・testing・regression_test・docs_update）のテンプレートはすでに禁止指示が含まれているため変更しない。これにより既存フェーズのsubagentの動作に影響を与えるリスクをゼロにする。
編集操作はすべて各フェーズのsubagentTemplate文字列末尾への追記のみとし、文字列の既存内容を書き換えたり削除したりする操作は一切行わない。
ビルド後のテスト実行（945件以上のパス）により、本変更が既存テストに影響を与えていないことを定量的に確認できる体制を整える。
この最小変更アプローチにより、予期しない副作用のリスクを抑制しながら、全フェーズへの禁止指示追加という目的を達成する。

---

## 受入条件の対応状況

本仕様書は以下の受入条件に対応する実装計画を含んでいる。

- AC-1（全フェーズカバレッジ）: 25フェーズ全てへの禁止指示追加計画を本仕様書に記載した
- AC-2（フェーズ分類の正確性）: 4種別への分類と対応フェーズの対応表を「実装計画」セクションに記載した
- AC-3（テスト全件パス）: 実装後にテストスイート945件の全件パスを確認する手順を「変更対象ファイル」セクションに記載した
- AC-4（禁止指示テキストの長さ）: 各禁止指示テキストはコードブロック内に確定版として記載した。いずれも50文字を大幅に超える内容である
- AC-5（既存フェーズとの非干渉）: 既存4フェーズ（test_impl・testing・regression_test・docs_update）の禁止指示は変更しないことを「概要」セクションに明記した
