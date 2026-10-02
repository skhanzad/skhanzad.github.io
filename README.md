# sourena-khanzadeh.com

Portfolio of Sourena Khanzadeh, Cognitive Trust Architect. A static site: no build step, no framework.

## Run locally

ES modules need a server (opening `index.html` from disk won't work):

```bash
python3 -m http.server 4173
# then open http://localhost:4173
```

Add `?debug` to the URL to expose `window.world` and `window.lenis` in the console.

## Deploy

Upload the folder as-is to any static host (Netlify, Vercel, GitHub Pages, S3, Cloudflare Pages).
`master.md`, `sourena.png` and `tools/` are not needed at runtime. `resume.pdf` is linked from the page.

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

## Changing the photo

Replace `sourena.png` (a head-and-shoulders shot on a plain backdrop works best), then:

```bash
python3 tools/make-portrait.py   # needs numpy, scipy, pillow
```

This regenerates the particle map and the web photos in `assets/img/`. The script keys out a
blue backdrop (the `blue < 24` test); a different backdrop colour needs a different key.
