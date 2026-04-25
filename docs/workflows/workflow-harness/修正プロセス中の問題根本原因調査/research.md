## サマリー

- 目的: 過去の修正セッション（FR-1〜FR-22、FR-A〜FR-D）で発生した問題の根本原因を調査し、未解決問題を全て特定する
- 主要な発見事項:
  - 問題1（角括弧プレースホルダー文書化ミスの繰り返し）: definitions.ts のフォールバック値に旧パターンが残存しており、今後もサーバークラッシュ時に不整合が再発するリスクがある
  - 問題2（FR-22 が MEMORY.md に未記録）: コミット cd8a594（FR-22）の内容が MEMORY.md に記録されていない
  - 問題3（FR-A〜FR-D が MEMORY.md に未記録）: コミット 5c9fe36・90ebb69 で実装された FR-A〜FR-D の内容が MEMORY.md に記録されていない
  - 問題4（design-validator.test.ts の mkdirSync モック警告）: テスト実行時に stderr 警告が出るが、テスト自体は通る。設計上の軽微な問題
  - 問題5（task-index.json FIX-1 実装状況）: manager.ts 863行目に `updateTaskIndexForSingleTask` 呼び出しが存在し、FIX-1 は実装済みと確認できた
- 次フェーズで必要な情報:
  - フォールバック値の旧パターン修正を行うか否かの判断（定常系ではなく fallback なので優先度は低い可能性）
  - MEMORY.md の更新優先度
  - mkdirSync 警告の修正優先度（機能影響なし）

---

## 調査結果

### 問題1: 角括弧プレースホルダー文書化ミスが繰り返された根本原因

#### コミット履歴の調査

文書化ミスは以下の順序で発生・修正された:

1. コミット `3ef93b8`（サブモジュール FR-6、2026-02-25 09:33）: 最初の変更。`artifact-validator.ts` と `definitions.ts` の両方で旧広義パターンから `[##xxx]` ハッシュプレフィックスパターンへ変更した
2. コミット `76bddd3`（親リポジトリ FR-6 相当、2026-02-25 09:33）: CLAUDE.md を `[##]` パターンで文書化（コミットメッセージに「[##] bracket placeholder pattern」と記述）
3. コミット `6fa7e81`（サブモジュール、2026-02-25 10:57）: `artifact-validator.ts` のパターンを `[##xxx]` から対称形式 `[#xxx#]` に変更
4. コミット `2f920f1`（親リポジトリ、2026-02-25 10:58）: CLAUDE.md を `[#xxx#]` に更新
5. コミット `5c9fe36`（親リポジトリ FR-A〜FR-D、2026-02-28 08:45）および `90ebb69`（サブモジュール）: `definitions.ts` 内のテンプレート文字列で「配列アクセス記法禁止」という誤った説明を削除し、`buildSubagentTemplate` および `generateImprovementsFromError` の記述を正確な `[#xxx#]` 形式に修正

#### 根本原因の特定

文書化ミスが繰り返された根本原因は3点ある。

第1の原因は、artifact-validator.ts と definitions.ts が独立して管理されているため、パターン変更時に両ファイルの整合性を確認するチェック機構が存在しなかったことである。`artifact-validator.ts` のパターンを変更しても、`definitions.ts` の説明文・フォールバック値・サブエージェントテンプレートのそれぞれが個別に更新漏れを起こす可能性がある。

第2の原因は、現在も `definitions.ts` の37行目（フォールバック値）に旧パターンが残存していることである。正常系では `exportGlobalRules()` が `artifact-validator.ts` の正しい `[#xxx#]` パターンを返すが、MCP サーバー起動時に `artifact-validator.ts` のインポートが失敗した場合、フォールバック値が使用される。このフォールバック値は `[(?!関連|参考|注|例|出典)[^\]]{1,50}\]` という旧パターンのままである。正常系では問題が表面化しないため、修正が後回しになった。

第3の原因は、CLAUDE.md のドキュメントと実際のコードパターンの間に「正しい説明とはどれか」という単一の信頼できる情報源が存在しなかったことである。サブモジュール内の `artifact-validator.ts` が正式なパターン定義であるべきだが、この関係性が明示されていなかったため、修正者が各場所を個別に調べて対応した。

#### 現状の整合性確認

調査時点（2026-02-28）での各ファイルの記述:
- `artifact-validator.ts` 368行目: `/\[#[^\]]{0,50}#\]/g` （正しい `[#xxx#]` 形式）
- `artifact-validator.ts` 1297行目（`exportGlobalRules` 関数）: `/\[#[^\]]{0,50}#\]/g` （正しい形式）
- `definitions.ts` 34行目（フォールバック値）: `/\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g` （旧パターン残存）
- `definitions.ts` テンプレート文字列内: `[#xxx#]` 形式を使用（修正済み）
- `CLAUDE.md`: `[#xxx#]` 形式を使用（修正済み）

正常系では `exportGlobalRules()` が正しい値を返すため実害はないが、フォールバック値の不整合は潜在的なリスクとして残っている。

---

## 既存実装の分析

### 問題2: FR-22 が MEMORY.md に記録されていない

#### 調査結果

コミット `9f89fc7`（親リポジトリ、2026-02-25 11:55）のメッセージには「FR-20/FR-21/FR-22 scope info」とあるが、サブモジュールのコミット `cd8a594`（2026-02-25 11:55）を確認したところ、内容は以下の通りである。

FR-22 の実装内容（コミット `cd8a594`）:
- `definitions.ts` の `docs_update` フェーズの `subagentTemplate` に `${affectedFiles}`、`${affectedDirs}`、`${moduleName}` プレースホルダーを追加した
- `next.ts` に対応するプレースホルダー解決ロジックを追加した（661〜675行目）

現在の MEMORY.md には FR-20・FR-21 の記録はあるが（2026-02-28 記録時点の最終項目）、FR-22 の記録が欠落している。

#### 根本原因

FR-22 が記録されなかった理由は、同コミット `87cd590`（親リポジトリ）の更新日が 2026-02-28 08:45 であり、FR-22 の実装（9f89fc7: 2026-02-25）は同セッションで記録されたはずだが、その後 FR-A〜FR-D（5c9fe36: 2026-02-28）の修正作業で新しい MEMORY.md の項目が追加されたことで、FR-22 が MEMORY.md に記録される機会が失われた可能性がある。MEMORY.md は Claude Desktop が管理するため、セッション終了後に自動保存されるが、記録内容は Orchestrator が生成するため記録漏れが生じる。

---

### 問題3: FR-A〜FR-D が MEMORY.md に記録されていない

#### 調査結果

コミット `5c9fe36`（親リポジトリ、2026-02-28 08:45）および `90ebb69`（サブモジュール、2026-02-28 08:45）で実装された FR-A〜FR-D の内容:

- FR-A: CLAUDE.md の角括弧プレースホルダー説明を更新し、`[#xxx#]` 形式のハッシュ記号付きのみが禁止対象であることを明記した
- FR-B: `definitions.ts` の `performance_test` および `e2e_test` テンプレートから「配列アクセス記法禁止」という誤った警告文を削除した
- FR-C: `definitions.ts` の `buildSubagentTemplate` 関数内の角括弧説明を `[#xxx#]` 形式に修正した
- FR-D: `definitions.ts` の `generateImprovementsFromError` 関数内のエラーメッセージを `[#xxx#]` 形式に修正した

MEMORY.md の最終項目は「FR-20・FR-21 実装内容（2026-02-28 完了）」であり、FR-A〜FR-D は同日の後続作業であるが記録されていない。

#### 根本原因

FR-A〜FR-D はこの調査セッション（2026-02-28 08:45）で実装されたが、MEMORY.md への記録はそのセッション終了後に行われる。現在の MEMORY.md がそのセッションの終了前の状態を示しているため、記録が追いついていない状態と考えられる。

---

### 問題4: design-validator.test.ts の mkdirSync モック警告

#### 調査結果

テスト実行の実証:

```
[Design Validator] Failed to persist cache: Error: [vitest] No "mkdirSync" export is defined on the "fs" mock.
```

上記の警告が UT-5.1 と UT-5.2 の実行時に stderr に出力されることを確認した。UT-5.3 と UT-5.4 では出力されない（workflowDir が存在しない場合は `persistCache` が呼ばれないため）。

#### 根本原因の分析

`tests/validation/design-validator.test.ts` の11〜15行目の `vi.mock('fs', ...)` は以下のエクスポートのみを定義している:
- `existsSync`
- `readFileSync`
- `statSync`

一方、`src/validation/design-validator.ts` の216行目（`persistCache` メソッド）は `fs.mkdirSync` を呼び出している。モックに `mkdirSync` が定義されていないため、vitest が警告を出力している。

テストは通過する理由は、`persistCache` のエラーが `catch` ブロックで `console.warn` に変換されるためである。つまりテストの正確性には影響しないが、テスト出力が汚染される問題がある。

修正方法: `vi.mock('fs', ...)` に `mkdirSync: vi.fn()` を追加すれば警告が解消する。

---

### 問題5: task-index.json FIX-1 の実装状況

#### 調査結果

`src/state/manager.ts` の該当箇所を確認した結果:

863〜866行目に以下の実装が存在する:
```typescript
// FIX-1: フェーズ遷移時にtask-index.jsonを軽量更新
// saveTaskIndex()はdiscoverTasks()経由で古いキャッシュを読む問題があるため、
// 該当タスクのみを直接更新する軽量版を使用する
this.updateTaskIndexForSingleTask(taskId, phase, taskState);
```

`updateTaskIndexForSingleTask` メソッド（507〜546行目）の実装内容:
- ロックを取得してから `task-index.json` を読み込む
- 該当タスクの `phase` フィールドのみを直接更新する
- 書き込み後にロックを解放する
- エラー発生時は `console.error` で記録するが、フェーズ遷移自体は成功として処理を継続する（non-critical エラー）

また、`syncTaskIndex` 公開メソッド（875〜882行目）も存在し、フェーズ遷移を伴わない状態変更後にも `task-index.json` を更新する仕組みが備わっている。

#### 検証結論

FIX-1 は 863行目（`setPhase` メソッド内）に正しく実装されており、フェーズ遷移時に毎回 `task-index.json` が更新される。MEMORY.md の「Root fix: MCP server should update task-index.json on every phase transition」は実装済みの状態である。この問題は解消されている。

---

## 未解決問題の整理

未解決・要対応の問題を優先度順に示す。

### 優先度: 高

現時点で高優先度とみなすべき問題は確認されなかった。全ての問題は軽微または記録漏れに分類される。

### 優先度: 中

#### MEMORY.md の記録漏れ（FR-22、FR-A〜FR-D）

両方とも MEMORY.md に追記が必要である。

FR-22 の記録内容:
- `definitions.ts` の `docs_update` テンプレートにスコープ情報プレースホルダー（`${affectedFiles}`、`${affectedDirs}`、`${moduleName}`）を追加した
- `next.ts` にプレースホルダー解決ロジックを追加した（next.ts 661〜675行目）
- 実施日: 2026-02-25、コミット cd8a594（サブモジュール）

FR-A〜FR-D の記録内容:
- FR-A: CLAUDE.md の `[#xxx#]` 形式の正確な説明への更新
- FR-B: `performance_test` および `e2e_test` テンプレートから誤った「配列アクセス記法禁止」警告を削除
- FR-C: `buildSubagentTemplate` の角括弧説明を `[#xxx#]` に修正
- FR-D: `generateImprovementsFromError` のエラーメッセージを `[#xxx#]` に修正
- 実施日: 2026-02-28、コミット 90ebb69（サブモジュール）、5c9fe36（親リポジトリ）

### 優先度: 低

#### definitions.ts フォールバック値の旧パターン残存

`definitions.ts` 34〜35行目のフォールバック値が旧 `bracketPlaceholderRegex` パターンを使用している。正常系では `exportGlobalRules()` が正しい値を返すため即時影響はないが、サーバー起動失敗時に不整合が再発するリスクがある。

修正内容: フォールバック値の `bracketPlaceholderRegex` を `/\[#[^\]]{0,50}#\]/g` に、`bracketPlaceholderInfo.pattern` を `'\\[#[^\\]]{0,50}#\\]'` に、`allowedKeywords` を空配列 `[]` に変更する。

#### design-validator.test.ts の mkdirSync モック欠落

`vi.mock('fs', ...)` に `mkdirSync: vi.fn()` を追加すれば解消する。機能影響はない。

---

## 調査の観点別サマリー

### 角括弧プレースホルダーの歴史的経緯

この問題は複数の非同期的な変更によって引き起こされた。最初の変更（3ef93b8）でパターンが `[##xxx]` 形式に変更され、その後さらに `[#xxx#]` の対称形式（6fa7e81）に変更された。この2段階の変更があったため、CLAUDE.md の更新が2回必要となり、片方が漏れた。

さらに definitions.ts のテンプレート内文字列の誤った「配列アクセス記法禁止」説明（FR-B で削除）は、旧パターン（`/\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g`）が通常の角括弧も誤検出していた時代の名残りである。新パターンへの変更時にテンプレート内の説明文が更新されなかったことが根本原因だった。

### 最終確認: 実際の検出パターン一致状況

artifact-validator.ts（368行目、最新）: `/\[#[^\]]{0,50}#\]/g`
CLAUDE.md（現在）: `` `[#xxx#]` `` 形式を明記
definitions.ts テンプレート（FR-C 修正後）: `` `[#xxx#]` `` 形式を使用
definitions.ts フォールバック値（未修正）: 旧 `/\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g` が残存

主要なパスは整合しているため実運用上の問題は解消されているが、フォールバック値のみ未修正である。
