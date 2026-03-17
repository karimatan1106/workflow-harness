import { describe, it, expect } from 'vitest';
import { parseToonKv } from '../state/toon-helpers';

describe('parseToonKv', () => {
  it('TC-1: parses valid TOON key:value pairs into Record', () => {
    const input = 'task: test\nscope: something\nstatus: open';
    const result = parseToonKv(input);
    expect(result).toEqual({ task: 'test', scope: 'something', status: 'open' });
  });

  it('TC-2: returns empty object for empty string', () => {
    const result = parseToonKv('');
    expect(result).toEqual({});
  });

  it('TC-3: skips table block headers', () => {
    const input = 'task: test\nitems[3]{id,name}:\n  1, foo\n  2, bar';
    const result = parseToonKv(input);
    expect(result).toEqual({ task: 'test' });
  });

  it('TC-4: unescapes quoted values', () => {
    const input = 'msg: "hello, world"';
    const result = parseToonKv(input);
    expect(result).toEqual({ msg: 'hello, world' });
  });
});
