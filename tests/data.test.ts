// The rule and typology lists and the fictional parties stay well formed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERDICT_AT, HIT_WEIGHT, rules, typologies } from '../src/data/network.ts';
import { account, initials } from '../src/data/account.ts';
import { SAMPLE_INSTITUTION, sampleBills } from '../src/data/bills.ts';
import { band } from '../src/lib/screen.ts';
import { billInquiry, toBill } from '../src/lib/biller.ts';

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

test('the account holder is fictional', () => {
  assert.match(account.phone, /^\+1 555 01\d\d$/, 'use the 555-01xx range kept for fiction');
  assert.equal(initials(account.name).length, 2);
});

// The reply captured from POST /api/v1/billInquiry with institution "abc" and bill reference "123".
const apiSample =
  '{"statusCode":0,"description":"SUCCESS","billId":"12345","billReference":"123","total":"100000","currency":"PKR","billInquiryAccounts":[{"componentName":"Custom duty","componentAccount":"1111111111","componentAmount":"40000"},{"componentName":"Sales tax","componentAccount":"2222222222","componentAmount":"35000"},{"componentName":"Withholding tax","componentAccount":"3333333333","componentAmount":"20000"},{"componentName":"Other levy","componentAccount":"4444444444","componentAmount":"5000"}]}';

test('bill 123 answers exactly as the API did', async () => {
  const res = await billInquiry({ institution: SAMPLE_INSTITUTION, billReference: '123' });
  assert.equal(JSON.stringify(res), apiSample);
});

test('every demo bill is complete, its components add up, and the account can pay it', () => {
  for (const [ref, res] of Object.entries(sampleBills)) {
    const bill = toBill(SAMPLE_INSTITUTION, res)!;
    assert.ok(bill, ref);
    assert.equal(bill.billReference, ref);
    assert.equal(bill.currency, 'PKR');
    assert.equal(bill.components.length, 4);
    assert.equal(bill.components.reduce((a, c) => a + c.amount, 0), bill.total, ref);
    assert.ok(bill.total <= account.balance, ref);
  }
});

test('the demo bills show each mock outcome once', () => {
  const totals = Object.values(sampleBills).map((r) => Number(r.total));
  assert.deepEqual(totals.map(band), [0, 1, 2]);
});

test('an unknown bill reference is not found, and references are trimmed', async () => {
  const miss = await billInquiry({ institution: SAMPLE_INSTITUTION, billReference: '999' });
  assert.notEqual(miss.statusCode, 0);
  assert.equal(toBill(SAMPLE_INSTITUTION, miss), null);
  const hit = await billInquiry({ institution: SAMPLE_INSTITUTION, billReference: ' 123 ' });
  assert.equal(hit.statusCode, 0);
});
