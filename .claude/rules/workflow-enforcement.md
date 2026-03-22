# Workflow Enforcement

- コード変更タスクは即座に `/workflow-harness start` で開始。事前調査禁止。純粋な質問のみ直接回答可。
- Auto-Start: 「〜して」（変更依頼）→ 自動起動。「〜か？」（質問）→ 直接回答。
- キーワード検出: プロンプト内の任意の位置に「ハーネス」が含まれる場合、他の一切の処理より先に harness_start を実行する。Explore/調査を先行させない。
