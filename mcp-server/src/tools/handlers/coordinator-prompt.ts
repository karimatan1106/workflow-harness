/**
 * coordinator-prompt.ts - System prompt, allowed tools, and CLI args builder
 * for coordinator subprocess.
 */

import type { TaskState } from '../../state/types.js';
import { buildPhaseGuide } from '../handler-shared.js';

export type PhaseGuide = ReturnType<typeof buildPhaseGuide>;

/**
 * Build --allowedTools list for the coordinator subprocess.
 * Includes Agent Teams tools because coordinators (L2) manage teams:
 *   Agent (spawn L3 workers), TeamCreate/TeamDelete (team lifecycle),
 *   TaskCreate/TaskUpdate/TaskList/TaskGet (progress tracking),
 *   SendMessage (intra-team communication), ToolSearch (deferred tools).
 * This differs from writeAllowedToolsFile (manager-lifecycle.ts) which writes
 * .worker-allowed-tools for direct subagents - those do NOT get Agent because
 * workers should not spawn further subagents.
 */
export function buildAllowedTools(phaseGuide: PhaseGuide): string {
  const coordinatorBase = [
    'Agent', 'TeamCreate', 'TeamDelete',
    'TaskCreate', 'TaskUpdate', 'TaskList', 'TaskGet',
    'SendMessage', 'ToolSearch', 'Read', 'Glob', 'Grep', 'Bash',
  ];
  const phaseTools = (phaseGuide as PhaseGuide & { allowedTools?: string[] }).allowedTools ?? [];
  const merged = new Set([...coordinatorBase, ...phaseTools]);
  return [...merged].join(',');
}

/** Build the system prompt for a coordinator subprocess. */
export function buildCoordinatorPrompt(task: TaskState, pg: PhaseGuide): string {
  const lines: string[] = [
    'role: coordinator',
    `phase: ${task.phase}`,
    `docs-dir: ${task.docsDir}`,
    `allowed-extensions: ${pg.allowedExtensions.join(', ')}`,
    `output-file: ${task.docsDir}/${task.phase}.md`,
    'toon-rules: "key: value形式。カンマ含む値は引用符。バックスラッシュ禁止。ファイル名はハイフン区切り"',
    'instruction-format: "TOON形式で受信。key: valueペアをパースして作業内容を理解すること"',
    'env-vars: "HARNESS_TASK_ID, HARNESS_SESSION_TOKENは環境変数から取得"',
    'worker-delegation: "ファイル書き込みが必要な場合、Bashで HARNESS_LAYER=worker claude -p \'<指示>\' --print --permission-mode bypassPermissions を実行しworkerを起動すること。Agent toolのsubagentはcoordinator権限を継承するためdocs/workflows/への書き込みにはworkerが必要"',
    'team-management: "TeamCreateでチームを作成し、Agentでworkerをspawn。TaskCreateで進捗管理。workerにはSendMessageで指示"',
    'output-format: "作業結果をTOON形式で返すこと。success: true/false, output: 作業内容, files-changed: 変更ファイル一覧"',
    'output-rule: "Agent toolの結果を受け取ったら、必ず最終テキストとして結果をまとめて出力すること。ツール呼び出しだけで終了しないこと"',
  ];
  return lines.join('\n');
}

export interface CmdArgsOptions {
  fullInstruction: string;
  allowedTools: string;
  disallowedTools: string;
  systemPrompt: string;
  model: string | null;
  mcpConfig: string | undefined;
  addDirs: string[] | undefined;
}

/** Build the claude CLI argument list for spawning a coordinator. */
export function buildCmdArgs(opts: CmdArgsOptions): string[] {
  const cmdArgs: string[] = [
    '-p', opts.fullInstruction,
    '--print', '--verbose',
    '--output-format', 'stream-json',
    '--setting-sources', 'project',
    '--disable-slash-commands',
    '--allowedTools', opts.allowedTools,
    '--permission-mode', 'bypassPermissions',
    '--no-session-persistence',
    '--system-prompt', opts.systemPrompt,
  ];
  if (opts.disallowedTools) {
    cmdArgs.push('--disallowedTools', opts.disallowedTools);
  }
  if (opts.mcpConfig) {
    cmdArgs.push('--mcp-config', opts.mcpConfig);
  }
  if (opts.model) {
    cmdArgs.push('--model', opts.model);
  }
  if (opts.addDirs?.length) {
    for (const dir of opts.addDirs) {
      cmdArgs.push('--add-dir', dir);
    }
  }
  return cmdArgs;
}
