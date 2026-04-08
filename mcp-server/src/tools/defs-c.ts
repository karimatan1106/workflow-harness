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
];
