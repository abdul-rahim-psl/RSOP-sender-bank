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

A one-screen demo of a sender-initiated bill payment. The phone is the whole page: centred, and as tall as the window on a laptop. On it, the account holder picks the institution (FBR), enters a 10-character bill reference, looks the bill up and pays it. The bill shows each component's account; while paying, a message path shows the payment pass through screening, then each account shows paid or not paid.

The bill inquiry takes the shape of RSOP's `POST /api/v1/billInquiry`: `institution` and `billReference` in; bill ID, total, currency and one account per component out. Pay sends RSOP's `POST /api/v1/billPayment` with the bill's `billId`, `billReference` and `totalAmount`. Both calls go to RSOP's live API through a small proxy on the demo's own server (`server/`), because Chrome blocks the page from calling the API directly. The screening and the account balance are still mock.

The screen's structure comes from the debtor half of [pics/UI for sender.png](pics/UI%20for%20sender.png), without its branding or screening panels. The plan is in [docs/plan.md](docs/plan.md). The stack, development rules and look come from `RSOP demo 2/`.

| Route | Screen |
|---|---|
| `/` | The phone, centred; the bill and the message path are on it |

## Run locally

Requires Node.js 22.18 or newer: the proxy and the tests run TypeScript files directly.

```sh
npm install
cp .env.example .env   # then fill in the API address and participant codes
npm run dev       # http://localhost:4321, with the bill API proxy
npm run build     # static output in dist/
npm run serve     # http://127.0.0.1:4393: dist/ plus the bill API proxy
```

`.env` is git-ignored: the repo is public, so the participant codes stay out of it. `npm run preview` still serves `dist/`, but it has no proxy, so lookups and payments fail there.

## Checks

```sh
npm run check
```

This runs two things:

- `astro check`: strict TypeScript across every page, component and data file.
- `npm run check:data`: Node's built-in test runner on `tests/`. It checks:
  - **The calls.** A lookup posts the institution and trimmed reference to the API and returns its reply unchanged; every reference goes to the API, the sample ones included. Paying a looked-up bill posts exactly the bill ID, reference and total the API takes.
  - **The bills.** The institution list is FBR only. A bill reference must be exactly 10 letters or digits, and the sample references are valid. The API's captured bill reads as a complete bill whose components add up and which the account can afford.
  - **The data.** Rule and typology numbers are unique, three digits and in the reference screen's order. Every rule is used by a typology, and every typology can reach interdiction. The account holder is fictional, with a 555-01xx phone number.
  - **The proxy.** It forwards only a well-formed FBR inquiry (two fields) or payment (three fields), with the `Charset` header, the participant codes and a fresh `X-Request-ID`. It refuses anything else without calling the API, passes the API's status through, and answers 502 when the API cannot be reached.
  - **The mock screening.** Every promise in "How it decides" holds across 400 payment IDs per case: the amount bands, the third-payment rule, and scores that follow the rule hits.

## Where things live

| What | File |
|---|---|
| The bill API proxy, and a server for `dist/` with the proxy | `server/bill-api.mjs`, `server/serve.mjs` |
| The proxy's settings: API address, participant codes, timeout | `.env` (from `.env.example`), read by `server/config.mjs` |
| The API's request and reply shapes, FBR, the reference length, sample references | `src/data/bills.ts` |
| The bill inquiry and bill payment calls, and the bill reference rule | `src/lib/biller.ts` |
| The paths the page calls on its own server | `src/data/api.ts` |
| The account holder and currency | `src/data/account.ts` |
| Rule and typology numbers, thresholds, amount bands (used by the mock screening; not shown on screen) | `src/data/network.ts` |
| The mock screening | `src/lib/screen.ts` |
| Phone (form, bill, result) and the message path on it | `src/components/stage/` |
| Behaviour: lookup, payment, the replay, Clear all | `src/scripts/demo.ts` |
| Layout and components | `src/styles/demo.css` |
| Colour, type and glass tokens, shared with RSOP demo 2 | `src/styles/global.css` |

The page calls `/api/v1/billInquiry` on its own server, and `server/bill-api.mjs` forwards it to `API_BASE`. The browser can't call the API itself: as of 2026-10-21 the API fails CORS preflight, and Chrome won't let the tunnel's public page call a private address. See [docs/plan.md](docs/plan.md#the-proxy). To take the payment live too, give `billPayment()` in `src/lib/biller.ts` the same treatment.

## How it behaves

1. The institution dropdown has one value, FBR. Type a bill reference of exactly 10 letters or digits, or tap a sample reference: 1234567890, 4567890123 or 7890123456. All of them, like anything typed, are looked up on the live API. Until the reference is valid, Look up stays disabled and the hint says what is wrong.
2. Press Look up bill. The phone shows the bill: institution, bill reference and bill ID; the four components with their accounts and amounts; the total; and the status, Unpaid. So far the API has answered the same PKR 100,000 bill for every reference, echoing the reference back.
3. Press Pay. The bill stays on screen with the status "Payment in screening". Nine dots appear under it, run to the middle one, which stands for screening, and pause there.
4. If screening stops the payment, the trail stops red there, every component shows ✗ not paid, the balance stays the same, and the biller is never called.
5. Otherwise the phone sends the bill payment (`billId`, `billReference`, `totalAmount`) to the biller. On SUCCESS the dots carry on to the biller, every component ticks green, the status shows the payment reference and "FBR: SUCCESS", and the balance drops by the total. On any other answer the status says "Payment failed" with the biller's description, and the balance stays the same. Pay another bill returns to the form.

With every bill at PKR 100,000, the first two payments raise no alert, and from the third onward each is paid with an alert. "Stopped at screening" needs a bill of PKR 1,000,000 or more, which the API has not returned. The mock rules are listed in "How it decides" on the page and in [docs/plan.md](docs/plan.md#mock-screening). They are invented and are not real rule or typology logic.

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
  - A 61-step scripted walk covers the keyboard and every outcome. It looks up and pays with the keyboard only; checks that the phone is centred and fills the window; checks the FBR dropdown and the 10-character rule, any other reference, going back, the third-payment rule and the balance; checks that every lookup and every completed payment is a request to the page's own server, with the right fields; and runs Clear all mid-payment. It runs against a stand-in API on this laptop, so it never sends real payments.
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
| Where the bill comes from | RSOP's live API, through a proxy on the demo's server, for every reference | Confirmed 2026-10-22 |
| How Pay reaches billPayment | RSOP's live API, through the same proxy | Confirmed 2026-10-22 |
| API address | `API_BASE` in `.env`: `192.168.9.15:9991` | Confirmed 2026-10-22 |
| When Pay calls billPayment | Only after screening passes | Confirmed 2026-10-21 |
| A billPayment answer other than SUCCESS | "Payment failed" with the biller's description; balance unchanged | Unconfirmed |
| Institution | A dropdown with FBR only | Confirmed 2026-10-21 |
| Bill reference | Exactly 10 letters or digits | Confirmed 2026-10-21 |
| Screening bands | Alert from PKR 250,000; stopped from PKR 1,000,000 | Unconfirmed |
| Paying the same bill twice | Allowed by the phone; how the API treats a repeat is unknown | Unconfirmed |
| Where screening happens on the path | At the middle dot, before the biller | Unconfirmed |
| Logout | Dropped; there is no sign-in | Unconfirmed |

## Share it

Follow `RSOP demo 2/docs/cloudflare-tunnel.md` with port 4393:

```sh
npm run build
setsid nohup npm run serve >> ~/sender-serve.log 2>&1 &
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4393
```

`server/serve.mjs` accepts the same hosts as the Vite servers: `127.0.0.1`, `localhost` and tunnel addresses. Through a tunnel, the proxy is reachable from the internet. It forwards only well-formed FBR inquiries and payments, and only while this machine can reach the API. Anyone with the tunnel link can then send payments to the API.
