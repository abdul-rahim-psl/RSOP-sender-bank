// Sign in on the phone, look up a bill and pay it; the outcome of each lookup and payment opens as a popup.
// Everything visible is rendered at build time; this script only flips data-* state, fills in text and clones row templates.

import { account, initials } from '../data/account';
import { billInquiry, billPayment, billRefProblem, paymentRequest, toBill, type Bill } from '../lib/biller';
import { money } from '../lib/format';
import type { Tone } from '../lib/tone';

type Mode = 'login' | 'form' | 'busy' | 'bill';
type Stage = 'open' | 'paying' | 'paid' | 'failed';

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

const demo = q('[data-demo]');
const screenEl = q('[data-screen]');
const loginForm = q<HTMLFormElement>('[data-login-form]');
const loginUser = q<HTMLInputElement>('[data-login-user]');
const loginPass = q<HTMLInputElement>('[data-login-pass]');
const loginHint = q('[data-l-hint]');
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
const pop = q('[data-pop]');
const popCard = q('[data-pop-card]');
const popFacts = q('[data-pop-facts]');
const popPrimary = q<HTMLButtonElement>('[data-pop-primary]');
const popSecondary = q<HTMLButtonElement>('[data-pop-secondary]');

let balance = account.balance;
let bill: Bill | null = null;
let busy = false;
/** Bumped by Clear all, so a lookup or replay in progress stops at its next step. */
let run = 0;

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

// ── Outcome popup ─────────────────────────────────────────────────────

type PopTone = 'ok' | 'fail';
interface PopAction {
  label: string;
  run?: () => void;
}
interface Pop {
  tone: PopTone;
  kicker: string;
  title: string;
  amount?: string;
  text?: string;
  /** Label, value, and whether the value is an ID set in mono. */
  facts?: [string, string, boolean?][];
  primary: PopAction;
  secondary?: PopAction;
}

let onClose: (() => void) | undefined;

/** Shows a lookup's or a payment's outcome over the phone; the screens behind it can't be reached until it closes. */
function showPop(o: Pop) {
  popCard.dataset.tone = o.tone;
  q('[data-pop-kicker]').textContent = o.kicker;
  q('[data-pop-title]').textContent = o.title;
  q('[data-pop-amount]').textContent = o.amount ?? '';
  q('[data-pop-text]').textContent = o.text ?? '';
  popFacts.replaceChildren(
    ...(o.facts ?? []).map(([label, value, mono]) => {
      const row = document.createElement('div');
      const dt = document.createElement('dt');
      const dd = document.createElement('dd');
      dt.textContent = label;
      dd.textContent = value;
      if (mono) dd.className = 'mono';
      row.append(dt, dd);
      return row;
    }),
  );
  popPrimary.textContent = o.primary.label;
  popPrimary.onclick = () => closePop(o.primary.run);
  popSecondary.hidden = !o.secondary;
  popSecondary.textContent = o.secondary?.label ?? '';
  popSecondary.onclick = () => closePop(o.secondary?.run);
  onClose = o.primary.run;
  qa('.scr').forEach((el) => (el.inert = true));
  pop.hidden = false;
  popPrimary.focus();
}

function closePop(then?: () => void) {
  if (pop.hidden) return;
  pop.hidden = true;
  qa('.scr').forEach((el) => (el.inert = false));
  onClose = undefined;
  then?.();
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && !pop.hidden) closePop(onClose);
});

const changeRef = () => {
  refInput.focus();
  refInput.select();
};

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
  paying: { tone: 'info', line: null, word: 'unpaid', title: 'Paying' },
  paid: { tone: 'ok', line: 'ok', word: 'paid', title: 'Paid' },
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

/** Waits, then says whether this run is still the current one (Clear all bumps it). */
const alive = async (ms: number, token: number) => (await sleep(ms), token === run);

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
    showPop({
      tone: 'fail',
      kicker: 'Bill lookup',
      title: "Couldn't look up the bill",
      text: `${inst} didn't return bill ${ref}.`,
      facts: [
        ['Reason', (e as Error).message],
        ['Bill reference', ref, true],
        ['Institution', inst],
      ],
      primary: { label: 'Change reference', run: changeRef },
    });
    return;
  }
  if (token !== run) return;
  setBusy(false);

  const found = toBill(inst, res);
  if (!found) {
    setMode('form');
    renderForm();
    showPop({
      tone: 'fail',
      kicker: 'Bill lookup',
      title: 'No bill found',
      text: `No bill at ${inst} matches this reference.`,
      facts: [
        ['Bill reference', ref, true],
        ['Institution', inst],
      ],
      primary: { label: 'Change reference', run: changeRef },
    });
    return;
  }
  bill = found;
  renderBill(bill, 'open');
  setMode('bill');
  payBtn.focus();
}

async function pay() {
  const b = bill!;
  const token = ++run;
  setBusy(true);
  const id = `TX-${Math.floor(Math.random() * 0x1000000).toString(16).toUpperCase().padStart(6, '0')}`;
  renderBill(b, 'paying', `Sending ${money(b.total, b.currency)} to ${b.institution}…`);

  const [reply] = await Promise.all([
    billPayment(paymentRequest(b)).catch((e: Error) => ({ statusCode: -1, description: e.message })),
    sleep(600),
  ]);
  if (!(await alive(0, token))) return;
  const paid = reply.statusCode === 0;
  if (paid) balance = Math.round((balance - b.total) * 100) / 100;
  renderBill(
    b,
    paid ? 'paid' : 'failed',
    paid ? `Ref ${id} · ${b.institution}: ${reply.description}` : `${b.institution}: ${reply.description || 'no answer'} · balance unchanged`,
  );

  setBusy(false);
  renderForm();
  const again = q<HTMLButtonElement>('[data-new-payment]');
  showPop(outcome(paid, b, id, reply, again));
}

/** The popup for a finished payment: what happened, how much, and the IDs to quote. */
function outcome(paid: boolean, b: Bill, id: string, reply: { description?: string }, again: HTMLButtonElement): Pop {
  const done = { label: 'Done', run: () => again.focus() };
  const another = { label: 'Pay another bill', run: () => again.click() };
  const ids: [string, string, boolean?][] = [
    ['Bill reference', b.billReference, true],
    ['Payment ref', id, true],
  ];
  return paid
    ? {
        tone: 'ok',
        kicker: 'Payment successful',
        title: `Paid to ${b.institution}`,
        amount: money(b.total, b.currency),
        facts: [...ids, [`${b.institution} replied`, reply.description || 'SUCCESS'], ['New balance', money(balance)]],
        primary: done,
        secondary: another,
      }
    : {
        tone: 'fail',
        kicker: 'Payment failed',
        title: `${b.institution} didn't accept the payment`,
        amount: money(b.total, b.currency),
        text: 'Nothing was taken from your balance.',
        facts: [['Reason', reply.description || 'No answer'], ...ids, ['Balance', money(balance)]],
        primary: done,
        secondary: another,
      };
}

// ── Wiring ────────────────────────────────────────────────────────────

instInput.addEventListener('change', renderForm);
refInput.addEventListener('input', renderForm);

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

// ── Sign in and out ───────────────────────────────────────────────────

const LOGIN_HINT = loginHint.textContent ?? '';

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const empty = !loginUser.value.trim() ? loginUser : !loginPass.value ? loginPass : null;
  if (empty) {
    loginHint.textContent = empty === loginUser ? 'Enter your username.' : 'Enter your password.';
    loginHint.dataset.error = '';
    empty.focus();
    return;
  }
  // The phone greets whoever signed in, by the username they typed.
  const user = loginUser.value.trim();
  q('[data-w-hi]').textContent = `Hi, ${user}`;
  q('[data-w-avatar]').textContent = initials(user) || user[0]!.toUpperCase();
  loginPass.value = '';
  setMode('form');
  renderForm();
  refInput.focus();
});

/** Logging out and Clear all both end every run, reset the account and go back to the sign-in screen. */
function signOut() {
  closePop();
  run++;
  setBusy(false);
  balance = account.balance;
  bill = null;
  instInput.selectedIndex = 0;
  refInput.value = '';
  renderForm();
  loginUser.value = '';
  loginPass.value = '';
  loginHint.textContent = LOGIN_HINT;
  delete loginHint.dataset.error;
  setMode('login');
  loginUser.focus();
}

qa('[data-logout]').forEach((b) => b.addEventListener('click', signOut));
q('[data-clear-all]').addEventListener('click', signOut);

tick();
setInterval(tick, 20_000);
renderForm();
