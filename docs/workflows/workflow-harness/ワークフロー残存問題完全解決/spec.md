# 仕様書 - ワークフロー残存問題完全解決

## サマリー

A-評価で指摘された4つの残存問題を解決し、ワークフロープラグインをS評価レベルに引き上げます。

主要な変更:
- REQ-1: 環境変数バイパスの使用を監査ログに記録
- REQ-2: スコープ事後検証のデフォルトを厳格モードに変更
- REQ-3: design-validator.tsにファイル内容キャッシュを実装しパフォーマンス改善
- REQ-4: spec-first-guard.jsの状態ファイルにHMAC署名を付与し改ざん検出を実現
- REQ-5: artifact-validator.tsの重複検出で構造要素（区切り線、コードフェンス）を除外

次フェーズで必要な情報:
- 監査ログは既存のAuditLoggerクラスを活用
- HMACキーは既存の .claude/state/hmac.key を共用
- 設計検証のキャッシュは検証完了後に必ずクリア（メモリリーク防止）
- spec-first-guardの署名検証失敗時はfail-closed（specUpdated: false）

## 概要

本仕様書はA-評価で残った以下4+1つの問題を解決する実装計画を定義する。

問題1（REQ-1）: HMAC_STRICT=false、SESSION_TOKEN_REQUIRED=false、SCOPE_STRICT=falseの各環境変数バイパスが使用された際に監査ログに記録されず、セキュリティ監査が不十分である。auditLogger.log()を各バイパス箇所に追加し、JSONL形式でaudit-log.jsonlに記録する。

問題2（REQ-2）: スコープ事後検証がデフォルトで警告モード（SCOPE_STRICT=trueで厳格化）であり、スコープ外変更が素通りする。デフォルトを厳格モードに反転させ、SCOPE_STRICT=falseで明示的に警告モードに変更可能にする。

問題3（REQ-3）: design-validator.tsが同一ファイルを複数回readFileSyncしており、200ファイルスコープで顕著な遅延が発生する。Map型のファイルキャッシュを導入し、同一バリデーション実行内で同じファイルを2度読まないようにする。

問題4（REQ-4）: spec-first-guard.jsの状態ファイル（spec-guard-state.json）が平文JSONで保存されており、改ざんや削除によるバイパスが可能。HMAC-SHA256署名を付与し、検証失敗時はfail-closedでspecUpdated: falseとして扱う。

問題5（REQ-5）: artifact-validator.tsの重複テキスト検出が構造要素（区切り線の「---」やコードフェンスなど）を誤検出しており、正当なドキュメントが品質チェックに通らない。構造要素をホワイトリストで除外する。

## 変更対象ファイル

| ファイル | REQ | 変更種別 | 変更概要 |
|---------|-----|---------|---------|
| src/state/manager.ts | REQ-1a | 修正 | verifyStateHmac()でHMAC_STRICT=falseバイパスログ追記 |
| src/tools/next.ts | REQ-1b,2 | 修正 | SESSION_TOKEN_REQUIRED/SCOPE_STRICTバイパスログ、スコープ厳格化 |
| src/validation/design-validator.ts | REQ-3 | 修正 | ファイルキャッシュ実装 |
| hooks/spec-first-guard.js | REQ-4 | 修正 | HMAC署名付き状態管理 |
| src/validation/artifact-validator.ts | REQ-5 | 修正 | 重複検出で構造要素を除外 |

## 実装計画

### REQ-1: 環境変数バイパスの監査ログ記録

REQ-1a: src/state/manager.ts のverifyStateHmac()にてHMAC_STRICT=falseチェック直後にauditLogger.log()を呼び出す。記録内容はevent: bypass_enabled、variable: HMAC_STRICT、taskId、phaseとする。auditLogger importが必要。

REQ-1b: src/tools/next.ts のsessionToken検証部分にてSESSION_TOKEN_REQUIRED=falseチェック直後にauditLogger.log()を呼び出す。記録内容はevent: bypass_enabled、variable: SESSION_TOKEN_REQUIRED、taskId、phaseとする。

REQ-1c: src/tools/next.ts のスコープ事後検証部分にてSCOPE_STRICT=falseチェック直後にauditLogger.log()を呼び出す。記録内容はevent: bypass_enabled、variable: SCOPE_STRICT、taskId、phaseとする。

エッジケース: state.taskIdが未定義の場合も許容（既存タスクとの互換性）。監査ログ書き込み失敗は無視して本処理を妨げない。

### REQ-2: スコープ事後検証のデフォルト厳格化

src/tools/next.ts のスコープ事後検証部分にて条件式を変更する。

変更前: process.env.SCOPE_STRICT === 'true'（opt-in厳格化）
変更後: process.env.SCOPE_STRICT !== 'false'（opt-out厳格化）

SCOPE_STRICT未設定時は厳格モードとして扱い、SCOPE_STRICT=falseのみ警告モードで続行する。警告モード有効時のみ監査ログを記録する。

### REQ-3: 設計検証のファイルキャッシュ実装

src/validation/design-validator.ts のDesignValidatorクラスにfileCacheフィールドをMap型で追加する。

readFileWithCache(fullPath)メソッドを新設し、キャッシュヒット時はそのまま返し、ミス時はfs.readFileSync後にキャッシュに格納する。searchInFiles()、validateSpecItems()など全てのファイル読み込み箇所でreadFileWithCacheを使用する。

clearCache()メソッドをvalidateAll()完了時に呼び出してメモリを解放する。

パフォーマンス改善効果: 200ファイルスコープで約10秒から約2秒に短縮（5倍高速化）、キャッシュヒット率約90%。

### REQ-4: spec-first-guardの状態管理強化

hooks/spec-first-guard.js に以下の関数を追加する。

loadOrGenerateHmacKey(): .claude/state/hmac.key からHMAC鍵を読み込むか新規生成する。MCPサーバーのmanager.tsと同じ鍵を共用する。鍵フォーマットは64文字のhex文字列。

generateStateHmac(state): 状態オブジェクトからsignatureフィールドを除外し、残りをJSON.stringifyしてHMAC-SHA256で署名する。結果はbase64エンコード。

verifyStateHmac(state, expectedSignature): 署名を検証する。crypto.timingSafeEqualでタイミング攻撃耐性を確保する。

loadState(): ファイル存在時はJSON.parseして署名検証を実行する。署名不正ならfail-closedでspecUpdated: falseを返す。署名なし旧形式は自動的に署名を追加して保存する。ファイル不存在時もfail-closedでspecUpdated: falseを返す。

saveState(state): 状態にgenerateStateHmac()で生成した署名を付与して保存する。

### REQ-5: artifact-validator.tsの重複検出改善

src/validation/artifact-validator.ts の重複テキスト検出ロジック（validateArtifactQuality関数内）にて、構造要素をホワイトリストで除外する。

除外対象の構造要素パターン:
- 区切り線: ---、***、___
- コードフェンス: 先頭がバッククォート3つで始まる行
- テーブル区切り: |で始まりハイフンを含むパターン（例: |---|---|）
- 空のテーブルセル: |のみの行

実装方法: lineCountMapへの追加前にisStructuralLine(trimmed)でフィルタリングする。isStructuralLine関数は上記パターンにマッチする場合trueを返す。

## 非機能要件

パフォーマンス: 設計検証200ファイルスコープで5秒以内（REQ-3により2秒程度）。監査ログ書き込みは非同期（既存実装により保証）。HMAC署名生成は1ms以内（SHA-256使用）。

監査ログ: JSONL形式（既存仕様維持）。ローテーション10MB、5世代（既存仕様維持）。保存先は.claude/state/audit-log.jsonl。

後方互換性: 既存タスクの状態ファイルはHMAC署名なしでも読み込み可能（初回読み込み時に署名追加）。spec-first-guard.jsの旧形式状態は自動移行。環境変数未設定時はデフォルトで厳格モード（REQ-2）。

## テスト要件

REQ-1テスト: HMAC_STRICT=false使用時にaudit-log.jsonlにエントリ追加確認。SESSION_TOKEN_REQUIRED=false使用時にエントリ追加確認。SCOPE_STRICT=false使用時にエントリ追加確認。監査ログにevent, variable, taskId, phaseが含まれること。

REQ-2テスト: SCOPE_STRICT未設定時にスコープ外変更がブロックされること。SCOPE_STRICT=false設定時にスコープ外変更が警告のみで続行されること。SCOPE_STRICT=false使用時に監査ログが記録されること。

REQ-3テスト: 同一ファイルのfs.readFileSync()が1回のみ呼ばれること。200ファイルスコープで検証時間が5秒以内であること。validateAll()完了後にキャッシュがクリアされること。

REQ-4テスト: 状態ファイルにsignatureフィールドが含まれること。状態ファイル削除後にコード編集がブロックされること。状態ファイルのsignatureを手動改ざん後にコード編集がブロックされること。旧形式（署名なし）状態ファイルが自動的に署名付きに移行されること。

REQ-5テスト: 区切り線（---）が3回以上あるドキュメントが品質チェックを通過すること。コードフェンスが3回以上あるドキュメントが品質チェックを通過すること。実際のダミーテキスト（同一文章の繰り返し）は引き続き検出されること。

## 依存関係

既存モジュール: src/audit/logger.ts（AuditLoggerクラス）、src/state/manager.ts（HMAC鍵生成ロジック）。Node.js標準ライブラリのcryptoモジュール（HMAC-SHA256）。外部依存なし。

## リスク管理

| リスク | 影響 | 対策 |
|--------|------|------|
| 監査ログ書き込み失敗 | バイパス使用が記録されない | エラー時も本処理を妨げない（既存設計） |
| ファイルキャッシュのメモリリーク | 長時間実行時のメモリ不足 | validateAll()完了時に必ずclearCache() |
| HMAC鍵ファイル削除 | 署名検証不可 | 新規鍵生成して継続（既存タスクは署名なしで移行） |
| 署名検証の計算コスト | 状態読み込み遅延 | SHA-256は1ms以内、実用上問題なし |

## マイグレーション計画

既存タスクへの影響は以下の通り。HMAC署名なし状態ファイルは初回読み込み時に自動的に署名追加。spec-guard-state.json旧形式は初回読み込み時に自動的に署名追加。環境変数未設定はデフォルトで厳格モードとなる。

移行手順: コード変更をデプロイし、既存タスク初回アクセス時に自動移行する。監査ログでSCOPE_STRICT=false使用状況を確認し、必要に応じて開発者に移行ガイドを提供する。

## 関連ドキュメント

要件定義: docs/workflows/ワ-クフロ-残存問題完全解決/requirements.md
監査ログ仕様: src/audit/logger.ts（AuditLoggerクラス）
HMAC署名仕様: src/state/manager.ts
設計検証: src/validation/design-validator.ts
成果物検証: src/validation/artifact-validator.ts
