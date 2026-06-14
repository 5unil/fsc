# meet founders - landing page (variant A)

Single-page marketing site for a founder-community product. **Variant A** of an
A/B/C(/control) ad test driving Instagram/Meta traffic into a Tally application,
followed by a £0 Stripe card-capture. London only.

## Stack

- Single-file static HTML (`index.html`) - no framework, no build step.
- [Tailwind CSS via CDN](https://cdn.tailwindcss.com) with an inline config block.
- Vanilla JS (one `<script>` at the bottom) for copy rendering, scroll reveals,
  the members carousel, analytics, and the Tally popup.
- `Helvetica Neue` stack, dark warm palette (`#0a0a0a` bg, `#fff3d5` text,
  `#fbe06c` gold accent).
- One Cloudflare **Worker** (`worker.js`) that serves the static site and the
  Stripe card-capture endpoint (`/api/checkout`). Config in `wrangler.jsonc`.

## Run it locally

Static only (no card step):

```bash
python3 -m http.server 8000   # http://localhost:8000
```

Full Worker (serves the site + `/api/checkout`, needs a Stripe test key):

```bash
npx wrangler dev   # http://localhost:8787
# set the key for local dev once:  npx wrangler secret put STRIPE_SECRET_KEY
```

## Editing copy

Almost all copy lives in a single config block at the top of the `<script>` in
`index.html`. To spin up another variant, clone the file and change only that
block - primarily `HEADLINE`, `ACCENT_WORD`, `SUBHEAD`, and `STEPS`. Set
`VARIANT` to `'B'` / `'C'` / `'D'` so signups are attributed correctly.

## Application → payment flow

1. Visitor clicks a CTA → **Tally** application popup (qualification questions).
   Landing-page URL params (`utm_*`, `fbclid`) + `variant` ride along as hidden
   fields.
2. On submit, Tally **redirects to `/api/checkout`** (see wiring below), which
   creates a Stripe Checkout session in **`setup` mode** - the card is saved,
   **£0 is charged** - and bounces the applicant to Stripe's hosted page.
3. Stripe returns them to `/welcome` ("card saved, you're in the queue").
4. You review. **To accept**, open the customer in the Stripe Dashboard and
   create a payment / subscription against their saved card. **To reject**, do
   nothing - they are never charged.

### Wiring the Tally → Stripe redirect

In the Tally form (`tally.so/r/44GQBo`) → **Integrations / After submit →
Redirect to URL**, set:

```
https://YOUR-DOMAIN/api/checkout?email=@email&variant=@variant&utm_source=@utm_source&utm_medium=@utm_medium&utm_campaign=@utm_campaign&utm_content=@utm_content&utm_term=@utm_term&fbclid=@fbclid
```

(`@field` tokens insert that field's submitted value - make sure each exists as
a question or hidden field on the form. `email` is what names the Stripe
customer; the rest land in the customer's metadata for attribution.)

## Deploy (Cloudflare Workers)

The repo is already connected to the **`fsc-founder-meets`** Worker (Workers & Pages →
`fsc-founder-meets`, deployed from `5unil/fsc` `main`). `wrangler.jsonc` sets `main: worker.js`
plus the `ASSETS` static-assets binding, so every push to `main` redeploys both
the site and `/api/checkout`.

1. Add the Stripe key: **Workers & Pages → `fsc-founder-meets` → Settings → Variables and
   Secrets → Add → type: Secret**, name `STRIPE_SECRET_KEY`, value `sk_test_…`
   (swap to `sk_live_…` to go live). Then **Deploy** / retry the latest build.
2. Endpoint is live at `https://YOUR-DOMAIN/api/checkout`.

Test with `sk_test_…` and a Stripe test card (`4242 4242 4242 4242`) end-to-end
before switching the Tally redirect to the production domain.

## Before going live (placeholders to replace)

- **Member showcase** - real member photos (`MEMBERS` `img` fields are placeholders).
- **Testimonials** - real named quotes with companies (`TESTIMONIALS`).
- **Tally hidden fields** - add fields named `variant`, `utm_source`,
  `utm_medium`, `utm_campaign`, `utm_content`, `utm_term`, `fbclid` so params are
  stored, and set the redirect URL above.
- **Cloudflare Web Analytics** - Dashboard → Analytics & Logs → Web Analytics →
  Add a site → paste the token into the `data-cf-beacon` snippet in `<head>`.
  Page views track automatically. Per-variant: segment by hostname (one subdomain
  per variant) or path. Conversion = `/welcome` views ÷ landing views.
