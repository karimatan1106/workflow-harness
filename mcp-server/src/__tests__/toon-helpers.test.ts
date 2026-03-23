import { describe, it, expect } from 'vitest';
import { toonDecodeSafe } from '../state/toon-io-adapter';

describe('toonDecodeSafe (replaces parseToonKv)', () => {
  it('TC-1: parses valid TOON key:value pairs into Record', () => {
    const input = 'task: test\nscope: something\nstatus: open';
    const result = toonDecodeSafe<Record<string, string>>(input);
    expect(result).toEqual({ task: 'test', scope: 'something', status: 'open' });
  });

  it('TC-2: returns empty object for empty string', () => {
    const result = toonDecodeSafe<Record<string, string>>('');
    expect(result).toEqual({});
  });

  it('TC-3: skips table block rows, parses top-level KV', () => {
    const input = 'task: test\nitems[2]{id,name}:\n  1, foo\n  2, bar';
    const result = toonDecodeSafe<Record<string, unknown>>(input);
    expect(result).not.toBeNull();
    expect(result!.task).toBe('test');
  });

  it('TC-4: unescapes quoted values', () => {
    const input = 'msg: "hello, world"';
    const result = toonDecodeSafe<Record<string, string>>(input);
    expect(result).toEqual({ msg: 'hello, world' });
  });
});
