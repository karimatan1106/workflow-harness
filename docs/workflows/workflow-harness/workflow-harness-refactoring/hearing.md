:toon hearing v1
:summary workflow-harnessリファクタリング: vscode-ext削除、hookバックアップ掃除、subagentテンプレート直接取得、hearing AskUserQuestion強制

:section intent-analysis
:surfaceRequest workflow-harnessのリファクタリング。vscode-ext/を削除し、無駄な部分を整理・統合する
:deepNeed ハーネスのコードベースをスリム化し、オーケストレーター層のコンテキスト消費を削減する。サブagentの自律性を高める
:unclearPoints
  - mcp-server内部のデッドコードや冗長モジュールの有無（scopeに含めるか次フェーズで判断）
:assumptions
  - indexer/ (Serena CLI) はアクティブに統合されており削除しない
  - vscode-ext/ は他モジュールからの依存なし、安全に削除可能
  - hooks/バックアップファイルはgit履歴にあるため復元可能
  - harness_get_subphase_templateはcoordinatorのMCPアクセスで呼び出し可能（コード変更不要、ドキュメント更新のみ）
:end intent-analysis

:section implementation-plan
:approach 4段階で実施: (1) vscode-ext/削除+参照掃除 (2) hooks/バックアップ削除 (3) スキルドキュメント更新（テンプレート直接取得） (4) hearing DoD構造チェック追加
:estimatedScope 削除: vscode-ext/全体 + hooks/バックアップ4ファイル。編集: setup.sh, .gitignore, STRUCTURE_REPORT.md等の参照箇所 + スキルドキュメント2-3ファイル + hearing DoDテンプレート
:risks
  - vscode-ext参照の見落とし（grep網羅で対応）
  - hearing DoD変更がhearingフェーズの既存テストに影響する可能性
:end implementation-plan

:section decisions
:decision [D-HR-1] vscode-ext/を全削除し参照も掃除する :reason 他モジュールからの依存なし、ユーザー明示指示
:decision [D-HR-2] indexer/ (Serena CLI) は残す :reason アクティブに統合済み、テンプレート・hook・テストに参照あり
:decision [D-HR-3] hooks/バックアップファイル4つを削除 :reason git履歴で復元可能、不要ファイル
:decision [D-HR-4] harness_get_subphase_templateをcoordinatorがMCP経由で直接呼べるようスキルドキュメント更新 :reason オーケストレーターのコンテキスト消費削減
:decision [D-HR-5] hearingフェーズDoDにuserResponse必須チェック追加 :reason AskUserQuestionの使用を間接的に強制する
:end decisions

:section artifacts
:artifact hearing.md :status complete
:end artifacts

:section next
:next scope_definition :input hearing.md
:end next
