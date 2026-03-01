/**
 * MCP Tool Definitions (part 2): harness_record_feedback through harness_update_rtm_status.
 * @spec docs/spec/features/workflow-harness.md
 */
export const TOOL_DEFS_B = [
    {
        name: 'harness_record_feedback',
        description: 'Append user feedback to the task userIntent.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                feedback: { type: 'string', description: 'Feedback text to append.' },
                sessionToken: { type: 'string', description: 'Session token for authentication.' },
            },
            required: ['taskId', 'feedback', 'sessionToken'],
        },
    },
    {
        name: 'harness_capture_baseline',
        description: 'Capture the test suite baseline before changes.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                totalTests: { type: 'number', description: 'Total number of tests in the suite.' },
                passedTests: { type: 'number', description: 'Number of tests passing before changes.' },
                failedTests: { type: 'array', items: { type: 'string' }, description: 'Names of tests already failing before changes.' },
                sessionToken: { type: 'string', description: 'Session token for authentication.' },
            },
            required: ['taskId', 'totalTests', 'passedTests', 'failedTests', 'sessionToken'],
        },
    },
    {
        name: 'harness_record_test_result',
        description: 'Record a test execution result for the current phase.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                exitCode: { type: 'number', description: 'Exit code of the test command (0 = success).' },
                output: { type: 'string', description: 'Full output of the test command (minimum 50 characters).', minLength: 50 },
                summary: { type: 'string', description: 'Short human-readable summary of the test result (optional).' },
                sessionToken: { type: 'string', description: 'Session token for authentication.' },
            },
            required: ['taskId', 'exitCode', 'output', 'sessionToken'],
        },
    },
    {
        name: 'harness_record_test',
        description: 'Record a test file path created during test_impl phase.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                testFile: { type: 'string', description: 'Path to the test file.' },
                sessionToken: { type: 'string', description: 'Session token.' },
            },
            required: ['taskId', 'testFile', 'sessionToken'],
        },
    },
    {
        name: 'harness_get_test_info',
        description: 'Get test files and baseline information for a task.',
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
        description: 'Record a known bug found during regression testing (instead of deleting the test).',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                testName: { type: 'string', description: 'Name of the failing test.' },
                description: { type: 'string', description: 'Description of the bug.' },
                severity: { type: 'string', enum: ['low', 'medium', 'high', 'critical'], description: 'Bug severity.' },
                targetPhase: { type: 'string', description: 'When to fix (next_sprint, backlog, deferred). Optional.' },
                issueUrl: { type: 'string', description: 'Related issue URL. Optional.' },
                sessionToken: { type: 'string', description: 'Session token.' },
            },
            required: ['taskId', 'testName', 'description', 'severity', 'sessionToken'],
        },
    },
    {
        name: 'harness_get_known_bugs',
        description: 'Get all known bugs recorded for a task.',
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
        description: 'Get the subagent prompt template for a specific phase.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID (for placeholder substitution).' },
                phase: { type: 'string', description: 'Phase name to get template for.' },
            },
            required: ['phase'],
        },
    },
    {
        name: 'harness_pre_validate',
        description: 'Run DoD checks without advancing the phase. Returns retry prompt on failure.',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                sessionToken: { type: 'string', description: 'Session token.' },
                retryCount: { type: 'number', description: 'Current retry attempt number (for model escalation logic). Default: 1.' },
            },
            required: ['taskId', 'sessionToken'],
        },
    },
    {
        name: 'harness_update_ac_status',
        description: 'Update the status of an acceptance criterion (AC-N).',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                id: { type: 'string', description: 'Acceptance criterion identifier (e.g. AC-1).' },
                status: { type: 'string', enum: ['open', 'met', 'not_met'], description: 'New status for the acceptance criterion.' },
                testCaseId: { type: 'string', description: 'Test case identifier that verified this criterion (optional).' },
                sessionToken: { type: 'string', description: 'Session token for authentication.' },
            },
            required: ['taskId', 'id', 'status', 'sessionToken'],
        },
    },
    {
        name: 'harness_update_rtm_status',
        description: 'Update the status of an RTM entry (F-NNN).',
        inputSchema: {
            type: 'object',
            properties: {
                taskId: { type: 'string', description: 'Task ID.' },
                id: { type: 'string', description: 'RTM entry identifier (e.g. F-001).' },
                status: { type: 'string', enum: ['pending', 'implemented', 'tested', 'verified'], description: 'New status for the RTM entry.' },
                codeRef: { type: 'string', description: 'Reference to code artifact (optional).' },
                testRef: { type: 'string', description: 'Reference to test artifact (optional).' },
                sessionToken: { type: 'string', description: 'Session token for authentication.' },
            },
            required: ['taskId', 'id', 'status', 'sessionToken'],
        },
    },
];
//# sourceMappingURL=defs-b.js.map