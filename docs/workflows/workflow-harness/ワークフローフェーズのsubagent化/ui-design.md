# UI設計: ワークフローフェーズのsubagent化

## 概要

本機能はCLI（Claude Code）で動作するため、GUIはありません。ユーザーインターフェースはコマンドラインでのテキスト出力になります。

## CLI出力設計

### 1. フェーズ開始時の出力

```
【researchフェーズ開始】
- subagent_type: Explore
- model: haiku
- 出力先: docs/workflows/{taskName}/research.md

subagentを起動中...
```

### 2. 並列フェーズ開始時の出力

```
【parallel_designフェーズ開始】
並列でsubagentを起動します:
  - state_machine (haiku)
  - flowchart (haiku)
  - ui_design (sonnet)

全subagentの完了を待機中...
```

### 3. subagent完了時の出力

```
✓ state_machine完了 (12秒)
✓ flowchart完了 (8秒)
✓ ui_design完了 (15秒)

全サブフェーズが完了しました。
```

### 4. フェーズ完了時の出力

```
【parallel_designフェーズ完了】
- 完了した作業: ステートマシン図、フローチャート、UI設計
- 次のフェーズ: design_review
- 残りフェーズ数: 14フェーズ
```

### 5. エラー時の出力

```
✗ state_machine失敗
エラー: ファイル書き込みに失敗しました

再実行しますか？
1. はい
2. いいえ（中断）
```

## インタラクション設計

### design_reviewフェーズ

```
【設計レビュー】

以下の成果物をレビューしてください:
- docs/workflows/{taskName}/spec.md
- docs/workflows/{taskName}/state-machine.mmd
- docs/workflows/{taskName}/flowchart.mmd
- docs/workflows/{taskName}/ui-design.md

承認する場合は `/workflow approve design` を実行してください。
```

## 備考

- 進捗表示はClaude CodeのTodoWriteツールで管理
- 詳細なログは必要に応じてverboseモードで表示
