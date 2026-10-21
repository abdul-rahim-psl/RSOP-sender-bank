// Mock screening keeps the promises the plan and the "How it decides" popover make.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { ALERT_AMOUNT, ALERT_AT, INTERDICT_AT, RAPID_FROM, STOP_AMOUNT, rules, typologies } from '../src/data/network.ts';
import { screen, typologyResult, type Payment } from '../src/lib/screen.ts';

const run = (p: Partial<Payment>) =>
  screen(rules, typologies, { id: 'TX-1', amount: 100, senderBlocked: false, priorSends: 0, ...p });

// Many payment IDs per case, so a promise holds for every rule the hash can pick, not just one lucky draw.
const ids = Array.from({ length: 400 }, (_, i) => `TX-${i.toString(16).toUpperCase().padStart(6, '0')}`);
const amounts = { low: [1, 250, 999.99], alert: [ALERT_AMOUNT, 2_500, STOP_AMOUNT - 0.01], stop: [STOP_AMOUNT, 12_000, 1_000_000] };

test('under the alert amount: no alert, at most one rule hits, delivered', () => {
  for (const id of ids)
    for (const amount of amounts.low) {
      const s = run({ id, amount });
      assert.equal(s.level, 0);
      assert.ok(s.hits.length <= 1, `${id} ${amount}: ${s.hits.length} hits`);
      assert.equal(s.adjudicator, 'NALT');
      assert.deepEqual(s.alerting, []);
      assert.equal(s.delivered, true);
    }
});

test('from the alert amount: a typology alerts, none interdicts, still delivered', () => {
  for (const id of ids)
    for (const amount of amounts.alert) {
      const s = run({ id, amount });
      assert.equal(s.level, 1);
      assert.equal(s.adjudicator, 'ALRT');
      assert.ok(s.alerting.length >= 1);
      assert.deepEqual(s.interdiction, [], `${id} ${amount}`);
      assert.equal(s.delivered, true);
    }
});

test('from the stop amount: a typology interdicts and the payment is stopped', () => {
  for (const id of ids)
    for (const amount of amounts.stop) {
      const s = run({ id, amount });
      assert.equal(s.level, 2);
      assert.ok(s.interdiction.length >= 1, `${id} ${amount}`);
      assert.equal(s.adjudicator, 'ALRT');
      assert.equal(s.delivered, false);
    }
});

test("the sender's third payment counts one level higher, and the level caps at stopped", () => {
  assert.equal(run({ amount: 250, priorSends: RAPID_FROM - 2 }).level, 0);
  const third = run({ amount: 250, priorSends: RAPID_FROM - 1 });
  assert.equal(third.rapid, true);
  assert.equal(third.level, 1);
  assert.equal(third.adjudicator, 'ALRT');
  assert.equal(run({ amount: 2_500, priorSends: 5 }).level, 2);
  assert.equal(run({ amount: 12_000, priorSends: 5 }).level, 2);
});

test('a sender on the block list is stopped by the event flow check, whatever the amount', () => {
  for (const amount of [...amounts.low, ...amounts.alert, ...amounts.stop]) {
    const s = run({ amount, senderBlocked: true });
    assert.equal(s.eventFlowBlock, true);
    assert.equal(s.delivered, false);
  }
  const small = run({ amount: 250, senderBlocked: true });
  assert.deepEqual(small.interdiction, [], 'the typologies stay clear; only the event flow check stops it');
});

test('typology scores follow the rule hits and the thresholds', () => {
  for (const id of ids.slice(0, 60))
    for (const amount of [250, 2_500, 12_000]) {
      const s = run({ id, amount });
      const hit = new Set(s.hits);
      for (const t of s.typologies) {
        const rulesHit = typologies.find((x) => x.id === t.id)!.rules.filter((r) => hit.has(r)).length;
        assert.equal(t.score, rulesHit * 100);
        assert.equal(t.result, typologyResult(t.score));
      }
      for (const r of s.hits) assert.ok(rules.includes(r));
    }
  assert.equal(typologyResult(ALERT_AT - 1), 'clear');
  assert.equal(typologyResult(ALERT_AT), 'alert');
  assert.equal(typologyResult(INTERDICT_AT), 'interdict');
});

test('the same payment always screens the same way', () => {
  assert.deepEqual(run({ id: 'TX-ABC123', amount: 2_500 }), run({ id: 'TX-ABC123', amount: 2_500 }));
});
