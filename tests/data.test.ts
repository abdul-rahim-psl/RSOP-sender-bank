// The rule and typology lists and the fictional parties stay well formed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INTERDICT_AT, HIT_WEIGHT, rules, typologies } from '../src/data/network.ts';
import { account, initials } from '../src/data/account.ts';
import { BILL_REF_LENGTH, institutions, localBills, sampleBills } from '../src/data/bills.ts';
import { band } from '../src/lib/screen.ts';
import { billInquiry, billPayment, billRefProblem, paymentRequest, toBill } from '../src/lib/biller.ts';
import { endpoints } from '../src/data/api.ts';

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

// The reply captured on 2026-10-21 from POST http://192.168.9.15:9991/api/v1/billInquiry, institution "FBR", bill reference "1234567890".
const apiSample =
  '{"statusCode":0,"description":"SUCCESS","billId":"12345","billReference":"1234567890","total":"100000","currency":"PKR","billInquiryAccounts":[{"componentName":"Custom duty","componentAccount":"1111111111","componentAmount":"40000"},{"componentName":"Sales tax","componentAccount":"2222222222","componentAmount":"35000"},{"componentName":"Withholding tax","componentAccount":"3333333333","componentAmount":"20000"},{"componentName":"Other levy","componentAccount":"4444444444","componentAmount":"5000"}]}';

test('the institution list is FBR only', () => {
  assert.deepEqual(institutions, ['FBR']);
});

// Stands in for the page's own server: records what was posted and answers with the captured reply.
const fakePost = () => {
  const calls: { path: string; body: unknown }[] = [];
  const post = async (path: string, body: unknown) => (calls.push({ path, body }), JSON.parse(apiSample));
  return { calls, post };
};

test('a lookup posts the institution and trimmed reference to the API, and returns its reply unchanged', async () => {
  const { calls, post } = fakePost();
  const res = await billInquiry({ institution: 'FBR', billReference: ' 1234567890 ' }, post);
  assert.deepEqual(calls, [{ path: '/api/v1/billInquiry', body: { institution: 'FBR', billReference: '1234567890' } }]);
  assert.equal(JSON.stringify(res), apiSample);
});

test('the invented demo bills answer locally, without calling the API', async () => {
  const { calls, post } = fakePost();
  for (const ref of Object.keys(localBills)) {
    const res = await billInquiry({ institution: 'FBR', billReference: ref }, post);
    assert.equal(res.billReference, ref);
  }
  assert.deepEqual(calls, []);
  assert.deepEqual(Object.keys(localBills), ['4567890123', '7890123456']);
});

test('the captured demo bill 1234567890 is what the API answered', () => {
  assert.equal(JSON.stringify(sampleBills['1234567890']), apiSample);
});

test('every demo bill has a valid reference, adds up, and the account can pay it', () => {
  for (const [ref, res] of Object.entries(sampleBills)) {
    assert.equal(billRefProblem(ref), null, ref);
    const bill = toBill('FBR', res)!;
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

test('a bill reference is exactly 10 letters or digits', () => {
  assert.equal(BILL_REF_LENGTH, 10);
  for (const ok of ['1234567890', 'AB12CD34EF', 'abcdefghij', ' 1234567890 ']) assert.equal(billRefProblem(ok), null, ok);
  assert.match(billRefProblem('')!, /Enter/);
  assert.match(billRefProblem('123456789')!, /this has 9/);
  assert.match(billRefProblem('12345678901')!, /this has 11/);
  for (const bad of ['ABC-123456', '12345 7890', 'ÄBCDEFGHIJ']) assert.match(billRefProblem(bad)!, /letters and digits/, bad);
});

test('a reply that is not SUCCESS gives no bill', () => {
  assert.equal(toBill('FBR', { statusCode: 1, description: 'BILL NOT FOUND' }), null);
});

test('the page calls the API paths on its own server', () => {
  assert.equal(endpoints.billInquiry, '/api/v1/billInquiry');
  assert.equal(endpoints.billPayment, '/api/v1/billPayment');
});

test('paying a looked-up bill sends its ID, reference and total, as the API takes them', async () => {
  const bill = toBill('FBR', await billInquiry({ institution: 'FBR', billReference: '1234567890' }, fakePost().post))!;
  const req = paymentRequest(bill);
  assert.equal(JSON.stringify(req), '{"billId":"12345","billReference":"1234567890","totalAmount":"100000"}');
  assert.equal(JSON.stringify(await billPayment(req)), '{"statusCode":0,"description":"SUCCESS"}');
});
