// Forwards the phone's bill inquiry and bill payment to RSOP's API from the server, where CORS does not apply,
// adding the headers the API requires. The tunnel makes this server public, so it forwards two endpoints, well-formed bodies only.

import { randomUUID } from 'node:crypto';
import { BILL_REF_LENGTH, institutions } from '../src/data/bills.ts';
import { config as defaults } from './config.mjs';

export const INQUIRY_PATH = '/api/v1/billInquiry';
export const PAYMENT_PATH = '/api/v1/billPayment';

const REF = new RegExp(`^[A-Za-z0-9]{${BILL_REF_LENGTH}}$`);
const BILL_ID = /^[A-Za-z0-9-]{1,40}$/;
const AMOUNT = /^\d{1,12}(\.\d{1,2})?$/;
const str = (v, re) => typeof v === 'string' && re.test(v);

/** Per endpoint: the body to forward, built from the allowed fields only, or null when the request is malformed. */
const routes = {
  [INQUIRY_PATH]: ({ institution, billReference }) =>
    institutions.includes(institution) && str(billReference, REF) ? { institution, billReference } : null,
  [PAYMENT_PATH]: ({ billId, billReference, totalAmount }) =>
    str(billId, BILL_ID) && str(billReference, REF) && str(totalAmount, AMOUNT) ? { billId, billReference, totalAmount } : null,
};

const reply = (res, status, body) => {
  res.writeHead(status, { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' });
  res.end(typeof body === 'string' ? body : JSON.stringify(body));
};
const refuse = (res, status, description) => reply(res, status, { statusCode: -1, description });

async function readJson(req, limit = 4096) {
  let text = '';
  for await (const chunk of req) {
    text += chunk;
    if (text.length > limit) throw new Error('too large');
  }
  return JSON.parse(text);
}

/** Connect-style middleware for the Astro dev server and server/serve.mjs; `fetch` is swappable for tests. */
export function createBillApi(config = defaults, send = fetch) {
  return async function billApi(req, res, next) {
    const build = Object.hasOwn(routes, req.url) ? routes[req.url] : null;
    if (!build) return next();
    if (req.method !== 'POST') return refuse(res, 405, 'METHOD NOT ALLOWED');

    let body;
    try {
      body = build((await readJson(req)) ?? {});
    } catch {
      body = null;
    }
    if (!body) return refuse(res, 400, 'INVALID REQUEST');
    if (!config.senderParticipantCode || !config.receiverParticipantCode || !config.senderUserCode)
      return refuse(res, 500, 'PROXY NOT CONFIGURED');

    const name = req.url.split('/').pop();
    const started = Date.now();
    try {
      const upstream = await send(config.apiBase + req.url, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          // The API answers 400 with an empty message without this header.
          Charset: 'UTF-8',
          'Content-Type': 'application/json',
          'Receiver-Participant-Code': config.receiverParticipantCode,
          'Sender-Participant-Code': config.senderParticipantCode,
          'Sender-User-Code': config.senderUserCode,
          'X-Request-ID': randomUUID().replaceAll('-', ''),
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      const text = await upstream.text();
      console.log(`${name} ${body.billReference} -> HTTP ${upstream.status} in ${Date.now() - started} ms`);
      reply(res, upstream.status, text);
    } catch (e) {
      console.log(`${name} ${body.billReference} -> unreachable after ${Date.now() - started} ms (${e.name})`);
      refuse(res, 502, 'API UNREACHABLE');
    }
  };
}

export const billApi = createBillApi();
