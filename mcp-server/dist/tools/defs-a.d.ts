/**
 * MCP Tool Definitions (part 1): harness_start through harness_add_rtm.
 * @spec docs/spec/features/workflow-harness.md
 */
export declare const TOOL_DEFS_A: ({
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
})[];
//# sourceMappingURL=defs-a.d.ts.map