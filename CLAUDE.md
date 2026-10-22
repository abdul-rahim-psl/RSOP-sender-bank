# sender-initiate

A phone-only demo of a sender-initiated bill payment: a Meezan Bank app that looks up and pays an FBR bill on RSOP's live `billInquiry` / `billPayment` API, through the proxy in `server/bill-api.mjs`. The API needs the VPN.

- `npm run check`: type check plus the tests in `tests/`. Run it after every change.
- `server/serve.mjs` (the :4393 preview and tunnel) serves the built `dist/`. Run `npm run build` after a change, or the preview shows the old page.

## Visuals: good, but realistic

The phone should look like a real Pakistani retail banking app on someone's phone, not a dashboard, a design showcase or a demo of the demo. When unsure, copy what a bank app does.

**Colour means something, or it isn't used.**
- Green (`--ok`): the person can go ahead. An unpaid bill that can be paid, or a payment that succeeded.
- Red (`--fail`): stopped. A bill that's already paid, a refused payment, a failed lookup.
- Amber (`--wait`): waiting on someone. Blue (`--info`): in progress.
- Never use these colours for decoration, and don't add new hues. The bank's own accent (`--pc`) is for the brand only (avatar, balance card).

**Tint, don't flood.** Show status with a coloured border, a dot or icon, coloured small text, and a background tint of about 8–16%. Only the outcome badge and the main action button get solid fills. Something mid-screen glowing bright green or red looks like a toy.

**Reuse the tokens.** Colours, strokes and fonts come from the variables in `src/styles/global.css` and `demo.css`, which already define light and dark versions. Don't put hex values in components. Check both themes.

**Realistic content.**
- Money uses the existing formatter (`PKR 2,500,000.00`). References and IDs are in mono.
- Phone copy is what a bank would write: short, sentence case, plain. "Bill already paid", not "Error 101". Status codes, "mock", "API" and "proxy" belong in the README, never on the phone.
- An outcome has to make sense without its colour. Each state is also written out (title, status word, or screen-reader text), and the icon differs (✓ / ✗ / clock).

**Restraint.**
- One main button per screen. Secondary actions are ghost or tinted buttons.
- No gradients, shadows or animations beyond the ones already there (the balance card, the popup rising, the badge pop).
- Touch targets are at least 44px tall. Nothing scrolls sideways at phone width.
- Everything fits inside the phone frame. Don't add panels or explainers around it.
