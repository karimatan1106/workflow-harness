# Threat Model: remove-minimax-settings

## overview
本タスクは MiniMax バックエンド参照を含む 4 つのドキュメントファイル（CLAUDE.md 内の関連セクション、feedback_no-minimax.md、MEMORY.md 索引の当該行、canboluk.md 研究引用）からの記述削除のみで構成される。コード、API、データフロー、認証、権限設定、ランタイム挙動には一切影響しない。したがって STRIDE 観点での高リスク脅威は存在しないが、フェーズ規約に従い記録する。

## assets
- A-1: CLAUDE.md (プロジェクト設定ドキュメント、ハーネス起動ルールを含む権威ファイル)
- A-2: feedback_no-minimax.md (MiniMax 使用禁止を宣言する memory ガードルール)
- A-3: MEMORY.md (feedback ディレクトリ索引エントリ)
- A-4: canboluk.md (外部研究引用、MiniMax 言及を含む 1 行)

## threats
STRIDE フレームワークで評価する。影響範囲がドキュメント削除に限定されるため、大半の観点は該当しない。

- T-1 (Spoofing): Severity N/A — 本タスクに認証・認可フローの変更は含まれず、なりすましの攻撃面を新規に導入・露呈しない。
- T-2 (Tampering): Severity Low — Edit ツールの old_string 誤指定により意図しないテキスト範囲を書き換える可能性がある。M-1, M-2, M-3 で緩和する。
- T-3 (Repudiation): Severity N/A — 全操作は git コミットで履歴化され、作業者・時刻・差分が追跡可能なため操作の否認は成立しない。
- T-4 (Information Disclosure): Severity N/A — 削除対象の MiniMax 言及は既に「使用禁止」と公開宣言された運用方針であり、機密情報・鍵・内部設計を含まない。
- T-5 (Denial of Service): Severity N/A — ドキュメント変更のみでランタイム、ビルドパイプライン、ハーネス実行パスへの副作用はない。
- T-6 (Elevation of Privilege): Severity N/A — ファイル権限、hook 実行権限、ツール許可リストには手を加えない。

## mitigations
- M-1: Edit 呼び出し時は old_string に MiniMax 前後 2 行以上のコンテキストを含め、同名 MiniMax 言及行が複数ある場合は replace_all=false と個別識別で限定する (対: T-2)
- M-2: 各ファイル編集後に grep で "MiniMax" 残存ゼロと近傍非 MiniMax 行の保持を検証し、過剰削除と削除漏れを同時に検知する (対: T-2)
- M-3: コミット前に git diff --stat と git diff を確認し、変更行数が impact-analysis.md の想定範囲 (4 ファイル、合計 10 行以下) に収まることを目視確認する (対: T-2)
- M-4: 各フェーズ遷移で harness の pre_validate を実行し、AC-1〜AC-4 の検証状態がフェーズ DoD を満たすことを確認する (対: 全 T を横断)

## residualRisks
- RR-1: CLAUDE.md の「MiniMax 用 env 設定は削除済み」警告文そのものも削除対象に含まれる。将来の読者は当該経緯を git 履歴から辿る必要が生じるが、これはユーザー合意済みのトレードオフであり許容する。

## decisions
- D-TM-1: STRIDE 6 観点の体系的レビューにより、高リスク脅威は検出されなかったと判定する
- D-TM-2: 意図しない改変 (T-2) は Edit 範囲限定 (M-1)、grep 検証 (M-2)、git diff レビュー (M-3) の三段階で緩和する
- D-TM-3: 削除対象は公開済み運用方針のため情報漏洩 (T-4) リスクは存在せず、機密扱いの追加手順は不要とする
- D-TM-4: 全脅威は Mitigated もしくは N/A に分類され、residual risk は RR-1 の 1 件のみとする
- D-TM-5: 本タスクに対して動的セキュリティスキャン・SAST・依存関係監査の追加実施は不要と判断する

## artifacts
- threat-model.md

## next
- next: security_review
- input: requirements.md, threat-model.md
