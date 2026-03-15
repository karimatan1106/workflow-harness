#!/usr/bin/env node
/**
 * MCP Server entry point for workflow-harness
 * @spec docs/spec/features/workflow-harness.md
 */

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { CallToolRequestSchema, ListToolsRequestSchema } from '@modelcontextprotocol/sdk/types.js';
import { StateManager } from './state/manager.js';
import { TOOL_DEFINITIONS, handleToolCall } from './tools/handler.js';

const server = new Server(
  {
    name: 'workflow-harness',
    version: '0.1.0',
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

const stateManager = new StateManager();

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => ({
  tools: TOOL_DEFINITIONS,
}));

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request, extra) => {
  const { name, arguments: args } = request.params;
  return handleToolCall(name, args ?? {}, stateManager, extra);
});

// Start server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('workflow-harness MCP server running on stdio');
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
