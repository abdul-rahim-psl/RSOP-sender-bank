// Mock screening: invented rules of thumb that make the demo predictable. Not real rule or typology logic.

import {
  ALERT_AMOUNT,
  ALERT_AT,
  HIT_WEIGHT,
  INTERDICT_AT,
  RAPID_FROM,
  STOP_AMOUNT,
  type Typology,
} from '../data/network.ts';

export type Tone = 'ok' | 'fail' | 'warn' | 'wait' | 'info';
export type TypologyResult = 'clear' | 'alert' | 'interdict';

export interface Payment {
  id: string;
  amount: number;
  senderBlocked: boolean;
  /** Payments this sender made before this one, since Clear all. */
  priorSends: number;
}

export interface Screening {
  /** 0 no alert, 1 alert, 2 stopped by a typology. */
  level: 0 | 1 | 2;
  rapid: boolean;
  hits: string[];
  typologies: { id: string; score: number; result: TypologyResult }[];
  eventFlowBlock: boolean;
  interdiction: string[];
  alerting: string[];
  adjudicator: 'ALRT' | 'NALT';
  delivered: boolean;
}

/** FNV-1a, so the same payment always lights the same rules. */
export function hash(text: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

export function band(amount: number): 0 | 1 | 2 {
  return amount >= STOP_AMOUNT ? 2 : amount >= ALERT_AMOUNT ? 1 : 0;
}

export const typologyResult = (score: number): TypologyResult =>
  score >= INTERDICT_AT ? 'interdict' : score >= ALERT_AT ? 'alert' : 'clear';

export function screen(rules: string[], typologies: Typology[], p: Payment): Screening {
  const rapid = p.priorSends + 1 >= RAPID_FROM;
  const level = Math.min(2, band(p.amount) + (rapid ? 1 : 0)) as 0 | 1 | 2;
  const h = hash(`${p.id}|${p.amount}`);

  // One typology carries the outcome: two of its rules reach the alert threshold, four reach interdiction.
  // One stray hit adds variety; three hits at most stay under interdiction, so it never changes the outcome.
  const hits = new Set<string>();
  const stray = rules[(h >>> 8) % rules.length]!;
  if (level > 0) {
    const need = level === 2 ? INTERDICT_AT / HIT_WEIGHT : ALERT_AT / HIT_WEIGHT;
    const pool = typologies.filter((t) => t.rules.length >= need);
    const focus = pool[h % pool.length]!;
    const start = (h >>> 4) % focus.rules.length;
    for (let k = 0; k < need; k++) hits.add(focus.rules[(start + k) % focus.rules.length]!);
  }
  if (level > 0 || h % 2 === 0) hits.add(stray);

  const scored = typologies.map((t) => {
    const score = t.rules.filter((r) => hits.has(r)).length * HIT_WEIGHT;
    return { id: t.id, score, result: typologyResult(score) };
  });
  const interdiction = scored.filter((t) => t.result === 'interdict').map((t) => t.id);
  const alerting = scored.filter((t) => t.result !== 'clear').map((t) => t.id);

  return {
    level,
    rapid,
    hits: rules.filter((r) => hits.has(r)),
    typologies: scored,
    eventFlowBlock: p.senderBlocked,
    interdiction,
    alerting,
    adjudicator: alerting.length ? 'ALRT' : 'NALT',
    delivered: !p.senderBlocked && interdiction.length === 0,
  };
}
