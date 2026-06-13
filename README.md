# meet founders — landing page (variant A)

Single-page marketing site for a founder-community product. **Variant A** of an
A/B/C(/control) ad test driving Instagram/Meta traffic into a Tally application,
followed by a £0 Stripe card-capture. London only.

## Stack

- Single-file static HTML (`index.html`) — no framework, no build step.
- [Tailwind CSS via CDN](https://cdn.tailwindcss.com) with an inline config block.
- Vanilla JS (one `<script>` at the bottom) for copy rendering, scroll reveals,
  the members carousel, analytics, and the Tally popup.
- `Helvetica Neue` stack, dark warm palette (`#0a0a0a` bg, `#fff3d5` text,
  `#fbe06c` gold accent).
- One Cloudflare **Pages Function** (`functions/api/checkout.js`) for the Stripe
  card-capture step. Everything else is static.

## Run it locally

No build. Serve the folder:

```bash
python3 -m http.server 8000   # http://localhost:8000
```

To exercise the Pages Function locally (needs a Stripe test key):

```bash
npx wrangler pages dev . --binding STRIPE_SECRET_KEY=sk_test_xxx
```

## Editing copy

Almost all copy lives in a single config block at the top of the `<script>` in
`index.html`. To spin up another variant, clone the file and change only that
block — primarily `HEADLINE`, `ACCENT_WORD`, `SUBHEAD`, and `STEPS`. Set
`VARIANT` to `'B'` / `'C'` / `'D'` so signups are attributed correctly.

## Application → payment flow

1. Visitor clicks a CTA → **Tally** application popup (qualification questions).
   Landing-page URL params (`utm_*`, `fbclid`) + `variant` ride along as hidden
   fields.
2. On submit, Tally **redirects to `/api/checkout`** (see wiring below), which
   creates a Stripe Checkout session in **`setup` mode** — the card is saved,
   **£0 is charged** — and bounces the applicant to Stripe's hosted page.
3. Stripe returns them to `/welcome` ("card saved, you're in the queue").
4. You review. **To accept**, open the customer in the Stripe Dashboard and
   create a payment / subscription against their saved card. **To reject**, do
   nothing — they are never charged.

### Wiring the Tally → Stripe redirect

In the Tally form (`tally.so/r/44GQBo`) → **Integrations / After submit →
Redirect to URL**, set:

```
https://YOUR-DOMAIN/api/checkout?email=@email&variant=@variant&utm_source=@utm_source&utm_medium=@utm_medium&utm_campaign=@utm_campaign&utm_content=@utm_content&utm_term=@utm_term&fbclid=@fbclid
```

(`@field` tokens insert that field's submitted value — make sure each exists as
a question or hidden field on the form. `email` is what names the Stripe
customer; the rest land in the customer's metadata for attribution.)

## Deploy (Cloudflare Pages)

1. **Cloudflare Dashboard → Workers & Pages → Create → Pages → Connect to Git**,
   pick the `5unil/fsc` repo, branch `main`.
2. Build settings: **Framework preset = None**, **Build command = (blank)**,
   **Output directory = `/`**. Pages auto-detects `functions/`.
3. **Settings → Environment variables** → add `STRIPE_SECRET_KEY` as a
   **Secret**:
   - Preview env → `sk_test_…`
   - Production env → `sk_live_…`
4. Push to `main` → auto-deploys. The Function is live at
   `https://YOUR-DOMAIN/api/checkout`.

Test with `sk_test_…` and a Stripe test card (`4242 4242 4242 4242`) end-to-end
before switching the Tally redirect to the production domain.

## Before going live (placeholders to replace)

- **Member showcase** — real member faces, names, companies (`MEMBERS`).
- **Testimonials** — real named quotes with companies (`TESTIMONIALS`).
- **Credibility stat** — fill the `$[X]` combined-revenue figure (`CREDIBILITY_STAT`).
- **Tally hidden fields** — add fields named `variant`, `utm_source`,
  `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid` so params are
  stored, and set the redirect URL above.
- **Stripe** — set `STRIPE_SECRET_KEY` (test then live) in Pages.
- **Plausible** — paste the script tag into the `<!-- PLAUSIBLE SCRIPT HERE -->`
  slot in `<head>`. CTA click events already fire.
