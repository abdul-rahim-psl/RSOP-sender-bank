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

A one-screen demo of a sender-initiated bill payment. The phone is the whole page: centred, and as tall as the window on a laptop. On it, the account holder picks the institution (FBR), enters a 10-character bill reference, looks the bill up and pays it. The bill shows each component's account; once paid, each account shows paid or not paid.

The bill inquiry takes the shape of RSOP's `POST /api/v1/billInquiry`: `institution` and `billReference` in; bill ID, total, currency and one account per component out. Pay sends RSOP's `POST /api/v1/billPayment` with the bill's `billId`, `billReference` and `totalAmount`. Both calls go to RSOP's live API.


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


## Checks

```sh
npm run check
```

This runs two things:

- `astro check`: strict TypeScript across every page, component and data file.
- `npm run check:data`: Node's built-in test runner on `tests/`. It checks:
  - **The calls.** A lookup posts the institution and trimmed reference to the API and returns its reply unchanged; every reference goes to the API, the sample ones included. Paying a looked-up bill posts exactly the bill ID, reference and total the API takes.
  - **The bills.** The institution list is FBR only. A bill reference must be exactly 10 letters or digits. The API's captured bill reads as a complete bill whose components add up and which the account can afford.
  - **The data.** The account holder is fictional.
  - **The proxy.** It forwards only a well-formed FBR inquiry (two fields) or payment (three fields), with the `Charset` header, the participant codes and a fresh `X-Request-ID`. It refuses anything else without calling the API, passes the API's status through, and answers 502 when the API cannot be reached.

## Where things live

| What | File |
|---|---|
| The bill API proxy, and a server for `dist/` with the proxy | `server/bill-api.mjs`, `server/serve.mjs` |
| The proxy's settings: API address, participant codes, timeout | `.env` (from `.env.example`), read by `server/config.mjs` |
| The API's request and reply shapes, FBR, the reference length | `src/data/bills.ts` |
| The bill inquiry and bill payment calls, and the bill reference rule | `src/lib/biller.ts` |
| The paths the page calls on its own server | `src/data/api.ts` |
| The account holder and currency | `src/data/account.ts` |
| Phone (form, bill, result) and the message path on it | `src/components/stage/` |
| Behaviour: lookup, payment, the replay, Clear all | `src/scripts/demo.ts` |
| Layout and components | `src/styles/demo.css` |
| Colour, type and glass tokens, shared with RSOP demo 2 | `src/styles/global.css` |

The page calls `/api/v1/billInquiry` and `/api/v1/billPayment` on its own server, and `server/bill-api.mjs` forwards them: the inquiry to `API_BASE`, the payment to `PAYMENT_BASE_URL` with `PAYMENT_AUTHORIZATION` as its `Authorization` header (or to `API_BASE` when `PAYMENT_BASE_URL` is unset). As of 2026-10-22 the biller answers `401` until that credential is set. The browser can't call the API itself: as of 2026-10-21 the API fails CORS preflight, and Chrome won't let the tunnel's public page call a private address. See [docs/plan.md](docs/plan.md#the-proxy).

## How it behaves

The phone always opens on the Meezan Bank sign-in screen. Any username and password are accepted; nothing is sent.

1. The institution dropdown has one value, FBR. Type a bill reference of exactly 10 letters or digits; it is looked up on the live API. Until the reference is valid, Look up stays disabled and the hint says what is wrong.
2. Press Look up bill. The phone shows the bill: institution, bill reference and bill ID; the four components with their accounts and amounts; the total; and the status, Unpaid. So far the API has answered the same PKR 100,000 bill for every reference, echoing the reference back.
3. Press Pay. The bill stays on screen with the status "Paying", and the phone sends the bill payment (`billId`, `billReference`, `totalAmount`) to the biller. On SUCCESS every component ticks green, the status shows the payment reference and "FBR: SUCCESS", and the balance drops by the total. On any other answer the status says "Payment failed" with the biller's description, and the balance stays the same. Pay another bill returns to the form.

Every outcome opens as a popup over the phone: a green tick for paid; a red cross for a payment the biller refused, or a lookup that failed (for example "Bill already paid") or found no bill. A payment's popup is a receipt: Transaction Successful or Failed, the amount on a panel watermarked with the bank's name, the date and time, From Account (the signed-in username as the account title, a masked fictional account number), To Biller (Federal Board of Revenue, the masked bill reference) and a 6-digit STAN the phone assigns. A lookup error lists the reason, reference and institution instead. Done or Esc closes it; Pay another bill starts over.

The back arrow on the bill goes back to the form with what you typed. Log out, on the form and on the bill, and Clear all both reset the fields, the bill, the balance stop a lookup or payment in progress, and return to the sign-in screen.

## Design

- **The family look.** RSOP demo 2's tokens, fonts (EB Garamond and Nunito, both under the SIL Open Font License), header, theme toggle and popover. Dark is the default. The header carries Clear all and the theme toggle.
- **The reference screen's lights**, redrawn for the bill's components and its status. An unlit light is a grey bulb. A lit one carries an icon as well as a colour: ✓ paid, ✗ not paid, clock unpaid.
- **Layouts.**
  - The phone is centred and as tall as the window, up to 980px; it is half as wide as it is tall, and never narrower than 360px.
  - Windows 880px tall and under use tighter rows, and those 740px tall and under use smaller bill rows, so a whole bill fits on the phone without scrolling. A fit check confirms this at 15 window sizes from 1280×600 to 1920×1080, including laptop screens under browser toolbars (1366×657, 1280×632, 1536×730).
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
| Page heading and intro | The heading is for screen readers only | Unconfirmed |
| Phone-width windows | No frame; the app fills the window | Unconfirmed |
| Keep a list of senders? | No; one fictional account holder on the phone | Confirmed 2026-10-21 |
| Where the bill comes from | RSOP's live API, through a proxy on the demo's server, for every reference | Confirmed 2026-10-22 |
| How Pay reaches billPayment | RSOP's live API, through the same proxy | Confirmed 2026-10-22 |
| API address | `API_BASE` in `.env`: `192.168.9.15:9991` | Confirmed 2026-10-22 |
| When Pay calls billPayment | Straight away; there is no screening step | Confirmed 2026-10-22 |
| A billPayment answer other than SUCCESS | "Payment failed" with the biller's description; balance unchanged | Unconfirmed |
| Institution | A dropdown with FBR only | Confirmed 2026-10-21 |
| Bill reference | Exactly 10 letters or digits | Confirmed 2026-10-21 |
| Paying the same bill twice | Allowed by the phone; how the API treats a repeat is unknown | Unconfirmed |
| Sign-in and logout | The phone opens on a sign-in screen; Log out on every signed-in screen | Confirmed 2026-10-22 |

## Share it

Follow `RSOP demo 2/docs/cloudflare-tunnel.md` with port 4393:

```sh
npm run build
setsid nohup npm run serve >> ~/sender-serve.log 2>&1 &
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4393
```

`server/serve.mjs` accepts the same hosts as the Vite servers: `127.0.0.1`, `localhost` and tunnel addresses. Through a tunnel, the proxy is reachable from the internet. It forwards only well-formed FBR inquiries and payments, and only while this machine can reach the API. Anyone with the tunnel link can then send payments to the API.
