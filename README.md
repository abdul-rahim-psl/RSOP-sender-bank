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

A one-screen, frontend-only demo of a sender-initiated payment. A sender pays a recipient from their phone, and the screen shows the payment being screened: the event director, 33 rules, 31 typologies and three alert checks. It is built from [pics/UI for sender.png](pics/UI%20for%20sender.png), with one phone instead of two and no product branding. Everything runs on mock data and connects to nothing.

The plan is in [docs/plan.md](docs/plan.md). The stack, development rules and look come from `RSOP demo 2/`.

| Route | Screen |
|---|---|
| `/` | Senders, the sender's phone, the message path and recipients, over the four screening panels |

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
  - **The data.** Rule and typology numbers are unique, three digits and in the reference screen's order. Every rule is used by a typology, and every typology can reach interdiction. Parties are fictional, and phone numbers use the 555-01xx range.
  - **The mock screening.** Every promise in "How it decides" holds across 400 payment IDs per case: the amount bands, the third-payment rule, the block list, and scores that follow the rule hits.

## Where things live

| What | File |
|---|---|
| Rule and typology numbers, thresholds, amount bands | `src/data/network.ts` |
| Senders, recipients, wallet providers, quick amounts | `src/data/parties.ts` |
| The mock screening | `src/lib/screen.ts` |
| Phone, party lists, message path, edit dialog | `src/components/stage/` |
| Event director, rule and typology grids, alerts | `src/components/monitor/` |
| Behaviour: picking, sending, the replay, Clear all | `src/scripts/demo.ts` |
| Layout and components | `src/styles/demo.css` |
| Colour, type and glass tokens, shared with RSOP demo 2 | `src/styles/global.css` |

## How it behaves

1. Pick a sender. The phone opens their wallet. The pencil edits the sender, including the block list.
2. Pick a recipient and enter an amount, or tap a quick amount. The three quick amounts give the three outcomes: 250 no alert, 2,500 an alert, 12,000 stopped.
3. Press Send. The dots run to the middle one, which stands for screening. The event director routes the payment, then the rules, the typologies and the three alert rows light in turn.
4. If nothing interdicts, the dots carry on to the recipient, the recipient card shows what arrived, and the balance drops. Otherwise the trail stops red at screening and the balance stays the same.

The mock rules are listed in "How it decides" on the page and in [docs/plan.md](docs/plan.md#mock-screening). They are invented and are not real rule or typology logic. Clear all resets picks, edits, balances, payment counts and lights, and stops a replay in progress.

## Design

- **The family look.** RSOP demo 2's tokens, fonts (EB Garamond and Nunito, both under the SIL Open Font License), header, theme toggle and dialog. Dark is the default.
- **The reference screen's lights**, redrawn. An unlit light is a grey bulb. A lit one carries an icon as well as a colour: ✓ no hit or clear, ! hit or alert, ✗ interdict, ● evaluating.
- **Layouts.**
  - Wide screens show one row: senders, phone, path, recipients.
  - Below 1240px the path runs full width under the phone.
  - Below 640px everything stacks in the order the payment travels.
- **Accessibility.**
  - axe-core reports no violations in either theme, before, during and after a send.
  - A 44-step scripted walk covers the keyboard and every outcome. It sends with the keyboard only; checks edit, the block list, the third-payment rule and validation; and runs Clear all mid-send.
  - Every light has a spoken status, such as "002 hit" or "011 score 400, interdict".

## Decisions applied

None of these are confirmed. See [docs/plan.md](docs/plan.md#decisions-applied).

| Question | Applied |
|---|---|
| Keep the creditors list without the creditor phone? | Yes, as Recipients |
| Keep the monitoring panels and their names? | Yes; only branding was removed |
| Logout | Dropped; there is no sign-in |
| Currency | USD |
| Where screening happens on the path | At the middle dot, before delivery |

## Share it

Follow `RSOP demo 2/docs/cloudflare-tunnel.md` with port 4393:

```sh
npm run build
npx astro preview --port 4393 --host 127.0.0.1
~/.local/bin/cloudflared tunnel --no-autoupdate --url http://127.0.0.1:4393
```

`astro.config.mjs` already allows `.trycloudflare.com` hosts.
