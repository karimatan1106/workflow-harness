import { vi } from 'vitest';
import { join } from 'path';

const TEST_STATE_DIR = '.claude/state';
const fsStore = new Map();

vi.mock('fs', () => ({
  default: {},
  existsSync: (p) => {
    console.log('existsSync called with:', p, 'result:', fsStore.has(p));
    return fsStore.has(p);
  },
  readFileSync: (p, _enc) => {
    console.log('readFileSync called with:', p, 'fsStore size:', fsStore.size, 'keys:', Array.from(fsStore.keys()));
    const v = fsStore.get(p);
    if (v === undefined) throw Object.assign(new Error('ENOENT: ' + p), { code: 'ENOENT' });
    return v;
  },
  writeFileSync: (p, data, _enc) => { 
    console.log('writeFileSync called with:', p);
    fsStore.set(p, data); 
  },
  mkdirSync: (_p, _opts) => {},
}));

import { loadStore } from './src/tools/reflector.js';

const REFLECTOR_PATH = join(TEST_STATE_DIR, 'reflector-log.toon');
fsStore.set(REFLECTOR_PATH, '{}');

console.log('About to call loadStore');
const store = loadStore();
console.log('Got store:', store);
