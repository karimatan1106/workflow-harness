/**
 * ADR — Architecture Decision Records management.
 * Tracks decisions with status lifecycle: proposed → accepted → superseded/deprecated.
 * Integrates with archgate for executable rule enforcement.
 * @spec docs/spec/features/workflow-harness.md
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';
import { serializeADRStore, parseADRStore } from './adr-toon-io.js';

const STATE_DIR = process.env.STATE_DIR || '.claude/state';
const ADR_TOON_PATH = join(STATE_DIR, 'adr-store.toon');
const ADR_JSON_PATH = join(STATE_DIR, 'adr-store.json');

export type ADRStatus = 'proposed' | 'accepted' | 'superseded' | 'deprecated';

export interface ADREntry {
  id: string;
  statement: string;
  rationale: string;
  context: string;
  status: ADRStatus;
  taskId: string;
  createdAt: string;
  updatedAt: string;
  supersededBy?: string;
  deprecatedReason?: string;
}

export interface ADRStore {
  version: 1;
  entries: ADREntry[];
}

export interface ADRCreateInput {
  id: string;
  statement: string;
  rationale: string;
  context: string;
  taskId: string;
}

function migrateJsonToToon(): void {
  if (!existsSync(ADR_TOON_PATH) && existsSync(ADR_JSON_PATH)) {
    try {
      const json = JSON.parse(readFileSync(ADR_JSON_PATH, 'utf-8')) as ADRStore;
      const dir = dirname(ADR_TOON_PATH);
      if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
      writeFileSync(ADR_TOON_PATH, serializeADRStore(json), 'utf-8');
    } catch { /* migration failed — will start fresh */ }
  }
}

export function loadADRStore(): ADRStore {
  migrateJsonToToon();
  try {
    if (existsSync(ADR_TOON_PATH)) {
      return parseADRStore(readFileSync(ADR_TOON_PATH, 'utf-8'));
    }
  } catch { /* corrupted — start fresh */ }
  return { version: 1, entries: [] };
}

function saveADRStore(store: ADRStore): void {
  const dir = dirname(ADR_TOON_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(ADR_TOON_PATH, serializeADRStore(store), 'utf-8');
}

export function addADR(input: ADRCreateInput): ADREntry {
  const store = loadADRStore();
  const now = new Date().toISOString();
  const entry: ADREntry = {
    id: input.id,
    statement: input.statement,
    rationale: input.rationale,
    context: input.context,
    status: 'proposed',
    taskId: input.taskId,
    createdAt: now,
    updatedAt: now,
  };
  store.entries.push(entry);
  saveADRStore(store);
  return entry;
}

export function updateADRStatus(id: string, status: ADRStatus, reason?: string): boolean {
  const store = loadADRStore();
  const entry = store.entries.find(e => e.id === id);
  if (!entry) return false;
  entry.status = status;
  entry.updatedAt = new Date().toISOString();
  if (status === 'deprecated' && reason) entry.deprecatedReason = reason;
  saveADRStore(store);
  return true;
}

export function supersedeADR(oldId: string, newId: string): boolean {
  const store = loadADRStore();
  const old = store.entries.find(e => e.id === oldId);
  const newer = store.entries.find(e => e.id === newId);
  if (!old || !newer) return false;
  old.status = 'superseded';
  old.supersededBy = newId;
  old.updatedAt = new Date().toISOString();
  saveADRStore(store);
  return true;
}

export function getADR(id: string): ADREntry | undefined {
  return loadADRStore().entries.find(e => e.id === id);
}

export function getActiveADRs(): ADREntry[] {
  return loadADRStore().entries.filter(e => e.status === 'accepted');
}

export function isADRActive(id: string): boolean {
  const entry = getADR(id);
  return entry?.status === 'accepted';
}
