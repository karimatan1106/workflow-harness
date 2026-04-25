# Refactoring Plan: Code Quality Improvements

**Phase:** refactoring  
**Date:** 2026-03-25  
**Analysis:** Coordinator (L2 - planning)

---

## Summary

コード品質レビューに基づき、以下の3つの改善領域を特定しました：
1. bash の重複コード排除（pre-tool-guard.sh）
2. TypeScript lifecycle handlers の責務分離確認
3. テスト保証計画

---

## Finding 1: pre-tool-guard.sh の FILE_PATH 抽出重複

### 現状分析

**重複検出：** FILE_PATH 抽出ロジックが3箇所に出現

```bash
# 出現箇所
- L57  (Write/Edit artifact check)
- L95  (Edit authorization check)
- 追加可能性: L106のエラーメッセージには含まれないが構造的に統一可能
```

**重複コード：**
```bash
FILE_PATH=$(echo "$INPUT" | grep -o '"file_path":"[^"]*"' | head -1 | sed 's/"file_path":"//;s/"//g')
```

### 品質指標

| 指標 | 現状 | 目標 |
|------|------|------|
| 行数（pre-tool-guard.sh） | 120 | <200 |
| 重複行数 | 9行相当 | 0 |
| 関数数 | 1個 (is_lifecycle_mcp) | 2個 (+ extract_json_field) |
| 命名一貫性 | extract パターン混在 | extract_* で統一 |

### 改善仕様

**関数化提案：extract_json_field**

```bash
# 新関数シグネチャ
extract_json_field() {
  local field_name="$1"      # e.g., "file_path", "tool_name"
  local input="$2"           # JSON input from stdin or arg
  echo "$input" | grep -o "\"$field_name\":\"[^\"]*\"" | head -1 \
    | sed "s/\"$field_name\"://;s/\"//g"
}

# 使用例
FILE_PATH=$(extract_json_field "file_path" "$INPUT")
TOOL_NAME=$(extract_json_field "tool_name" "$INPUT")
```

**削減効果：**
- 現状: 120行
- 改善後: ~115行 (実質5行削減、保守性向上)
- TOON: 9行相当の重複排除（コード品質スコア向上）

---

## Finding 2: TypeScript lifecycle handlers の責務分離確認

### 現状分析

**ファイルサイズ：**

| ファイル | 行数 | 責務 | 分割状態 |
|---------|------|------|---------|
| lifecycle.ts | 9行 | Barrel export | OK (分割済み) |
| lifecycle-start-status.ts | 143行 | harness_start, harness_status | OK |
| lifecycle-next.ts | 199行 | harness_next, DoD checks, phase advance | OK (上限付近) |
| lifecycle-completion.ts | 109行 | Task completion, analytics, metrics | OK |

### 分割状況の評価

✅ **既に 200行制約に準拠**

各ファイルが責務別に分割済み：
- `lifecycle-start-status.ts`: タスク作成・状態取得
- `lifecycle-next.ts`: フェーズ遷移・DoD検証
- `lifecycle-completion.ts`: タスク完了・分析生成

### 関数分割機会

**lifecycle-next.ts 内の内部関数（既に分割済み）：**

| 関数 | 行数 | 役割 |
|------|------|------|
| handleHarnessNext | 107行 | フェーズ遷移メイン |
| buildDoDFailureResponse | 50行 | DoD失敗時の応答構築 |
| addNextPhaseOutputFile | 12行 | 出力ファイル情報追加 |

結論：**さらなる分割は不要** — 責務が明確で、行数制限内。

---

## Finding 3: エラーハンドリング確認

### 分析結果

**Bash (pre-tool-guard.sh)：**
```
✓ exit code 構造化: 0=ALLOW, 2=BLOCK (1=エラー予約)
✓ エラーログ: log_trace_event で統一
✓ エラーメッセージ: stderr出力で一貫性あり
✓ 例外処理: trap 'exit 2' ERR で安全
```

**TypeScript (lifecycle handlers)：**
```
✓ respondError() で統一されたエラーレスポンス
✓ try-catch を non-blocking で適切に配置
✓ ユーザー向けメッセージと診断メッセージが分離
✓ VDB-1 (Validator Diagnosis Bug) 警告メカニズム実装済み
```

---

## Finding 4: 命名一貫性

### パターン分析

**Bash：**
- JSON抽出: `grep -o` + `sed` パターン（現状、統一性低）
- ✅ 改善後: `extract_json_field` で統一

**TypeScript：**
- ハンドラ: `handleHarness*` (統一)
- 内部関数: `build*`, `record*`, `write*`, `run*` (動詞で開始、統一)
- レスポンス: `respond()`, `respondError()` (統一)

結論：**TypeScript は既に命名基準を満たしている**

---

## Testing Strategy

### 1. 既存テストの対象範囲

**現状：** vitest で以下をカバー

```
✓ manager-lifecycle.test.ts     (26 tests)
✓ handler-lifecycle.test.ts     (12 tests)
✓ manager-lifecycle-reset.test.ts (8 tests)
合計: 46 tests
```

**既知問題：** 並列実行時に19/88ファイルが失敗（リソース競合）
→ 個別実行では全PASS

### 2. 改善後のテスト計画

**bash 関数化の検証（新テスト）：**
```bash
# extract_json_field 単体テスト
- 正常系: 複数フィールド抽出
- エッジケース: クォート含む値、空文字列、フィールド不在
- 既存ロジック との互換性検証
```

**TypeScript 既存テストの再実行：**
```bash
vitest --run --reporter=verbose
# 期待: 46/46 PASS
```

### 3. 品質チェックリスト

- [ ] bash: shellcheck で pre-tool-guard.sh をチェック
- [ ] bash: extract_json_field 関数の単体テスト実装
- [ ] TypeScript: 既存テスト全PASS確認
- [ ] TypeScript: 責務分離評価（cyclomatic complexity)
- [ ] コード: 禁止語チェック（TODO, TBD, WIP等)
- [ ] ドキュメント: @spec タグの参照先確認

---

## Worker Task Decomposition

以下のタスクを Worker に委譲：

### Task 1: Bash 関数化実装
**Scope:** pre-tool-guard.sh
**Action:**
1. `extract_json_field(field_name, input)` 関数を作成
2. L31-32, L57, L95 をこの関数で置き換え
3. shellcheck で検証
4. git diff で重複削減を確認

**DoD:**
- shellcheck: no warnings
- 既存動作: 変更なし（exit code, ログ出力）
- 行数: 120 → 115 以下

### Task 2: TypeScript テスト再実行
**Scope:** mcp-server/
**Action:**
1. `vitest --run --reporter=verbose` 実行
2. 全テスト結果をレポート
3. 並列実行での失敗を個別実行で検証
4. 既知問題（19/88）の状況確認

**DoD:**
- 関数化前: 46/46 PASS
- 関数化後: 46/46 PASS（回帰なし）
- 並列実行での新規失敗: なし

### Task 3: コード品質レポート作成
**Scope:** docs/workflows/refactoring.md
**Action:**
1. 実装結果を本ファイルの「実装結果」セクションに記録
2. 定量的な改善指標（行数、重複検出、テスト実行結果）を記載
3. 問題や推奨事項をまとめる

**DoD:**
- セクション: 実装結果、テスト結果、推奨事項
- 禁止語: なし
- AC: 5個以上の具体的な測定値

---

## Acceptance Criteria (AC)

- **AC-1:** pre-tool-guard.sh の FILE_PATH 抽出が extract_json_field 関数で統一される
- **AC-2:** extract_json_field は 3箇所の重複を削減し、保守性を向上させる
- **AC-3:** 関数化後の shell スクリプトは shellcheck で no warnings
- **AC-4:** TypeScript lifecycle handlers のテストは全PASS（46/46）
- **AC-5:** refactoring.md に定量的な品質指標と改善結果を記載

---

## Requirements Traceability Matrix (RTM)

| RTM ID | 要件 | Finding | Task | AC |
|--------|------|---------|------|-----|
| F-001 | FILE_PATH 重複排除 | Finding 1 | Task 1 | AC-1, AC-2 |
| F-002 | 関数の可読性向上 | Finding 1 | Task 1 | AC-3 |
| F-003 | TypeScript テスト保証 | Finding 3 | Task 2 | AC-4 |
| F-004 | 品質ドキュメント | Finding 1-4 | Task 3 | AC-5 |
| F-005 | コード品質基準達成 | Finding 2,3 | Task 1-2 | AC-1..AC-5 |

---

## 実装結果（更新対象）

### 実装前
- 本セクションは計画フェーズで記載なし

### 実装後
*Worker による実装完了後に記載*

---

## 推奨事項・今後の改善

1. **Bash 共有ライブラリ化**
   - `extract_json_field` を `hooks/` に共有関数として提供
   - 他のスクリプトでも JSON抽出が必要な場合は再利用可能

2. **TypeScript 関数分割ルール**
   - 200行制限の下、各ハンドラは平均 100-150 行に抑える
   - 現状基準を維持

3. **テスト自動化の改善**
   - vitest の並列実行問題（19/88失敗）の根本原因分析
   - リソース競合による false negative を排除

4. **品質指標の定期測定**
   - 月次でコード複雑度（cyclomatic complexity）を測定
   - 関数長・重複率の自動チェック導入

---

## Phase Gates

- **P0 (Planning):** ✅ Coordinator による分析完了
- **P1 (Implementation):** Worker による Task 1-2 実行予定
- **P2 (Validation):** DoD check 実施予定
- **P3 (Documentation):** Task 3 にて refactoring.md 更新

