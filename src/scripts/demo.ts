// Look up a bill from the phone, pay it, then play the payment along the path through screening to the biller.
// Everything visible is rendered at build time; this script only flips data-* state, fills in text and clones row templates.

import { rules, typologies } from '../data/network';
import { account } from '../data/account';
import { SAMPLE_INSTITUTION } from '../data/bills';
import { billInquiry, toBill, type Bill } from '../lib/biller';
import { money } from '../lib/format';
import { hash, screen, type Screening, type Tone } from '../lib/screen';

type Mode = 'form' | 'busy' | 'bill' | 'done';
type Outcome = 'open' | 'paying' | 'paid' | 'alert' | 'stopped';

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const demo = q('[data-demo]');
const screenEl = q('[data-screen]');
const form = q<HTMLFormElement>('[data-inquiry-form]');
const instInput = q<HTMLInputElement>('[data-institution]');
const refInput = q<HTMLInputElement>('[data-bill-ref]');
const hint = q('[data-w-hint]');
const lookupBtn = q<HTMLButtonElement>('[data-lookup]');
const payBtn = q<HTMLButtonElement>('[data-pay]');
const bHint = q('[data-b-hint]');
const caption = q('[data-path-caption]');
const dots = qa('[data-dot]');
const gate = Number(q('[data-path]').dataset.gate);
const panel = q('[data-bill-panel]');
const panelLines = q('[data-bp-lines]');
const panelLineTpl = q<HTMLTemplateElement>('[data-bp-line-tpl]');
const phoneLines = q('[data-b-lines]');
const phoneLineTpl = q<HTMLTemplateElement>('[data-b-line-tpl]');

let balance = account.balance;
let bill: Bill | null = null;
let busy = false;
/** Bumped by Clear all, so a lookup or replay in progress stops at its next step. */
let run = 0;
let seq = 0;
let sends = 0;

function setTone(el: Element, tone: Tone | null) {
  const light = el.matches('.light') ? el : q('.light', el);
  if (tone) light.setAttribute('data-tone', tone);
  else light.removeAttribute('data-tone');
}

function setMode(next: Mode) {
  screenEl.dataset.screen = next;
}

function setBusy(on: boolean) {
  busy = on;
  if (on) demo.dataset.busy = 'true';
  else delete demo.dataset.busy;
}

// ── Inquiry form ──────────────────────────────────────────────────────

/** What still stops the lookup, in the order a person would fix it. */
function check(): { ok: boolean; text: string; focus?: HTMLElement } {
  const inst = instInput.value.trim();
  const ref = refInput.value.trim();
  if (!inst) return { ok: false, text: 'Enter the institution.', focus: instInput };
  if (!ref) return { ok: false, text: 'Enter the bill reference.', focus: refInput };
  return { ok: true, text: `Look up bill ${ref} at ${inst}.` };
}

function renderForm() {
  q('[data-w-balance]').textContent = money(balance);
  for (const chip of qa('[data-sample]'))
    chip.setAttribute('aria-pressed', String(instInput.value.trim() === SAMPLE_INSTITUTION && refInput.value.trim() === chip.dataset.sample));
  const c = check();
  hint.textContent = c.text;
  hint.dataset.ok = String(c.ok);
  delete hint.dataset.error;
  lookupBtn.setAttribute('aria-disabled', String(!c.ok));
}

function tick() {
  const now = new Date();
  q('[data-clock]').textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ── Bill, on the phone and in the panel ───────────────────────────────

function fillLines<T extends HTMLElement>(list: HTMLElement, tpl: HTMLTemplateElement, b: Bill, each: (li: T, c: Bill['components'][number]) => void) {
  list.replaceChildren(
    ...b.components.map((c) => {
      const li = tpl.content.firstElementChild!.cloneNode(true) as T;
      each(li, c);
      return li;
    }),
  );
}

function renderBillScreen(b: Bill) {
  q('[data-b-id]').textContent = b.billId;
  q('[data-b-total]').textContent = money(b.total, b.currency);
  q('[data-b-inst]').textContent = b.institution;
  q('[data-b-ref]').textContent = b.billReference;
  fillLines(phoneLines, phoneLineTpl, b, (li, c) => {
    q('.b-name', li).textContent = c.name;
    q('.b-amt', li).textContent = money(c.amount, b.currency);
  });
  q('[data-pay-label]').textContent = `Pay ${money(b.total, b.currency)}`;
  const short = b.total > balance;
  bHint.textContent = short ? 'That is more than your balance.' : `Splits across ${b.components.length} accounts at ${b.institution}.`;
  bHint.dataset.ok = String(!short);
  payBtn.setAttribute('aria-disabled', String(short));
}

const STATUS: Record<Outcome, { tone: Tone; line: Tone | null; word: string; text: (b: Bill) => string }> = {
  open: { tone: 'wait', line: null, word: 'unpaid', text: () => 'Unpaid' },
  paying: { tone: 'info', line: null, word: 'unpaid', text: () => 'Payment in screening' },
  paid: { tone: 'ok', line: 'ok', word: 'paid', text: (b) => `Paid: ${money(b.total, b.currency)} across ${b.components.length} accounts` },
  alert: { tone: 'warn', line: 'ok', word: 'paid', text: () => 'Paid, with an alert for review' },
  stopped: { tone: 'fail', line: 'fail', word: 'not paid', text: () => 'Not paid: stopped at screening' },
};

function renderPanel(b: Bill | null, outcome: Outcome = 'open') {
  panel.dataset.state = b ? outcome : 'empty';
  if (!b) return;
  q('[data-bp-inst]').textContent = b.institution;
  q('[data-bp-ref]').textContent = b.billReference;
  q('[data-bp-id]').textContent = b.billId;
  q('[data-bp-total]').textContent = money(b.total, b.currency);
  const s = STATUS[outcome];
  fillLines(panelLines, panelLineTpl, b, (li, c) => {
    setTone(li, s.line);
    q('.bill-line-name', li).textContent = c.name;
    q('.bill-line-acct', li).textContent = c.account;
    q('.bill-line-amt', li).textContent = money(c.amount, b.currency);
    q('.bill-line-word', li).textContent = s.word;
  });
  setTone(q('[data-bp-status]'), s.tone);
  q('[data-bp-status-text]').textContent = s.text(b);
}

// ── Path ──────────────────────────────────────────────────────────────

function resetPath() {
  dots.forEach((d) => d.removeAttribute('data-tone'));
  caption.textContent = 'Waiting for a payment';
}

async function replay(res: Screening, token: number) {
  const alive = async (ms: number) => (await sleep(ms), token === run);

  // The payment travels to the screening gate.
  for (let i = 0; i < gate; i++) {
    dots[i]!.dataset.tone = 'info';
    if (!(await alive(110))) return false;
  }
  dots[gate]!.dataset.tone = 'wait';
  caption.textContent = 'Screening the payment';
  q('[data-s-step]').textContent = 'Screening…';

  if (!(await alive(1400))) return false;

  if (res.delivered) {
    dots.slice(0, gate + 1).forEach((d) => (d.dataset.tone = 'ok'));
    for (let i = gate + 1; i < dots.length; i++) {
      dots[i]!.dataset.tone = 'ok';
      if (!(await alive(110))) return false;
    }
  } else {
    dots[gate]!.dataset.tone = 'fail';
  }
  return true;
}

// ── Lookup and payment ────────────────────────────────────────────────

function showBusy(title: string, text: string, step: string) {
  q('[data-s-title]').textContent = title;
  q('[data-s-text]').textContent = text;
  q('[data-s-step]').textContent = step;
  setMode('busy');
}

async function lookup() {
  const inst = instInput.value.trim();
  const ref = refInput.value.trim();
  const token = ++run;
  setBusy(true);
  showBusy('Looking up', `Bill ${ref} at ${inst}`, 'Asking the biller');

  const [res] = await Promise.all([billInquiry({ institution: inst, billReference: ref }), sleep(700)]);
  if (token !== run) return;
  setBusy(false);

  const found = toBill(inst, res);
  if (!found) {
    setMode('form');
    renderForm();
    hint.textContent = `No bill found for reference ${ref}.`;
    hint.dataset.error = 'true';
    refInput.focus();
    return;
  }
  bill = found;
  resetPath();
  renderPanel(bill, 'open');
  renderBillScreen(bill);
  setMode('bill');
  payBtn.focus();
}

async function pay() {
  const b = bill!;
  const token = ++run;
  setBusy(true);

  const id = `TX-${(hash(`${Date.now()}|${++seq}`) & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  const res = screen(rules, typologies, { id, amount: b.total, priorSends: sends++ });

  resetPath();
  renderPanel(b, 'paying');
  showBusy('Paying', `${money(b.total, b.currency)} to ${b.institution}`, 'On its way');
  caption.textContent = `Paying ${money(b.total, b.currency)} to ${b.institution}`;

  if (!(await replay(res, token))) return;

  const alert = res.adjudicator === 'ALRT';
  if (res.delivered) balance = Math.round((balance - b.total) * 100) / 100;
  renderPanel(b, !res.delivered ? 'stopped' : alert ? 'alert' : 'paid');
  caption.textContent = res.delivered
    ? `Paid to ${b.institution}${alert ? ', with an alert for review' : ''}`
    : `Stopped at screening: ${b.institution} received nothing`;

  setTone(q('[data-d-light]'), !res.delivered ? 'fail' : alert ? 'warn' : 'ok');
  q('[data-d-title]').textContent = res.delivered ? 'Paid' : 'Stopped';
  q('[data-d-text]').textContent = res.delivered
    ? `Bill ${b.billReference} is paid.${alert ? ' An alert was raised for review.' : ''}`
    : 'This payment was stopped for review. Your balance is unchanged.';
  q('[data-d-inst]').textContent = b.institution;
  q('[data-d-bill]').textContent = b.billReference;
  q('[data-d-amount]').textContent = money(b.total, b.currency);
  q('[data-d-ref]').textContent = id;

  setBusy(false);
  setMode('done');
  renderForm();
  q<HTMLButtonElement>('[data-new-payment]').focus();
}

// ── Wiring ────────────────────────────────────────────────────────────

for (const input of [instInput, refInput]) input.addEventListener('input', renderForm);

for (const chip of qa<HTMLButtonElement>('[data-sample]')) {
  chip.addEventListener('click', () => {
    instInput.value = SAMPLE_INSTITUTION;
    refInput.value = chip.dataset.sample!;
    renderForm();
  });
}

form.addEventListener('submit', (e) => {
  e.preventDefault();
  if (busy) return;
  const c = check();
  if (!c.ok) {
    hint.dataset.flash = 'true';
    setTimeout(() => delete hint.dataset.flash, 900);
    c.focus?.focus();
    return;
  }
  void lookup();
});

payBtn.addEventListener('click', () => {
  if (busy || !bill) return;
  if (payBtn.getAttribute('aria-disabled') === 'true') {
    bHint.dataset.flash = 'true';
    setTimeout(() => delete bHint.dataset.flash, 900);
    return;
  }
  void pay();
});

q('[data-back]').addEventListener('click', () => {
  bill = null;
  renderPanel(null);
  setMode('form');
  refInput.focus();
});

q('[data-new-payment]').addEventListener('click', () => {
  instInput.value = '';
  refInput.value = '';
  setMode('form');
  renderForm();
  instInput.focus();
});

q('[data-clear-all]').addEventListener('click', () => {
  run++;
  setBusy(false);
  balance = account.balance;
  bill = null;
  sends = 0;
  instInput.value = '';
  refInput.value = '';
  renderPanel(null);
  resetPath();
  setMode('form');
  renderForm();
});

tick();
setInterval(tick, 20_000);
renderForm();
