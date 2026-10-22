# Sender Demo: Plan

## Contents

- [Goal](#goal)
- [Source and content rules](#source-and-content-rules)
- [Bill inquiry and payment](#bill-inquiry-and-payment)
  - [The API](#the-api)
  - [Bill payment](#bill-payment)
  - [The proxy](#the-proxy)
  - [Lookups and payments](#lookups-and-payments)
- [What changes from the reference screen](#what-changes-from-the-reference-screen)
- [Layout](#layout)
- [How a payment plays out](#how-a-payment-plays-out)
- [Stack](#stack)
- [Quality checks](#quality-checks)
- [Decisions applied](#decisions-applied)

## Goal

A one-screen, clickable demo of a sender-initiated bill payment. The phone is the whole page, centred and as tall as the window. On it, the account holder picks the institution (FBR), enters a 10-character bill reference, looks the bill up and pays it. The bill shows its component accounts, and each account shows paid or not paid once the payment is done. Bill lookups and payments go to RSOP's live API through a proxy on the demo's own server; the account balance is mock.

## Source and content rules

| Source | Used for |
|---|---|
| [pics/UI for sender.png](../pics/UI%20for%20sender.png) | The phone and its bill-payment flow |
| RSOP's `POST /api/v1/billInquiry` and `POST /api/v1/billPayment` | The phone's two inputs, the bill's shape, and what Pay sends; see [Bill inquiry and payment](#bill-inquiry-and-payment) |
| `RSOP demo 2/` | Development rules, stack, tokens, fonts, theme toggle, header, popover and status conventions |

1. **The API is the authority for the bill.** Its two inputs are the phone's only inputs. Its reply fields and their order are what the phone shows.
2. **The phone's input rules.** Institution is a dropdown with one value, FBR. A bill reference is exactly 10 letters or digits; Look up stays disabled until it is. The API itself enforces neither rule; see [The API](#the-api).
3. **No product branding.** No logo, product name, version, tenant or account address from the reference screen. Participant codes from the API's headers are not shown.
4. **Fictional data only.** The account holder is invented. Phone numbers use the 555-01xx range set aside for fiction.

## Bill inquiry and payment

### The API

Captured with curl on 2026-10-21 against `http://192.168.9.15:9991`:

```http
POST /api/v1/billInquiry
Content-Type: application/json
Charset: UTF-8
Sender-Participant-Code, Receiver-Participant-Code, Sender-User-Code, X-Request-ID

{ "institution": "FBR", "billReference": "1234567890" }
```

```json
{"statusCode":0,"description":"SUCCESS","billId":"12345","billReference":"1234567890","total":"100000","currency":"PKR",
 "billInquiryAccounts":[
  {"componentName":"Custom duty","componentAccount":"1111111111","componentAmount":"40000"},
  {"componentName":"Sales tax","componentAccount":"2222222222","componentAmount":"35000"},
  {"componentName":"Withholding tax","componentAccount":"3333333333","componentAmount":"20000"},
  {"componentName":"Other levy","componentAccount":"4444444444","componentAmount":"5000"}]}
```

All of the following were checked live on 2026-10-21 at about 23:25 PKT:

- **The `Charset: UTF-8` header is required.** Without it the API answers `400 Bad Request` with an empty message, whatever the body.
- **It returns the same bill for any input.** Bill ID 12345, PKR 100,000, the same four components, with the bill reference echoed back. With the header, it accepted institution `abc` as well as `FBR`, and the 3-character reference `123` as well as `1234567890` and `AB12CD34EF`. So the FBR and 10-character rules are the phone's alone. References over 10 characters or with symbols were only sent without the header, and the API stopped answering this laptop at about 23:30 PKT before they could be retried.
- Amounts are strings in whole rupees, and the components add up to the total.
- The reply does not echo the institution, so the phone keeps the one the person picked.
- **The browser cannot call it: CORS still blocks.**
  - The `OPTIONS` preflight returns `403` with no `Access-Control-Allow-Origin` for every origin tried: `http://127.0.0.1:4393`, `localhost` on ports 3000, 4321, 4393, 5173 and 8080, `null` and the tunnel's address. Only the API's own origin, `http://192.168.9.15:9991`, passes.
  - From the demo at `http://127.0.0.1:4393`, Chrome reports: "blocked by CORS policy: Response to preflight request doesn't pass access control check: No 'Access-Control-Allow-Origin' header is present".
  - From the tunnel's `https` address, Chrome refuses earlier, before CORS: a public page may not call a private address ("Permission was denied for this request to access the `unknown` address space"). Allowing CORS on the API would not fix this case; only a proxy on the demo's own origin would.

### Bill payment

The request and reply, as run with curl by the user on 2026-10-21 against `10.0.70.144`, the same API on its other address:

```http
POST /api/v1/billPayment
Content-Type: application/json
Charset: UTF-8
Sender-Participant-Code, Receiver-Participant-Code, Sender-User-Code, X-Request-ID

{ "billId": "852147", "billReference": "123", "totalAmount": "100000" }
```

```json
{"statusCode":0,"description":"SUCCESS"}
```

- The body carries the bill ID, the bill reference and the total from the inquiry, all as strings.
- Pay sends it straight away.
- `statusCode` 0 means paid. Any other code, or no answer, ends in "Payment failed" with the biller's description, and the balance is unchanged. Only SUCCESS has been seen so far.
- Pay sends it live through the proxy below.

### The proxy

The page calls `POST /api/v1/billInquiry` and `POST /api/v1/billPayment` on its own origin, so neither CORS nor Chrome's private-address rule applies. `server/bill-api.mjs` forwards both to the API:

- **Where it runs.** `npm run serve` (`server/serve.mjs`, on port 4393, serving `dist/` too) and `npm run dev` (through an Astro integration in `astro.config.mjs`).
- **Settings.** `API_BASE`, default `http://192.168.9.15:9991`; the three participant codes; and `API_TIMEOUT_MS`, default 8,000. They are read from `.env`, which is git-ignored because the repo is public. `.env.example` lists them.
- **What it adds.** `Charset: UTF-8`, the three participant-code headers and a fresh 32-hex-digit `X-Request-ID` per call.
- **What it accepts.** Only the two paths, only `POST`, and only well-formed bodies: an inquiry with `institution` FBR and a 10-letter-or-digit reference, or a payment with a `billId` of letters, digits or hyphens, the same kind of reference, and a `totalAmount` string of digits with up to two decimals. It forwards just those fields. Anything else gets a 400 (or 405) without reaching the API. The tunnel makes this server public, so this keeps it from being used as a general way into the private network; it does not stop anyone with the link from sending well-formed payments.
- **What it answers.** The API's status and body unchanged; 502 `API UNREACHABLE` when the API can't be reached in time; 500 `PROXY NOT CONFIGURED` when a participant code is missing. For a lookup the phone shows "Couldn't look the bill up (…). Try again."; for a payment, "Payment failed" with the description, and the balance unchanged.
- **Logs.** One line per call to stdout: the reference, the API's status and the time taken. With `npm run serve` started as in the README, that's `~/sender-serve.log`.

Verified live on 2026-10-21 at about 23:50 PKT, from `http://127.0.0.1:4393`: lookups through the proxy came back from `192.168.9.15` with HTTP 200 in 16 to 460 ms. With the API pointed at an address with nothing listening, the phone showed "Couldn't look the bill up (API UNREACHABLE). Try again."

Verified on 2026-10-22 at about 00:00 PKT against a stand-in API on this laptop, so no real payments were sent: every completed payment sent exactly one `billPayment` with the bill's ID, reference and total; a payment cut short by Clear all sent none; and a declined payment showed "Payment failed · FBR: DECLINED BY BILLER · balance unchanged". A live payment through `192.168.9.15` could not be checked at 00:02 PKT: the lookup before it timed out.

### Lookups and payments

`billInquiry()` and `billPayment()` in `src/lib/biller.ts` post to the page's own server, which forwards them live. The three quick-fill references on the phone are just samples; they are looked up live like anything typed.

| Call | What the API has answered so far |
|---|---|
| Bill inquiry, any reference | The same bill: ID 12345, PKR 100,000, four components, the reference echoed |
| Bill payment | `{"statusCode":0,"description":"SUCCESS"}` |

A lookup reply whose `statusCode` is not 0 shows "No bill found" on the phone; a payment reply whose `statusCode` is not 0 shows "Payment failed". The live API has produced neither.

## What changes from the reference screen

| Reference screen | This demo |
|---|---|
| Two phones, debtor and creditor | One phone, the sender's |
| Debtors list | Removed; one account holder owns the phone |
| Creditors list and creditor phone | Replaced by the bill on the phone: its component accounts and whether each was paid |
| A Send button and nothing else on the phone | Institution and bill reference, Look up bill, the bill, then Pay |
| Event director, Rules, Typologies and Alerts panels | Removed; the bill's status and the outcome popup show the result |
| Nine dots between the two phones | On the phone, under the bill's status, from Pay onwards |
| Product logo, version, account email and tenant | Removed; RSOP-style brand mark, "Mock data" pill and theme toggle instead |
| Clear All, Logout | Clear all kept; Logout dropped, as there is no sign-in |
| Grey lights only | Lights carry an icon and a word as well as a colour |

## Layout

- **Laptops and wider.** The phone alone, centred, as tall as the window up to 980px. It is half as wide as tall and never narrower than 360px, so bill rows don't wrap.
- **Short windows.** At 880px tall and under the rows tighten; at 740px and under the bill rows shrink and the path labels hide. A whole bill fits without scrolling down to a 560px-tall phone; below that the page scrolls.
- **Phone widths.** At 520px wide and under the window is the phone: no frame, no fake status bar, and the page scrolls with no sideways scroll.

The phone has three screens: the bill form, a busy screen while looking up, and the bill, which stays on screen through the payment. The bill's stage (unpaid, paying, paid, failed) decides its lights, its status and which button shows.

## How a payment plays out

1. Pick the institution, FBR, and enter a 10-character bill reference, or tap one of the three sample references.
2. Press Look up bill. The phone shows the bill: institution, bill reference and bill ID, the four components with their accounts, the total, and the status Unpaid.
3. Press Pay. The status changes to "Paying", and the phone sends the bill payment to the biller.
4. On SUCCESS each component ticks green, the balance drops by the total, and a popup shows the amount, the payment reference and the biller's answer. On any other answer the popup says "Payment failed" with the biller's description, and the balance stays the same.

## Stack

As in RSOP demo 2: Astro 7.3 with static output, plus a dependency-free Node server (`server/`) for the bill inquiry proxy; strict TypeScript, hand-written CSS with RSOP's tokens, vanilla TypeScript in Astro `<script>` tags, EB Garamond and Nunito self-hosted, dark by default with a light toggle, and `npm run check` (`astro check` plus `node --test`).

## Quality checks

| Check | How |
|---|---|
| Builds cleanly | `npm run build` |
| The calls match the API | `npm run check` checks what the page posts for a lookup and a payment, and what the proxy forwards: path, headers and fields |
| Data is sound | The API's bill adds up |
| Looks right | Screenshots in both themes, before a lookup, on the bill and after each outcome; a fit check at 15 window sizes that every phone screen fits without inner scrolling |
| Accessible | axe-core in both themes; keyboard-only lookup and payment |

## Decisions applied

| Question | Applied | Status |
|---|---|---|
| What replaces the creditors list? | The bill, on the phone | Confirmed 2026-10-21 |
| Phone size | Centred, as tall as the window on laptops | Confirmed 2026-10-21 |
| Where the message path goes | On the bill, from Pay onwards | Unconfirmed |
| Phone-width windows | No frame; the app fills the window | Unconfirmed |
| Keep a debtors list? | No; one fictional account holder | Confirmed 2026-10-21 |
| Where the bill comes from | RSOP's live API through a proxy on the demo's server, for every reference | Confirmed 2026-10-22 |
| How Pay reaches billPayment | RSOP's live API, through the same proxy | Confirmed 2026-10-22 |
| API address | `API_BASE` in `.env`: `192.168.9.15:9991` | Confirmed 2026-10-22 |
| When Pay calls billPayment | Straight away; there is no screening step | Confirmed 2026-10-22 |
| A billPayment answer other than SUCCESS | "Payment failed" with the biller's description; balance unchanged | Unconfirmed |
| Institution | A dropdown with FBR only | Confirmed 2026-10-21 |
| Bill reference | Exactly 10 letters or digits | Confirmed 2026-10-21 |
| Paying the same bill twice | Allowed by the phone | Unconfirmed |
