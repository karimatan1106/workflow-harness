/**
 * MCP Tool Definitions (part 3): DCI (Design-Code Index) tools.
 * @spec docs/spec/features/workflow-harness.md
 */

export const TOOL_DEFS_C = [
  {
    name: 'dci_build_index',
    description: 'Scan project for @spec comments and build design-code index.',
    inputSchema: {
      type: 'object',
      properties: {
        projectRoot: { type: 'string', description: 'Project root directory. Default: cwd.' },
      },
      required: [],
    },
  },
  {
    name: 'dci_query_docs',
    description: 'Query related design docs for a code file.',
    inputSchema: {
      type: 'object',
      properties: {
        filePath: { type: 'string', description: 'Relative code file path (e.g. src/auth/jwt.ts).' },
      },
      required: ['filePath'],
    },
  },
  {
    name: 'dci_query_files',
    description: 'Query implementation files for a design doc.',
    inputSchema: {
      type: 'object',
      properties: {
        docPath: { type: 'string', description: 'Relative design doc path (e.g. docs/spec/features/auth.md).' },
      },
      required: ['docPath'],
    },
  },
  {
    name: 'dci_validate',
    description: 'Validate index: find orphan code/docs and broken links.',
    inputSchema: {
      type: 'object',
      properties: {},
      required: [],
    },
  },
  {
    name: 'harness_delegate_work',
    description: 'Spawn isolated claude -p worker for file operations. Worker runs with fresh context (no CLAUDE.md, no hooks, no MCP). Use for implementation, editing, and file creation tasks that benefit from context isolation.',
    inputSchema: {
      type: 'object',
      properties: {
        instruction: {
          type: 'string',
          description: 'Task instruction for the worker. Be specific about file paths and expected changes.',
          minLength: 10,
        },
        files: {
          type: 'array',
          items: { type: 'string' },
          description: 'List of file paths the worker will operate on (informational, not enforced).',
        },
        allowedTools: {
          type: 'string',
          description: 'Comma-separated tool whitelist for the worker. Default: Read,Edit,Write,Bash,Glob,Grep',
        },
        systemPrompt: {
          type: 'string',
          description: 'Custom system prompt for the worker. Default: minimal worker prompt.',
        },
        model: {
          type: 'string',
          description: 'Model override for the worker (e.g., sonnet, haiku, opus).',
        },
        addDirs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional directories the worker can access.',
        },
      },
      required: ['instruction'],
    },
  },
];
