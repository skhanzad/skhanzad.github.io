import Lenis from 'lenis';
import { createScope, gsap, ScrollTrigger } from './ui/lifecycle.js';
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

export function initPortfolio() {
  const scope = createScope();
  const root = document.documentElement;
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const loader = createLoader(document.querySelector('[data-loader]'), { reduced, scope });
  const scrollRestoration = history.scrollRestoration;
  scope.add(() => {
    root.classList.remove('has-gl', 'no-gl', 'has-cursor', 'chamber-open');
    history.scrollRestoration = scrollRestoration;
  });

  let lenis = null;
  let world = null;
  scope.add(() => lenis?.destroy());
  scope.add(() => world?.dispose());

  async function boot() {
    if (!location.hash) {
      history.scrollRestoration = 'manual';
      window.scrollTo(0, 0);
    }
    if (!reduced) {
      lenis = new Lenis({ lerp: 0.085, smoothWheel: true });
      lenis.on('scroll', ScrollTrigger.update);
      scope.tick((time) => lenis.raf(time * 1000));
      lenis.stop();
    }
    const onScroll = (callback) => {
      if (lenis) {
        const update = scope.wrap((state) => callback(state.scroll));
        lenis.on('scroll', update);
        scope.add(() => lenis.off('scroll', update));
      } else scope.on(window, 'scroll', () => callback(window.scrollY), { passive: true });
      callback(window.scrollY);
    };

    loader.set(0.2);
    const [map] = await Promise.all([
      loadPortraitMap('/assets/img/portrait-map.png', scope.signal).catch(() => null),
      document.fonts?.ready,
    ]);
    if (scope.signal.aborted) return;
    loader.set(0.5);
    if (!await scope.frame()) return;
    const name = split(document.querySelector('.hero__name'), { chars: true });
    scope.add(name.revert);

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
      } catch (error) {
        console.warn('[world] WebGL unavailable, using the static background.', error);
      }
    }
    if (!world) root.classList.add('no-gl');
    if (new URLSearchParams(location.search).has('debug')) {
      Object.assign(window, { world, lenis });
      scope.add(() => {
        if (window.world === world) delete window.world;
        if (window.lenis === lenis) delete window.lenis;
      });
    }
    loader.set(0.8);
    if (!await scope.frame()) return;

    scope.run(() => {
      // Create the pinned gallery first so later triggers include its spacing.
      initResearch({ reduced, scope });
      initReveals({ reduced, scope });
      initTimeline({ reduced });
      initLab({ world, reduced, scope });
      initNav({ lenis, onScroll, scope });
      initMarquee({ getVelocity: () => lenis?.velocity ?? 0, reduced, scope });
      initMagnetic({ scope });
      initContact({ scope });
      initPortrait(world, scope);
      const cursor = initCursor({ scope });

      if (world) {
        document.querySelectorAll('[data-particle-count]').forEach((el) => (el.textContent = world.count.toLocaleString('en-US')));
        const hint = document.querySelector('[data-hint]');
        const hintText = hint?.textContent;
        let hintVersion = 0;
        world.onHold = async (on) => {
          cursor?.setHold(on);
          if (!hint) return;
          const version = ++hintVersion;
          hint.textContent = on ? 'Intervening · release to replay' : 'Replaying the counterfactual…';
          if (!on && await scope.wait(1600) && version === hintVersion) hint.textContent = hintText;
        };
        const refresh = () => world.refresh();
        ScrollTrigger.addEventListener('refresh', refresh);
        scope.add(() => ScrollTrigger.removeEventListener('refresh', refresh));
        scope.on(window, 'resize', () => world.resize());
        world.refresh();
        world.update(1 / 60);
        scope.tick((time, deltaMs) => {
          if (!world.paused) world.update(deltaMs / 1000);
        });
      }
      ScrollTrigger.refresh();
      if (!reduced) {
        gsap.set(name.chars, { yPercent: 115 });
        gsap.set('[data-hero-fade]', { opacity: 0, y: 24 });
      }
    });
    if (/^#[\w-]+$/.test(location.hash)) {
      const target = document.querySelector(location.hash);
      if (target && lenis) lenis.scrollTo(target, { immediate: true, force: true });
      else target?.scrollIntoView();
    }
    await loader.done();
    if (scope.signal.aborted) return;
    lenis?.start();
    scope.run(() => {
      playIntro({ world, name, reduced, scope });
      const chamber = initChamber({ world, lenis, reduced, scope });
      scope.add(chamber.destroy);
    });
    signature(world);
  }

  boot().catch((error) => {
    if (scope.signal.aborted) return;
    console.error(error);
    root.classList.add('no-gl');
    lenis?.start();
    loader.done();
  });
  return () => scope.dispose();
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

function playIntro({ world, name, reduced, scope }) {
  const role = document.querySelector('[data-scramble]');
  if (reduced) {
    world?.intro();
    return;
  }
  gsap
    .timeline({ defaults: { ease: 'expo.out' } })
    .to(name.chars, { yPercent: 0, duration: 1.9, stagger: 0.04 }, 0.1)
    .add(() => scramble(role, { duration: 1.6, signal: scope.signal }), 0.55)
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
function initPortrait(world, scope) {
  const fig = document.querySelector('[data-portrait]');
  if (!fig) return;
  const button = fig.querySelector('[data-portrait-toggle]');
  const status = fig.querySelector('[data-portrait-status]');
  const initialStatus = status.textContent;
  const initialLabel = button.textContent;
  scope.add(() => {
    fig.classList.remove('is-revealed');
    status.textContent = initialStatus;
    status.removeAttribute('data-text');
    status.removeAttribute('aria-label');
    button.hidden = false;
    button.disabled = false;
    button.textContent = initialLabel;
    button.setAttribute('aria-pressed', 'false');
  });
  const say = (text) => {
    status.dataset.text = text;
    status.textContent = text;
    return scramble(status, { duration: 0.6, signal: scope.signal });
  };
  if (!world) {
    fig.classList.add('is-revealed');
    status.textContent = 'released';
    button.hidden = true;
    return;
  }
  let revealed = false;
  scope.on(button, 'click', async () => {
    button.disabled = true;
    if (!revealed) {
      await say('verifying provenance…');
      if (!await scope.wait(450)) return;
      await say('holder approval ✓');
      if (!await scope.wait(300)) return;
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
    const context = document.createElement('canvas').getContext('webgl2');
    context?.getExtension('WEBGL_lose_context')?.loseContext();
    return !!context;
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
function loadPortraitMap(src, signal) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const cancel = () => {
      img.onload = null;
      img.onerror = null;
      img.src = '';
      resolve(null);
    };
    signal.addEventListener('abort', cancel, { once: true });
    img.onload = () => {
      signal.removeEventListener('abort', cancel);
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
    img.onerror = (error) => {
      signal.removeEventListener('abort', cancel);
      reject(error);
    };
    img.src = src;
  });
}

function createLoader(el, { reduced, scope }) {
  if (!el) return { set() {}, done: () => Promise.resolve() };
  el.hidden = false;
  el.style.animation = 'none';
  const pct = el.querySelector('[data-loader-pct]');
  const bar = el.querySelector('[data-loader-bar]');
  let shown = 0;
  let target = 0.05;
  let raf = 0;
  let finishing = null;
  const tick = () => {
    shown += (target - shown) * 0.14;
    pct.textContent = String(Math.round(shown * 100)).padStart(3, '0');
    bar.style.transform = `scaleX(${shown})`;
    raf = requestAnimationFrame(tick);
  };
  scope.add(() => {
    cancelAnimationFrame(raf);
    el.hidden = false;
    el.style.removeProperty('animation');
  });
  tick();
  return {
    set(value) { target = Math.max(target, value); },
    done() {
      if (finishing) return finishing;
      finishing = (async () => {
        target = 1;
        while (shown < 0.995) if (!await scope.frame()) return;
        cancelAnimationFrame(raf);
        if (scope.signal.aborted) return;
        pct.textContent = '100';
        bar.style.transform = 'scaleX(1)';
        if (!reduced) {
          await new Promise((resolve) => {
            scope.signal.addEventListener('abort', resolve, { once: true });
            scope.run(() => gsap.timeline({ onComplete: () => {
              scope.signal.removeEventListener('abort', resolve);
              resolve();
            } })
              .to(el.children, { opacity: 0, y: -12, duration: 0.5, stagger: 0.05, ease: 'power2.in' })
              .to(el, { opacity: 0, duration: 0.7, ease: 'power2.out' }, '-=0.15'));
          });
        }
        if (!scope.signal.aborted) el.hidden = true;
      })();
      return finishing;
    },
  };
}
