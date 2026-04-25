## サマリー

- 目的: 2件の問題（CLAUDE.md厳命23番の誤記、FR-Aガイダンスの範囲不足）の根本原因を調査し、修正方針を特定する
- 調査スコープ: CLAUDE.md厳命23番の記述内容、definitions.tsのmanual_testテンプレート全文、complete-sub.ts・next.ts・approve.tsなど全ツールファイルのsessionToken要否
- 主要な決定事項: (1) CLAUDE.md厳命23番は「workflow_record_test_resultのみ」と記載しているが実際には11ツールがverifySessionTokenを呼び出しており誤記である。(2) manual_testテンプレートのFR-1/FR-11ガイダンスは実行日時・環境行の重複回避のみをカバーしており、前提条件行を含むテストシナリオセクション内の他のラベル行の重複回避ガイダンスが欠落している
- 次フェーズで必要な情報: 問題1に対しては「sessionTokenが必要な正確なMCPツールリスト（11ツール）」、問題2に対しては「前提条件行の重複回避のガイダンスをmanual_testテンプレートに追加する方針と対象セクション」、横断調査に対しては「security_scan・performance_test・e2e_testでも同様のガイダンス追加が必要か否か」

---

## 問題1: CLAUDE.md厳命23番の誤記

### 現状の記述確認

CLAUDE.md の厳命23番（728行目）には以下の記述が存在する。

> sessionTokenの取得先は `workflow_status` のみ、使用先は `workflow_record_test_result` のみに限定すること

この記述は「使用先は workflow_record_test_result のみ」と断言しており、他のMCPツールへのsessionToken渡しを一切禁止するように読める。

### MCPサーバー側の実際の実装

全ツールファイルをスキャンした結果、verifySessionToken を呼び出しているファイルは以下の11ツールである。

- `approve.ts`: workflowApprove が sessionToken を受け取り verifySessionToken を呼び出す
- `back.ts`: workflowBack が sessionToken を受け取り verifySessionToken を呼び出す
- `complete-sub.ts`: workflowCompleteSub が sessionToken を受け取り verifySessionToken を呼び出す
- `create-subtask.ts`: workflowCreateSubtask が sessionToken を受け取り verifySessionToken を呼び出す
- `link-tasks.ts`: workflowLinkTasks が sessionToken を受け取り verifySessionToken を呼び出す
- `next.ts`: workflowNext が sessionToken を受け取り verifySessionToken を呼び出す
- `record-feedback.ts`: workflowRecordFeedback が sessionToken を受け取り verifySessionToken を呼び出す
- `record-test-result.ts`: workflowRecordTestResult が sessionToken を受け取り verifySessionToken を呼び出す
- `reset.ts`: workflowReset が sessionToken を受け取り verifySessionToken を呼び出す
- `set-scope.ts`: workflowSetScope が sessionToken を受け取り verifySessionToken を呼び出す
- `back.ts`（再掲）: verifySessionToken を import して検証を行う

つまり、11のMCPツールがsessionTokenをオプション引数として受け取り、タスク状態にsessionTokenが設定されている場合は必ず検証を行う設計になっている。

### 誤記の根本原因

CLAUDE.md厳命23番の「使用先は workflow_record_test_result のみ」という記述は、**OrchestratorがsubagentへsessionTokenを渡す場合の制限方針**（subagentはテスト結果記録以外の目的でsessionTokenを使ってはならない）を意図していたものと推測される。しかし、この記述はそのままでは「MCPサーバー側でsessionTokenを受け付けるツールはworkflow_record_test_resultのみ」という誤った解釈を生む。

実際には、Orchestratorが直接呼び出す workflow_complete_sub・workflow_next 等はsessionTokenを渡すことが正しい動作であり、これらへのsessionToken渡しを一律禁止することはできない。

### 影響分析

前回タスクでOrchestratorが workflow_complete_sub をsessionTokenなしで呼び出してエラーになったのは、CLAUDE.md厳命23番の「使用先は workflow_record_test_result のみ」という誤記を文字通りに解釈したためである。Orchestratorが sessionToken を所持しているにもかかわらず、workflow_complete_sub への渡しを避けた結果、verifySessionToken が「sessionTokenが設定されているが引数に渡されていない」と判定してエラーを返したと考えられる。

---

## 問題2: FR-Aガイダンスの範囲不足

### manual_testテンプレートの現状確認

definitions.ts 906行目のmanual_testテンプレートを全文分析した結果、以下のガイダンスセクションが存在することを確認した。

1. 重複行回避の注意事項: 「複数のテストシナリオで同一のファイルや操作内容を記述する場合、各行の先頭にシナリオ番号や具体的な操作内容を含めて行を一意にすること」というガイダンスが存在する
2. 評価結論フレーズの重複回避（特化ガイダンス）: 判定行（「- 判定: 合格」等）の重複を防ぐガイダンスが存在する
3. 実行日時・環境情報行の一意化（FR-1）: 実行日時（「- 実行日時: 2026-02-23」等）をシナリオ番号付きにするガイダンスが存在する
4. テストシナリオセクションの行数ガイダンス: 前提条件を「前提条件の列挙（テスト実施前に満たしておくべき状態を記述する）」として1シナリオ5要素の一つに挙げているが、前提条件行の重複回避については具体的な例示がない
5. FR-11（総合評価セクション）: 5観点の記述指針が存在する

### 前提条件行の重複が起きやすい理由

テストシナリオセクションに複数シナリオを記述する場合、各シナリオが同じシステム状態を前提とすることがある。例えば「前提条件: MCPサーバーが起動していること」という行が3シナリオ以上で共通する場合、そのまま書くと重複行エラーが発生する。

バリデーターの重複検出ルールを確認すると、以下の行は除外対象になる。
- ルール7: ハイフンまたはアスタリスクのリスト記号に続く太字ラベルのみの行（`- **ラベル**:` の形式）

このため、「- **前提条件**:」のようにコロン後にコンテンツがない行は除外対象となり重複行にはならない。しかし、「- **前提条件**: MCPサーバーが起動していること」のようにコロン後にコンテンツが続く行は除外対象とならず、3シナリオ以上で同じ行を書くとエラーになる。

FR-Aは実行日時・実行環境の行（「- 実行日時: 2026-02-23」等）を対象としており、「前提条件の内容行」は明示的にカバーされていない。

### カバーできていないパターンの特定

manual_testテンプレートで現時点でカバーされていない重複発生パターンは以下の通りである。

- パターンA: テストシナリオセクション内で複数シナリオが同一の前提条件テキストを持つ場合（例: 「- **前提条件**: ワークフローが起動中であること」×3件）
- パターンB: テスト結果セクション内で複数シナリオが同一の実際の結果テキストを持つ場合（例: 「- 実際の結果: 期待通りに動作した」×3件）
- パターンC: テストシナリオセクション内で操作手順の各ステップが同一の文言になる場合（例: 「1. MCPサーバーに接続する」×3件）

---

## 問題3: 横断調査（他フェーズテンプレートの類似問題）

### security_scanテンプレートの確認

security_scanテンプレート（918行目）には重複行回避ガイダンスが存在し、評価結論フレーズの重複回避（特化ガイダンス）も含まれている。セキュリティスキャンは同一フォーマットで複数のFRや脆弱性を評価する構造を持つため、「評価結果: リスクなし」の繰り返しに関するガイダンスが実装済みである。前提条件行に相当する「スキャン前提条件」のような構造は一般的でなく、パターンAに相当する問題が発生しにくいフェーズである。

### performance_testテンプレートの確認

performance_testテンプレート（930行目）には計測日時行の一意化ガイダンス（FR-4）が存在する。また評価結論フレーズの重複回避ガイダンスも含まれている。計測対象ごとに異なる数値が記録されるため、前提条件行の繰り返しパターンは発生しにくい構造である。

### e2e_testテンプレートの確認

e2e_testテンプレート（942行目）にはシナリオ名称を行に含める重複回避ガイダンスが存在し、「前提条件の説明（テスト実施前に満たしておくべき状態を記述する）」を5要素の一つとして挙げている。manual_testと同様に、複数シナリオで同一の前提条件テキストを書きやすいパターンが存在する。E2Eテストは自動化されたシナリオが多いため前提条件の共通性が高く、manual_testと同程度の重複発生リスクがある。

### 横断調査の結論

前提条件行の重複回避ガイダンス追加が優先度高いフェーズは manual_test と e2e_test である。security_scan と performance_test は前提条件行の繰り返しパターンが発生しにくい構造のため優先度は低い。

---

## 修正方針

### 問題1: CLAUDE.md厳命23番の修正方針

現在の記述「sessionTokenの使用先は workflow_record_test_result のみ」を以下のように修正する必要がある。

OrchestratorはsessionTokenを所持している場合、自身が直接呼び出すすべてのMCPワークフローツールにsessionTokenを渡すことが正しい動作である。「subagentへsessionTokenを渡す場合は workflow_record_test_result の呼び出し用途にのみ渡す」という意図の記述に修正すべきである。

つまり、制限の主体を「Orchestrator自身がsessionTokenを使えるツール（全ツール）」と「subagentへsessionTokenを渡してよいツール（workflow_record_test_resultのみ）」に分けて記述することが必要である。

### 問題2: manual_testテンプレートの修正方針

テストシナリオセクションのガイダンスに「前提条件行の一意化」に関するガイダンスを追加する。具体的には、複数シナリオで同一の前提条件テキストを記述する場合は、シナリオIDを前置するか、前提条件の詳細を変えて各行を一意にすることを明記する。e2e_testテンプレートにも同様のガイダンスを追加する。
