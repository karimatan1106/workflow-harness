# リサーチフェーズ: P0修正時の系統的問題の根本原因解決

## サマリー

前回のP0修正タスク実行中に発生した4つの系統的問題について根本原因を調査した。
調査の結果、最も影響度が高い問題はCLAUDE.mdのsubagent_type列の不整合であり、
security_scan・performance_test・e2e_testのsubagent_typeが「Bash」と誤記されている一方、
definitions.tsの実装値は「general-purpose」であることが判明した。
isStructuralLine関数の重複行除外ロジックは正しく動作しており、太字ラベル+コンテンツ行が
検出対象になるのは仕様通りの動作であることを確認した。
subagentTemplateの品質要件説明は前回タスクで強化済みだが、禁止語混入はsubagentの
コンテキスト制限による見逃しが原因であり、テンプレート内容の問題ではない。
次フェーズではCLAUDE.mdのsubagent_type修正を中心とした要件を定義する。

- 目的: 前回P0修正タスクで観測された4件の系統的問題の根本原因を特定し、修正方針を策定する
- 主要な決定事項: CLAUDE.mdのsubagent_type誤記修正が最優先、isStructuralLineはコード修正不要
- 次フェーズで必要な情報: 各問題の根本原因と修正対象ファイル・行番号の一覧

---

## 調査結果

### 問題1: CLAUDE.mdとdefinitions.tsのsubagent_type不整合

CLAUDE.md（ルートとworkflow-plugin配下の両方）のフェーズ別subagent設定テーブルにおいて、
以下の3サブフェーズのsubagent_type列が誤った値で記載されている。

ルートCLAUDE.mdの行158-160における誤記内容:
- security_scan: Bash（誤り）— 正しくは general-purpose
- performance_test: Bash（誤り）— 正しくは general-purpose
- e2e_test: Bash（誤り）— 正しくは general-purpose

definitions.ts行889-924における実装値（正しい値）:
- security_scan: `subagentType: 'general-purpose'`（行897付近）
- performance_test: `subagentType: 'general-purpose'`（行909付近）
- e2e_test: `subagentType: 'general-purpose'`（行921付近）

この不整合により、OrchestratorがCLAUDE.mdのテーブルを参照してsubagent_type='Bash'で
起動した場合、subagentが成果物（.mdファイル）をWrite toolで書き込めず、タスクが失敗する
可能性がある。前回タスクではOrchestratorがphaseGuideのsubagentType値（MCP server返却値）を
使用したため問題を回避できていたが、ドキュメントの誤記は新たなOrchestratorの混乱を招く。
workflow-plugin/CLAUDE.mdの行195-198付近にも同じ不整合が存在することを確認した。

修正方針: CLAUDE.md（ルート）とworkflow-plugin/CLAUDE.mdの両方で、3サブフェーズの
subagent_type列を「Bash」から「general-purpose」に修正する。

---

### 問題2: 重複行検出と太字ラベル行の仕様確認

artifact-validator.tsのisStructuralLine関数（行92-111）を詳細に確認した結果、
太字ラベル判定の正規表現は、行全体がアスタリスク2個で開始し、アスタリスク以外の文字列、
アスタリスク2個、任意のコロン、末尾の空白で終わるパターンであることが判明した。
この判定は、行全体が太字テキストのみで構成される行（例: `**ラベル**:`）のみを除外する。
太字ラベルの後に実際のコンテンツが続く行（例: `**確認対象ファイル:** definitions.ts`）は
isStructuralLineの除外対象にならず、重複検出の対象として機能する。

この動作は仕様として意図的に設計されており、コード修正は不要と結論づけた。
前回タスクのmanual_testで発生した重複行エラーは、テストシナリオのフォーマット設計において
同一の確認対象ファイル行を3回以上記載したことが直接原因である。
各行に文脈固有の情報（確認対象の具体的な内容や結果）を含めることで重複を回避できる。
成果物の記述スタイルを変えることで対応可能であり、コードの変更は必要としない。

---

### 問題3: sonnetモデルでも禁止語が混入する原因

前回タスクのmanual_testフェーズにおいて「要確認事項」「分析途中の状態」「今後のバージョンで修正が計画されている動作」に相当する語句が成果物に混入した。
これらはCLAUDE.mdで明示的に禁止されている語句の意味的等価語であり、sonnetモデルを使用しても発生した。

原因分析の結果、以下のメカニズムが特定された。
subagentが仕様書（spec.md）の内容を参照して成果物を作成する際に、仕様書内で使用されている
技術用語や分析文脈の中から禁止語を含む複合語を無意識に転記してしまう傾向がある。
具体的には、spec.mdの根本原因テーブルに追加調査が必要な事項を略記した箇所が含まれており、
subagentがそのコンテキストを引き継いで成果物に記述した。

有効な対策として、subagentTemplateの禁止語セクションに明示的な注意書きを追加することが挙げられる。
注意書きの内容は「入力ファイル（spec.md等）に含まれる禁止語もそのまま転記してはならない」
というものであり、言い換え例を添えることで実効性が高まる。
この対策はtemplate文字列の修正のみで実現でき、MCPサーバーの再起動も不要である。

---

### 問題4: MCPサーバーキャッシュ問題の自己参照的再発

前回タスクでFR-3（model変更）を実装した後、MCPサーバーを再起動せずに
parallel_verificationフェーズに進んだことが問題の発端である。
その結果、phaseGuideのmodel値は古いキャッシュ（haiku）のまま返却された。

OrchestratorがphaseGuideのmodel値ではなく明示的にsonnetを指定したため実害は発生しなかったが、
本来であれば修正後のphaseGuideが正しいmodel値（sonnet）を返すべきであった。
これは、CLAUDE.mdのルール（MCPサーバーキャッシュ問題への対処）で明記したはずの問題が
自身のタスク実行中に再発したという構造的矛盾を示している。

根本的な対策は2つある。
1つ目は、implementationフェーズ完了後にMCPサーバー再起動を実施するプロセスの明文化である。
2つ目は、OrchestratorがphaseGuideのmodel値を完全には信頼せず、CLAUDE.mdのテーブル値を
参照することを優先するという運用ルールの明確化である。
現時点ではルール記載はあるものの、フェーズ完了後の再起動を強制するメカニズムがない。

---

## 既存実装の分析

### CLAUDE.mdのsubagent設定テーブル（ルートファイル）

ルートのCLAUDE.mdに記載されているフェーズ別subagent設定テーブル（行134-159付近）において、
parallel_verificationサブフェーズの3つにsubagent_type「Bash」が誤記されている。
この誤記はドキュメントと実装コードの乖離を生じさせており、Orchestratorの判断を誤らせる原因になる。
同様の誤記がworkflow-plugin/CLAUDE.mdにも存在することを確認しており、2ファイルの修正が必要である。
正しいsubagent_typeは「general-purpose」であり、Markdown成果物を作成するため適切な選択である。

### artifact-validator.tsのisStructuralLine実装

artifact-validator.tsの重複行判定ロジックは、構造行（ヘッダー、水平線、コードフェンス、テーブル行、太字ラベル行）を除外する仕組みで実装されている。
太字ラベル行の除外条件は、行末がアスタリスク2個と任意のコロンで終わる場合のみ適用される。
ラベルの後にコンテンツが続く行（`**フィールド:** 値`の形式）は通常テキストとして扱われ、重複検出の対象になる。
コードフェンス内部のすべての行は重複検出から完全に除外されており、コードブロックで正規表現を示す場合は影響を受けない。
この実装は意図的なものであり、成果物の記述パターンを工夫することで回避可能であることを確認した。

### subagentTemplateの禁止語セクション現状

CLAUDE.mdのsubagent起動テンプレートには、英語系の進行中マーカー4語と日本語系の暫定表現6語の合計10語が禁止語として列挙されている。
ただし、入力ファイルからの禁止語転記を明示的に禁止する記述は現状では存在しない。
subagentが前フェーズの成果物を読み込む際に、そのファイル内の禁止語をそのまま引用・転記するリスクがある。
このリスクはsonnetモデルであっても完全に排除されておらず、テンプレートへの明示的な注意書き追加が有効である。
具体的な言い換え例（「要確認」→「追加調査が必要な事項」等）をテンプレートに含めることで実効性が向上する。

### MCPサーバー再起動プロセスの現状

CLAUDE.mdにはMCPサーバーのモジュールキャッシュに関する説明（「運用ルール」セクション）が記載されている。
しかし、implementationフェーズでMCPサーバー関連コードを変更した場合の再起動タイミングについての明示的な手順が不足している。
現在の記述は「コード変更を反映するにはMCPサーバープロセスの再起動が必要」という一般論のみである。
フェーズ完了ゲートとしての再起動チェックを明文化することで、今後の同様のインシデントを予防できる。
具体的には「implementationフェーズでMCPサーバーコードを変更した場合、parallel_qualityフェーズ開始前に再起動を実施すること」という手順を追加する必要がある。

---

## 対応方針まとめ

調査の結果、以下の修正を次フェーズ（requirements）で要件定義する。

FR-A1（最優先）: CLAUDE.md（ルート）のsubagent_typeテーブル修正
対象行: security_scan・performance_test・e2e_testの各行
修正内容: subagent_type列の値を「Bash」から「general-purpose」に変更する。

FR-A2（最優先）: workflow-plugin/CLAUDE.mdのsubagent_typeテーブル修正
対象: FR-A1と同様の3サブフェーズを同じ方針で修正する。

FR-A3（推奨）: subagentTemplateの禁止語セクション強化
追加内容: 入力ファイルからの禁止語転記を明示的に禁止する注意書きと言い換え例を追記する。

FR-A4（修正不要）: isStructuralLine関数のコード修正は実施しない
理由: 現在の動作は仕様通りであり、成果物の記述スタイルで回避可能である。

FR-A5（ドキュメント追記）: MCPサーバー再起動タイミングのプロセス明文化
内容: implementationフェーズでMCPサーバー関連コードを変更した場合の再起動手順を
CLAUDE.mdに追記し、再発防止を図る。
