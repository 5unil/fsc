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

  // Send the applicant back to THEIR variant's subdomain for /welcome, so each
  // variant's funnel stays clean in analytics even though Tally redirects every
  // submission through a single host. Falls back to the request origin off the
  // production domain (localhost / *.workers.dev) or when the variant is unknown.
  const variant = (params.get('variant') || '').toLowerCase();
  const slugs = ['one', 'ladder', 'chat', 'sport'];
  const base = slugs.includes(variant) && origin.endsWith('foundermeets.com') ? `https://${variant}.foundermeets.com` : origin;

  const form = new URLSearchParams();
  form.set('mode', 'setup');
  form.set('payment_method_types[]', 'card');
  form.set('success_url', `${base}/welcome`);
  form.set('cancel_url', `${base}/?checkout=cancelled`);

  const email = params.get('email');
  if (email) form.set('customer_email', email);

  for (const key of META_KEYS) {
    const value = params.get(key);
    if (value) form.set(`metadata[${key}]`, value);
  }

  // Setup mode has no line items, so the product name/price/description never
  // render. This message (above the submit button) gives the applicant context
  // on what saving their card means.
  form.set(
    'custom_text[submit][message]',
    '£99 per month. Cancel any time. You will only be charged if your application is successful.',
  );

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!resp.ok) {
    return new Response(`Stripe error: ${await resp.text()}`, { status: 502 });
  }

  const session = await resp.json();
  // 303 so the browser follows with a GET to Stripe's hosted page.
  return Response.redirect(session.url, 303);
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

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
    return env.ASSETS.fetch(request);
  },
};
