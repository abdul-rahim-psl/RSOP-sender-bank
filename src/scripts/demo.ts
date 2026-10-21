// Pick a sender and a recipient, send from the phone, then replay the mock screening across the panels.
// Everything visible is rendered at build time; this script only flips data-* state and fills in text.

import { rules, typologies } from '../data/network';
import { firstName, initials, recipients, senders as defaults, type Sender } from '../data/parties';
import { money, parseAmount } from '../lib/format';
import { hash, screen, type Screening, type Tone } from '../lib/screen';

type Mode = 'empty' | 'form' | 'sending' | 'done';

const q = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => root.querySelector<T>(sel)!;
const qa = <T extends Element = HTMLElement>(sel: string, root: ParentNode = document) => [...root.querySelectorAll<T>(sel)];
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const fmt0 = new Intl.NumberFormat('en-US');

const demo = q('[data-demo]');
const screenEl = q('[data-screen]');
const form = q<HTMLFormElement>('[data-send-form]');
const amountInput = q<HTMLInputElement>('[data-amount]');
const hint = q('[data-w-hint]');
const sendBtn = q<HTMLButtonElement>('[data-send]');
const caption = q('[data-path-caption]');
const dots = qa('[data-dot]');
const gate = Number(q('[data-path]').dataset.gate);
const director = q('[data-director]');
const directorText = q('[data-director-text]');
const ruleItems = qa('[data-grid="rule"] [data-lt]');
const typologyItems = qa('[data-grid="typology"] [data-lt]');
const dialog = q<HTMLDialogElement>('[data-dialog]');

let senders: Sender[] = structuredClone(defaults);
let senderId: string | null = null;
let recipientId: string | null = null;
let mode: Mode = 'empty';
let busy = false;
/** Bumped by Clear all, so a replay in progress stops at its next step. */
let run = 0;
let seq = 0;
const sends = new Map<string, number>();

const sender = () => senders.find((s) => s.id === senderId) ?? null;
const recipient = () => recipients.find((r) => r.id === recipientId) ?? null;

function setTone(el: Element, tone: Tone | null) {
  const light = el.matches('.light') ? el : q('.light', el);
  if (tone) light.setAttribute('data-tone', tone);
  else light.removeAttribute('data-tone');
}

// ── Parties ───────────────────────────────────────────────────────────

function renderParties() {
  for (const li of qa('[data-parties="sender"] [data-party]')) {
    const s = senders.find((x) => x.id === li.dataset.party)!;
    q('[data-p-name]', li).textContent = s.name;
    q('[data-p-phone]', li).textContent = s.phone;
    q('[data-p-provider]', li).textContent = s.provider;
    q('[data-p-initials]', li).textContent = initials(s.name);
    q('[data-p-flag]', li).hidden = !s.blocked;
    q('[data-pick]', li).setAttribute('aria-pressed', String(s.id === senderId));
    q('[data-edit]', li).setAttribute('aria-label', `Edit ${s.name}`);
  }
  for (const li of qa('[data-parties="recipient"] [data-party]'))
    q('[data-pick]', li).setAttribute('aria-pressed', String(li.dataset.party === recipientId));
}

function setReceipt(id: string | null, tone?: Tone, text?: string) {
  for (const li of qa('[data-parties="recipient"] [data-party]')) {
    const box = q('[data-receipt]', li);
    const on = li.dataset.party === id;
    box.hidden = !on;
    if (on && tone && text) {
      setTone(box, tone);
      q('[data-receipt-text]', box).textContent = text;
    }
  }
}

// ── Phone ─────────────────────────────────────────────────────────────

function setMode(next: Mode) {
  mode = next;
  screenEl.dataset.screen = next;
}

/** What still stops the Send button, in the order a person would fix it. */
function check(): { ok: boolean; text: string; focus?: HTMLElement } {
  const s = sender();
  const r = recipient();
  const raw = amountInput.value.trim();
  const amount = parseAmount(raw);
  if (!s) return { ok: false, text: 'Pick a sender.' };
  if (!r) return { ok: false, text: 'Pick a recipient.' };
  if (!raw) return { ok: false, text: 'Enter an amount.', focus: amountInput };
  if (amount === null) return { ok: false, text: 'Enter an amount like 2,500 or 2,500.50.', focus: amountInput };
  if (amount > s.balance) return { ok: false, text: 'That is more than the balance.', focus: amountInput };
  return { ok: true, text: `${firstName(r.name)} gets ${money(amount)}.` };
}

function renderPhone() {
  const s = sender();
  if (!s) return setMode('empty');
  if (mode === 'empty') setMode('form');

  q('[data-w-initials]').textContent = initials(s.name);
  q('[data-w-first]').textContent = firstName(s.name);
  q('[data-w-provider]').textContent = s.provider;
  q('[data-w-balance]').textContent = money(s.balance);
  q('[data-w-phone]').textContent = s.phone;
  screenEl.style.setProperty('--pc', `var(--c-${s.color})`);

  const r = recipient();
  const to = q('[data-w-to]');
  to.dataset.empty = String(!r);
  q('[data-w-to-initials]').textContent = r ? initials(r.name) : '?';
  q('[data-w-to-name]').textContent = r ? r.name : 'No recipient yet';
  q('[data-w-to-meta]').textContent = r ? `${r.phone} · ${r.provider}` : 'Pick one from Recipients';
  to.style.setProperty('--pc', r ? `var(--c-${r.color})` : 'var(--c-grey)');

  const amount = parseAmount(amountInput.value);
  for (const chip of qa('[data-quick]')) chip.setAttribute('aria-pressed', String(Number(chip.dataset.quick) === amount));

  const c = check();
  hint.textContent = c.text;
  hint.dataset.ok = String(c.ok);
  sendBtn.setAttribute('aria-disabled', String(!c.ok));
}

function tick() {
  const now = new Date();
  q('[data-clock]').textContent = `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

// ── Monitor ───────────────────────────────────────────────────────────

function resetMonitor() {
  setTone(director, null);
  directorText.textContent = 'Waiting for a payment';
  for (const li of [...ruleItems, ...typologyItems]) {
    setTone(li, null);
    li.removeAttribute('title');
    q('[data-lt-word]', li).textContent = 'not run';
  }
  q('[data-grid="rule"] [data-sum]').textContent = `${rules.length} rules`;
  q('[data-grid="typology"] [data-sum]').textContent = `${typologies.length} typologies`;
  for (const row of qa('[data-al]')) {
    setTone(row, null);
    q('[data-al-text]', row).textContent = 'Not run';
  }
}

function resetPath() {
  dots.forEach((d) => d.removeAttribute('data-tone'));
  caption.textContent = 'Waiting for a payment';
}

function setAlert(key: string, tone: Tone, text: string) {
  const row = q(`[data-al="${key}"]`);
  setTone(row, tone);
  q('[data-al-text]', row).textContent = text;
}

const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;

/** Lights each item in turn; returns false when Clear all cut the replay short. */
async function sweep(items: HTMLElement[], each: (li: HTMLElement) => void, gap: number, token: number) {
  for (const li of items) {
    each(li);
    await sleep(gap);
    if (token !== run) return false;
  }
  return true;
}

async function replay(res: Screening, token: number) {
  const alive = async (ms: number) => (await sleep(ms), token === run);

  // The message travels to the screening gate.
  for (let i = 0; i < gate; i++) {
    dots[i]!.dataset.tone = 'info';
    if (!(await alive(110))) return false;
  }
  dots[gate]!.dataset.tone = 'wait';
  caption.textContent = 'Screening the payment';
  q('[data-s-step]').textContent = 'Screening…';

  setTone(director, 'info');
  directorText.textContent = 'Routing the payment';
  if (!(await alive(500))) return false;
  setTone(director, 'ok');
  directorText.textContent = `Routed to ${rules.length} rules and ${typologies.length} typologies`;

  const hits = new Set(res.hits);
  ruleItems.forEach((li) => setTone(li, 'info'));
  q('[data-grid="rule"] [data-sum]').textContent = 'Evaluating';
  if (!(await alive(350))) return false;
  const ruleDone = await sweep(
    ruleItems,
    (li) => {
      const hit = hits.has(li.dataset.lt!);
      setTone(li, hit ? 'warn' : 'ok');
      q('[data-lt-word]', li).textContent = hit ? 'hit' : 'no hit';
    },
    28,
    token,
  );
  if (!ruleDone) return false;
  q('[data-grid="rule"] [data-sum]').textContent = `${res.hits.length} hit · ${rules.length - res.hits.length} no hit`;

  typologyItems.forEach((li) => setTone(li, 'info'));
  q('[data-grid="typology"] [data-sum]').textContent = 'Evaluating';
  if (!(await alive(300))) return false;
  const byId = new Map(res.typologies.map((t) => [t.id, t]));
  const typoDone = await sweep(
    typologyItems,
    (li) => {
      const t = byId.get(li.dataset.lt!)!;
      const word = t.result === 'interdict' ? 'interdict' : t.result === 'alert' ? 'alert' : 'clear';
      setTone(li, t.result === 'interdict' ? 'fail' : t.result === 'alert' ? 'warn' : 'ok');
      q('[data-lt-word]', li).textContent = `score ${t.score}, ${word}`;
      li.title = `Typology ${t.id}: score ${t.score}, ${word}`;
    },
    32,
    token,
  );
  if (!typoDone) return false;
  const alerts = res.alerting.length - res.interdiction.length;
  q('[data-grid="typology"] [data-sum]').textContent =
    [res.interdiction.length && `${res.interdiction.length} interdict`, alerts && `${alerts} alert`, `${typologies.length - res.alerting.length} clear`]
      .filter(Boolean)
      .join(' · ');

  setAlert('event-flow', res.eventFlowBlock ? 'fail' : 'ok', res.eventFlowBlock ? 'Blocked: sender on the block list' : 'No block');
  if (!(await alive(320))) return false;
  setAlert(
    'typology-processor',
    res.interdiction.length ? 'fail' : 'ok',
    res.interdiction.length ? `Interdiction · ${plural(res.interdiction.length, 'typology', 'typologies')} ${res.interdiction.join(', ')}` : 'No interdiction',
  );
  if (!(await alive(320))) return false;
  setAlert(
    'adjudicator',
    res.adjudicator === 'ALRT' ? 'warn' : 'ok',
    res.adjudicator === 'ALRT' ? `ALRT · ${plural(res.alerting.length, 'typology', 'typologies')} at or over alert` : 'NALT · no alert',
  );
  if (!(await alive(420))) return false;

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

async function send() {
  const s = sender()!;
  const r = recipient()!;
  const amount = parseAmount(amountInput.value)!;
  const token = ++run;
  busy = true;
  demo.dataset.busy = 'true';

  const id = `TX-${(hash(`${Date.now()}|${++seq}`) & 0xffffff).toString(16).toUpperCase().padStart(6, '0')}`;
  const prior = sends.get(s.id) ?? 0;
  sends.set(s.id, prior + 1);
  const res = screen(rules, typologies, { id, amount, senderBlocked: s.blocked, priorSends: prior });

  resetMonitor();
  resetPath();
  setReceipt(null);
  setMode('sending');
  q('[data-s-text]').textContent = `${money(amount)} to ${r.name}`;
  q('[data-s-step]').textContent = 'On its way';
  caption.textContent = `Sending ${money(amount)} to ${r.name}`;

  if (!(await replay(res, token))) return;

  if (res.delivered) s.balance = Math.round((s.balance - amount) * 100) / 100;
  const tone: Tone = !res.delivered ? 'fail' : res.adjudicator === 'ALRT' ? 'warn' : 'ok';
  setReceipt(r.id, res.delivered ? 'ok' : 'fail', res.delivered ? `Received ${money(amount)}` : 'Not delivered');
  caption.textContent = res.delivered
    ? `Delivered to ${r.name}${res.adjudicator === 'ALRT' ? ', with an alert for review' : ''}`
    : `Stopped at screening: ${r.name} received nothing`;

  setTone(q('[data-d-light]'), tone);
  q('[data-d-title]').textContent = res.delivered ? 'Sent' : 'Stopped';
  q('[data-d-text]').textContent = res.delivered
    ? `${firstName(r.name)} received ${money(amount)}.${res.adjudicator === 'ALRT' ? ' An alert was raised for review.' : ''}`
    : res.eventFlowBlock
      ? 'Payments from this account are on hold. Your balance is unchanged.'
      : 'This payment was stopped for review. Your balance is unchanged.';
  q('[data-d-to]').textContent = r.name;
  q('[data-d-amount]').textContent = money(amount);
  q('[data-d-ref]').textContent = id;

  busy = false;
  delete demo.dataset.busy;
  setMode('done');
  renderParties();
  renderPhone();
  q<HTMLButtonElement>('[data-new-payment]').focus();
}

// ── Wiring ────────────────────────────────────────────────────────────

for (const btn of qa<HTMLButtonElement>('[data-parties] [data-pick]')) {
  btn.addEventListener('click', () => {
    if (busy) return;
    const kind = btn.closest<HTMLElement>('[data-parties]')!.dataset.parties;
    if (kind === 'sender') senderId = btn.dataset.pick!;
    else recipientId = btn.dataset.pick!;
    if (mode === 'done') setMode('form');
    renderParties();
    renderPhone();
  });
}

amountInput.addEventListener('input', renderPhone);

for (const chip of qa<HTMLButtonElement>('[data-quick]')) {
  chip.addEventListener('click', () => {
    amountInput.value = fmt0.format(Number(chip.dataset.quick));
    renderPhone();
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
  void send();
});

q('[data-new-payment]').addEventListener('click', () => {
  amountInput.value = '';
  setMode('form');
  renderPhone();
  amountInput.focus();
});

q('[data-clear-all]').addEventListener('click', () => {
  run++;
  busy = false;
  delete demo.dataset.busy;
  if (dialog.open) dialog.close();
  senders = structuredClone(defaults);
  senderId = null;
  recipientId = null;
  sends.clear();
  amountInput.value = '';
  setReceipt(null);
  resetMonitor();
  resetPath();
  setMode('empty');
  renderParties();
  renderPhone();
});

// ── Edit dialog ───────────────────────────────────────────────────────

let editing: string | null = null;
const field = <T extends HTMLInputElement | HTMLSelectElement>(f: string) => q<T>(`[data-f="${f}"]`, dialog);

for (const btn of qa<HTMLButtonElement>('[data-edit]')) {
  btn.addEventListener('click', () => {
    if (busy) return;
    const s = senders.find((x) => x.id === btn.dataset.edit)!;
    editing = s.id;
    q('[data-dialog-title]', dialog).textContent = `Edit ${s.name}`;
    field('name').value = s.name;
    field('phone').value = s.phone;
    field('provider').value = s.provider;
    field('balance').value = String(s.balance);
    field<HTMLInputElement>('blocked').checked = s.blocked;
    dialog.showModal();
  });
}

q('[data-dialog-close]', dialog).addEventListener('click', () => dialog.close());

q<HTMLFormElement>('[data-dialog-form]', dialog).addEventListener('submit', (e) => {
  e.preventDefault();
  const s = senders.find((x) => x.id === editing);
  if (!s) return dialog.close();
  s.name = field('name').value.trim() || s.name;
  s.phone = field('phone').value.trim() || s.phone;
  s.provider = field('provider').value;
  s.balance = Math.max(0, Math.round(Number(field('balance').value) * 100) / 100);
  s.blocked = field<HTMLInputElement>('blocked').checked;
  dialog.close();
  renderParties();
  renderPhone();
  q<HTMLButtonElement>(`[data-edit="${s.id}"]`).focus();
});

tick();
setInterval(tick, 20_000);
renderParties();
renderPhone();
