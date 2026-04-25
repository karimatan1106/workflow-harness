# UI Design: workflow-harness-refactoring

phase: ui_design
task: workflow-harness-refactoring
status: complete
uiScope: none
date: 2026-03-23

## Summary

本タスクはMCPサーバーのリファクタリング（vscode-ext削除、hookバックアップ掃除、デッドコード削除、Serena MCP化、スキルドキュメント更新）であり、ユーザー向けUIの変更を含まない。本ドキュメントはフェーズ成果物の要件を満たすため、UI非対象であることを記録する。

## Scope Assessment

- uiScope: none
- rationale: バックエンドリファクタリングのみのため、UI設計は対象外
- affectedInterfaces: なし

## Existing UI Context

- 本プロジェクトはCLIベースのワークフローハーネスであり、GUIは持たない
- vscode-extは削除対象であり、新規UI要素の追加はない
- CLIの出力フォーマット（TOON形式）は維持される

## Design Analysis

### Interaction Patterns

- CLIコマンド体系は変更なし
- harness_start / harness_next 等のMCPツールインターフェースは維持
- Serena MCP化によるユーザー操作変更なし（MCPツール名が変わるのみ、ワークフロー手順は同一）

### Error States

- MCPツールのエラーレスポンス形式は既存を維持
- Serena MCPサーバー追加時のエラーハンドリングはSerena側の仕様に準拠

### Accessibility

- CLIツールのためGUIアクセシビリティは対象外
- CLIの出力フォーマット（TOON形式）は維持される

### Responsive Design

- CLIツールのためGUIレスポンシブ設計は適用されない

### Design Tokens

- 視覚デザイントークンはCLIプロジェクトに該当しない

### Component Inventory

- コンポーネントベースのUI構造を持たないCLIプロジェクト

### Loading States

- CLIプロジェクトではターミナル進捗表示で対応するため、GUIローディング状態は対象外

## decisions

- UID-01: UI変更なし (バックエンドリファクタリングのみのため)
- UID-02: vscode-ext削除後もCLIインターフェースに影響なし (vscode-extは独立コンポーネントだったため)
- UID-03: Serena MCP化によるユーザー操作変更なし (MCPツール名が変わるのみ、ワークフロー手順は同一)
- UID-04: TOON出力形式を維持 (既存のCLI出力との互換性確保)
- UID-05: エラーメッセージ形式を維持 (ユーザー体験の一貫性)

## artifacts

- docs/workflows/workflow-harness-refactoring/ui-design.md, design, UI非対象の記録

## next

- criticalDecisions: UI変更なし、CLIインターフェース維持
- readFiles: requirements.md, planning.md
- warnings: Serena MCPツール名の変更がドキュメントに反映される必要あり
