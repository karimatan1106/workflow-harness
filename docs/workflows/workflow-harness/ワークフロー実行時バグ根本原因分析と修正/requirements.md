# ワークフロー実行時バグ根本原因分析と修正 - 要件定義書

## サマリー

- 目的: research フェーズで特定された根本原因（RCA-1〜RCA-3）に対して、修正対象と非修正対象を明確に区分し、実装可能な要件として定義する
- 主要な決定事項: RCA-1（next.ts のデッドコード削除）のみを修正対象とする。RCA-2（hasRedirection と regex パターンの不整合）および RCA-3（task-index.json の MCP サーバー非連携）は修正対象外とする
- 次フェーズで必要な情報: next.ts の regression_test ブロック内（line 336-346）のデッドコードブロックを削除するための具体的な変更内容

---

## 修正対象の分類

本要件定義では、調査結果に基づき3つの根本原因（RCA）を分類した。

### RCA-1: 修正必須（高優先度）

`next.ts` の regression_test フェーズブロック（line 336-346）に存在するデッドコードを削除する。
このコードブロックは `if (currentPhase !== 'regression_test')` という条件を含むが、
この条件式は regression_test ブロック内に配置されているため常に false となる。
つまりハッシュチェックロジックは絶対に実行されず、コードの意図が不明確になっている。

### RCA-2: 修正対象外（中優先度）

`bash-whitelist.js` の `hasRedirection` 関数とブラックリスト regex パターンのスペース要求の差異は、
それぞれ異なる用途（関数はコマンド全体のリダイレクト検出、regex は特定パターンのマッチ）で使用されており、
実際に問題が発生した事例は確認されていない。変更による副作用リスクが便益を上回るため、今回は対象外とする。

### RCA-3: 修正対象外（低優先度）

task-index.json と workflow-state.json の同期欠如については、30 秒 TTL への短縮（FQ-2 対策）と
commit/push フェーズの早期リターン処理（FIX-2）によって実用上の影響が解消済みである。
根本修正は state-manager.ts および MCP サーバー全体への大規模変更を要するため、今回のスコープからは除外する。

---

## 機能要件

### FR-1: デッドコードブロックの削除

対象ファイル: `workflow-plugin/mcp-server/src/tools/next.ts`

削除対象となるブロックは、regression_test フェーズのハンドラー内に存在する。
具体的には、条件式 `if (currentPhase !== 'regression_test')` で始まり、
`recordTestOutputHash` の呼び出しと失敗時のエラーリターンを含むブロック全体を削除する。

削除後は、testing フェーズと同様に、コメントのみを残す形式を採用する。
コメントには「ハッシュ重複チェックはスキップ（record-test-result.ts 側で対処済み）」という旨を記載する。

削除するコードの範囲（research.md の調査結果より）:
- 開始行: コメント「ハッシュ重複チェック（regression_testフェーズでは自己参照が発生するためスキップ）」
- 終了行: if ブロック全体（5〜6行）が削除対象

### FR-2: import 文の整理

`next.ts` において `recordTestOutputHash` が regression_test ブロックのデッドコード内でのみ使用されている場合、
デッドコード削除後に当該関数の import が未使用になる可能性がある。
削除後にコンパイルエラーまたはリンターの警告が発生しないか確認し、必要に応じて import 文を整理する。

この作業は FR-1 の削除と合わせて実施する。import 文の削除は、関数が他の箇所でも使用されていないことを確認した上で実施する。

### FR-3: 変更後のコンパイル確認

TypeScript のトランスパイル（`npm run build`）を実行し、ビルドエラーがないことを確認する。
変更対象は `next.ts` 1 ファイルのみであり、影響範囲は限定的である。

---

## 非機能要件

### NFR-1: コードの可読性向上

デッドコード削除後のコードは、testing フェーズのハッシュチェックスキップ処理（line 267-270）と
同様の構造を持つこと。具体的には、スキップする理由をコメントで明示し、
コードの読者が設計意図を誤解しないよう配慮する。

削除後のコメントは「ハッシュ重複チェックは record-test-result.ts 側で対処済み」という内容を含むこと。
これにより、将来のメンテナーが同様の問題を再導入するリスクを低減する。

### NFR-2: 既存の動作を変更しない

デッドコードブロックは「絶対に実行されない」コードであるため、削除後も動作に変化はない。
ただし、削除前後で `workflow_next` の regression_test → parallel_verification 遷移の
成功・失敗条件が変わらないことを設計レビューで確認すること。

regression_test フェーズでのハッシュ重複チェックは `record-test-result.ts` の line 422 で
空配列を渡すことで既に解決済みであり、`next.ts` 側の変更はこの動作に影響しない。

### NFR-3: 変更範囲の最小化

修正は `next.ts` の特定ブロック（10 行以内）の削除と、必要に応じた import 文の整理のみとする。
`record-test-result.ts`、`test-authenticity.ts`、`bash-whitelist.js`、`definitions.ts`、
`discover-tasks.js` については今回の修正対象には含めない。

---

## 前提条件と制約

### 前提条件

`record-test-result.ts` の regression_test 対応（line 422 で空配列を渡す設計）は
正常に機能しており、`next.ts` のデッドコード削除後もこの動作は維持される。
この前提が崩れる場合は、本要件定義を見直す必要がある。

`next.ts` の testing フェーズにおけるハッシュチェックスキップ処理（line 267-270）は、
既に正しいコメントと実装を持っており、今回の変更では触れない。

### 制約

MCP サーバーのコアモジュールを変更した場合、変更後にサーバーを再起動してから
次のフェーズへ進む必要がある（CLAUDE.md ルール 22 参照）。
`next.ts` は tools ディレクトリ配下のファイルであり、再起動が必要なコアモジュール
（artifact-validator.ts、definitions.ts、state-manager.ts）には含まれないが、
ビルド後の動作確認は実施すること。

---

## 受け入れ基準

以下の基準を満たすことで本タスクの完了とみなす。

- `next.ts` の regression_test ブロック内のデッドコード（常に false となる if 文とその中身）が削除されていること
- 削除後に testing フェーズと同様のコメントが残されており、設計意図が明確であること
- `npm run build` が成功し、TypeScript のコンパイルエラーがないこと
- 未使用 import が存在しないこと（import 文が整理されていること）
- `workflow_next` の regression_test → parallel_verification 遷移の動作が変更前後で同一であること
