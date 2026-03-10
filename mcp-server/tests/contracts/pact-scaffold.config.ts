/**
 * N-78: Pact v4 contract testing scaffold.
 * Consumer-driven contracts for MCP tool API.
 * Requires @pact-foundation/pact v13+ for Pact v4 spec.
 */

/** Pact v4 interaction structure */
export interface PactV4Interaction {
  description: string;
  providerState?: string;
  request: {
    method: string;
    path: string;
    headers?: Record<string, string>;
    body?: unknown;
  };
  response: {
    status: number;
    headers?: Record<string, string>;
    body?: unknown;
  };
}

/** MCP tool contract definitions (consumer expectations) */
export const MCP_CONSUMER_CONTRACTS: PactV4Interaction[] = [
  {
    description: 'harness_start creates a new task',
    providerState: 'no active tasks',
    request: {
      method: 'POST',
      path: '/mcp/tools/harness_start',
      headers: { 'Content-Type': 'application/json' },
      body: { taskName: 'test-task', userIntent: 'Implement feature X for module Y' },
    },
    response: {
      status: 200,
      body: { taskId: 'like(uuid)', phase: 'scope_definition', sessionToken: 'like(string)' },
    },
  },
  {
    description: 'harness_next advances phase after DoD pass',
    providerState: 'task in scope_definition with DoD met',
    request: {
      method: 'POST',
      path: '/mcp/tools/harness_next',
      body: { taskId: 'like(uuid)', sessionToken: 'like(string)' },
    },
    response: {
      status: 200,
      body: { phase: 'like(string)', previous: 'scope_definition' },
    },
  },
  {
    description: 'harness_status returns task state',
    request: {
      method: 'POST',
      path: '/mcp/tools/harness_status',
      body: { taskId: 'like(uuid)' },
    },
    response: {
      status: 200,
      body: { taskId: 'like(uuid)', phase: 'like(string)', taskName: 'like(string)' },
    },
  },
];

/** Pact broker configuration */
export const PACT_BROKER_CONFIG = {
  pactBrokerUrl: process.env['PACT_BROKER_URL'] ?? 'http://localhost:9292',
  consumerName: 'harness-orchestrator',
  providerName: 'harness-mcp-server',
  pactDir: 'tests/contracts/pacts/',
  logDir: 'tests/contracts/logs/',
  specVersion: 4,
} as const;

/** Async message contract for phase transitions */
export const ASYNC_CONTRACTS = {
  phaseTransition: {
    description: 'phase transition event',
    content: {
      taskId: 'like(uuid)',
      from: 'like(string)',
      to: 'like(string)',
      timestamp: 'like(datetime)',
    },
  },
} as const;
