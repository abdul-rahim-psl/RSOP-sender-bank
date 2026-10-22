// The bill API proxy forwards only well-formed inquiries and payments, with the headers the API requires.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import type { AddressInfo } from 'node:net';
import { createBillApi } from '../server/bill-api.mjs';

const config = {
  apiBase: 'http://api.test',
  senderParticipantCode: 'SENDER',
  receiverParticipantCode: 'RECEIVER',
  senderUserCode: 'USER',
  timeoutMs: 1000,
};

type Sent = { url: string; init: RequestInit };

/** Runs the proxy on a free port in front of a fake API, and returns a way to call it. */
async function start(upstream: (sent: Sent) => Response | Promise<Response>, cfg = config) {
  const sent: Sent[] = [];
  const fakeFetch = async (url: string, init: RequestInit) => (sent.push({ url, init }), upstream({ url, init }));
  const api = createBillApi(cfg, fakeFetch as typeof fetch);
  const server = http.createServer((req, res) => void api(req, res, () => res.writeHead(404).end()));
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r));
  const base = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  const call = (body: unknown, method = 'POST', path = '/api/v1/billInquiry') =>
    fetch(base + path, { method, headers: { 'Content-Type': 'application/json' }, body: method === 'GET' ? undefined : JSON.stringify(body) });
  return { sent, call, close: () => new Promise((r) => server.close(r)) };
}

const ok = () => new Response('{"statusCode":0,"description":"SUCCESS"}', { status: 200 });

test('forwards a valid inquiry with the required headers and only the two fields', async () => {
  const p = await start(ok);
  const res = await p.call({ institution: 'FBR', billReference: 'AB12CD34EF', extra: 'dropped' });
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"statusCode":0,"description":"SUCCESS"}');
  assert.equal(p.sent.length, 1);
  const { url, init } = p.sent[0]!;
  assert.equal(url, 'http://api.test/api/v1/billInquiry');
  const h = init.headers as Record<string, string>;
  assert.equal(h.Charset, 'UTF-8');
  assert.equal(h['Sender-Participant-Code'], 'SENDER');
  assert.equal(h['Receiver-Participant-Code'], 'RECEIVER');
  assert.equal(h['Sender-User-Code'], 'USER');
  assert.match(h['X-Request-ID']!, /^[0-9a-f]{32}$/);
  assert.equal(init.body, '{"institution":"FBR","billReference":"AB12CD34EF"}');
  await p.close();
});

test('refuses anything but a well-formed FBR inquiry, without calling the API', async () => {
  const p = await start(ok);
  for (const body of [
    { institution: 'abc', billReference: '1234567890' },
    { institution: 'FBR', billReference: '123' },
    { institution: 'FBR', billReference: 'ABC-123456' },
    { institution: 'FBR' },
    'not json',
  ])
    assert.equal((await p.call(body)).status, 400, JSON.stringify(body));
  assert.equal((await p.call(null, 'GET')).status, 405);
  assert.equal((await p.call({}, 'POST', '/api/v1/billStatus')).status, 404, 'other paths are not forwarded');
  assert.equal(p.sent.length, 0);
  await p.close();
});

test('passes the API status through, and answers 502 when the API cannot be reached', async () => {
  const bad = await start(() => new Response('{"status":400}', { status: 400 }));
  assert.equal((await bad.call({ institution: 'FBR', billReference: '1234567890' })).status, 400);
  await bad.close();

  const down = await start(() => Promise.reject(new TypeError('fetch failed')));
  const res = await down.call({ institution: 'FBR', billReference: '1234567890' });
  assert.equal(res.status, 502);
  assert.equal((await res.json()).description, 'API UNREACHABLE');
  await down.close();
});

test('refuses to forward when the participant codes are not configured', async () => {
  const p = await start(ok, { ...config, senderUserCode: '' });
  assert.equal((await p.call({ institution: 'FBR', billReference: '1234567890' })).status, 500);
  assert.equal(p.sent.length, 0);
  await p.close();
});

test('forwards a valid payment with the required headers and only its three fields', async () => {
  const p = await start(ok);
  const pay = { billId: '12345', billReference: '1234567890', totalAmount: '100000', balance: 'dropped' };
  const res = await p.call(pay, 'POST', '/api/v1/billPayment');
  assert.equal(res.status, 200);
  assert.equal(await res.text(), '{"statusCode":0,"description":"SUCCESS"}');
  const { url, init } = p.sent[0]!;
  assert.equal(url, 'http://api.test/api/v1/billPayment');
  assert.equal((init.headers as Record<string, string>).Charset, 'UTF-8');
  assert.equal(init.body, '{"billId":"12345","billReference":"1234567890","totalAmount":"100000"}');
  await p.close();
});

test('refuses a malformed payment without calling the API', async () => {
  const p = await start(ok);
  for (const body of [
    { billId: '12345', billReference: '123', totalAmount: '100000' },
    { billId: '12345', billReference: '1234567890', totalAmount: '-5' },
    { billId: '12345', billReference: '1234567890', totalAmount: 100000 },
    { billId: '', billReference: '1234567890', totalAmount: '100000' },
    { billId: '12 34', billReference: '1234567890', totalAmount: '100000' },
  ])
    assert.equal((await p.call(body, 'POST', '/api/v1/billPayment')).status, 400, JSON.stringify(body));
  assert.equal(p.sent.length, 0);
  await p.close();
});
