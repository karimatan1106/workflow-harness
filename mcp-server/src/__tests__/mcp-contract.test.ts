/**
 * N-40: MCP tool contract tests (Pact-style schema verification via vitest)
 *
 * Verifies that all MCP tool definitions conform to the expected schema contract.
 * This ensures backward compatibility when tools are added or modified.
 */
import { describe, it, expect } from 'vitest';
import { TOOL_DEFINITIONS } from '../tools/handler.js';

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
      // properties should be an object (may be empty for no-arg tools)
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
