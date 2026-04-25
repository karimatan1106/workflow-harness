## サマリー

- 目的: 2件の問題（CLAUDE.md厳命23番の誤記、manual_test・e2e_testテンプレートの前提条件行重複防止ガイダンス不足）に対して、修正すべき要件を定義する
- 主要な決定事項:
  - 問題1: CLAUDE.md厳命23番を「Orchestratorは所持しているsessionTokenを自身が直接呼び出す全てのMCPワークフローツールに渡す。subagentへ渡す場合はworkflow_record_test_resultの呼び出し用途に限定する」という二層構造の記述に書き換える
  - 問題2: manual_testテンプレートに前提条件行の一意化ガイダンスを追加し、e2e_testテンプレートにも同様のガイダンスを追加する
- 次フェーズで必要な情報: CLAUDE.md の厳命23番の正確な行番号、definitions.ts の manual_test テンプレートと e2e_test テンプレートの正確な位置情報

---

## 機能要件

### FR-1: CLAUDE.md厳命23番の記述修正

**背景と根拠**:
research.md の調査により、sessionToken を検証する verifySessionToken を呼び出す MCPツールは11種類（approve, back, complete-sub, create-subtask, link-tasks, next, record-feedback, record-test-result, reset, set-scope）が存在することが確認された。
現在の記述「sessionTokenの使用先は workflow_record_test_result のみ」はOrchestratorが直接呼び出すMCPツールへのsessionToken渡しをも禁止するように読めるため誤解を招く。

**修正対象ファイル**:
`C:\ツール\Workflow\CLAUDE.md` の厳命23番（セッション再開後のsessionToken取得に関する項目）

**修正内容の要件**:
修正後の記述は以下の2点を明確に区別して記述しなければならない。

1. Orchestratorが直接呼び出すMCPワークフローツールへのsessionToken渡しは、所持している場合には必須であること。
   対象ツールの例として workflow_next, workflow_complete_sub, workflow_approve, workflow_set_scope, workflow_back, workflow_record_feedback, workflow_reset を列挙すること。

2. subagentへsessionTokenを引き渡してよいのは、そのsubagentが workflow_record_test_result を呼び出す目的（testing・regression_testフェーズの結果記録）に限定されること。

**受け入れ基準**:
- 修正後の記述を読んだOrchestratorが、workflow_complete_sub 等へsessionTokenを渡すことを正しい動作と理解できること
- 修正後の記述を読んだOrchestratorが、任意のsubagentへsessionTokenを渡してよいと誤解しないこと
- 「使用先はworkflow_record_test_resultのみ」という誤記フレーズが成果物から削除されていること

---

### FR-2: manual_testテンプレートへの前提条件行一意化ガイダンスの追加

**背景と根拠**:
バリデーターの重複行検出ルールでは、「- **前提条件**: MCPサーバーが起動していること」のようにコロン後にコンテンツが続く行は除外対象とならず、同一テキストが3回以上出現するとエラーになる。
複数のテストシナリオが同じシステム状態を前提とする場合（例: TC-1からTC-4まで全て同じ前提条件を持つ場合）、subagentが各シナリオに同一の前提条件テキストを記述するとバリデーション失敗する。
既存の FR-1 ガイダンス（実行日時・実行環境行の一意化）はこのパターンをカバーしていない。

**修正対象ファイル**:
`workflow-plugin/mcp-server/src/phases/definitions.ts` の manual_test フェーズのsubagentTemplate

**修正内容の要件**:
manual_testテンプレートのテストシナリオ記述ガイダンスセクションに、以下の内容を追加すること。

- 複数シナリオで前提条件が共通する場合に、前提条件行が重複することを防ぐための具体的な書き方を示すこと
- シナリオ番号（TC-1等）を前提条件行の末尾または先頭に付与する方法を例示すること
- 前提条件の詳細度を変えてシナリオごとの違いを記述する方法を例示すること（例: 「MCPサーバーが起動済みであること（TC-1向け: 正常起動状態）」と「MCPサーバーが起動済みであること（TC-2向け: 高負荷状態）」のように具体的な状態の違いを添える）
- 操作手順の各ステップが複数シナリオで共通になる場合も同様に一意化が必要であることを明記すること

**受け入れ基準**:
- ガイダンス追加後にテンプレートで生成したドキュメントにおいて、TC-3件以上で同一の前提条件テキストが出現した場合にsubagentが自律的に修正する材料が提供されていること
- 既存の FR-1 ガイダンス（実行日時行）との重複・矛盾がないこと

---

### FR-3: e2e_testテンプレートへの前提条件行一意化ガイダンスの追加

**背景と根拠**:
research.md の横断調査により、e2e_test も manual_test と同様に複数シナリオで同一の前提条件テキストを記述しやすい構造であることが確認された。
E2Eテストは自動化シナリオが多く、システム起動状態やネットワーク接続状態といった共通前提条件が多くのシナリオに共有されるため、重複発生リスクが manual_test と同程度に高い。
既存の e2e_test テンプレートのガイダンスはシナリオ名称の一意化をカバーしているが、前提条件行の一意化は明示されていない。

**修正対象ファイル**:
`workflow-plugin/mcp-server/src/phases/definitions.ts` の e2e_test フェーズのsubagentTemplate

**修正内容の要件**:
e2e_testテンプレートのテストシナリオ記述ガイダンスセクションに、FR-2と同等の前提条件行一意化ガイダンスを追加すること。
なお、e2e_testはE2Eテスト特有の文脈（ブラウザ起動・アプリ起動状態等）に合わせた例示を用いること。

**受け入れ基準**:
- FR-2の受け入れ基準と同等の条件を満たすこと
- E2E固有の前提条件例（ブラウザ起動状態・テスト対象アプリの起動確認等）を使った例示が含まれていること

---

## 非機能要件

### NF-1: 既存テストスイートへの影響がないこと

CLAUDE.md の修正はMarkdownドキュメントのみへの変更であり、TypeScriptコードのテストに影響を与えない。
definitions.ts の修正はテンプレート文字列の追記のみであり、既存のフェーズ定義・状態管理ロジックに変更を加えないこと。
修正後に `workflow-plugin/mcp-server` の既存テストスイートを実行した場合、全テストが合格状態を維持していること。

### NF-2: 成果物品質要件への適合

追加するガイダンステキストはartifact-validatorの禁止パターン検出に触れないこと。
禁止語（英語4語の略語グループ・日本語8語の検討・予定系グループ）をテンプレートテキストに含めないこと。
追加するテキストの角括弧プレースホルダー（`[#xxx#]`形式）は使用しないこと。

### NF-3: ガイダンスの一貫性

FR-2（manual_test）とFR-3（e2e_test）で追加するガイダンスは、記述スタイル・方針・例示のレベル感が一致していること。
これにより、subagentが一方のフェーズでは正しく一意化できて他方では失敗する、という非対称な状況を防ぐ。

### NF-4: definitions.tsビルド互換性

definitions.tsはTypeScriptファイルであり、修正後に `npm run build` を実行してコンパイルエラーが発生しないこと。
テンプレートリテラル内のバックティック・ドル記号のエスケープが正しく処理されていること。

---

## 優先順位と実装順序

以下の順序で実装すること。

1. FR-1（CLAUDE.md厳命23番の修正）: ドキュメント修正のみで影響範囲が狭く、先行して実施可能
2. FR-2（manual_testテンプレート修正）: definitions.tsへの追記で影響範囲が限定的
3. FR-3（e2e_testテンプレート修正）: FR-2と同時並行実施が可能

修正後は `npm run build` でビルドを確認し、続いて既存テストスイートを実行してリグレッションがないことを確認すること。
