# Meet Founders – Test Plan

A/B/C/D landing-page test. One Cloudflare Worker (`fsc-founder-meets`) serves the
static site **and** the Stripe £0 card-capture endpoint. The variant is chosen by
subdomain (`a/b/c/d.foundermeets.com` → A/B/C/D; `d` = control).

**Funnel:** landing page → Tally application → `/api/checkout` (Stripe `setup`
mode, £0) → Stripe hosted checkout → `/welcome`.

**Attribution path:** the landing page detects its variant, passes `variant`
(+ any UTMs / `fbclid`) into Tally as hidden fields → Tally's redirect forwards
them to `/api/checkout` → the worker stamps them on the Stripe customer's
metadata and routes `/welcome` back to the visitor's own subdomain.

---

## 1. Automated checks (last run: 2026-06-13)

Things verifiable without dashboards. ✅ = passing.

| # | Check | Result |
|---|-------|--------|
| 1 | Worker serves the site (`fsc-founder-meets.jaihowitt.workers.dev`) | ✅ |
| 2 | Price renders `£99 / month`; zero `$` anywhere on the page | ✅ |
| 3 | No em dashes anywhere (en dashes only) | ✅ |
| 4 | 8 member cards, all using local `images/members/*.jpg` | ✅ |
| 5 | Variant detection: no param → A, `?variant=C` → C, bad value → A | ✅ |
| 6 | 4 CTAs, all `target=_blank`, all open the Tally form | ✅ |
| 7 | CTA carries attribution (`variant`, `utm_*`, `fbclid`) into Tally | ✅ |
| 8 | `/api/checkout` (live key) → 303 redirect to `checkout.stripe.com` `cs_live_` | ✅ |
| 9 | `/welcome` page serves and renders | ✅ |
| 10 | Cloudflare Web Analytics collecting for the zone (auto, no beacon) | ✅ |

**Known-open (not yet verifiable by automation):**
- `a/d.foundermeets.com` returned **403** to an automated probe – confirm in a real
  browser (see §2.1). Likely bot-challenge or subdomains not yet routed.

---

## 2. Pre-variant infrastructure – must be GREEN before building B/C/D

The variant system is built; these are the dependencies that make a real test work.
Verify each in a normal browser.

### 2.1 Subdomains live
- [ ] `https://a.foundermeets.com` loads the site (variant A)
- [ ] `https://b.foundermeets.com` loads the site (variant B)
- [ ] `https://c.foundermeets.com` loads the site (variant C)
- [ ] `https://d.foundermeets.com` loads the site (variant D, control)
- [ ] Each shows a valid SSL padlock (cert provisioned)

### 2.2 Variant detection on the live subdomains
On each subdomain, open DevTools console and run:
`document.querySelector('[data-cta=\"hero\"]').href` → the URL should contain
`variant=A` on `a.`, `variant=B` on `b.`, etc.
- [ ] a. → variant=A  - [ ] b. → variant=B  - [ ] c. → variant=C  - [ ] d. → variant=D

### 2.3 Tally wiring
- [ ] Tally form has a **hidden field named `variant`** (exact spelling)
- [ ] Tally form has hidden fields: `utm_source`, `utm_medium`, `utm_campaign`,
      `utm_content`, `utm_term`, `fbclid`
- [ ] Tally **After-submit → Redirect** points at a `foundermeets.com` subdomain
      and includes `?email=@email&variant=@variant&utm_source=@utm_source&...`
- [ ] The `@` tokens were inserted via Tally's mention picker (not typed literally)

### 2.4 Stripe (live)
- [ ] `STRIPE_SECRET_KEY` on the worker is the **live** key (`sk_live_…`)
- [ ] A **£99/month GBP** subscription product exists in **live** mode
      (needed at approval time, not for the £0 capture)

---

## 3. Manual end-to-end test (run once per variant on the LIVE domain)

Do this for at least `a.` and one other (e.g. `c.`) before scaling spend.
**Note:** live mode → the `4242…` test card will NOT work; use a real card. The
capture charges **£0**, so nothing is taken; delete the test customer afterward.

For variant **X** (replace x/X):
1. Open `https://x.foundermeets.com` in a fresh/incognito window.
2. (Optional, to test attribution) append `?utm_source=manualtest&utm_campaign=qa`.
3. Click **Apply to join** → the Tally form opens.
4. Complete and submit the form (use a real email you control).
5. **Expect:** redirected to `checkout.stripe.com` (a `cs_live_` URL).
6. **Expect:** the message *"£99 per month. Cancel any time. You will only be
   charged if your application is successful."* shows above the pay button.
7. Enter a **real card** → submit.
8. **Expect:** you land on `https://x.foundermeets.com/welcome` (the SAME subdomain
   you started on – this is the per-variant routing).
9. Record: did steps 5–8 all pass? ____

Repeat for the other variant(s).

---

## 4. Stripe verification (after the manual runs)

In the Stripe Dashboard (**live mode**):
- [ ] Each test created a **Customer** with the email you entered
- [ ] Each customer has a **saved card** and **£0 charged**
- [ ] Each customer's **Metadata** shows the correct `variant` (A/B/C/D) and any UTMs
- [ ] Variant attribution matches the subdomain you tested from
- [ ] (cleanup) delete the test customers

This metadata is the source of truth for **conversions per variant**.

---

## 5. Analytics verification

Cloudflare → **Web Analytics → foundermeets.com**:
- [ ] Page views appear for the subdomains you visited
- [ ] Add a **Host** filter → can isolate `a/b/c/d.foundermeets.com` individually
- [ ] `/welcome` views appear on the correct subdomain per variant

**Headline metric per variant:** `/welcome` views ÷ landing views (or, more
precisely, Stripe `variant=X` customers ÷ landing views for that subdomain).

---

## 6. Go-live checklist (before spending real ad money)

- [ ] B/C/D have their own differentiating copy in the `VARIANTS` map
- [ ] Real testimonials replace the `TESTIMONIALS` placeholders
- [ ] Real combined-revenue figure in `CREDIBILITY_STAT` (if using a number)
- [ ] `og.jpg` social-share image added (link previews currently blank)
- [ ] Decide Stripe/Tally public branding ("Founder Sports Club" vs "Meet Founders")
- [ ] Apex `foundermeets.com` redirects to the control (or serves a page)
- [ ] Each ad set points at its variant's subdomain
