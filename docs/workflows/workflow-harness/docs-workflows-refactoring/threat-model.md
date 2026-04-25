# Threat Model: docs-workflows-refactoring

taskId: 0963bf20-4201-494c-ad1b-32e6b476e97e
phase: threat_modeling
date: 2026-03-24

## summary

docs/workflows/ ディレクトリの整理タスクに対するSTRIDE脅威分析。コード変更なし、ファイルシステム操作のみのため攻撃面は限定的。主要リスクはデータ損失(削除誤り)とWindows固有のパス制約。

## stride

### Spoofing (なりすまし)

対象外。認証・認可を伴う操作なし。ローカルファイルシステム操作のみ。

### Tampering (改ざん)

- T-08: mv操作中にファイル内容が破損する可能性。特にWindows上でのエンコーディング不一致(UTF-8/Shift_JIS混在)によるファイル名化け。影響度: 低。発生確率: 低。

### Repudiation (否認)

対象外。監査証跡不要のローカル操作。各ステップでgit commitによる変更記録を行うため追跡可能。

### Information Disclosure (情報漏洩)

対象外。機密情報を含まないワークフロードキュメントの移動のみ。

### Denial of Service (サービス拒否)

- T-02: Windowsパス長制限(260文字)超過によるmv/cp失敗。カテゴリサブディレクトリ追加で既存パスが約20文字延長されるため、既に長い日本語ディレクトリ名で制限に到達する可能性がある。影響度: 中。発生確率: 中。

### Elevation of Privilege (権限昇格)

対象外。特権操作なし。

## decisions

- T-01: 半角カタカナ重複ペアの誤削除防止。diff検証で内容同一性を確認してから削除する。差分がある場合はマージ後に削除。全角版が存在しない場合は削除対象から除外する。
- T-02: Windowsパス長制限(260文字)超過の防止。移動先パスの文字数を事前にチェックし、超過する場合はディレクトリ名を短縮するか、LongPathsEnabled レジストリ設定に依存せず対応する。
- T-03: 日本語文字(全角カタカナ含む)のシェルエスケープ問題の防止。全てのパス引数をダブルクォートで囲む。変数展開時も "$var" 形式を徹底する。
- T-04: mv失敗時のデータ損失防止。cp -r で複製 + ls/diff で検証 + rm -rf で元を削除の3段階操作とする。mv の原子性に依存しない。
- T-05: .gitignore状態によるgit追跡の意図しない変化の防止。操作前に git check-ignore docs/workflows/ で除外状態を確認する。除外されていない場合は操作を中断し、要件を再確認する。
- T-06: 並列Worker実行時のディレクトリ競合防止。ステップ1-3(削除系)とステップ4(移動系)は依存関係があるため、ステップ4はステップ1-3完了後に実行する。同一ディレクトリへの同時操作を禁止する。
- T-07: ルーズ.mdファイルのディレクトリ化時の名前衝突防止。同名ディレクトリが既存の場合はスキップし手動確認を求める。

## risk_matrix

| ID | threat | impact | probability | mitigation | residual_risk |
|----|--------|--------|-------------|------------|---------------|
| T-01 | 非重複ディレクトリの誤削除 | high | low | diff検証 + 全角版存在確認 | very_low |
| T-02 | Windowsパス長超過 | medium | medium | 事前パス長チェック | low |
| T-03 | 日本語シェルエスケープ失敗 | medium | medium | 全パスをダブルクォート | low |
| T-04 | mv途中失敗によるデータ損失 | high | low | cp+verify+rm 3段階 | very_low |
| T-05 | gitignore不整合 | low | low | 事前check-ignore確認 | very_low |
| T-06 | 並列Worker競合 | medium | low | 依存関係に基づく直列化 | very_low |
| T-07 | .mdディレクトリ化時の名前衝突 | low | low | 既存チェック + スキップ | very_low |
| T-08 | エンコーディング起因のファイル名破損 | medium | low | UTF-8統一 + locale確認 | low |

## artifacts

| path | role |
|------|------|
| docs/workflows/docs-workflows-refactoring/threat-model.md | 本ファイル: 脅威モデル |
| docs/workflows/docs-workflows-refactoring/requirements.md | 要件定義(AC/RTM) |
| docs/workflows/docs-workflows-refactoring/research.md | 調査結果(重複ペア/削除対象一覧) |

## next

- planning フェーズに進行し、T-01〜T-08の緩和策を実装手順に組み込む
- 各実装ステップにpre-condition checkを設定(パス長検証、diff検証、gitignore確認)
- Worker分割時にT-06の依存関係制約を反映する
