/**
 * MCP Tool Definitions (part 2): harness_record_feedback through harness_update_rtm_status.
 * @spec docs/spec/features/workflow-harness.md
 */

export const TOOL_DEFS_B = [
  {
    name: 'harness_record_feedback',
    description: 'Append feedback to userIntent.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        feedback: { type: 'string', description: 'Feedback text.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'feedback', 'sessionToken'],
    },
  },
  {
    name: 'harness_capture_baseline',
    description: 'Record pre-change test baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        totalTests: { type: 'number', description: 'Total tests.' },
        passedTests: { type: 'number', description: 'Passing tests.' },
        failedTests: { type: 'array', items: { type: 'string' }, description: 'Pre-failing test names.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'totalTests', 'passedTests', 'failedTests', 'sessionToken'],
    },
  },
  {
    name: 'harness_record_test_result',
    description: 'Record test execution result.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        exitCode: { type: 'number', description: '0=success.' },
        output: { type: 'string', description: 'Test output (min 50 chars).', minLength: 50 },
        summary: { type: 'string', description: 'Short summary.' },
        failedTests: { type: 'array', items: { type: 'string' }, description: 'Names of failed tests (for regression gate).' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'exitCode', 'output', 'sessionToken'],
    },
  },
  {
    name: 'harness_record_test',
    description: 'Register test file path.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        testFile: { type: 'string', description: 'Test file path.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'testFile', 'sessionToken'],
    },
  },
  {
    name: 'harness_get_test_info',
    description: 'Get test files and baseline.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'harness_record_known_bug',
    description: 'Record known bug (not caused by current change).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        testName: { type: 'string', description: 'Failing test name.' },
        description: { type: 'string', description: 'Bug description.' },
        severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Severity.' },
        targetPhase: { type: 'string', description: 'Fix timing.' },
        issueUrl: { type: 'string', description: 'Issue URL.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'testName', 'description', 'severity', 'sessionToken'],
    },
  },
  {
    name: 'harness_get_known_bugs',
    description: 'List known bugs.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
      },
      required: ['taskId'],
    },
  },
  {
    name: 'harness_get_subphase_template',
    description: 'Get subagent prompt template.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID (for placeholders).' },
        phase: { type: 'string', description: 'Phase name.' },
      },
      required: ['phase'],
    },
  },
  {
    name: 'harness_pre_validate',
    description: 'Dry-run DoD checks (no advance).',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        sessionToken: { type: 'string', description: 'Session token.' },
        retryCount: { type: 'number', description: 'Retry attempt #. Default: 1.' },
      },
      required: ['taskId', 'sessionToken'],
    },
  },
  {
    name: 'harness_update_ac_status',
    description: 'Update AC-N status.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        id: { type: 'string', description: 'AC-N id.' },
        status: { type: 'string', enum: ['open', 'met', 'not_met'], description: 'Status.' },
        testCaseId: { type: 'string', description: 'Verifying test case.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'id', 'status', 'sessionToken'],
    },
  },
  {
    name: 'harness_update_rtm_status',
    description: 'Update F-NNN status.',
    inputSchema: {
      type: 'object',
      properties: {
        taskId: { type: 'string', description: 'Task ID.' },
        id: { type: 'string', description: 'F-NNN id.' },
        status: { type: 'string', enum: ['pending', 'implemented', 'tested', 'verified'], description: 'Status.' },
        codeRef: { type: 'string', description: 'Code ref.' },
        testRef: { type: 'string', description: 'Test ref.' },
        sessionToken: { type: 'string', description: 'Session token.' },
      },
      required: ['taskId', 'id', 'status', 'sessionToken'],
    },
  },
];
