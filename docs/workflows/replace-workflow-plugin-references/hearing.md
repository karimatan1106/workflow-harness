phase: hearing
status: complete
summary: workflow-plugin 全参照を workflow-harness に置換、LLM 誤実行と利用者誤認を解消
userResponse: User explicit: 全部正しく修正だけでいい、複雑な分類不要

## intent-analysis
- surfaceRequest: stale workflow-plugin 参照の置換
- deepNeed: LLM が wrong path で build 試行を防ぎ、利用者が別パッケージと勘違いするリスク解消
- rootCause: rename 時に doc 側の更新が漏れた

## implementation-plan
- approach: 7 ファイル + 1 ファイル名で path/言及を workflow-harness に置換、必要なら rename
- estimatedScope: 8 ファイル、~30-50 lines edit、3 file rename 想定
- risks: file rename で git history が壊れないよう git mv 使用

## decisions
- D-HR-1: ファイル名 rename は git mv で履歴保持 (rename 検知のため)
- D-HR-2: history 記述「旧 workflow-plugin」は文脈判断で残す (完全削除は混乱の元)
- D-HR-3: scope 7 ファイル + 3 ファイル名 rename で 1 タスク完結

## artifacts
- docs/workflows/replace-workflow-plugin-references/hearing.md (本書)
- 8 target files (scope 内)

## next
- criticalDecisions: scope_definition で実際の grep 結果と置換箇所を確定
- readFiles: 8 target files
- warnings: file rename は git mv 必須、placeholder 形式禁止
