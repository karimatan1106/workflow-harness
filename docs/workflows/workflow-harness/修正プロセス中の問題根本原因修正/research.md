## サマリー

- 目的: 前タスク（parallel_verification-subagentTemplate品質問題修正）実施中に発生した3つの問題の根本原因を調査し、definitions.ts および CLAUDE.md の記述不足箇所を特定する
- 主要な決定事項: 問題1は code_review テンプレートに禁止語転記防止の専用注意書きが欠如していること、問題2は performance_test テンプレートの「ボトルネック分析」セクションに5行要件のガイダンスが存在しており過去に追加済みであること（再発の原因は別にある）、問題3は CLAUDE.md のルール20がベースライン記録をtestingフェーズ標準と明記しているにもかかわらず definitions.ts の research フェーズチェックリストに workflow_capture_baseline の呼び出しが記載されており矛盾していること
- 次フェーズで必要な情報: 問題1の修正対象は definitions.ts の code_review subagentTemplate（行862前後）への禁止語転記防止セクションの追記、問題2については definitions.ts の performance_test テンプレートのボトルネック分析ガイダンスが既に存在するため再発原因の詳細確認が必要、問題3の修正対象は CLAUDE.md のルール20の文言または definitions.ts の research チェックリスト行612

---

## 調査結果

### 問題1: code_review サブエージェントが禁止語を本文に列挙した件

**調査対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts` の code_review subagentTemplate（行862）

definitions.ts の code_review サブフェーズ定義を確認した。
subagentTemplate は行862の長い文字列として定義されており、設計整合性・コード品質・セキュリティ・パフォーマンス・ユーザー意図との整合性の各セクションについて詳細な行数ガイダンスを含んでいる。
テンプレートの末尾近くには「評価結論フレーズの重複回避（特化ガイダンス）」セクションが存在している。
しかし、「禁止語転記防止」に関する専用の注意書きは code_review テンプレート内に存在しない。

比較として manual_test・security_scan・performance_test の各テンプレートを確認したところ、これらには「禁止語転記防止（重要）」セクションが明示的に含まれている。
該当セクションの内容は「成果物本文に禁止語を直接記述すると成果物全体がバリデーション失敗になる」という警告と、「間接参照（バリデーターが検出するパターン、該当する語句等）を使用すること」という指示である。

code_review テンプレートには「禁止語チェック」として禁止語の実体リストを成果物に列挙することを明示的に禁止する注意書きが存在しない。
このため、前タスクの code_review サブエージェントが「禁止語チェック」項目として禁止語8語を直接成果物本文に書いてしまい、バリデーション失敗が発生した。

**根本原因の特定:** code_review subagentTemplate に parallel_verification の各サブフェーズと同等の禁止語転記防止ガイダンスが欠如している。

---

### 問題2: performance_test ボトルネック分析セクションの行数不足

**調査対象ファイル:** `workflow-plugin/mcp-server/src/phases/definitions.ts` の performance_test subagentTemplate（行930）

performance_test の subagentTemplate を確認した。
「ボトルネック分析」セクションについては「## ボトルネック分析セクションの行数ガイダンス」セクションが存在し、5つの必須項目（特定されたボトルネックの名称・原因分析の説明・影響範囲の評価・改善提案の具体案・優先度の判定）が明記されている。
また「ボトルネットが検出されない場合の記述方法」として、1行のみでなく5項目それぞれについて「検出なし・根拠○○」の形式で記述することも明示されている。

前タスクでの失敗事象は「4つの ### サブセクションにそれぞれ1行の長い段落 = 実質4行」というものであった。
このパターンを確認すると、テンプレートには「サブヘッダー多用時のセクション密度確保」に関するガイダンスが security_scan テンプレートには含まれているが、performance_test テンプレートには同等の注意書きが存在しない。

security_scan テンプレートの「## サブヘッダー多用時のセクション密度確保（FR-2: 実質行数不足防止）」セクションを参照すると、「セクション内に複数のサブヘッダーを配置する場合は、親セクション全体で5行以上の実質行が確保されるように各サブヘッダー直下に十分なコンテンツを記述すること」という指示が存在する。
この注意書きが performance_test テンプレートには存在しないため、サブエージェントがサブヘッダーを多用した際に実質行数不足になるリスクが残っている。

**根本原因の特定:** performance_test テンプレートの「ボトルネック分析」セクションへの行数ガイダンスは存在するが、「サブヘッダーを多用した場合の密度不足リスク」に関するガイダンスが security_scan テンプレートと比較して欠如している。

---

### 問題3: Orchestratorが regression_test フェーズで baseline capture を呼んだ件

**調査対象1:** `CLAUDE.md` のルール20

CLAUDE.md のルール20（既存テストのベースライン記録義務）を確認した。
内容は「testingフェーズまでに既存テストスイートを実行し、workflow_capture_baselineで結果を記録すること」と「researchフェーズはphase-edit-guardによりtestingカテゴリ（npm test等）がブロックされるため、テスト実行はtestingフェーズで行うことを標準とする」という記述である。

**調査対象2:** `workflow-plugin/mcp-server/src/phases/definitions.ts` の research フェーズチェックリスト（行612）

definitions.ts の research フェーズチェックリストに「既存テストスイートを実行してベースラインを記録する（workflow_capture_baseline）」という項目が含まれている。

**調査対象3:** `workflow-plugin/mcp-server/src/tools/test-tracking.ts` の workflowCaptureBaseline 関数（行162-168）

workflowCaptureBaseline の実装を確認した。
行163に `const baselineAllowedPhases = ['research', 'testing'];` という定義があり、research フェーズと testing フェーズの両方でベースライン記録が許可されている。
regression_test フェーズは許可リストに含まれておらず、regression_test フェーズから呼ばれた場合は「ベースライン記録はresearch/testingフェーズでのみ可能です」というエラーを返す。

**根本原因の特定:** CLAUDE.md のルール20は「testingフェーズを標準」と明記しているが、definitions.ts の research チェックリストには「researchフェーズでベースラインを記録する」と記載されており、両者の記述が矛盾している。Orchestrator が research チェックリストの記述に従って regression_test フェーズで baseline capture を試みた可能性がある。ただし regression_test フェーズでの呼び出し自体は test-tracking.ts のバリデーションでエラーになるため、問題の発生メカニズムはフェーズの誤認（Orchestrator が regression_test を testing と誤解した）か、testing フェーズでのベースライン記録タイミングの混乱であると考えられる。

---

## 既存実装の分析

### code_review テンプレートの構成と欠落箇所

code_review の subagentTemplate は行862に定義されており、以下のセクションが存在する。
「## サマリーセクションの行数ガイダンス」「## 設計-実装整合性セクションの行数ガイダンス」「## コード品質セクションの行数ガイダンス」「## セキュリティセクションの行数ガイダンス」「## パフォーマンスセクションの行数ガイダンス」「## 評価結論フレーズの重複回避（特化ガイダンス）」「## ユーザー意図との整合性セクションの行数ガイダンス」が含まれている。
しかし、manual_test・security_scan・performance_test テンプレートに存在する「禁止語転記防止（重要）」に相当するセクションが存在しない。
これが問題1の直接的な欠落箇所であり、追加が必要なガイダンスである。

### performance_test テンプレートの構成と欠落箇所

performance_test の subagentTemplate（行930）には「ボトルネック分析セクションの行数ガイダンス」が存在し、5行要件は記載済みである。
security_scan テンプレートに存在する「サブヘッダー多用時のセクション密度確保（FR-2）」に相当するセクションが performance_test テンプレートに存在しないことが差異として確認された。
「ボトルネック分析」セクションでサブヘッダーを3つ使用し各直下に1行ずつ書くと実質3行となりバリデーション失敗するリスクがあり、この点の明示的なガイダンスが performance_test テンプレートに欠けている。

### ベースライン記録に関する記述の矛盾

definitions.ts の research チェックリスト（行612）には「既存テストスイートを実行してベースラインを記録する（workflow_capture_baseline）」と記載されている。
CLAUDE.md のルール20には「testingフェーズを標準とする」と記載されており、research フェーズへのベースライン記録は「researchフェーズはphase-edit-guardによりtestingカテゴリがブロックされるため」という理由で標準外とされている。
test-tracking.ts の実装では research フェーズでのベースライン記録が技術的には許可されているが、実際には research フェーズの Bash 許可カテゴリが `readonly` のみであるため npm test 等のテスト実行コマンドが使えず、ベースライン数値の取得手段がない。
これら3つの記述が整合していないことが問題3の根本原因である。

### 修正方針の整理

修正が必要な箇所は以下の3点に集約される。
第1の修正は definitions.ts の code_review subagentTemplate への禁止語転記防止ガイダンスの追加であり、manual_test・security_scan テンプレートの「禁止語転記防止（重要）」セクションを参考に同等の内容を追加する。
第2の修正は definitions.ts の performance_test subagentTemplate への「ボトルネック分析」セクションでのサブヘッダー多用時の密度確保に関するガイダンスの追加であり、security_scan の「FR-2: サブヘッダー多用時のセクション密度確保」に相当する注意書きを追加する。
第3の修正は CLAUDE.md のルール20またはdefinitions.ts の research チェックリスト行612の記述を整合させることであり、research フェーズでのベースライン記録がBlockされる現状に合わせて definitions.ts のチェックリストから該当行を削除するか、testing フェーズで呼ぶよう表現を変更する。
