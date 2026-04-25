# コードレビュー結果

## 設計-実装整合性

**ステータス: OK（部分的には高リスク）**

### 実装分析

#### 実装されている機能
1. ✅ **artifact-validator.ts**: 成果物の品質検証（REQ-3）
   - 最小行数チェック（空白行除外）
   - 必須セクション検証
   - 禁止パターン検出（TODO, TBD, FIXME, WIP）
   - ダミーテキスト検出
   - Mermaid図の特殊チェック

2. ✅ **test-authenticity.ts**: テスト真正性検証（REQ-4）
   - 出力最小文字数チェック（200文字）
   - テストフレームワークパターンマッチング
   - テスト数の抽出と0件チェック
   - タイムスタンプ整合性

3. ✅ **scope-validator.ts**: スコープ検証（REQ-5）
   - ディレクトリ深度計算（src/配下のみ）
   - 最小深度チェック（深度3以上）
   - ファイル存在確認

4. ✅ **bash-whitelist.js**: Bashコマンドホワイトリスト（REQ-2）
   - フェーズ別ホワイトリスト定義
   - ブラックリストチェック
   - node -e 特別チェック
   - 複合コマンド分割処理

#### 設計仕様との対応
- 仕様書の各REQセクション（REQ-2～REQ-5）に対応するコードが実装されている
- ファイル配置が正しい（mcp-server/src/validation/）
- 関連するコメント（@spec）で仕様への参照が明記されている

---

## セキュリティ

### 高リスク（Critical）

#### 1. **bash-whitelist.js の正規表現バイパス可能性**

**問題箇所** (lines 155-169):
```javascript
function matchesBlacklistEntry(command, entry) {
  if (entry.type === 'prefix') {
    const parts = command.split(/\s*(?:&&|\|\||;)\s*/).filter(p => p.trim().length > 0);
    for (const part of parts) {
      const trimmedPart = part.trim();
      if (trimmedPart.startsWith(entry.pattern)) {
        return true;
      }
    }
    return false;
  }
  return command.includes(entry.pattern);
}
```

**リスク内容**:
- `|` や `&` の単独使用によるバイパス可能
  - `python3` が `prefix` パターン → `python3 -c` で検出されるが
  - `python3|cat` で分割されず、`includes` でチェック（line 168）
  - ただしパイプも `BASH_BLACKLIST` に含まれていない
- パイプライン（`|`）がホワイトリスト/ブラックリストの両方で考慮されていない
  - 例: `node script.js | python3 -c 'malicious'` のパイプ後の実行回避

**具体的なバイパス例**:
```bash
# これはブロックされない（パイプ内のpython3の検出漏れ）
cat file | python3 -c "print('bypass')"
```

**改善案**:
- `|` をブラックリスト自体に追加（完全禁止）
- または複合コマンド処理で `|` で分割し、各パートのホワイトリストチェックを強化

---

#### 2. **bash-whitelist.js の `cd` コマンド無制限許可**

**問題箇所** (lines 212-214):
```javascript
if (partTrimmed.startsWith('cd ') || partTrimmed === 'cd') {
  continue; // 全フェーズで許可
}
```

**リスク内容**:
- `cd` は悪意あるディレクトリに移動可能
- 後続コマンドの相対パス解釈が変わる
  - 例: `cd /etc && rm -rf *` のような組合せで危険

**実例**:
```bash
# 複合コマンドとして実行
cd /var/www && rm -rf ../other_app; git commit -m "cleanup"
```

- `cd /var/www` で許可
- `rm -rf ../other_app` は `remove` がホワイトリストにないため検出されるはずだが、設計の想定が弱い

---

#### 3. **bash-whitelist.js の Node.js スクリプト実行チェックの不完全性**

**問題箇所** (lines 189-200):
```javascript
if (trimmed.startsWith('node -e') || trimmed.includes('node -e')) {
  const scriptPart = trimmed.substring(trimmed.indexOf('-e') + 2).trim();
  for (const pattern of NODE_E_BLACKLIST) {
    if (scriptPart.includes(pattern)) {
      return {
        allowed: false,
        reason: `node -e でのファイル書き込みは禁止されています: ${pattern}`,
      };
    }
  }
}
```

**リスク内容**:
- `eval()`, `Function()` による動的コード実行が検出されない
- 難読化されたファイル操作（複数の `require()` モジュール読み込み後の実行）が漏れやすい
- `--eval` フラグのみで `--input-type=module -e import(...)` のような形式が漏れる可能性

**改善案**:
```javascript
// より厳格なブラックリスト追加
const NODE_E_BLACKLIST = [
  'fs.writeFileSync', 'fs.writeSync', 'fs.appendFileSync',
  'fs.createWriteStream', 'fs.open', 'fs.openSync',
  '.write(', '.writeFile', '.appendFile',
  'eval(', 'Function(', 'require(', 'exec(', 'spawn(',
  'child_process', 'subprocess',
];
```

---

### 中リスク（Medium）

#### 4. **artifact-validator.ts の禁止パターン検出の単純文字列マッチング**

**問題箇所** (lines 121-130):
```javascript
const forbiddenPatterns = ['TODO', 'TBD', 'WIP', 'FIXME'];
const foundForbidden = forbiddenPatterns.filter(pattern =>
  content.includes(pattern)
);
```

**リスク内容**:
- 大文字・小文字の区別なしで検出されない（例: `todo`, `Todo`）
- コード例の中に `TODO` が含まれていても検出される（spec.mdで意図的に記述することがある）

**改善案**:
```javascript
const forbiddenPatterns = ['TODO', 'TBD', 'WIP', 'FIXME'];
const foundForbidden = forbiddenPatterns.filter(pattern => {
  // マークダウンのコードブロック外でのみチェック
  const cleanedContent = content.replace(/```[\s\S]*?```/g, '');
  return new RegExp(`\\b${pattern}\\b`, 'i').test(cleanedContent);
});
```

---

#### 5. **test-authenticity.ts のフレームワーク検出の限定性**

**問題箇所** (lines 40-45):
```javascript
const TEST_OUTPUT_INDICATORS = [
  /test\s+(execution|suite|files?|results?|summary|report)/i,
  /running\s+tests?/i,
  /test\s+(started|finished|completed)/i,
  /(vitest|jest|mocha|jasmine|ava|tape)/i,
];
```

**リスク内容**:
- `npm test` の出力が常にテストフレームワークを示すわけではない
- ファイアウォール・ダミーテキストで容易に偽装可能
- 例: 単にテキストファイルの内容をそのままコピーしたもの

**具体的なバイパス例**:
```bash
# 偽装テスト出力
echo "Tests: 5 passed, 5 total\nTest Suites: 1 passed, 1 total" > output.txt
```

---

### 低リスク（Low）

#### 6. **scope-validator.ts のWindowsパス処理**

**問題箇所** (lines 33-34):
```javascript
const normalized = dir.replace(/\\/g, '/').replace(/^\.\//, '');
```

**問題内容**:
- WindowsのUNCパス（`\\server\share`）に対応していない
- 通常は問題ないが、ネットワークドライブアクセスで予期しない動作の可能性

---

## コード品質

### 設計品質

#### 良好な点
1. ✅ **関心の分離**: 各検証機能が独立したモジュール化
2. ✅ **定数管理**: ホワイトリスト・ブラックリストが定数として明示
3. ✅ **エラーメッセージの明確性**: ユーザーに対する詳細な理由提示

#### 改善が必要な点

#### 7. **bash-whitelist.js の複雑度とテストカバレッジ不足**

**問題点**:
- 複雑な複合コマンド分割ロジック（lines 158, 206）が重複している
- 同じ分割ロジックが2箇所に存在
  ```javascript
  // Line 158
  const parts = command.split(/\s*(?:&&|\|\||;)\s*/).filter(...);
  // Line 206
  const commandParts = trimmed.split(/\s*(?:&&|\|\||;)\s*/).filter(...);
  ```

**改善案**: DRY原則に従い関数化
```javascript
function splitComplexCommand(command) {
  return command.split(/\s*(?:&&|\|\||;)\s*/).filter(p => p.trim().length > 0);
}
```

---

#### 8. **artifact-validator.ts のダミーテキスト検出の誤検知**

**問題点** (lines 133-146):
```javascript
const duplicates = Array.from(lineCountMap.entries())
  .filter(([_, count]) => count >= 3);
```

**リスク**:
- リスト形式のドキュメント（同じ行の3回以上繰り返し）が誤検知
  - 例: 要件リスト「- 要件A\n- 要件A\n- 要件A」

**改善案**: コンテキストに基づいた判定
```javascript
// リスト形式は許容（`-` で始まる行）
const nonListDuplicates = duplicates.filter(([line, _]) =>
  !line.trim().startsWith('-')
);
```

---

#### 9. **test-authenticity.ts のタイムスタンプ検証の不適切性**

**問題点** (lines 115-123):
```javascript
const phaseStart = new Date(phaseStartedAt);
const now = new Date();

if (now < phaseStart) {
  return {
    valid: false,
    reason: `テスト結果のタイムスタンプがフェーズ開始時刻より前です...`,
  };
}
```

**リスク**:
- クライアント側のシステム時刻がずれている場合、正常なテスト結果が却下される
- タイムゾーン処理が考慮されていない（ISO 8601の暗黙のUTC前提）

**改善案**: より寛容な時刻チェック
```javascript
const CLOCK_SKEW_TOLERANCE = 60000; // 1分の誤差を許容
if (now.getTime() < phaseStart.getTime() - CLOCK_SKEW_TOLERANCE) {
  // エラー
}
```

---

#### 10. **エラーハンドリング不完全**

**artifact-validator.ts**:
- `fs.statSync()` が例外を投げた場合の処理がない（line 94）
- 権限不足でファイルが読めない場合、エラーが伝播しない

**改善案**:
```javascript
try {
  const stats = fs.statSync(filePath);
  if (stats.size === 0) { ... }
} catch (err) {
  errors.push(`${fileName} の統計情報取得に失敗しました: ${err.message}`);
  return { passed: false, errors };
}
```

---

## 結論

### 総合評価: **部分的に実装完了（高リスク要素あり）**

#### 実装状況
| REQ | ステータス | 完成度 |
|-----|-----------|--------|
| REQ-2（Bashホワイトリスト） | 実装 | 70% - セキュリティ漏れあり |
| REQ-3（成果物検証） | 実装 | 85% - 誤検知の可能性 |
| REQ-4（テスト検証） | 実装 | 75% - 偽装対策不足 |
| REQ-5（スコープ検証） | 実装 | 90% - Windows対応未完 |

#### 優先度別改修項目

**Level 1 (Critical - すぐに対応)**
1. bash-whitelist.js でパイプ（`|`）をブラックリスト追加
2. `node -e` のブラックリスト強化（`eval`, `Function`, `child_process`追加）
3. artifact-validator.ts のエラーハンドリング改善

**Level 2 (High - 早期に対応)**
4. bash-whitelist.js の複雑度削減（関数化）
5. test-authenticity.ts のシステム時刻チェック寛容化
6. artifact-validator.ts の禁止パターン検出の改善（コードブロック除外）

**Level 3 (Medium - 次フェーズで対応)**
7. ダミーテキスト検出の誤検知回避（リスト形式対応）
8. Windows UNCパス対応
9. 統合テストの充実（複雑なコマンド組合せテスト）

---

## 次フェーズでの実装要件

### テスト設計での確認項目
- Bashコマンド複合テスト（複数の演算子、パイプの組合せ）
- 成果物検証のエッジケース（ドキュメント形式の多様性）
- テスト偽装シナリオ（ダミーフレームワーク出力）

### セキュリティレビューポイント
- パイプとリダイレクトの完全禁止化
- Node.js実行の詳細なAST解析（簡易検証では不十分）
- ファイルシステムアクセスの制限メカニズム追加

### ドキュメント更新
- `docs/security/threat-models/` に本レビューの指摘事項を脅威として記録
- `docs/architecture/` に検証機構のアーキテクチャドキュメント化
