## サマリー

- 目的: 前回ワークフロー（FR-REQ-1〜FR-REQ-6）の修正過程で発生したバリデーション失敗・重複行エラー・禁止語検出の根本原因を特定し、再発防止策を設計する。
- 調査対象件数: 5件（問題A: manual-test.md 重複行、問題B: performance-test.md セクション行数不足、問題C: e2e-test.md 禁止語検出、問題D: workflow_status からの sessionToken 返却条件、問題E: FR-REQ-1/FR-REQ-4 の根本原因）
- 主要な発見事項:
  - 問題Aの根本原因: manual_test subagentTemplate の「実行環境」行一意化ガイダンス（FR-1）が存在するものの、4シナリオ全てで同一のフルテキスト「実行環境」行を生成したことによる重複。ガイダンスはあるが複数シナリオにまたがる文脈でテンプレートが強制力不足だった。
  - 問題Bの根本原因: performance-test.md の「## 修正内容がパフォーマンスに与えた影響評価」セクションはrequiredSectionsに定義されていない任意セクションであり、minSectionLines（5行）の適用を免れないにもかかわらず3行しか書かれなかった。テンプレートに追加セクション記述時の密度要件再確認の指示が欠落していた。
  - 問題Cの根本原因1: 「モック未定義によるエラー」の「未定義」が禁止語「未定」を部分一致で含んでいた。e2e_test テンプレートに「未定義」の言い換え指示が不足していた。
  - 問題Cの根本原因2: 「## 総合評価」セクションの実質行数が4行で5行要件を満たしていなかった。e2e_test テンプレートに総合評価セクション専用の行数ガイダンスが欠落していた。
  - 問題Dの根本原因: workflow_status を taskId なしで呼び出すと全タスク一覧モード（tasks 配列のみ）になり sessionToken フィールドが返されない。taskId を指定して呼び出す必要がある設計である。
  - 問題EのFR-REQ-1根本原因: DesignValidator の persistCache() が fs.mkdirSync と fs.writeFileSync を内部呼び出しするが、テストの vi.mock('fs') ブロックにこれら2関数が含まれておらず TypeError が発生していた。persistCache() の追加（コミット bb2c0b4 付近）とテスト更新の同期漏れが原因。
  - 問題EのFR-REQ-4根本原因: コミット 6fa7e81 で artifact-validator.ts の bracketPlaceholderRegex を [##xxx] から [#xxx#] 形式に変更した際に、definitions.ts のフォールバック値が同時に更新されなかった。2ファイル間の定義を独立して変更したことによる乖離。
- 次フェーズで必要な情報: 上記5件の問題に対する修正対象ファイルは definitions.ts（問題A/B/C/D関連テンプレート改善）、CLAUDE.md（問題D：sessionToken 再取得手順の説明補強）。FR-REQ-1/FR-REQ-4 は既に commit 153587a で修正済み。未修正の問題A/B/C/D に対して requirements フェーズで優先度と修正方針を確定する。

---

## 調査対象1: parallel_verification バリデーション失敗の詳細

### 問題A: manual-test.md の重複行エラー

**発生状況:** MT-1〜MT-4 の4テストシナリオで「実行環境」行のテキストが全て同一の内容「- **実行環境**: Windows 11、Claude Code セッション内、Read ツール使用。」となり、4回出現したため artifact-validator の重複行検出（threshold: 3回以上）が発動した。

**テンプレート調査結果:** manual_test の subagentTemplate（definitions.ts 行 906）には FR-1 として以下のガイダンスが追記されている。

```
## 実行日時・環境情報行の一意化（FR-1: 重複行防止）
複数のテストシナリオにわたって実行日時や実行環境を記述する場合、それらの行にもシナリオ番号または操作対象名を含めて各行を一意にすること。同一の日付文字列のみで構成された行が3件以上出現すると、artifact-validatorが重複行エラーを検出する。
- 推奨パターン1: 「- TC-1の実行日時: 2026-02-23、対象ファイルはdefinitions.tsの906行目付近」
- 推奨パターン2: 「- TC-2の実行環境: Windows 11、Node.js 20.x、テスト対象はmanual_testテンプレートの出力確認」
```

**根本原因の特定:** FR-1 ガイダンスは「実行日時」行の一意化を具体的に示しているが、ガイダンス冒頭の表現が「実行日時や実行環境を記述する場合」と日本語で書かれており、subagent がその内容を参照してもなお同一の実行環境行を4シナリオに貼り付けた。ガイダンスの例示が「TC-1の実行日時」「TC-2の実行環境」という形式に限定されており、全シナリオを通じた統一的な実行環境をどのように記述するかが不明瞭だった。具体的には「MT-1の実行環境: ...」「MT-2の実行環境: ...」のようにシナリオ番号を含む形式の例示が不足していた可能性が高い。

**テンプレートに不足している指示:** 「実行環境が全シナリオで共通の場合はシナリオ固有の確認対象情報を末尾に付加すること」という補完的なガイダンスが欠落している。推奨パターンの例示をシナリオ番号MT-1〜MT-4 の形式に合わせて更新することで、subagent がより直接的に適切な形式を採用できる。

### 問題B: performance-test.md のセクション実質行数不足

**発生状況:** 「## 修正内容がパフォーマンスに与えた影響評価」セクションが3行の実質行しか持たず、minSectionLines（5行）に達しなかった。

**テンプレート調査結果:** performance_test の subagentTemplate（definitions.ts 行 930）には「## パフォーマンス計測結果」と「## ボトルネック分析」の2つの必須セクションへの詳細なガイダンスが含まれており、各5行以上の実質行の確保方法を説明している。しかし「## 修正内容がパフォーマンスに与えた影響評価」はテンプレートの requiredSections（定義: `['## パフォーマンス計測結果', '## ボトルネック分析']`）に含まれていない任意セクションである。

**根本原因の特定:** performance_test テンプレートには必須セクション以外の追加セクションを記述する際の行数要件が明示されていない。artifact-validator のルールでは必須・任意を問わず全てのセクション（## 見出し）に minSectionLines（5行）が適用される。subagent が任意セクションを追加した際に5行要件の存在を意識していなかった。テンプレートに「追加セクションを記述する場合も同様に5行以上の実質行を確保すること」という汎用的な注意が不足していた。

**テンプレートに不足している指示:** 「任意で追加したセクション（## 見出し）にも minSectionLines（5行）のルールが適用される」という明示的な警告がない。

### 問題C: e2e-test.md の禁止語「未定」検出と総合評価行数不足

**発生状況（禁止語）:** e2e-test.md 内の「モック未定義によるエラー」という記述が、禁止語「未定」の部分一致検出（includes 検索）により検出された。禁止語リストの「未定」は「未定義」という複合語にも適用される。

**テンプレート調査結果（禁止語）:** e2e_test の subagentTemplate（definitions.ts 行 942）には「## 禁止語転記防止（重要）」セクションが含まれており、一般的な禁止語の回避方法を説明している。しかし「未定義」という複合語が「未定」の部分一致検出に引っかかることへの具体的な警告がない。

**根本原因の特定（禁止語）:** 「未定義」はプログラミング文書において頻繁に使用される正当な技術用語であり、subagent が禁止語の部分一致ルールを意識せずに自然に使用した。テンプレートの禁止語セクションに「未定」を含む複合語（未定義、未定形等）が検出対象になることへの言及がなかった。

**発生状況（行数不足）:** 「## 総合評価」セクションが4行しかなく、minSectionLines（5行）に達しなかった。

**テンプレート調査結果（行数不足）:** e2e_test の subagentTemplate には必須セクション（E2Eテストシナリオ・テスト実行結果）の行数ガイダンスは詳細に記述されているが、任意の「## 総合評価」セクション専用のガイダンスが欠落している。manual_test テンプレートには FR-11 として「## 総合評価セクションの記述指針」が追加されているが、e2e_test テンプレートには同等のガイダンスが存在しない。

**根本原因の特定（行数不足）:** manual_test の FR-11 実装時（commit 361fb5c）に、e2e_test テンプレートへの同等のガイダンス追加が漏れた。同種の問題に対して修正が一部のフェーズにのみ適用された横展開不足。

---

## 調査対象2: workflow_status から sessionToken が返されなかった問題

### status.ts の実装確認

`C:\ツール\Workflow\workflow-plugin\mcp-server\src\tools\status.ts`（行 84）を確認した結果、以下のコードが実装されている。

```typescript
...(taskState.sessionToken ? { sessionToken: taskState.sessionToken } : {}),
```

この条件付きスプレッドは **taskId を指定してタスク詳細を取得するモード**（行 49〜85）でのみ評価される。

### sessionToken が返されない条件

workflow_status を **taskId なし**で呼び出すと、全タスク一覧モード（行 34〜46）に入る。この場合のレスポンス構造は以下のとおりである。

```typescript
{
  success: true,
  status: 'active',
  tasks: activeTasks.map((t) => ({
    taskId: t.taskId,
    taskName: t.taskName,
    phase: t.phase,
    docsDir: t.docsDir,
  })),
  message: `${activeTasks.length}件のアクティブタスクがあります`,
}
```

全タスク一覧モードでは sessionToken フィールドが存在しない。各タスクのマップオブジェクト（taskId, taskName, phase, docsDir）にも sessionToken は含まれない。

### sessionToken を取得するための正しい手順

sessionToken を再取得するには、`workflow_status({ taskId: '<特定のtaskId>' })` のように taskId を明示指定する必要がある。taskId なしの呼び出しは sessionToken を返さない。

MEMORY.md の「セッション再開後は必ず workflow_status を呼び出してsessionTokenを再取得すること」という記述は、taskId を指定した呼び出しを前提としている。前回のワークフローでセッション再開後に sessionToken が返されなかった場合、taskId を省略した呼び出しを行っていた可能性が高い。

CLAUDE.md の「AIへの厳命23番目」には「workflow_status でsessionTokenを再取得」と書かれているが、taskId の指定が必須であることが明記されていない。この説明の不足が問題の根本原因である。

---

## 調査対象3: FR-REQ-1・FR-REQ-4 の根本原因

### FR-REQ-1: design-validator.test.ts の vi.mock('fs') 不完全問題

**DesignValidator が使用する fs 関数の確認:**

`design-validator.ts` の `persistCache()` メソッド（行 211〜222）が以下のfs関数を使用している。

```typescript
private persistCache(): void {
  const cachePath = path.join(this.projectRoot, '.claude/cache/ast-analysis.json');
  const data = Object.fromEntries(this.astCache);
  try {
    fs.mkdirSync(path.dirname(cachePath), { recursive: true });
    fs.writeFileSync(cachePath, JSON.stringify(data, null, 2));
  } catch (err) {
    // ...
  }
}
```

さらに `loadPersistedCache()`（行 192〜205）も `fs.existsSync` と `fs.readFileSync` を使用する。`validateAll()` の末尾（行 535〜536）で `persistCache()` が呼び出される。

**テストファイルの vi.mock('fs') ブロックの調査:**

`tests/validation/design-validator.test.ts` のテストは `vi.mock('fs')` でfsモジュール全体をモック化しているが、コミット 153587a 適用前は `mkdirSync` と `writeFileSync` が vi.fn() として定義されていなかった。vi.mock() でモック化されたモジュールは未定義の関数を呼び出すと TypeError が発生するため、`persistCache()` の実行でテストがクラッシュしていた。

**persistCache() が追加されたタイミング:**

git log を確認した結果、design-validator.ts に persistCache() が導入されたのはコミット `bb2c0b4`（REQ-FIX-3: ASTキャッシュLRU化・永続化対応）である。このコミットでは design-validator.ts に大規模な変更が加えられたが、対応するテストファイルの vi.mock('fs') ブロックへの追記が漏れた。テスト・実装の同期が取られないまま数コミットが経過し、FR-REQ-1 の問題として顕在化した。

**修正内容（commit 153587a）:**

```typescript
vi.mock('fs', () => ({
  existsSync: vi.fn(),
  readFileSync: vi.fn(),
  statSync: vi.fn(() => ({ isDirectory: () => false })),
  mkdirSync: vi.fn(),      // ← FR-REQ-1で追加
  writeFileSync: vi.fn(),  // ← FR-REQ-1で追加
}));
```

### FR-REQ-4: definitions.ts の bracketPlaceholderRegex フォールバック値乖離問題

**bracketPlaceholderRegex の変更履歴:**

1. コミット `3ef93b8`（FR-6）: artifact-validator.ts と definitions.ts の両方で `[##xxx]` 形式に変更。両ファイルが同期されていた。
2. コミット `6fa7e81`（`[##xxx]` から `[#xxx#]` へのパターン変更）: artifact-validator.ts の `bracketPlaceholderPattern` と exportGlobalRules 内の `bracketPlaceholderRegex` を `[#xxx#]` 形式に更新したが、**definitions.ts のフォールバック値が更新されなかった**。

`6fa7e81` のコミット差分から、変更対象は artifact-validator.ts のみであり definitions.ts は含まれていない。これが乖離の発生源である。

**なぜ乖離が生じたか:**

artifact-validator.ts の `exportGlobalRules()` 関数が定義するパターンと、definitions.ts の catch ブロック内フォールバック値は、コード上では独立したリテラル値として存在する。`exportGlobalRules()` の呼び出しが成功する通常時はフォールバック値は使用されないため、乖離があっても runtime エラーが発生しない。テストも通常パスは exportGlobalRules() を使用するため、フォールバック値の乖離を検出するテストケースが存在しなかった。

FR-REQ-4 の修正（commit 153587a）により、definitions.ts のフォールバック値が artifact-validator.ts と一致する `[#xxx#]` 形式に修正されている。

---

## 現状のテンプレート不足事項のまとめ

以下の点が requirements フェーズで対処すべき修正対象として特定された。

**manual_test テンプレートの不足事項（問題A）:**
- 「実行環境が全シナリオで共通の場合もシナリオ番号を行に含めること」という補完ガイダンスの不足。
- FR-1 の推奨パターン例示が「TC-1」「TC-2」形式であり、manual_test の命名規約「MT-1」「MT-2」と一致していないため subagent が参考にしにくい可能性がある。

**performance_test テンプレートの不足事項（問題B）:**
- 「任意で追加した ## セクション（requiredSections 以外）にも minSectionLines（5行）が適用される」という汎用的な警告の欠如。

**e2e_test テンプレートの不足事項（問題C）:**
- 禁止語「未定」を含む技術用語（未定義等）の言い換えガイダンスの不足。
- manual_test の FR-11（総合評価セクション記述指針）に相当するガイダンスの欠落。

**CLAUDE.md の不足事項（問題D）:**
- AIへの厳命23番目の「workflow_status でsessionTokenを再取得」という記述に、taskId の明示指定が必須であることが書かれていない。

---

## 既修正事項の確認

以下は commit 153587a で既に修正済みであることを確認した。

- FR-REQ-1: design-validator.test.ts の vi.mock('fs') に mkdirSync と writeFileSync を追加
- FR-REQ-4: definitions.ts のフォールバック値 bracketPlaceholderRegex を `/\[#[^\]]{0,50}#\]/g` に修正し、allowedKeywords を空配列にリセット

これらは requirements フェーズで改めて実装作業を行う必要はない。ただし、同種の乖離（artifact-validator.ts の変更時に definitions.ts フォールバック値を同時更新する）を防ぐためのプロセス改善方針は requirements フェーズで定義すること。
