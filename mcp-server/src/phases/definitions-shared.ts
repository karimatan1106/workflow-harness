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

export const ARTIFACT_QUALITY_RULES = `品質要件
- セクション実質行≥5、密度≥30%、同一行3回以上繰り返し禁止
- 各行の内容をユニークにすること（同一内容の行は最大2回まで。3回以上出現でDoD L4失敗）
- 禁止語(コードフェンス外): TODO,TBD,WIP,FIXME,未定,未確定,要検討,検討中,対応予定,サンプル,ダミー,仮置き
- [#xxx#]形式禁止。禁止語は間接表現で言及`;

export const SUMMARY_SECTION_RULE = `成果物
ファイル: \`{docsDir}/{phase}.md\` — Markdown形式(## H2 セクション + テーブル)
★ TOON 構文（\`name[N]{col1,col2}:\` 形式やカンマ区切り行）で書かないこと。Markdown のテーブル/リスト/ヘッダーで表現すること。

出力例:
# scope_definition

## decisions

| id | statement | rationale |
|----|-----------|-----------|
| SD-1 | REST APIを採用 | 既存インフラとの互換性 |
| SD-2 | TypeScript使用 | 型安全性の確保 |

## artifacts

| path | role | summary |
|------|------|---------|
| docs/workflows/task/scope-definition.md | spec | スコープ定義 |

## next

### criticalDecisions
<重要判断のサマリー>

### readFiles
<次フェーズで読むべきファイル>

### warnings
<注意点>

ルール:
- メタ情報（task / status / inputArtifact 等）は文書冒頭の箇条書きで表現
- 配列セクションは \`## <name>\` H2 + Markdown table（ヘッダー行 + 区切り行 + データ行）
- ネスト構造は H3（### subname）またはインデント箇条書き
- セクション順序: 冒頭メタ→各種テーブル→decisions→artifacts→next

必須セクション: \`## decisions\`（最低 5 行のテーブル / id,statement,rationale 列）/ \`## artifacts\`（path,role,summary 列）/ \`## next\`（criticalDecisions, readFiles, warnings の H3 サブセクション）
role 値: spec|design|test|impl|report|diagram。

IDプレフィックス: scope_definition=SD,research=R,impact_analysis=IA,requirements=REQ,threat_modeling=TM,planning=PL,state_machine=SM,flowchart=FC,ui_design=UID,design_review=DR,test_design=TD,test_selection=TS,code_review=CR,acceptance_verification=AV,manual_test=MT,security_scan=SS,performance_test=PT,e2e_test=E2E,health_observation=HO,hearing=H`;

// Refactoring methodology — referenced by refactoring phase template
export const REFACTORING_STRATEGY = `リファクタリング方針（優先順に実施）
★ 分割は最後の手段。先に1〜4を実施すれば分割の必要量は激減する。
★ 可読性は行数制限より優先。1行に複数文を詰め込む圧縮は禁止。超過時は責務分割で対応。

1. 削除: 未使用コード・デッドコードを除去。呼び出し元のないファイル/関数を特定。
2. 正規化: 複数ファイル横断の重複パターンを shared/ に抽出。設定読込・バリデーション・エラー処理・ログ等。
3. インターフェース設計: 抽出モジュールの公開APIを最小化。型で契約を定義。index.ts re-exportのみ公開。
4. 階層化: 依存方向を一方向に整理（entry→logic→data）。循環依存=設計ミス。
5. 構造化: 関連ファイルをモジュール境界でディレクトリ整理。
6. 分割: 上記5つでまだ200行超のファイルのみ物理分割。

漸進ルール: 各ステップでテストが通る状態を維持。ビッグバン置換禁止。`;

// AGT-1: Subagent termination detection tag + structured return format
export const EXIT_CODE_RULE = `完了時の戻り値(AGT-1)
成果物全文は含めない。最後に構造化サマリーのみ出力:

**完了報告**:
\`result{phase,status,artifact,lines,summary,nextAction}: {phase},complete,{docsDir}/{phase}.md,行数,"1行サマリー","L1の次の1行" [EXIT_CODE: 0]\`

**失敗報告**:
\`result{phase,status,error,nextAction}: {phase},failed,"エラー1行","推奨対処1行" [EXIT_CODE: 1]\`

summary: LLM可読1行 (50文字以内)。nextAction: L1 が即座に次に取るべき1行アクション (例: "harness_next を呼ぶ" / "user 承認確認" / "worker X に再委譲")。
result block 自体はインラインコード（バッククォート）として記載してよい。`;

export const PROCEDURE_ORDER_RULE = `作業順序(必須)
(1)入力ファイルをRead→(2)内容を分析→(3)成果物をWrite→(4)書いたファイルをReadして検証Read→(5)結果報告`;

export function bashCategoryHelp(categories: string[]): string {
  const defs: Record<string, string> = {
    readonly: 'ls,pwd,cat,head,tail,grep,find,wc,git status/log/diff/show',
    testing: 'npm test,npx vitest/jest/playwright,pytest',
    implementation: 'npm install,npm run build,mkdir,rm,git add/commit',
    git: 'git add/commit/push/tag',
    security: 'npm audit,semgrep,npx snyk,trivy,gitleaks',
  };
  return `Bash制限\n許可: ${categories.map(c => `${c}(${defs[c] ?? '?'})`).join(' / ')}\n他はRead/Write/Edit/Glob/Grep使用。`;
}

// ─── Dynamic Doc Categories ─────────────────────

import { readFileSync } from 'node:fs';
import { join } from 'node:path';

const DEFAULT_TRAIT_CATEGORIES: Record<string, string[]> = {
  hasUI: ['docs/spec/screens/', 'docs/spec/wireframes/', 'docs/spec/components/', 'docs/spec/interactions/', 'docs/spec/responsive/', 'docs/spec/accessibility/'],
  hasAPI: ['docs/spec/api/'],
  hasDB: ['docs/spec/database/'],
  hasEvents: ['docs/spec/events/', 'docs/spec/messages/'],
  hasI18n: ['docs/spec/i18n/', 'docs/spec/seo/', 'docs/spec/sitemap.md'],
  hasDesignSystem: ['docs/spec/design-system/', 'docs/spec/components/'],
};

export function loadTraitCategories(configDir?: string): Record<string, string[]> {
  try {
    const p = join(configDir ?? '.', '.harness.json');
    const parsed = JSON.parse(readFileSync(p, 'utf8'));
    if (parsed.traitCategories && typeof parsed.traitCategories === 'object') return parsed.traitCategories;
  } catch { /* fallback */ }
  return DEFAULT_TRAIT_CATEGORIES;
}

const FALLBACK_ITEMS = [
  'docs/architecture/overview.md -- システム概要の更新',
  'docs/operations/ -- environments/deployment/monitoring/runbooks配下の運用ドキュメント更新',
  'CHANGELOG.md -- 変更履歴の追記',
  'README.md -- プロジェクト概要の更新',
  'docs/workflows/ -- 永続パスへの反映',
];

export function buildDocCategories(traits?: Record<string, boolean>, docPaths?: string[]): string {
  const lines = FALLBACK_ITEMS.map((item, i) => `${i + 1}. ${item}`);
  const seen = new Set<string>();
  for (const item of FALLBACK_ITEMS) seen.add(item.split(' -- ')[0]);
  if (traits && typeof traits === 'object') {
    for (const [flag, cats] of Object.entries(loadTraitCategories())) {
      if (traits[flag]) {
        for (const cat of cats) {
          if (!seen.has(cat)) { seen.add(cat); lines.push(`${lines.length + 1}. ${cat}`); }
        }
      }
    }
  }
  if (docPaths && docPaths.length > 0) {
    for (const dp of docPaths) {
      if (!seen.has(dp)) { seen.add(dp); lines.push(`${lines.length + 1}. ${dp} -- 既存プロジェクトドキュメント`); }
    }
  }
  return lines.join('\n');
}
