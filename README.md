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

A one-screen, frontend-only demo of a sender-initiated bill payment. On the phone, the account holder enters an institution and a bill reference, looks the bill up, and pays it. The message path shows the payment pass through screening, and the Bill panel shows which of the bill's accounts were paid.

The bill inquiry takes the shape of RSOP's `POST /api/v1/billInquiry`: `institution` and `billReference` in; bill ID, total, currency and one account per component out. The page answers from a local mock in that exact shape, and connects to nothing.

The screen's structure comes from the debtor half of [pics/UI for sender.png](pics/UI%20for%20sender.png), without its branding or screening panels. The plan is in [docs/plan.md](docs/plan.md). The stack, development rules and look come from `RSOP demo 2/`.

| Route | Screen |
|---|---|
| `/` | The phone, the message path and the Bill panel |

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
  - **The bills.** Bill 123 matches the API's captured reply byte for byte. Every demo bill's components add up to its total, and the account can afford each one. The three demo bills land in the three screening bands. An unknown reference is not found.
  - **The data.** Rule and typology numbers are unique, three digits and in the reference screen's order. Every rule is used by a typology, and every typology can reach interdiction. The account holder is fictional, with a 555-01xx phone number.
  - **The mock screening.** Every promise in "How it decides" holds across 400 payment IDs per case: the amount bands, the third-payment rule, and scores that follow the rule hits.

## Where things live

| What | File |
|---|---|
| Demo bills in the API's reply shape, and the not-found reply | `src/data/bills.ts` |
| The bill inquiry call (mock today) and reading its reply | `src/lib/biller.ts` |
| The account holder and currency | `src/data/account.ts` |
| Rule and typology numbers, thresholds, amount bands (used by the mock screening; not shown on screen) | `src/data/network.ts` |
| The mock screening | `src/lib/screen.ts` |
| Phone, message path, Bill panel | `src/components/stage/` |
| Behaviour: lookup, payment, the replay, Clear all | `src/scripts/demo.ts` |
| Layout and components | `src/styles/demo.css` |
| Colour, type and glass tokens, shared with RSOP demo 2 | `src/styles/global.css` |

To call the real API instead of the mock, replace the body of `billInquiry()` in `src/lib/biller.ts`. Nothing else reads the mock. The call has to go through a server, not the browser. RSOP's flow endpoints on the same server send no CORS headers, and the address is private; see [docs/plan.md](docs/plan.md#the-api).

## How it behaves

1. Type an institution and a bill reference, or tap a demo bill. Each demo bill fills in institution `abc` and its reference: 123, 456 or 789.
2. Press Look up bill. The phone shows the bill's total and its four components. The Bill panel shows the same bill with each component's account, marked Unpaid. An unknown reference keeps you on the form with "No bill found".
3. Press Pay. The dots run to the middle one, which stands for screening, and pause there while the phone says Screening….
4. If nothing interdicts, the dots carry on to the biller, every component in the Bill panel ticks green, and the balance drops by the total. Otherwise the trail stops red at screening, every component shows ✗ not paid, and the balance stays the same.

The three demo bills give the three outcomes: 123 (PKR 100,000, the API's own sample) no alert, 456 (PKR 450,000) an alert but paid, 789 (PKR 1,250,000) stopped. The mock rules are listed in "How it decides" on the page and in [docs/plan.md](docs/plan.md#mock-screening). They are invented and are not real rule or typology logic.

Change bill goes back to the form with what you typed. Clear all resets the fields, the bill, the balance and the payment count, and stops a lookup or payment in progress.

## Design

- **The family look.** RSOP demo 2's tokens, fonts (EB Garamond and Nunito, both under the SIL Open Font License), header, theme toggle and popover. Dark is the default.
- **The reference screen's lights**, redrawn for the phone's result, the Bill panel's components and its status. An unlit light is a grey bulb. A lit one carries an icon as well as a colour: ✓ paid, ! paid with an alert, ✗ stopped or not paid, clock unpaid.
- **Layouts.**
  - Wide screens show one row: the phone, the path and the Bill panel.
  - Below 900px the path runs full width under the phone and the bill.
  - Below 640px everything stacks in the order the payment travels: phone, path, bill.
- **Accessibility.**
  - axe-core reports no violations in either theme, before a lookup, on the bill and after a stopped payment.
  - A 59-step scripted walk covers the keyboard and every outcome. It looks up and pays with the keyboard only; checks validation, not found, Change bill, the third-payment rule and the balance; and runs Clear all mid-payment.
  - Every outcome is also written out: Paid or Stopped on the phone, the path caption, the Bill panel's status, and a spoken paid or not paid on each component.

## Decisions applied

| Question | Applied | Status |
|---|---|---|
| What sits where the recipients were? | The Bill panel: the looked-up bill and its component accounts | Confirmed 2026-10-21 |
| Keep a list of senders? | No; one fictional account holder on the phone | Confirmed 2026-10-21 |
| Where the bill comes from | A local mock in the API's reply shape | Confirmed 2026-10-21 |
| The reply for an unknown bill | `{"statusCode":1,"description":"BILL NOT FOUND"}`, invented; the real one has not been seen | Unconfirmed |
| Bills 456 and 789 | Invented with bill 123's component split, to reach the alert and stopped outcomes | Unconfirmed |
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
