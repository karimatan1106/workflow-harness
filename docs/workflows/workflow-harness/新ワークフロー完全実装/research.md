# Research: 新ワークフロー完全実装

## サマリー

- [R-001][finding] 30フェーズ全てがPHASE_ORDER(registry.ts:57-89)に実装済み
- [R-002][finding] harness_start でuserIntent20文字・曖昧表現検出が実装済み(handler.ts:402-434)
- [R-003][finding] リトライ上限5回(RLM-1)がhandler.ts:479-490に実装済み
- [R-004][finding] IA-1(OPEN_QUESTIONS)とIA-2(AC-N最小3件+NOT_IN_SCOPE)が実装済み
- [R-005][finding] IA-3/IA-4/IA-5の3検証がgates/dod.tsに未実装（CRITICAL GAP）
- [R-006][finding] MCP SDK v1.26.0以上、TOON-first blocking、Delta Entry全て実装済み
- [R-007][decision] 実装対象をIA-3/IA-4/IA-5の3DoD検証に絞り込む
- [R-008][risk] dod.tsへの変更は既存204テストへの影響があるため慎重に追加する

## 調査結果

### 実装済み機能（✅）

| 機能 | 場所 | 詳細 |
|------|------|------|
| 30フェーズ定義 | phases/registry.ts:57-89 | PHASE_ORDER全30フェーズ + completed |
| フェーズ定義テンプレート | phases/definitions.ts | scope_definition〜health_observation全定義 |
| userIntent最小長(20文字) | tools/handler.ts:406 | harness_startでブロック |
| 曖昧表現検出 | tools/handler.ts:408-420 | 12種類（とか/など/いい感じ等） |
| リトライ上限(5回) | tools/handler.ts:479-490 | RLM-1実装済み |
| IA-1 OPEN_QUESTIONS | tools/handler.ts:619-646 | requirements承認ゲートブロック |
| IA-2 AC最小3件 | tools/handler.ts:647-656 | requirements承認ゲートブロック |
| IA-2 NOT_IN_SCOPE | gates/dod.ts:520-551 | L4チェック実装済み |
| IA-6 acceptance_verification | phases/registry.ts | フェーズ定義済み・承認ゲート実装済み |
| IA-7 impact_analysis位置 | phases/registry.ts | research後・parallel_analysis前に正しく配置 |
| TOON-first blocking | gates/dod.ts:792-795 | L4ブロッキング（今セッション実装） |
| Delta Entry L4 | gates/dod.ts:604-700 | 5件以上・カテゴリ検証 |
| RTM追跡 | gates/dod.ts:352-417 | pending→implemented→tested→verified |
| ACE Reflector/Curator | tools/reflector.ts, curator.ts | 完全実装・30フェーズ全カバー |
| sessionToken二層ルール | tools/handler.ts:351-355 | Layer1/Layer2実装済み |

### 未実装機能（❌）

#### IA-3: AC→設計マッピング検証（design_review）

**仕様**: design_review成果物に全AC-Nの設計要素マッピングが存在すること。
**現状**: gates/dod.tsにdesign_reviewのAC→設計マッピング検証なし。
**影響**: harness_approve(type="design")時にマッピング漏れを見逃す。

#### IA-4: AC→TCトレーサビリティ検証（test_design）

**仕様**: test-design.mdに全AC-NのTC-{AC#}-{連番}マッピングが存在すること。
**現状**: definitions.tsのテンプレートに「## AC→TC 追跡マトリクス」の記述要求はあるがDoDチェックなし。
**影響**: harness_approve(type="test_design")時にトレーサビリティ欠如を見逃す。

#### IA-5: AC達成状況テーブル（code_review）

**仕様**: code-review.mdに「## AC Achievement Status」テーブル(pass/fail)が必要。
**現状**: definitions.tsのテンプレートに記述要求はあるがDoDチェックなし。
**影響**: harness_approve(type="code_review")時にAC未達成を見逃す。

## 既存実装の分析

### gates/dod.ts の現行チェック構成

```
runDoDChecks() で実行するチェック (計12件):
1. L1: baseline_exists       - ベースラインファイル存在確認
2. L2: build_check           - ビルドexitコード確認
3. L3: content_lines         - 最小行数チェック
4. L4: required_sections     - 必須セクション存在
5. L3: rtm_completeness      - RTMエントリステータス
6. L3: ac_completeness       - ACカバレッジ
7. L4: ac_format             - AC-N形式（requirements専用）
8. L4: not_in_scope_section  - NOT_IN_SCOPE存在（requirements専用）
9. L4: open_questions_section- OPEN_QUESTIONS存在（requirements専用）
10. L3: baseline_required    - regression_test専用
11. L4: delta_entry_format   - Deltaエントリ形式（19フェーズ）
12. L4: toon_checkpoint      - TOONチェックポイント（17フェーズ）
```

### 追加が必要なチェック

```
13. L4: ac_design_mapping    - design_review専用: AC-Nの設計マッピングテーブル存在
14. L4: ac_tc_mapping        - test_design専用: AC-NのTC-{AC#}-{連番}マッピング存在
15. L4: ac_achievement_table - code_review専用: AC Achievement Statusテーブル存在
```

### 影響ファイル

- `mcp-server/src/gates/dod.ts` — 3つのL4チェック関数追加
- `mcp-server/src/__tests__/dod.test.ts` — 新チェックのテスト追加
- `mcp-server/src/__tests__/handler.test.ts` — 必要に応じてテスト更新

### 技術的制約

- dod.ts の現行チェック数: 12件（テストで`toHaveLength(12)`を使用）
- 追加後: 15件（テスト更新が必要）
- IA-3/IA-4/IA-5は特定フェーズ専用なので`runDoDChecks`の条件分岐で追加
