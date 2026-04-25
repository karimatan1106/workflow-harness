# 要件定義: 既存バグ3件の根本原因追究と修正

## サマリー

本タスクは3件の既存バグの根本原因修正を目的としています。
バグ1はbash-whitelist.jsのtestingフェーズホワイトリストに末尾スペース付きで登録された'node 'エントリをスペースなしの'node'に修正します。
バグ2はloop-detector.jsのnormalizeFilePath関数内にあるpath.resolve周りの到達不能なtry-catchを除去します。
バグ3はテスト結果バリデータのキーワード検出ロジックを改善し、"0 failed"や"Fail-Closed"のような誤検出を防止します。
いずれも既存の防御的プログラミング設計を維持しながら、エッジケースへの対応を強化する修正です。

## 目的

調査フェーズで特定した3件のバグについて、それぞれの根本原因に対する修正要件を定義します。
各バグは独立した問題ですが、いずれも既存のワークフローフック機構に影響を与える実装上の不具合です。
修正により、testingフェーズでのBashコマンド実行、ファイルパス正規化、テスト結果記録の信頼性が向上します。

## 対象範囲

以下の3ファイルを修正対象とします。

- `workflow-plugin/hooks/bash-whitelist.js`: testingフェーズホワイトリストのnodeエントリ修正
- `workflow-plugin/hooks/loop-detector.js`: normalizeFilePath関数のデッドコード除去
- `workflow-plugin/mcp-server/src/tools/phase-transition/record-test-result.ts`: テスト結果バリデータの改善

修正範囲は限定的で、各ファイルとも数行程度の変更で完了します。
既存のテストスイートに対する影響は最小限に抑えます。

## 修正要件

### REQ-1: BUG-1対応（Bashホワイトリストのnodeコマンドブロック解消）

#### 背景

testingフェーズでBashツールを使用してnodeコマンドを実行すると、ホワイトリスト判定でブロックされる問題があります。
調査により、bash-whitelist.jsの行57に登録されている'node '（末尾スペース付き）が原因であることが判明しました。
startsWith判定で'node src/backend/...'の5文字目が's'であるのに対し、ホワイトリストの5文字目がスペースであるためマッチしません。

#### 修正内容

bash-whitelist.jsの行57を以下のように修正します。

```javascript
// 修正前
'node ',

// 修正後
'node',
```

末尾スペースを除去することで、'node'コマンドとして認識されます。
その後のREQ-R6境界チェック（行665-671）でコマンド末尾が単語境界となっているか検証されるため、'nodejs'のような派生コマンドは引き続き拒否されます。

#### 受入基準

- testingフェーズで`node src/backend/tests/integration/example.test.ts`のようなコマンドが実行可能
- REQ-R6境界チェックにより`nodejs src/...`や`node-gyp ...`は引き続き拒否される
- 回避策のスペース2つ挿入（`node  src/...`）が不要になる

#### 影響範囲

bash-whitelist.jsのtestingフェーズホワイトリストのみに影響します。
他のフェーズのホワイトリストや他のコマンドには影響しません。

### REQ-2: BUG-2対応（normalizeFilePathのデッドコード除去）

#### 背景

loop-detector.jsのnormalizeFilePath関数には、path.resolveの失敗を想定したtry-catchブロックが存在します。
しかしpath.resolveはNode.jsの純粋な文字列処理関数であり、ファイルシステムにアクセスせず、文字列引数に対して例外をスローすることはありません。
このため内側のcatchブロックは到達不能なデッドコードとなっています。

#### 修正内容

loop-detector.jsの行125-145を以下のように簡潔化します。

```javascript
// 修正前
function normalizeFilePath(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch (err) {
    console.warn(`realpathSync failed for ${filePath}: ${err.message}. Using resolve.`);
    try {
      return path.resolve(filePath);
    } catch (resolveErr) {
      console.error(`resolve failed for ${filePath}: ${resolveErr.message}.`);
      return filePath;
    }
  }
}

// 修正後
function normalizeFilePath(filePath) {
  try {
    return fs.realpathSync(filePath);
  } catch (err) {
    console.warn(`realpathSync failed for ${filePath}: ${err.message}. Using resolve.`);
    return path.resolve(filePath);
  }
}
```

fs.realpathSync失敗時には引き続きpath.resolveにフォールバックしますが、不要なtry-catchは除去します。
path.resolveが何らかの理由で失敗する場合には例外を上位に伝播させることで、問題の早期発見につながります。

#### 受入基準

- 既存の動作が維持される（シンボリックリンクが存在する場合は解決、存在しない場合は絶対パスに変換）
- デッドコードが除去され、コードの可読性が向上する
- path.resolveが例外をスローした場合には上位で適切にハンドリングされる

#### 影響範囲

loop-detector.jsのnormalizeFilePath関数のみに影響します。
この関数は主にファイル編集の重複検出に使用されるため、既存のループ検出機能には影響しません。

### REQ-3: BUG-3対応（テスト結果バリデータの過剰検出修正）

#### 背景

workflow_record_test_result関数のバリデータは、exitCodeとoutput内のキーワードの整合性を検証します。
exitCode=0の場合に出力テキスト内の"failed"を検出すると矛盾として拒否しますが、"0 failed"のように失敗件数が0であることを示す文脈でも誤検出が発生します。
また"Fail-Closed"のようなハイフン結合の技術用語もFailとして検出されます。

#### 修正内容

record-test-result.tsのバリデーションロジックを改善し、以下の条件を満たすようにします。

1. **数値付きfailedの除外**: "0 failed"や"123 failed"のように数値と組み合わせたfailedは除外
2. **ハイフン結合の除外**: "Fail-Closed"のようにハイフン結合された単語は除外
3. **単語境界の考慮**: 独立した単語としての"fail"や"failed"のみ検出

改善案として、以下のような正規表現を使用します。

```typescript
// 修正前
const failPattern = /fail/i;

// 修正後（概念）
const failPattern = /\b(?<!\d\s)fail(?![-\w])/i;
// または
const failPattern = /\b(?!\d+\s+)fail(?![a-z-])/i;
```

具体的な正規表現はplanningフェーズで詳細設計します。
重要なのは、「0 failed」や「Fail-Closed」のような文脈で誤検出しないことです。

#### 受入基準

- exitCode=0で"All tests passed. 0 failed, 42 passed."のような出力が受理される
- exitCode=0で"Security Mode: Fail-Closed"のような出力が受理される
- exitCode=0で"Test failed"のような明確な失敗表現は引き続き拒否される
- exitCode=1で"1 failed, 41 passed"のような出力は受理される（整合性あり）

#### 影響範囲

workflow_record_test_result関数のバリデーションロジックのみに影響します。
testing、regression_testフェーズでの実際のテスト結果記録に影響します。

## 非機能要件

### NFR-1: 後方互換性

既存のワークフロー機能に対する後方互換性を維持します。
バグ修正により新たな問題を引き起こさないことを保証します。

### NFR-2: テストカバレッジ

各バグ修正に対して、修正前に発生していた問題を再現するテストケースを作成します。
修正後にこれらのテストが通過することを確認します。

### NFR-3: ドキュメント

各修正内容について、コード内のコメントで修正理由を記載します。
特にBUG-3のバリデータ改善については、除外する文脈パターンを明示します。

## 成功基準

以下の全ての条件を満たすことを成功基準とします。

1. testingフェーズで`node src/backend/tests/...`コマンドが正常に実行できる
2. loop-detector.jsのnormalizeFilePathからデッドコードが除去され、既存動作が維持される
3. テスト結果バリデータが"0 failed"や"Fail-Closed"を誤検出しない
4. 既存のテストスイートが全てパスする
5. 新規追加したテストケースが全てパスする

## リスク

### リスク1: REQ-R6境界チェックの仕様変更

bash-whitelist.jsの修正により、REQ-R6境界チェックの動作に依存する部分が増えます。
REQ-R6の仕様変更があった場合に影響を受ける可能性があります。
軽減策としては、REQ-R6のテストカバレッジを強化します。

### リスク2: テスト結果バリデータの厳格化不足

BUG-3の修正で誤検出を防ぐために正規表現を緩和しすぎると、真の矛盾を見逃す可能性があります。
軽減策としては、典型的な失敗パターンをテストケースとして網羅します。

### リスク3: 既存ワークフローへの影響

3件のバグ修正が既存のワークフロー実行に予期しない影響を与える可能性があります。
軽減策としては、修正前にベースラインテストを実行し、修正後に同一テストを実行して差分を確認します。

## 次フェーズへの引き継ぎ事項

planningフェーズでは以下を実施してください。

1. bash-whitelist.jsの修正差分の詳細確認
2. loop-detector.jsの修正差分の詳細確認
3. テスト結果バリデータの正規表現設計（具体的なパターン決定）
4. 各バグに対するテストケース設計
5. リグレッションテストの範囲確定

test_designフェーズでは以下を実施してください。

1. BUG-1: nodeコマンド実行のテストケース（正常系・異常系）
2. BUG-2: normalizeFilePathのテストケース（シンボリックリンク有無）
3. BUG-3: テスト結果バリデータのテストケース（誤検出パターン・真の矛盾パターン）
4. 統合テスト: 3件のバグ修正が相互に干渉しないことの確認
