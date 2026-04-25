# 要件定義書 - ワークフロー残存問題完全解決

## サマリー

A-評価で指摘された4つの残存問題を解決し、ワークフロープラグインをS評価レベルに引き上げる。

## 要件一覧

### REQ-1: 環境変数バイパスの監査ログ記録

バイパス環境変数（HMAC_STRICT=false, SESSION_TOKEN_REQUIRED=false）の使用を監査ログに記録する。

- **REQ-1a**: `HMAC_STRICT=false`使用時に`auditLogger.log({ event: 'bypass_enabled', variable: 'HMAC_STRICT' })`を記録
- **REQ-1b**: `SESSION_TOKEN_REQUIRED=false`使用時に同様のログ記録
- **REQ-1c**: ログはJSONL形式で`.claude/state/audit-log.jsonl`に追記
- **受け入れ基準**: バイパス変数使用後にaudit-logにエントリが存在すること

### REQ-2: スコープ事後検証のデフォルト厳格化

スコープ事後検証をデフォルトで厳格モードに変更する。

- **REQ-2a**: `SCOPE_STRICT`のデフォルトを厳格モードに変更（`SCOPE_STRICT !== 'false'`で厳格）
- **REQ-2b**: `SCOPE_STRICT=false`で明示的に警告モードに変更可能
- **REQ-2c**: `SCOPE_STRICT=false`使用時にも監査ログ記録
- **受け入れ基準**: スコープ外変更がデフォルトでブロックされること

### REQ-3: 設計検証のファイルキャッシュ実装

design-validator.tsにファイル内容キャッシュを導入し、パフォーマンスを改善する。

- **REQ-3a**: `Map<string, { content: string; cleanContent: string }>`でファイル内容をキャッシュ
- **REQ-3b**: 同一バリデーション実行内で同じファイルを2度読まない
- **REQ-3c**: バリデーション完了後にキャッシュをクリア
- **受け入れ基準**: 設計検証で同一ファイルのreadFileSyncが1回のみ

### REQ-4: spec-first-guardの状態管理強化

spec-first-guardの状態ファイルにHMAC署名を付与し、改ざん・削除時はfail-closedにする。

- **REQ-4a**: 状態ファイルにHMAC-SHA256署名フィールドを追加
- **REQ-4b**: 状態読み込み時に署名を検証。不正なら`specUpdated: false`として扱う
- **REQ-4c**: 状態ファイルが存在しない場合も`specUpdated: false`（fail-closed）
- **REQ-4d**: 署名鍵はHMACキーファイル（`.claude/state/hmac.key`）を共用
- **受け入れ基準**: 状態ファイル削除・改ざん後にコード編集がブロックされること

### REQ-5: 成果物品質検証の重複検出改善

artifact-validator.tsの重複テキスト検出で構造要素を除外し、誤検出を防ぐ。

- **REQ-5a**: 区切り線（---、***、___）を重複カウントから除外
- **REQ-5b**: コードフェンス（バッククォート3つで始まる行）を重複カウントから除外
- **REQ-5c**: テーブル区切り行を重複カウントから除外
- **受け入れ基準**: 構造要素を含むドキュメントが品質チェックを通過すること

## 変更対象ファイル

| ファイル | REQ | 変更内容 |
|---------|-----|---------|
| `mcp-server/src/state/manager.ts` | REQ-1a | verifyStateHmac()でバイパスログ追記 |
| `mcp-server/src/tools/next.ts` | REQ-1b,2 | sessionToken/scopeバイパスログ、スコープ厳格化 |
| `mcp-server/src/validation/design-validator.ts` | REQ-3 | ファイルキャッシュ実装 |
| `hooks/spec-first-guard.js` | REQ-4 | HMAC署名付き状態管理 |
| `mcp-server/src/validation/artifact-validator.ts` | REQ-5 | 重複検出で構造要素を除外 |

## 非機能要件

- 設計検証のパフォーマンス: 200ファイルスコープで5秒以内
- 監査ログ: 10MB上限、5世代ローテーション（既存仕様維持）
- 後方互換性: 既存タスクの状態ファイルは自動移行
