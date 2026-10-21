// Forwards the phone's bill inquiry to RSOP's API from the server, where CORS does not apply, adding the headers the API requires.
// The tunnel makes this server public, so it forwards one endpoint and only a well-formed inquiry.

import { randomUUID } from 'node:crypto';
import { BILL_REF_LENGTH, institutions } from '../src/data/bills.ts';
import { config as defaults } from './config.mjs';

export const INQUIRY_PATH = '/api/v1/billInquiry';
const REF = new RegExp(`^[A-Za-z0-9]{${BILL_REF_LENGTH}}$`);

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
    if (req.url !== INQUIRY_PATH) return next();
    if (req.method !== 'POST') return refuse(res, 405, 'METHOD NOT ALLOWED');

    let body;
    try {
      body = await readJson(req);
    } catch {
      return refuse(res, 400, 'INVALID REQUEST');
    }
    const { institution, billReference } = body ?? {};
    if (!institutions.includes(institution) || typeof billReference !== 'string' || !REF.test(billReference))
      return refuse(res, 400, 'INVALID REQUEST');
    if (!config.senderParticipantCode || !config.receiverParticipantCode || !config.senderUserCode)
      return refuse(res, 500, 'PROXY NOT CONFIGURED');

    const started = Date.now();
    try {
      const upstream = await send(config.apiBase + INQUIRY_PATH, {
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
        body: JSON.stringify({ institution, billReference }),
        signal: AbortSignal.timeout(config.timeoutMs),
      });
      const text = await upstream.text();
      console.log(`billInquiry ${billReference} -> HTTP ${upstream.status} in ${Date.now() - started} ms`);
      reply(res, upstream.status, text);
    } catch (e) {
      console.log(`billInquiry ${billReference} -> unreachable after ${Date.now() - started} ms (${e.name})`);
      refuse(res, 502, 'API UNREACHABLE');
    }
  };
}

export const billApi = createBillApi();
