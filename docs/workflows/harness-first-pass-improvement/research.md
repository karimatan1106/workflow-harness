## summary

ハーネス1発通過率改善のため、coordinator.md / worker.md / defs-stage4.ts の3ファイルの現状構造を調査した。
各ファイルの追加可能位置、既存ルールとの整合性、workflow-delegation.md Phase Parameter Table との一貫性を分析。

## user intent analysis

- surface: 3ファイルを変更して1発通過率を上げたい
- deep: DoD失敗→リトライの無駄サイクルを減らし、フェーズ完了までの総ステップ数を削減したい
- unclear: 具体的にどの失敗パターンが最も頻発しているか（実測データなし）
- assumptions: Common Failures列に記載された失敗パターンが実際の主要失敗原因と一致すると仮定

## findings

### coordinator.md (38行)

現状: Role / Context Handoff / On Hook Error / Result Format / On Completion の5セクション構成。
追加可能位置:
- `## Role` の後（行12-15）: 分析品質ルール追加に適切
- `## Context Handoff` の後（行19-22）: 出力品質チェックリスト追加に適切
- `## On Completion` の前（行33）: セクション検証ステップ追加に適切

不足点:
- 出力成果物のセクション完全性チェックがない（DoD required sections未検証で提出）
- Prior failures情報の活用指示がない（リトライ時に同じ失敗を繰り返す）
- decisions項目の最低5件ルールが未記載（workflow-delegation.mdにはある）

### worker.md (57行)

現状: Role / Edit Modes (direct-edit, edit-preview) / Context Handoff / On Hook Error の4セクション構成。
追加可能位置:
- `## Edit Modes` 内の `### direct-edit` セクション後（行24-25）: Edit共通ルール追加に適切
- `### edit-preview` の Rules セクション（行38-44）: 追加ルール挿入可能
- `## Context Handoff` の前（行46）: Edit品質ルール専用セクション追加に適切

不足点:
- Edit tool使用前のRead必須ルールが明記されていない
- old_string一意性確保のためのコンテキスト量ガイダンスがない
- インデント保持ルールがない（タブ/スペース混在ファイルで失敗しやすい）

### defs-stage4.ts (185行)

現状: test_impl / implementation / refactoring / build_check / code_review の5フェーズ定義。

implementation テンプレート (行49-82):
- 設計チェックリスト（4項目）あり: planning / state-machine / flowchart / test-design
- 入力ファイル5つ指定済み
- 不足: テスト実行→全GREEN確認の具体的手順がない
- 不足: Edit失敗時のリカバリ指示がない

code_review テンプレート (行143-183):
- SRB-1レビュー姿勢指示あり
- AC達成状況テーブル (IA-5) 必須指示あり
- 不足: 「Markdown形式で書け」の明示がない（Phase Parameter TableにはNOT TOON指示あり）
- 不足: decisions最低5件ルールが未記載

### workflow-delegation.md Phase Parameter Table との整合性

| 項目 | delegation.md の指示 | 実ファイルの状態 | 乖離 |
|------|---------------------|-----------------|------|
| implementation Common Failures | "tests not passing" | テンプレートに具体的対策なし | あり |
| code_review Common Failures | "content_validation: write in Markdown format, NOT TOON" | テンプレートに形式指示なし | あり |
| code_review Required Sections | "summary, design-impl consistency, AC Achievement Status" | AC Statusのみ明示 | 部分的 |
| decisions 5件ルール | Common Constraints で全テンプレート必須 | coordinator.md/worker.md に未転記 | あり |
| Prior failures | Template A/B/C 全てに記載 | coordinator.md/worker.md に反映なし | あり |

## decisions

- RS-001: coordinator.mdに出力セクション完全性チェックを追加する -- DoD required sections不足が主要失敗パターンであり、提出前の自己検証で防止可能
- RS-002: worker.mdにEdit前Read必須ルールとold_string一意性ガイダンスを追加する -- Edit tool失敗はリトライコスト大。事前Read+十分なコンテキストで一意性担保
- RS-003: defs-stage4.ts implementation テンプレートにテスト実行確認手順を明示する -- "tests not passing" が Common Failures に記載されており、GREEN確認の具体手順が欠落
- RS-004: defs-stage4.ts code_review テンプレートにMarkdown形式指示とdecisions最低件数を追加する -- Phase Parameter Tableとの乖離を解消し、形式不一致によるDoD失敗を防止
- RS-005: coordinator.md/worker.md にPrior failures活用指示を追加する -- リトライ時に前回失敗理由を参照しない限り同一失敗を繰り返すため
- RS-006: 変更は3ファイルに限定し、workflow-delegation.md自体は変更しない -- delegation.mdは参照仕様として正。実装側（agent定義・テンプレート）を仕様に合わせる方向

## impact scope

変更対象:
- .claude/agents/coordinator.md: セクション追加（約10-15行増）
- .claude/agents/worker.md: Edit品質ルールセクション追加（約10-15行増）
- workflow-harness/mcp-server/src/phases/defs-stage4.ts: implementation/code_review テンプレート文字列修正（各5-10行増）

影響範囲:
- 全ハーネスフェーズのcoordinator/worker実行品質に波及（正の影響）
- defs-stage4.tsはStage 4のみ影響
- 既存テストへの影響: テンプレート文字列変更のため、スナップショットテストがある場合は更新必要

## artifacts

- research.md（本ファイル）

## next

1. requirements フェーズでAC-1〜AC-4を定義（各ファイルの変更内容を受入基準化）
2. planning フェーズで具体的な変更差分を設計
3. implementation フェーズで3ファイルを編集
