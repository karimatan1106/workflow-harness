# BUG1-2-3発生根本原因の追究と再発防止 - 調査結果

## サマリー

本ドキュメントでは、ワークフロープラグインにおける3つのバグの根本原因を詳細に調査しました。

### 目的
- バグ1（isStructuralLineのMarkdownヘッダー除外漏れ）の根本原因特定
- バグ2（MCP serverとhooksのHMAC計算アルゴリズム不一致）の根本原因特定
- バグ3（submoduleへの未コミット変更）の根本原因特定
- 各バグの発生経緯と設計・実装上の問題点の分析

### 主要な決定事項
1. バグ1はisStructuralLine関数の初期設計時にMarkdownヘッダーが見落とされた設計欠陥
2. バグ2はREQ-9（HMAC鍵ローテーション対応）実装時にhooksの更新が漏れたことによる仕様不整合
3. バグ3はサブモジュール内の変更をコミットせずに親リポジトリにコミットした運用ミス

### 次フェーズで必要な情報
- 再発防止策の設計（requirements/planningフェーズ）
  - バグ1: isStructuralLine関数の構造要素定義の明確化とテストケース追加
  - バグ2: HMAC実装の統一とインターフェース仕様書の作成
  - バグ3: サブモジュールコミット確認の自動化（pre-commit hook）

---

## バグ1: isStructuralLine にMarkdownヘッダー除外がない

### 現象
`workflow-plugin/mcp-server/src/validation/artifact-validator.ts` の重複行検出ロジックで、Markdownのヘッダー行（`#`, `##`, `###` で始まる行）が構造的行として除外されていない。同一ヘッダーが3回以上出現すると重複として誤検知される。

### 調査結果

#### 1. 実装の現状
**ファイル**: `workflow-plugin/mcp-server/src/validation/artifact-validator.ts`

**isStructuralLine関数（93〜108行目）**:
```typescript
export function isStructuralLine(line: string): boolean {
  const trimmed = line.trim();
  // 区切り線: ---、***、___（3文字以上の繰り返し）
  if (/^[-*_]{3,}$/.test(trimmed)) return true;
  // コードフェンス: ```で始まる行
  if (trimmed.startsWith('```')) return true;
  // テーブルセパレータ行: |で始まりハイフン・コロンのみを含む
  if (/^\|[\s\-:|]+\|$/.test(trimmed)) return true;
  // REQ-D2: テーブルデータ行: |で囲まれた行（パイプ区切りの行全て）
  if (/^\|.*\|$/.test(trimmed)) return true;
  // Markdownラベルパターン: **太字**: のような構造ラベル
  if (/^\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) return true;
  // リスト先頭のMarkdownラベル: - **太字**: のような構造ラベル
  if (/^[-*]\s+\*\*[^*]+\*\*[:：]?\s*$/.test(trimmed)) return true;
  return false;
}
```

**問題点**:
- 水平線、コードフェンス、テーブル、太字ラベルは除外されている
- **Markdownヘッダー（`#`, `##`, `###`等）は除外されていない**

#### 2. 不整合の証拠
**セクション密度チェック（599行目付近）**では別途ヘッダーを除外:
```typescript
const substantiveLines = sectionContent.filter((line) => {
  const trimmed = line.trim();
  // ...
  if (trimmed.startsWith('#')) return false;  // ←ここでヘッダーを除外
  if (isStructuralLine(trimmed)) return false;
  return true;
});
```

この実装は、`isStructuralLine()`がヘッダーを除外すべきことを前提としているが、実際には除外していない。同一ロジックが2箇所に散在している状態。

#### 3. 影響範囲
- ダミーテキスト検出（263〜289行目付近）で同一ヘッダーが3回以上出現すると誤検知
- 例: `## 背景`, `## 目的`, `## 実装方針` のような一般的なセクション名がプロジェクト全体で繰り返されると誤検知される

### 根本原因分析

#### 原因1: 初期設計時の見落とし
`isStructuralLine()`関数は、ファイル全体で繰り返される「構造的な行」を定義するための関数として設計された。しかし、初期実装時（2026-01-19以前のコミット）にMarkdownヘッダーが見落とされた。

**設計意図の不明確さ**:
- 関数のJSDocコメントには「構造要素」としか記載されていない
- どのような要素が「構造要素」に該当するかの定義が不明確
- 実装者がMarkdownヘッダーを構造要素と認識しなかった可能性

#### 原因2: テストケースの不足
`isStructuralLine()`関数に対する単体テストが存在しない（または不十分）。以下のテストケースが欠如している:
- Markdownヘッダー（`#`, `##`, `###`）が構造的行として除外されるか
- 構造的行と判定すべき要素の網羅的なテスト

#### 原因3: 重複ロジックの存在
同一の構造要素判定ロジックが複数箇所に散在:
- `isStructuralLine()` 関数（93〜108行目）
- セクション密度チェック内のフィルタ（595〜600行目）

この重複により、片方は更新されるがもう片方が更新されない状態が発生しやすい。

### 発生時期
- 初期実装: 2026-01-19頃（コミット `6df9914` 以前）
- 顕在化: 2026-02-13以降（セクション密度チェック追加により不整合が露呈）

---

## バグ2: MCP server と hooks の HMAC 計算アルゴリズム不一致

### 現象
MCP serverが書き込んだ `workflow-state.json` の `stateIntegrity` フィールドをhooksが検証すると必ず失敗する。

### 調査結果

#### 1. 実装の不一致

**対象ファイル**:
- `workflow-plugin/mcp-server/src/state/hmac.ts` — MCP serverのHMAC実装
- `workflow-plugin/hooks/hmac-verify.js` — hooksのHMAC検証実装

**3つの不一致**:

##### 不一致1: 鍵ファイル形式
**MCP server (hmac.ts 36〜39行目)**:
```typescript
interface HmacKeyFile {
  version: number;
  keys: HmacKeyEntry[];  // ←配列のフィールド名は "keys"
}

export interface HmacKeyEntry {
  keyId: string;      // ←フィールド名は "keyId"
  key: string;
  createdAt: string;
  rotatedAt: string | null;
}
```

**書き込み処理 (hmac.ts 152行目)**:
```typescript
const data: HmacKeyFile = { version: 1, keys };
fs.writeFileSync(keyFilePath, JSON.stringify(data, null, 2));
```

**hooks (hmac-verify.js 35〜42行目)**:
```javascript
if (!Array.isArray(keys)) {  // ←配列そのものを期待
  console.error('[HMAC] hmac-keys.json の形式が不正です（配列でない）');
  return [];
}

for (const keyObj of keys) {
  if (!keyObj.generation || !keyObj.key || !keyObj.createdAt) {  // ←"generation"を期待
    console.error('[HMAC] 鍵オブジェクトに必須フィールドがありません:', keyObj);
    return [];
  }
}
```

**問題点**:
- MCP serverは `{version: 1, keys: [...]}` というオブジェクトを書き込む
- hooksは `[...]` という配列を期待している
- フィールド名も不一致（`keyId` vs `generation`）

##### 不一致2: 鍵のエンコーディング
**MCP server (hmac.ts 191行目)**:
```typescript
export function signWithCurrentKey(data: string): string {
  const currentKey = getCurrentKey();
  return crypto
    .createHmac(HMAC_ALGORITHM, currentKey.key)  // ←hex文字列をそのまま使用
    .update(data)
    .digest('hex');
}
```

**hooks (hmac-verify.js 144行目)**:
```javascript
const keyHex = loadHMACKey();
const key = Buffer.from(keyHex, 'hex');  // ←hex文字列をバイナリバッファに変換
return computeHMACSHA256(key, data);
```

**問題点**:
- MCP serverは鍵をhex文字列のまま `createHmac()` に渡す
- hooksは鍵を `Buffer.from(keyHex, 'hex')` でバイナリ化してから渡す
- Node.jsの `crypto.createHmac()` は文字列をUTF-8として解釈するため、結果が異なる

##### 不一致3: ダイジェストのエンコーディング
**MCP server (hmac.ts 193行目)**:
```typescript
.digest('hex')  // ←hexエンコード
```

**hooks (hmac-verify.js 122行目)**:
```javascript
function computeHMACSHA256(key, data) {
  const hmac = crypto.createHmac('sha256', key);
  hmac.update(data, 'utf8');
  return hmac.digest('base64');  // ←base64エンコード
}
```

**問題点**:
- MCP serverはHMACダイジェストをhexエンコード
- hooksはbase64エンコード
- 同一の署名でも文字列表現が完全に異なる

#### 2. コメントの矛盾
**hooks (hmac-verify.js 128行目)**:
```javascript
/**
 * タスク状態のHMAC署名を計算する
 *
 * manager.ts の generateStateHmac() と同一のアルゴリズム:  // ←矛盾
 * 1. stateIntegrity フィールドを除外
 * 2. 残りのフィールドをキーでソート
 * 3. JSON.stringify
 * 4. HMAC-SHA256 でハッシュ化
 * 5. base64 エンコード
 */
```

このコメントは「manager.tsと同一のアルゴリズム」と記載しているが、実際には:
- manager.tsは存在せず、hmac.tsが実装している
- hmac.tsはhexエンコードだがコメントではbase64と記載されている
- 実装とコメントが乖離している

### 根本原因分析

#### 原因1: REQ-9実装時のhooks更新漏れ
**時系列**:
1. **2026-01-19頃（コミット `6df9914`）**: REQ-9（HMAC鍵ローテーション対応）実装
   - MCP server側で `hmac.ts` を新規実装
   - 鍵ファイル形式を `{version: 1, keys: [{keyId, key, createdAt, rotatedAt}, ...]}` に変更
   - HMAC署名アルゴリズムを再実装（hexエンコード）

2. **hooks側の更新が漏れた**:
   - `hmac-verify.js` は旧仕様のまま（配列形式、generation、base64エンコード）
   - MCP serverとhooksの仕様が分岐

#### 原因2: インターフェース仕様書の不在
- HMAC署名の計算アルゴリズムが仕様書として文書化されていない
- MCP serverとhooksが独立に実装され、整合性チェックが行われなかった
- コードレビューでも気づかれなかった

#### 原因3: 統合テストの不足
- MCP serverが書き込んだ `workflow-state.json` をhooksが検証するエンドツーエンドテストが存在しない
- 各コンポーネントの単体テストのみで、統合テストが不足している

#### 原因4: プロセス分離によるテストの困難さ
- MCP serverはNode.jsプロセスで実行
- hooksはGit hooksとして別プロセスで実行
- プロセス間でのHMAC署名の一貫性を検証するテストが難しい

### 発生時期
- 初期実装: 2026-01-19頃（コミット `6df9914` でREQ-9実装）
- 顕在化: 2026-02-13以降（実際にhooksでHMAC検証を実行した際）

---

## バグ3: submodule に artifact-validator.ts の変更が未コミット

### 現象
`workflow-plugin` サブモジュールの `artifact-validator.ts` に、.mmdファイル除外の修正が加えられているがコミットされていない。

### 調査結果

#### 1. 未コミット変更の内容
**コマンド**: `cd workflow-plugin && git status --short`
**出力**:
```
 M mcp-server/src/validation/artifact-validator.ts
?? mcp-server/README.md
```

**変更内容（diff抜粋）**:
```diff
@@ -263,27 +263,30 @@ export function validateArtifactQuality(

   // 7. ダミーテキスト検出（同一行の3回以上繰り返し）
   // コードフェンス内の行は除外する（コード例は構文上の繰り返しが自然に発生する）
-  const lineCountMap = new Map<string, number>();
-  let insideCodeFence = false;
-  for (const line of lines) {
-    const trimmed = line.trim();
-    // コードフェンスの開始/終了を追跡
-    if (trimmed.startsWith('```')) {
-      insideCodeFence = !insideCodeFence;
-      continue;
-    }
-    // コードフェンス内の行はスキップ
-    if (insideCodeFence) continue;
-    if (trimmed.length > 0 && !isStructuralLine(trimmed)) {
-      lineCountMap.set(trimmed, (lineCountMap.get(trimmed) || 0) + 1);
+  // .mmd ファイル（Mermaid図）は構文上の繰り返し（閉じ括弧等）が自然に発生するため除外
+  if (!filePath.endsWith('.mmd')) {
+    const lineCountMap = new Map<string, number>();
+    let insideCodeFence = false;
+    for (const line of lines) {
+      const trimmed = line.trim();
+      // コードフェンスの開始/終了を追跡
+      if (trimmed.startsWith('```')) {
+        insideCodeFence = !insideCodeFence;
+        continue;
+      }
+      // コードフェンス内の行はスキップ
+      if (insideCodeFence) continue;
+      if (trimmed.length > 0 && !isStructuralLine(trimmed)) {
+        lineCountMap.set(trimmed, (lineCountMap.get(trimmed) || 0) + 1);
+      }
     }
-  }

-  const duplicates = Array.from(lineCountMap.entries()).filter(([_, count]) => count >= 3);
-  if (duplicates.length > 0) {
-    errors.push(
-      `${fileName} にダミーテキストの疑いがあります（同一行の繰り返し）`
-    );
+    const duplicates = Array.from(lineCountMap.entries()).filter(([_, count]) => count >= 3);
+    if (duplicates.length > 0) {
+      errors.push(
+        `${fileName} にダミーテキストの疑いがあります（同一行の繰り返し）`
+      );
+    }
   }
```

**変更の意図**: .mmdファイル（Mermaid図）はダミーテキスト検出から除外する修正

#### 2. 未コミットの経緯
**時系列推定**:
1. **2026-02-13以前**: .mmdファイルのダミーテキスト誤検知が発生
2. **2026-02-13**: `artifact-validator.ts` を修正してMermaid図を除外
3. **コミット漏れ**: サブモジュール内でコミットせずに親リポジトリでコミット
4. **結果**: サブモジュールの作業ディレクトリに未コミット変更が残存

#### 3. サブモジュールのコミット履歴
**最新コミット**:
```
86b52c2 fix: resolve 3 existing bugs (BUG-1, BUG-2, BUG-3)
```

このコミットはバグ修正のコミットだが、`artifact-validator.ts` の変更は含まれていない（別のバグの修正のみ）。

### 根本原因分析

#### 原因1: サブモジュールコミット手順の複雑さ
Gitサブモジュールでは以下の手順が必要:
1. サブモジュール内で変更をコミット
2. 親リポジトリでサブモジュールのコミットハッシュを更新してコミット

この2段階の手順を忘れると、サブモジュール内の変更がコミットされずに親リポジトリのみがコミットされる。

#### 原因2: サブモジュールコミット確認の自動化不足
- サブモジュールに未コミット変更がある状態で親リポジトリのコミットが可能
- pre-commit hookでサブモジュールの状態をチェックしていない
- CIでもサブモジュールの整合性チェックが不足

#### 原因3: 手動コミットのヒューマンエラー
- 修正作業中に複数のバグ修正を並行して進めた
- .mmdファイル除外の修正を適用したが、コミット前に別のバグ修正に移った
- コミットするのを忘れたまま作業が進行

### 発生時期
- 変更適用: 2026-02-13頃（Mermaid図の誤検知対応）
- コミット漏れ: 同日（バグ1-2-3修正のコミット時）

---

## 共通する構造的問題

3つのバグに共通する構造的問題点を分析する。

### 1. テスト駆動開発（TDD）の不徹底
- **バグ1**: `isStructuralLine()` の単体テストが不足
- **バグ2**: MCP serverとhooksの統合テストが不存在
- **バグ3**: （テストとは無関係だが）コミット前のテスト実行で検出可能だった

**影響**: 実装後にバグが混入しても検出できず、本番環境で顕在化

### 2. インターフェース仕様書の不在
- **バグ2が典型例**: HMAC署名の計算アルゴリズムが仕様書として文書化されていない
- コンポーネント間のインターフェース（ファイル形式、アルゴリズム）が口頭やコメントのみで伝達
- 実装者が独自解釈で実装し、不整合が発生

**影響**: 複数のコンポーネントが同一のインターフェースに依存する場合に不整合が発生しやすい

### 3. 自動化の不足
- **バグ3が典型例**: サブモジュールコミット確認が手動
- pre-commit hookでの自動チェックが不足
- CIでのサブモジュール整合性チェックが不足

**影響**: 手動作業に依存するとヒューマンエラーが発生しやすい

### 4. コードレビューの形骸化
- **全バグに共通**: いずれもコードレビューで検出可能な問題だった
- レビューチェックリストに「構造要素の網羅性」「インターフェース整合性」「サブモジュール状態」が含まれていない

**影響**: レビューが形式的なものになり、実質的な品質チェックが行われない

---

## 再発防止に向けた提言

### 提言1: 構造要素定義の明確化（バグ1対策）
- `isStructuralLine()` の仕様書を作成
- 「構造要素」の定義を明確化（Markdownヘッダー、リスト、引用等を網羅）
- 単体テストでカバレッジ100%を目指す

### 提言2: インターフェース仕様書の必須化（バグ2対策）
- HMAC署名の計算アルゴリズムをdocs/spec/に文書化
- ファイル形式（鍵ファイル、状態ファイル）の仕様書を作成
- MCP serverとhooksの両方が同一仕様書を参照する体制

### 提言3: サブモジュールコミット確認の自動化（バグ3対策）
- pre-commit hookでサブモジュールの未コミット変更を検出
- サブモジュールに未コミット変更がある場合はコミットを拒否
- CIでサブモジュールの整合性チェック（親リポジトリのsubmodule参照が最新か）

### 提言4: 統合テストの強化（全バグ対策）
- MCP serverが書き込んだファイルをhooksが読み取るエンドツーエンドテスト
- テストコードをproduction codeと同等に扱う（コードレビュー必須、カバレッジ80%以上）

### 提言5: コードレビューチェックリストの拡充
- 構造要素の網羅性チェック（新規追加時）
- インターフェース整合性チェック（複数コンポーネント間の連携時）
- サブモジュールコミット状態チェック（サブモジュール内のファイル変更時）

---

## 補足: 各バグの技術的詳細

### バグ1技術詳細: Markdownヘッダーの構造的性質
Markdownヘッダー（`#`, `##`, `###`）は以下の性質を持つ:
- **文書構造を定義する要素**: セクション区切りとして文書全体で繰り返される
- **意味的な重複ではない**: 同一のヘッダー文字列が複数回出現しても、各セクションの見出しとして意味が異なる
- **構造的行の定義に該当**: 水平線やコードフェンスと同様に「文書構造を定義する行」として扱うべき

### バグ2技術詳細: HMAC署名の計算プロセス
正しいHMAC署名の計算プロセス（RFC 2104準拠）:
1. **鍵の準備**: 鍵をバイナリ形式で用意（hex文字列の場合は `Buffer.from(keyHex, 'hex')` で変換）
2. **HMAC生成**: `crypto.createHmac(algorithm, key)` に**バイナリ鍵**を渡す
3. **データ更新**: `hmac.update(data, 'utf8')` でデータを追加
4. **ダイジェスト生成**: `hmac.digest(encoding)` でエンコード（hex/base64/buffer）

**MCP serverの誤り**:
```typescript
crypto.createHmac('sha256', currentKey.key)  // currentKey.key はhex文字列
```
→ hex文字列をUTF-8として解釈し、ASCII文字（'0'-'9', 'a'-'f'）のバイト列として扱う
→ 本来の32バイトのバイナリ鍵ではなく、64バイトのASCII文字列として扱われる

**正しい実装**:
```typescript
const keyBuffer = Buffer.from(currentKey.key, 'hex');
crypto.createHmac('sha256', keyBuffer)
```

### バグ3技術詳細: Gitサブモジュールの仕組み
Gitサブモジュールの状態管理:
- **親リポジトリ**: `.gitmodules` ファイルとサブモジュールディレクトリのコミットハッシュを保持
- **サブモジュール**: 独立したGitリポジトリ（独自の作業ディレクトリとコミット履歴）
- **整合性**: 親リポジトリが参照するコミットハッシュ = サブモジュールの現在のHEAD

**未コミット変更の問題**:
1. サブモジュール内でファイルを編集
2. サブモジュール内でコミットせずに親リポジトリに移動
3. 親リポジトリで `git add .` → サブモジュールの作業ディレクトリの変更は追跡されない
4. 親リポジトリでコミット → サブモジュールのコミットハッシュは変わらない
5. **結果**: サブモジュールに未コミット変更が残存

---

## 結論

3つのバグはいずれも以下の構造的問題に起因する:

1. **設計時の見落とし**（バグ1）: 仕様の不明確さとテスト不足
2. **実装の分岐**（バグ2）: インターフェース仕様書の不在とコンポーネント間の整合性チェック不足
3. **運用のヒューマンエラー**（バグ3）: 手動作業への依存と自動化の不足

これらの問題は、**TDD（テスト駆動開発）**、**仕様駆動開発（SDD）**、**自動化の徹底**により再発を防止できる。次のrequirementsフェーズでは、これらの再発防止策を要件として定義する。
