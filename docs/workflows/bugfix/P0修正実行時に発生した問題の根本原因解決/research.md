## サマリー

本調査は、前回のP0修正タスク（20260217_214128）実行中に発生した複数の問題を分析し、その根本原因を特定することを目的とする。

### 目的

- manual_testサブフェーズでバリデーションが2回失敗した直接原因の特定
- CLAUDE.mdテーブルとdefinitions.tsの間に残存する乖離の全件把握
- allowedBashCategoriesの「git」カテゴリ定義欠落問題の確認
- definitions.tsがgeneral-purposeに統一された設計意図の理解

### 主要発見事項

1. CLAUDE.mdとdefinitions.tsの乖離が5フェーズ（research、build_check、testing、commit、push）に残存している
2. manual_testバリデーション失敗の直接原因は、Orchestratorがhaikuモデルを使用したことによる品質不足
3. CLAUDE.md内のBashカテゴリ定義セクションに「git」カテゴリが存在しない
4. definitions.tsの設計は全フェーズをgeneral-purposeに統一する方針であり、これが実装上の正規ソース
5. 二重構造（CLAUDE.md記載 vs definitions.ts実装）が全ての乖離問題の根本原因

### 次フェーズで必要な情報

- definitions.tsの全フェーズsubagentType・model設定の一覧（正規ソース）
- CLAUDE.mdの修正対象箇所と修正内容の具体的な案
- allowedBashCategoriesの「git」カテゴリを追加するか、commit/push記載を修正するかの判断
- workflow-plugin/CLAUDE.mdも同一修正が必要（行181, 192, 194, 200, 201）

---

## 調査結果

### 問題1: manual_testバリデーション2回失敗

前回P0修正タスク実行中、manual_testサブフェーズで成果物バリデーションが連続して2回失敗し、3回目で成功した。

**1回目の失敗内容:**
- 重複行エラー: `**状態**: ✅ 合格` という行が5回出現し、重複検出閾値（3回）を超えた
- サマリーセクションの実質行数不足: 実質行数が3行で、最低要件の5行を下回った
- OrchestratorはCLAUDE.md（修正前）の記載に従い、haikuモデルでsubagentを起動していた

**2回目の失敗内容:**
- 1回目と同じ重複行問題が再発した（haikuモデルでのリトライのため修正が不十分）
- テスト結論セクションの実質行数不足: 実質行数が4行で最低要件の5行を下回った
- リトライプロンプトに具体的な行レベルの修正指示が含まれていなかった

**3回目（成功）の要因:**
- Orchestratorがsubagentモデルをhaikuからsonnetに変更した
- リトライプロンプトに具体的な行レベルの修正指示を含めた
- sonnetモデルは品質要件をより正確に満たす能力を持つ

**問題の構造的背景:**
- definitions.tsではmanual_testのmodelはsonnetと定義されている
- CLAUDE.md（修正前）ではmanual_test=haikuと記載されていた
- この乖離がOrchestratorに誤ったモデルを選択させ、品質問題を引き起こした
- 前回タスクでCLAUDE.mdのmanual_test記載をsonnetに修正したが、同構造の乖離が他フェーズに残存している

### 問題2: CLAUDE.mdとdefinitions.tsの継続的乖離

前回タスクでsecurity_scan/performance_test/e2e_testの乖離を修正したにもかかわらず、以下の5フェーズで乖離が残存している。

| フェーズ | CLAUDE.md subagentType | definitions.ts subagentType | CLAUDE.md model | definitions.ts model |
|---------|----------------------|---------------------------|----------------|---------------------|
| research | Explore | general-purpose | haiku | sonnet |
| build_check | Bash | general-purpose | haiku | haiku |
| testing | Bash | general-purpose | haiku | haiku |
| commit | Bash | general-purpose | haiku | haiku |
| push | Bash | general-purpose | haiku | haiku |

build_check/testing/commit/pushの4フェーズはmodelが一致している（どちらもhaiku）が、subagentTypeが乖離している。researchフェーズはsubagentTypeもmodelも両方乖離している。

**workflow-plugin/CLAUDE.mdの乖離:**
- workflow-plugin/CLAUDE.mdにも完全に同一の乖離が存在する
- 行181（research）、行192（build_check）、行194（testing）、行200（commit）、行201（push）が対象
- プロジェクトルートのCLAUDE.mdと同期して修正する必要がある

### 問題3: allowedBashCategoriesのカテゴリ定義不整合

CLAUDE.mdのフェーズ別Bashコマンド許可カテゴリテーブルにおいて、commit/pushフェーズは「readonly, git」と記載されている。しかしBashコマンドカテゴリの定義セクションには「git」カテゴリの定義が存在しない。

**現在の定義セクション（3カテゴリのみ）:**
- readonly: ls, pwd, cat, head, tail, grep, find, wc, git status, git log, git diff, git show, npm list, node --version
- testing: npm test, npm run test, npx vitest, npx jest, npx playwright test, pytest
- implementation: npm install, pnpm add, npm run build, mkdir, rm, git add, git commit

**definitions.tsでの実装:**
- commit/pushフェーズのallowedBashCategoriesはreadonly・implementationの2つのカテゴリで構成されている
- 「implementation」カテゴリにgit add/git commitが含まれるため、実運用上は問題なく動作している
- ただしCLAUDE.mdの記載（「git」カテゴリ）と実装（「implementation」カテゴリ）が一致していない

**想定される解決策:**
- 選択肢A: CLAUDE.mdのcommit/push行の許可カテゴリ記載を「readonly, git」から「readonly, implementation」に変更する
- 選択肢B: CLAUDE.mdのカテゴリ定義セクションに「git」カテゴリを追加し、git add/git commitを定義する

definitions.tsの実装と整合性を取るためには選択肢Aが適切である。新規カテゴリ追加は実装側も変更が必要となり、影響範囲が広い。

### 問題4: definitions.tsの全フェーズgeneral-purpose統一設計

definitions.tsでは全25フェーズ（サブフェーズ含む）のsubagentTypeが'general-purpose'に統一されている。

**設計の合理性:**
- general-purposeエージェントはBash/Read/Write/Edit等の全ツールを使用できる
- Bash専用エージェントとは異なり、ファイル操作や複雑な分析も同一エージェントで実行可能
- 全フェーズを同一タイプに統一することで、Orchestratorの実装を簡素化できる
- subagentの能力制限はphase-edit-guardフックとallowedBashCategoriesで別途管理される

**researchフェーズのExploreタイプについて:**
- CLAUDE.mdはresearch=Exploreタイプを指定している
- ExploreタイプはAIエージェントのコードベース探索に特化しており、高速なファイル検索が得意
- general-purposeへの統一は、researchフェーズの調査品質に影響する可能性がある
- ただしdefinitions.tsの設計者はこの点を考慮した上でgeneral-purposeを選択していると考えられる

---

## 既存実装の分析

### definitions.ts（実装の正規ソース）の設計

definitions.tsはworkflow-plugin/mcp-server/src/phases/definitions.tsに位置し、全フェーズの定義を管理している。

**subagentType設計:**
- 全25フェーズ（サブフェーズ含む）でsubagentType: 'general-purpose'に統一
- これによりフェーズ間でsubagentの能力差異が生じない
- phase-edit-guardとallowedBashCategoriesが能力制限の役割を担う
- CLAUDE.mdのBash/Explore指定は、実装上は使用されていない

**model設計:**
- 重い分析作業（requirements, threat_modeling, planning, ui_design, test_design, implementation, code_review）はsonnet
- 軽い作業（state_machine, flowchart, refactoring, build_check, manual_test, security_scan, performance_test, e2e_test, docs_update, commit, push, ci_verification, deploy）はhaiku
- researchはsonnet（調査品質を重視）
- testingはhaiku（テスト実行結果の確認のみ）

**allowedBashCategories設計:**
- readonly: 全フェーズで共通許可
- testing: テスト実行が必要なフェーズ（test_impl, implementation, refactoring, build_check, testing, regression_test, security_scan, performance_test, e2e_test, ci_verification）
- implementation: ビルド・インストール・git操作が必要なフェーズ（test_impl, implementation, refactoring, build_check, commit, push, deploy）
- commit・pushフェーズではreadonly・implementationが設定されており、git add・git commitが使用可能

**subagentTemplate設計:**
- フェーズごとに個別のプロンプトテンプレートが定義されている
- テンプレートにはフェーズの作業内容、入力ファイル、出力ファイル、品質要件が含まれる
- inputFileMetadataで入力ファイルの重要度（critical/important/optional）が管理されている

### CLAUDE.md（ドキュメント）の問題点

**構造的問題:**
- CLAUDE.mdはOrchestratorの参照ドキュメントとして機能しているが、定義の正規ソースはdefinitions.ts
- CLAUDE.mdの記載が実装と乖離した場合、OrchestratorはCLAUDE.mdに基づいて誤った設定でsubagentを起動する
- この「ドキュメントが実装の振る舞いを決定する」構造が、乖離発生時の実害の原因

**未修正の乖離箇所:**
- research: subagentType（Explore→general-purpose）とmodel（haiku→sonnet）の両方
- build_check: subagentType（Bash→general-purpose）のみ、modelは一致
- testing: subagentType（Bash→general-purpose）のみ、modelは一致
- commit: subagentType（Bash→general-purpose）のみ、modelは一致
- push: subagentType（Bash→general-purpose）のみ、modelは一致

**Bashカテゴリ定義の問題:**
- カテゴリ定義セクションにreadonly/testing/implementationの3カテゴリのみが定義されている
- フェーズ別許可カテゴリテーブルにはcommit/pushで「git」カテゴリが記載されている
- この不整合は読者を混乱させ、実装と異なる動作を期待させる可能性がある

### 修正範囲の特定

修正が必要なファイルは以下の通りである。

**プロジェクトルートのCLAUDE.md:**
- フェーズ別subagent設定テーブルの5フェーズ（research, build_check, testing, commit, push）を修正
- フェーズ別Bashコマンド許可カテゴリテーブルのcommit/push行を「readonly, implementation」に修正
- Bashカテゴリ定義セクションからgitカテゴリへの言及を削除するか、実装と整合する記述に変更

**workflow-plugin/CLAUDE.md:**
- 行181, 192, 194, 200, 201の対応する箇所を同様に修正
- プロジェクトルートのCLAUDE.mdと完全に同期させる必要がある

**definitions.ts:**
- 現状の実装は正しい設計に基づいており、変更は不要
- 変更を加える場合はsubagentTemplateのみを対象とし、subagentTypeとmodelは維持する
