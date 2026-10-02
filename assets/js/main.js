import { World } from './world/World.js';
import { split, scramble } from './ui/text.js';
import { initReveals } from './ui/reveal.js';
import { initTimeline } from './ui/timeline.js';
import { initResearch } from './ui/research.js';
import { initLab } from './ui/lab.js';
import { initNav } from './ui/nav.js';
import { initCursor } from './ui/cursor.js';
import { initMarquee, initMagnetic } from './ui/motion.js';
import { initContact } from './ui/contact.js';
import { initChamber } from './sims/chamber.js';

const root = document.documentElement;
const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const frame = () => new Promise((resolve) => requestAnimationFrame(() => resolve()));
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const loader = createLoader(document.querySelector('[data-loader]'));

boot().catch((err) => {
  console.error(err);
  root.classList.add('no-gl');
  loader.done();
});

async function boot() {
  const { gsap, ScrollTrigger, Lenis } = window;
  gsap.registerPlugin(ScrollTrigger);
  if (!location.hash) {
    history.scrollRestoration = 'manual';
    window.scrollTo(0, 0);
  }

  let lenis = null;
  if (!reduced && Lenis) {
    lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
    lenis.on('scroll', ScrollTrigger.update);
    gsap.ticker.add((time) => lenis.raf(time * 1000));
    gsap.ticker.lagSmoothing(0);
    lenis.stop();
  }
  const onScroll = (cb) => {
    if (lenis) lenis.on('scroll', (l) => cb(l.scroll));
    else window.addEventListener('scroll', () => cb(window.scrollY), { passive: true });
    cb(window.scrollY);
  };

  loader.set(0.2);
  const [map] = await Promise.all([loadPortraitMap('assets/img/portrait-map.png').catch(() => null), document.fonts?.ready]);
  loader.set(0.5);
  await frame();

  const name = split(document.querySelector('.hero__name'), { chars: true });

  let world = null;
  if (map && supportsWebGL2()) {
    try {
      world = new World(document.querySelector('[data-gl]'), {
        size: particleBudget(),
        portraitMap: map,
        sections: [...document.querySelectorAll('[data-formation]')].map((el) => ({ name: el.dataset.formation, el })),
        slot: document.querySelector('[data-portrait-slot]'),
        reduced,
      });
      root.classList.add('has-gl');
    } catch (err) {
      console.warn('[world] WebGL unavailable, using the static background.', err);
      world = null;
    }
  }
  if (!world) root.classList.add('no-gl');
  if (new URLSearchParams(location.search).has('debug')) Object.assign(window, { world, lenis });
  loader.set(0.8);
  await frame();

  // The research gallery pins first: triggers created after it account for its spacing.
  initResearch({ reduced });
  initReveals({ reduced });
  initTimeline({ reduced });
  initLab({ world, reduced });
  initNav({ lenis, onScroll });
  initMarquee({ getVelocity: () => lenis?.velocity ?? 0, reduced });
  initMagnetic();
  initContact();
  initPortrait(world);
  const cursor = initCursor();

  if (world) {
    document.querySelectorAll('[data-particle-count]').forEach((el) => (el.textContent = world.count.toLocaleString('en-US')));
    const hint = document.querySelector('[data-hint]');
    const hintText = hint?.textContent;
    let hintTimer;
    world.onHold = (on) => {
      cursor?.setHold(on);
      if (!hint) return;
      clearTimeout(hintTimer);
      hint.textContent = on ? 'Intervening · release to replay' : 'Replaying the counterfactual…';
      if (!on) hintTimer = setTimeout(() => (hint.textContent = hintText), 1600);
    };
    ScrollTrigger.addEventListener('refresh', () => world.refresh());
    window.addEventListener('resize', () => world.resize());
    world.refresh();
    world.update(1 / 60); // compile shaders behind the loader
    gsap.ticker.add((time, deltaMs) => {
      if (!world.paused) world.update(deltaMs / 1000);
    });
  }
  ScrollTrigger.refresh();

  if (!reduced) {
    gsap.set(name.chars, { yPercent: 115 });
    gsap.set('[data-hero-fade]', { opacity: 0, y: 24 });
  }
  if (/^#[\w-]+$/.test(location.hash)) {
    const target = document.querySelector(location.hash);
    if (target && lenis) lenis.scrollTo(target, { immediate: true, force: true });
    else target?.scrollIntoView();
  }

  await loader.done();
  lenis?.start();
  playIntro({ world, name });
  initChamber({ world, lenis, reduced });
  signature(world);
}

// A note for whoever opens the console.
function signature(world) {
  const count = world ? `${world.count.toLocaleString('en-US')} particles` : 'a static fallback';
  console.log(
    `%cYou found the thread.%c\n\nEverything behind this page is one GPU simulation (${count}), steered by your scroll and your cursor.\nHold the mouse anywhere quiet to intervene: do(x).\n\nAgents worth auditing? sourena.khanzadeh@gmail.com`,
    'font: italic 26px "Instrument Serif", Georgia, serif; color: #EDD382;',
    'font: 12px/1.6 "Geist Mono", monospace; color: #F2F3AE;',
  );
}

function playIntro({ world, name }) {
  const { gsap } = window;
  const role = document.querySelector('[data-scramble]');
  if (reduced) {
    world?.intro();
    return;
  }
  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .to(name.chars, { yPercent: 0, duration: 1.9, stagger: 0.04 }, 0.1)
    .add(() => scramble(role, { duration: 1.6 }), 0.55)
    .to('[data-hero-fade]', { opacity: 1, y: 0, duration: 1.5, stagger: 0.09 }, 0.5)
    .from('.nav, .rail', { opacity: 0, duration: 1.4, stagger: 0.4 }, 0.4);
  world?.intro();

  // The entrance drifts up and away as the page begins. Explicit start values, and no
  // immediate render, so these never fight the intro that is still fading things in.
  const out = { ease: 'none', immediateRender: false, scrollTrigger: { trigger: '.hero', start: 'top top', end: 'bottom top', scrub: true } };
  gsap.fromTo('.hero__main', { yPercent: 0, opacity: 1 }, { yPercent: -22, opacity: 0.1, ...out });
  gsap.fromTo('.hero__meta, .hero__foot', { opacity: 1, y: 0 }, { opacity: 0, y: -40, ...out });
}

// "Request raw artifact": the particle representation resolves into the photograph,
// a nod to the holder-approved disclosure in Provenance Preserving Chronicles.
function initPortrait(world) {
  const fig = document.querySelector('[data-portrait]');
  if (!fig) return;
  const button = fig.querySelector('[data-portrait-toggle]');
  const status = fig.querySelector('[data-portrait-status]');
  const say = (text) => {
    status.dataset.text = text;
    status.textContent = text;
    return scramble(status, { duration: 0.6 });
  };
  if (!world) {
    fig.classList.add('is-revealed');
    status.textContent = 'released';
    button.hidden = true;
    return;
  }
  let revealed = false;
  button.addEventListener('click', async () => {
    button.disabled = true;
    if (!revealed) {
      await say('verifying provenance…');
      await wait(450);
      await say('holder approval ✓');
      await wait(300);
      revealed = true;
      fig.classList.add('is-revealed');
      world.setReveal(1);
      say('released');
      button.textContent = 'Return to representation';
    } else {
      revealed = false;
      fig.classList.remove('is-revealed');
      world.setReveal(0);
      say('withheld');
      button.textContent = 'Request raw artifact';
    }
    button.setAttribute('aria-pressed', String(revealed));
    button.disabled = false;
  });
}

function supportsWebGL2() {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}

function particleBudget() {
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const small = Math.min(window.innerWidth, window.innerHeight) < 720;
  if (coarse || small) return 160;
  return (navigator.hardwareConcurrency || 4) >= 8 ? 256 : 192;
}

// Luminance + alpha of the portrait, read once from a small PNG.
function loadPortraitMap(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.naturalWidth;
      canvas.height = img.naturalHeight;
      const g = canvas.getContext('2d', { willReadFrequently: true });
      g.drawImage(img, 0, 0);
      const { data } = g.getImageData(0, 0, canvas.width, canvas.height);
      const n = canvas.width * canvas.height;
      const lum = new Float32Array(n);
      const alpha = new Float32Array(n);
      for (let i = 0; i < n; i++) {
        lum[i] = data[i * 4] / 255;
        alpha[i] = data[i * 4 + 3] / 255;
      }
      resolve({ width: canvas.width, height: canvas.height, lum, alpha });
    };
    img.onerror = reject;
    img.src = src;
  });
}

function createLoader(el) {
  el.style.animation = 'none'; // scripts are alive: cancel the CSS failsafe
  const pct = el.querySelector('[data-loader-pct]');
  const bar = el.querySelector('[data-loader-bar]');
  let shown = 0;
  let target = 0.05;
  let raf = 0;
  const tick = () => {
    shown += (target - shown) * 0.14;
    pct.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${shown})`;
    raf = requestAnimationFrame(tick);
  };
  tick();
  return {
    set(v) {
      target = Math.max(target, v);
    },
    async done() {
      target = 1;
      while (shown < 0.995) await frame();
      cancelAnimationFrame(raf);
      pct.textContent = '100';
      bar.style.transform = 'scaleX(1)';
      const { gsap } = window;
      if (!gsap || reduced) {
        el.remove();
        return;
      }
      await new Promise((resolve) =>
        gsap
          .timeline({ onComplete: resolve })
          .to(el.children, { opacity: 0, y: -12, duration: 0.5, stagger: 0.05, ease: 'power2.in' })
          .to(el, { opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.15'),
      );
      el.remove();
    },
  };
}
