# ワークフロー実行時バグ根本原因分析と修正 - 仕様書

## サマリー

本タスクの目的は、`workflow-plugin/mcp-server/src/tools/next.ts` の regression_test フェーズハンドラー内に存在するデッドコードを削除し、コードの可読性と保守性を向上させることである。
修正対象は RCA-1（デッドコード削除）のみとし、変更ファイルは `next.ts` の 1 ファイルに限定する。
削除後は testing フェーズのコメント形式に揃えることで、コードスタイルの一貫性を維持する。
`recordTestOutputHash` 関数の import 文は、regression_test ブロック内でのみ参照されているため、デッドコード削除と同時に除去が必要となる。
次フェーズでは、line 336-346 の if ブロック全体（コメント行含む）を削除し、line 28 から `recordTestOutputHash` を除去することが主要な作業となる。

---

## 概要

本仕様書は、調査結果および要件定義書の決定事項に基づき、`next.ts` の regression_test フェーズハンドラーに存在するデッドコードを安全に削除するための変更内容を明確に定義する。
当該デッドコードは `currentPhase !== 'regression_test'` という条件式を持つ if ブロックであり、この条件は実行文脈上で常に false となるため、ブロック内のコードは一切実行されない。
コメントが「スキップ」と記載しているにもかかわらず、実装内容がハッシュチェックの実行を試みる構造になっており、設計意図と実装の間に乖離が生じている状態である。
この乖離を解消することで、将来のメンテナーが誤ってデッドコードを参照したり、同様のパターンを再導入するリスクを低減する。
変更はコードの動作に影響しない純粋なクリーンアップ作業であり、既存のテストカバレッジで品質を保証できる。
変更範囲は `next.ts` 内の 2 箇所（if ブロックと import 文）に限定されており、他モジュールへの波及的な変更は発生しない。

---

## 修正対象の分類と根拠

本仕様は、要件定義書の調査結果に基づいて 3 つの根本原因（RCA）を分類し、各 RCA の修正対象・修正対象外を明確に区分する。

### RCA-1: 修正必須（高優先度）

`next.ts` の regression_test フェーズブロック（line 336-346）に存在するデッドコードを削除する。
ハッシュチェックロジックは、常に false になる条件分岐内に配置されているため一切実行されない。
この問題はコードの可読性を低下させており、当該関数の影響範囲を把握するうえで誤解を招く構造となっている。
削除によって動作は変わらないが、コードを読む開発者が設計意図を正確に理解できるようになる。

### RCA-2: 修正対象外（中優先度）

`bash-whitelist.js` の `hasRedirection` 関数とブラックリスト regex パターンの間には、スペース要求の差異という不整合が存在する。
この差異は、関数がコマンド全体のリダイレクト検出を担い、regex が特定パターンのマッチ（コマンド単位での用途）を担うという設計上の違いに由来する。
実際に問題が発生した事例は調査結果から検出されておらず、変更による副作用リスクが便益を上回ると判断されたため、今回のスコープから除外する。

### RCA-3: 修正対象外（低優先度）

task-index.json と workflow-state.json の同期欠如という問題は、discover-tasks.js がキャッシュを TTL 管理している構造に起因する。
この同期欠如は 30 秒 TTL への短縮（FIX-2 対策）と commit/push フェーズの早期リターン処理によって実用上の影響が解消済みである。
根本修正は state-manager.ts および MCP サーバー全体への大規模変更を要するため、今回は対策なしで除外する。

---

## 前提条件と制約

### 前提条件

本仕様が成立するための前提は以下の通りである。

`record-test-result.ts` の regression_test 対応（空配列を渡す設計）は正常に機能しており、`next.ts` のデッドコード削除後もこの動作が維持されること。
この前提が崩れる場合は、本要件定義を見直す必要がある。
`next.ts` の testing フェーズにおけるハッシュチェックスキップ処理（line 267-270）は既に正しい実装を持っており、今回の変更では触れない。

### 制約

ルールとして、MCP サーバーのコアモジュールを変更した場合は、変更後にサーバーを再起動してから次のフェーズへ進む必要がある。
`next.ts` は tools ディレクトリ配下のファイルであり、再起動が必要なコアモジュール（artifact-validator.ts、definitions.ts、state-manager.ts）には含まれないが、ビルド後の動作確認は実施すること。
修正は `next.ts` の特定ブロック（10 行以内）の削除と、必要に応じた import 文の整理のみとする。
非修正対象の `record-test-result.ts`、`test-authenticity.ts`、`bash-whitelist.js`、`definitions.ts`、`discover-tasks.js` は今回のスコープ配下には含めない。

---

## 変更対象ファイルと変更内容

### 変更対象

対象ファイルは `workflow-plugin/mcp-server/src/tools/next.ts` の 1 ファイルのみとする。
他のファイル（`record-test-result.ts`、`test-authenticity.ts`、`bash-whitelist.js`、`definitions.ts`）は本タスクのスコープには含めない。

### 変更内容の全体像

本タスクで実施する変更は以下の 2 点に集約される。

第 1 に、regression_test フェーズハンドラー内のデッドコードブロックを削除する。
第 2 に、削除によって未使用になる `recordTestOutputHash` 関数の import 文を整理する。
どちらの変更もコードの動作には影響せず、可読性と保守性を高める純粋なクリーンアップ作業である。

---

## 変更仕様（FR-1）: デッドコードブロックの削除

### 削除対象の特定

`next.ts` の regression_test フェーズ処理ブロック内、line 336-346 付近に以下のコードが存在する。
このコードはコメントと if ブロックで構成されており、条件式が常に false となるためデッドコードと判定される。

削除するコードの内容を以下に示す（コードフェンス内は参照情報）。

```typescript
// ハッシュ重複チェック（regression_testフェーズでは自己参照が発生するためスキップ）
if (currentPhase !== 'regression_test') {
  const existingHashes = taskState.testOutputHashes || [];
  const hashResult = recordTestOutputHash(testResult.output, existingHashes);
  if (!hashResult.valid && testStrict) {
    return {
      success: false,
      message: `リグレッションテスト出力が以前と同一です（コピペの可能性）。実際にテストを実行してください。`,
    };
  }
}
```

### 問題の根拠

このブロックは `currentPhase === 'regression_test'` が確定している文脈に配置されている。
そのため `currentPhase !== 'regression_test'` という条件は評価時に必ず false となり、ブロック内のコードは一度も実行されない。
コメントが「スキップ」と記載しているにもかかわらず、実際の処理内容はハッシュチェックを「実行しようとして失敗する」コードであり、設計意図と実装が乖離している。
削除する範囲は、開始行のコメント行から if ブロック全体の終了行までである。

### 削除後に残すコメント

削除後は testing フェーズのスキップコメント（line 267-269）と同様の構造を採用する。
具体的には以下の内容のコメント行を 1 行追加する。

```typescript
// ハッシュ重複チェックは record-test-result.ts 側で対処済みのためスキップ
```

このコメントにより、将来のメンテナーが同様のデッドコードを再導入するリスクを低減する。
ハッシュ重複チェックの実際の制御は `record-test-result.ts` の regression_test 対応箇所（空配列渡し設計）が担っており、`next.ts` 側ではこの処理に関与しない設計であることが明示される。

---

## 変更仕様（FR-2）: import 文の整理

### 削除対象の特定

`next.ts` の line 28 に以下の import 文が存在する。

```typescript
import { validateTestAuthenticity, recordTestOutputHash } from '../validation/test-authenticity.js';
```

FR-1 のデッドコード削除後、`recordTestOutputHash` 関数の呼び出し箇所は next.ts 内に残存しない。
`validateTestAuthenticity` は testing フェーズおよび regression_test フェーズの真正性検証で引き続き使用されるため削除しない。

### 削除後の import 文

変更後の import 文は以下の形式になる。

```typescript
import { validateTestAuthenticity } from '../validation/test-authenticity.js';
```

`recordTestOutputHash` のみを名前付き import から除去することで、TypeScript コンパイル時の未使用 import 警告（リンターの警告を含む）を解消する。
なお、リンターの警告やビルドエラーが発生した場合は、当該関数の import 記述を再確認してから再ビルドを実施すること。

---

## 変更仕様（FR-3）: コンパイル確認

### ビルド確認の必要性

変更後には `npm run build` を実行してトランスパイルエラーがないことを確認する。
対象変更が 1 ファイルの限定的なコード削除であるため、型エラーや構文エラーが発生するリスクは低い。
ただし import 文の修正が正しく行われなかった場合に未使用参照エラーが発生する可能性があるため、ビルド成功の確認は必須とする。
ビルドエラーが発生した場合は、エラーメッセージの内容に従って import 文または削除範囲を再確認してから再実行する。

---

## 非機能要件

### NFR-1: コードの可読性向上

デッドコード削除後のコードは、testing フェーズのハッシュチェックスキップ処理（line 267-270）と同様の構造を持つこと。
具体的には、スキップする理由をコメントで明示し、コードの読者が設計意図を誤解しないよう配慮する。
削除後のコメントは「ハッシュ重複チェックは record-test-result.ts 側で対処済み」という内容を含むこと。
これにより、将来のメンテナーが同様の問題を再導入するリスクを低減できる。

### NFR-2: テスト動作の不変性

デッドコードブロックは「絶対に実行されない」コードであるため、削除後も動作に変化はない。
regression_test フェーズから parallel_verification フェーズへの遷移ロジックは変更されず、失敗条件および解決済みのフェーズブロック問題も影響を受けない。
削除前後で `workflow_next` の regression_test → parallel_verification 遷移の成功・失敗条件が変わらないことを設計レビューで確認すること。

### NFR-3: 変更範囲の最小化

修正は `next.ts` の特定ブロック（10 行以内）の削除と、必要に応じた import 文の整理のみとする。
コメントの文言や形式も、既存のコードスタイルから逸脱しないよう配慮すること。
関連する他のモジュールへの波及的な変更は行わないこと。

---

## 受け入れ基準

本タスクの完了条件は以下の通りである。

- `next.ts` の regression_test ブロック内のデッドコード（コメント行を含む if ブロック全体）が削除されていること
- 削除後の箇所に、設計意図を示すコメントが 1 行追加されていること
- line 28 の import 文から `recordTestOutputHash` が除去されていること
- `validateTestAuthenticity` の import は残存していること
- `npm run build` が成功し、TypeScript のコンパイルエラーが発生していないこと
- regression_test フェーズから parallel_verification フェーズへの遷移動作が変更前後で同一であること

---

## 実装計画

本仕様に基づく実装を以下の順序で実施する。各ステップは implementation フェーズで実行される。

第 1 ステップとして、`next.ts` の line 28 を読み込み、`recordTestOutputHash` 関数を import リストから除去する。
この変更は `validateTestAuthenticity` の import を維持したまま実施し、名前付き import の形式を正確に保つことが求められる。

第 2 ステップとして、regression_test フェーズハンドラー内の line 336-346 付近を読み込み、デッドコードブロックとそのコメント行を一括削除する。
削除対象となる行数は合計で約 10 行（コメント行 1 行 + if 文ブロック 9 行）であり、中身のコード全体が除去対象となる。

第 3 ステップとして、削除した位置にスキップ理由を示すコメント（1 行）を追加する。
コメント内容は FR-1 の「削除後に残すコメント」セクションに記載した形式に従う。

第 4 ステップとして、`workflow-plugin/mcp-server` ディレクトリで `npm run build` を実行し、TypeScript のコンパイルエラーが発生しないことを確認する。
エラーが発生した場合は、import 文の記述を再確認してから再ビルドする。

MCP サーバーの再起動は、`next.ts` がコアモジュール（artifact-validator.ts、definitions.ts、state-manager.ts）に該当しないため必須ではないが、ビルド後の動作確認として実施することが望ましい。
