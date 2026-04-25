# P5: Retry Pivot 実装調査レポート

## 1. retry.ts 概要

- パス: `workflow-harness/mcp-server/src/tools/retry.ts`
- 行数: 199行
- インポート元: `../gates/dod-types.js` (DoDCheckResult), `./adr.js` (getActiveADRs)

### エクスポート関数一覧

| 関数 | シグネチャ | 役割 |
|------|-----------|------|
| `classifyComplexity` | `(checks: DoDCheckResult[], errorClass: RetryPromptResult['errorClass']) => 'trivial' \| 'moderate' \| 'critical'` | エラー複雑度をPlanktonパターンで3段階に分類。モデルエスカレーション判断に使用 |
| `buildRetryPrompt` | `(ctx: RetryContext, checks?: DoDCheckResult[]) => RetryPromptResult` | DoD失敗時のリトライプロンプトを生成。改善指示・ADR参照・複雑度タグを含む |
| `formatStructuredError` | `(error: string, file: string, adrIds: string[], fix: string) => string` | ERROR/WHY/FIX/EXAMPLE形式でエラーをフォーマット |
| `ERROR_ADR_MAP` | `Record<string, string[]>` | エラーパターン文字列からADR IDへのマッピング定数 |

### エクスポート型

| 型 | フィールド |
|----|-----------|
| `RetryContext` | phase, taskName, docsDir, retryCount, errorMessage, model |
| `RetryPromptResult` | prompt, suggestModelEscalation, suggestedModel, errorClass |

### 内部関数(非エクスポート)

| 関数 | 役割 |
|------|------|
| `classifyError(msg)` | 正規表現でエラーを4分類(FileNotFound/SyntaxError/LogicError/Unknown) |
| `errorToImprovement(errorMessage)` | エラーパターンから日本語の改善指示文字列配列を生成 |
| `extractImprovements(errorMessage, checks?)` | DoDCheckResult.fixフィールド優先、なければerrorToImprovementにフォールバック |
| `classifyFromChecks(errorMessage, checks?)` | DoDCheckResult.checkフィールド優先、なければclassifyErrorにフォールバック |

## 2. classifyComplexity の分類ロジック

入力: `DoDCheckResult[]` + `errorClass`
出力: `'trivial' | 'moderate' | 'critical'`

分類基準(優先順):
1. 失敗チェックにL1レベルがある -> `critical`
2. 失敗チェックにL3レベルがある -> `moderate`
3. それ以外の失敗チェック -> `trivial`
4. チェック配列が空の場合、errorClassで判定:
   - FileNotFound -> `critical`
   - LogicError -> `moderate`
   - SyntaxError -> `trivial`
   - Unknown -> `trivial`

用途: `suggestedModel`の決定に使用
- critical -> opus
- moderate -> sonnet
- trivial -> haiku

## 3. buildRetryPrompt の構造

生成されるプロンプトに含まれる情報:
1. 複雑度タグ (`[TRIVIAL]`, `[MODERATE]`, `[CRITICAL]`)
2. フェーズ名とリトライ回数 (例: `# [MODERATE] research リトライ2回目`)
3. タスク名と出力ディレクトリ
4. 失敗理由(コードブロック内、参照のみ・転記禁止の注意付き)
5. 改善要求(ERROR/WHY/FIX形式、各失敗チェックに対応)
6. 関連ADRセクション(最大3件、ERROR_ADR_MAPで優先順位付き)

モデルエスカレーション判断:
- `suggestModelEscalation = retryCount >= 2 && model === 'haiku'`
- `suggestedModel`はcomplexityベースで決定(retryCountに依存しない)

## 4. リトライ回数上限と制御フロー

### 上限値
- `maxRetries = 5` (lifecycle-next.ts L42で `currentRetry >= 5` チェック)
- retryCountはTaskState.retryCount[phase]にフェーズ単位で保持
- フェーズ成功時にresetRetryCount()でリセット

### 制御フロー (lifecycle-next.ts)
```
harness_next呼び出し
  -> retryCount >= 5? -> エラー応答(ユーザーに相談を促す)
  -> incrementRetryCount(taskId, phase)
  -> 承認ゲートチェック
  -> 出力ファイル存在/サイズチェック
  -> runDoDChecks()
  -> 失敗時: buildDoDFailureResponse()
    -> buildRetryPrompt() でリトライプロンプト生成
    -> stashFailure() で失敗履歴を記録
    -> recordRetry(), recordDoDFailure() でメトリクス記録
    -> appendErrorToon() でphase-errors.toonに追記
    -> retryCount >= 3: VDB-1警告(バリデータバグの可能性を示唆)
  -> 成功時:
    -> retryCount > 1: promoteStashedFailure() で学習レッスン化
    -> resetRetryCount()
    -> advancePhase()
```

### 関連データストア

| ストア | ファイル | 内容 |
|--------|---------|------|
| TaskState.retryCount | task TOON | phase -> count マッピング |
| ReflectorStore.stashedFailures | reflector-log.toon | 失敗パターン・エラーメッセージ・retryCount (最大20件) |
| ReflectorStore.lessons | reflector-log.toon | 成功した修正パターンの学習記録 (最大50件) |
| phase-errors.toon | docsDir内 | 各失敗の詳細(timestamp, phase, retryCount, errors, checks) |
| observability-trace.toon | docsDir内 | DoD結果・リトライの時系列トレース |

## 5. 現状の課題: Pivot判断の欠如

現在のリトライロジックには「同一パターン失敗の検出」と「方向転換」の仕組みが存在しない:

### 存在する要素
- `extractErrorPattern()` (reflector.ts): エラーメッセージから80文字以内のパターンを抽出
- `stashFailure()`: 失敗ごとにerrorPatternを記録し、既存レッスンのharmfulCountをインクリメント
- `VDB-1警告` (retryCount >= 3): バリデータバグの可能性を文字列で示唆するのみ
- `classifyComplexity()`: モデルエスカレーションは提案するが、アプローチ変更は提案しない

### 欠如する要素
- 連続失敗のerrorPatternの比較(前回と同じパターンか判定するロジック)
- 「同一パターンN回連続」の検出カウンタ
- 失敗パターンに基づく代替アプローチの提案
- pivotフラグ/pivotPromptの生成
- リトライ回数だけでなく「同一パターン繰り返し」に基づくエスカレーション

## 6. 推奨実装方針

### 6.1 失敗パターン類似性判定の追加 (retry.ts)

```typescript
// 新関数: detectRepeatedPattern
export function detectRepeatedPattern(
  docsDir: string,
  currentPattern: string,
): { isRepeated: boolean; consecutiveCount: number; pattern: string } {
  const history = readErrorToon(docsDir);
  // 直近の失敗エントリからerrorPatternを抽出し、現在のパターンと比較
  // extractErrorPattern()を使って正規化後に一致判定
}
```

追加場所: `retry.ts` に `detectRepeatedPattern` を追加
データソース: `phase-errors.toon` (既にappendErrorToonで全失敗を記録済み)

### 6.2 RetryPromptResult の拡張

```typescript
export interface RetryPromptResult {
  prompt: string;
  suggestModelEscalation: boolean;
  suggestedModel: 'opus' | 'sonnet' | 'haiku';
  errorClass: 'FileNotFound' | 'SyntaxError' | 'LogicError' | 'Unknown';
  // 新規追加
  pivotRequired: boolean;           // 同一パターン2回以上連続で true
  pivotSuggestion?: string;         // 方向転換の具体的提案
  consecutiveFailureCount: number;  // 同一パターンの連続回数
}
```

### 6.3 buildRetryPrompt内のpivotロジック

```typescript
// buildRetryPrompt内に追加
const patternInfo = detectRepeatedPattern(ctx.docsDir, extractErrorPattern(ctx.errorMessage));
const pivotRequired = patternInfo.consecutiveCount >= 2;
let pivotSuggestion: string | undefined;
if (pivotRequired) {
  pivotSuggestion = generatePivotSuggestion(errorClass, patternInfo.pattern, ctx.phase);
  // プロンプトに「前回と同じアプローチは失敗する。別の方法を試せ」を注入
}
```

### 6.4 generatePivotSuggestion (新関数)

errorClassとフェーズに応じた方向転換提案を生成:
- FileNotFound: パス規約の再確認、docsDir/workflowDirの確認を提案
- SyntaxError(禁止語): 間接参照の具体例を提示
- LogicError(密度不足): 構造ではなく実質内容の追加を強調
- 汎用: 「前回と異なるアプローチで成果物を再作成せよ」

### 6.5 lifecycle-next.ts への統合

`buildDoDFailureResponse`内でpivotRequired時の応答を拡張:
- `pivotRequired: true` をレスポンスに含める
- pivotSuggestionをretry.retryPromptに注入
- VDB-1警告とは別に、retryCount >= 2 かつ 同一パターンの場合にpivot警告を発出

### 6.6 影響範囲

変更ファイル:
1. `retry.ts` - detectRepeatedPattern, generatePivotSuggestion追加、RetryPromptResult拡張
2. `lifecycle-next.ts` - buildDoDFailureResponse内でpivot情報をレスポンスに追加
3. `scope-nav.ts` - 同様にpivot情報を追加(サブフェーズ用)
4. `handlers/query.ts` - DoDチェック結果にpivot情報を含める

既存データストアの変更は不要(phase-errors.toonに必要な情報は既に記録されている)。
