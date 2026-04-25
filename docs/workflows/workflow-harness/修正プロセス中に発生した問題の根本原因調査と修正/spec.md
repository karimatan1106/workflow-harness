## サマリー

- 目的: 2件の問題（CLAUDE.md厳命23番の誤記、manual_test・e2e_testテンプレートの前提条件行重複防止ガイダンス不足）に対する実装仕様を定義する。
- 評価スコープ: CLAUDE.md 1ファイルと workflow-plugin/mcp-server/src/phases/definitions.ts の manual_test・e2e_test テンプレート部分を対象とする。
- 主要な決定事項: FR-1ではCLAUDE.mdの厳命23番を「OrchestratorはsessionTokenを自身が直接呼び出す全てのMCPツールに渡す（層1）、subagentへの引き渡しはworkflow_record_test_result目的に限定する（層2）」という二層構造に書き換える。FR-2/FR-3はdefinitions.tsのテンプレート文字列への追記のみで実施し、既存のロジック変更は行わない。
- 検証状況: definitions.ts の修正後は npm run build によるコンパイル確認と npx vitest による既存テストスイートの全合格確認を必須とする。
- 次フェーズで必要な情報: CLAUDE.md の厳命23番の正確な修正後テキスト（二層構造の箇条書き）、manual_test テンプレートの追記位置（FR-1ガイダンスの直後）、e2e_test テンプレートの追記位置（FR-3角括弧禁止ガイダンスの直後）。

---

## 概要

本タスクでは以下の2種類の修正を実施する。

修正1（FR-1）はCLAUDE.mdの厳命23番に存在する誤記を修正する。
現行の「sessionTokenの使用先はworkflow_record_test_resultのみ」という記述は、OrchestratorがMCPツール（workflow_next等）を直接呼び出す際のsessionToken渡しをも禁止するように読める誤記である。
修正後の記述では、Orchestratorが直接呼び出すMCPワークフローツールへのsessionToken渡しが正しい動作であること、subagentへの引き渡しはworkflow_record_test_result目的に限定されることを明確に区別する。
この修正によりOrchestratorが workflow_complete_sub, workflow_next 等を呼び出す際に sessionToken を渡さなくなる不具合を防止できる。

修正2（FR-2/FR-3）はdefinitions.tsのmanual_testおよびe2e_testのsubagentTemplateに前提条件行の重複防止ガイダンスを追加する。
複数のテストシナリオが同じ前提条件テキストを3件以上持つ場合にバリデーション失敗が発生するため、TC番号付加またはシナリオ固有状態の明示による一意化方法を具体例とともに提供する。

---

## 実装計画

### 実装順序

1. FR-1: CLAUDE.md厳命23番の修正（Markdownのみ、影響範囲が最小）
2. FR-2: manual_testテンプレートへのガイダンス追加（workflow-plugin/mcp-server/src/phases/definitions.tsへの追記）
3. FR-3: e2e_testテンプレートへのガイダンス追加（FR-2と同時並行で実施可能）
4. ビルド確認: npm run buildでコンパイルエラーがないことを確認
5. テスト実行: 既存テストスイートで全合格を確認

### FR-1: CLAUDE.md厳命23番の修正仕様

修正対象の行はCLAUDE.md内の厳命23番末尾に存在する1行である。

現行テキスト:
「    - sessionTokenの取得先は `workflow_status` のみ、使用先は `workflow_record_test_result` のみに限定すること」

修正後テキスト（二層構造に書き換える）:
「    - sessionTokenの使用ルール（二層構造）:
      - 層1（Orchestratorによる直接呼び出し）: OrchestratorはsessionTokenを所持している場合、自身が直接呼び出す全てのMCPワークフローツールの引数として渡すこと。対象ツール例: workflow_next, workflow_complete_sub, workflow_approve, workflow_set_scope, workflow_back, workflow_record_feedback, workflow_reset
      - 層2（subagentへの引き渡し）: subagentへsessionTokenを引き渡してよいのは、そのsubagentが workflow_record_test_result を呼び出す目的（testing・regression_testフェーズの結果記録）に限定すること
      - 取得先: sessionTokenは `workflow_status` を taskId 指定で呼び出すことで再取得可能（全タスク一覧モードではsessionTokenが返されないためtaskId指定が必須）」

### FR-2: manual_testテンプレートへの追記仕様

追記位置: 既存の「## 実行日時・環境情報行の一意化（FR-1: 重複行防止）」セクションの直後、「## ★ 総合評価セクションの記述指針（FR-11）」セクションの直前。

追記するガイダンスセクション名: 「## 前提条件行の一意化（FR-22: 重複行防止）」

追記内容の要点（実際の追記テキストは変更対象ファイルセクションに記載）:
- 複数のTCで前提条件が共通する場合に行が3件以上完全一致してバリデーション失敗するリスクを説明する
- TC番号を行末に付加する方法を具体例で示す（「前提条件A（TC-1）」「前提条件A（TC-2）」のように末尾でTC番号で一意化）
- 前提条件の詳細度を変えてシナリオごとの状態差異を添える方法を例示する
- 操作手順の各ステップが複数シナリオで共通になる場合も同様の一意化が必要であることを明記する

### FR-3: e2e_testテンプレートへの追記仕様

追記位置: 既存の「## テスト文書固有の角括弧禁止パターン（FR-3: e2e_test特化ガイダンス）」セクションの直後、「## 総合評価セクションの記述指針（FR-C2）」セクションの直前。

追記するガイダンスセクション名: 「## 前提条件行の一意化（FR-23: 重複行防止）」

追記内容の要点（FR-2との対称性を保ちつつE2E文脈に合わせた例示を使用）:
- E2Eテストに特有の共通前提条件（ブラウザ起動状態・アプリ起動確認等）が3件以上繰り返される場合のリスクを説明する
- シナリオ番号（SC-1等）を行末に付加する方法を具体例で示す
- ブラウザ種別・ヘッドレス有無等のE2E固有の状態差異を用いた例示を含める
- ブラウザ起動コマンドやURL指定ステップが複数シナリオで共通になる場合の一意化方法を明記する

---

## 変更対象ファイル

### ファイル1: CLAUDE.md

**パス**: `CLAUDE.md`（プロジェクトルート直下、フォワードスラッシュ参照: `./CLAUDE.md`）

**変更種別**: 厳命23番の1行削除と複数行への置き換え

**変更前テキスト（厳命23番の末尾1行）**:

```
    - sessionTokenの取得先は `workflow_status` のみ、使用先は `workflow_record_test_result` のみに限定すること
```

**変更後テキスト（同箇所を二層構造に書き換える）**:

```
    - sessionTokenの使用ルール（二層構造）:
      - 層1（Orchestratorによる直接呼び出し）: OrchestratorはsessionTokenを所持している場合、自身が直接呼び出す全てのMCPワークフローツールの引数として渡すこと。対象ツール例: workflow_next, workflow_complete_sub, workflow_approve, workflow_set_scope, workflow_back, workflow_record_feedback, workflow_reset
      - 層2（subagentへの引き渡し）: subagentへsessionTokenを引き渡してよいのは、そのsubagentが workflow_record_test_result を呼び出す目的（testing・regression_testフェーズの結果記録）に限定すること
      - 取得先: sessionTokenは `workflow_status` を taskId 指定で呼び出すことで再取得可能（全タスク一覧モードではsessionTokenが返されないためtaskId指定が必須）
```

**変更注意事項**:
- 厳命23番の本文は728行目を含む複数行で構成されている。728行目のみを変更すること。
- 他の厳命条項（22番以前・24番以降）には一切変更を加えないこと。

### ファイル2: definitions.ts

**パス**: `workflow-plugin/mcp-server/src/phases/definitions.ts`

**変更種別A（FR-2）**: manual_testのsubagentTemplateに追記

**追記位置の特定方法**: subagentTemplateの文字列内で以下の文字列を検索し、その直後に追記する。

```
MT-4 実行環境: Windows 11, Node.js v20.11.0\n上記のように全シナリオで実行環境が同一である場合も、シナリオ番号（MT-N）または確認対象名を行末に付加することで重複行エラーを回避できる。\n
```

**追記するテキスト（シングルクォート文字列内の\nエスケープ込みで記述する）**:

```
\n## 前提条件行の一意化（FR-22: 重複行防止）\n複数のテストシナリオ（TC-1, TC-2...）で前提条件テキストが同一の場合、完全一致する行が3件以上出現するとartifact-validatorが重複行エラーを返す。前提条件の文字列が50文字を超える場合は特に注意が必要である。\n- 問題のある記述パターン: 「- 前提条件: MCPサーバーが起動していること」をTC-1・TC-2・TC-3でそれぞれ記述する（3件以上の同一行でエラー）\n- 推奨パターン1（TC番号付加）: 「- TC-1の前提条件: MCPサーバーが起動していること（正常起動状態）」のようにTC番号と状態の詳細を付加する\n- 推奨パターン2（状態差異の明示）: 「- TC-2の前提条件: MCPサーバーが起動していること（前回テストからの継続起動状態）」のようにシナリオ固有の状態差異を添える\n操作手順の各ステップが複数シナリオで共通になる場合も同様に一意化が必要である。各ステップ行の先頭にTC番号または操作の目的を付加することで重複行エラーを回避できる。\n
```

**変更種別B（FR-3）**: e2e_testのsubagentTemplateに追記

**追記位置の特定方法**: subagentTemplateの文字列内で以下の文字列を検索し、その直後に追記する。

```
辞書のキー名を参照する場合も同様に、`[#xxx#]` 形式のプレースホルダーでなければコードフェンス外での角括弧記述は検出対象とならない。\n
```

**追記するテキスト（シングルクォート文字列内の\nエスケープ込みで記述する）**:

```
\n## 前提条件行の一意化（FR-23: 重複行防止）\nE2Eテストでは、複数のシナリオ（SC-1, SC-2...）でブラウザ起動状態・アプリ起動確認等の共通前提条件を記述することが多く、完全一致する行が3件以上出現するとartifact-validatorが重複行エラーを返す。前提条件の文字列が50文字を超える場合は特に注意が必要である。\n- 問題のある記述パターン: 「- 前提条件: ブラウザが起動していること」をSC-1・SC-2・SC-3でそれぞれ記述する（3件以上の同一行でエラー）\n- 推奨パターン1（シナリオ番号付加）: 「- SC-1の前提条件: ブラウザが起動していること（Chromiumヘッドレスモード）」のようにシナリオ番号とブラウザ設定の詳細を付加する\n- 推奨パターン2（状態差異の明示）: 「- SC-2の前提条件: ブラウザが起動していること（前シナリオの認証セッション引き継ぎ状態）」のようにE2E固有の状態差異を添える\nブラウザ起動コマンドやURLナビゲーションステップが複数シナリオで共通になる場合も同様に一意化が必要である。各ステップ行の先頭にシナリオ番号または操作対象の画面名を付加することで重複行エラーを回避できる。\n
```

---

## 実装注意事項

definitions.tsのテンプレート文字列はシングルクォートで区切られており、テンプレート内の改行は `\n` でエスケープする必要がある。
テンプレート内にシングルクォートが含まれる場合は `\'` でエスケープが必要であり、追記するテキスト内にシングルクォートが含まれないことを確認済みである。
ビルド確認は `workflow-plugin/mcp-server/src/phases/definitions.ts` が属する `workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行し、コンパイルエラーがない状態を確認してから次フェーズへ進むこと。
テスト実行は同ディレクトリで `npx vitest` を実行し、既存テストスイートの全合格を確認すること。
MCPサーバーは definitions.ts を起動時にロードしてメモリキャッシュするため、ビルド完了後にMCPサーバーを再起動することで変更が反映される。
CLAUDE.mdの修正は厳命23番の末尾1行のみが対象であり、他のセクションや厳命条項には変更を加えないこと。
