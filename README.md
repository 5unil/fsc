# meet founders — landing page (variant A)

Single-page marketing site for a founder-community product. This is **variant A** of an A/B/C ad test driving Instagram/Meta traffic into a Typeform application.

## Stack

- Single-file static HTML — no framework, no build step.
- [Tailwind CSS via CDN](https://cdn.tailwindcss.com) with an inline config block.
- Vanilla JS (one `<script>` at the bottom) for copy rendering, scroll animations, carousel-free reveal, analytics, and the Typeform embed.
- Fonts/colours copied from the Art of Mondays / Founder Family aesthetic: `Helvetica Neue` stack, dark warm palette (`#0a0a0a` bg, `#fff3d5` text, `#fbe06c` gold accent).

## Run it

No build. Open `index.html` in a browser, or serve the folder:

```bash
python3 -m http.server 8000   # then visit http://localhost:8000
```

## Editing copy

Almost all copy lives in a single config block at the top of the `<script>` in `index.html`. To spin up variants **B** and **C**, clone the file and change only that block — primarily `HEADLINE`, `ACCENT_WORD`, `SUBHEAD`, and `STEPS`. Set `VARIANT` to `'B'` / `'C'` so signups are attributed correctly.

## Before going live (placeholders to replace)

- **Images** — every slot is a placeholder `<!-- TODO: image -->` div with an icon. Drop in real photography.
- **Member showcase** — real member faces, names, companies (currently `MEMBERS` placeholders).
- **Testimonials** — real named quotes with companies (`TESTIMONIALS`).
- **Founder's note** — replace with the real founder's words (`FOUNDER_NOTE`).
- **Credibility stat** — fill the `$[X]` combined-revenue figure (`CREDIBILITY_STAT`).
- **Typeform** — set `data-tf-live` to the real form ID (hidden field `variant=A` is already wired).
- **Plausible** — paste the script tag into the `<!-- PLAUSIBLE SCRIPT HERE -->` slot in `<head>`. CTA click events already fire.

## Deploy

Static — point Vercel or Cloudflare Pages at this folder (just `index.html`).
