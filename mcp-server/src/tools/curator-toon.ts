/**
 * TOON I/O for curator log (curator-log.toon).
 * Tables:
 *   reports[N]{timestamp,taskId,taskName,lessonsBefore,lessonsAfter,stashedBefore,stashedAfter}
 *   reportActions_0[N]{action,phase,errorPattern,reason}  (one per report)
 * @spec docs/spec/features/workflow-harness.md
 */

import type { CuratorReport, CuratorAction } from './curator-helpers.js';

/** Quote a value if it contains comma or double-quote. */
function esc(v: string): string {
  if (v.includes(',') || v.includes('"')) return '"' + v.replace(/"/g, '""') + '"';
  return v;
}

/** Remove surrounding quotes and unescape doubled quotes. */
function unesc(v: string): string {
  const t = v.trim();
  if (t.startsWith('"') && t.endsWith('"')) return t.slice(1, -1).replace(/""/g, '"');
  return t;
}

/** Split a TOON CSV row respecting quoted values. */
function splitRow(line: string): string[] {
  const cells: string[] = [];
  let cur = '', inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      if (inQ && i + 1 < line.length && line[i + 1] === '"') { cur += '"'; i++; }
      else { inQ = !inQ; cur += '"'; }
    } else if (ch === ',' && !inQ) {
      cells.push(cur);
      cur = '';
      if (line[i + 1] === ' ') i++;
    } else {
      cur += ch;
    }
  }
  cells.push(cur);
  return cells.map(c => unesc(c));
}

export function serializeReports(reports: CuratorReport[]): string {
  const lines: string[] = [];
  lines.push(`reports[${reports.length}]{timestamp,taskId,taskName,lessonsBefore,lessonsAfter,stashedBefore,stashedAfter}:`);
  for (const r of reports) {
    const cols = [
      r.timestamp, esc(r.taskId), esc(r.taskName),
      String(r.lessonsBefore), String(r.lessonsAfter),
      String(r.stashedBefore), String(r.stashedAfter),
    ];
    lines.push('  ' + cols.join(', '));
  }
  for (let i = 0; i < reports.length; i++) {
    const acts = reports[i].actions;
    lines.push('');
    lines.push(`reportActions_${i}[${acts.length}]{action,phase,errorPattern,reason}:`);
    for (const a of acts) {
      lines.push(`  ${a.action}, ${esc(a.phase)}, ${esc(a.errorPattern)}, ${esc(a.reason)}`);
    }
  }
  return lines.join('\n') + '\n';
}

export function parseReports(content: string): CuratorReport[] {
  const reports: CuratorReport[] = [];
  const actionMap = new Map<number, CuratorAction[]>();
  const lines = content.split('\n');
  let section: 'none' | 'reports' | 'actions' = 'none';
  let actionIdx = -1;

  for (const raw of lines) {
    const line = raw.trimEnd();
    if (line === '') { section = 'none'; continue; }
    if (line.startsWith('reports[')) { section = 'reports'; continue; }
    const actMatch = line.match(/^reportActions_(\d+)\[/);
    if (actMatch) {
      section = 'actions';
      actionIdx = parseInt(actMatch[1], 10);
      if (!actionMap.has(actionIdx)) actionMap.set(actionIdx, []);
      continue;
    }
    if (!line.startsWith('  ')) continue;
    const cells = splitRow(line.trim());
    if (section === 'reports' && cells.length >= 7) {
      reports.push({
        timestamp: cells[0], taskId: cells[1], taskName: cells[2],
        lessonsBefore: parseInt(cells[3], 10), lessonsAfter: parseInt(cells[4], 10),
        stashedBefore: parseInt(cells[5], 10), stashedAfter: parseInt(cells[6], 10),
        actions: [],
      });
    } else if (section === 'actions' && cells.length >= 4) {
      const arr = actionMap.get(actionIdx) || [];
      arr.push({
        action: cells[0] as CuratorAction['action'],
        phase: cells[1], errorPattern: cells[2], reason: cells[3],
      });
      actionMap.set(actionIdx, arr);
    }
  }
  // Attach actions to reports
  for (const [idx, acts] of actionMap) {
    if (idx < reports.length) reports[idx].actions = acts;
  }
  return reports;
}
