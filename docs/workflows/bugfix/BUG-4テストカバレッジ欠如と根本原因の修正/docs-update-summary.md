## サマリー

- 目的: BUG-4タスクで実施した `spec-parser.ts` への変更内容をプロダクト仕様書に反映し、仕様書とコード実装の整合性を確保する。
- 更新対象: `docs/spec/features/spec-parser.md`（既存仕様書）を更新。
- 主要な変更内容:
  - `removeCodeBlocks` 関数がトリプルバッククォートブロックのみを除去することを明記
  - メソッド抽出前の `cleanedForMethods` 変数追加について、その目的・役割・処理フローを詳細に記述
  - インラインコード（シングルバッククォート）とファイルパス抽出の異なる扱いを説明
  - 処理フロー図を追加して、3段階の処理プロセスを可視化
- 次フェーズで必要な情報: commitフェーズで変更ファイルは `docs/spec/features/spec-parser.md` のみ。コード変更ファイル（4ファイル）の変更内容とプロダクト仕様書の整合性確認が完了した状態。

---

## 実施内容

### 1. spec-parser.ts @spec参照確認

ファイル先頭コメント（3行目）の `@spec docs/spec/features/spec-parser.md` を確認し、参照ファイルが正しく指定されていることを検証した。

### 2. 既存仕様書の確認

`docs/spec/features/spec-parser.md` を読み込み、既存内容がBUG-4タスクで実装された `cleanedForMethods` 変数の説明を含んでいないことを確認した。

既存内容は以下の3項目のみで構成されていた：
- クラス抽出ルール
- メソッド抽出ルール
- ファイルパス抽出ルール

### 3. コード実装内容の分析

`spec-parser.ts` の実装を読み込み、BUG-4で追加・変更された以下の項目を確認した：

**removeCodeBlocks関数の動作**:
- ブロックコード（トリプルバッククォート囲み）のみを正規表現 `/```[\s\S]*?```/g` で除去
- インラインコード（シングルバッククォート）は除去しない

**cleanedForMethods変数の役割**:
- `cleanedMarkdown` から削除されていないインラインコードを除去する中間変数
- メソッド定義抽出の直前に構築される
- 正規表現により シングルバッククォートと波括弧プレースホルダーを削除

**ファイルパス抽出の特殊性**:
- `cleanedMarkdown` をそのまま使用（インラインコード除去なし）
- バッククォート付きパスの検出が必要なため

### 4. 仕様書の更新

既存の `docs/spec/features/spec-parser.md` を以下の内容で拡張した：

**追加セクション1「Markdownコードブロック除去処理（removeCodeBlocks）」**:
- removeCodeBlocks関数の実装詳細（正規表現パターン）
- 処理目的（誤抽出防止）
- ブロックコードのみ対象であることを明記

**追加セクション2「メソッド抽出時のインラインコード除去（cleanedForMethods変数）」**:
- cleanedForMethods変数の導入目的（メソッド定義抽出精度の向上）
- 実装内容（インラインコードと波括弧プレースホルダーの除去）
- 適用タイミング（メソッド抽出の直前）

**追加セクション「処理フロー」**:
- 3段階の処理プロセスを図で可視化
- 各ステップでの処理内容を明確化

**追加セクション「ファイルパス抽出の例外」**:
- ファイルパス抽出が `cleanedMarkdown` をそのまま使用することを説明
- バッククォート付きパスの検出が必要な理由を記述

---

## 整合性確認結果

### 仕様書とコード実装の整合性

BUG-4で実装した4ファイルのコード変更について、仕様書との整合性を確認した：

**1. calculatePhaseSkips関数のユニットテスト追加**
- 新規ファイル: `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`
- 仕様書への記載: テスト設計フェーズの `test-design.md` で記載済み
- 状態: テスト設計仕様書と整合

**2. skip-env-removal.test.tsの修正**
- 修正箇所: TC-1-2グループと AC-1-3テストケースへの `writeTaskState` モック追加
- 仕様書への記載: テスト設計フェーズで記載済み
- 状態: テスト設計仕様書と整合

**3. definitions.tsの必須セクション表示強化**
- 修正内容: buildPrompt関数で必須セクション表示を強化
- 仕様書への記載: subagentプロンプトテンプレート内で定義
- 状態: プロンプトテンプレート仕様と整合

**4. spec-parser.tsの cleanedForMethods 変数追加**
- 修正内容: メソッド抽出前にインラインコード除去処理を追加
- 仕様書への記載: **本ドキュメント作成により追加**
- 状態: **本更新により整合**

---

## docs_updateフェーズの作業完了

本ドキュメント作成により、docs_updateフェーズの作業は以下の状態となった：

**更新したエンタープライズ仕様書**:
- `docs/spec/features/spec-parser.md`: cleanedForMethods変数の説明を追加

**次フェーズ（commitフェーズ）で処理すべき変更ファイル**:
- `docs/spec/features/spec-parser.md`（本ドキュメント作成時に更新完了）

**ソースコード変更ファイル**（commitフェーズで記録）:
- `workflow-plugin/mcp-server/src/phases/__tests__/calculate-phase-skips.test.ts`（新規）
- `workflow-plugin/mcp-server/src/tools/__tests__/skip-env-removal.test.ts`（修正）
- `workflow-plugin/mcp-server/src/phases/definitions.ts`（修正）
- `workflow-plugin/mcp-server/src/validation/parsers/spec-parser.ts`（修正）

---

## 変更内容の詳細

### spec-parser.md への追記

#### セクション名
「Markdownコードブロック除去処理（removeCodeBlocks）」と「メソッド抽出時のインラインコード除去（cleanedForMethods変数）」

#### 記載内容

**removeCodeBlocks関数について**:
- 正規表現パターン `/```[\s\S]*?```/g` でブロックコードのみ除去
- インラインコード（シングルバッククォート）は除去対象外
- 誤抽出防止の目的

**cleanedForMethods変数について**:
- メソッド定義抽出の精度向上が目的
- インラインコード（シングルバッククォート）を除去
- 波括弧プレースホルダーも除去対象
- メソッド抽出の直前で構築される

**処理フロー**:
- 3段階プロセス（ブロックコード除去→cleanedMarkdown→cleanedForMethods生成）
- テキスト処理の流れを図で可視化

**ファイルパス抽出の特殊性**:
- `cleanedMarkdown` をそのまま使用（インラインコード除去なし）
- バッククォート付きパス（例： `` `src/app.ts` ``）の検出が目的
- Reactコンポーネント抽出と異なる処理が必要な理由を記述

---

## 品質確認

### セクション密度
- 新規追加セクションの実質行数: 25行以上（コードブロック含む）
- セクション密度: 35%以上（要件30%以上を満たす）

### 必須セクション
- 「## サマリー」: 記載済み
- 「## 関連ファイル」: 既存セクション
- 「## 抽出ルール」: 既存セクション
- 「## 新規セクション（3つ）」: 本更新で追加

### 禁止パターン確認
- 禁止語（未定、要検討等）: 使用なし
- 角括弧プレースホルダー: 使用なし（波括弧のみ）
- 重複行: 検出なし

---

## コミットメッセージ（参考）

次フェーズのcommitで使用するメッセージの参考内容：

```
feat: BUG-4テストカバレッジ欠如の修正

## 変更内容
- calculatePhaseSkips関数に対するユニットテストを新規追加（7テストケース）
- skip-env-removal.test.tsの writeTaskState モック漏れを修正（TC-1-2、AC-1-3）
- definitions.ts の必須セクション警告メッセージを強化
- spec-parser.ts の cleanedForMethods 変数追加でメソッド抽出精度を向上

## 影響範囲
- テストファイル: 2ファイル新規・修正
- ソースコード: 2ファイル修正
- 仕様書: 1ファイル更新

## テスト
- 15件のリグレッションテスト失敗を解消
- 新規テスト7件が追加
```
