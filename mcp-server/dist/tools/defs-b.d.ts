/**
 * MCP Tool Definitions (part 2): harness_record_feedback through harness_update_rtm_status.
 * @spec docs/spec/features/workflow-harness.md
 */
export declare const TOOL_DEFS_B: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            feedback: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            totalTests: {
                type: string;
                description: string;
            };
            passedTests: {
                type: string;
                description: string;
            };
            failedTests: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            exitCode: {
                type: string;
                description: string;
            };
            output: {
                type: string;
                description: string;
                minLength: number;
            };
            summary: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            testFile: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            sessionToken?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            testName: {
                type: string;
                description: string;
            };
            description: {
                type: string;
                description: string;
            };
            severity: {
                type: string;
                enum: string[];
                description: string;
            };
            targetPhase: {
                type: string;
                description: string;
            };
            issueUrl: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            phase: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            sessionToken?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            retryCount?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            retryCount: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            id?: undefined;
            status?: undefined;
            testCaseId?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            id: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
                description: string;
            };
            testCaseId: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: string[];
    };
} | {
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskId: {
                type: string;
                description: string;
            };
            id: {
                type: string;
                description: string;
            };
            status: {
                type: string;
                enum: string[];
                description: string;
            };
            codeRef: {
                type: string;
                description: string;
            };
            testRef: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            feedback?: undefined;
            totalTests?: undefined;
            passedTests?: undefined;
            failedTests?: undefined;
            exitCode?: undefined;
            output?: undefined;
            summary?: undefined;
            testFile?: undefined;
            testName?: undefined;
            description?: undefined;
            severity?: undefined;
            targetPhase?: undefined;
            issueUrl?: undefined;
            phase?: undefined;
            retryCount?: undefined;
            testCaseId?: undefined;
        };
        required: string[];
    };
})[];
//# sourceMappingURL=defs-b.d.ts.map