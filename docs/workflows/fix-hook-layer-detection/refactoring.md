# Refactoring — fix-hook-layer-detection

## summary

実装フェーズで加えた変更を対象にスコープレビューを実施した結果、リファクタリングすべき箇所は検出されなかった。変更は追加的 (additive) または最小 (minimal) で、重複・長メソッド・複雑条件分岐・マジックナンバーのいずれの兆候も存在しない。テストは全件 Green を維持している。

## scope review

レビュー対象:

- `workflow-harness/hooks/tool-gate.js` L23-29 `detectLayer()` — 6 行の env 変数参照と null guard のみ
- `workflow-harness/hooks/tool-gate.js` `L1_ALLOWED` Set エントリ追加 — 定数への追記 1 行
- `workflow-harness/hooks/phase-config.js` — allowlist 配列への 1 エントリ追加
- `workflow-harness/hooks/__tests__/tool-gate.test.js` — 既存 `hook-utils.test.js` の構造を踏襲したユニットテスト

観点別の判定:

- 重複コード: 無し。`detectLayer()` は他箇所に類似ロジックなし
- 長メソッド: 無し。最長でも 6 行
- 複雑条件分岐: 無し。早期 return 2 段のみ
- マジックナンバー: 無し。文字列定数は `HARNESS_LAYER` など意味のある識別子
- 命名: `detectLayer` / `L1_ALLOWED` は役割を正確に表現しており改名不要
- 責務分離: `detectLayer()` は単一責務 (env+hookInput → layer 判定) を満たす
- 200 行制限: tool-gate.js 全体でも制限内

## rationale

変更が本質的に最小であるため、過剰なリファクタリングはかえって可読性を損なう。具体的には:

- `detectLayer()` の body は env 変数参照 → hookInput 参照 → fallback の 3 段構造で、これ以上分解すると呼び出しオーバーヘッドが命名コストを上回る
- Set への単一エントリ追加と allowlist への単一エントリ追加は、リファクタではなくデータ追加に分類される
- テストファイルは既存 `hook-utils.test.js` のパターンに忠実であり、共通化するほどのバリエーションが現段階では存在しない

複雑度メトリクス (目視): cyclomatic complexity = 3 (detectLayer), 変更前後で変化なし。重複も導入されていない。

## decisions

- D-001: 重いリファクタは実施しない。理由: 変更規模が小さく、リファクタ対象の兆候 (重複・長メソッド・複雑条件) が観測されないため
- D-002: `detectLayer()` を分割しない。理由: 3 段の早期 return は意図が明瞭で、分割すると呼び出し関係が増えむしろ複雑化するため
- D-003: Set 定義と allowlist 配列を共通化しない。理由: 用途 (layer 判定 vs phase 内 path 判定) が異なり、無理な共通化は結合度を不必要に上げるため
- D-004: テストの共通ヘルパ抽出は見送る。理由: 10 TC 程度の規模では beforeEach/afterEach でリセットすれば十分で、ヘルパ層を増やすと追跡性が落ちるため
- D-005: Green 維持確認のみで本フェーズを終える。理由: リファクタ対象が無ければ TDD Refactor の狙い (品質改善) は既に達成状態にあるため

## verification

### test execution

Command: `node --test C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js`

Result: 10 pass / 0 fail / 0 skip, exit code 0

```
# tests 10
# suites 0
# pass 10
# fail 0
# cancelled 0
# skipped 0
# todo 0
# duration_ms 61.8516
EXIT=0
```

個別 TC の pass 状況:

- ok 1 TC-AC1-01: opaque hex agent_id returns worker
- ok 2 TC-AC1-02: arbitrary 16-char hex agent_id returns worker
- ok 3 TC-AC2-01: HARNESS_LAYER=worker overrides hookInput
- ok 4 TC-AC2-02: HARNESS_LAYER=coordinator returns coordinator
- ok 5 TC-AC3-01: null hookInput returns orchestrator
- ok 6 TC-AC3-02: hookInput without agent_id returns orchestrator
- ok 7 TC-AC3-03: empty string agent_id returns orchestrator
- ok 8 TC-AC4-01: worker layer can write to docs/workflows path (no phase)
- ok 9 TC-AC4-02: orchestrator layer is blocked from docs/workflows path
- ok 10 TC-AC5-01: tool-gate.test.js exists at expected path

### quality gates

- Lint: 影響範囲に新規違反なし (変更行は既存スタイルと一致)
- 型チェック: .js ファイルのため対象外
- 禁止語チェック: 該当語彙は本ドキュメントおよび変更ファイルに含まれない

## artifacts

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/refactoring.md (本ファイル)
- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (変更対象、追加変更なし)
- C:/ツール/Workflow/workflow-harness/hooks/phase-config.js (変更対象、追加変更なし)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (Green 維持確認に使用)

## next

- testing phase: 全 AC 観点の受入テストを実行し PASS を記録
- e2e_test phase: harness 起動〜docs/workflows 書き込みまでの実行経路を e2e で確認
- dod_check phase: AC-1〜AC-5 の充足を最終検証
