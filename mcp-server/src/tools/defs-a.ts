/**
 * MCP Tool Definitions (part 1): harness_start through harness_add_rtm.
 * @spec docs/spec/features/workflow-harness.md
 */

export const TOOL_DEFS_A = [
  {
    name: 'harness_start',
    description: 'Start a new workflow task and return the initial task state.',
    inputSchema: {
      type: 'object',
      properties: {
        taskName: { type: 'string', description: 'Name of the task to start.' },
        userIntent: { type: 'string', description: 'User intent description (minimum 20 characters).', minLength: 20 },
        files: { type: 'array', items: { type: 'string' }, description: 'Initial list of files in scope.' },
        dirs: { type: 'array', items: { type: 'string' }, description: 'Initial list of directories in scope.' },
      },
      required: ['taskName', 'userIntent'],
    },
  },
  {
    name: 'harness_status',
    description: 'Get task status. If taskId is omitted, lists all active tasks.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to query. Omit to list all tasks.' },
      },
      required: [],
    },
  },
  {
    name: 'harness_next',
    description: 'Advance the task to the next phase after running DoD checks.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID to advance.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
        forceTransition: { type: 'boolean', description: 'Force transition even when baseline is not set (for new projects). Default: false.' },
        retryCount: { type: 'number', description: 'Current retry attempt number (for model escalation logic). Default: 1.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_approve',
    description: 'Approve at a gate phase (requirements, design, code_review, acceptance).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        type: { type: 'string', enum: ['requirements', 'design', 'test_design', 'code_review', 'acceptance'], description: 'Approval gate type.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'type', 'sessionToken'],
    },
  },
  {
    name: 'harness_set_scope',
    description: 'Set or update the affected files, directories, and glob pattern for a task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        files: { type: 'array', items: { type: 'string' }, description: 'List of affected file paths.' },
        dirs: { type: 'array', items: { type: 'string' }, description: 'List of affected directory paths.' },
        glob: { type: 'string', description: 'Glob pattern for affected files (optional).' },
        addMode: { type: 'boolean', description: 'If true, merge with existing scope instead of replacing. Default: false.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_complete_sub',
    description: 'Run DoD checks for a sub-phase artifact, then mark it complete within a parallel phase group.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        subPhase: { type: 'string', description: 'Name of the sub-phase to mark complete.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
        retryCount: { type: 'number', description: 'Current retry attempt number (for Reflector learning). Default: 1.' },
      },
      required: ['taskId', 'subPhase', 'sessionToken'],
    },
  },
  {
    name: 'harness_back',
    description: 'Move the task back to an earlier phase.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        targetPhase: { type: 'string', description: 'Target phase name to roll back to.' },
        reason: { type: 'string', description: 'Reason for rolling back (optional).' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'targetPhase', 'sessionToken'],
    },
  },
  {
    name: 'harness_reset',
    description: 'Reset the task to scope_definition phase.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        reason: { type: 'string', description: 'Reason for resetting (optional).' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_record_proof',
    description: 'Record a proof entry (L1-L4 control level check result).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        level: { type: 'string', enum: ['L1', 'L2', 'L3', 'L4'], description: 'Control level of the check.' },
        check: { type: 'string', description: 'Name or description of the check.' },
        result: { type: 'boolean', description: 'Whether the check passed.' },
        evidence: { type: 'string', description: 'Evidence or details supporting the result.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'level', 'check', 'result', 'evidence', 'sessionToken'],
    },
  },
  {
    name: 'harness_add_ac',
    description: 'Add an acceptance criterion to the task.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        id: { type: 'string', description: 'Acceptance criterion identifier (e.g. AC-1).' },
        description: { type: 'string', description: 'Description of the acceptance criterion.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'id', 'description', 'sessionToken'],
    },
  },
  {
    name: 'harness_add_rtm',
    description: 'Add a Requirements Traceability Matrix (RTM) entry.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        id: { type: 'string', description: 'RTM entry identifier (e.g. F-001).' },
        requirement: { type: 'string', description: 'Requirement description.' },
        designRef: { type: 'string', description: 'Reference to design artifact.' },
        codeRef: { type: 'string', description: 'Reference to code artifact.' },
        testRef: { type: 'string', description: 'Reference to test artifact.' },
        sessionToken: { type: 'string', description: 'Session token for authentication.' },
      },
      required: ['taskId', 'id', 'requirement', 'sessionToken'],
    },
  },
];
