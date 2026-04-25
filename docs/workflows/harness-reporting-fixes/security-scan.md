# Security Scan: harness-reporting-fixes

taskId: 80980f59-a211-46af-bd52-19d5e623790d
phase: security_scan
size: small

## スキャン対象

P1: dod-l1-l2.ts — scopeFiles doc-only exemption (DOC_ONLY_EXTENSIONS allowlist + extname check)
P2: definitions-shared.ts — ARTIFACT_QUALITY_RULES unique constraint injection (static string constant)

## OWASP分析

A03 Injection: pass — SQL/NoSQL/OSコマンドインジェクションのベクターなし。文字列操作はハードコード定数またはnode:path APIのみ使用
A01 Broken Access Control: pass — ファイルアクセスはresolveProjectPathでプロジェクトスコープに制限。ゲート/フェーズコードにユーザー向けHTTPエンドポイントなし
A08 Software and Data Integrity: advisory — loadTraitCategoriesのJSON.parseにスキーマ検証なし。不正な.harness.jsonはruntimeTypeErrorを引き起こすがコード実行には至らない
A06 Vulnerable Components: advisory — npm auditがhono/esbuild/express-rate-limit/path-to-regexp/picomatchにhigh-severity問題を報告。npm audit fix推奨
A04 Insecure Design: pass — DOC_ONLY_EXTENSIONSはポジティブマッチパターン(デフォルト安全)。extnameは正規化された拡張子を返しダブル拡張子攻撃を防止

## 依存パッケージ監査

hono <=4.12.6: high — cookie injection + SSE injection + serveStatic traversal + prototype pollution (4 CVE), fixable
@hono/node-server <1.19.10: high — 静的パスのエンコードスラッシュ経由の認証バイパス, fixable
express-rate-limit 8.2.0-8.2.1: high — デュアルスタック上のIPv4マップIPv6レート制限バイパス, fixable
esbuild <=0.24.2: moderate — devサーバーのクロスオリジンリクエスト読み取り(dev-only), fix requires breaking change

## コードパターン分析

dynamic code execution (eval/Function): 両ファイルに検出なし
path traversal: dod-l1-l2.tsのresolveProjectPathでnormalize()により軽減。substitutedPathは{docsDir}/{workflowDir}プレースホルダのreplace()のみ使用
prototype pollution: definitions-shared.tsのJSON.parse結果はプロパティアクセスのみ。Object.assignやspreadで機密オブジェクトへの展開なし
regex DoS: ユーザー供給のregexパターンなし。全フィルタリングはSet.has()またはArray.includes()で実行(バックトラッキングなし)
information disclosure: evidenceにフルファイルパス含む。内部開発ツールのためエンドユーザーに非公開で許容範囲

## decisions

- SS-001: P1のDOC_ONLY_EXTENSIONS判定にインジェクションリスクなしと判定。extname()はファイル拡張子部分のみを返し、ハードコードallowlist比較により任意拡張子バイパスを防止する。
- SS-002: P1のscopeFilesはTaskState(内部MCP状態)から取得されユーザーHTTP入力ではない。攻撃面はハーネスセッション内のLLM生成値に限定される。
- SS-003: P2のARTIFACT_QUALITY_RULESは動的補間のない静的文字列定数であり、テンプレートインジェクションや書式文字列脆弱性は不可能。
- SS-004: loadTraitCategoriesのJSON.parseにスキーマ検証がないが、パース結果はパス構築用文字列配列の読み取りにのみ使用され、プロトタイプ汚染リスクは低い。型ガード追加を推奨。
- SS-005: npm auditで7件の脆弱性ツリーを検出(hono, esbuild, express-rate-limit, path-to-regexp, picomatch, @hono/node-server)。これらはdev/server依存でプロダクション配布されない。npm audit fixで大部分が修正可能。
- SS-006: 両ファイルにeval/Function constructor/child_process使用なし。grepで動的コード実行パターンの不在を確認済み。

## artifacts

- docs/workflows/harness-reporting-fixes/security-scan.md: report: P1 doc-only免除とP2ユニーク制約注入のセキュリティスキャン結果。OWASP 5項目中3項pass/2項advisory、依存パッケージ4件のhigh-severity問題検出

## next

- criticalDecisions: SS-004(loadTraitCategoriesの型ガード推奨)、SS-005(npm audit fixで7依存ツリーの脆弱性修正推奨)
- readFiles: workflow-harness/mcp-server/src/gates/dod-l1-l2.ts, workflow-harness/mcp-server/src/phases/definitions-shared.ts
- warnings: honoに4件のアクティブCVE(serveStatic任意ファイルアクセスGHSA-q5qw-h33p-qvwr含む)。express-rate-limitバイパスはMCPサーバーがネットワーク公開時にブルートフォースを許容しうる
