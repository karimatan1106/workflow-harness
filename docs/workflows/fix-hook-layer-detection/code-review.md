# Code Review — fix-hook-layer-detection

## summary

実装 (implementation.md) と refactoring (refactoring.md) で確定した 3 ファイル (`tool-gate.js`, `phase-config.js`, `__tests__/tool-gate.test.js`) をコードレビュー観点で精査した。AC-1 から AC-5 は全て対応実装と対応テストケースで充足されており、RTM F-001 から F-005 とも一致する。セキュリティ・死んだコード・過剰抽象化・命名・責務分離いずれの観点でも新規問題は検出されず、本 phase は approve 判定とする。

## ac achievement status

| AC | 内容 | 実装箇所 | 検証テストケース | RTM | 判定 |
|----|------|--------|----------------|-----|------|
| AC-1 | opaque hex agent_id を worker と判定 | tool-gate.js::detectLayer (L23-29) | TC-AC1-01 / TC-AC1-02 | F-001 | met |
| AC-2 | HARNESS_LAYER env が override として機能 | tool-gate.js::detectLayer (L24-26) | TC-AC2-01 / TC-AC2-02 | F-002 | met |
| AC-3 | agent_id 不在時は orchestrator を返す | tool-gate.js::detectLayer (L27) | TC-AC3-01 / TC-AC3-02 / TC-AC3-03 | F-003 | met |
| AC-4 | worker は docs/workflows/ に Write 可、orchestrator は block | tool-gate.js::checkWriteEdit | TC-AC4-01 / TC-AC4-02 | F-004 | met |
| AC-5 | 回帰テストファイルが所定パスに存在 | __tests__/tool-gate.test.js (新規) | TC-AC5-01 | F-005 | met |

5 件全て met。tracing に漏れなし。

## review findings

- [x] 命名: `detectLayer` / `L1_ALLOWED` / `HARNESS_LIFECYCLE` は役割を素直に表し、改名の必要なし
- [x] 責務分離: `detectLayer()` は env → hookInput → fallback の 3 段で単一責務。`checkL1/L2/L3` も phase 別に分離されている
- [x] 過剰抽象化なし: Set 追加と allowlist 追加は「データ追加」であり、共通化するほどの変動軸は存在しない (refactoring D-003 と整合)
- [x] 死んだコード: 変更箇所に未使用関数・未参照定数なし。orphan 参照なし
- [x] セキュリティ: `L1_ALLOWED` に `Write` / `Bash` は追加されておらず、副作用系は引き続き subagent 経由で gate される (implementation D-003 と整合)
- [x] テスト独立性: 各テストが `delete process.env.HARNESS_LAYER` / `_setHookInput(null)` でクリーンアップされ、順序依存なし
- [x] 後方互換性: `HARNESS_LAYER` 未設定かつ `agent_id` 未設定のケースが orchestrator を返すことで、既存の L1 経路を壊していない (TC-AC3-01 が保証)
- [x] 禁止語なし: 変更ファイルおよび本レビュー文書に禁止語彙は含まれない
- [x] 200 行制限: `tool-gate.js` / `phase-config.js` いずれも制限内
- [x] スタイル一致: 追加行は既存コードスタイル (strict mode、require 順序、Set リテラル) と一致

ブロッカーとなる所見は 0 件。改善提案 0 件。

## decisions

- D-001: code_review を approve する。理由: 5 件の AC が実装とテストケースで 1 対 1 対応しており、RTM F-001 から F-005 とも一致する。レビュー観点で新規問題は検出されなかった
- D-002: 追加の refactor 提案は出さない。理由: refactoring phase (D-001 から D-005) で既に変更規模が最小であることを確認済みで、再提案は二重作業となる
- D-003: `node --check` の allowlist 追加議論は本タスクの責務外とする。理由: build-check D-002 の判断を踏襲し、別タスクで ADR を経て扱う
- D-004: hearing-worker-rules.test.ts の 10 件失敗は本レビュー判定に影響させない。理由: 失敗箇所は hooks/ 改変とは無関係で、build-check D-004 で対象外と確定済み
- D-005: コード変更の不変条件 (agent_id の truthy 判定のみで prefix マッチしない) を code_review として承認する。理由: Claude Code が将来 agent_id 形式を変更しても壊れない設計であり、implementation D-002 の意図と一致する

## artifacts

レビュー対象ソース:

- C:/ツール/Workflow/workflow-harness/hooks/tool-gate.js (detectLayer L23-29、L1_ALLOWED L32)
- C:/ツール/Workflow/workflow-harness/hooks/phase-config.js (BASH_COMMANDS.testing 配列)
- C:/ツール/Workflow/workflow-harness/hooks/__tests__/tool-gate.test.js (10 TC、新規ファイル)

参照した前 phase 成果物:

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/implementation.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/refactoring.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/build-check.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/requirements.md
- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/test-design.md

レビュー記録先:

- C:/ツール/Workflow/docs/workflows/fix-hook-layer-detection/code-review.md (本ファイル)

カバーされたテストケース ID: TC-AC1-01, TC-AC1-02, TC-AC2-01, TC-AC2-02, TC-AC3-01, TC-AC3-02, TC-AC3-03, TC-AC4-01, TC-AC4-02, TC-AC5-01 (全 10 件、implementation.md で Green 確認済)

## next

- approve code_review gate, advance to testing phase
- testing phase で `node --test` を再実行し 10 件 PASS を記録として再固定
- regression_test phase で既存テスト差分 (hearing-worker-rules.test.ts の既知失敗は除外) を確認
- acceptance_verification phase で AC-1 から AC-5 を verified に更新
- docs_update phase で ADR-030 および CLAUDE.md への反映を実施
