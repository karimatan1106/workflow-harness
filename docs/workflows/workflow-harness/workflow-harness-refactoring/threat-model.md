phase: threat_modeling
task: workflow-harness-refactoring
status: complete
inputArtifacts: [requirements.md, impact-analysis.md, research.md]

strideAnalysis[7]:
  - {id: TM-01, category: Tampering, threat: Serena MCPサーバーが.mcp.jsonに追加されることでLSPプロセスが任意ファイルを読み書き可能になる。悪意あるserena設定やパス改竄でプロジェクト外ファイルにアクセスされるリスク, likelihood: low, impact: high, mitigation: .mcp.jsonのserenaエントリにcwd制約を設定しプロジェクトルート配下に限定する。環境変数でワークスペースパスを明示的に渡しLSP起動スコープを制御する}
  - {id: TM-02, category: Denial_of_Service, threat: Serena MCPサーバー起動失敗時にテンプレート内のSerena-first手順が永続的にブロックされる。LSPサーバーが応答しない場合タイムアウトまでフェーズが停止する, likelihood: medium, impact: medium, mitigation: 既存のGrep/Globフォールバックパターン(EP-02)がdefs-stage1.tsに実装済み。Serena利用可否チェック(Step 0)で失敗時にフォールバック経路に遷移する設計を維持する}
  - {id: TM-03, category: Tampering, threat: vscode-ext削除時にSTRUCTURE_REPORT.md L38およびL140-L148以外に未検出の参照が残存し、ドキュメント不整合が発生する。他のスキルファイルやCLAUDE.mdからの暗黙参照が漏れる可能性, likelihood: low, impact: medium, mitigation: grep -r vscode-ext でリポジトリ全体を検索し全参照を列挙する。research.mdのR-01でランタイム依存ゼロを確認済み。削除後にnpm run buildで参照破壊がないことを検証する(AC-3)}
  - {id: TM-04, category: Elevation_of_Privilege, threat: hookバックアップファイル(.bak2/.bak3/.disabled/.bak4)削除時に誤って稼働中hookファイル(pre-tool-guard.sh/test-guard.sh)を削除するリスク。ガード機能喪失によりツールアクセス制御が無効化される, likelihood: low, impact: critical, mitigation: 削除対象をファイル名の拡張子(.bak2/.bak3/.disabled/.bak4)で厳密に限定する。削除後にhooks/ディレクトリ内の稼働ファイル一覧を確認し、pre-tool-guard.sh/test-guard.sh/hook-utils.js等の存在を検証する}
  - {id: TM-05, category: Tampering, threat: defs-a.tsからsmall/medium TaskSize削除時に、型定義の変更がコンパイル時に検出されない暗黙的参照(文字列リテラルでのsize比較等)を破壊する。ランタイムでundefined比較が発生し予期しないフェーズスキップが起きる, likelihood: medium, impact: high, mitigation: TypeScript型システムによりTaskSize型参照箇所はコンパイルエラーで検出される。文字列リテラル"small"/"medium"はgrep -r で全ファイル検索し残存を排除する。lifecycle.ts L48のlarge固定を確認しランタイム影響なしを保証する(IA-04)}
  - {id: TM-06, category: Information_Disclosure, threat: Serena LSPサーバーがMCPプロトコル経由でプロジェクト構造情報(シンボルテーブル/依存グラフ)を公開する。MCPサーバー間の意図しないデータ共有で内部構造が露出する, likelihood: low, impact: low, mitigation: MCPサーバーは各々独立プロセスで動作しサーバー間直接通信なし。Serenaの出力はテンプレートのmaxResults制約(100/50/10)で量的に制限済み(MN参照)。ローカル実行のためネットワーク露出なし}
  - {id: TM-07, category: Tampering, threat: registry.tsのhearingフェーズにdodChecks追加時にDoDCheck型の不適切な実装により、他フェーズのDoD実行パス(gates/配下14モジュール)に副作用が発生する。初のdodChecks利用事例のため実行パスが未検証, likelihood: medium, impact: medium, mitigation: dodChecksはフェーズ固有のチェック配列でありgates/のDoD一括実行とは独立して評価される設計(EP-03)。hearing単独でdodChecks動作確認テストを先行実行する(IA-02/REQ-04)。他フェーズのdodChecks=[]は変更しない}

securityRequirements[4]:
  - {id: SR-1, requirement: Serena MCPサーバーのワークスペーススコープをプロジェクトルート配下に限定すること, priority: must}
  - {id: SR-2, requirement: hookバックアップ削除後に稼働中hook全5ファイルの存在と実行権限を検証すること, priority: must}
  - {id: SR-3, requirement: small/medium削除後にTaskSize型の全参照箇所でコンパイルエラーがないことを確認すること, priority: must}
  - {id: SR-4, requirement: TOOL_GUARD_DISABLE環境変数が本番運用で未設定であることをドキュメントに明記すること, priority: should}

riskSummary: 全7脅威のうちcritical影響1件(TM-04: hook誤削除)、high影響2件(TM-01: Serenaスコープ、TM-05: デッドコード型破壊)。いずれも既存の安全機構(フォールバック、型システム、ファイル名限定削除)で緩和可能。残留リスクは許容範囲内。

## decisions
- TM-D1: Serena MCPサーバーのcwd設定でワークスペーススコープを制限する。.mcp.jsonのserenaエントリにプロジェクトルートを明示的に設定(SR-1対応)
- TM-D2: hookバックアップ削除は拡張子ベースの厳密なファイル指定で実行する。ワイルドカード(hooks/*.bak*)は使用せず個別ファイル名を列挙して削除(TM-04緩和)
- TM-D3: Serena LSPフォールバック経路(Grep/Glob)を全Serena統合テンプレートで維持する。フォールバックなしのSerena専用パスは作成しない(TM-02緩和)
- TM-D4: small/medium削除はTypeScriptコンパイル(npm run build)と文字列grep検索の二重検証で残存参照を排除する(TM-05緩和、AC-3/AC-6対応)
- TM-D5: dodChecks追加はhearingフェーズ単独に限定する。他フェーズへの波及は本タスクスコープ外とし将来タスクで対応(TM-07緩和、REQ-04準拠)
- TM-D6: vscode-ext削除前にリポジトリ全体のgrep検索で参照漏れを確認する。STRUCTURE_REPORT.md 2箇所(L38/L140-L148)以外に参照がないことを検証(TM-03緩和)
- TM-D7: TOOL_GUARD_DISABLE環境変数の存在と用途をIC-05として記録済み。本タスクでは変更しないがSR-4としてドキュメント整備を推奨

## artifacts
- docs/workflows/workflow-harness-refactoring/threat-model.md, report, STRIDE脅威分析

## next
- criticalDecisions: Serena MCPサーバーcwd制約設定(TM-D1), hookバックアップ個別指定削除(TM-D2), dodChecks動作確認テスト先行(TM-D5)
- readFiles: .mcp.json, workflow-harness/hooks/pre-tool-guard.sh, workflow-harness/mcp-server/src/phases/defs-stage1.ts, workflow-harness/mcp-server/src/phases/defs-a.ts, workflow-harness/mcp-server/src/state/types-core.ts
- warnings: TM-04(hook誤削除)はimpact=criticalのため削除コマンド実行前にファイル名の二重確認を行うこと。TM-07(dodChecks初活用)は実行パス未検証のためテスト先行必須
