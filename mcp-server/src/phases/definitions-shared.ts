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

export const ARTIFACT_QUALITY_RULES = `**品質要件**
- セクション実質行≥5、密度≥30%、同一行3回以上繰り返し禁止
- 禁止語(コードフェンス外): TODO,TBD,WIP,FIXME,未定,未確定,要検討,検討中,対応予定,サンプル,ダミー,仮置き
- [#xxx#]形式禁止。禁止語は間接表現で言及`;

export const SUMMARY_SECTION_RULE = `**TOON成果物**
ファイル: \`{docsDir}/{phase}.toon\` — TOON形式(JSONより40-50%効率的)
★ .toonファイルに ## ヘッダーやMarkdownテーブルを絶対に書かないこと。key: value形式のみ使用。## を書くとパーサーエラーになる。

ルール: キー: 値 / カンマ・改行含む値のみ引用符 / 配列: \`名[N]{列1,列2}:\` +インデント行 / ネスト: インデント

必須: decisions[N≥5]{id,statement,rationale} / artifacts[N]{path,role,summary} / next(criticalDecisions,readFiles,warnings)
role: spec|design|test|impl|report|diagram。[N]は実数に置換。

IDプレフィックス: scope_definition=SD,research=R,impact_analysis=IA,requirements=REQ,threat_modeling=TM,planning=PL,state_machine=SM,flowchart=FC,ui_design=UID,design_review=DR,test_design=TD,test_selection=TS,code_review=CR,acceptance_verification=AV,manual_test=MT,security_scan=SS,performance_test=PT,e2e_test=E2E,health_observation=HO`;

// AGT-1: Subagent termination detection tag + return format
export const EXIT_CODE_RULE = `**完了時の戻り値(AGT-1)**
成果物全文は含めない。最後にTOONサマリーのみ出力:
成功: result{phase,status,artifact,lines}: {phase},complete,{docsDir}/{phase}.toon,行数 [EXIT_CODE: 0]
失敗: result{phase,status,error}: {phase},failed,エラー1行 [EXIT_CODE: 1]`;

export const PROCEDURE_ORDER_RULE = `**作業順序(必須)**
(1)入力ファイルをRead→(2)内容を分析→(3)成果物をWrite→(4)書いたファイルをReadして検証Read→(5)結果報告`;

export function bashCategoryHelp(categories: string[]): string {
  const defs: Record<string, string> = {
    readonly: 'ls,pwd,cat,head,tail,grep,find,wc,git status/log/diff/show',
    testing: 'npm test,npx vitest/jest/playwright,pytest',
    implementation: 'npm install,npm run build,mkdir,rm,git add/commit',
    git: 'git add/commit/push/tag',
    security: 'npm audit,semgrep,npx snyk,trivy,gitleaks',
  };
  return `**Bash制限**\n許可: ${categories.map(c => `${c}(${defs[c] ?? '?'})`).join(' / ')}\n他はRead/Write/Edit/Glob/Grep使用。`;
}
