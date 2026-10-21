# Sender Demo: Plan

## Contents

- [Goal](#goal)
- [Source and content rules](#source-and-content-rules)
- [What changes from the reference screen](#what-changes-from-the-reference-screen)
- [Layout](#layout)
- [How a payment plays out](#how-a-payment-plays-out)
- [Mock screening](#mock-screening)
- [Stack](#stack)
- [Quality checks](#quality-checks)
- [Decisions applied](#decisions-applied)

## Goal

A one-screen, clickable demo of a sender-initiated payment. A sender pays a recipient from their phone, and the screen shows the payment being screened: the event director, the rules, the typologies and the resulting alerts. It runs on mock data only and connects to nothing.

## Source and content rules

| Source | Used for |
|---|---|
| [pics/UI for sender.png](../pics/UI%20for%20sender.png) | The screen's structure: debtors, phone, message dots, creditors, and the four monitoring panels with their rule and typology numbers |
| `RSOP demo 2/` | Development rules, stack, tokens, fonts, theme toggle, header, dialog and status conventions |

1. **The reference screen is the authority for structure.** Its panels, rule numbers and typology numbers carry over. The rule and typology lists stop where the screenshot is cut off.
2. **No product branding.** No logo, product name, version, tenant or account address from the reference screen.
3. **Fictional data only.** People, phone numbers and wallet providers are invented. Phone numbers use the 555-01xx range set aside for fiction.
4. **Mock outcomes are labelled as mock.** The screening outcomes come from invented rules of thumb, not from real rule or typology logic. The screen says so.

## What changes from the reference screen

| Reference screen | This demo |
|---|---|
| Two phones, debtor and creditor | One phone, the sender's |
| Creditor phone | Removed; the dots now end at the recipients panel, and the picked recipient shows what arrived |
| Product logo, version, account email and tenant | Removed; RSOP-style brand mark, "Mock data" pill and theme toggle instead |
| Clear All, Logout | Clear all kept; Logout dropped, as there is no sign-in |
| Grey lights only | Lights carry an icon and a word as well as a colour |

## Layout

- **Top row.** Senders, the sender's phone, the message path (nine dots) and the recipients, left to right.
- **Bottom row.** Event director, Rules, Typologies and Alerts (event flow, typology processor, event adjudicator).
- **Medium widths.** Senders beside the phone, then the path and recipients, then the panels two by two.
- **Phone widths.** Everything stacks in one column with no sideways page scroll.

## How a payment plays out

1. Pick a sender. The phone shows their wallet and balance. The pencil edits the sender, including whether they are on the block list.
2. Pick a recipient and enter an amount, or use a quick amount.
3. Press Send. The dots light up to the middle one, which stands for screening.
4. The event director routes the payment, the rules light up, then the typologies, then the three alert rows.
5. If nothing interdicts, the dots carry on to the recipient and the recipient card shows what arrived. If something interdicts, the trail stops at screening and the phone says the payment was stopped.

## Mock screening

Invented for the demo:

| Signal | Effect |
|---|---|
| Amount under 1,000 | No alert; at most one rule hits |
| Amount from 1,000 to 9,999.99 | One typology reaches the alert threshold; the payment still goes through |
| Amount of 10,000 or more | One typology reaches the interdiction threshold; the payment is stopped |
| The sender's third payment or later since Clear all | Counts one level higher |
| Sender on the block list | The event flow check stops the payment, whatever the amount |

Each rule hit adds 100 to every typology that uses the rule. A typology alerts at 200 and interdicts at 400. Which rules hit is decided by a hash of the payment, so the same payment always lights the same way.

## Stack

As in RSOP demo 2: Astro 7.3 with static output, strict TypeScript, hand-written CSS with RSOP's tokens, vanilla TypeScript in Astro `<script>` tags, EB Garamond and Nunito self-hosted, dark by default with a light toggle, and `npm run check` (`astro check` plus `node --test`).

## Quality checks

| Check | How |
|---|---|
| Builds cleanly | `npm run build` |
| Data is sound | Rule and typology numbers are unique and three digits; every rule is used by a typology; every typology can reach interdiction |
| Mock screening keeps its promises | `npm run check` runs every row of the table in [Mock screening](#mock-screening) |
| Looks right | Screenshots at 390, 768 and 1440 px in both themes, before and after a send |
| Accessible | axe-core in both themes; keyboard-only send |

## Decisions applied

None of these are confirmed.

| Question | Applied |
|---|---|
| Keep the creditors list without the creditor phone? | Yes, as "Recipients"; the payment needs somewhere to go |
| Keep the monitoring panels and their names? | Yes; only branding was removed |
| Currency | USD |
| What the third icon on each debtor card does | Dropped; each sender card has select and edit |
| Edit on recipient cards | No; only senders, whose block-list flag changes the outcome |
| Where screening happens in the path | At the middle dot, before delivery |
