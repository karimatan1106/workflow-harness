# Design Review

## background
hearing〜ui_design までの成果物をレビューし、整合性・抜け漏れ・設計破綻の有無を確認する。レビュー結果をtest_design以降の根拠とする。

## artifactChecklist
- hearing.md: 決定事項4件すべて後続成果物に反映済み
- scope-definition.md: scopeFiles 4件 + scopeDirs 2件 合計6パス明確
- research.md: hook-utils / MCP writer / state layout の実態を記録
- impact-analysis.md: 直接影響と間接影響、リスクマトリクスを掲載
- requirements.md: AC 5件 + RTM 5件、RTM requirement列にAC-N:接頭辞
- threat-model.md: STRIDE 6項目分析済み、対策つき
- planning.md: step1-8 の実装プラン、依存関係 DAG 明記
- state-machine.mmd: hook判定フロー 26行
- flowchart.mmd: rollout フロー 23行
- ui-design.md: CLI/DX 観点で60行、ADR可視性も記述済み

## crossArtifactConsistency
- D-001系列の「最小実装・外部依存なし」方針は全成果物で一貫
- D-002系列の「TOON読み取り追加でJSONと共存」は requirements / planning / threat-model で一致
- D-003系列の「bootstrap削除」は要件にも planning にも ui-design にも反映
- ACとRTMのマッピングに欠落なし: AC-1→F-004, AC-2→F-002, AC-3→F-001, AC-4→F-003, AC-5→F-005
- 「submodule分離の完成形として」という位置付けは hearing / background 各所に踏襲

## risksReopened
- hookのパフォーマンス（TOON読み取り+JSON読み取りの両経路実行）は許容範囲内と評価済みだが、stateファイル数が膨大な場合の挙動は未計測
- Windows/POSIX のパス差異は start.sh 内 pwd -P で吸収する方針だが、MSYS/Git-bash/WSL差異は追加検証余地あり

## openPoints
- readToonPhase関数のシグネチャは `(filePath: string) => string | undefined` で固定
- 戻り値型の一貫性を保つため既存getActivePhaseFromWorkflowStateとの連携を明文化する

## acDesignMapping
- AC-1: start.sh の絶対パス解決 + hook-utils.jsのTOON読み取り追加 → bootstrap不要でWrite解放
- AC-2: hook-utils.js に readToonPhase(filePath) を新設し、getActivePhaseFromWorkflowState 内で .toon フォールバック
- AC-3: .mcp.json と start.sh の STATE_DIR 絶対化 → 二重ネスト防止
- AC-4: getActivePhaseFromWorkflowState 既存 JSON 読み取り分岐を温存 → legacy 互換維持
- AC-5: docs/adr/ADR-029-hook-mcp-state-sync.md を新規作成 → Why ドキュメント化

## decisions
- D-001: 全成果物レビュー結果、整合性問題なし。test_design へ進めると判断する
- D-002: Windows/POSIX パス差異は test_design で手動検証ケースを明記して許容する
- D-003: state膨大時のhookパフォーマンスは regression フェーズで ベースライン測定対象とする
- D-004: readToonPhaseのシグネチャを string | undefined で固定し test case 定義に反映する
- D-005: 追加のD-001系列「最小実装」ポリシーを逸脱するような変更要請が出た場合は本レビューに戻って再評価する
- D-006: 本レビュー時点ではADR-029の草案は未作成。design フェーズとは切り離しimplementationで作成する

## artifacts
- 本ドキュメント design-review.md
- 次フェーズ test_design への入力

## next
- test_design フェーズへ進み各ACに対応するテストケースを定義する
- readToonPhase の単体テスト4件以上、統合テスト1件を目標とする
- 手動検証手順も test_design に含める

## constraints
- 既存設計の一貫性を維持
- 外部ライブラリ追加なし
- L1-L4決定的ゲートのみ
