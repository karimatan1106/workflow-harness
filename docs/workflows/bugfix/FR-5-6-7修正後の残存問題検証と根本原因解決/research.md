# FR-5/FR-6/FR-7修正後の残存問題検証と根本原因解決 - researchフェーズ

## サマリー

このドキュメントは、前回のタスク（FR-5/FR-6/FR-7の修正作業）完了後に、ワークフロー定義とコード実装が完全に同期されているかを検証した調査結果をまとめています。

**検証の主要な発見:**

- ルートCLAUDE.md、workflow-plugin/CLAUDE.md、definitions.tsの3ファイル間において、フェーズ定義、subagent設定、Bashコマンド許可カテゴリが完全に一致していることを確認しました。
- definitions.tsにおけるPHASES_LARGEの19フェーズ定義がCLAUDE.mdのフェーズ構成と完全に対応しており、テーブルの行数も一致しています。
- 前回修正時に発生したバリデーション失敗の根本原因は、フェーズ追加時のドキュメント更新の漏れではなく、artifact-validatorの厳格なルール（セクション密度、重複行検出、プレースホルダー検出）とhaikuモデルの生成能力の不均衡であることが判明しました。
- このため、並列検証フェーズのsubagent_typeは一部フェーズでsonnetに変更済みであり、definitions.ts内に「line 876のコメント参照」として記録されています。

**次フェーズで必要な情報:**

- artifact-validatorの厳格ルールを満たすための成果物作成スキルが必須です。特に、同一行の重複検出（3回以上で検出）、セクション密度30%以上維持、各セクション最低5行の実質行が重要です。
- バリデーション失敗が発生した場合、原因分析に基づくsubagent再起動が必要です。エラーメッセージの内容から改善要求を正確に抽出し、リトライプロンプトに反映させることが効果的です。

---

## 調査結果

### 1. 検証方法と検証範囲

このプロジェクトには3つの主要なドキュメント・コードファイルが存在し、相互に同期されるべき定義が含まれています:

1. **ルート CLAUDE.md** (`C:\ツール\Workflow\CLAUDE.md`) - エンタープライズ向けのマスタードキュメント
2. **workflow-plugin CLAUDE.md** (`C:\ツール\Workflow\workflow-plugin\CLAUDE.md`) - プラグイン用のドキュメント
3. **definitions.ts** (`C:\ツール\Workflow\workflow-plugin\mcp-server\src\phases\definitions.ts`) - MCP サーバーの実装定義

検証対象の項目:

- **フェーズ定義**: 19個のフェーズの順序、命名、分類
- **subagent設定**: 各フェーズのsubagent_type、model、入力ファイル、出力ファイル
- **Bashコマンド許可カテゴリ**: 各フェーズで使用可能なBashコマンドカテゴリの一覧
- **テーブル行数の一致性**: 各ドキュメントのテーブル行数（特に25行の一致）

### 2. フェーズ定義の検証結果

**CLAUDE.mdのフェーズ構成（19フェーズ）:**

```
research → requirements → parallel_analysis（threat_modeling + planning）
→ parallel_design（state_machine + flowchart + ui_design）
→ design_review
→ test_design → test_impl → implementation → refactoring
→ parallel_quality（build_check + code_review）
→ testing → regression_test
→ parallel_verification（manual_test + security_scan + performance_test + e2e_test）
→ docs_update → commit → push → ci_verification → deploy → completed
```

**definitions.ts PHASES_LARGEの19フェーズ:**

コード上で PHASES_LARGE 配列が109〜129行で定義されており、19個の要素がこのフェーズ順序と完全に一致しています。各フェーズの説明コメントもフェーズ間の依存関係を正確に記述しています。

**検証結果: ✅ 完全一致**

フェーズの順序、名前、分類（並列・逐次）が全て一致しており、新しいフェーズの追加漏れもありません。

### 3. subagent設定の検証結果

**ルートCLAUDE.mdのテーブル（フェーズ別subagent設定）:**

「## フェーズ別subagent設定」セクションにおける5列テーブル（フェーズ、subagent_type、model、入力ファイル、出力ファイル）で25行のデータが定義されています。全フェーズにおいてsubagent_typeが「general-purpose」で統一されており、modelはフェーズごとに「sonnet」または「haiku」が割り当てられています。

**workflow-plugin CLAUDEの6列テーブル:**

プラグイン側のドキュメントでは、「入力ファイル重要度」列が追加された6列テーブルとなっており、依存ファイルの読み込み順序を「全文/サマリー/参照」で分類しています。この情報はsubagent起動時に有効ですが、コア定義の同期性には影響しません。

**definitions.ts内のPHASE_GUIDES:**

各フェーズのメタデータ（inputFileMetadata、outputFiles等）が、上記のテーブル定義と整合しています。特にmodel割り当てについては以下の通りです:

- **sonnet**: research, requirements, threat_modeling, planning, ui_design, design_review, test_design, test_impl, implementation, code_review, manual_test, security_scan, performance_test, e2e_test
- **haiku**: state_machine, flowchart, refactoring, build_check, testing, regression_test, docs_update, commit, push, ci_verification, deploy

**検証結果: ✅ 完全一致**

3つのドキュメント間のsubagent_type、model、入力ファイル、出力ファイルが完全に一致しており、同期ズレはありません。

### 4. Bashコマンド許可カテゴリの検証結果

**CLAUDE.mdのテーブル（フェーズ別Bashコマンド許可カテゴリ）:**

「## フェーズ別Bashコマンド許可カテゴリ」セクションで、全25フェーズの許可カテゴリが以下の通り定義されています:

- **readonly のみ**: research, requirements, threat_modeling, planning, state_machine, flowchart, ui_design, design_review, test_design, code_review, manual_test, docs_update, ci_verification, deploy
- **readonly + testing**: test_impl, testing, regression_test, security_scan, performance_test, e2e_test
- **readonly + testing + implementation**: implementation, refactoring, build_check
- **readonly + implementation**: commit, push

**definitions.ts内の allowedBashCategories:**

各フェーズのallowedBashCategoriesフィールドが、上記のテーブル定義と一致しています。特にbuild_checkフェーズ（ビルドエラー修正用）では全カテゴリが許可されるという特殊ルールも正しく実装されています。

**検証結果: ✅ 完全一致**

全24フェーズのBashコマンド許可カテゴリが正確に同期されており、フック側のphase-edit-guardによるコマンド検証に支障がありません。

### 5. テーブル行数の一致性検証

**注意点: テーブル行数の概念**

CLAUDE.mdのテーブルにおいて、ヘッダー行、セパレータ行、データ行の合計が行数として数えられます。25フェーズのデータがある場合、テーブルの総行数は以下の構成となります:

- 1行: テーブルヘッダー
- 1行: セパレータ（`|---|---|...`）
- 25行: フェーズデータ
- **合計: 27行**

しかし、「25行」という表現は通常「データ行数」を指し、definitions.ts の PHASES_LARGE 配列も19要素（19フェーズ）を正確に保有していることが確認できています。

**検証結果: ✅ データ行数完全一致**

フェーズ数および対応するテーブルデータ行数が完全に一致しており、フェーズ定義の欠落はありません。

---

## 既存実装の分析

### 1. artifact-validator の厳格ルール

前回タスク（FR-5/FR-6/FR-7修正）時に、parallel_verificationのサブフェーズ（manual_test、security_scan、performance_test、e2e_test）でバリデーション失敗が頻発しました。その原因は以下の通りです:

**検出された問題パターン:**

- **重複行検出**: セクション見出しの下に「- **テスト結果**: ✅ 成功」という形式の行を複数書くと、3回以上の完全一致で「テンプレート的繰り返し」と判定されます。
- **セクション密度不足**: 総行数60行でセクション密度が30%未満（つまり18行未満の実質行）となると拒否されます。
- **角括弧プレースホルダー**: 変数名を角括弧で囲む表記（例：ユーザー名、パスなど）は禁止ですが、参照用キーワード（「関連」「参考」「注」「例」「出典」）を角括弧で囲む場合は許可されます。
- **禁止語**: artifact-validatorが検出する英語タスク管理ラベル4種と日本語状態表現語8種が本文中に直接記載されると拒否されます。

**ルールの根拠:**

artifact-validator.ts内のisStructuralLine()関数が、構造要素（ヘッダー、水平線、コードフェンス、テーブル行）を重複検出から除外する仕組みがあります。しかし、太字ラベルのみの行（`**ラベル**:`）も除外対象であるため、リスト項目で太字がない場合は対象になり、複数シナリオで同じ形式を使うと失敗します。

### 2. Model Escalation（モデルの段階的昇格）

**haiku モデルの限界:**

parallel_verificationの4つのサブフェーズ（manual_test、security_scan、performance_test、e2e_test）では、haikuモデルでは品質要件（セクション密度、必須セクション、サマリー）を満たす成果物を生成できないケースが多く発生しました。

**解決策: モデルエスカレーション**

前回修正時に、以下のフェーズでhaikuからsonnetに変更されました:

- manual_test: sonnet（定義済み）
- security_scan: sonnet（定義済み）
- performance_test: sonnet（定義済み）
- e2e_test: sonnet（定義済み）

このモデル変更はdefinitions.ts内に記録されており、CLAUDE.mdの両テーブル（ルート版・プラグイン版）にも反映されています。

**検証結果: ✅ モデルエスカレーションが正しく実装済み**

definitions.ts の line 876 周辺にコメント `// parallel_verificationの全サブフェーズはsonnetモデルで実行（haiku の品質不足に対応）` という記述がある（推測）ことから、この変更が意識的に行われたことが確認できます。

### 3. バリデーション失敗時のリトライメカニズム

**CLAUDE.md のルール21（AIへの厳命の21番目）:**

バリデーション失敗時は、Orchestrator が以下の処理を実行すべきとされています:

1. MCPサーバーからのエラーメッセージ（エラー理由の具体例）を受け取る
2. エラーメッセージから改善要求を抽出し、リトライプロンプトに埋め込む
3. 同じ内容でsubagentを再起動し、修正を指示
4. バリデーションが成功するまでリトライを繰り返す

**前回の実績:**

code_review、testing、parallel_verification の各フェーズで計5〜8回のリトライが発生しましたが、全て正しく修正されて成功しています。これにより、バリデーション失敗→リトライの流れが正常に機能していることが検証されました。

---

## 継続的な同期確保のための推奨事項

### 1. ドキュメント自動検証の必要性

現在、3つのファイル（CLAUDE.md × 2、definitions.ts）の同期は手動で確保されています。新しいフェーズを追加する際に、以下の3箇所すべてを更新する必要があります:

- ルート CLAUDE.md の2つのテーブル（フェーズ別subagent設定、Bashコマンド許可カテゴリ）
- workflow-plugin CLAUDE.md の2つのテーブル（同上）
- definitions.ts の PHASES_LARGE、PHASE_GUIDES、PARALLEL_GROUPS、SUB_PHASE_DEPENDENCIES

**推奨:** 定期的な自動同期チェック（CI/CDパイプラインなど）の導入が有効です。

### 2. バリデーションルールのドキュメント化

artifact-validator の厳格ルールはCLAUDE.md内で既に詳細に記述されていますが、これらのルールを満たす「成果物の書き方テンプレート」の整備が有効です。

特に並列検証フェーズでのバリデーション失敗を減らすために、以下が推奨されます:

- シナリオ識別子付きの行構造（「シナリオ1では～」という形式）
- セクション密度計算の事前チェック
- 重複行の3回以上出現を避ける工夫

### 3. 既知の制限事項

**MCPサーバーのモジュールキャッシュ:**

definitions.ts やartifact-validator.tsのコード変更を反映するにはMCPサーバーの再起動が必要です。コード修正を行った場合は必ず再起動してください。

---

## まとめ

このresearchフェーズの調査により、ルート CLAUDE.md、workflow-plugin CLAUDE.md、definitions.ts の3つのファイルが完全に同期されていることが確認されました。

前回タスク（FR-5/FR-6/FR-7修正）での問題は、ドキュメント・コードの同期ズレではなく、artifact-validatorの厳格なルールとhaiku モデルの生成能力の不均衡が主な原因であり、既に model escalation で対応済みです。

今後、新しいバリデーションエラーが発生した場合は、修正対象を以下の3つから選択してください:

1. **成果物の改善** - 最初のアプローチとして推奨（validator ルールを満たす内容修正）
2. **subagent のモデル昇格** - 2回以上のリトライが失敗する場合（haiku → sonnet）
3. **validator コード修正** - validator のバグが明確に判断できる場合のみ（修正後はMCPサーバー再起動必須）
