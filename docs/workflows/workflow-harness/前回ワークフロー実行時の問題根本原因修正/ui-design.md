# UI設計: 前回ワークフロー実行時の問題根本原因修正

## サマリー

本タスクはワークフロープラグインのバックエンド問題修正に限定される。
UIコンポーネント、画面、インタラクション、デザインに変更はない。
修正対象はhooksファイル2つとMCPサーバーのTypeScriptファイル3つである。
全ての修正はCLI/API実装変更でありユーザーインターフェース層には影響しない。
フロントエンドのコンポーネントやスタイルへの変更は一切発生しない。

## コンポーネント設計

本タスクではUIコンポーネントの新規作成や既存変更は発生しない。
修正対象はワークフロープラグインの内部メカニズムのみである。
具体的にはloop-detector.js、bash-whitelist.js、start.ts、scope-validator.ts、next.tsが対象である。
これらはCLIツールのバックエンド実装であり画面表示要素は含まない。
Storybookストーリーの追加や変更も不要である。

## 画面設計

本タスクでは画面レイアウト、UI要素の配置、ボタン、フォーム、テーブル等のコンポーネントに変更はない。
画面間の遷移フロー、ユーザーインタラクション、視覚的スタイルにも変更はない。
タスクの性質はワークフロー実行エンジンの内部メカニズム改善であり、ユーザーが直接操作するUIレイヤーには影響を与えない。
レスポンシブデザイン、アクセシビリティ、SEO要件への影響も一切ない。
以上の理由からUI設計フェーズでの画面変更成果物は該当なしとする。

## CLIインターフェース設計

本タスクの修正はCLIフック（loop-detector.js、bash-whitelist.js）とMCPサーバー内部に閉じる。
ユーザーが直接操作するCLIコマンド体系（workflow start/next/status等）に変更はない。
loop-detectorのエラーメッセージ出力形式は既存フォーマットを維持し、stderrへの出力チャネルも変更しない。
bash-whitelistに追加するgit checkout --とgit restoreコマンドは既存のホワイトリスト判定ロジックに統合される。
CLIの引数パーサーや対話的プロンプトへの影響は一切発生しない。

## エラーメッセージ設計

FIX-3（loop-detector stdin競合）の修正により、intermittentな「No stderr output」エラーメッセージが解消される。
stdinのerrorイベントとendイベントの競合をeventHandledフラグで防止し、二重発火を排除する。
FIX-2（スコープバリデータ）では、preExistingChangesに該当するファイルをスコープ検証エラーから除外する。
スコープ違反検出時のエラーメッセージ形式は既存の「Out of scope files detected」フォーマットを維持する。
FIX-4のしきい値変更（10→20）により、大規模実装時の誤検知エラーが減少する。
FIX-5のホワイトリスト追加により、git checkout --やgit restoreコマンドのブロックエラーが解消される。

## APIレスポンス設計

MCPサーバーのworkflow_start APIレスポンスにpreExistingChangesフィールドを内部的に追加する。
このフィールドはworkflow-state.jsonのscopeオブジェクト内に永続化され、外部APIレスポンスには露出しない。
workflow_next APIの内部処理でvalidateScopePostExecutionにpreExistingChangesを引数として渡す。
既存のAPIレスポンス形式（success, message, phase等）に変更はなく後方互換性を維持する。
MCPツールのスキーマ定義やパラメータ仕様にも変更は発生しない。

## 設定ファイル設計

workflow-state.jsonのscopeオブジェクト内にpreExistingChangesフィールド（文字列配列）を追加する。
このフィールドはworkflow_start実行時にgit diff --name-only HEADの結果を記録する。
loop-detector.jsのEDIT_THRESHOLDSオブジェクトのimplementationとrefactoringの値を10から20に変更する。
bash-whitelist.jsのWHITELIST_PATTERNS配列にgit checkout --とgit restoreのパターンを追加する。
bash-whitelist.jsのBLACKLIST_PATTERNS配列にgit checkout -bとgit checkout .とgit restore .のパターンを追加する。
.claude/settings.jsonやCLAUDE.mdへの設定変更は不要である。
既存の設定ファイルフォーマットとの後方互換性は完全に維持される。
preExistingChangesフィールドが存在しない旧状態ファイルでも正常に動作するようフォールバック処理を実装する。
scope-validator.tsではpreExistingChangesがundefinedの場合に空配列として扱うガード処理を追加する。
loop-detector.jsのしきい値変更は定数値の変更のみであり設定ファイルのスキーマ変更は伴わない。
全ての設定変更はコード内の定数として管理され外部設定ファイルへの依存を増やさない方針とする。
