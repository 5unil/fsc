/**
 * Cloudflare Worker entry for the Meet Founders site.
 *
 *   GET|POST /api/checkout  -> create a Stripe Checkout Session in `setup` mode
 *                              (saves the applicant's card, charges £0) and
 *                              redirect to Stripe's hosted page.
 *   everything else         -> static assets (index.html, welcome.html, ...).
 *
 * Nothing is ever charged here. After you APPROVE an application you charge the
 * saved card manually from the Stripe Dashboard (open the customer -> create a
 * payment / subscription).
 *
 * Flow:
 *   Tally application (qualification)
 *     --redirect on completion-->  /api/checkout?email=…&variant=chat&utm_source=…
 *       --> Stripe Checkout (save card, £0)
 *         --success--> /welcome
 *         --cancel-->  /
 *
 * Env (Workers & Pages -> fsc -> Settings -> Variables and Secrets):
 *   STRIPE_SECRET_KEY  - sk_test_… while testing, sk_live_… to go live.
 *                        Add it as a Secret (encrypted), not plaintext.
 *   ASSETS             - static-assets binding (declared in wrangler.jsonc).
 */

// URL params forwarded onto the Stripe session as metadata, so every saved card
// is traceable to the ad / variant it came from (visible on the customer in the
// Dashboard). `email` prefills + names the Stripe customer.
const META_KEYS = [
  'variant',
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_content',
  'utm_term',
  'fbclid',
];

async function createSession(params, env, origin) {
  const secret = env.STRIPE_SECRET_KEY;
  if (!secret) {
    return new Response('Stripe is not configured (missing STRIPE_SECRET_KEY).', { status: 500 });
  }

  const stripe = (path, body) =>
    fetch('https://api.stripe.com/v1/' + path, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${secret}`,
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: body.toString(),
    });

  // Send the applicant back to THEIR variant's subdomain for /welcome, so each
  // variant's funnel stays clean in analytics even though Tally redirects every
  // submission through a single host. Falls back to the request origin off the
  // production domain (localhost / *.workers.dev) or when the variant is unknown.
  const variant = (params.get('variant') || '').toLowerCase();
  const slugs = ['one', 'chat', 'sport', 'dinner', 'chapter', 'circle', 'pass'];
  const base = slugs.includes(variant) && origin.endsWith('foundermeets.com') ? `https://${variant}.foundermeets.com` : origin;

  // Attribution (variant + UTM/fbclid), collected once so it can go on BOTH the
  // customer (visible right on their Dashboard page) and the session.
  const meta = new URLSearchParams();
  for (const key of META_KEYS) {
    const value = params.get(key);
    if (value) meta.set(key, value);
  }

  // Pre-create the customer WITH the attribution metadata, then attach the setup
  // session to it - so variant/UTM are stamped on the customer record, not just on
  // the checkout session (which isn't browsable in the Dashboard).
  const customerForm = new URLSearchParams();
  const email = params.get('email');
  if (email) customerForm.set('email', email);
  for (const [key, value] of meta) customerForm.set(`metadata[${key}]`, value);

  const customerResp = await stripe('customers', customerForm);
  if (!customerResp.ok) {
    return new Response(`Stripe error (customer): ${await customerResp.text()}`, { status: 502 });
  }
  const customer = (await customerResp.json()).id;

  // Checkout session in setup mode: saves the card, charges £0, attached to the
  // customer above. Nothing is charged here - charge the saved card manually from
  // the Dashboard once the application is approved.
  const form = new URLSearchParams();
  form.set('mode', 'setup');
  form.set('payment_method_types[]', 'card');
  form.set('success_url', `${base}/welcome`);
  form.set('cancel_url', `${base}/?checkout=cancelled`);
  form.set('customer', customer);
  for (const [key, value] of meta) form.set(`metadata[${key}]`, value);

  // Setup mode has no line items, so the product name/price/description never
  // render. This message (above the submit button) gives the applicant context
  // on what saving their card means.
  form.set(
    'custom_text[submit][message]',
    '£49 for your first month, then £99/month. Cancel any time. You will only be charged if your application is successful.',
  );

  const resp = await stripe('checkout/sessions', form);
  if (!resp.ok) {
    return new Response(`Stripe error: ${await resp.text()}`, { status: 502 });
  }

  const session = await resp.json();
  // 303 so the browser follows with a GET to Stripe's hosted page.
  return Response.redirect(session.url, 303);
}

// 'ladder' retired: removed from the apex rotation so new/returning visitors are
// only split across the live variants. Detach ladder.foundermeets.com in Cloudflare.
// All valid variant slugs (each maps to a <slug>.foundermeets.com subdomain).
const VARIANT_SLUGS = ['one', 'chat', 'sport', 'dinner', 'chapter', 'circle', 'pass'];

// Variants in the apex random split (even). A slug must have a LIVE Cloudflare
// subdomain before it goes in here, or that share of apex visitors gets routed
// to a dead subdomain (404). 'chat' is paused (still a valid subdomain + sticky
// for anyone already on it, just no new apex traffic). 'pass' added now its
// subdomain is live.
const APEX_ROTATION = ['one', 'sport', 'dinner', 'chapter', 'circle', 'pass'];

// Per-variant social-preview image (the splash photo). Scrapers don't run JS,
// so og:image/twitter:image get rewritten server-side per subdomain below.
const SPLASH = {
  one: 'images/hero-one.jpg',
  chat: 'images/ugc/ugc-2.jpg',
  sport: 'images/ugc/ugc-2.jpg',
  dinner: 'images/ugc/ugc-17.jpg',
  chapter: 'images/ugc/ugc-13.jpg',
  circle: 'images/ugc/ugc-23.jpg',
  pass: 'images/ugc/ugc-3.jpg',
};

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const host = url.hostname.toLowerCase();

    // Apex / www: don't serve a variant here (it would bias the test). Send the
    // visitor to a variant subdomain - sticky to the one they first saw (the
    // mf_variant cookie), or a random one for a brand-new visitor (even split).
    if (host === 'foundermeets.com' || host === 'www.foundermeets.com') {
      const cookie = (request.headers.get('Cookie') || '').match(/(?:^|;\s*)mf_variant=([a-z]+)/);
      let v = cookie && VARIANT_SLUGS.includes(cookie[1]) ? cookie[1] : null;
      const isNew = !v;
      if (!v) v = APEX_ROTATION[Math.floor(Math.random() * APEX_ROTATION.length)];
      const headers = { Location: `https://${v}.foundermeets.com${url.pathname}${url.search}` };
      // Make a newly-assigned visitor sticky from the first hit.
      if (isNew) headers['Set-Cookie'] = `mf_variant=${v}; Domain=.foundermeets.com; Path=/; Max-Age=2592000; SameSite=Lax; Secure`;
      return new Response(null, { status: 302, headers });
    }

    if (url.pathname === '/api/checkout') {
      if (request.method === 'GET') {
        return createSession(url.searchParams, env, url.origin);
      }
      if (request.method === 'POST') {
        const body = await request.formData();
        const params = new URLSearchParams();
        for (const [k, v] of body) params.set(k, String(v));
        return createSession(params, env, url.origin);
      }
      return new Response('Method not allowed', { status: 405 });
    }

    // Everything else: serve the static site.
    const assetResp = await env.ASSETS.fetch(request);

    // On the landing page, rewrite the social-preview image to this subdomain's
    // splash photo (absolute URL) so shares/unfurls show the right variant image.
    const splash = SPLASH[host.split('.')[0]];
    if (splash && (url.pathname === '/' || url.pathname === '/index.html')) {
      const img = `https://${host}/${splash}`;
      return new HTMLRewriter()
        .on('meta[property="og:image"]', { element(el) { el.setAttribute('content', img); } })
        .on('meta[name="twitter:image"]', { element(el) { el.setAttribute('content', img); } })
        .transform(assetResp);
    }
    return assetResp;
  },
};
