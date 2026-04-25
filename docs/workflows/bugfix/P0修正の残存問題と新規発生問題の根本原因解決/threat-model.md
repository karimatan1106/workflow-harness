## サマリー

本ドキュメントは、CLAUDE.mdドキュメント群（ルートCLAUDE.mdおよびworkflow-plugin/CLAUDE.md）への3箇所の文字列修正に対する脅威モデルである。

修正対象は以下の3点に限定される。
- FR-1: workflow-plugin/CLAUDE.mdのsubagent_type値「Plan」を「general-purpose」に修正
- FR-2: ルートCLAUDE.mdのdeploy行許可カテゴリを「readonly」のみに修正
- FR-3: ルートCLAUDE.mdのtest_impl行をimplementationなしの独立行に分割

主要な脅威は以下の3カテゴリに分類される。
1. 不正なsubagent_type値によるTask tool実行失敗（FR-1が示す既存脅威の顕在化）
2. 架空のBashカテゴリ参照によるコマンド解決失敗（FR-2のdeployカテゴリが該当）
3. テーブル値とdefinitions.ts（正規ソース）の乖離によるOrchestratorの誤動作

次フェーズ（planning）で参照すべき重要情報は以下のとおりである。
- 修正は全てドキュメントの文字列変更で完結し、コード変更は不要
- 修正漏れリスクに対しては合格条件（AC-1〜AC-5）による自動検証が有効
- 各脅威の対策は既に要件（FR-1〜FR-3、NFR-1〜NFR-5）に含まれている

---

## 脅威の範囲と前提条件

### 修正対象の性質

本タスクの修正は、実行可能なコードではなくドキュメント（Markdownファイル）への文字列変更である。修正対象は2ファイル・3箇所のみであり、ソースコード（definitions.ts、bash-whitelist.js）は変更しない。

この性質から、本脅威モデルが扱う脅威は以下の2種類に限定される。
- 修正前に既に存在していた脅威（現状の不整合がもたらすリスク）
- 修正作業中に生じうる脅威（誤修正、修正漏れ等）

実行時のインジェクション攻撃やネットワーク脅威は本タスクの範囲外である。

### 影響を受けるアクター

本脅威モデルで考慮するアクターは以下のとおりである。
- **Orchestrator (Claude)**: CLAUDE.mdを参照してフェーズを制御する主体
- **Task tool**: Orchestratorが起動するsubagentの実行エンジン
- **bash-whitelist.js (フック)**: Bashコマンドの許可判定を行うフック実装
- **definitions.ts**: フェーズ設定の正規ソース（このタスクでは変更しない）
- **修正作業者**: CLAUDE.mdを編集する人間またはAIエージェント

---

## 脅威1: 不正なsubagent_type値によるTask tool実行失敗

### 脅威の説明

workflow-plugin/CLAUDE.mdの並列フェーズ実行コード例（330行目付近）に「subagent_type: 'Plan'」という値が残存している。OrchestratorがこのコードをそのままTask toolの引数として使用した場合、Task toolは「Plan」というsubagent_typeを解釈できずに実行を失敗させる可能性がある。

### 攻撃経路

1. Orchestratorが並列フェーズ（parallel_analysis）の起動手順としてCLAUDE.mdのコード例を参照する
2. コード例の「subagent_type: 'Plan'」をそのままTask toolのパラメータとして渡す
3. Task toolが未知のsubagent_typeを受け取りエラーを返す
4. planning フェーズのsubagentが起動せず、ワークフローが停止する

### リスク評価

- **可能性**: 中（Orchestratorがコード例をテンプレートとして使用する設計意図がある）
- **影響度**: 高（planningフェーズが起動しないとワークフロー全体がブロックされる）
- **総合リスク**: 高

### 既存の対策

ルートCLAUDE.mdの対応箇所（フェーズ別subagent設定テーブル）は既にgeneral-purposeに修正済みである。そのため、Orchestratorがテーブルを優先参照する場合は脅威が顕在化しない。しかしコード例を直接参照する場合は依然として誤った値が使用される。

### 推奨対策

FR-1: 「subagent_type: 'Plan'」を「subagent_type: 'general-purpose'」に修正することで、コード例がそのまま使用されても正しく動作するようになる。修正後の合格条件はAC-1（「subagent_type: 'Plan'」という文字列が存在しないこと）で検証する。

---

## 脅威2: 架空のdeployカテゴリ参照による実行時エラー

### 脅威の説明

ルートCLAUDE.mdのBashカテゴリテーブルのdeploy行には「readonly, implementation, deploy」と記載されている。しかしbash-whitelist.jsには「deploy」というカテゴリが定義されていない。definitions.tsでもdeployフェーズのallowedBashCategoriesは「readonly」のみである。

### 攻撃経路

1. OrchestratorがCLAUDE.mdを参照してdeployフェーズで「deployカテゴリのコマンドが使用可能」と認識する
2. deployカテゴリとして許可されると思われるコマンドをbash-whitelist.jsに問い合わせる
3. bash-whitelist.jsが「deploy」カテゴリを展開できず、空のコマンドリストを返す
4. Orchestratorが期待するコマンドが許可されないと判断して処理を誤る

### リスク評価

- **可能性**: 低（deployフェーズは発動頻度が低く、Orchestratorが直接カテゴリ名を参照する機会も限られる）
- **影響度**: 中（deployフェーズ内でのコマンド制限の誤解が生じるが、deployフェーズ自体がreadonly操作のみで構成されるなら実害は少ない）
- **総合リスク**: 中

### 既存の対策

definitions.tsでは既にdeployフェーズのallowedBashCategoriesが「readonly」のみに設定されており、実際の実行時制御は正しく行われている。CLAUDE.mdの記述誤りはドキュメントの信頼性に影響するが、実行時の動作に直接影響しない。

### 推奨対策

FR-2: deploy行の許可カテゴリを「readonly」のみに変更し、用途説明を「デプロイ確認のため読み取りのみ」に修正することで、ドキュメントと実装の乖離を解消する。合格条件AC-2で検証する。

---

## 脅威3: test_implへのimplementation過剰付与によるTDD違反

### 脅威の説明

ルートCLAUDE.mdのBashカテゴリテーブルにおいて、test_impl・implementation・refactoringが単一行にまとめられ、「readonly, testing, implementation」の全カテゴリが許可されているように見える記述になっている。definitions.tsでは、test_implフェーズのallowedBashCategoriesは「readonly, testing」のみである。

### 攻撃経路

1. Orchestratorがtest_implフェーズ用のsubagentプロンプトを生成する際にCLAUDE.mdのテーブルを参照する
2. test_impl・implementation・refactoringが同一行のためtest_implでimplementationカテゴリが使用可能と解釈する
3. subagentがTDD Redフェーズでnpm installやgit commitなどのimplementationカテゴリのコマンドを実行しようとする
4. bash-whitelist.jsが実際のtest_impフェーズの設定に基づいてコマンドをブロックし、subagentが混乱する

### リスク評価

- **可能性**: 中（フェーズ別許可カテゴリをOrchestratorがテーブルから参照するユースケースが存在する）
- **影響度**: 中（test_implフェーズでimplementation操作が試みられると、TDDの「Red」段階の純粋性が損なわれる）
- **総合リスク**: 中

### 既存の対策

bash-whitelist.jsとdefinitions.tsは正しく設定されており、実際のフック動作ではtest_implでimplementationカテゴリのコマンドが実行された場合はブロックされる。ドキュメントの誤記がフック動作を変更することはない。

### 推奨対策

FR-3: test_impl行をimplementation/refactoring行と分離し、test_impl行には「readonly, testing」のみを記載する。これにより、Orchestratorが誤ったカテゴリセットをsubagentプロンプトに埋め込むリスクを排除する。合格条件AC-3・AC-4で検証する。

---

## 脅威4: 修正漏れによる同種問題の再発

### 脅威の説明

前回のP0修正（91c3270）は3箇所の修正漏れを残したまま完了とされた。同様のパターンで、今回の修正もスコープ外の箇所に同種の不整合が存在する可能性がある。修正後に再び不整合が残存した場合、次のワークフロー実行時に同じ問題が再発する。

### 考えられる残存箇所

以下の箇所は今回の要件では明示的に修正対象外とされているが、潜在的な不整合がある可能性を持つ。
- workflow-plugin/CLAUDE.mdのBashカテゴリテーブル（ルートCLAUDE.mdのFR-2・FR-3に対応する箇所）
- ルートCLAUDE.mdの他のコード例（フェーズ別subagent設定テーブル以外の箇所）
- docs/配下のその他のドキュメントでCLAUDE.mdを引用または参照している箇所

### リスク評価

- **可能性**: 低から中（前回の修正が3箇所の漏れを生じさせた事実が根拠となる）
- **影響度**: 中（問題が顕在化するのは特定のフェーズが起動された時点であり、即座の障害にはならない）
- **総合リスク**: 低から中

### 推奨対策

NFR-2（definitions.tsとの完全整合性確認）とNFR-3（両CLAUDE.mdの相互整合性確認）が本脅威への主要な対策となる。修正後に合格条件AC-1〜AC-5を全て検証することで、今回の修正スコープ内の漏れは検出できる。スコープ外の潜在的不整合については、本タスクの次回レビュー時に確認する。

---

## 脅威5: 誤修正による正しい記述の破壊

### 脅威の説明

文字列置換または行分割の操作を誤った場合、修正対象以外の正しい記述が破壊されるリスクがある。特に行分割（FR-3）は1行を2行に変換する操作であり、周辺のMarkdownテーブル構造を崩す可能性を持つ。

### 誤修正のシナリオ

- 検索文字列のマッチが意図しない箇所に当たり、正しい記述を書き換える
- 行分割の際にMarkdownテーブルのカラム区切り（パイプ記号）が不整合になる
- 修正後のインデントや空白が意図せず変化し、他のセクションの書式を乱す

### リスク評価

- **可能性**: 低（修正箇所が明確に特定されており、修正内容も要件に明記されている）
- **影響度**: 中（CLAUDE.mdの書式破損はOrchestratorの誤読を引き起こす可能性がある）
- **総合リスク**: 低

### 推奨対策

NFR-1（変更の最小性）とNFR-4（修正箇所の正確な特定）が本脅威への対策となる。修正前にRead toolで現在の記述を確認し、Edit toolで文字列を正確に置換することで誤修正リスクを最小化する。修正後は対象箇所を再度読み取り、意図した変更のみが適用されたことを確認する。

---

## リスクサマリー

| 脅威ID | 脅威名 | 可能性 | 影響度 | 総合リスク | 対策 |
|--------|--------|--------|--------|----------|------|
| T-1 | 不正なsubagent_type値によるTask tool失敗 | 中 | 高 | 高 | FR-1の修正（AC-1で検証） |
| T-2 | 架空のdeployカテゴリ参照による実行時エラー | 低 | 中 | 中 | FR-2の修正（AC-2で検証） |
| T-3 | test_implへのimplementation過剰付与 | 中 | 中 | 中 | FR-3の修正（AC-3・AC-4で検証） |
| T-4 | 修正漏れによる同種問題の再発 | 低〜中 | 中 | 低〜中 | NFR-2・NFR-3の整合性確認 |
| T-5 | 誤修正による正しい記述の破壊 | 低 | 中 | 低 | NFR-1・NFR-4の遵守 |

最も優先度の高い脅威はT-1であり、planningフェーズの起動失敗という直接的な影響をもたらす。T-2とT-3は実行時の動作制御（definitions.ts・bash-whitelist.js）が正しく設定されているため、ドキュメントの信頼性への影響にとどまる。T-4とT-5は修正作業の品質管理で対応できる低リスク項目である。

---

## セキュリティモデルの結論

本タスクの修正はドキュメントの正確性回復を目的としており、新たなセキュリティ脆弱性を導入するリスクは極めて低い。

主要なリスクは既存のドキュメント不整合（T-1〜T-3）であり、これらは全て修正要件（FR-1〜FR-3）で対処済みである。
T-1（subagent_typeの誤り）はworkflow-plugin/CLAUDE.mdの「Plan」を「general-purpose」に修正することで解決する。
T-2（deployカテゴリの架空参照）はCLAUDE.mdのdeploy行を「readonly」のみに変更することで解決する。
T-3（test_implへの過剰カテゴリ付与）はtest_impl行をimplementation行と分離することで解決する。

修正後は合格条件（AC-1〜AC-5）による検証を実施し、definitions.tsとCLAUDE.mdの整合性を確認することで、本タスクのセキュリティ目標が達成されたと判断できる。

definitions.ts（正規ソース）およびbash-whitelist.js（フック実装）は変更しないため、既存のアクセス制御メカニズムは変化しない。
ドキュメント修正のみであるため、Orchestratorの動作ロジックやセキュリティポリシー自体に影響することはない。
