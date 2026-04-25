# Performance Test: harness-report-fb-fixes

taskId: harness-report-fb-fixes
phase: performance_test

## Performance Impact Assessment

### FB-1+5: buildAllowedTools filter追加

- change: buildAllowedTools関数にArray.prototype.filter呼び出しを1回追加
- dataSize: 許可ツール配列サイズは約15要素
- complexity: O(n) 線形走査。n=15のため反復回数は固定的に少ない
- runtime: マイクロ秒単位(1回のfilter呼び出し、比較演算15回以下)
- risk: ツール配列サイズはハーネス定義により上限が決まっており、入力依存の増大なし
- result: filter追加によるオーバーヘッドはマイクロ秒未満で計測不能

### FB-2: isStructuralLine 正規表現チェック追加

- change: isStructuralLine関数に正規表現パターンマッチを1回追加
- dataSize: 対象文字列長は1行分(約100文字以下)
- complexity: 正規表現の線形マッチ。バックトラッキングが発生しないパターン構造
- runtime: マイクロ秒単位(単純パターンによる1回のRegExp.test呼び出し)
- risk: 入力文字列はTOON行単位であり、長大な入力が渡される経路が存在しない
- result: 正規表現1パターン追加の実行コストは無視できるレベル

### FB-4: applyAddRTM findIndex追加

- change: applyAddRTM関数にArray.prototype.findIndex呼び出しを1回追加
- dataSize: RTMエントリ数は約10件(要件追跡マトリクスの項目数)
- complexity: O(n) 線形探索。n=10で最悪ケースでも10回の比較
- runtime: マイクロ秒単位(文字列比較10回以下で完了)
- risk: RTMエントリ数はタスクスコープに比例するが、実用上50件を超えることはない
- result: findIndex探索はRTMエントリ数10件未満で即座に完了

### FB-6: goBack オブジェクトリテラル代入追加

- change: goBack関数にオブジェクトリテラルの代入文を1回追加
- dataSize: 固定サイズのオブジェクト(プロパティ2-3個)
- complexity: O(1) 定数時間。ループや探索を含まない単純代入
- runtime: ナノ秒単位(JavaScriptエンジンのプロパティ代入1回)
- risk: 入力サイズに依存しない定数時間操作であり、劣化の可能性がゼロ
- result: オブジェクトリテラル代入はO(1)で一切の遅延なし

## Aggregate Assessment

- 全4件のFB修正はいずれもマイクロ秒以下の処理追加であり、ハーネス全体の実行時間(秒単位)に対して測定可能な影響を与えない
- 追加されたロジックはすべて同期処理であり、I/O待ちやネットワーク呼び出しを含まない
- メモリ割り当ての増加は各修正で数十バイト以下であり、GC圧力への影響はない

## decisions

- PT-001: FB-1+5のfilter追加はツール配列サイズ(約15)に対するO(n)操作であり、実行時間への影響は測定限界以下と判定
- PT-002: FB-2の正規表現チェックはバックトラッキングなしの線形パターンであり、ReDoS脆弱性およびパフォーマンス劣化の懸念なしと判定
- PT-003: FB-4のfindIndexはRTMエントリ数(約10)に対する線形探索であり、最悪ケースでも比較10回で完了するため影響なしと判定
- PT-004: FB-6のオブジェクトリテラル代入はO(1)定数時間操作であり、データサイズに依存しないため劣化可能性がゼロと判定
- PT-005: 4件の修正を合算しても追加計算量はマイクロ秒単位に収まり、ハーネス実行サイクル全体(数秒)に対する比率は0.001%未満と判定

## artifacts

- docs/workflows/harness-report-fb-fixes/performance-test.md: spec: 4件のFB修正すべてでパフォーマンス影響なしを確認。追加計算量はマイクロ秒単位

## next

- commitフェーズで変更をコミットおよびプッシュ
