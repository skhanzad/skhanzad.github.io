# sourena-khanzadeh.com

Portfolio of Sourena Khanzadeh, Cognitive Trust Architect. A static site with no framework.
The deployment build copies the site files into `dist/`.

## Run locally

ES modules need a server (opening `index.html` from disk won't work):

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

Add `?debug` to the URL to expose `window.world` and `window.lenis` in the console.

## Deploy

Run `npm run build` to prepare `dist/` for any static host (Netlify, Vercel, GitHub Pages,
S3, Cloudflare Pages). The build uses Node.js and has no npm dependencies.

For Netlify, connect this repository. `netlify.toml` sets the build command to `npm run build`
and the publish directory to `dist`.

The output contains `index.html`, `assets/` and `resume.pdf`, which is linked from the page.

## Where things live

| Path | What it is |
| --- | --- |
| `index.html` | All page content (text, links, research cards) |
| `assets/css/main.css` | Design tokens (palette, type) at the top, then one block per section |
| `assets/js/main.js` | Boot: loader, smooth scroll, WebGL world, UI modules, intro |
| `assets/js/world/` | The particle simulation (three.js GPGPU) |
| `assets/js/world/formations.js` | The eight particle shapes: labyrinth, trajectories, portrait, knot, graph, futures, armillary, galaxy |
| `assets/js/world/stages.js` | Where each shape sits on screen and how its particles behave |
| `assets/js/ui/` | Scroll reveals, timeline thread, research gallery, the Lab, nav, cursor |
| `assets/vendor/` | three.js r186, GSAP 3.15 + ScrollTrigger, Lenis 1.3 (vendored, so no CDN) |

Each `<section data-formation="…">` owns a particle shape; scrolling from one section to the
next morphs the particles between them. To reorder sections, move them in `index.html`.

## Research simulations

Every research card has a **Run the simulation** button (`data-sim="<id>"`) that opens a
full-screen chamber with a live model of that project's method. They load on demand from
`assets/js/sims/`:

| id | File | Simulates |
| --- | --- | --- |
| `ariadne` | `ariadne.js` | Intervention-and-replay audit of agent reasoning |
| `gaszero` | `gaszero.js` | Static analysis → LLM rewrite → differential fuzzing |
| `search` | `search.js` | Restarting random walks vs. enforced hill-climbing vs. A* |
| `gansemble` | `gansemble.js` | Oversampling strategies and a conditional GAN, trained live |
| `iss` | `iss.js` | Choosing interventions that separate candidate causal models |
| `chronicles` | `chronicles.js` | Scoped, provenance-tracked disclosure with holder approval |
| `mesh` | `mesh.js` | Planner / coder / debugger / reviewer with execution-driven repair |
| `pllm` | `pllm.js` | Historical configuration replay vs. trial-and-error repair |

- Link straight to one with `#sim/<id>`, e.g. `https://sourena-khanzadeh.com/#sim/ariadne`.
- `kit.js` holds the shared palette, canvas, controls and chart helpers; `chamber.js` hosts them.
- A module exports `create({ stage, panel, reduced })` and returns `{ start, stop, destroy }`.
- Each panel keeps the paper's reported figures (verbatim from the résumé) apart from the
  simulation's own numbers, and states what the simulation simplifies.

## Changing the photo

Replace `sourena.png` (a head-and-shoulders shot on a plain backdrop works best), then:

```bash
python3 tools/make-portrait.py   # needs numpy, scipy, pillow
```

This regenerates the particle map and the web photos in `assets/img/`. The script keys out a
blue backdrop (the `blue < 24` test); a different backdrop colour needs a different key.
