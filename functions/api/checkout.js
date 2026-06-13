/**
 * Cloudflare Pages Function  —  POST/GET /api/checkout
 *
 * Creates a Stripe Checkout Session in `setup` mode: it saves the applicant's
 * card and charges £0. Nothing is ever charged here. After you APPROVE an
 * application you charge the saved card manually from the Stripe Dashboard
 * (open the customer → create a payment / subscription).
 *
 * Flow:
 *   Tally application (qualification)
 *     --redirect on completion-->  /api/checkout?email=…&variant=A&utm_source=…
 *       --> Stripe Checkout (save card, £0)
 *         --success--> /welcome
 *         --cancel-->  /
 *
 * Config (Cloudflare Pages → Settings → Environment variables):
 *   STRIPE_SECRET_KEY  — sk_test_… while testing, sk_live_… to go live.
 *                        Add it as a *Secret*, not a plain text var.
 */

// URL params we forward onto the Stripe session as metadata, so every saved
// card is traceable to the ad / variant it came from (visible on the customer
// in the Dashboard). `email` is used to prefill + name the Stripe customer.
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

  const form = new URLSearchParams();
  form.set('mode', 'setup');
  form.set('payment_method_types[]', 'card');
  form.set('success_url', `${origin}/welcome`);
  form.set('cancel_url', `${origin}/?checkout=cancelled`);

  const email = params.get('email');
  if (email) form.set('customer_email', email);

  for (const key of META_KEYS) {
    const value = params.get(key);
    if (value) form.set(`metadata[${key}]`, value);
  }

  const resp = await fetch('https://api.stripe.com/v1/checkout/sessions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${secret}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: form.toString(),
  });

  if (!resp.ok) {
    const detail = await resp.text();
    return new Response(`Stripe error: ${detail}`, { status: 502 });
  }

  const session = await resp.json();
  // 303 so the browser follows with a GET to Stripe's hosted page.
  return Response.redirect(session.url, 303);
}

// GET — Tally's "redirect on completion" lands here with answers in the query
// string, and we bounce straight to Stripe.
export async function onRequestGet({ request, env }) {
  const url = new URL(request.url);
  return createSession(url.searchParams, env, url.origin);
}

// POST — for a JS-driven handoff (form post) if you ever move off the Tally
// redirect. Accepts the same fields as form-encoded body.
export async function onRequestPost({ request, env }) {
  const url = new URL(request.url);
  const body = await request.formData();
  const params = new URLSearchParams();
  for (const [k, v] of body) params.set(k, v);
  return createSession(params, env, url.origin);
}
