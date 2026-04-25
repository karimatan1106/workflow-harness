# researchフェーズ成果物

## サマリー

- 目的: ラウンド3で発生した2つの問題の根本原因を特定し、修正方針を確定する
- 主要な決定事項: 問題1はperformance_testテンプレートへの「ボトルネック分析」セクション行数ガイダンス追加、問題2はbash-whitelist.jsの`getWhitelistForPhase`関数への`parallel_verification`ケース追加で解決できる
- 次フェーズで必要な情報: 修正対象ファイルは`workflow-plugin/mcp-server/src/phases/definitions.ts`と`workflow-plugin/hooks/bash-whitelist.js`の2ファイル。コアモジュール変更のためMCPサーバー再起動が必要。

---

## 問題1: performance_testの「ボトルネック分析」セクション実質行数不足

### 根本原因の特定

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts` の914行目に定義された`performance_test`サブフェーズの`subagentTemplate`を調査した結果、テンプレート内に「## サマリー」セクション向けの5行以上ガイダンスは追加されているが、「## ボトルネック分析」および「## パフォーマンス計測結果」の両必須セクションに対するガイダンスが一切存在しないことが確認された。

具体的には、現在のテンプレートには以下のセクション向け指示のみが存在する。

- 「## サマリー」セクション: 計測対象・計測条件・計測結果・合否判定根拠・総合評価の5項目についてOK例とNG例を付記したガイダンスあり
- 「## パフォーマンス計測結果」セクション: ガイダンス一切なし
- 「## ボトルネック分析」セクション: ガイダンス一切なし

サブエージェントはガイダンスがないセクションに対して最小限の行数しか記述しない傾向があり、「ボトルネック分析」セクションで実質行数が4行に留まりバリデーション失敗（5行未満）を引き起こした。

### ラウンド3での対処が不完全だった理由

ラウンド3では「## サマリー」セクションのガイダンスのみを修正対象としたため、必須セクションとして要求される「## パフォーマンス計測結果」と「## ボトルネック分析」に対するガイダンスが追加されなかった。artifact-validatorは各セクション（`##`見出し）ごとに最低5行の実質行を要求するが、サブエージェントはガイダンスがないセクションを短く済ませる傾向があるため、再発する構造的問題だった。

### 他の並列検証フェーズとの比較

`manual_test`のテンプレート（890行目）: 「## テストシナリオ」「## テスト結果」向けのガイダンスは明示なし。ただし重複行回避のNGとOK例が詳細に記載されており、行数が自然に多くなる誘導がある。

`security_scan`のテンプレート（902行目）: 「## 脆弱性スキャン結果」「## 検出された問題」向けのガイダンスは明示なし。ただしFR番号を含む具体的なOK例の記述が行数拡充を促進する構造になっている。

`e2e_test`のテンプレート（926行目）: ガイダンスが最も少なく、「作業内容」と「出力」の2行のみ。このフェーズでも同様の問題が潜在している可能性がある。

### 修正方針

`definitions.ts`の`performance_test.subagentTemplate`に「## パフォーマンス計測結果」と「## ボトルネック分析」の両セクションに向けた行数ガイダンスを追加する。サマリーセクション向けと同様に、各セクションで必要な項目をOK例とともに5項目以上列挙することで、サブエージェントが十分な行数を記述することを誘導する。

---

## 問題2: parallel_verificationフェーズでtestingカテゴリBashコマンドがブロック

### 根本原因の特定

`C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js` の213行目に定義された`getWhitelistForPhase`関数の制御フローを詳細に調査した結果、以下の問題が確認された。

`getWhitelistForPhase`関数は6つのフェーズグループを定義している。

- `readonlyPhases`: `research`, `requirements`, `threat_modeling`, `planning`, `state_machine`, `flowchart`, `ui_design`, `test_design`, `design_review`, `code_review`, `manual_test`
- `docsUpdatePhases`: `docs_update`
- `verificationPhases`: `security_scan`, `performance_test`, `e2e_test`, `ci_verification`（サブフェーズ名）
- `testingPhases`: `testing`, `regression_test`
- `implementationPhases`: `test_impl`, `implementation`, `refactoring`
- `deployPhases`: `deploy`
- `gitPhases`: `commit`, `push`
- `else`ブランチ: 上記いずれにも該当しない場合は`readonly`のみを返す

ここで問題が発生する仕組みは以下の通りである。

`phase-edit-guard.js`の1437行目で、Bashコマンドのホワイトリストチェックに使用するフェーズ名を`workflowState.phase`から取得している。`workflow-state.json`の`phase`フィールドには親フェーズ名`parallel_verification`が格納されており、サブフェーズ名（`security_scan`, `performance_test`, `e2e_test`）は`subPhases`フィールドの状態として別途管理されている。

その結果、`checkBashWhitelist(command, 'parallel_verification')`が呼ばれる。`getWhitelistForPhase('parallel_verification')`は上記6グループのいずれにも一致しないため`else`ブランチが実行され、`BASH_WHITELIST.readonly`のみが返される。`npm test`や`npx vitest`などのtestingカテゴリコマンドがホワイトリストに含まれず、ブロックされる。

### 設計上の不整合

`definitions.ts`（907行目）では`performance_test`サブフェーズの`allowedBashCategories`として`['readonly', 'testing']`が定義されており、CLAUDE.mdにも同様の記述がある。しかし`bash-whitelist.js`はMCPサーバーとは独立したフックとして動作しており、`definitions.ts`の設定を参照していない。フック側の実装でサブフェーズ名へのマッピングが欠落しているため、親フェーズ名`parallel_verification`が渡された際に正しいホワイトリストを返せない。

### 修正方針

`bash-whitelist.js`の`getWhitelistForPhase`関数に`parallel_verification`フェーズ用のケースを追加する。修正方法は2通り考えられる。

方法A: `parallel_verification`を`verificationPhases`配列に追加する（`verificationPhases`が`readonly + testing`を返すため整合する）

方法B: `parallel_verification`用の専用ケースを追加し、`readonly + testing + gh`を返す（サブフェーズ`manual_test`はreadonlyのみだが、並列フェーズとして統合した場合testingを含めて問題ない）

方法Aが最小変更かつリスクが低い。`verificationPhases`配列に`'parallel_verification'`を追加するだけで、既存の`readonly + testing + gh`を返すロジックを共有できる。

---

## 調査した主要ファイル

- `C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js`: `getWhitelistForPhase`関数（213-254行目）が問題2の根本原因箇所
- `C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`: `parallel_verification.subPhases.performance_test.subagentTemplate`（904-914行目）が問題1の根本原因箇所
- `C:\ツール\Workflow\workflow-plugin\hooks\phase-edit-guard.js`: 1498行目で`checkBashWhitelist(command, phase)`を呼び出す際、`phase`に親フェーズ名`parallel_verification`が渡されることを確認

---

## 変更規模の評価

### 問題1の修正規模

修正対象: `definitions.ts`の`performance_test.subagentTemplate`（1行のテンプレート文字列）
変更内容: テンプレート文字列内に「## パフォーマンス計測結果」と「## ボトルネック分析」セクション向けのガイダンスを追加
影響範囲: `performance_test`サブフェーズのsubagent起動プロンプトのみ
リスク: `definitions.ts`はコアモジュールのため、変更後にMCPサーバーの再起動が必要

### 問題2の修正規模

修正対象: `bash-whitelist.js`の`getWhitelistForPhase`関数内の`verificationPhases`配列
変更内容: 配列に`'parallel_verification'`を追加（1行の文字列追加）
影響範囲: `parallel_verification`フェーズ実行時のBashコマンドホワイトリスト判定
リスク: `bash-whitelist.js`はフックとして動作しており、変更はMCPサーバー再起動不要（フックはリクエストごとに読み込まれる）。ただし既存テストへの影響確認が必要

---

## 次フェーズへの引き継ぎ事項

requirements/planningフェーズでは以下の点を明確にすること。

1. `e2e_test`の`subagentTemplate`も同様にガイダンスが薄い（問題1と同根の潜在問題）。今回のスコープに含めるか判断が必要
2. `bash-whitelist.js`の変更に対してユニットテスト（`bash-whitelist.test.js`）への追加テストケースが必要かどうか確認が必要
3. `definitions.ts`の変更はMCPサーバー再起動が必須であり、コミット前に再起動手順を実施すること
