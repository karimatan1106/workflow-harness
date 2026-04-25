# impact_analysis

## summary
- 本タスクは MiniMax 関連記述のライブ参照 4 ファイルからの削除のみで、ソースコード変更を含まない。
- 影響範囲はドキュメント層に閉じており、ビルド成果物・実行時挙動・ハーネスゲートは変動しない。
- 全 AC の重大度は Low、可逆性は High、影響半径は Documentation のみで、git revert で完全復元できる。
- CLAUDE.md の非 MiniMax 注記（存在しない hook 警告・permissions 見直し案内）はユーザー合意に基づき同一セクション削除に含める。
- hook 警告は .claude/state/workflows 配下の過去バックアップにのみ存在し、ライブの運用ドキュメントに重複情報はない。

## codeImpact
- TypeScript / JavaScript ソース無変更のため ast-grep、ts-morph、madge、tsc、vitest --related いずれも再評価不要である。
- 依存グラフと公開 API シグネチャに差分が生じないため DCI 再構築は不要である。
- ビルド成果物 dist / bundle に差分が発生しないため配布物の再検証は不要である。
- Node プロセスが読み込む runtime config は `~/.config/rtk/config.toml` と settings.json のみで、今回の削除対象はそれらに触れない。

## documentationImpact
- CLAUDE.md: 行 19〜28 の `## workflow-harness/.claude/settings.json 注意事項` セクション全体を削除し、MiniMax 注記・hook ファイル警告・permissions 見直し案内をまとめて除去する。
- feedback_no-minimax.md: ファイル自体を削除し、再発防止ガード文書を消失させる。ユーザー合意済みのため AC-3 で file-absent 検証のみ行う。
- MEMORY.md: 行 96 の `feedback_no-minimax.md` 索引行 1 行を削除し、表ヘッダと他 feedback 行の整合性を保つ。
- canboluk.md: 行 67 の MiniMax 言及行 1 行を削除し、表ヘッダとカラム整合を保つ。
- 情報冗長性確認: 存在しない hook ファイル警告はライブドキュメントに重複存在しないため、削除によりハーネス運用知識の一次情報は hook ファイル実体に一本化される。
- permissions 見直し案内は .claude/rules/ 配下に対応ルールが存在しないため、削除後に参照孤児を生まない。

## harnessImpact
- ワークフローの 30 フェーズ定義・DoD・L1〜L4 ゲート・RTM チェーンに影響なし。
- サブエージェント（coordinator / worker / hearing-worker）のプロンプト契約に変更なし。
- MCP ツール（harness_start、harness_get_subphase_template、harness_validate_artifact 等）の入出力スキーマに変更なし。
- 実行中の他タスク（別 taskId 配下）への影響なし、ロック競合やステート破損リスクなし。

## gitCiImpact
- git 履歴は immutable のため過去コミット中の MiniMax 言及は残存し、history からの完全消去は行わない（意図的）。
- CI パイプラインはコード変更がないため lint / test / build ジョブはすべて baseline と同一結果を返す。
- 削除コミットは 1 本にまとめ、4 ファイル変更・1 ファイル削除を同一 commit で管理し revert を容易にする。
- プリコミット hook（存在する場合）はドキュメント変更のみのためブロック条件に該当しない。

## userImpact
- CLAUDE.md 閲覧者は settings.json 注意事項セクションが消える結果、MiniMax 参照だけでなく hook 警告も画面上から消失する。
- オンボーディング文書は短縮されるが、必要な運用情報（hook の実在性や permissions 設計）は ADR およびスキルファイルに委ねる前提となる。
- feedback_no-minimax.md を参照していた自動索引・grep ベースの検索結果は hit 数が減少するが、エラーには至らない。
- 新規タスク開始時のハーネス挙動は不変で、ユーザー操作フローに差分はない。

## riskMatrix
| AC | Severity | Reversibility | BlastRadius | 備考 |
|----|----------|---------------|-------------|------|
| AC-1 | Low | High | Documentation | CLAUDE.md セクション全体削除、git revert で完全復元可能 |
| AC-2 | Low | High | Documentation | canboluk.md の 1 行削除、表構造は残存ヘッダで健全 |
| AC-3 | Low | High | Documentation | feedback_no-minimax.md ファイル削除、索引側の整合は AC-4 で担保 |
| AC-4 | Low | High | Documentation | MEMORY.md の索引行 1 行削除、他 feedback 行に副作用なし |
| AC-5 | Low | High | Documentation | 4 操作統合の DoD 確認、並列実行可で順序依存なし |

## decisions
- D-IA-1: コードに一切触れないため、テスト設計は file-exists / grep 不在検証のみで十分と判断する。
- D-IA-2: CLAUDE.md の非 MiniMax 内容（hook 警告・permissions 案内）もユーザー合意に基づき同一セクション削除範囲に含める。
- D-IA-3: 全 AC のリスクは Low に分類し、git revert を回復手段として採用する（スナップショット退避は不要）。
- D-IA-4: 4 ファイル操作は相互依存を持たないため並列実行可能と認定し、順序制約を設けない。
- D-IA-5: ドキュメント削除は 1 本のコミットに集約し、変更の意図と revert 単位を一致させる。

## artifacts
- docs/workflows/remove-minimax-settings/impact-analysis.md

## next
- next: requirements
- input: docs/workflows/remove-minimax-settings/scope-definition.md, docs/workflows/remove-minimax-settings/research.md, docs/workflows/remove-minimax-settings/impact-analysis.md
