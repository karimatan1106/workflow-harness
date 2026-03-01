/**
 * Shared types, constants, and helpers for phase definitions
 * @spec docs/spec/features/workflow-harness.md
 */

import type { PhaseName } from '../state/types.js';

// ─── Phase Definition ────────────────────────────

export interface PhaseDefinition {
  description: string;
  subagentTemplate: string;
  model: 'opus' | 'sonnet' | 'haiku';
  bashCategories: string[];
  inputFiles: string[];
  outputFile: string | null;
  requiredSections: string[];
  minLines: number;
}

// Suppress unused import warning - PhaseName is used by stage files via re-export
export type { PhaseName };

// ─── Shared Template Fragments ───────────────────

export const ARTIFACT_QUALITY_RULES = `## 成果物品質要件
- 各セクション（## 見出し）内に最低5行の実質行を含めること
- セクション密度（実質行/総行）は30%以上を維持すること
- 同一行の3回以上繰り返し禁止
- 禁止パターン（12語）: コードフェンス外への記載禁止
  英語: TODO, TBD, WIP, FIXME
  日本語: 未定, 未確定, 要検討, 検討中, 対応予定, サンプル, ダミー, 仮置き
- 角括弧プレースホルダー [#xxx#] 形式禁止
- 禁止語への言及は間接表現を使用すること`;

export const SUMMARY_SECTION_RULE = `## TOON形式成果物（必須）
成果物はTOON形式で作成すること。ファイル: \`{docsDir}/{phase}.toon\`

TOONはJSONより40-50%トークン効率が高い構造化形式。

### TOON形式ルール
- キー: 値（スカラー）— 例: \`phase: research\`
- 文字列値にカンマ・改行を含む場合のみ引用符で囲む — 例: \`ts: "2026-03-01T10:00:00Z"\`
- 配列テーブル: \`フィールド名[要素数]{列1,列2,...}:\` の後、インデント行で各行をカンマ区切り
- ネスト: インデントでオブジェクトをネスト（\`next:\` の下にインデントで子キー）

### 必須フィールド（decisions・artifacts・next）
decisions[] に最低5エントリが必要。各エントリはid・statement・rationaleを含む。

\`\`\`
phase: {phase}
taskId: {taskId}
ts: "作成時のISO8601タイムスタンプ"
decisions[N]{id,statement,rationale}:
  F-001,決定内容を1文で,その理由
  F-002,別の決定内容,別の理由
artifacts[N]{path,role,summary}:
  出力ファイルのパス,spec,1文要約
next:
  criticalDecisions[N]: F-001,F-002
  readFiles[N]: 次フェーズが読むべきファイルパス
  warnings[N]: 次フェーズへの注意事項
\`\`\`

注意: 上記の[N]は実際の要素数に置き換えること。roleはspec|design|test|impl|report|diagramから選択。

### IDプレフィックス規則
| フェーズ | プレフィックス |
|---------|--------------|
| scope_definition | SD |
| research | R |
| impact_analysis | IA |
| requirements | REQ |
| threat_modeling | TM |
| planning | PL |
| state_machine | SM |
| flowchart | FC |
| ui_design | UID |
| design_review | DR |
| test_design | TD |
| test_selection | TS |
| code_review | CR |
| acceptance_verification | AV |
| manual_test | MT |
| security_scan | SS |
| performance_test | PT |
| e2e_test | E2E |
| health_observation | HO |`;

// AGT-1: Subagent termination detection tag
export const EXIT_CODE_RULE = `## ★重要★ 完了時の終了タグ (AGT-1)
全ての作業完了時、最後のメッセージに以下のタグを含めること:
[EXIT_CODE: 0]
エラーで終了する場合: [EXIT_CODE: 1]
このタグにより、Orchestratorはsubagentの正常終了を検出できる。`;

export function bashCategoryHelp(categories: string[]): string {
  const defs: Record<string, string> = {
    readonly: 'ls, pwd, cat, head, tail, grep, find, wc, git status/log/diff/show, npm list, node --version',
    testing: 'npm test, npx vitest, npx jest, npx playwright test, pytest',
    implementation: 'npm install, pnpm add, npm run build, mkdir, rm, git add, git commit',
    git: 'git add, git commit, git push, git tag',
    security: 'npm audit, npx audit-ci, detect-secrets, semgrep, npx snyk, trivy, gitleaks',
  };
  const lines = categories.map(c => `- ${c}: ${defs[c] ?? '(unknown)'}`);
  return `## Bashコマンド制限\n許可カテゴリ: ${categories.join(', ')}\n${lines.join('\n')}\n上記以外はブロックされます。Read/Write/Edit/Glob/Grep等の専用ツールを使用してください。`;
}
