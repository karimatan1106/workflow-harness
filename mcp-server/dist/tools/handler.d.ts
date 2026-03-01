/**
 * MCP tool dispatcher - thin orchestrator importing from focused modules.
 * External interface unchanged: exports TOOL_DEFINITIONS and handleToolCall.
 * @spec docs/spec/features/workflow-harness.md
 */
import type { StateManager } from '../state/manager.js';
export declare const TOOL_DEFINITIONS: ({
    name: string;
    description: string;
    inputSchema: {
        type: string;
        properties: {
            taskName: {
                type: string;
                description: string;
            };
            userIntent: {
                type: string;
                description: string;
                minLength: number;
            };
            files: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            dirs: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            taskId?: undefined;
            sessionToken?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            sessionToken?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
            codeRef?: undefined;
            testRef?: undefined;
        };
        required: never[];
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
            forceTransition: {
                type: string;
                description: string;
            };
            retryCount: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            type: {
                type: string;
                enum: string[];
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            files: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            dirs: {
                type: string;
                items: {
                    type: string;
                };
                description: string;
            };
            glob: {
                type: string;
                description: string;
            };
            addMode: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            subPhase: {
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
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            targetPhase: {
                type: string;
                description: string;
            };
            reason: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            reason: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            level: {
                type: string;
                enum: string[];
                description: string;
            };
            check: {
                type: string;
                description: string;
            };
            result: {
                type: string;
                description: string;
            };
            evidence: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            id?: undefined;
            description?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            description: {
                type: string;
                description: string;
            };
            sessionToken: {
                type: string;
                description: string;
            };
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            requirement?: undefined;
            designRef?: undefined;
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
            requirement: {
                type: string;
                description: string;
            };
            designRef: {
                type: string;
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
            taskName?: undefined;
            userIntent?: undefined;
            files?: undefined;
            dirs?: undefined;
            forceTransition?: undefined;
            retryCount?: undefined;
            type?: undefined;
            glob?: undefined;
            addMode?: undefined;
            subPhase?: undefined;
            targetPhase?: undefined;
            reason?: undefined;
            level?: undefined;
            check?: undefined;
            result?: undefined;
            evidence?: undefined;
            description?: undefined;
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
export declare function handleToolCall(name: string, args: Record<string, unknown>, stateManager: StateManager): Promise<{
    content: Array<{
        type: string;
        text: string;
    }>;
}>;
//# sourceMappingURL=handler.d.ts.map