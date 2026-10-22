// The fictional account, the bill data and the API client stay well formed.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { account, initials } from '../src/data/account.ts';
import { BILL_REF_LENGTH, institutions } from '../src/data/bills.ts';
import { billInquiry, billPayment, billRefProblem, paymentRequest, toBill } from '../src/lib/biller.ts';
import { endpoints } from '../src/data/api.ts';

test('the account holder has two initials for the avatar', () => {
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

test("the API's bill reads as a complete bill the account can pay", () => {
  const bill = toBill('FBR', JSON.parse(apiSample))!;
  assert.equal(bill.currency, 'PKR');
  assert.equal(bill.components.length, 4);
  assert.equal(bill.components.reduce((a, c) => a + c.amount, 0), bill.total);
  assert.ok(bill.total <= account.balance);
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

test('paying a looked-up bill posts its ID, reference and total to the API, as the API takes them', async () => {
  const bill = toBill('FBR', await billInquiry({ institution: 'FBR', billReference: '1234567890' }, fakePost().post))!;
  const req = paymentRequest(bill);
  assert.equal(JSON.stringify(req), '{"billId":"12345","billReference":"1234567890","totalAmount":"100000"}');
  const calls: { path: string; body: unknown }[] = [];
  const post = async (path: string, body: unknown) => (calls.push({ path, body }), { statusCode: 0, description: 'SUCCESS' });
  assert.deepEqual(await billPayment(req, post), { statusCode: 0, description: 'SUCCESS' });
  assert.deepEqual(calls, [{ path: '/api/v1/billPayment', body: req }]);
});
