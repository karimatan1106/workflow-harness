# 調査結果 - ワークフロー残存問題完全解決

## サマリー

A-評価で指摘された4つの残存問題を調査し、修正箇所と方針を特定した。

## 問題1: 環境変数バイパスの監査漏れ
- **ファイル**: `mcp-server/src/state/manager.ts:218` - HMAC_STRICT参照
- **ファイル**: `mcp-server/src/tools/next.ts:128` - SESSION_TOKEN_REQUIRED参照
- **ファイル**: `mcp-server/src/tools/next.ts:321` - SCOPE_STRICT参照
- **状態**: auditLogger.log()が呼ばれていない。バイパス使用の痕跡が残らない
- **修正方針**: 各バイパス変数使用箇所でauditLogger.log()を呼び出す

## 問題2: スコープ事後検証がデフォルト警告モード
- **ファイル**: `mcp-server/src/tools/next.ts:321` - `SCOPE_STRICT === 'true'`
- **状態**: デフォルトで警告のみ。スコープ外変更が素通り
- **修正方針**: デフォルトを厳格モード(`SCOPE_STRICT !== 'false'`)に変更

## 問題3: 設計検証のパフォーマンス
- **ファイル**: `mcp-server/src/validation/design-validator.ts`
- **状態**: spec.md等を複数回readFileSync。キャッシュなし
- **修正方針**: ファイル内容キャッシュをMap<string, string>で実装

## 問題4: spec-first-guardの状態管理脆弱性
- **ファイル**: `hooks/spec-first-guard.js:45,55-75`
- **状態**: JSON形式で署名なし保存。削除でリセット可能
- **修正方針**: HMAC署名を状態ファイルに付与。削除時はfail-closed
