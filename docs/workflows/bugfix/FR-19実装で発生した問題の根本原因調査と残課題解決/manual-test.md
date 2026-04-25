## サマリー

- 目的: atomicWriteJson のリトライロジック追加（lock-utils.ts 修正）と lock-utils.test.ts の新規テストスイートについて、コードレビューと動的確認を組み合わせた手動検証を実施する
- 評価スコープ: `workflow-plugin/mcp-server/src/state/lock-utils.ts` の atomicWriteJson 関数（sleepSync 関数を含む）および `src/state/__tests__/lock-utils.test.ts` の TC-01〜TC-05 の5テストケース
- 主要な決定事項: Windows 環境固有の EPERM/EBUSY 競合エラーに対して最大3回リトライ・100ms 待機（sleepSync で同期実装）を採用した。外部パッケージ追加なしの Atomics.wait ベース実装を選択した判断が設計の核心である
- 検証状況: 950 テスト全合格（77ファイル）が testing/regression_test フェーズで確認済み。本フェーズでは実装コードの静的コードレビューおよびロジックの境界値分析を実施した
- 次フェーズで必要な情報: 本フェーズで検出された軽微な改善候補（TC-03 のリトライ回数コメント精度）は次フェーズでの判断材料として引き継ぐ。ルート残存ファイル3件の削除は完了済みであり引き継ぎ不要

---

## テストシナリオ

### シナリオ1: atomicWriteJson の正常系コードレビュー（TC-05 対応）

検証内容として、lock-utils.ts の atomicWriteJson 関数において writeFileSync と renameSync の呼び出し順序が正しいことを確認した。
対象コードは 130〜167 行目であり、writeFileSync で一時ファイルに JSON を書き込んだ後、ループで renameSync を呼び出す構造となっている。
正常系では attempt=0 の時点で renameSync が成功し、即座に return されるため sleepSync（Atomics.wait）は呼ばれない設計である。
TC-05 のテストアサーション `expect(Atomics.wait).not.toHaveBeenCalled()` が正常系でのリトライなし動作を確認している。

前提条件として、fs モジュールが vi.mock でモックされており、実際のファイルシステム操作は発生しない状態でテストが実行される。

### シナリオ2: EPERM エラーリトライ成功（TC-01 対応）

検証内容として、1回目の renameSync で EPERM エラーが発生した場合に sleepSync(100) を呼び出してから再試行し、2回目で成功することを確認した。
コードの該当箇所は lock-utils.ts の 147〜151 行目であり、`if (error.code === 'EPERM' || error.code === 'EBUSY')` の分岐で `sleepSync(100)` を呼び出してから `continue` でループを継続する実装になっている。
TC-01 のテストアサーション `expect(fs.renameSync).toHaveBeenCalledTimes(2)` および `expect(Atomics.wait).toHaveBeenCalledTimes(1)` が1回リトライ後の成功を正確に検証している。

### シナリオ3: EBUSY エラーリトライ成功（TC-02 対応）

検証内容として、TC-01 と同等のリトライ動作が EBUSY エラーコードでも機能することを確認した。
分岐条件が `error.code === 'EPERM' || error.code === 'EBUSY'` と OR 条件で統合されているため、EPERM と EBUSY の両方が同一のリトライパスを通る。
TC-02 のアサーションパターンは TC-01 と同一であり、EBUSY も正しく処理されることを確認している。

### シナリオ4: 全リトライ消費後の例外スロー（TC-03 対応）

検証内容として、maxRetries=3 の設定で全 rename 呼び出しが EPERM を返し続けた場合に、ループ終了後に lastError がスローされることを確認した。
ループ範囲は `for (let attempt = 0; attempt <= maxRetries; attempt++)` であり、attempt が 0, 1, 2, 3 の4回 renameSync が呼ばれる。このうち `attempt < maxRetries`（0, 1, 2 の3回）で sleepSync が呼ばれ、attempt=3 では呼ばれない。
TC-03 のアサーションは `expect(Atomics.wait).toHaveBeenCalledTimes(3)` であり、実装ロジックと整合している。ループ後の unlinkSync 呼び出しによる一時ファイルクリーンアップも確認した。

### シナリオ5: ENOENT 即時スロー（TC-04 対応）

検証内容として、EPERM/EBUSY 以外のエラーコード（ENOENT を代表例として使用）が発生した場合は即座に上位にスローし、リトライを行わないことを確認した。
実装コードの 152〜158 行目の else ブランチで unlinkSync による一時ファイルクリーンアップを行ってから throw する構造になっている。
TC-04 のアサーション `expect(fs.renameSync).toHaveBeenCalledTimes(1)` および `expect(Atomics.wait).not.toHaveBeenCalled()` が即時スロー動作を正確に検証している。

### シナリオ6: sleepSync の実装妥当性確認

検証内容として、sleepSync 関数（lock-utils.ts の 114〜118 行目）の実装が適切であることを確認した。
SharedArrayBuffer を毎回新規作成し、Int32Array で初期値 0 のインデックス 0 を参照し、`Atomics.wait(arr, 0, 0, ms)` を呼び出す実装になっている。
Atomics.wait は第3引数の期待値（0）と実際の値（0）が一致するため、タイムアウト時間（ms）まで待機してから `"timed-out"` を返す動作になる。テスト環境では vi.spyOn によりモックされ即時 `"ok"` を返すため、テストの実行速度に影響しない設計になっている。

---

## テスト結果

### シナリオ1（正常系）の確認結果: テストアサーションとコード実装が完全に整合している

TC-05 の期待動作（writeFileSync 1回、renameSync 1回、Atomics.wait 0回）は lock-utils.ts の正常パス実装と整合している。
正常系でリトライが発生しないことはパフォーマンス観点でも重要であり、既存のワークフロー動作に不要な遅延を追加しない設計が確認できた。

### シナリオ2（EPERM リトライ）の確認結果: リトライロジックが spec.md の設計仕様と整合している

1回目 EPERM → sleepSync(100) → 2回目成功という動作が TC-01 のモック実装とアサーションにより正確に検証されている。
spec.md の「リトライ前には sleepSync(100) を呼び出して100ms 待機する」という要件が実装コードに反映されていることを確認した。

### シナリオ3（EBUSY リトライ）の確認結果: EPERM と EBUSY が同一のリトライパスを通ることを確認した

OR 条件による統合実装が設計意図に沿っており、TC-02 のアサーションパターンが TC-01 と同一なので、EBUSY の扱いが EPERM と等価であることが保証されている。

### シナリオ4（全リトライ失敗）の確認結果: 4回の renameSync 呼び出しと3回の sleepSync 呼び出しが正確に実装されている

ループ条件 `attempt <= maxRetries`（maxRetries=3）で4回ループ、sleepSync 呼び出し条件 `attempt < maxRetries` で3回呼び出しという非対称な境界値が正しく実装されている。
TC-03 コメントに「初回 attempt=0 + 3回リトライ attempt=1,2,3」と記載されているが、sleepSync コメントは「各リトライ前に待機: attempt=0,1,2」となっており、理解の助けになる記述である。

### シナリオ5（即時スロー）の確認結果: 非リトライエラーが正しくクリーンアップ後に即時スローされることを確認した

ENOENT に対して unlink → throw の順序が正しく実装されており、一時ファイルが残存しないことが保証されている。
TC-04 のアサーションにより、リトライが発生しないこと（renameSync 1回のみ）と sleepSync が呼ばれないことが検証されている。

### シナリオ6（sleepSync 実装）の確認結果: Atomics.wait を用いた同期スリープが正しく実装されている

SharedArrayBuffer を使用した実装は Node.js/V8 の標準 API のみで完結しており、外部パッケージ依存が追加されていないことを確認した。
テスト環境での vi.spyOn モック差し替えが正しく機能するアーキテクチャになっており、テストの信頼性が高い設計となっている。

---

## 総合評価

全テストシナリオ合否のサマリーとして、TC-01〜TC-05 に対応する6シナリオ全てが合格（コードレビューおよびアサーション整合性の両面で問題なし）であった。
検出された問題の状況として、重大な不具合は検出されなかった。TC-03 のコメント記述について attempt 番号の説明が一部わかりにくい箇所を確認したが、アサーションの値（4回・3回）は正確であるため機能的な問題はない。
未実施シナリオについて、実際の Windows 環境でのウィルス対策ソフト競合による EPERM の発生は本フェーズでは再現不可であるが、spec.md にある「FR-19 実装中の ci_verification から deploy への遷移で実際にこの現象が発生し、2回目の呼び出しで成功した」という事実がリトライロジックの有効性を示している。
次フェーズへの引き継ぎ事項として、TC-03 コメントの表現改善を軽微な技術的負債として記録する。ルート残存ファイル（verify-templates.js 等）の削除は implementation フェーズで完了済みであり引き継ぎ不要である。
全体的な品質評価として合格と判定する。atomicWriteJson のリトライロジックは設計仕様（spec.md）と完全に整合しており、5テストケースが正確に動作を検証している。950 テスト全合格のリグレッション結果とあわせて、本修正が既存動作に悪影響を与えていないことが確認された。
