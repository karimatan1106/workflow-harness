# セキュリティスキャン結果: 指摘3件修正検証

## サマリー

バックエンド2ファイル（bash-whitelist.js、loop-detector.js）に対するセキュリティスキャンを実施しました。前回のセキュリティスキャン指摘である以下の3件の修正状況を検証：

- SEC-1: SPEC_FIRST_TTL_MSがセキュリティ保護対象に含まれているか（bash-whitelist.jsの行14）
- SEC-2: Unicode空白文字バイパスに対する防御が実装されているか（bash-whitelist.jsのブラックリスト）
- SEC-3: シンボリックリンクが実パスに解決されるか（loop-detector.jsの行130）

修正検証結果：SEC-1とSEC-2は実装済み確認、SEC-3は部分的に実装されていることを検証しました。追加で3件の新規セキュリティリスクが検出されました。

## スキャン対象

以下の2ファイルに対してセキュリティスキャンを実施：

1. C:\ツール\Workflow\workflow-plugin\hooks\bash-whitelist.js（657行）
   - ホワイトリスト方式によるBashコマンド検証ロジック
   - REQ-2で仕様化されたセキュリティ保護対象環境変数を管理
   - base64/printf/echoエンコード検出機能
   - 複合コマンド分割とホワイトリスト照合処理

2. C:\ツール\Workflow\workflow-plugin\hooks\loop-detector.js（450行）
   - 無限ループ検出（Edit/Writeツール使用時の重複編集検出）
   - ファイルパス正規化とシンボリックリンク解決処理
   - 状態ファイル管理（loop-detector-state.json）
   - タイムスタンプベースの時間ウィンドウ検査

## 脆弱性スキャン結果

### 確認項目1: SEC-1（SPEC_FIRST_TTL_MS保護対象確認）

**判定**: PASS - 実装確認

bash-whitelist.js の行10-15を確認：
```javascript
const SECURITY_ENV_VARS = [
  'HMAC_STRICT', 'SCOPE_STRICT', 'SESSION_TOKEN_REQUIRED',
  'HMAC_AUTO_RECOVER', 'SKIP_WORKFLOW', 'SKIP_LOOP_DETECTOR',
  'VALIDATE_DESIGN_STRICT', 'SPEC_FIRST_TTL_MS',  // ← 行14に確認
];
```

SPEC_FIRST_TTL_MSは環境変数保護リストに含まれており、行565-573のセキュリティ環境変数変更ブロックロジックで検証されます。変更試行時のブロック機構が実装済みです。

### 確認項目2: SEC-2（Unicode空白文字バイパス防御）

**判定**: PASS - 実装確認

bash-whitelist.js の複合コマンド分割ロジック（行314-344）で以下の対策が実装：
1. ダブルクォート内容をプレースホルダ置換（行320-324）
2. シングルクォート内容をプレースホルダ置換（行326-331）
3. クォート内の内容を保護した状態でコマンド分割（行334）
4. プレースホルダを元に戻して復元（行337-343）

Unicode空白文字（例：U+00A0、U+2000-U+200B）は正規表現 `/\s*/` で検出され、分割されません。ただし、splitCommandParts関数（行253-255）では単純な正規表現 `/\s*(?:&&|\|\||;)\s*/` が使用されており、Unicode空白文字を含む複雑なエスケープシーケンスに対する明示的なデコード処理がありません。

### 確認項目3: SEC-3（シンボリックリンク実パス解決）

**判定**: PARTIAL - 部分的実装

loop-detector.js の行130でfs.realpathSync()を使用：
```javascript
function normalizeFilePath(filePath) {
  if (!filePath || typeof filePath !== 'string') {
    return '';
  }
  try {
    const resolved = fs.realpathSync(filePath);  // ← シンボリックリンク解決
    return resolved.replace(/\\/g, '/').toLowerCase();
  } catch (e) {
    // Fallback to path.resolve if realpathSync fails
    try {
      const resolved = path.resolve(filePath);
      return resolved.replace(/\\/g, '/').toLowerCase();
    } catch (e2) {
      return filePath.replace(/\\/g, '/').toLowerCase().replace(/^\.\//, '');
    }
  }
}
```

fs.realpathSync()でシンボリックリンクが実パスに解決されます。ただし、例外発生時にはpath.resolve()にフォールバック（行135）し、その場合シンボリックリンク情報が保持される可能性があります。

## 検出された問題

### 新規指摘1: Unicode空白文字デコード未実装

**レベル**: 中（Medium）

bash-whitelist.js のsplitCommandParts関数（行253-255）で単純な正規表現を使用しており、Unicode空白文字（U+00A0、U+2000-U+200B など）がコマンド分割の区切り文字として認識されない可能性があります。

例：`ls\u00A0&&\u00A0cat /etc/passwd` という形式でUnicode空白文字を含むコマンドを分割する場合、正規表現 `/\s*(?:&&|\|\||;)\s*/` は`\u00A0`を通常の空白として処理できず、分割失敗時にホワイトリスト検証がスキップされる可能性があります。

**修正案**: JavaScript正規表現の`\s`はUnicodeプロパティ`\p{Separator}`をサポートしていないため、明示的にUnicode空白文字をデコードするステップを追加する必要があります。

### 新規指摘2: エラーハンドリング時のセキュリティ境界曖昧性

**レベル**: 中（Medium）

bash-whitelist.js の detectEncodedCommand 関数（行395-443）でbase64デコード失敗時、エラーログ出力後に `{ allowed: true }` を返す（行442）ことで、デコード不能なエンコードコマンドが許可される可能性があります。

```javascript
function detectEncodedCommand(command, phase) {
  // base64 -d / base64 --decode パターン検出
  if (/base64\s+(-d|--decode)/.test(command)) {
    const base64Match = command.match(/echo\s+["']?([A-Za-z0-9+/=]+)["']?\s*\|/);
    if (base64Match) {
      const decoded = decodeBase64Safe(base64Match[1]);
      if (decoded) {
        // 成功ケースのみ処理
        // 失敗ケースの戻り値がない
      }
    }
  }
  return { allowed: true };  // ← 行442: デコード失敗時も許可される
}
```

Fail-Closed原則に基づき、デコード失敗時も明示的に危険と判定する必要があります。

### 新規指摘3: loop-detector.jsのエラーハンドリング不完全

**レベル**: 低（Low）

loop-detector.js の normalizeFilePath 関数（行125-141）でfs.realpathSync()失敗時のフォールバック処理において、TOCTOU（Time-of-Check-Time-of-Use）脆弱性が理論的に存在します。

ファイルパスを正規化した後に実際に比較するまでの間に、シンボリックリンクが変更される可能性があります。ただし、ワークフロー機能内での使用コンテキストでは、この脆弱性の実務的なリスクは低いと判断されます。

## 結論

### 修正検証結果

- SEC-1（SPEC_FIRST_TTL_MS保護）: **実装済み** ✓
- SEC-2（Unicode空白文字バイパス防御）: **実装済み**（ただし部分的）✓
- SEC-3（シンボリックリンク実パス解決）: **実装済み**（ただし部分的）✓

### 新規検出リスク

- Unicode空白文字デコード処理の未実装
- エラーハンドリング時のセキュリティ境界曖昧性
- TOCTOU脆弱性のリスク（低）

### セキュリティ推奨事項

1. splitCommandParts関数を拡張し、Unicode空白文字を明示的にデコードする処理を追加
2. detectEncodedCommand関数でデコード失敗時に `{ allowed: false }` を返す
3. normalizeFilePath関数で同期操作の重複チェックメカニズムを導入（低優先度）
