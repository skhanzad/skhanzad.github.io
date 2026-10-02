# sourena-khanzadeh.com

Portfolio of Sourena Khanzadeh, Cognitive Trust Architect. Built with React and Vite,
with a three.js particle world, GSAP animations and interactive research simulations.

## Run locally

Use Node.js 20.19+ or 22.12+ and npm:

```bash
npm install
npm run dev
# then open http://localhost:4173
```

Add `?debug` to the URL to expose `window.world` and `window.lenis` in the console.
Use `npm run dev -- --port 4174` if port 4173 is already in use.
Component edits reload the page to reset split text and pinned animations. CSS changes
update in place.

## Deploy

Run `npm run build` to bundle the site into `dist/`. Use `npm run preview` to inspect the
production build locally.

For Netlify, connect this repository. `netlify.toml` sets the build command to `npm run build`
and the publish directory to `dist`, using Node.js 22.

The output includes the page, bundled JavaScript/CSS, images and résumé. The files in
`public/` are copied directly into the build. Simulation modules load on demand.

## Browser checks

```bash
npx playwright install chromium
npm test
```

The checks build and serve the production site, then exercise desktop and mobile navigation,
research simulations and reduced-motion behavior.

## Where things live

| Path | What it is |
| --- | --- |
| `index.html` | HTML entry, search/social metadata and React mount point |
| `src/main.jsx` | React entry and stylesheet imports |
| `src/App.jsx` | Page composition |
| `src/components/` | Page sections, navigation, research cards and footer |
| `src/hooks/usePortfolioEffects.js` | Mounts and cleans up the animation runtime |
| `assets/css/main.css` | Design tokens (palette, type) at the top, then one block per section |
| `assets/js/main.js` | Animation runtime: loader, smooth scroll, WebGL world, UI modules, intro |
| `assets/js/world/` | The particle simulation (three.js GPGPU) |
| `assets/js/world/formations.js` | The eight particle shapes: labyrinth, trajectories, portrait, knot, graph, futures, armillary, galaxy |
| `assets/js/world/stages.js` | Where each shape sits on screen and how its particles behave |
| `assets/js/ui/` | Scroll reveals, timeline thread, research gallery, the Lab, nav, cursor |
| `public/assets/img/` | Portrait, particle map, favicon and social image |
| `public/resume.pdf` | Downloadable résumé |
| `vite.config.js` | React build and development server settings |
| `netlify.toml` | Netlify build command, publish directory and Node.js version |

React, three.js, GSAP and Lenis are installed through npm and bundled locally.

Each `<section data-formation="…">` owns a particle shape; scrolling from one section to the
next morphs the particles between them. To reorder sections, move their components in `src/App.jsx`.

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

This regenerates the particle map and the web photos in `public/assets/img/`. The script keys out a
blue backdrop (the `blue < 24` test); a different backdrop colour needs a different key.
