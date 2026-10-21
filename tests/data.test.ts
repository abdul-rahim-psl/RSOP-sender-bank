// The rule and typology lists and the fictional parties stay well formed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERDICT_AT, HIT_WEIGHT, rules, typologies } from '../src/data/network.ts';
import { initials, providers, quickAmounts, recipients, senders } from '../src/data/parties.ts';
import { band } from '../src/lib/screen.ts';
import { parseAmount } from '../src/lib/format.ts';

const unique = (xs: string[]) => new Set(xs).size === xs.length;

test('rule and typology numbers are unique, three digits, and in the reference order', () => {
  const ids = typologies.map((t) => t.id);
  for (const list of [rules, ids]) {
    assert.ok(unique(list));
    for (const id of list) assert.match(id, /^\d{3}$/);
    assert.deepEqual(list, [...list].sort());
  }
  assert.equal(rules.length, 33);
  assert.equal(ids.length, 31);
});

test('every rule is used by a typology, and every typology can reach interdiction', () => {
  const used = new Set(typologies.flatMap((t) => t.rules));
  for (const r of rules) assert.ok(used.has(r), `rule ${r} is unused`);
  for (const t of typologies) {
    assert.ok(unique(t.rules), `typology ${t.id} repeats a rule`);
    for (const r of t.rules) assert.ok(rules.includes(r));
    assert.ok(t.rules.length * HIT_WEIGHT >= INTERDICT_AT, `typology ${t.id} can never interdict`);
  }
});

test('parties are fictional and complete', () => {
  assert.equal(senders.length, 4);
  assert.equal(recipients.length, 4);
  const all = [...senders, ...recipients];
  assert.ok(unique(all.map((p) => p.id)));
  for (const p of all) {
    assert.match(p.phone, /^\+1 555 01\d\d$/, `${p.name}: use the 555-01xx range kept for fiction`);
    assert.ok(providers.includes(p.provider));
    assert.equal(initials(p.name).length, 2);
  }
  assert.ok(senders.some((s) => s.blocked), 'one sender shows the block list without editing');
  assert.ok(senders.some((s) => !s.blocked));
});

test('the quick amounts show each mock outcome once, and every sender can afford them', () => {
  assert.deepEqual(quickAmounts.map(band), [0, 1, 2]);
  for (const s of senders) assert.ok(Math.max(...quickAmounts) <= s.balance, s.name);
});

test('amounts parse as people type them', () => {
  assert.equal(parseAmount('2,500'), 2500);
  assert.equal(parseAmount(' 12000.5 '), 12000.5);
  assert.equal(parseAmount('0'), null);
  assert.equal(parseAmount('1.234'), null);
  assert.equal(parseAmount('abc'), null);
  assert.equal(parseAmount(''), null);
});
