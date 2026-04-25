# 要件定義: Bashファイル操作のフェーズ制限

## 1. 概要

### 1.1 背景

phase-edit-guard.js は現在 Edit/Write ツールのフェーズ別制限を実装しているが、Bash ツールによるファイル操作に対する制限が不完全である。

**現在の問題点:**
- `echo >`, `sed -i`, `tee` などのファイル修正コマンドがほぼブロックされない
- 読み取り専用フェーズ（research, build_check, testing等）でもファイル操作が可能
- フックの制限を容易に回避できる

### 1.2 目的

phase-edit-guard.js を拡張し、Bash ツールによるファイル操作を各ワークフローフェーズに応じて適切にブロックする。

### 1.3 スコープ

**対象:**
- リダイレクト操作（`>`, `>>`）
- インプレース編集（`sed -i`, `awk -i`）
- パイプ出力（`| tee`）
- ファイル削除・移動（`rm`, `mv`, `cp`）
- Heredoc（`<< EOF`）

**対象外:**
- ビルドツール（npm, pnpm, cargo等）の実行
- プロセス管理コマンド（taskkill, kill等）
- 読み取り専用コマンド（ls, cat, grep等）- 明示的に許可

---

## 2. 機能要件

### 2.1 Bashコマンド解析機能

**FR-001: ファイル修正コマンドの検出**

以下のパターンを検出し、ファイル操作として扱う:

| パターン | 正規表現 | 例 |
|---------|---------|-----|
| リダイレクト | `/\becho\s+.*>/i` | `echo "code" > file.ts` |
| リダイレクト | `/\bcat\s+.*>/i` | `cat input.txt > output.ts` |
| リダイレクト | `/\bprintf\s+.*>/i` | `printf "text" > file.md` |
| インプレース編集 | `/\bsed\s+(-i|--in-place)/i` | `sed -i 's/old/new/' file.ts` |
| インプレース編集 | `/\bawk\s+.*>>/i` | `awk '{print}' >> file.js` |
| パイプ出力 | `/\btee\s+/i` | `echo "text" | tee file.md` |
| ファイル作成 | `/\btouch\s+/i` | `touch new-file.ts` |
| ファイル削除 | `/\brm\s+.*\.(ts|js|md|mmd)/i` | `rm src/file.ts` |
| ファイル移動 | `/\bmv\s+/i` | `mv old.ts new.ts` |
| ファイルコピー | `/\bcp\s+/i` | `cp template.ts new.ts` |
| ディレクトリ削除 | `/\brmdir\s+/i` | `rmdir src/` |
| ディレクトリ作成 | `/\bmkdir\s+.*\/(src|tests)/i` | `mkdir src/components` |

**FR-002: 常に許可するコマンドの定義**

以下のコマンドはフェーズに関係なく常に許可:

```javascript
const ALWAYS_ALLOWED_BASH_PATTERNS = [
  // 読み取り専用
  /^\s*(ls|dir|pwd|cat|head|tail|less|more|grep|rg|find|tree|wc|file|stat)\s/i,
  // プロセス情報
  /^\s*(ps|top|htop)\s/i,
  // Git読み取り
  /\bgit\s+(status|log|diff|branch|show|remote)\b/i,
  // ネットワーク読み取り
  /^\s*(curl|wget|netstat|ping|nc|nslookup|dig)\s/i,
  // システム情報
  /^\s*(uname|hostname|whoami|id|env|printenv|which|where|type)\s/i,
  // スリープ・待機
  /^\s*(sleep|wait)\s/i,
];
```

**FR-003: ファイルパス抽出**

ファイル修正コマンドから対象ファイルパスを抽出する（簡易実装）:

```javascript
const fileMatch = command.match(/[^\s]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml)(?:\s|$)/i);
const filePath = fileMatch ? fileMatch[0].trim() : null;
```

### 2.2 フェーズ別制限ルール

**FR-004: 読み取り専用フェーズの厳格制限**

以下のフェーズでは、明示的に許可されたコマンド以外は全てブロック:

| フェーズ | 許可コマンド | ブロック対象 |
|---------|-------------|-------------|
| research | 読み取り専用コマンドのみ | ファイル修正・削除・移動 |
| build_check | 読み取り専用コマンドのみ | ファイル修正・削除・移動 |
| testing | 読み取り専用コマンドのみ | ファイル修正・削除・移動 |
| manual_test | 読み取り専用コマンドのみ | ファイル修正・削除・移動 |
| security_scan | 読み取り専用コマンドのみ | ファイル修正・削除・移動 |
| commit | 読み取り専用コマンドのみ | ファイル修正・削除・移動 |

**FR-005: ファイルタイプ別制限（読み取り専用以外のフェーズ）**

読み取り専用フェーズ以外では、既存のファイルタイプ判定ロジックを使用:

```javascript
if (!analysis.isModifying) {
  // ファイル修正なし → 許可
  process.exit(EXIT_CODES.SUCCESS);
}

// ファイルパスを抽出してファイルタイプを判定
const fileType = getFileType(filePath);

// フェーズルールに基づいて判定
if (!canEditInPhase(phase, fileType)) {
  // ブロック
  displayBlockMessage(phase, filePath, fileType, rule);
  process.exit(EXIT_CODES.BLOCK);
}
```

**例:**
- test_impl フェーズで `echo "code" > src/main.ts` → ブロック（code タイプ）
- test_impl フェーズで `echo "test" > src/main.test.ts` → 許可（test タイプ）
- implementation フェーズで `echo "code" > src/main.ts` → 許可（code タイプ）

### 2.3 エラーメッセージ

**FR-006: ブロック時のメッセージ表示**

ファイル操作がブロックされた場合、以下を表示:

```
============================================================
 Bashファイル操作がブロックされました
============================================================

 フェーズ: test_impl（テスト実装（Red））
 コマンド: echo "code" > src/main.ts
 ファイル: src/main.ts
 ファイルタイプ: code（ソースコード）

 理由: テスト実装フェーズ（TDD Red）。テストコードのみ作成してください。

 TDD サイクル:
   1. Red フェーズ（test_impl）: テストコードを書く ← 現在地
   2. Green フェーズ（implementation）: テストを通す実装を書く
   3. Refactor フェーズ（refactoring）: コード品質を改善

 許可されるファイル:
   - テストコード: *.test.ts, *.spec.ts, __tests__/
   - 仕様書: *.md

 次のステップ:
   1. テストコード（.test.ts, .spec.ts）を作成してください
   2. テスト作成が完了したら /workflow next で次フェーズへ

 スキップ（緊急時のみ）:
   SKIP_PHASE_GUARD=true を設定

============================================================
```

**FR-007: 読み取り専用フェーズのメッセージ**

読み取り専用フェーズでブロックされた場合:

```
============================================================
 Bashコマンドがブロックされました
============================================================

 フェーズ: research（調査）
 コマンド: sed -i 's/old/new/' src/file.ts

 理由: research フェーズは読み取り専用です。ファイル編集はできません。

 このフェーズでは読み取り専用コマンドのみ許可されます。
 許可: ls, cat, grep, curl, git status/log/diff 等

============================================================
```

---

## 3. 非機能要件

### 3.1 パフォーマンス

**NFR-001: コマンド解析時間**
- Bashコマンドの解析は100ms以内に完了すること
- 正規表現のコンパイルは起動時に1回のみ

**NFR-002: メモリ使用量**
- 追加メモリ使用量は10MB以下
- ログファイルは100エントリで上限

### 3.2 保守性

**NFR-003: 既存コードの再利用**
- 既存の `getFileType()` 関数を再利用
- 既存の `canEditInPhase()` 関数を再利用
- 既存の `displayBlockMessage()` フォーマットを踏襲

**NFR-004: テスタビリティ**
- `analyzeBashCommand()` 関数をエクスポートしてテスト可能にする
- 各正規表現パターンを定数として定義

### 3.3 ユーザビリティ

**NFR-005: エラーメッセージの明確性**
- ブロック理由を日本語で明確に表示
- 許可されるコマンド例を提示
- 次のステップを具体的に案内

**NFR-006: デバッグサポート**
- `DEBUG_PHASE_GUARD=true` で詳細ログを出力
- 全てのチェック結果をログファイルに記録

### 3.4 互換性

**NFR-007: 既存機能への影響なし**
- Edit/Write ツールの動作に影響を与えない
- 既存のスキップ機能（`SKIP_PHASE_GUARD=true`）を維持

---

## 4. 受け入れ基準

### 4.1 機能テスト

**AC-001: 読み取り専用フェーズでのファイル操作ブロック**

| フェーズ | コマンド | 期待結果 |
|---------|---------|---------|
| research | `echo "code" > src/main.ts` | ブロック |
| research | `sed -i 's/a/b/' src/main.ts` | ブロック |
| research | `cat input.txt | tee output.ts` | ブロック |
| research | `rm src/main.ts` | ブロック |
| research | `cat src/main.ts` | 許可 |
| research | `grep "text" src/*.ts` | 許可 |
| research | `git diff` | 許可 |

**AC-002: test_impl フェーズでのソースコード編集ブロック**

| コマンド | 期待結果 | 理由 |
|---------|---------|------|
| `echo "code" > src/main.ts` | ブロック | code タイプは禁止 |
| `echo "test" > src/main.test.ts` | 許可 | test タイプは許可 |
| `sed -i 's/a/b/' src/main.ts` | ブロック | code タイプは禁止 |
| `touch src/new.test.ts` | 許可 | test タイプは許可 |

**AC-003: implementation フェーズでの制限なし**

| コマンド | 期待結果 |
|---------|---------|
| `echo "code" > src/main.ts` | 許可 |
| `sed -i 's/a/b/' src/main.ts` | 許可 |
| `rm src/old.ts` | 許可 |
| `mkdir src/components` | 許可 |

**AC-004: 常に許可されるコマンド**

全フェーズで以下は許可:

| コマンド | 理由 |
|---------|------|
| `ls -la` | 読み取り専用 |
| `cat README.md` | 読み取り専用 |
| `grep "text" src/*.ts` | 読み取り専用 |
| `git status` | 読み取り専用 |
| `curl https://example.com` | 読み取り専用 |
| `npm install` | ビルドツール（明示的許可なし → ファイル修正でない） |
| `pnpm test` | ビルドツール（明示的許可なし → ファイル修正でない） |

### 4.2 エラーメッセージテスト

**AC-005: ブロックメッセージの内容**

ブロック時のメッセージに以下が含まれること:
- [x] フェーズ名と日本語名
- [x] ブロックされたコマンド（最初の100文字）
- [x] ファイルパス（抽出できた場合）
- [x] ファイルタイプと日本語名（抽出できた場合）
- [x] ブロック理由
- [x] 許可されるコマンド例
- [x] 次のステップ
- [x] スキップ方法

**AC-006: TDDフェーズでのTDDサイクル説明**

test_impl, implementation, refactoring フェーズでは:
- [x] TDDサイクルの説明を表示
- [x] 現在地（Red/Green/Refactor）を明示

### 4.3 パフォーマンステスト

**AC-007: コマンド解析時間**

- [x] `analyzeBashCommand()` の実行時間が100ms以内
- [x] 100回連続実行で平均50ms以下

### 4.4 回帰テスト

**AC-008: 既存機能への影響なし**

- [x] Edit ツールの動作に変更なし
- [x] Write ツールの動作に変更なし
- [x] 既存テストが全てパス

---

## 5. 実装方針

### 5.1 実装箇所

**ファイル:** `workflow-plugin/hooks/phase-edit-guard.js`

**追加関数:**
```javascript
function analyzeBashCommand(command)
function extractFilePathFromCommand(command)
```

**修正箇所:**
- `main()` 関数の Bash ツール処理部分（行1167-1256）

### 5.2 実装の流れ

```
1. Bash ツールの入力を受信
   ↓
2. analyzeBashCommand() でコマンドを解析
   - 明示的に許可されたコマンド → 許可
   - ファイル修正コマンド → 次へ
   - それ以外 → 許可
   ↓
3. ワークフロー状態を確認
   - 未開始 → 許可
   - 開始済み → 次へ
   ↓
4. 読み取り専用フェーズの場合
   - ブロックメッセージ表示
   - EXIT_CODES.BLOCK で終了
   ↓
5. ファイルパスを抽出
   - 抽出できない → ワークフロー状態により判定
   - 抽出成功 → 次へ
   ↓
6. ファイルタイプを判定
   ↓
7. フェーズルールに基づいて判定
   - canEditInPhase() で判定
   - 許可 → EXIT_CODES.SUCCESS
   - ブロック → ブロックメッセージ表示 → EXIT_CODES.BLOCK
```

### 5.3 テスト戦略

**ユニットテスト:**
- `analyzeBashCommand()` の各正規表現パターン
- ファイルパス抽出ロジック
- フェーズ別判定ロジック

**統合テスト:**
- 各フェーズでの実際のBashコマンド実行
- エラーメッセージの内容確認

---

## 6. リスク管理

### 6.1 技術的リスク

| リスク | 影響 | 対策 |
|--------|------|------|
| 正規表現のパフォーマンス問題 | 高 | 起動時に正規表現をコンパイル |
| ファイルパス抽出の誤検出 | 中 | 簡易実装で対応、完璧を求めない |
| 既存機能の破壊 | 高 | 既存テストの全実行 |

### 6.2 運用リスク

| リスク | 影響 | 対策 |
|--------|------|------|
| 新しいファイル操作コマンドの出現 | 低 | 正規表現パターンを追加 |
| ユーザーの混乱 | 中 | 明確なエラーメッセージ |
| 緊急時の回避不可 | 高 | SKIP_PHASE_GUARD=true を維持 |

---

## 7. 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-03 | 1.0 | 初版作成 |

---

## 8. 関連ドキュメント

- `workflow-plugin/hooks/phase-edit-guard.js` - 実装対象ファイル
- `workflow-plugin/hooks/__tests__/phase-edit-guard.test.js` - テストファイル
- `docs/spec/features/phase-edit-guard.md` - 機能仕様書（未作成）
- `CLAUDE.md` - ワークフロールール

---

## 9. 用語集

| 用語 | 説明 |
|------|------|
| phase-edit-guard | フェーズ別編集制限フック（PreToolUse） |
| ファイル修正コマンド | リダイレクト、インプレース編集、ファイル削除等 |
| 読み取り専用フェーズ | research, build_check, testing, manual_test, security_scan, commit |
| TDD Red | test_impl フェーズ（テスト作成） |
| TDD Green | implementation フェーズ（実装） |
| TDD Refactor | refactoring フェーズ（リファクタリング） |

---

## 10. 承認

| 役割 | 氏名 | 承認日 |
|------|------|--------|
| 要件定義 | Claude Code | 2026-02-03 |
| レビュー | - | - |
| 承認 | - | - |
