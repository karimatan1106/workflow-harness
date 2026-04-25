# コード調査結果: harness-detailed-error-analytics

phase: research
調査日: 2026-03-25

## ファイル別調査結果

### A. error-toon.ts (51行)

**DoDFailureEntry型の全フィールド:**
```
interface DoDFailureEntry {
  timestamp: string;
  phase: string;
  retryCount: number;
  errors: string[];
  checks: Array<{ name: string; passed: boolean; message?: string }>;
}
```

**appendErrorToon(docsDir, entry):**
- 引数: docsDir (string), entry (DoDFailureEntry)
- 処理: phase-errors.toonを読み込み、既存entriesに新entryを追加し、toonEncodeで全体を再書き込み
- ディレクトリが存在しない場合はmkdirSync(recursive)で作成

**readErrorToon(docsDir):**
- 戻り値: DoDFailureEntry[] (失敗時は空配列)
- phase-errors.toonをtoonDecodeSafeでパースし、data.entries を返す

**allChecksフィールド:** 存在しない。checksフィールドにはpassedとfailedの両方が含まれうるが、呼び出し元(lifecycle-next.ts)がdodResult.checks全件をmapして渡しているため、現状でもpassed/failed両方が記録されている。

---

### B. phase-analytics.ts (167行)

**buildErrorAnalysis(task, metrics?) のシグネチャと処理:**
- シグネチャ: `function buildErrorAnalysis(task: TaskState, metrics?: TaskMetrics): PhaseErrorStats[]`
- 処理フロー:
  1. phase-errors.toonからreadErrorToon()で全エントリ読み込み
  2. 各entryのchecksをイテレートし、check名ごとにcountを集計
  3. フォールバック: task.proofLog のうち result=falsy のエントリも集計
  4. task.retryCount と metrics.phases のretries情報をマージ
  5. retries=0 かつ checks.size=0 のフェーズは除外
  6. retries降順でソート

**phase-errors.toonから読み取る情報:**
- entry.phase, entry.checks (name, passed, message)
- ただし重要な問題: checksのうちpassedのものもfailedのものも区別なく全てカウントしている(44行目)。passedフィルタがない。

**errorAnalysisオブジェクトのフィールド (PhaseErrorStats):**
```
interface PhaseErrorStats {
  phase: string;
  retries: number;
  failures: CheckFailure[];  // CheckFailure = { check, level, count }
}
```

**buildAnalytics()全体のフロー:**
1. getTaskMetrics(taskId) でメトリクス取得
2. buildErrorAnalysis() でエラー分析
3. findBottlenecks() でボトルネック検出(slowestPhase, mostRetried, mostFailedCheck)
4. generateAdvice() でアドバイス生成(パターンマッチ + リトライ3回以上 + 600s超過)
5. parseHookObsLog() でフック観測ログ解析
6. 全結果をAnalyticsResultとして返却

---

### C. analytics-toon.ts (65行)

**writeAnalyticsToon()の引数:**
```
writeAnalyticsToon(
  docsDir: string,
  taskName: string,
  taskId: string,
  analytics: AnalyticsResult,
  timings?: PhaseTimingsResult,
): string
```

**toonEncodeの呼び出し:**
- resultオブジェクトを構築し、`toonEncode(result)` で文字列化
- `phase-analytics.toon` に書き出し、パスを返す

**errorAnalysisの出力形式:**
```javascript
errorAnalysis: analytics.errorAnalysis.map(e => ({
  phase: e.phase,
  retries: e.retries,
  topFailure: e.failures.length > 0
    ? `${e.failures[0].check}(${e.failures[0].level}) x${e.failures[0].count}`
    : 'none',
})),
```
- 情報が大幅に圧縮されている: failures配列の先頭1件のみがtopFailureとして文字列化
- 2件目以降のfailure詳細は出力されない
- check個別のpassed/failed情報は出力されない

---

### D. lifecycle-next.ts (199行)

**buildDoDFailureResponse()のフロー (135-185行):**
1. RetryContextを構築(phase, taskName, docsDir, retryCount, errorMessage)
2. buildRetryPrompt(retryCtx, dodResult.checks) でリトライガイダンス生成
3. stashFailure() で失敗情報をスタッシュ
4. recordRetry() + recordDoDFailure() でメトリクス記録
5. recordDoDResults() でobservability-trace.toonにcheck結果を書き込み
6. appendErrorToon() でphase-errors.toonに記録
7. レスポンスを構築して返却

**appendErrorToon()の呼び出し箇所 (160-168行):**
```javascript
appendErrorToon(docsDir, {
  timestamp: new Date().toISOString(),
  phase: task.phase,
  retryCount,
  errors: dodResult.errors,
  checks: dodResult.checks.map((c: any) => ({
    name: c.check, passed: c.passed, message: c.evidence,
  })),
});
```
- dodResult.checksの全件(passed含む)をmapしてDoDFailureEntryのchecks配列に変換
- つまり全check結果はphase-errors.toonに記録されている

**DoDResult.checksの情報伝播:**
- dodResult.checks (DoDCheckResult[]) は以下に渡される:
  - buildRetryPrompt(): checks全件
  - recordDoDResults(): checks全件 (checkId, passed, messageにマッピング)
  - appendErrorToon(): checks全件 (name, passed, messageにマッピング)
  - レスポンス: dodChecks として全件返却

**全check結果が失われるポイント:**
- lifecycle-next.ts自体ではcheck情報は失われていない。全件が各記録先に渡されている。
- 情報ロスは下流の2箇所で発生:
  1. phase-analytics.ts buildErrorAnalysis() 44行目: checksイテレート時にpassed/failedの区別なくカウント(passedもfailure扱い)
  2. analytics-toon.ts 31-37行: errorAnalysisの出力時にtopFailure(先頭1件)のみ文字列化

---

### E. dod-types.ts (21行)

**DoDCheckResult型の全フィールド:**
```
interface DoDCheckResult {
  level: 'L1' | 'L2' | 'L3' | 'L4';
  check: string;
  passed: boolean;
  evidence: string;
  fix?: string;      // passed=false時のアクション指示
  example?: string;  // 正しい出力形式の例
}
```

**DoDResult型の全フィールド:**
```
interface DoDResult {
  passed: boolean;
  checks: DoDCheckResult[];
  errors: string[];
}
```

**export状況:** 両型ともexportされている。dod.tsから re-export もされている。

---

### F. dod.ts (83行)

**runDoDChecks()の戻り値構造:**
- `Promise<DoDResult>` = `{ passed, checks, errors }`
- passed: `errors.length === 0` で判定
- checks: 全DoDCheckResult配列(passed/failed両方含む)
- errors: failedチェックのevidenceを `[L*] evidence` 形式で格納

**全check結果の構築方法:**
- push()ヘルパー関数で各check結果をchecks配列に追加
- passedでないcheck結果のみerrors配列にも追加
- 合計28+チェック(checkDCIValidationは複数結果を返す)を順次実行
- checks配列にはpassed/failed両方が含まれる

---

## 発見事項

### 1. 情報が欠落するポイント

**ポイントA: phase-analytics.ts buildErrorAnalysis() 44行目**
- checksイテレート時にpassedフィルタがない
- `for (const check of entry.checks)` で全checksを走査し、passedもfailedも区別なくカウント
- 結果としてpassedチェックもfailure扱いでカウントされる(バグ)
- levelも保持されない: toonから読み込む際にlevelが`'L1'`固定(47行目)

**ポイントB: analytics-toon.ts 31-37行 errorAnalysis出力**
- failures配列の先頭1件のみをtopFailureとして文字列化
- 2件目以降のfailure情報は出力から完全に脱落
- check個別のpassed/failed/level/evidence情報は全て失われる

**ポイントC: DoDFailureEntry型にlevel情報がない**
- error-toon.tsのchecks配列は `{ name, passed, message? }` のみ
- DoDCheckResult.level ('L1'|'L2'|'L3'|'L4') がmapping時に落ちている
- lifecycle-next.ts 164行: `name: c.check, passed: c.passed, message: c.evidence` のみマッピング
- fix, example フィールドも落ちている

### 2. 型拡張の互換性に関する所見

- DoDFailureEntry.checksに `level`, `fix`, `example` フィールドを追加しても、既存のphase-errors.toonファイルとの後方互換性は保たれる(toonDecodeSafeは追加フィールドを無視、新フィールドはoptionalにすれば旧データも読める)
- DoDCheckResult型は既にlevel, fix, exampleを持っているため、DoDFailureEntryのchecks型をDoDCheckResultに近づける拡張は自然
- PhaseErrorStats.failuresのCheckFailure型にもlevel情報は既にあるが、buildErrorAnalysis()で'L1'固定になっている問題がある

### 3. phase-analytics.tsの行数リスク

- 現在167行で200行制限以内
- 機能追加時は分割を検討する必要がある(残り33行)
- buildErrorAnalysis, findBottlenecks, generateAdvice, parseHookObsLog の4機能が1ファイルに同居
- allChecks対応のためbuildErrorAnalysis()を拡張する場合、行数増加は限定的(passedフィルタ追加+level保持で+5行程度)
- analytics-toon.tsへのerrorAnalysis詳細出力追加のほうが行数インパクトが大きい可能性あり

### 4. データフロー全体像

```
runDoDChecks() → DoDResult { checks: DoDCheckResult[] }
  ↓ (lifecycle-next.ts)
  ├→ appendErrorToon(): checks全件記録(ただしlevel/fix/example欠落)
  ├→ recordDoDResults(): checks全件記録(observability-trace.toon)
  └→ レスポンス: dodChecks全件返却
      ↓ (phase-analytics.ts)
      readErrorToon() → buildErrorAnalysis()
        → passedフィルタなし + level='L1'固定
          ↓ (analytics-toon.ts)
          writeAnalyticsToon() → topFailureのみ出力(先頭1件)
```
