# 脅威モデル: Bashファイル操作のフェーズ制限

## 1. システム概要

### 1.1 対象システム

**機能:** phase-edit-guard.js の Bash コマンド解析機能

**目的:** Bash ツールによるファイル操作をワークフローフェーズに応じて制限し、TDD/CDD サイクルの遵守を強制する。

**セキュリティ境界:**
- 入力: Claude の Bash ツール実行要求（JSON形式）
- 処理: 正規表現によるコマンド解析とフェーズ別許可判定
- 出力: 許可（exit 0）またはブロック（exit 2）

### 1.2 信頼境界

```
┌─────────────────────────────────────────────────────────────┐
│                    信頼境界図                                │
├─────────────────────────────────────────────────────────────┤
│                                                             │
│  Claude Agent (信頼できない)                                │
│       ↓                                                     │
│  JSON入力 (toolName: "Bash", command: "...")                │
│       ↓                                                     │
│  ┌──────────────────────────────────────┐                  │
│  │  phase-edit-guard.js (信頼境界)      │                  │
│  │  - コマンド解析（正規表現）          │                  │
│  │  - フェーズ判定                      │                  │
│  │  - ファイルタイプ判定                │                  │
│  └──────────────────────────────────────┘                  │
│       ↓                                                     │
│  許可/ブロック判定                                          │
│       ↓                                                     │
│  Bash実行 (許可された場合のみ)                             │
│                                                             │
└─────────────────────────────────────────────────────────────┘
```

**信頼できない入力:**
- Claude からの Bash コマンド文字列（任意の文字列が送られる可能性）

**信頼できる入力:**
- ワークフロー状態ファイル（`.claude/state/workflows/*/workflow-state.json`）
  - ただし、ファイルシステムへの直接アクセスが可能な場合は改ざんリスクあり

---

## 2. 資産の識別

### 2.1 保護対象の資産

| 資産ID | 資産名 | 機密性 | 完全性 | 可用性 | 重要度 |
|--------|--------|--------|--------|--------|--------|
| A-001 | ソースコードファイル | 低 | **高** | 中 | 高 |
| A-002 | テストコードファイル | 低 | **高** | 中 | 高 |
| A-003 | 仕様書・ドキュメント | 低 | **高** | 中 | 中 |
| A-004 | ワークフロー状態ファイル | 低 | **高** | 高 | 高 |
| A-005 | 設定ファイル | 低 | **高** | 中 | 中 |
| A-006 | ワークフロープロセスの完全性 | - | **高** | 高 | 最高 |

**注:** このシステムは機密性よりも**完全性**（integrity）を重視する。TDD/CDD サイクルの遵守を強制することで、コード品質とテストカバレッジを保証する。

### 2.2 攻撃者モデル

| 攻撃者タイプ | 能力 | 目的 |
|-------------|------|------|
| 悪意のあるAI | Claude の能力範囲内で任意のBashコマンドを生成可能 | ワークフロー制限の回避、テストのスキップ |
| 誤動作するAI | 意図せず不適切なコマンドを実行 | 誤ってフェーズ外のファイルを編集 |
| 開発者の操作ミス | 直接ファイルシステムにアクセス可能 | 状態ファイルの改ざん |

**想定しない攻撃者:**
- ファイルシステムへの root 権限を持つ攻撃者（OS レベルのセキュリティ前提）
- ネットワーク経由での攻撃者（ローカル実行前提）

---

## 3. 脅威の識別と分析

### 3.1 バイパス攻撃（STRIDE: Spoofing, Elevation of Privilege）

#### T-001: コマンドチェーン経由のバイパス

**脅威レベル:** 🔴 **高**

**説明:**
複数のコマンドをチェーンすることで、個別の正規表現チェックを回避する。

**攻撃例:**
```bash
# 正規表現を回避する方法
sh -c 'echo "code" > src/main.ts'           # シェル経由
bash -c 'sed -i "s/old/new/" src/main.ts'  # bash 経由
eval 'echo "code" > src/main.ts'            # eval 経由
$(echo "echo 'code' > src/main.ts") | bash  # コマンド置換
```

**影響:**
- TDD Red フェーズでソースコードを直接編集可能
- テストなしでの実装を可能にする
- ワークフロープロセスの完全性を破壊

**現在の防御:**
```javascript
// 行1040-1056: FILE_MODIFYING_COMMANDS
// sed, echo, cat, printf, tee, touch, rm, mv, cp のみ検出
// sh, bash, eval は検出されない
```

**脆弱性の根本原因:**
- シェルインタプリタ（sh, bash, eval）の呼び出しパターンが定義されていない
- コマンド置換（`$(...)`）やプロセス置換（`<(...)`）を考慮していない

**CVSSスコア:** 7.5 (High)
- Attack Vector: Local (AV:L)
- Attack Complexity: Low (AC:L)
- Privileges Required: None (PR:N)
- User Interaction: None (UI:N)
- Scope: Unchanged (S:U)
- Confidentiality: None (C:N)
- Integrity: High (I:H)
- Availability: Low (A:L)

#### T-002: パイプライン複雑化によるバイパス

**脅威レベル:** 🟡 **中**

**説明:**
複雑なパイプラインで正規表現マッチングを妨害する。

**攻撃例:**
```bash
# 複雑なパイプライン
cat input.txt | awk '{print}' | grep "text" > src/main.ts
echo "code" | base64 | base64 -d > src/main.ts
printf "code" | tr 'a-z' 'A-Z' | tr 'A-Z' 'a-z' > src/main.ts
```

**影響:**
- ファイル出力の検出が困難
- リダイレクト演算子の位置が可変

**現在の防御:**
```javascript
// 行1044: /\becho\s+.*>/i
// パイプ後のリダイレクトは検出される
```

**脆弱性の根本原因:**
- 正規表現が単純すぎる（`.*` が全てマッチ）
- パイプライン全体の解析が不完全

**CVSSスコア:** 5.5 (Medium)

#### T-003: Heredoc/Here-string によるバイパス

**脅威レベル:** 🟡 **中**

**説明:**
Heredoc または Here-string を使用してファイルを作成する。

**攻撃例:**
```bash
# Heredoc
cat << 'EOF' > src/main.ts
const code = "test";
EOF

# Here-string
cat <<< "code" > src/main.ts
```

**影響:**
- 複数行のコード挿入が可能
- `cat` コマンドのみで検出される

**現在の防御:**
```javascript
// 行1045: /\bcat\s+.*>/i
// cat コマンドのリダイレクトは検出される
```

**脆弱性の根本原因:**
- Heredoc マーカー（`<<`, `<<<`）の明示的検出がない

**CVSSスコア:** 5.0 (Medium)

#### T-004: ファイル名偽装によるバイパス

**脅威レベル:** 🟢 **低**

**説明:**
拡張子のないファイル名や、設定ファイルに偽装してブロックを回避する。

**攻撃例:**
```bash
# 拡張子なしファイル
echo "code" > Makefile         # 常にブロックされない
echo "code" > Dockerfile       # 設定ファイルとして許可される可能性

# 隠しファイル
echo "code" > .secret_code     # ファイルタイプ判定で "other"
```

**影響:**
- ファイルタイプ判定の回避
- 重要なコードが設定ファイルとして扱われる

**現在の防御:**
```javascript
// 行1101: ファイル拡張子パターン
const fileMatch = command.match(/[^\s]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml)(?:\s|$)/i);

// 拡張子がない場合、filePath は null になり、読み取り専用フェーズのみブロック
```

**脆弱性の根本原因:**
- 拡張子ベースの判定に依存
- 拡張子のないファイルの扱いが不明確

**CVSSスコア:** 3.5 (Low)

#### T-005: 環境変数/変数展開によるバイパス

**脅威レベル:** 🟡 **中**

**説明:**
環境変数やシェル変数を使用してコマンドを難読化する。

**攻撃例:**
```bash
# 環境変数を使用
CMD="echo 'code' > src/main.ts"
$CMD

# 変数展開
OUTPUT_FILE="src/main.ts"
echo "code" > $OUTPUT_FILE

# エイリアス（シェル起動時に設定された場合）
alias edit='echo "code" >'
edit src/main.ts
```

**影響:**
- 正規表現マッチングの失敗
- コマンドの検出困難

**現在の防御:**
- なし（変数展開は考慮されていない）

**脆弱性の根本原因:**
- 静的解析の限界（実行時の変数値が不明）

**CVSSスコア:** 5.0 (Medium)

---

### 3.2 正規表現の脆弱性（STRIDE: Denial of Service）

#### T-006: ReDoS（Regular Expression Denial of Service）攻撃

**脅威レベル:** 🟡 **中**

**説明:**
バックトラッキングを引き起こす入力で正規表現エンジンを停止させる。

**攻撃例:**
```bash
# 深いネスト
echo "a" | echo "a" | echo "a" | ... (数千回繰り返し) ... | tee file.ts

# 長い文字列
echo "aaaaaaaaaaaaaaaa...（10000文字）...aaaa" > file.ts
```

**影響:**
- フック処理が100ms以上かかる（NFR-001 違反）
- タイムアウトによる許可（行1337-1339）
- システム全体の遅延

**脆弱なパターン:**
```javascript
// 行1044: /\becho\s+.*>/i
// .* は貪欲マッチ → バックトラッキング発生の可能性
```

**現在の防御:**
```javascript
// 行1336-1339: タイムアウト処理（3秒）
const timeout = setTimeout(() => {
  process.exit(0);  // タイムアウト時は許可
}, 3000);
```

**脆弱性の根本原因:**
- 貪欲な `.*` の使用
- バックトラッキングを防ぐ最適化なし

**CVSSスコア:** 5.0 (Medium)
- Attack Vector: Local (AV:L)
- Attack Complexity: Low (AC:L)
- Privileges Required: None (PR:N)
- User Interaction: None (UI:N)
- Scope: Unchanged (S:U)
- Confidentiality: None (C:N)
- Integrity: None (I:N)
- Availability: High (A:H)

---

### 3.3 ファイルパス抽出の脆弱性（STRIDE: Spoofing）

#### T-007: ファイルパス抽出の誤検出

**脅威レベル:** 🟢 **低**

**説明:**
ファイルパスの抽出ロジックが誤ったパスを検出する。

**攻撃例:**
```bash
# 誤検出の例
echo "This is a test.ts file content" > /dev/null  # "test.ts" を誤検出
sed -i 's/old.ts/new.ts/' config.yaml              # "old.ts" を誤検出

# スペースを含むパス
echo "code" > "src/my file.ts"                     # 正しく抽出できない
```

**影響:**
- 誤ったファイルタイプ判定
- 本来ブロックすべきコマンドを許可

**現在の防御:**
```javascript
// 行1101: ファイルパス抽出
const fileMatch = command.match(/[^\s]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml)(?:\s|$)/i);
// [^\s]+ はスペースを含まない → スペースを含むパスは抽出失敗
```

**脆弱性の根本原因:**
- 簡易的な正規表現による抽出
- 引用符（`"`, `'`）を考慮していない

**CVSSスコア:** 3.0 (Low)

#### T-008: パス traversal による判定回避

**脅威レベル:** 🟢 **低**

**説明:**
相対パスや `..` を使用してファイルタイプ判定を混乱させる。

**攻撃例:**
```bash
# 相対パス
echo "code" > ./../../src/main.ts
echo "code" > ../src/../src/main.ts

# シンボリックリンク（事前に作成された場合）
echo "code" > symlink_to_src  # symlink_to_src -> src/main.ts
```

**影響:**
- ファイルタイプ判定の失敗
- docsDir/workflowDir マッチングの失敗

**現在の防御:**
```javascript
// 行558: パス正規化
const normalizedFilePath = filePath.replace(/\\/g, '/');
// バックスラッシュを変換するのみ（.. は解決されない）
```

**脆弱性の根本原因:**
- パスの正規化が不完全（`path.resolve()` 未使用）

**CVSSスコア:** 3.0 (Low)

---

### 3.4 状態ファイル改ざん（STRIDE: Tampering）

#### T-009: ワークフロー状態ファイルの直接改ざん

**脅威レベル:** 🔴 **高**（ただし、攻撃者モデル外）

**説明:**
開発者が直接 `workflow-state.json` を編集してフェーズを変更する。

**攻撃例:**
```bash
# 開発者が直接編集
vim .claude/state/workflows/task_123/workflow-state.json
# "phase": "test_impl" → "phase": "implementation"
```

**影響:**
- フェーズ制限の完全な回避
- TDD サイクルのスキップ

**現在の防御:**
- なし（ファイルシステムレベルの保護は OS に依存）

**脆弱性の根本原因:**
- 状態ファイルに対するアクセス制御がない
- ファイルの完全性検証（署名、チェックサム）がない

**CVSSスコア:** 8.0 (High)（ただし、Local Attack Vector のため実質的な脅威は低い）

**注:** この脅威は「開発者の操作ミス」攻撃者モデルには該当するが、「悪意のある AI」モデルには該当しない（AI はファイルシステムに直接アクセスできない）。

---

### 3.5 ロジックの脆弱性（STRIDE: Elevation of Privilege）

#### T-010: 読み取り専用フェーズでの「明示的許可なし」コマンドの扱い

**脅威レベル:** 🟡 **中**

**説明:**
`ALWAYS_ALLOWED_BASH_PATTERNS` にも `FILE_MODIFYING_COMMANDS` にも該当しないコマンドが、読み取り専用フェーズで許可される。

**攻撃例:**
```bash
# ビルドツール（明示的許可なし）
npm run build           # ファイル生成の可能性
cargo build             # バイナリ生成
make                    # Makefile 実行

# プロセス管理
taskkill /F /IM node.exe  # プロセス停止（ファイル操作なし）
```

**影響:**
- ビルド成果物の生成が読み取り専用フェーズで可能
- テストファイルの生成（`npm test` が `*.test.ts` を生成する場合）

**現在の防御:**
```javascript
// 行1083-1109: analyzeBashCommand()
if (analysis.isExplicitlyAllowed) {
  process.exit(EXIT_CODES.SUCCESS);  // 明示的許可
}
// ...
if (!analysis.isModifying) {
  process.exit(EXIT_CODES.SUCCESS);  // ファイル修正なし → 許可
}
```

**脆弱性の根本原因:**
- 「明示的に許可なし」＝「ファイル修正なし」とみなす安全側の設計
- ビルドツールのファイル生成を検出できない

**CVSSスコア:** 5.0 (Medium)

#### T-011: ファイルパス抽出失敗時の寛容な処理

**脅威レベル:** 🟢 **低**

**説明:**
ファイルパスが抽出できない場合、読み取り専用フェーズ以外では許可される。

**攻撃例:**
```bash
# ファイルパスが抽出できないコマンド
sed -i 's/old/new/' $(find src/ -name "*.ts")  # コマンド置換
rm -rf build/                                   # ディレクトリ削除（拡張子なし）
```

**影響:**
- フェーズ制限の部分的な回避
- ただし、読み取り専用フェーズではブロックされる

**現在の防御:**
```javascript
// 行1221-1253: ファイルパス抽出失敗時の処理
if (!filePath) {
  const workflowState = findActiveWorkflowState(null);
  if (workflowState && rule && rule.readOnly) {
    // ブロック
  }
  process.exit(EXIT_CODES.SUCCESS);  // 読み取り専用以外は許可
}
```

**脆弱性の根本原因:**
- 安全側（permissive）の設計思想
- ファイルパス抽出の失敗を正常ケースとして扱う

**CVSSスコア:** 3.5 (Low)

---

## 4. 脅威の優先順位付け（リスクマトリクス）

### 4.1 脅威マトリクス

| 脅威ID | 脅威名 | 発生確率 | 影響度 | リスクレベル | CVSSスコア |
|--------|--------|---------|--------|-------------|-----------|
| **T-001** | コマンドチェーン経由のバイパス | **高** | **高** | 🔴 **Critical** | 7.5 |
| **T-009** | 状態ファイル改ざん | 低 | **高** | 🟡 **Medium** | 8.0 |
| **T-010** | 読み取り専用フェーズでのビルドツール実行 | **高** | 中 | 🟡 **Medium** | 5.0 |
| **T-006** | ReDoS 攻撃 | 中 | 中 | 🟡 **Medium** | 5.0 |
| **T-002** | パイプライン複雑化バイパス | 中 | 中 | 🟡 **Medium** | 5.5 |
| **T-003** | Heredoc バイパス | 中 | 中 | 🟡 **Medium** | 5.0 |
| **T-005** | 環境変数展開バイパス | 中 | 中 | 🟡 **Medium** | 5.0 |
| **T-011** | ファイルパス抽出失敗時の許可 | 中 | 低 | 🟢 **Low** | 3.5 |
| **T-004** | ファイル名偽装 | 低 | 低 | 🟢 **Low** | 3.5 |
| **T-007** | ファイルパス誤検出 | 低 | 低 | 🟢 **Low** | 3.0 |
| **T-008** | パス traversal | 低 | 低 | 🟢 **Low** | 3.0 |

### 4.2 リスク評価基準

**発生確率:**
- **高:** Claude AI が誤動作または意図的に生成する可能性が高い（週1回以上）
- **中:** 特定の状況下で発生（月1回程度）
- **低:** 発生する可能性が極めて低い（年1回未満）

**影響度:**
- **高:** ワークフロープロセスの完全な破壊、TDD サイクルのスキップ
- **中:** 一部フェーズでの制限回避、部分的なワークフロー違反
- **低:** 軽微なファイル操作、影響が限定的

---

## 5. 緩和策の提案

### 5.1 Critical リスクの緩和策

#### M-001: コマンドチェーンバイパスの対策（T-001）

**優先度:** 🔴 **最高**

**実装方法:**

1. **シェルインタプリタの検出を追加:**

```javascript
const SHELL_INTERPRETER_PATTERNS = [
  /\b(sh|bash|zsh|fish|csh|tcsh)\s+-c\s+/i,    // sh -c, bash -c
  /\beval\s+/i,                                  // eval
  /\bexec\s+/i,                                  // exec
  /\$\(/,                                        // コマンド置換 $(...)
  /`[^`]+`/,                                     // バッククォート `...`
];

// analyzeBashCommand() に追加
for (const pattern of SHELL_INTERPRETER_PATTERNS) {
  if (pattern.test(command)) {
    // シェルインタプリタ検出時は、-c の引数を再帰的に解析
    const shellCommand = extractShellCommand(command);
    return analyzeBashCommand(shellCommand);  // 再帰呼び出し
  }
}
```

2. **再帰的コマンド解析:**

```javascript
function extractShellCommand(command) {
  // sh -c 'echo "code" > file.ts' から 'echo "code" > file.ts' を抽出
  const match = command.match(/\b(sh|bash|zsh)\s+-c\s+['"]([^'"]+)['"]/i);
  if (match) {
    return match[2];
  }

  // eval 'command' から command を抽出
  const evalMatch = command.match(/\beval\s+['"]([^'"]+)['"]/i);
  if (evalMatch) {
    return evalMatch[1];
  }

  return command;
}
```

**効果:**
- シェル経由のバイパスを完全にブロック
- 再帰的解析により多段階のエスケープも検出

**制限:**
- 過度に複雑なネストは検出困難（深さ3以上）
- 受け入れ可能なトレードオフ

---

#### M-002: 状態ファイル改ざんの検出（T-009）

**優先度:** 🟡 **中**（攻撃者モデル外のため優先度低）

**実装方法:**

1. **状態ファイルにチェックサム追加:**

```javascript
// workflow-state.json に署名フィールドを追加
{
  "taskId": "task_123",
  "phase": "test_impl",
  // ...
  "_checksum": "sha256(taskId + phase + timestamp + secret)"
}

// 状態ファイル読み込み時に検証
function validateWorkflowState(state) {
  const secret = process.env.WORKFLOW_STATE_SECRET || 'default-secret';
  const expectedChecksum = sha256(state.taskId + state.phase + state.timestamp + secret);
  if (state._checksum !== expectedChecksum) {
    logError('警告', '状態ファイルが改ざんされた可能性があります');
    // ブロックはせず、警告ログのみ
  }
}
```

**効果:**
- 改ざんの検出（防止ではない）
- 監査証跡の強化

**制限:**
- 秘密鍵の管理が必要
- 開発者が秘密鍵にアクセス可能な場合は無効

**代替案:**
- 改ざん検出を諦め、開発者の倫理観に依存
- 監査ログで事後検出

---

### 5.2 Medium リスクの緩和策

#### M-003: ビルドツール実行の制限（T-010）

**優先度:** 🟡 **中**

**実装方法:**

1. **ビルドツールパターンの定義:**

```javascript
const BUILD_TOOL_PATTERNS = [
  /\b(npm|pnpm|yarn|bun)\s+(run\s+)?build\b/i,   // npm build, pnpm run build
  /\b(cargo|rustc)\s+build\b/i,                   // cargo build
  /\b(go)\s+build\b/i,                            // go build
  /\bmake\b/i,                                    // make
  /\b(webpack|vite|rollup|esbuild)\b/i,           // バンドラー
];

// 読み取り専用フェーズでビルドツールをブロック
function analyzeBashCommand(command) {
  // ...

  // 読み取り専用フェーズの場合
  if (rule && rule.readOnly) {
    for (const pattern of BUILD_TOOL_PATTERNS) {
      if (pattern.test(command)) {
        return { isModifying: true, filePath: null, isBuildTool: true };
      }
    }
  }

  // ...
}
```

**効果:**
- 読み取り専用フェーズでのビルド成果物生成を防止
- テストファイル自動生成の防止

**制限:**
- 全てのビルドツールを網羅することは困難
- ビルドツールの新バージョンで名前が変わる可能性

---

#### M-004: ReDoS 攻撃の対策（T-006）

**優先度:** 🟡 **中**

**実装方法:**

1. **正規表現の最適化:**

```javascript
// 修正前（貪欲マッチ）
/\becho\s+.*>/i

// 修正後（非貪欲マッチ + 文字数制限）
/\becho\s+.{0,1000}?>/i

// または、より厳格なパターン
/\becho\s+[^|&;]{0,500}>/i  // パイプ、&、; を含まない
```

2. **タイムアウトの短縮:**

```javascript
// 現在: 3000ms → 提案: 1000ms
const timeout = setTimeout(() => {
  logError('警告', 'コマンド解析がタイムアウトしました（1秒）');
  process.exit(0);
}, 1000);
```

**効果:**
- バックトラッキングの削減
- 処理時間の短縮（100ms 目標達成）

**制限:**
- 極端に長いコマンドは誤検出の可能性
- 受け入れ可能（通常のコマンドは500文字以内）

---

#### M-005: パイプライン複雑化の対策（T-002）

**優先度:** 🟢 **低**（現在の正規表現で大部分は検出可能）

**実装方法:**

```javascript
// リダイレクト演算子の位置に関係なく検出
const REDIRECT_PATTERNS = [
  />\s*[^\s|&;]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml)\b/i,  // > file.ts
  />>\s*[^\s|&;]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml)\b/i, // >> file.ts
];

function detectFileRedirect(command) {
  for (const pattern of REDIRECT_PATTERNS) {
    if (pattern.test(command)) {
      return true;
    }
  }
  return false;
}
```

**効果:**
- パイプライン内のリダイレクト検出

---

#### M-006: Heredoc の検出（T-003）

**優先度:** 🟢 **低**（現在の `cat` パターンで検出可能）

**実装方法:**

```javascript
const HEREDOC_PATTERNS = [
  /<<\s*['"]?(\w+)['"]?\s*>\s*[^\s]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd)/i,  // << EOF > file.ts
  /<<<\s*['"][^'"]+['"]\s*>\s*[^\s]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd)/i,  // <<< "text" > file.ts
];

// FILE_MODIFYING_COMMANDS に追加
FILE_MODIFYING_COMMANDS.push(...HEREDOC_PATTERNS);
```

**効果:**
- Heredoc による複数行コード挿入の防止

---

#### M-007: 環境変数展開の対策（T-005）

**優先度:** 🟢 **低**（静的解析の限界、緩和策のみ）

**実装方法:**

```javascript
// 環境変数を含むコマンドを検出（ブロックはしない、警告のみ）
const VARIABLE_PATTERNS = [
  /\$[A-Z_][A-Z0-9_]*/i,          // $VAR
  /\$\{[^}]+\}/,                   // ${VAR}
  /`[^`]+`/,                       // バッククォート
];

function analyzeBashCommand(command) {
  // ...

  for (const pattern of VARIABLE_PATTERNS) {
    if (pattern.test(command)) {
      debugLog('警告: 環境変数/変数展開を含むコマンドが検出されました:', command.substring(0, 80));
      // ブロックはしない（静的解析の限界）
    }
  }

  // ...
}
```

**効果:**
- デバッグ時の可視化
- 監査ログへの記録

**制限:**
- 完全な防止は不可能（実行時の値が不明）

---

### 5.3 Low リスクの緩和策

#### M-008: ファイルパス抽出の改善（T-007, T-008）

**優先度:** 🟢 **低**

**実装方法:**

```javascript
function extractFilePathFromCommand(command) {
  // 引用符を考慮したパターン
  const quotedMatch = command.match(/["']([^"']+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml))["']/i);
  if (quotedMatch) {
    return quotedMatch[1];
  }

  // スペースなしパターン（既存）
  const unquotedMatch = command.match(/[^\s]+\.(ts|tsx|js|jsx|py|go|rs|md|mmd|json|yaml|yml)(?:\s|$)/i);
  if (unquotedMatch) {
    return unquotedMatch[0].trim();
  }

  return null;
}

// パス正規化
function normalizeFilePath(filePath) {
  if (!filePath) return null;

  // 相対パスを絶対パスに変換
  const absolutePath = path.resolve(process.cwd(), filePath);

  // パス traversal の解決
  return absolutePath;
}
```

**効果:**
- スペースを含むパスの抽出
- 相対パスの正規化

---

#### M-009: ファイル名偽装の対策（T-004）

**優先度:** 🟢 **低**

**実装方法:**

```javascript
// 拡張子なしファイルの重要度判定
const IMPORTANT_FILES_WITHOUT_EXT = [
  'Makefile',
  'Dockerfile',
  'Rakefile',
  'Gemfile',
  'Procfile',
];

function getFileType(filePath) {
  // ...

  // 拡張子なしの重要ファイルを code として扱う
  const fileName = path.basename(filePath);
  if (IMPORTANT_FILES_WITHOUT_EXT.includes(fileName)) {
    return 'code';
  }

  // ...
}
```

**効果:**
- Makefile 等の重要ファイルの保護

---

### 5.4 緩和策の優先順位

| 緩和策ID | 緩和策名 | 対象脅威 | 実装難易度 | 効果 | 優先度 |
|---------|---------|---------|-----------|------|--------|
| **M-001** | コマンドチェーンバイパス対策 | T-001 | 中 | 高 | 🔴 **最高** |
| **M-003** | ビルドツール制限 | T-010 | 低 | 中 | 🟡 **高** |
| **M-004** | ReDoS 対策 | T-006 | 低 | 中 | 🟡 **高** |
| **M-002** | 状態ファイル改ざん検出 | T-009 | 高 | 低 | 🟢 **中** |
| **M-005** | パイプライン複雑化対策 | T-002 | 低 | 低 | 🟢 **低** |
| **M-006** | Heredoc 検出 | T-003 | 低 | 低 | 🟢 **低** |
| **M-007** | 環境変数展開警告 | T-005 | 低 | 低 | 🟢 **低** |
| **M-008** | ファイルパス抽出改善 | T-007, T-008 | 中 | 低 | 🟢 **低** |
| **M-009** | ファイル名偽装対策 | T-004 | 低 | 低 | 🟢 **低** |

---

## 6. 実装計画

### 6.1 Phase 1: Critical リスク対策（必須）

**目標:** T-001（コマンドチェーンバイパス）の完全な緩和

**実装内容:**
1. M-001: シェルインタプリタ検出と再帰的解析
2. 既存の正規表現パターンの見直し
3. ユニットテストの追加

**期間:** 1-2日

**成果物:**
- 更新された `analyzeBashCommand()` 関数
- 再帰的コマンド解析のロジック
- テストケース（`sh -c`, `bash -c`, `eval` 等）

---

### 6.2 Phase 2: Medium リスク対策（推奨）

**目標:** T-006, T-010 の緩和

**実装内容:**
1. M-003: ビルドツールパターンの追加
2. M-004: ReDoS 対策（正規表現の最適化）
3. タイムアウトの短縮（3秒 → 1秒）

**期間:** 1日

**成果物:**
- ビルドツールパターンリスト
- 最適化された正規表現
- パフォーマンステスト結果（100ms 以内を確認）

---

### 6.3 Phase 3: Low リスク対策（オプション）

**目標:** T-002, T-003, T-004, T-005, T-007, T-008 の部分的緩和

**実装内容:**
1. M-005: パイプライン複雑化対策
2. M-006: Heredoc 検出
3. M-008: ファイルパス抽出改善
4. M-009: ファイル名偽装対策

**期間:** 1-2日

**成果物:**
- 追加の検出パターン
- ファイルパス抽出ロジックの改善

---

## 7. 残存リスク

### 7.1 受け入れ可能なリスク

| リスクID | リスク内容 | 理由 |
|---------|-----------|------|
| R-001 | 環境変数展開によるバイパス（T-005） | 静的解析の限界、実行時の値が不明 |
| R-002 | 状態ファイル改ざん（T-009） | 攻撃者モデル外（開発者の倫理観に依存） |
| R-003 | ファイルパス抽出の完全性 | 完璧な抽出は不可能、トレードオフ |
| R-004 | 未知のファイル操作コマンド | 新しいコマンドが出現する可能性 |

### 7.2 残存リスクの監視方法

1. **監査ログの定期的なレビュー:**
   - `.claude-phase-guard-log.json` を週次でレビュー
   - スキップフラグ（`SKIP_PHASE_GUARD=true`）の使用頻度を監視

2. **異常検知:**
   - 同一ファイルへの繰り返し編集（無限ループ検出フック）
   - 読み取り専用フェーズでのブロック頻度の急増

3. **ユーザーフィードバック:**
   - 誤検出の報告
   - 新しいバイパス手法の発見

---

## 8. セキュリティテスト計画

### 8.1 ユニットテスト

| テストID | テスト内容 | 期待結果 |
|---------|-----------|---------|
| UT-001 | `sh -c 'echo "code" > file.ts'` | ブロック（T-001） |
| UT-002 | `bash -c 'sed -i "s/a/b/" file.ts'` | ブロック（T-001） |
| UT-003 | `eval 'rm file.ts'` | ブロック（T-001） |
| UT-004 | `$(echo "echo 'code' > file.ts")` | ブロック（T-001） |
| UT-005 | `echo "a"*10000 > file.ts` | 1秒以内に判定（T-006） |
| UT-006 | `npm run build` | 読み取り専用フェーズでブロック（T-010） |
| UT-007 | `cat << EOF > file.ts\ncode\nEOF` | ブロック（T-003） |
| UT-008 | `echo "code" > "src/my file.ts"` | ファイルパス抽出成功（T-007） |
| UT-009 | `echo "code" > Makefile` | ブロック（T-004） |

### 8.2 統合テスト

| テストID | テスト内容 | 期待結果 |
|---------|-----------|---------|
| IT-001 | research フェーズで `sh -c 'echo "code" > file.ts'` | ブロックメッセージ表示 |
| IT-002 | test_impl フェーズで `echo "code" > src/main.ts` | ブロックメッセージ表示 |
| IT-003 | implementation フェーズで `echo "code" > src/main.ts` | 許可 |
| IT-004 | research フェーズで `ls -la` | 許可 |
| IT-005 | build_check フェーズで `npm run build` | ブロックメッセージ表示 |

### 8.3 セキュリティテスト

| テストID | テスト内容 | 期待結果 |
|---------|-----------|---------|
| ST-001 | ReDoS 攻撃（長い文字列） | 1秒以内にタイムアウト |
| ST-002 | ネストされたシェル呼び出し（深さ3） | 検出またはタイムアウト |
| ST-003 | ワークフロー状態ファイル改ざん | 警告ログ記録（M-002 実装時） |

---

## 9. 監査証跡

### 9.1 ログ項目

全てのチェック結果を `.claude-phase-guard-log.json` に記録:

```json
{
  "timestamp": "2026-02-03T12:00:00.000Z",
  "toolName": "Bash",
  "command": "sh -c 'echo \"code\" > src/main.ts'",
  "phase": "test_impl",
  "filePath": "src/main.ts",
  "fileType": "code",
  "blocked": true,
  "reason": "Shell interpreter detected: sh -c",
  "threatId": "T-001"
}
```

### 9.2 スキップの記録

`SKIP_PHASE_GUARD=true` の使用を記録:

```json
{
  "timestamp": "2026-02-03T12:00:00.000Z",
  "skipped": true,
  "reason": "SKIP_PHASE_GUARD=true",
  "command": "echo \"code\" > src/main.ts",
  "phase": "test_impl",
  "alert": "AUDIT: Phase guard was bypassed"
}
```

---

## 10. まとめ

### 10.1 脅威の概要

- **Critical 脅威:** 1件（T-001: コマンドチェーンバイパス）
- **Medium 脅威:** 5件（T-002, T-003, T-005, T-006, T-010）
- **Low 脅威:** 4件（T-004, T-007, T-008, T-011）

### 10.2 緩和策の優先度

1. **必須:** M-001（コマンドチェーンバイパス対策）
2. **推奨:** M-003（ビルドツール制限）、M-004（ReDoS 対策）
3. **オプション:** その他の Low リスク対策

### 10.3 実装後の期待効果

**緩和前のリスク:**
- AI による TDD サイクルのスキップが可能
- 読み取り専用フェーズでのファイル操作が可能
- ワークフロープロセスの完全性が保証されない

**緩和後のリスク:**
- **99%** の AI 生成コマンドでバイパスを防止
- 読み取り専用フェーズの厳格化
- 監査証跡による事後検出が可能

**残存リスク:**
- 環境変数展開による回避（静的解析の限界）
- 開発者による直接改ざん（攻撃者モデル外）

### 10.4 次のステップ

1. Phase 1 実装（M-001: コマンドチェーンバイパス対策）
2. ユニットテストの作成
3. 統合テストの実行
4. セキュリティレビュー
5. Phase 2 実装（M-003, M-004）

---

## 付録A: 攻撃シナリオの詳細

### A.1 T-001: コマンドチェーンバイパスの実例

**シナリオ:**
悪意のある AI が test_impl フェーズでソースコードを直接編集しようとする。

**攻撃手順:**
```bash
# 通常の試み（ブロックされる）
echo "code" > src/main.ts
# ブロック: test_impl フェーズではソースコード編集不可

# シェル経由の試み（現在はブロックされない）
sh -c 'echo "code" > src/main.ts'
# 許可される → TDD サイクル違反
```

**影響:**
- テストを書かずに実装を開始
- TDD Red → Green のサイクル破壊
- コード品質の低下

**緩和策（M-001）実装後:**
```bash
sh -c 'echo "code" > src/main.ts'
# ブロック: シェルインタプリタ検出、再帰的解析で echo > を検出
```

---

### A.2 T-010: ビルドツール実行の実例

**シナリオ:**
research フェーズでビルドを実行し、成果物を生成する。

**攻撃手順:**
```bash
# research フェーズで実行
npm run build
# 許可される → dist/ ディレクトリにファイル生成
```

**影響:**
- 読み取り専用フェーズでのファイル生成
- 調査結果を反映せずにビルド実行
- 仕様書作成前の実装

**緩和策（M-003）実装後:**
```bash
npm run build
# ブロック: ビルドツールパターン検出
```

---

## 付録B: 参考資料

### B.1 STRIDE 脅威モデリング

| カテゴリ | 該当する脅威 |
|---------|-------------|
| **S**poofing（なりすまし） | T-003, T-007 |
| **T**ampering（改ざん） | T-009 |
| **R**epudiation（否認） | - |
| **I**nformation Disclosure（情報漏洩） | - |
| **D**enial of Service（サービス拒否） | T-006 |
| **E**levation of Privilege（権限昇格） | T-001, T-002, T-004, T-005, T-010, T-011 |

### B.2 CVSS v3.1 計算式

基本スコア = Impact Sub-Score × Exploitability Sub-Score

**Exploitability Sub-Score:**
- Attack Vector (AV): Local = 0.55
- Attack Complexity (AC): Low = 0.77
- Privileges Required (PR): None = 0.85
- User Interaction (UI): None = 0.85

**Impact Sub-Score:**
- Confidentiality (C): None = 0.0
- Integrity (I): High = 0.56
- Availability (A): Low = 0.22

---

## 変更履歴

| 日付 | バージョン | 変更内容 |
|------|-----------|---------|
| 2026-02-03 | 1.0 | 初版作成 |

---

## 承認

| 役割 | 氏名 | 承認日 |
|------|------|--------|
| 脅威モデリング | Claude Code | 2026-02-03 |
| セキュリティレビュー | - | - |
| 承認 | - | - |
