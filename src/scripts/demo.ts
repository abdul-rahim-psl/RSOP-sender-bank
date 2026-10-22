// Look up a bill from the phone, pay it, then play the payment along the path through screening to the biller.
// Everything visible is rendered at build time; this script only flips data-* state, fills in text and clones row templates.

import { rules, typologies } from '../data/network';
import { account } from '../data/account';
import { institutions } from '../data/bills';
import { billInquiry, billPayment, billRefProblem, paymentRequest, toBill, type Bill } from '../lib/biller';
import { money } from '../lib/format';
import { hash, screen, type Screening, type Tone } from '../lib/screen';

type Mode = 'form' | 'busy' | 'bill';
type Stage = 'open' | 'paying' | 'paid' | 'alert' | 'stopped' | 'failed';

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const demo = q('[data-demo]');
const screenEl = q('[data-screen]');
const form = q<HTMLFormElement>('[data-inquiry-form]');
const instInput = q<HTMLSelectElement>('[data-institution]');
const refInput = q<HTMLInputElement>('[data-bill-ref]');
const hint = q('[data-w-hint]');
const lookupBtn = q<HTMLButtonElement>('[data-lookup]');
const billScr = q('[data-scr="bill"]');
const lines = q('[data-b-lines]');
const lineTpl = q<HTMLTemplateElement>('[data-b-line-tpl]');
const status = q('[data-b-status]');
const payBtn = q<HTMLButtonElement>('[data-pay]');
const bHint = q('[data-b-hint]');
const dots = qa('[data-dot]');
const gate = Number(q('[data-path]').dataset.gate);

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
  if (!inst) return { ok: false, text: 'Choose the institution.', focus: instInput };
  const problem = billRefProblem(ref);
  if (problem) return { ok: false, text: problem, focus: refInput };
  return { ok: true, text: `Look up bill ${ref} at ${inst}.` };
}

function renderForm() {
  q('[data-w-balance]').textContent = money(balance);
  for (const chip of qa('[data-sample]'))
    chip.setAttribute('aria-pressed', String(refInput.value.trim() === chip.dataset.sample));
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

// ── Bill screen ───────────────────────────────────────────────────────

const STATUS: Record<Stage, { tone: Tone; line: Tone | null; word: string; title: string }> = {
  open: { tone: 'wait', line: null, word: 'unpaid', title: 'Unpaid' },
  paying: { tone: 'info', line: null, word: 'unpaid', title: 'Payment in screening' },
  paid: { tone: 'ok', line: 'ok', word: 'paid', title: 'Paid' },
  alert: { tone: 'warn', line: 'ok', word: 'paid', title: 'Paid, with an alert for review' },
  stopped: { tone: 'fail', line: 'fail', word: 'not paid', title: 'Not paid: stopped at screening' },
  failed: { tone: 'fail', line: 'fail', word: 'not paid', title: 'Payment failed' },
};

/** Fills the bill and sets its stage; the stage drives the lights, the status and which button shows. */
function renderBill(b: Bill, stage: Stage, sub = '') {
  billScr.dataset.stage = stage;
  q('[data-b-inst]').textContent = b.institution;
  q('[data-b-ref]').textContent = b.billReference;
  q('[data-b-id]').textContent = b.billId;
  q('[data-b-total]').textContent = money(b.total, b.currency);
  const s = STATUS[stage];
  lines.replaceChildren(
    ...b.components.map((c) => {
      const li = lineTpl.content.firstElementChild!.cloneNode(true) as HTMLElement;
      setTone(li, s.line);
      q('.bill-line-name', li).textContent = c.name;
      q('.bill-line-acct', li).textContent = c.account;
      q('.bill-line-amt', li).textContent = money(c.amount, b.currency);
      q('.bill-line-word', li).textContent = s.word;
      return li;
    }),
  );
  setTone(status, s.tone);
  status.dataset.tone = s.tone;
  q('[data-b-status-title]').textContent = s.title;
  q('[data-b-status-sub]').textContent = sub;

  q('[data-pay-label]').textContent = `Pay ${money(b.total, b.currency)}`;
  const short = b.total > balance;
  bHint.textContent = short ? 'That is more than your balance.' : `Splits across ${b.components.length} accounts at ${b.institution}.`;
  bHint.dataset.ok = String(!short);
  payBtn.setAttribute('aria-disabled', String(short));
}

// ── Path ──────────────────────────────────────────────────────────────

function resetPath() {
  dots.forEach((d) => d.removeAttribute('data-tone'));
}

/** Waits, then says whether this run is still the current one (Clear all bumps it). */
const alive = async (ms: number, token: number) => (await sleep(ms), token === run);

/** Lights the dots up to the screening gate and holds there; false when Clear all cut it short. */
async function toGate(token: number) {
  for (let i = 0; i < gate; i++) {
    dots[i]!.dataset.tone = 'info';
    if (!(await alive(110, token))) return false;
  }
  dots[gate]!.dataset.tone = 'wait';
  q('[data-b-status-sub]').textContent = 'Screening the payment…';
  return alive(1400, token);
}

/** Past the gate: green to the biller when it accepted, or red on the last dot when it refused. */
async function toBiller(accepted: boolean, token: number) {
  dots.slice(0, gate + 1).forEach((d) => (d.dataset.tone = 'ok'));
  for (let i = gate + 1; i < dots.length; i++) {
    dots[i]!.dataset.tone = accepted || i < dots.length - 1 ? 'ok' : 'fail';
    if (!(await alive(110, token))) return false;
  }
  return true;
}

// ── Lookup and payment ────────────────────────────────────────────────

async function lookup() {
  const inst = instInput.value.trim();
  const ref = refInput.value.trim();
  const token = ++run;
  setBusy(true);
  q('[data-s-text]').textContent = `Bill ${ref} at ${inst}`;
  setMode('busy');

  let res;
  try {
    [res] = await Promise.all([billInquiry({ institution: inst, billReference: ref }), sleep(700)]);
  } catch (e) {
    if (token !== run) return;
    setBusy(false);
    setMode('form');
    renderForm();
    hint.textContent = `Couldn't look the bill up (${(e as Error).message}). Try again.`;
    hint.dataset.error = 'true';
    lookupBtn.focus();
    return;
  }
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
  renderBill(bill, 'open');
  setMode('bill');
  payBtn.focus();
}

async function pay() {
  const b = bill!;
  const token = ++run;
  setBusy(true);

  const id = `TX-${(hash(`${Date.now()}|${++seq}`) & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  const res: Screening = screen(rules, typologies, { id, amount: b.total, priorSends: sends++ });

  resetPath();
  renderBill(b, 'paying', `${money(b.total, b.currency)} on its way to ${b.institution}`);
  if (!(await toGate(token))) return;

  // Only a payment that clears screening is sent to the biller.
  let stage: Stage;
  let sub: string;
  if (!res.delivered) {
    dots[gate]!.dataset.tone = 'fail';
    stage = 'stopped';
    sub = `Ref ${id} · balance unchanged`;
  } else {
    q('[data-b-status-sub]').textContent = `Sending the payment to ${b.institution}…`;
    const [reply] = await Promise.all([
      billPayment(paymentRequest(b)).catch((e: Error) => ({ statusCode: -1, description: e.message })),
      sleep(600),
    ]);
    if (token !== run) return;
    const accepted = reply.statusCode === 0;
    if (!(await toBiller(accepted, token))) return;
    if (accepted) {
      balance = Math.round((balance - b.total) * 100) / 100;
      stage = res.adjudicator === 'ALRT' ? 'alert' : 'paid';
      sub = `Ref ${id} · ${b.institution}: ${reply.description}`;
    } else {
      stage = 'failed';
      sub = `${b.institution}: ${reply.description || 'no answer'} · balance unchanged`;
    }
  }
  renderBill(b, stage, sub);

  setBusy(false);
  renderForm();
  q<HTMLButtonElement>('[data-new-payment]').focus();
}

// ── Wiring ────────────────────────────────────────────────────────────

instInput.addEventListener('change', renderForm);
refInput.addEventListener('input', renderForm);

for (const chip of qa<HTMLButtonElement>('[data-sample]')) {
  chip.addEventListener('click', () => {
    instInput.value = institutions[0]!;
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
  if (busy) return;
  bill = null;
  setMode('form');
  refInput.focus();
});

q('[data-new-payment]').addEventListener('click', () => {
  bill = null;
  instInput.selectedIndex = 0;
  refInput.value = '';
  setMode('form');
  renderForm();
  refInput.focus();
});

q('[data-clear-all]').addEventListener('click', () => {
  run++;
  setBusy(false);
  balance = account.balance;
  bill = null;
  sends = 0;
  instInput.selectedIndex = 0;
  refInput.value = '';
  resetPath();
  setMode('form');
  renderForm();
});

tick();
setInterval(tick, 20_000);
renderForm();
