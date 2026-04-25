# Threat Model: harness-first-pass-improvement

taskId: harness-first-pass-improvement
phase: threat_modeling
size: S

## Overview

対象ファイル3件はすべてテキスト/テンプレート変更であり、ランタイムロジックの変更を含まない。

| File | Type | Change Scope |
|------|------|-------------|
| .claude/agents/coordinator.md | Agent definition (Markdown) | テキスト追加 |
| .claude/agents/worker.md | Agent definition (Markdown) | テキスト追加 |
| workflow-harness/mcp-server/src/phases/defs-stage4.ts | Static template strings | テンプレート文字列追加 |

## Attack Surface Analysis

### coordinator.md / worker.md
- エージェント定義ファイル。Claude Code内部でのみ参照される。
- 外部ネットワークからのアクセス不可。ユーザー入力の直接処理なし。
- 変更はプロンプトテキストの追加のみ。実行権限やツール権限の変更なし。

### defs-stage4.ts
- TypeScriptファイル内の静的テンプレート文字列。
- コンパイル時に評価される定数。外部入力を受け付けない。
- テンプレートプレースホルダ({taskName}等)はハーネス内部で安全に置換される。
- SQL/Shell injection経路なし。

## STRIDE Analysis

| Threat | Applicable | Rationale |
|--------|-----------|-----------|
| Spoofing | No | 認証メカニズムの変更なし |
| Tampering | No | データ永続化ロジックの変更なし。テキスト追加のみ |
| Repudiation | No | ログ/監査メカニズムの変更なし |
| Information Disclosure | No | 秘密情報の追加/露出なし。テンプレート文字列のみ |
| Denial of Service | No | リソース消費パターンの変更なし |
| Elevation of Privilege | No | ツール権限・Bash権限の変更なし |

## OWASP Top 10 Relevance

該当なし。理由:
- ユーザー入力の直接処理なし (A03: Injection 不該当)
- 認証/認可フローの変更なし (A01, A07 不該当)
- 暗号処理の変更なし (A02 不該当)
- 外部依存の追加なし (A06 不該当)

## decisions

- TM-001: リスクレベルを「低」と判定。全変更がテキスト/テンプレート追加であり、実行ロジックの変更を含まないため。
- TM-002: coordinator.mdのツール権限リスト(tools:行)が変更されないことを実装時に確認する。権限昇格を防止するため。
- TM-003: worker.mdのmaxTurns値が変更されないことを実装時に確認する。リソース消費の意図しない増大を防止するため。
- TM-004: defs-stage4.tsのbashCategories配列が変更されないことを実装時に確認する。Bash実行権限の意図しない拡大を防止するため。
- TM-005: defs-stage4.tsのテンプレート変更がプレースホルダ構文({varName})以外の動的評価を導入しないことを確認する。テンプレートインジェクション防止のため。
- TM-006: 変更後のファイルが200行制限を超過しないことを確認する。core-constraintsの責務分離指標を維持するため。

## artifacts

- threat-model.md (本ファイル)

## next

planning フェーズへ進行。TM-002〜TM-006の確認事項を planning の制約として引き継ぐ。
