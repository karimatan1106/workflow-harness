# 仕様書: 既存バグ3件の根本原因追究と修正

## サマリー

本仕様書は3件の既存バグの根本原因と修正方法を定義します。
BUG-1はbash-whitelist.jsのtestingフェーズホワイトリストに'node '（末尾スペース付き）が登録されていることが原因で、nodeコマンドがブロックされる問題です。
BUG-2はloop-detector.jsのnormalizeFilePath関数内でpath.resolve周りの到達不能なtry-catchがデッドコードとなっている問題です。
BUG-3はrecord-test-result.tsのバリデータが"Fail-Closed"等のハイフン結合語や"0 Failed"のような失敗件数ゼロの文脈を誤検出する問題です。
修正対象は3ファイルで、いずれも数行の変更で対応可能です。
修正方針はBUG-1が末尾スペース除去、BUG-2がデッドコード除去、BUG-3がキーワード検出ロジックの改善です。
既存のREQ-R6境界チェックやFail-Closed原則は維持したまま、エッジケースへの対応を強化します。

## 概要

本タスクではワークフロープラグインの3件の既存バグを修正します。
3件はいずれも防御的プログラミングの意図で実装されていますが、エッジケースへの対応が不十分でした。
BUG-1はホワイトリストのエントリ形式ミスで、修正は1文字（スペース）の削除です。
BUG-2はNode.js APIの仕様理解不足によるデッドコードで、修正は不要なtry-catchの除去です。
BUG-3はキーワード検出の正規表現設計ミスで、修正は否定語チェックとハイフン結合語の除外ロジック追加です。

## 変更対象ファイル

以下の3ファイルを修正します。

### ファイル1: workflow-plugin/hooks/bash-whitelist.js

testingフェーズのホワイトリスト配列の行64にある'node '（末尾スペース付き）エントリを修正します。
implementationフェーズの行75にも同様の'node 'エントリがあるため、こちらも合わせて修正します。
修正内容は末尾スペースの削除のみで、ホワイトリストの他のエントリには影響しません。
マッチングロジック（行665-671）のREQ-R6境界チェックは変更不要です。

### ファイル2: workflow-plugin/hooks/loop-detector.js

normalizeFilePath関数（行125-145）の内側try-catchブロック（行136-143）を除去します。
path.resolveはNode.jsの純粋な文字列処理関数であり例外をスローしないため、内側のcatchは到達不能なデッドコードです。
外側のtry-catch（fs.realpathSync用）は引き続き必要なためそのまま維持します。

### ファイル3: workflow-plugin/mcp-server/src/tools/record-test-result.ts

validateTestOutputConsistency関数内の大文字キーワード検出ロジック（行99-110）を改善します。
現在は大文字キーワード（FAIL, FAILED等）に対してisKeywordNegated関数を呼び出していません。
また単語境界の\bがハイフンの前後でもマッチするため、"Fail-Closed"の"Fail"が検出されてしまいます。
isKeywordNegatedの呼び出し追加と、ハイフン結合語の除外チェック追加が必要です。

## 実装計画

### ステップ1: BUG-1の修正（bash-whitelist.js）

bash-whitelist.jsの行64と行75の'node '（末尾スペース付き）を'node'（スペースなし）に変更します。
startsWith判定で'node'がマッチした後、REQ-R6境界チェックにより次の文字が境界文字であることが検証されます。
'nodejs'や'nodemon'のような派生コマンドはREQ-R6で引き続き拒否されるため、セキュリティ上の問題は発生しません。
変更理由をコードコメントとして明記し、将来の保守担当者が意図を理解できるようにします。
修正完了後、既存のtest-n1テストスイートで動作確認を実施します。

### ステップ2: BUG-2の修正（loop-detector.js）

normalizeFilePath関数の内側try-catch（行136-143）を除去し、path.resolveを直接呼び出す形に変更します。
fs.realpathSync失敗時のconsole.warnとpath.resolveへのフォールバック動作はそのまま維持します。
削除対象は内側のtryブロック開始行、catchブロック、console.error行、フォールバックreturn行、ブロック終了行の計7行です。
Node.js仕様でpath.resolveが例外をスローしない旨のコメントを追記します。
修正完了後、test-n6のSEC3テストスイートで動作確認を実施します。

### ステップ3: BUG-3の修正（record-test-result.ts）

validateTestOutputConsistency関数の大文字キーワード検出パス（行99-110のisUpperCase分岐）に2つの修正を適用します。
修正3a: matchesの検証前にisKeywordNegated(output, kw.toLowerCase())を呼び出し、"0 Failed"や"no Error"のような否定語付きパターンを除外します。
修正3b: matchesのsome内でマッチ位置の次の文字がハイフンでないことを確認し、"Fail-Closed"のようなハイフン結合語を除外します。
TypeScriptソースを修正した後、MCPサーバーのビルド（tscコンパイル）を実行してdist/以下のJSファイルを更新します。
修正完了後、MCPサーバーを再起動して変更を反映させる必要があります。

## BUG-1: 修正仕様

### BUG-1の根本原因

bash-whitelist.jsの行64に'node '（末尾にスペースが1つ付いた5文字の文字列）が登録されています。
マッチングロジック（行665-671）ではnormalizedPart.startsWith(allowedCommand)で前方一致判定を行います。
'node src/backend/...'に対して'node '.startsWith判定を行うと、入力の5文字目は's'であり、ホワイトリストの5文字目のスペースと不一致のためfalseとなります。
回避策としてスペースを2つ入れた'node  src/...'の場合は5文字目がスペースとなりマッチが成立していました。

### BUG-1の修正差分

行64のtestingフェーズホワイトリストと行75のimplementationフェーズホワイトリストの'node 'を'node'に変更します。

```javascript
// testingフェーズ（行64）: 末尾スペースを除去
// 修正前: 'node ',
// 修正後:
'node',
// implementationフェーズ（行75）: 同様に末尾スペースを除去
// 修正前: 'node ',
// 修正後:
'node',
```

### BUG-1の安全性確認

REQ-R6境界チェック（行665-671）では、マッチしたコマンドの次の文字を検証しています。
nextCharがundefined（コマンド末尾）、スペース等の空白文字、セミコロンやパイプ等の区切り文字の場合のみ許可されます。
'nodejs'の場合は次の文字が'j'であり上記のいずれにも該当しないため拒否されます。
'node'単体（引数なし）はnextCharがundefinedとなり許可されます。

## BUG-2: 修正仕様

### BUG-2の根本原因

normalizeFilePath関数（行125-145）にはfs.realpathSync失敗時のフォールバックとしてpath.resolveを使用する設計です。
さらにpath.resolveの失敗を想定した内側のtry-catch（行136-143）が存在します。
しかしpath.resolveはNode.jsの純粋な文字列処理関数であり、ファイルシステムにアクセスしません。
文字列引数に対してpath.resolveが例外をスローするケースはNode.jsの仕様上存在しません。
したがって内側のcatchブロック（行139-143）は到達不能なデッドコードです。

### BUG-2の修正差分

内側のtry-catchを除去し、path.resolveを直接呼び出します。
修正前のcatch(e)ブロック内の構造を以下のように変更します。

```javascript
// 修正前のcatch(e)ブロック内（行133-144）:
//   console.warn(...)
//   try { path.resolve(...) }
//   catch(e2) { console.error(...); return filePath... }
//
// 修正後のcatch(e)ブロック内:
//   console.warn(...)
//   path.resolve(...) を直接呼び出し
console.warn(`[loop-detector] Warning: ...`);
// path.resolveは純粋な文字列処理のため例外をスローしない
const resolved = path.resolve(filePath);
return resolved.replace(/\\/g, '/').toLowerCase();  // 正規化して返却
```

外側のtry-catch（fs.realpathSync用）はそのまま維持し、fs.realpathSyncが存在しないパスに対して例外をスローする動作を適切に処理します。

## BUG-3: 修正仕様

### BUG-3の根本原因

validateTestOutputConsistency関数内の大文字キーワード検出ロジック（行99-110）に2つの問題があります。

問題1: 大文字キーワード（FAIL, FAILED等）の検出時にisKeywordNegated関数が呼び出されていません。
小文字キーワード（failing, failures, errored）のみ否定語チェックが適用されています。
"0 Failed"のように失敗件数がゼロであることを示す出力が誤検出されます。

問題2: 正規表現の\b（単語境界）はハイフンの前後でもマッチします。
"Fail-Closed"の"Fail"がパターン\bFail\bに完全にマッチし、先頭が大文字'F'のため検出されます。
セキュリティ用語の"Fail-Closed"は失敗を意味しないため、除外すべきです。

### BUG-3の修正差分

大文字キーワード検出のisUpperCase分岐に否定語チェックとハイフン結合語の除外を追加します。

```typescript
// 修正後のisUpperCase分岐（行99以降）
if (isUpperCase) {
  // 修正3a: 否定語チェックを大文字キーワードにも適用
  if (isKeywordNegated(output, kw.toLowerCase())) {
    return false;  // "0 Failed", "no Error" 等を除外
  }
  const firstChar = kw.charAt(0);
  const rest = kw.slice(1).toLowerCase();
  const matchPattern = new RegExp(`\\b(${firstChar}${rest})\\b`, 'gi');
  const matches = output.match(matchPattern) || [];
  return matches.some(match => {
    // 先頭小文字はスキップ（"failed" は対象外）
    if (match.charAt(0) !== match.charAt(0).toUpperCase()) return false;
    // 修正3b: ハイフン結合語を除外（"Fail-Closed" 等）
    const idx = output.indexOf(match);
    if (idx >= 0 && output[idx + match.length] === '-') return false;
    return true;
  });
}
```

isKeywordNegated関数自体は変更不要です。
NEGATION_WORDSに'0'が既に含まれているため、kw.toLowerCase()で小文字化して渡すことで"0 failed"パターンに正しくマッチします。

### BUG-3のテスト対象パターン

以下のパターンが正しく処理されることを検証します。

exitCode=0で受理されるべき出力は以下の4パターンです。
"All tests passed. 0 failed, 42 passed."は失敗件数ゼロのため受理されます。
"Security Mode: Fail-Closed"はハイフン結合のセキュリティ用語のため受理されます。
"Tests: 5 passed, 0 failed, 5 total"はJest形式で失敗件数ゼロのため受理されます。
"Test Suites: 1 passed, 0 Failed, 1 total"は大文字Failedでも失敗件数ゼロのため受理されます。

exitCode=0で拒否されるべき出力は以下の4パターンです。
"Test failed"は明確な失敗表現のため拒否されます。
"FAIL src/test.ts"はテストファイルの失敗を示すため拒否されます。
"Error: assertion failed"はエラーメッセージを含むため拒否されます。
"1 test Failed"は失敗件数が1以上のため拒否されます。

## 実装順序と優先度

BUG-1の修正を最初に実施します（bash-whitelist.jsの行64と行75で末尾スペースを削除する1文字変更）。
次にBUG-2の修正を実施します（loop-detector.jsの行136-143の内側try-catchを除去する構造変更）。
最後にBUG-3の修正を実施します（record-test-result.tsの大文字キーワード検出に否定語チェックとハイフン除外を追加）。
BUG-1とBUG-2は単純な修正のため先に実施し、BUG-3は正規表現の慎重な設計が必要なため最後に実施します。
3件の修正は互いに独立しており、実施順序を変更しても問題は発生しません。

## 影響範囲の評価

BUG-1の修正はtestingフェーズとimplementationフェーズのBashコマンドホワイトリストのみに影響し、他のフェーズやコマンドには波及しません。
BUG-2の修正はnormalizeFilePath関数の内部構造のみに影響し、関数の入出力（パス正規化結果）は変更されません。
BUG-3の修正はvalidateTestOutputConsistency関数のキーワード検出ロジックに影響し、testing/regression_testフェーズでのテスト結果記録に波及します。
いずれの修正も既存の防御的プログラミング設計（REQ-R6境界チェック、Fail-Closed原則）を維持しています。
既存のテストスイート（test-n1からtest-n6の全40テストケース）への影響はなく、リグレッションは発生しない見込みです。
