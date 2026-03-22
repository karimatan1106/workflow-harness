/**
 * MCP Tool Definitions (part 1): harness_start through harness_add_rtm.
 * @spec docs/spec/features/workflow-harness.md
 */

export const TOOL_DEFS_A = [
  {
    name: 'harness_start',
    description: 'Create task, returns taskId+sessionToken.',
    inputSchema: {
      type: 'object',
      properties: {
        taskName: { type: 'string', description: 'Task name.' },
        userIntent: { type: 'string', description: 'Intent (min 20 chars).', minLength: 20 },
        files: { type: 'array', items: { type: 'string' }, description: 'Scope files.' },
        dirs: { type: 'array', items: { type: 'string' }, description: 'Scope dirs.' },
        size: { type: 'string', enum: ['small', 'medium', 'large'], description: 'Task size. Default: large.' },
      },
      required: ['taskName', 'userIntent'],
    },
  },
  {
    name: 'harness_status',
    description: 'Get task state. Omit taskId to list all.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (omit=list all).' },
        verbose: { type: 'boolean', description: 'Return all fields. Default: false (core only).' },
      },
      required: [],
    },
  },
  {
    name: 'harness_next',
    description: 'Run DoD checks and advance phase.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        sessionToken: { type: 'string', description: 'Session token.' },
        forceTransition: { type: 'boolean', description: 'Skip DoD checks. Default: false.' },
        retryCount: { type: 'number', description: 'Retry attempt #. Default: 1.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_approve',
    description: 'Approve at gate phase.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        type: { type: 'string', enum: ['requirements', 'design', 'test_design', 'code_review', 'acceptance'], description: 'Gate type.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'type', 'sessionToken'],
    },
  },
  {
    name: 'harness_set_scope',
    description: 'Set/update scope files, dirs, glob.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        files: { type: 'array', items: { type: 'string' }, description: 'File paths.' },
        dirs: { type: 'array', items: { type: 'string' }, description: 'Dir paths.' },
        glob: { type: 'string', description: 'Glob pattern.' },
        addMode: { type: 'boolean', description: 'Merge mode. Default: false.' },
        projectTraits: {
          type: 'object', description: 'Project trait flags for dynamic doc categories.',
          properties: {
            hasUI: { type: 'boolean' }, hasAPI: { type: 'boolean' }, hasDB: { type: 'boolean' },
            hasEvents: { type: 'boolean' }, hasI18n: { type: 'boolean' }, hasDesignSystem: { type: 'boolean' },
          },
        },
        docPaths: { type: 'array', items: { type: 'string' }, description: 'Existing project document paths discovered during scope_definition.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_complete_sub',
    description: 'DoD check + mark parallel sub-phase done.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        subPhase: { type: 'string', description: 'Sub-phase name.' },
        sessionToken: { type: 'string', description: 'Session token.' },
        retryCount: { type: 'number', description: 'Retry attempt #. Default: 1.' },
      },
      required: ['taskId', 'subPhase', 'sessionToken'],
    },
  },
  {
    name: 'harness_back',
    description: 'Roll back to earlier phase.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        targetPhase: { type: 'string', description: 'Target phase.' },
        reason: { type: 'string', description: 'Reason.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'targetPhase', 'sessionToken'],
    },
  },
  {
    name: 'harness_reset',
    description: 'Reset task to scope_definition.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        reason: { type: 'string', description: 'Reason.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_record_proof',
    description: 'Record L1-L4 proof entry.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        level: { type: 'string', enum: ['L1', 'L2', 'L3', 'L4'], description: 'Level.' },
        check: { type: 'string', description: 'Check name.' },
        result: { type: 'boolean', description: 'Passed?' },
        evidence: { type: 'string', description: 'Evidence.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'level', 'check', 'result', 'evidence', 'sessionToken'],
    },
  },
  {
    name: 'harness_add_ac',
    description: 'Add acceptance criterion.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        id: { type: 'string', description: 'AC-N id.' },
        description: { type: 'string', description: 'Description.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'id', 'description', 'sessionToken'],
    },
  },
  {
    name: 'harness_add_rtm',
    description: 'Add RTM entry (F-NNN).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        id: { type: 'string', description: 'F-NNN id.' },
        requirement: { type: 'string', description: 'Requirement.' },
        designRef: { type: 'string', description: 'Design ref.' },
        codeRef: { type: 'string', description: 'Code ref.' },
        testRef: { type: 'string', description: 'Test ref.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'id', 'requirement', 'sessionToken'],
    },
  },
];
