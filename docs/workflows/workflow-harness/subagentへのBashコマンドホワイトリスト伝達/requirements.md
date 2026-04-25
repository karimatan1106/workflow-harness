## サマリー

subagentがBashコマンド実行時に「コマンドチェーン違反」でブロックされる問題を解決するため、CLAUDE.mdのsubagent起動テンプレートにBashコマンドホワイトリスト情報を追加する。
Orchestratorがフェーズごとの許可コマンド一覧をテンプレート内に動的に埋め込むことで、subagentは実行前に許可されたコマンドを把握できる。
MCPサーバーの変更は不要で、CLAUDE.md側の記述のみで対応可能。

目的: subagentへのBashコマンド許可情報の伝達メカニズム確立
主要な要件: テンプレートへの「Bashコマンド制限」セクション追加、フェーズ別カテゴリマッピング、具体的なコマンド一覧の記載
次フェーズで必要な情報: テンプレートの具体的な記述フォーマット、Orchestratorによる埋め込み方法の指示

## 機能要件

### FR-1: subagent起動テンプレートへのBashコマンド情報追加

CLAUDE.mdの「subagent起動テンプレート」セクションに、新しい「★重要★ Bashコマンド制限」セクションを追加する。
このセクションは既存の「★重要★ サマリーセクション必須化（REQ-4）」および「★重要★ 成果物品質要件の具体ルール」セクションと同じパターンで記述する。
配置位置は「サマリーセクション必須化」の直後、「成果物品質要件」の直前が適切である。
セクション名は「★重要★ このフェーズで実行可能なBashコマンド」とする。

### FR-2: フェーズ別許可コマンドカテゴリのマッピング

bash-whitelist.jsのgetWhitelistForPhase関数で定義されている18フェーズのマッピングを、テンプレート記述に反映する。
各フェーズグループに対応する許可カテゴリは以下の通り:
- readonlyPhases（research, requirements, threat_modeling, planning, state_machine, flowchart, ui_design, test_design, design_review, code_review, manual_test）: readonlyカテゴリのみ
- testingPhases（testing, regression_test）: readonly + testingカテゴリ
- implementationPhases（test_impl, implementation, refactoring）: readonly + testing + implementationカテゴリ
- verificationPhases（security_scan, performance_test, e2e_test, ci_verification）: readonly + testingカテゴリ
- gitPhases（commit, push）: readonly + gitカテゴリ
- build_check: readonly + testing + implementation + rmコマンド
- docsUpdatePhases（docs_update）: readonlyカテゴリのみ
- deployPhases（deploy）: readonly + implementation + deployカテゴリ

### FR-3: コマンドカテゴリの具体的なコマンド一覧

CLAUDE.mdの「フェーズごとの編集可能ファイル」セクションに既に定義されている3カテゴリに加え、git、deploy、rmカテゴリの定義を追加する。
各カテゴリの具体的なコマンド一覧は以下の通り:
- readonly: ls, pwd, cat, head, tail, grep, find, wc, git status, git log, git diff, git show, npm list, node --version, npm --version
- testing: npm test, npm run test, npx vitest, npx jest, npx playwright test, pytest
- implementation: npm install, pnpm add, npm run build, mkdir, rm, git add, git commit
- git: git add, git commit（commitフェーズ専用）
- deploy: kubectl apply, docker push, terraform apply, npm publish（deployフェーズ専用）
- rm: rm -rf, rm（build_checkフェーズでのビルド成果物削除用）

### FR-4: Orchestratorによる動的埋め込み指示

テンプレート内の「{許可コマンドカテゴリ}」プレースホルダーを、Orchestratorがフェーズに応じて置換する方式を採用する。
例: researchフェーズのsubagent起動時には「readonly」、implementationフェーズ時には「readonly, testing, implementation」と埋め込む。
プレースホルダー形式は波括弧を使用し、「このフェーズで許可されているコマンドカテゴリ: {許可コマンドカテゴリ}」のような記述とする。
Orchestratorは workflow_status のレスポンスから現在のフェーズを取得し、フェーズ名に基づいてFR-2のマッピングに従ってカテゴリを決定する。

### FR-5: Bashを使わないsubagentへの配慮

Explore、Planなどの一部subagent_typeはBashコマンドを実行しない前提で動作する。
テンプレート内に「注意: Bashツールを使用しないsubagent（Explore, Plan等）ではこの制限は適用されません」という注記を追加する。
ただし、全てのsubagentに同じテンプレート構造を適用することで、将来的にBashを使う可能性のあるsubagentでも対応可能にする。

### FR-6: 禁止コマンドの明示

許可されていないコマンドの例を明示することで、subagentが誤ってブロック対象コマンドを実行しないようにする。
禁止コマンドの例: cp, mv, od, chmod, chown, useradd, userdel, systemctl（readonly, testingフェーズでの実行禁止）
代替手段の記載: cpコマンドの代わりにRead + Writeツール、mvコマンドの代わりにRead + Write + rmツール使用を推奨する。

## 非機能要件

### NFR-1: MCPサーバー変更の不要性

この要件実装ではMCPサーバー側（workflow-plugin/mcp-server/）のコード変更を一切行わない。
CLAUDE.mdの記述のみで対応することで、デプロイやテストの手間を最小限に抑える。
phaseGuideへのbashWhitelist情報追加は行わず、CLAUDE.md側での対応のみとする。

### NFR-2: 既存テンプレート構造との整合性

新しいBashコマンド制限セクションは、既存の「成果物品質要件の具体ルール」セクションと同じフォーマットで記述する。
「★重要★」マーカーを使用し、subagentが見落とさないようにする。
箇条書き形式で許可カテゴリと具体的なコマンドを列挙し、視認性を高める。

### NFR-3: 保守性の確保

bash-whitelist.jsの定義とCLAUDE.mdの記述が乖離しないよう、コメントで「bash-whitelist.jsと対応」と明記する。
将来的にフェーズが追加された際、CLAUDE.mdのマッピング表も更新されるよう、保守担当者への注意書きを追加する。
カテゴリ定義の変更時には、CLAUDE.md内の複数箇所（カテゴリ一覧、テンプレート、フェーズ別マッピング）を同時に更新する必要があることを記載する。

### NFR-4: subagentへの明確な指示

テンプレート内で「Bashコマンド実行前に必ずこのリストを確認すること」という指示を明記する。
許可されていないコマンドを実行するとフックでブロックされることを警告として記載する。
代替手段（Read, Write, Edit等のツール使用）を積極的に推奨する文言を含める。

### NFR-5: 可読性とユーザビリティ

フェーズ別マッピング表は表形式で記載し、Orchestratorおよび人間の保守担当者が一目で理解できるようにする。
各カテゴリのコマンド一覧は改行区切りで記載し、長い1行にならないようにする。
プレースホルダー部分は波括弧で明示し、Orchestratorが置換すべき箇所を明確にする。

### NFR-6: 段階的な適用

既存のsubagent起動処理に影響を与えないよう、テンプレートの追加は非破壊的に行う。
新しいセクションを追加するだけで、既存のセクション（作業内容、入力、出力等）は一切変更しない。
Orchestrator側でプレースホルダー置換を実装する前でも、テンプレート内に静的な記述として残しておくことで段階的な適用を可能にする。

## 制約条件

### CON-1: CLAUDE.mdのみの変更

MCPサーバーのコード変更は行わない。
bash-whitelist.jsの定義は変更せず、CLAUDE.mdの記述のみで対応する。
phaseGuideのレスポンス構造には手を加えない。

### CON-2: 既存フックロジックとの互換性

bash-command-guard.jsのcheckCommandChain関数で使用されているカテゴリ名と完全に一致させる。
getWhitelistForPhase関数の返り値と矛盾しない記述とする。
カテゴリ名の大文字小文字やスペルミスに注意し、既存コードとの整合性を保つ。

### CON-3: subagent_typeごとの適用範囲

Bashツールを使用しないsubagent_type（Explore, Plan）には実質的に適用されないが、テンプレート構造としては統一する。
general-purposeおよびBash subagent_typeで主に使用されることを前提とする。

### CON-4: バリデーション要件の遵守

成果物（requirements.md）は artifact-validator.ts の検証を通過する必要がある。
禁止語句（TODO, TBD, WIP, FIXME, HACK, 仮, 未定, ダミー, サンプル, テスト用）を使用しない。
角括弧プレースホルダー（[XXX]）ではなく波括弧プレースホルダー（{XXX}）を使用する。
各セクションの実質行数を5行以上とし、セクション密度30%以上を維持する。

## ユーザーストーリー

### US-1: subagentの開発者として

subagentがBashコマンドを実行する前に、現在のフェーズで許可されているコマンド一覧を知りたい。
許可されていないコマンドを実行してフックでブロックされることを事前に回避したい。
代替手段（Read, Write等のツール）が存在する場合は、その情報もテンプレート内で知りたい。

### US-2: Orchestratorの実装者として

subagent起動時にフェーズに応じた許可コマンド情報を動的に埋め込みたい。
workflow_statusのレスポンスから現在のフェーズを取得し、フェーズ名に基づいてカテゴリを決定する処理を実装したい。
プレースホルダーの置換ロジックをシンプルに保ち、保守性を高めたい。

### US-3: CLAUDE.mdの保守担当者として

bash-whitelist.jsの定義とCLAUDE.mdの記述が乖離しないよう、同期して更新したい。
新しいフェーズやカテゴリが追加された際、更新すべき箇所が明確にわかるようにしたい。
フェーズ別マッピング表やカテゴリ定義の変更履歴を追跡しやすくしたい。

### US-4: フック開発者として

CLAUDE.md側でsubagentに適切な情報を伝達することで、フック側のエラーハンドリングを簡素化したい。
subagentが事前に許可コマンドを知ることで、ブロック頻度を減らし、ユーザー体験を向上させたい。
bash-command-guard.jsとCLAUDE.mdの記述が一貫性を保つことで、保守性を高めたい。

## 受け入れ基準

### AC-1: テンプレートへの新セクション追加

CLAUDE.mdのsubagent起動テンプレート内に「★重要★ このフェーズで実行可能なBashコマンド」セクションが追加されている。
セクションは「★重要★ サマリーセクション必須化（REQ-4）」の直後に配置されている。
セクション内にフェーズ別許可コマンドカテゴリのマッピング表が含まれている。

### AC-2: カテゴリ定義の完全性

readonly, testing, implementation, git, deploy, rmの6カテゴリが定義されている。
各カテゴリの具体的なコマンド一覧が箇条書きで記載されている。
カテゴリ名がbash-whitelist.jsのコードと完全に一致している。

### AC-3: フェーズ別マッピング表の正確性

18フェーズ全ての許可コマンドカテゴリが表形式で記載されている。
マッピング内容がbash-whitelist.jsのgetWhitelistForPhase関数の定義と一致している。
表のフォーマットが「フェーズ名 | 許可カテゴリ」の2カラム構成である。

### AC-4: Orchestrator向け指示の明確性

プレースホルダー形式（{許可コマンドカテゴリ}）が明示されている。
Orchestratorがフェーズに基づいてプレースホルダーを置換する方法が記述されている。
workflow_statusのレスポンスを使用してフェーズを取得する指示が含まれている。

### AC-5: subagent向け注意書きの充実

「Bashコマンド実行前に必ずこのリストを確認すること」という指示が記載されている。
許可されていないコマンドを実行するとブロックされることの警告が含まれている。
代替手段（Read, Write等のツール）使用の推奨が明記されている。

### AC-6: 禁止コマンドの例示

cp, mv, od等の禁止コマンド例が記載されている。
各禁止コマンドに対する代替手段（Read + Write等）が説明されている。
CLAUDE.md内の既存の「禁止コマンドの代替手段」セクションと整合性が取れている。

### AC-7: バリデーション通過

requirements.md がartifact-validator.tsの検証を通過する。
禁止語句（TODO等）が含まれていない。
角括弧プレースホルダー（[XXX]）が使用されていない。
各セクションの実質行数が5行以上である。

### AC-8: 保守性への配慮

bash-whitelist.jsとの対応関係がコメントで明記されている。
将来的なフェーズ追加時の更新手順が記載されている。
カテゴリ定義変更時の影響範囲（CLAUDE.md内の複数箇所）が明示されている。
