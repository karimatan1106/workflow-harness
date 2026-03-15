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
    description: 'Delegate phase work to an isolated coordinator process (3-layer model). Phase-aware context injection: auto-selects allowedTools, disallowedTools, model, and system prompt from PHASE_REGISTRY (server-enforced, not overridable). Implementation/testing phases get Write,Edit,Bash; read-only phases get Agent,Read,Glob,Grep only. sessionToken/taskId propagated via env vars.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: {
          type: 'string',
          description: 'Active task ID.',
        },
        sessionToken: {
          type: 'string',
          description: 'Session token for validation.',
        },
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
        model: {
          type: 'string',
          description: 'Model override for the worker (e.g., sonnet, haiku, opus).',
        },
        addDirs: {
          type: 'array',
          items: { type: 'string' },
          description: 'Additional directories the worker can access.',
        },
        mcpConfig: {
          type: 'string',
          description: 'Path to .mcp.json for MCP server configuration. Default: auto-detected from project root.',
        },
      },
      required: ['taskId', 'sessionToken', 'instruction'],
    },
  },
];
