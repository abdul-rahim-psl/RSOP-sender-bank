# Sender demo

## Contents

- [Overview](#overview)
- [Run locally](#run-locally)
- [Checks](#checks)
- [Where things live](#where-things-live)
- [How it behaves](#how-it-behaves)
- [Design](#design)
- [Decisions applied](#decisions-applied)
- [Share it](#share-it)

## Overview

A one-screen, frontend-only demo of a sender-initiated bill payment. The phone is the whole page: centred, and as tall as the window on a laptop. On it, the account holder picks the institution (FBR), enters a 10-character bill reference, looks the bill up and pays it. The bill shows each component's account; while paying, a message path shows the payment pass through screening, then each account shows paid or not paid.

The bill inquiry takes the shape of RSOP's `POST /api/v1/billInquiry`: `institution` and `billReference` in; bill ID, total, currency and one account per component out. The page answers from a local mock in that exact shape, and connects to nothing.

The screen's structure comes from the debtor half of [pics/UI for sender.png](pics/UI%20for%20sender.png), without its branding or screening panels. The plan is in [docs/plan.md](docs/plan.md). The stack, development rules and look come from `RSOP demo 2/`.

| Route | Screen |
|---|---|
| `/` | The phone, centred; the bill and the message path are on it |

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm install
npm run dev       # http://localhost:4321
npm run build     # static output in dist/
npm run preview   # serve the built site
```

In Astro 7, `npm run preview` starts a background server; stop it with `npx astro preview stop`.

## Checks

```sh
npm run check
```

This runs two things:

- `astro check`: strict TypeScript across every page, component and data file.
- `npm run check:data`: Node's built-in test runner on `tests/`. It checks:
  - **The payment.** Paying a looked-up bill sends exactly the bill ID, reference and total the API takes, and the mock answers the API's SUCCESS reply.
  - **The bills.** Bill 1234567890 matches the API's captured reply byte for byte, and any other reference gets that bill with its reference echoed, as the live API does. The institution list is FBR only. A bill reference must be exactly 10 letters or digits. Every demo bill's components add up to its total, and the account can afford each one. The three demo bills land in the three screening bands.
  - **The data.** Rule and typology numbers are unique, three digits and in the reference screen's order. Every rule is used by a typology, and every typology can reach interdiction. The account holder is fictional, with a 555-01xx phone number.
  - **The mock screening.** Every promise in "How it decides" holds across 400 payment IDs per case: the amount bands, the third-payment rule, and scores that follow the rule hits.

## Where things live

| What | File |
|---|---|
| Demo bills in the API's reply shape, and the not-found reply | `src/data/bills.ts` |
| The bill inquiry and bill payment calls (mock today), and the bill reference rule | `src/lib/biller.ts` |
| The API's address and endpoints | `src/data/api.ts` |
| The account holder and currency | `src/data/account.ts` |
| Rule and typology numbers, thresholds, amount bands (used by the mock screening; not shown on screen) | `src/data/network.ts` |
| The mock screening | `src/lib/screen.ts` |
| Phone (form, bill, result) and the message path on it | `src/components/stage/` |
| Behaviour: lookup, payment, the replay, Clear all | `src/scripts/demo.ts` |
| Layout and components | `src/styles/demo.css` |
| Colour, type and glass tokens, shared with RSOP demo 2 | `src/styles/global.css` |

To call the real API instead of the mock, replace the bodies of `billInquiry()` and `billPayment()` in `src/lib/biller.ts`; the address is `API_BASE` in `src/data/api.ts`. Nothing else reads the mock. The call has to go through a server, not the browser. As of 2026-10-21 the API at `192.168.9.15:9991` still fails CORS preflight, and Chrome won't let the tunnel's public page call a private address. The call also needs a `Charset: UTF-8` header. See [docs/plan.md](docs/plan.md#the-api).

## How it behaves

1. The institution dropdown has one value, FBR. Type a bill reference of exactly 10 letters or digits, or tap a demo bill: 1234567890, 4567890123 or 7890123456. Until the reference is valid, Look up stays disabled and the hint says what is wrong.
2. Press Look up bill. The phone shows the bill: institution, bill reference and bill ID; the four components with their accounts and amounts; the total; and the status, Unpaid. Any valid reference other than the demo bills gets the API's standard PKR 100,000 bill, as the live API does.
3. Press Pay. The bill stays on screen with the status "Payment in screening". Nine dots appear under it, run to the middle one, which stands for screening, and pause there.
4. If screening stops the payment, the trail stops red there, every component shows ✗ not paid, the balance stays the same, and the biller is never called.
5. Otherwise the phone sends the bill payment (`billId`, `billReference`, `totalAmount`) to the biller. On SUCCESS the dots carry on to the biller, every component ticks green, the status shows the payment reference and "FBR: SUCCESS", and the balance drops by the total. On any other answer the status says "Payment failed" with the biller's description, and the balance stays the same. Pay another bill returns to the form.

The three demo bills give the three outcomes: 1234567890 (PKR 100,000, the API's own reply) no alert, 4567890123 (PKR 450,000) an alert but paid, 7890123456 (PKR 1,250,000) stopped. The mock rules are listed in "How it decides" on the page and in [docs/plan.md](docs/plan.md#mock-screening). They are invented and are not real rule or typology logic.

The back arrow on the bill goes back to the form with what you typed. Clear all resets the fields, the bill, the balance and the payment count, and stops a lookup or payment in progress.

## Design

- **The family look.** RSOP demo 2's tokens, fonts (EB Garamond and Nunito, both under the SIL Open Font License), header, theme toggle and popover. Dark is the default. The header carries Mock data, How it decides, Clear all and the theme toggle.
- **The reference screen's lights**, redrawn for the bill's components and its status. An unlit light is a grey bulb. A lit one carries an icon as well as a colour: ✓ paid, ! paid with an alert, ✗ stopped or not paid, clock unpaid.
- **Layouts.**
  - The phone is centred and as tall as the window, up to 980px; it is half as wide as it is tall, and never narrower than 360px.
  - Windows 880px tall and under use tighter rows, and those 740px tall and under use smaller bill rows and hide the path labels, so a whole bill fits on the phone without scrolling. A fit check confirms this at 15 window sizes from 1280×600 to 1920×1080, including laptop screens under browser toolbars (1366×657, 1280×632, 1536×730).
  - At 520px wide and under the window is the phone: no frame, and the page scrolls instead.
- **Accessibility.**
  - axe-core reports no violations in either theme, before a lookup, on the bill and after a stopped payment.
  - A 60-step scripted walk covers the keyboard and every outcome. It looks up and pays with the keyboard only; checks that the phone is centred and fills the window; checks the FBR dropdown and the 10-character rule, any other reference, going back, the third-payment rule and the balance; checks that billPayment is sent only after screening passes; and runs Clear all mid-payment.
  - Every outcome is also written out: the bill's status, read aloud as it changes, and a spoken paid or not paid on each component.

## Decisions applied

| Question | Applied | Status |
|---|---|---|
| Where the bill shows | On the phone, with its component accounts, lights and status | Confirmed 2026-10-21 |
| Phone size | Centred, and as tall as the window on laptops | Confirmed 2026-10-21 |
| Where the message path goes | On the bill, under the status, from Pay onwards | Unconfirmed |
| Page heading and intro | The heading is for screen readers only; How it decides moved into the header | Unconfirmed |
| Phone-width windows | No frame; the app fills the window | Unconfirmed |
| Keep a list of senders? | No; one fictional account holder on the phone | Confirmed 2026-10-21 |
| Where the bill comes from | A local mock in the API's reply shape | Confirmed 2026-10-21 |
| How Pay reaches billPayment | A local mock in the API's request and reply shape | Confirmed 2026-10-21 |
| API address | One setting, `192.168.9.15:9991` | Confirmed 2026-10-21 |
| When Pay calls billPayment | Only after screening passes | Confirmed 2026-10-21 |
| A billPayment answer other than SUCCESS | "Payment failed" with the biller's description; balance unchanged | Unconfirmed |
| Institution | A dropdown with FBR only | Confirmed 2026-10-21 |
| Bill reference | Exactly 10 letters or digits | Confirmed 2026-10-21 |
| Any other valid reference | The API's standard bill, as the live API answers | Unconfirmed |
| Bills 4567890123 and 7890123456 | Invented with the API bill's component split, to reach the alert and stopped outcomes | Unconfirmed |
| Screening bands | Alert from PKR 250,000; stopped from PKR 1,000,000 | Unconfirmed |
| Paying the same bill twice | Allowed; the mock does not mark bills paid | Unconfirmed |
| Where screening happens on the path | At the middle dot, before the biller | Unconfirmed |
| Logout | Dropped; there is no sign-in | Unconfirmed |

## Share it

Follow `RSOP demo 2/docs/cloudflare-tunnel.md` with port 4393:

```sh
npm run build
npx astro preview --port 4393 --host 127.0.0.1
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4393
```

`astro.config.mjs` already allows `.trycloudflare.com` hosts.
