## サマリー

本ドキュメントは、FR-REQ-1〜FR-REQ-6 の6件の修正に関するインターフェース設計を記述する。
対象はバックエンドシステム（MCP サーバーおよびドキュメント）の修正であるため、
GUI コンポーネントではなく、CLIの出力形式・エラーメッセージ・MCP APIレスポンス・設定ファイルの観点で設計する。

- 目的: 各修正が完了した後に開発者が認識できる外部インターフェースの変化を明確化し、テスト設計フェーズへの引き継ぎを容易にする
- 主要な決定事項:
  - FR-REQ-1 完了後は `npm test` の stderr 出力から特定の警告が消える（テスト出力のクリーン化）
  - FR-REQ-4 完了後はフォールバック動作時のバリデーションパターンが現行仕様と一致する
  - FR-REQ-5 完了後は CLAUDE.md に角括弧プレースホルダーパターンの権威情報源が明記される
- 次フェーズで必要な情報:
  - テスト設計では FR-REQ-1 の警告消去とテスト合格数（912件以上）の両方を検証条件に含めること
  - FR-REQ-4 の TypeScript 型整合性チェックを `npm run build` で確認する手順が必要

---

## CLIインターフェース設計

### FR-REQ-1 修正前後の npm test 出力変化

開発者が `npm test` または `npx vitest run` を実行した際に表示されるテスト結果の変化を以下に示す。

修正前の出力例（design-validator.test.ts 実行時の stderr 混入）:

```
stderr | tests/validation/design-validator.test.ts > DesignValidator > UT-5.1: 全項目実装済み
No "mkdirSync" export is defined on the "fs" mock. Returning `undefined`. Did you forget to return the function from "vi.mock"?
```

修正後の出力例（警告が消え、クリーンなテスト結果のみ表示）:

```
✓ tests/validation/design-validator.test.ts (4)
  ✓ DesignValidator
    ✓ UT-5.1: 全項目実装済み
    ✓ UT-5.2: 一部ファイル不在
    ✓ UT-5.3: ディレクトリ誤設定
    ✓ UT-5.4: ファイル内容不整合
```

修正の核心は `vi.mock('fs', () => ({...}))` ブロックへの `mkdirSync: vi.fn()` 1行追加であり、
この追加によって `DesignValidator.persistCache()` が内部で `fs.mkdirSync` を呼び出した際に、
モックが正常に応答できるようになる。
修正前は vitest が「モックに `mkdirSync` が存在しない」と判断して警告を stdout/stderr に出力していた。
修正後は catch ブロックによるエラー吸収が不要になり、より信頼性の高いテスト環境が実現される。

### テスト全体の実行結果形式

全テストスイート実行時のサマリー行は以下の形式で表示される。

```
Test Files  76 passed (76)
Tests      912 passed (912)
Duration   XX.Xs
```

FR-REQ-1 の修正はテスト合格数に影響しない（既に4件全て通過している）が、
出力に混入していた `No "mkdirSync" export is defined` の警告が消えることで
CI/CD パイプラインの品質チェックが正常に通過するようになる。

---

## エラーメッセージ設計

### FR-REQ-4 修正前のフォールバック動作（エラー発生シナリオ）

MCP サーバー起動時に `artifact-validator.ts` のインポートが失敗した場合、
`definitions.ts` の `GLOBAL_RULES_CACHE` 初期化の catch ブロックが実行される。
この際に現在（修正前）のフォールバック値が使用されると、以下の不整合が発生する。

修正前のフォールバック値が使用された場合のバリデーション動作:
- 角括弧プレースホルダー検出パターンが旧形式で動作し、通常の配列記法や正規表現文字クラスを誤検出する
- `allowedKeywords` に日本語キーワードが含まれるため、特定の表記が誤って許可される
- 開発者が意図しないバリデーション結果を受け取り、問題の再現が困難になる

修正後のフォールバック動作では `bracketPlaceholderRegex` が `/\[#[^\]]{0,50}#\]/g` となるため、
`artifact-validator.ts` が正常ロードされた場合と同一のパターンでバリデーションが実行される。
フォールバック時と正常時でバリデーション結果が一致するため、起動エラーが発生しても安定した動作が保証される。

### artifact-validator.ts が返すエラーメッセージ形式

成果物バリデーション失敗時に `workflow_next` または `workflow_complete_sub` が返すメッセージ例:

```
バリデーション失敗: 角括弧プレースホルダー検出
- ファイル: docs/workflows/xxx/spec.md
- 検出パターン: [#タスク名#]
- 行番号: 42
- 対処法: [#xxx#] 形式のハッシュ記号付きプレースホルダーを具体的な値に置き換えてください
```

FR-REQ-4 の修正によりフォールバック時もこの検出パターンが正確に機能する。
修正前は `/\[(?!関連|参考|注|例|出典)[^\]]{1,50}\]/g` が使用されるため、
通常の Markdown リンク記法や正規表現の文字クラス表記が誤検出されるリスクがあった。

---

## APIレスポンス設計

### workflow_next および workflow_complete_sub の成功レスポンス形式

MCP ツール呼び出しが成功した場合のレスポンス構造（JSON形式）:

```json
{
  "success": true,
  "phase": "implementation",
  "message": "planning フェーズが完了しました。次フェーズ: implementation",
  "phaseGuide": {
    "allowedBashCategories": ["readonly", "testing", "implementation"],
    "subagentTemplate": "..."
  }
}
```

### バリデーション失敗時のレスポンス形式

成果物のバリデーションが失敗した場合、以下の構造でエラーが返される。

```json
{
  "success": false,
  "error": "artifact_validation_failed",
  "details": {
    "file": "docs/workflows/xxx/spec.md",
    "violations": [
      {
        "type": "bracket_placeholder",
        "line": 42,
        "content": "[#タスク名#]",
        "suggestion": "具体的な値に置き換えてください"
      }
    ]
  },
  "retryPrompt": "前回のバリデーション失敗理由: ..."
}
```

FR-REQ-4 の修正完了後は、このレスポンスの `details.violations[].content` で示される
検出パターンが `/\[#[^\]]{0,50}#\]/g` 形式に限定されるため、
フォールバック動作時でも誤検出によるバリデーション失敗が発生しなくなる。

### workflow_status のレスポンスにおける sessionToken

`workflow_status` の呼び出しが成功した場合、レスポンスに `sessionToken` が含まれる。
この値は `workflow_record_test_result` の呼び出しにのみ使用し、他のワークフロー制御ツールには使用しない。

```json
{
  "taskId": "task-20260228-001",
  "phase": "ui_design",
  "sessionToken": "xxxxx",
  "taskName": "修正プロセス中の問題根本原因調査"
}
```

---

## 設定ファイル設計

### definitions.ts の GlobalRules 型インターフェース

`definitions.ts` が参照する `GlobalRules` 型は `src/state/types.ts` に定義されている。
フォールバック値として設定すべき各プロパティの型と役割を以下に示す。

`bracketPlaceholderInfo` オブジェクトの型構造:

```typescript
interface BracketPlaceholderInfo {
  pattern: string;          // 正規表現パターン文字列（new RegExp() に渡される）
  allowedKeywords: string[]; // 除外キーワードリスト（空配列で全角括弧を対象化）
  maxLength: number;        // 最大文字数（50固定）
}
```

FR-REQ-4 修正後の正しいフォールバック値の構造は以下の通りである。

`bracketPlaceholderRegex` プロパティ: リテラル正規表現 `/\[#[^\]]{0,50}#\]/g` を設定する。
この正規表現は「ハッシュ記号で囲まれた0〜50文字の角括弧プレースホルダー」のみに一致する。
修正前の旧パターンは `関連`・`参考` 等の日本語キーワード除外ロジックを含んでいたが、
現行仕様では `[#xxx#]` 形式のみを検出対象とするため除外ロジックは不要である。

`bracketPlaceholderInfo.allowedKeywords` プロパティ: 空配列 `[]` を設定する。
修正前は `['関連', '参考', '注', '例', '出典']` が設定されていたが、
現行の検出対象は `[#xxx#]` 形式のみであるため許可キーワードの概念が適用されない。

`bracketPlaceholderInfo.pattern` プロパティ: `'\\[#[^\\]]{0,50}#\\]'` を設定する。
この文字列は `artifact-validator.ts` の `exportGlobalRules()` が返す値と完全に一致する必要がある。

### MEMORY.md のセクション構造

MEMORY.md は各実装記録を以下の形式で管理している。
FR-REQ-2・FR-REQ-3 の追記では、既存セクションのフォーマットを踏襲する必要がある。

標準的なセクション構造（FR-19 実装記録を参照した場合の形式）:

```
### FR-XX 実装内容（YYYY-MM-DD 完了）
- **対象**: 変更されたファイルやモジュールの説明
- **変更内容**: 具体的な変更点（1行ずつ箇条書き）
- **コミット**: コミットハッシュ（サブモジュール・親リポジトリ別に記載）
- **テスト結果**: 合格件数と合格ファイル数
```

FR-REQ-6 の修正では、セクション見出し行の変更と `Root fix` 行の内容更新が必要であり、
変更前の「MCP server should update task-index.json on every phase transition」という記述を
実装済みであることを示す具体的な参照（`src/state/manager.ts 863行目`）に置き換える。

CLAUDE.md の保守ルール行（FR-REQ-5 の修正対象）は、既存の FORBIDDEN_PATTERNS 保守ルール文の
直後に追記する形式をとり、文体・フォーマットは既存行に合わせた単文形式とする。
具体的には「`bracketPlaceholderRegex` が変更された場合は3箇所（definitions.ts のフォールバック値・テンプレート文字列・CLAUDE.md の説明文）を合わせて更新すること」という内容を追加する。

