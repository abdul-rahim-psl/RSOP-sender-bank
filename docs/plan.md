# Sender Demo: Plan

## Contents

- [Goal](#goal)
- [Source and content rules](#source-and-content-rules)
- [Bill inquiry](#bill-inquiry)
  - [The API](#the-api)
  - [The mock](#the-mock)
- [What changes from the reference screen](#what-changes-from-the-reference-screen)
- [Layout](#layout)
- [How a payment plays out](#how-a-payment-plays-out)
- [Mock screening](#mock-screening)
- [Stack](#stack)
- [Quality checks](#quality-checks)
- [Decisions applied](#decisions-applied)

## Goal

A one-screen, clickable demo of a sender-initiated bill payment. The account holder enters an institution and a bill reference on their phone, looks the bill up and pays it. The message path shows the payment pass through screening before it reaches the biller, and a Bill panel shows which of the bill's accounts were paid. It runs on mock data only and connects to nothing.

## Source and content rules

| Source | Used for |
|---|---|
| [pics/UI for sender.png](../pics/UI%20for%20sender.png) | The phone, the nine message dots, and the rule and typology numbers the mock screening uses |
| RSOP's `POST /api/v1/billInquiry` | The phone's two inputs and the bill's shape; see [Bill inquiry](#bill-inquiry) |
| `RSOP demo 2/` | Development rules, stack, tokens, fonts, theme toggle, header, popover and status conventions |

1. **The API is the authority for the bill.** Its two inputs are the phone's only inputs. Its reply fields and their order are what the phone and the Bill panel show.
2. **No product branding.** No logo, product name, version, tenant or account address from the reference screen. Participant codes from the API's headers are not shown.
3. **Fictional data only.** The account holder is invented. Phone numbers use the 555-01xx range set aside for fiction.
4. **Mock outcomes are labelled as mock.** The screening outcomes come from invented rules of thumb, not from real rule or typology logic. The header's Mock data label and How it decides say so.

## Bill inquiry

### The API

Captured with curl on 2026-10-21 against `http://10.0.70.144:9991`:

```http
POST /api/v1/billInquiry
Content-Type: application/json
Sender-Participant-Code, Receiver-Participant-Code, Sender-User-Code, X-Request-ID

{ "institution": "abc", "billReference": "123" }
```

```json
{"statusCode":0,"description":"SUCCESS","billId":"12345","billReference":"123","total":"100000","currency":"PKR",
 "billInquiryAccounts":[
  {"componentName":"Custom duty","componentAccount":"1111111111","componentAmount":"40000"},
  {"componentName":"Sales tax","componentAccount":"2222222222","componentAmount":"35000"},
  {"componentName":"Withholding tax","componentAccount":"3333333333","componentAmount":"20000"},
  {"componentName":"Other levy","componentAccount":"4444444444","componentAmount":"5000"}]}
```

- Amounts are strings in whole rupees, and the components add up to the total.
- The reply does not echo the institution, so the phone keeps the one the person typed.
- The page cannot call the API from the browser. RSOP's flow endpoints on the same server send no CORS headers, and the address is private, so tunnel viewers cannot reach it. Both were verified on 2026-10-21; this endpoint is assumed to behave the same. On the evening of 2026-10-21 it did not answer from this laptop at all.

### The mock

`billInquiry()` in `src/lib/biller.ts` takes the same request and returns the same reply shape, from `src/data/bills.ts`:

| Bill reference | Total | Source | Outcome |
|---|---|---|---|
| 123 | PKR 100,000 | The API's reply, unchanged | No alert |
| 456 | PKR 450,000 | Invented, same 40/35/20/5 split and accounts | Alert, still paid |
| 789 | PKR 1,250,000 | Invented, same split and accounts | Stopped |
| Anything else | | `{"statusCode":1,"description":"BILL NOT FOUND"}`, invented | Not found |

The mock matches on the bill reference only; any institution is accepted and shown as typed. Replacing `billInquiry()` with a server-side call to the API is the only change a live version needs.

## What changes from the reference screen

| Reference screen | This demo |
|---|---|
| Two phones, debtor and creditor | One phone, the sender's |
| Debtors list | Removed; one account holder owns the phone |
| Creditors list and creditor phone | Replaced by the Bill panel: the bill, its component accounts and whether each was paid |
| A Send button and nothing else on the phone | Institution and bill reference, Look up bill, the bill, then Pay |
| Event director, Rules, Typologies and Alerts panels | Removed; the screening dot on the path, the phone's result and the Bill panel show the outcome |
| Product logo, version, account email and tenant | Removed; RSOP-style brand mark, "Mock data" pill and theme toggle instead |
| Clear All, Logout | Clear all kept; Logout dropped, as there is no sign-in |
| Grey lights only | Lights carry an icon and a word as well as a colour |

## Layout

- **Wide screens.** The phone, the message path (nine dots) and the Bill panel, left to right.
- **Medium widths.** The phone beside the Bill panel, with the path running full width underneath.
- **Phone widths.** Everything stacks in one column, in the order the payment travels, with no sideways page scroll.

The phone has four screens: the bill form, a busy screen for looking up and paying, the bill, and the result.

## How a payment plays out

1. Enter an institution and a bill reference, or tap one of the three demo bills.
2. Press Look up bill. The phone shows the total and the four components; the Bill panel shows the same bill with each component's account, marked Unpaid.
3. Press Pay. The dots light up to the middle one, which stands for screening.
4. The payment pauses at the screening dot while the phone says Screening….
5. If nothing interdicts, the dots carry on to the biller, each component in the Bill panel ticks green, and the balance drops by the total. If something interdicts, the trail stops at screening, each component shows not paid, and the phone says the payment was stopped.

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
| The mock answers like the API | `npm run check` compares bill 123 with the captured reply byte for byte |
| Data is sound | Rule and typology numbers are unique and three digits; every rule is used by a typology; every typology can reach interdiction; every demo bill adds up |
| Mock screening keeps its promises | `npm run check` runs every row of the table in [Mock screening](#mock-screening) |
| Looks right | Screenshots at 360, 390, 768, 1024 and 1440 px in both themes, before a lookup, on the bill and after each outcome |
| Accessible | axe-core in both themes; keyboard-only lookup and payment |

## Decisions applied

| Question | Applied | Status |
|---|---|---|
| What replaces the creditors list? | The Bill panel | Confirmed 2026-10-21 |
| Keep a debtors list? | No; one fictional account holder | Confirmed 2026-10-21 |
| Where the bill comes from | A local mock in the API's reply shape | Confirmed 2026-10-21 |
| The reply for an unknown bill | Invented `statusCode` 1, "BILL NOT FOUND" | Unconfirmed |
| Bills 456 and 789 | Invented to reach the alert and stopped outcomes | Unconfirmed |
| Screening bands | Alert from PKR 250,000; stopped from PKR 1,000,000 | Unconfirmed |
| Paying the same bill twice | Allowed; the mock does not mark bills paid | Unconfirmed |
| Where screening happens in the path | At the middle dot, before the biller | Unconfirmed |
