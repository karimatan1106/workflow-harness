# subagentプロンプト自動生成 - 調査結果

## サマリー

このタスクの目的はPhaseGuideの構造化データからsubagentプロンプトを自動生成する仕組みを実装することである。

現在の問題点として、subagentTemplateは手書きされた固定文字列であり、PhaseGuideに含まれる構造化データ（outputFile, inputFiles, requiredSections, minLines, allowedBashCategories等）やグローバル品質ルール（禁止パターン、重複行検出、セクション密度等）がsubagentに適切に伝わっていない。

主要な決定事項としては、buildPrompt()関数を新規実装してPhaseGuide、グローバル品質ルール、Bashホワイトリストを統合し、完全なsubagentプロンプトを自動生成することが有効である。

次フェーズで必要な情報は、buildPrompt()関数の詳細設計、GlobalRules型の定義体系、PhaseGuide型の拡張ポイント、リトライプロンプト生成の仕組みである。

このタスクの影響範囲は workflow-plugin/mcp-server/src/phases/ 配下のファイル群であり、特に definitions.ts と types.ts の大規模な変更を伴う。

## 調査結果

### 1. 現在のsubagentTemplate生成フロー

PhaseGuide型（types.ts 371-404行目）のsubagentTemplateフィールドにハードコードされた固定文字列が各フェーズに配置されている（definitions.ts 547行目以降）。resolvePhaseGuide関数（definitions.ts 900-1005行目）が${docsDir}と${userIntent}のプレースホルダーを置換するが、それ以外の情報（Bashコマンド制限、禁止パターン、品質要件等）は一切含まれていない。

resolvePhaseGuide()の呼び出し元はstatus.ts（タスク状態取得時）であり、StatusResult.phaseGuideとしてOrchestrator/subagentに返される。

### 2. グローバル品質ルールの定義場所

artifact-validator.tsに定義されている主要ルール:
- 禁止パターン12種（262-275行目）: artifact-validator.ts内に定義された英語4種・日本語8種の計12個の禁止パターン
- 角括弧プレースホルダー（281行目）: artifact-validator.ts内に正規表現パターンが定義されており、特定の許可キーワード（関連、参考、注、例、出典）を除外した形で角括弧の不適切な使用を検出
- 重複行検出（300-327行目）: 閾値3回以上、isStructuralLine()で構造要素除外
- セクション密度（645-730行目）: 最小30%、各セクション最小5実質行
- サマリーセクション（856-897行目）: 最大200行
- 短い行比率（742-770行目）: 10文字未満が50%超でエラー
- テストファイル品質（908-948行目）: アサーション必須、テストケース3件以上推奨
- キーワードトレーサビリティ（1072-1155行目）: 80%カバレッジ閾値

### 3. Bashホワイトリスト定義

bash-whitelist.js 35-92行目に定義:
- readonly: ls, cat, head, tail, less, more, wc, file, find, grep, rg, ag, git status/log/diff/show/branch/ls-files/ls-tree/rev-parse/remote, pwd, which, whereis, date, uname, whoami, echo, node -e, mkdir -p（制限付き）
- testing: npm test, npm run test, npx vitest/jest/mocha/ava, npx tsc --noEmit, npx eslint, npx prettier --check, npm run lint/type-check, node
- implementation: npm install/ci, pnpm install/add, yarn install, npm run build, npx tsc/webpack/vite build, mkdir, node
- git: git add/commit/push/pull/fetch, git checkout --, git restore, rm -f

### 4. PhaseGuide型の既存フィールド

types.ts 371-404行目のPhaseGuide interfaceに含まれるフィールド:
- phaseName, description: 基本情報（定義済み）
- requiredSections: 必須セクション名リスト（定義済みだがテンプレートに反映されていない）
- outputFile: 出力ファイルパス（テンプレートに部分的に含まれる）
- inputFiles: 入力ファイルパスリスト（テンプレートに部分的に含まれる）
- inputFileMetadata: 重要度とreadMode（テンプレートに反映されていない）
- allowedBashCategories: 許可カテゴリ（テンプレートに反映されていない）
- editableFileTypes: 編集可能ファイル拡張子リスト（テンプレートに反映されていない）
- minLines: 最低行数（テンプレートに反映されていない）
- subagentType, model: subagent設定（直接Task toolに渡される）
- subagentTemplate: 手書きテンプレート文字列（現在のプロンプトの源）
- checklist: 存在しない（新規追加が必要）

### 5. 不整合の発見

PHASE_ARTIFACT_REQUIREMENTS（artifact-validator.ts 118-190行目）とPHASE_GUIDES（definitions.ts）のrequiredSectionsに差異がある。バリデータ側は多言語対応のセクション名を使用しており、日本語と英語の両言語サポートがされている。

implementationフェーズでPhaseGuide.editableFileTypesが全拡張子の許可を示す設定となっているが、phase-edit-guard.jsのPHASE_RULESではテストファイルが編集禁止として指定されている。この矛盾は、ファイル拡張子レベルの制御ではなくファイルパスパターンレベルでの制御が実際に行われていることを示唆している。

## 既存実装の分析

### 現在のアーキテクチャ

```
PHASE_GUIDES定数 → resolvePhaseGuide() → phaseGuide.subagentTemplate
                                           ↑ 手書き文字列（ルール欠落）
```

### 目標アーキテクチャ

```
PHASE_GUIDES定数 ─┐
グローバル品質ルール ─┤→ buildPrompt() → 完全なsubagentプロンプト
Bashホワイトリスト ──┤    （全ルール自動埋め込み）
フェーズ別checklist ─┘
```

### 実装推奨構造

buildPrompt()関数が以下を自動組み立て:
1. フェーズ名とタスク情報（userIntent, docsDir）
2. 入力ファイルリスト（inputFileMetadata付き）
3. 出力ファイルパス
4. 必須セクションリスト
5. 最低行数要件
6. Bashコマンド許可リスト（カテゴリ展開済み）
7. グローバル品質ルール全文
8. フェーズ固有チェックリスト

GlobalRules型（新規定義）に以下を含む:
- forbiddenPatterns: 禁止パターン12種
- bracketPlaceholderRegex: 角括弧検出正規表現と許可パターン
- duplicateLineThreshold: 3回
- minSectionDensity: 0.3
- minSectionLines: 5
- maxSummaryLines: 200
- shortLineMaxRatio: 0.5
- bashWhitelistCategories: Record型のカテゴリ別コマンドリスト
