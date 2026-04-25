## サマリー

- 目的: atomicWriteJson 関数へのリトライロジック追加（EPERM/EBUSY エラー対応）に対するテストケースを設計し、実装フェーズで作成するテストコードの青写真を提供する
- 主要な決定事項: 既存のテストファイル `workflow-plugin/mcp-server/src/state/lock-utils.test.ts` を新規作成し、4つのリトライシナリオを vitest + vi.spyOn を使ってモック検証する方針を採用する。sleepSync 関数はモックして即時リターンさせ、テスト実行速度を確保する
- 次フェーズで必要な情報: テストファイルのパスは `workflow-plugin/mcp-server/src/state/lock-utils.test.ts`（新規作成）。モックの対象は `fs.renameSync` と `sleepSync`（lock-utils.ts 内のローカル関数）の2つ。`fs` モジュール全体は既存の manager.test.ts と同様に `vi.mock('fs', ...)` でモックする

---

## テスト方針

### ユニットテストの範囲と対象

テスト対象ファイルは `workflow-plugin/mcp-server/src/state/lock-utils.ts` の `atomicWriteJson` 関数である。
このファイルへのテストコードは `workflow-plugin/mcp-server/src/state/lock-utils.test.ts` として新規作成する。
既存のテストファイル（manager.test.ts 等）は lock-utils を全モックしているため、lock-utils 自体の単体テストは存在しない。
本タスクで初めて lock-utils の単体テストを追加することになる。

テストの主な検証対象は以下の3点である。
1. EPERM/EBUSY エラー発生時のリトライ機構が正しく動作すること
2. リトライ上限（3回）を超えた場合に最後のエラーが呼び出し元に伝播すること
3. リトライ対象外のエラー（ENOENT 等）は即座にスローされ、不要なリトライを行わないこと

### モック戦略

fs モジュール全体を `vi.mock('fs', ...)` で置き換える方法では lock-utils.ts 内の全 fs 呼び出しがモックされる。
これにより `renameSync` のみを選択的に失敗させることが可能になる。
一方 `writeFileSync` は成功（何もしない）として設定し、リトライロジックのみを検証する構成にする。

sleepSync 関数は lock-utils.ts 内にローカル定義される予定であり、外部モジュールではない。
このため `vi.spyOn` でモジュール内部の関数を直接差し替えることができない。
代替策として、実際のテスト実行時に sleepSync を高速化するために `Atomics.wait` 自体を vi.spyOn でモックする。
または、sleep 時間を最小値（1ms 等）として設定するかタイムアウトを調整する。
最もシンプルな解決策は、テスト実行前に `vi.useFakeTimers()` ではなく、`Atomics.wait` を `vi.spyOn(Atomics, 'wait').mockReturnValue('ok')` としてモックすることである。

### TDD Red Phase の確認

test_impl フェーズでは実装前にテストを作成するため、以下のテストは当初 atomicWriteJson にリトライロジックが存在しないため失敗（Red 状態）になる。
implementation フェーズでリトライロジックを実装した後、全テストが Green になることを確認する。

---

## テストケース

### TC-01: EPERM エラー時にリトライして成功するシナリオ

**テスト分類**: ユニットテスト（正常系・リトライ成功）

**テストファイル**: `workflow-plugin/mcp-server/src/state/lock-utils.test.ts`

**前提条件の設定**:
- `fs.writeFileSync` はモック済みで、何もせずに成功する
- `fs.renameSync` は1回目の呼び出しで EPERM エラーオブジェクトを throw する
- `fs.renameSync` は2回目の呼び出しで何もせずに成功する
- `Atomics.wait` をモックして即時リターンさせ、待機時間ゼロでテストを実行する

**実行内容**:
`atomicWriteJson('/test/state.json', { phase: 'research' })` を呼び出す。

**期待する結果**:
- atomicWriteJson が例外をスローせずに正常終了すること
- `fs.renameSync` が合計2回呼び出されること（1回目失敗 + 1回目リトライで成功）
- `Atomics.wait`（または sleepSync）が1回呼び出されること（リトライ前の待機）

**設計上の留意点**:
EPERM エラーオブジェクトは `Object.assign(new Error('permission denied'), { code: 'EPERM' })` の形式で作成する。
このオブジェクトを renameSync の1回目の呼び出し時にのみ throw させ、2回目は `undefined` を返すよう設定する。

---

### TC-02: EBUSY エラー時にリトライして成功するシナリオ

**テスト分類**: ユニットテスト（正常系・リトライ成功）

**テストファイル**: `workflow-plugin/mcp-server/src/state/lock-utils.test.ts`

**前提条件の設定**:
- `fs.writeFileSync` はモック済みで成功する
- `fs.renameSync` は1回目の呼び出しで EBUSY エラーオブジェクトを throw する
- `fs.renameSync` は2回目の呼び出しで成功する
- `Atomics.wait` をモックして即時リターンさせる

**実行内容**:
`atomicWriteJson('/test/state.json', { phase: 'planning' })` を呼び出す。

**期待する結果**:
- atomicWriteJson が例外をスローせずに正常終了すること
- `fs.renameSync` が合計2回呼び出されること
- 待機処理が1回実行されること

**TC-01 との違い**:
エラーコードが `'EPERM'` ではなく `'EBUSY'` である点のみ異なる。
EBUSY（Resource busy）も Windows 環境での一時的なファイルロック競合として発生するエラーであり、同じリトライロジックで対処する。

---

### TC-03: 3回リトライ全失敗後に最後のエラーをスローするシナリオ

**テスト分類**: ユニットテスト（異常系・リトライ上限超過）

**テストファイル**: `workflow-plugin/mcp-server/src/state/lock-utils.test.ts`

**前提条件の設定**:
- `fs.writeFileSync` はモック済みで成功する
- `fs.renameSync` は全ての呼び出しで EPERM エラーを throw する（毎回失敗）
- `fs.unlinkSync` はモック済みで成功する（一時ファイルのクリーンアップ用）
- `Atomics.wait` をモックして即時リターンさせる

**実行内容**:
`atomicWriteJson('/test/state.json', { phase: 'implementation' })` を `expect(...).rejects.toThrow()` でキャッチする。
または `try/catch` ブロックで呼び出してエラーを捕捉する。

**期待する結果**:
- atomicWriteJson が EPERM エラーをスローすること
- スローされたエラーの `code` プロパティが `'EPERM'` であること
- `fs.renameSync` が合計4回呼び出されること（初回 + 3回のリトライ = 計4回）
- 待機処理が3回実行されること（リトライ毎に1回ずつ）

**設計上の留意点**:
スローされるエラーが「最後のエラー」であることを確認するため、各呼び出しで異なるエラーメッセージを持つ EPERM エラーを throw させ、4回目のエラーメッセージが catch されたエラーに一致することを検証してもよい。
これにより「最後のエラーをスローする」という仕様が正しく実装されていることを確認できる。

---

### TC-04: EPERM/EBUSY 以外のエラー（ENOENT）は即座にスローするシナリオ

**テスト分類**: ユニットテスト（異常系・非リトライエラー）

**テストファイル**: `workflow-plugin/mcp-server/src/state/lock-utils.test.ts`

**前提条件の設定**:
- `fs.writeFileSync` はモック済みで成功する
- `fs.renameSync` は ENOENT エラーを throw する（1回目から失敗）
- `fs.unlinkSync` はモック済みで成功する
- `Atomics.wait` はモック済みだが、呼び出されないことが期待される

**実行内容**:
`atomicWriteJson('/test/state.json', { phase: 'test_impl' })` を `try/catch` でキャッチする。

**期待する結果**:
- atomicWriteJson が ENOENT エラーを即座にスローすること
- `fs.renameSync` が合計1回しか呼び出されないこと（リトライしない）
- 待機処理が0回実行されること（ENOENT はリトライ対象外）
- スローされたエラーの `code` プロパティが `'ENOENT'` であること

**設計上の留意点**:
この検証は「リトライ対象外のエラーを即座に伝播する」という重要な仕様を確認する。
ENOENT 以外にも EACCES 等の非リトライエラーが正しく伝播されることを確認したい場合は、
同様のパターンで TC-04b として追加テストケースを設計することができる。

---

### TC-05: 正常系（リトライなし）の既存動作維持確認

**テスト分類**: ユニットテスト（正常系・既存動作維持）

**テストファイル**: `workflow-plugin/mcp-server/src/state/lock-utils.test.ts`

**前提条件の設定**:
- `fs.writeFileSync` はモック済みで成功する
- `fs.renameSync` は1回目から成功する（エラーなし）
- `Atomics.wait` はモック済みだが呼び出されないことが期待される

**実行内容**:
`atomicWriteJson('/test/state.json', { version: 1, tasks: [] })` を呼び出す。

**期待する結果**:
- atomicWriteJson が例外をスローせずに正常終了すること
- `fs.writeFileSync` が1回呼び出されること（一時ファイルへの書き込み）
- `fs.renameSync` が1回だけ呼び出されること（一時ファイルの置き換え）
- 待機処理が0回実行されること

**設計上の留意点**:
リトライロジック追加後も既存の正常系フローに影響がないことを保証する回帰テストである。
writeFileSync に渡された引数の内容も検証し、JSON.stringify で整形された文字列が渡されることを確認してもよい。

---

## テスト実装ガイドライン

### テストファイルの構造

テストファイル `workflow-plugin/mcp-server/src/state/lock-utils.test.ts` の全体構造は以下の形式を採用する。

```typescript
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import * as fs from 'fs';

// fs モジュールをモックして各関数の動作を制御する
vi.mock('fs', () => ({
  writeFileSync: vi.fn(),
  renameSync: vi.fn(),
  unlinkSync: vi.fn(),
}));

describe('atomicWriteJson', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Atomics.wait をモックして sleepSync を即時リターンさせる
    vi.spyOn(Atomics, 'wait').mockReturnValue('ok');
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe('正常系: エラーなしで成功する場合', () => {
    it('TC-05: 一回のrenameで成功する場合はリトライしない', () => { /* ... */ });
  });

  describe('リトライ成功系: EPERM/EBUSYエラー後に成功する場合', () => {
    it('TC-01: EPERMエラー後にリトライして成功する', () => { /* ... */ });
    it('TC-02: EBUSYエラー後にリトライして成功する', () => { /* ... */ });
  });

  describe('リトライ失敗系: 全リトライ消費後にエラーをスローする場合', () => {
    it('TC-03: 3回全てのリトライが失敗した場合は最後のエラーをスローする', () => { /* ... */ });
  });

  describe('非リトライエラー系: 即座にスローする場合', () => {
    it('TC-04: ENOENT等のリトライ対象外エラーは即座にスローする', () => { /* ... */ });
  });
});
```

### エラーオブジェクト作成パターン

リトライ検証テストで使用するエラーオブジェクトは以下の形式で作成する。
コードフェンス内なので安全に配列記法や波括弧を使用できる。

```typescript
// EPERM エラーオブジェクトの作成方法
const epermError = Object.assign(new Error('operation not permitted'), { code: 'EPERM' });

// EBUSY エラーオブジェクトの作成方法
const ebusyError = Object.assign(new Error('resource busy'), { code: 'EBUSY' });

// ENOENT エラーオブジェクトの作成方法
const enoentError = Object.assign(new Error('no such file or directory'), { code: 'ENOENT' });
```

### mockImplementation パターン

TC-01 と TC-02 では renameSync が1回目に失敗し2回目に成功する動作を以下のパターンで実現する。
コードフェンス内なので安全に記述できる。

```typescript
let renameCallCount = 0;
vi.mocked(fs.renameSync).mockImplementation(() => {
  renameCallCount++;
  if (renameCallCount === 1) {
    throw epermError;
  }
  // 2回目以降は何もせずに成功
});
```

TC-03 では常に失敗させるため `vi.mocked(fs.renameSync).mockImplementation(() => { throw epermError; })` とする。

---

## 補足: テストと実装の対応関係

各テストケースと lock-utils.ts の実装コードの対応を示す。

| テストケース | 検証する実装コード | 状態遷移図上の対応パターン |
|-------------|------------------|--------------------------|
| TC-05 正常系 | renameSync 成功パス | パターン1（初回 renameSync 成功） |
| TC-01 EPERMリトライ | renameSync 失敗後のリトライループ1回 | パターン2（リトライ1回で成功） |
| TC-02 EBUSYリトライ | renameSync 失敗後のリトライループ1回 | パターン2（エラーコード違い） |
| TC-03 全失敗 | リトライ回数カウントと上限チェック | パターン3（3回全失敗） |
| TC-04 即時スロー | リトライ対象外エラーの即時伝播 | 設計書のリトライ判定表の ENOENT 行 |

ステートマシン図の EPERMDetected → RetryAttempt1 → WaitRetry1 → RetryRename1 → Success の遷移パスは TC-01 が検証する。
RetryRename3 → RenameFailed → Cleanup → Failed の遷移パスは TC-03 が検証する。
AttemptRename → RenameFailed（非リトライエラー）の即時遷移は TC-04 が検証する。