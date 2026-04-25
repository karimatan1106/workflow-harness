# Planning: harness-first-pass-improvement

taskId: harness-first-pass-improvement
phase: planning
size: S

## decisions

- PL-001: coordinator.mdの## Result Format直前に## Phase Output Rulesセクションを挿入。DoDゲート不合格の主因であるdecisions不足・artifacts不足・acMapping欠落を事前防止する。
- PL-002: worker.mdの## Context Handoff直前にEdit Completenessルールを挿入。部分適用によるimplementationフェーズの手戻りを防止する。
- PL-003: defs-stage4.tsのimplementationテンプレートに harness_capture_baseline 呼び出し指示を追加。テストベースライン未記録によるcode_reviewフェーズでの差し戻しを防止する。
- PL-004: defs-stage4.tsのcode_reviewテンプレートに harness_update_rtm_status 呼び出し指示を追加。RTM未更新によるDoDゲート不合格を防止する。
- PL-005: 3ファイルとも200行制限内に収まることを確認。coordinator.md: 38→52行、worker.md: 57→63行、defs-stage4.ts: 186→194行。
- PL-006: 挿入テキストに禁止語を含めない。確定した指示のみ記載する。

## artifacts

### File 1: .claude/agents/coordinator.md (38→52行)

挿入位置: ## Result Format の直前（27行目の空行の後）

old_string:
```
## Result Format
完了時は以下のフォーマットで報告:
```

new_string:
```
## Phase Output Rules
- decisions: 5件以上を `- ID:` リスト形式で記載すること（例: `- PL-001:`, `- DR-001:`）
- artifacts: フェーズ成果物を全て列挙すること。省略禁止。
- ファイル名はハイフン区切り（例: test-design.md）。アンダースコア禁止。
- design_reviewフェーズ: acDesignMapping セクション必須（AC-NとF-NNNの対応表）
- code_reviewフェーズ: acAchievementStatus セクション必須（AC-N達成状況テーブル）
- next: 次フェーズへの申し送り事項を記載。空欄禁止。

## Result Format
完了時は以下のフォーマットで報告:
```

### File 2: .claude/agents/worker.md (57→63行)

挿入位置: ## Context Handoff の直前（46行目の空行の後）

old_string:
```
## Context Handoff
- Read input from: prompt に指定されたファイルパス (coordinator の出力ファイル等)
```

new_string:
```
## Edit Completeness
- 指示されたEdit操作は全件適用すること。部分適用は禁止。
- 同一パターンの修正が8箇所以上ある場合、EditではなくWriteで全体書き換えを推奨。
- 適用完了後、指示件数と実行件数が一致することを確認して報告すること。

## Context Handoff
- Read input from: prompt に指定されたファイルパス (coordinator の出力ファイル等)
```

### File 3: workflow-harness/mcp-server/src/phases/defs-stage4.ts (186→194行)

#### Edit 3a: implementation テンプレート

old_string:
```
{BASH_CATEGORIES}
{EXIT_CODE_RULE}\`,
  },

  refactoring: {
```

new_string (implementationブロック内のもの):
```
実装完了後の必須手順
- 全テスト成功を確認した後、harness_capture_baseline でテストベースラインを記録すること
- ベースライン未記録の場合、後続フェーズで差し戻しとなる

{BASH_CATEGORIES}
{EXIT_CODE_RULE}\`,
  },

  refactoring: {
```

注意: このold_stringはimplementationブロック末尾のものを指す（82行目付近）。

#### Edit 3b: code_review テンプレート

old_string:
```
承認ゲートです。

{SUMMARY_SECTION}
```

new_string:
```
承認ゲートです。

レビュー完了後の必須手順
- 全ACが合格の場合、harness_update_rtm_status で全RTMエントリを verified に更新すること
- RTM未更新の場合、DoDゲートで不合格となる

{SUMMARY_SECTION}
```

## next

- implementationフェーズに進行
- 3ファイルへのEdit適用をworkerに委譲
- 各Edit適用後、行数が200行以下であることを検証
