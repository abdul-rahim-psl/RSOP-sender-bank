# Sender Demo: Plan

## Contents

- [Goal](#goal)
- [Source and content rules](#source-and-content-rules)
- [Bill inquiry and payment](#bill-inquiry-and-payment)
  - [The API](#the-api)
  - [Bill payment](#bill-payment)
  - [The mock](#the-mock)
- [What changes from the reference screen](#what-changes-from-the-reference-screen)
- [Layout](#layout)
- [How a payment plays out](#how-a-payment-plays-out)
- [Mock screening](#mock-screening)
- [Stack](#stack)
- [Quality checks](#quality-checks)
- [Decisions applied](#decisions-applied)

## Goal

A one-screen, clickable demo of a sender-initiated bill payment. The phone is the whole page, centred and as tall as the window. On it, the account holder picks the institution (FBR), enters a 10-character bill reference, looks the bill up and pays it. The bill shows its component accounts; while paying, a message path shows the payment pass through screening before it reaches the biller, and each account then shows paid or not paid. It runs on mock data only and connects to nothing.

## Source and content rules

| Source | Used for |
|---|---|
| [pics/UI for sender.png](../pics/UI%20for%20sender.png) | The phone, the nine message dots, and the rule and typology numbers the mock screening uses |
| RSOP's `POST /api/v1/billInquiry` and `POST /api/v1/billPayment` | The phone's two inputs, the bill's shape, and what Pay sends; see [Bill inquiry and payment](#bill-inquiry-and-payment) |
| `RSOP demo 2/` | Development rules, stack, tokens, fonts, theme toggle, header, popover and status conventions |

1. **The API is the authority for the bill.** Its two inputs are the phone's only inputs. Its reply fields and their order are what the phone shows.
2. **The phone's input rules.** Institution is a dropdown with one value, FBR. A bill reference is exactly 10 letters or digits; Look up stays disabled until it is. The API itself enforces neither rule; see [The API](#the-api).
3. **No product branding.** No logo, product name, version, tenant or account address from the reference screen. Participant codes from the API's headers are not shown.
4. **Fictional data only.** The account holder is invented. Phone numbers use the 555-01xx range set aside for fiction.
5. **Mock outcomes are labelled as mock.** The screening outcomes come from invented rules of thumb, not from real rule or typology logic. The header's Mock data label and How it decides say so.

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
- Pay sends it only after the payment clears screening. A payment stopped at screening never reaches the biller.
- `statusCode` 0 means paid. Any other code, or no answer, ends in "Payment failed" with the biller's description, and the balance is unchanged. Only SUCCESS has been seen so far.
- The API's address is one setting, `API_BASE` in `src/data/api.ts`, set to `http://192.168.9.15:9991`. The page does not call it; see the CORS findings in [The API](#the-api).

### The mock

`billInquiry()` and `billPayment()` in `src/lib/biller.ts` take the same requests and return the same reply shapes. `billPayment()` answers `{"statusCode":0,"description":"SUCCESS"}`, as the API did. `billInquiry()` answers from `src/data/bills.ts`:

| Bill reference | Total | Source | Outcome |
|---|---|---|---|
| 1234567890 | PKR 100,000 | The API's reply, unchanged | No alert |
| 4567890123 | PKR 450,000 | Invented, same 40/35/20/5 split and accounts | Alert, still paid |
| 7890123456 | PKR 1,250,000 | Invented, same split and accounts | Stopped |
| Any other valid reference | PKR 100,000 | The API's reply, with the reference echoed, as the live API does | No alert |

The mock matches on the bill reference only. A reply whose `statusCode` is not 0 still shows "No bill found" on the phone, though neither the mock nor the live API has produced one. Replacing `billInquiry()` and `billPayment()` with server-side calls to the API is the only change a live version needs.

## What changes from the reference screen

| Reference screen | This demo |
|---|---|
| Two phones, debtor and creditor | One phone, the sender's |
| Debtors list | Removed; one account holder owns the phone |
| Creditors list and creditor phone | Replaced by the bill on the phone: its component accounts and whether each was paid |
| A Send button and nothing else on the phone | Institution and bill reference, Look up bill, the bill, then Pay |
| Event director, Rules, Typologies and Alerts panels | Removed; the path and the bill's status on the phone show the outcome |
| Nine dots between the two phones | On the phone, under the bill's status, from Pay onwards |
| Product logo, version, account email and tenant | Removed; RSOP-style brand mark, "Mock data" pill and theme toggle instead |
| Clear All, Logout | Clear all kept; Logout dropped, as there is no sign-in |
| Grey lights only | Lights carry an icon and a word as well as a colour |

## Layout

- **Laptops and wider.** The phone alone, centred, as tall as the window up to 980px. It is half as wide as tall and never narrower than 360px, so bill rows don't wrap.
- **Short windows.** At 880px tall and under the rows tighten; at 740px and under the bill rows shrink and the path labels hide. A whole bill fits without scrolling down to a 560px-tall phone; below that the page scrolls.
- **Phone widths.** At 520px wide and under the window is the phone: no frame, no fake status bar, and the page scrolls with no sideways scroll.

The phone has three screens: the bill form, a busy screen while looking up, and the bill, which stays on screen through the payment. The bill's stage (unpaid, in screening, paid, paid with an alert, stopped) decides its lights, its status and which button shows.

## How a payment plays out

1. Pick the institution, FBR, and enter a 10-character bill reference, or tap one of the three demo bills.
2. Press Look up bill. The phone shows the bill: institution, bill reference and bill ID, the four components with their accounts, the total, and the status Unpaid.
3. Press Pay. The status changes to "Payment in screening", and the dots under it light up to the middle one, which stands for screening.
4. The payment pauses at the screening dot.
5. If something interdicts, the trail stops red at screening, each component shows not paid, and the status says the payment was stopped. The biller is never called.
6. Otherwise the phone sends the bill payment to the biller ("Sending the payment to FBR…"). On SUCCESS the dots carry on to the biller, each component ticks green, the status shows the payment reference and the biller's answer, and the balance drops by the total. On any other answer the last dot turns red and the status says "Payment failed" with the biller's description.

## Mock screening

Invented for the demo:

| Signal | Effect |
|---|---|
| Bill total under PKR 250,000 | No alert; at most one rule hits |
| Bill total from PKR 250,000 to 999,999.99 | One typology reaches the alert threshold; the bill is still paid |
| Bill total of PKR 1,000,000 or more | One typology reaches the interdiction threshold; the payment is stopped |
| The account's third payment or later since Clear all | Counts one level higher |

Each rule hit adds 100 to every typology that uses the rule. A typology alerts at 200 and interdicts at 400. Which rules hit is decided by a hash of the payment, so the same payment always screens the same way. The rules and typologies are not drawn on screen; only the outcome is.

## Stack

As in RSOP demo 2: Astro 7.3 with static output, strict TypeScript, hand-written CSS with RSOP's tokens, vanilla TypeScript in Astro `<script>` tags, EB Garamond and Nunito self-hosted, dark by default with a light toggle, and `npm run check` (`astro check` plus `node --test`).

## Quality checks

| Check | How |
|---|---|
| Builds cleanly | `npm run build` |
| The mock answers like the API | `npm run check` compares bill 1234567890, and any other reference, with the captured reply byte for byte |
| Data is sound | Rule and typology numbers are unique and three digits; every rule is used by a typology; every typology can reach interdiction; every demo bill adds up |
| Mock screening keeps its promises | `npm run check` runs every row of the table in [Mock screening](#mock-screening) |
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
| Where the bill comes from | A local mock in the API's reply shape | Confirmed 2026-10-21 |
| How Pay reaches billPayment | A local mock in the API's request and reply shape | Confirmed 2026-10-21 |
| API address | One setting, `192.168.9.15:9991` | Confirmed 2026-10-21 |
| When Pay calls billPayment | Only after screening passes | Confirmed 2026-10-21 |
| A billPayment answer other than SUCCESS | "Payment failed" with the biller's description; balance unchanged | Unconfirmed |
| Institution | A dropdown with FBR only | Confirmed 2026-10-21 |
| Bill reference | Exactly 10 letters or digits | Confirmed 2026-10-21 |
| Any other valid reference | The API's standard bill, as the live API answers | Unconfirmed |
| Bills 4567890123 and 7890123456 | Invented to reach the alert and stopped outcomes | Unconfirmed |
| Screening bands | Alert from PKR 250,000; stopped from PKR 1,000,000 | Unconfirmed |
| Paying the same bill twice | Allowed; the mock does not mark bills paid | Unconfirmed |
| Where screening happens in the path | At the middle dot, before the biller | Unconfirmed |
