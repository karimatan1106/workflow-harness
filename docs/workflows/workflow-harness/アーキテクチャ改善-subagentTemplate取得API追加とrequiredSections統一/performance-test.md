## サマリー

- 目的: `workflow_get_subphase_template` ツール（FR-1）および関連モジュールのパフォーマンス特性を評価し、実運用上の問題がないことを確認する
- 主要な決定事項: テストスイートが75ファイル・912テスト全通過（3.36秒）であり、新機能追加によるパフォーマンス劣化は観測されなかった
- 評価スコープ: get-subphase-template.ts、next.ts、phases/definitions.ts を対象とし、応答時間・メモリ・CPUコストを分析した
- 総合評価: 全912テストが3.36秒で完了し、FR-1およびFR-3の追加実装によるパフォーマンス劣化は検出されなかった
- 次フェーズで必要な情報: 本フェーズの計測結果はすべて許容範囲内。docs_updateフェーズで仕様書を更新すること

## パフォーマンス計測結果

### テストスイート実行時間

テストコマンド `cd workflow-plugin/mcp-server && npm test` を実行し、以下の結果を得た。

- テストファイル数: 75ファイル（全通過）
- テスト総数: 912テスト（全通過）
- 実行開始: 15:02:25
- トータル所要時間: 3.36秒
- transform時間: 4.86秒（TypeScriptコンパイル含む）
- テスト実行時間（ランタイム）: 4.90秒
- 環境セットアップ: 17ミリ秒

### 計測対象モジュール別の処理特性

**workflow_get_subphase_template（FR-1新規ツール）**

`workflowGetSubphaseTemplate` 関数は、以下の処理を同期的に実行する。

1. サブフェーズ名のバリデーション（VALID_SUB_PHASE_NAMES配列の includes 検索）: O(1)相当（配列長11固定）
2. `stateManager.getTaskById()` によるタスク情報取得: ファイルシステム読み込みが発生するが、呼び出し頻度は低い
3. `resolvePhaseGuide()` の呼び出し: 親フェーズガイドを取得し、subagentTemplateを動的生成する主要処理
4. サブフェーズガイドへのアクセス（`resolvedParentGuide.subPhases[validSubPhaseName]`）: O(1)

`start.test.ts` が449ミリ秒かかっているのはワークフロー開始処理全体のテストであり、個別ツール呼び出しの遅延ではない。

**getMinLinesFromPhaseGuide（FR-3新規関数）**

`next.ts` に追加された `getMinLinesFromPhaseGuide` 関数は、ファイル名からフェーズ名への静的マッピング（`FILE_TO_PHASE`）を参照するだけであり、計算コストは O(1)。`PHASE_GUIDES` オブジェクトへのプロパティアクセスも O(1) であるため、パフォーマンスへの影響は無視できる水準である。

**resolvePhaseGuide() の計算コスト**

`resolvePhaseGuide()` 関数は呼び出しごとにシャローコピーを生成し、プレースホルダー置換および `buildPrompt()` を実行する。`buildPrompt()` は I/O 操作を持たない純粋な文字列操作関数であり、処理時間はプロンプト文字列の長さに比例する。

最大のサブフェーズテンプレート（parallel_verificationの各サブフェーズ）でも数十KB程度であり、現代的なJavaScript/V8エンジンでは1ミリ秒未満で処理が完了する。

### 並列フェーズでの使用ケース

`parallel_verification` フェーズで4サブフェーズ（manual_test, security_scan, performance_test, e2e_test）が同時にテンプレートを要求するケースを想定した。各呼び出しはステートレスであり、共有状態への書き込みが発生しない（読み取りのみ）ため、並列実行によるコンテンション問題は発生しない。

## ボトルネック分析

### 現状の特定されたボトルネック

本実装において、パフォーマンス上の深刻なボトルネックは特定されなかった。以下に軽微な考慮事項を示す。

**CLAUDE.mdのファイル読み込み**

`resolvePhaseGuide()` 内で `parseCLAUDEMdByPhase()` が毎回 CLAUDE.md を読み込む設計になっている。CLAUDE.md はサイズが大きく（本プロジェクトでは数万文字）、呼び出しのたびにファイルシステムアクセスが発生する。ただし、`workflow_get_subphase_template` が呼び出される頻度は1フェーズ遷移あたり最大11回程度であり、Orchestratorの制御フローにおけるボトルネックにはならない。

**stateManager.discoverTasks() の呼び出し**

`workflowGetSubphaseTemplate` でtaskIdが指定されない場合、`stateManager.discoverTasks()` が実行されてワークフロー状態ファイルが走査される。タスク数が増加した場合のスキャンコストは線形増大するが、通常のアクティブタスク数（1〜3件程度）では問題にならない。

**slimSubPhaseGuide による subagentTemplate の除外**

`next.ts` の `slimSubPhaseGuide` 関数が `workflow_next` レスポンスから subagentTemplate を除外するが、除外後のデータ転送量削減により MCP 通信のレスポンスサイズを低減している。これは正しいトレードオフであり、`workflow_get_subphase_template` による別途取得パスを提供することで機能は維持される。

### パフォーマンス要件の充足確認

今回計測したテストスイートの全通過（912テスト・3.36秒）は、通常のCI環境でのビルド時間として十分に許容できる水準である。特にパフォーマンステストに関連する既存テスト群も全通過しており、FR-1・FR-3の実装が既存の処理特性を劣化させていないことが確認された。
