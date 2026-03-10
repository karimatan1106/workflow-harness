/**
 * N-40 + N-57: MCP tool contract tests (Pact-style consumer/provider verification via vitest)
 *
 * Verifies that all MCP tool definitions conform to the expected schema contract.
 * N-57 adds: consumer expectations, provider response contracts, breaking change detection.
 */
import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS, handleToolCall } from '../tools/handler.js';
import { StateManager } from '../state/manager.js';
import * as os from 'node:os';
import * as path from 'node:path';
import * as fs from 'node:fs';

describe('MCP tool contract', () => {
  it('all tools have name and description', () => {
    expect(TOOL_DEFINITIONS.length).toBeGreaterThan(0);
    for (const def of TOOL_DEFINITIONS) {
      expect(def.name, `tool missing name`).toBeTruthy();
      expect(typeof def.name).toBe('string');
      expect(def.description, `${def.name} missing description`).toBeTruthy();
      expect(typeof def.description).toBe('string');
      expect(def.description.length, `${def.name} description too short`).toBeGreaterThan(10);
    }
  });

  it('all tools have valid inputSchema with type object', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.inputSchema, `${def.name} missing inputSchema`).toBeDefined();
      expect(def.inputSchema.type, `${def.name} inputSchema.type should be object`).toBe('object');
      if (def.inputSchema.properties) {
        expect(typeof def.inputSchema.properties).toBe('object');
      }
    }
  });

  it('harness_start requires taskName and userIntent', () => {
    const start = TOOL_DEFINITIONS.find((d) => d.name === 'harness_start');
    expect(start, 'harness_start tool not found').toBeDefined();
    expect(start!.inputSchema.required).toBeDefined();
    expect(start!.inputSchema.required).toContain('taskName');
    expect(start!.inputSchema.required).toContain('userIntent');
  });

  it('tool names follow snake_case convention with harness_ prefix', () => {
    for (const def of TOOL_DEFINITIONS) {
      expect(def.name).toMatch(/^harness_[a-z_]+$/);
    }
  });

  it('no duplicate tool names exist', () => {
    const names = TOOL_DEFINITIONS.map((d) => d.name);
    const unique = new Set(names);
    expect(unique.size, `duplicate tool names found: ${names.filter((n, i) => names.indexOf(n) !== i)}`).toBe(names.length);
  });
});

// N-57: Pact-style consumer/provider contract tests
describe('MCP consumer contract (what callers expect)', () => {
  // Consumer expectation: minimum set of tools that must exist
  const REQUIRED_TOOLS = [
    'harness_start',
    'harness_status',
    'harness_next',
    'harness_approve',
    'harness_set_scope',
    'harness_reset',
    'harness_back',
    'harness_add_ac',
    'harness_record_test',
    'harness_record_test_result',
    'harness_record_proof',
  ];

  it('all required consumer tools are available', () => {
    const available = new Set(TOOL_DEFINITIONS.map((d) => d.name));
    for (const required of REQUIRED_TOOLS) {
      expect(available.has(required), `consumer expects ${required} but it is missing`).toBe(true);
    }
  });

  it('harness_next accepts taskId and sessionToken', () => {
    const next = TOOL_DEFINITIONS.find((d) => d.name === 'harness_next');
    expect(next).toBeDefined();
    const props = Object.keys(next!.inputSchema.properties || {});
    expect(props).toContain('taskId');
    expect(props).toContain('sessionToken');
  });

  it('harness_set_scope accepts taskId, sessionToken, and files', () => {
    const scope = TOOL_DEFINITIONS.find((d) => d.name === 'harness_set_scope');
    expect(scope).toBeDefined();
    const props = Object.keys(scope!.inputSchema.properties || {});
    expect(props).toContain('taskId');
    expect(props).toContain('sessionToken');
    expect(props).toContain('files');
  });
});

describe('MCP provider contract (response format)', () => {
  let sm: StateManager;
  let tmpDir: string;

  beforeAll(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'pact-'));
    sm = new StateManager(tmpDir);
  });

  afterAll(() => {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('provider returns {content: [{type: "text", text: string}]} on success', async () => {
    const result = await handleToolCall('harness_status', {}, sm);
    expect(result).toHaveProperty('content');
    expect(Array.isArray(result.content)).toBe(true);
    for (const item of result.content) {
      expect(item).toHaveProperty('type', 'text');
      expect(typeof item.text).toBe('string');
    }
  });

  it('provider returns error in same format for invalid tool', async () => {
    const result = await handleToolCall('harness_nonexistent', {}, sm);
    expect(result).toHaveProperty('content');
    expect(result.content[0]).toHaveProperty('type', 'text');
    expect(result.content[0].text).toContain('Unknown');
  });

  it('provider response text is parseable JSON for status', async () => {
    const result = await handleToolCall('harness_status', {}, sm);
    const parsed = JSON.parse(result.content[0].text);
    // status with no taskId returns list or empty state
    expect(typeof parsed).toBe('object');
  });
});
