// The simulation chamber: a full-screen dialog that hosts one research simulation at
// a time. Simulations load on demand; while one is open the page behind is inert, its
// scroll is locked and the background particle world is paused.
//
// A simulation module exports create({ stage, panel, reduced }) and returns
// { start(), stop(), destroy() }. It draws into `stage` and builds its controls in `panel`.

export const SIMS = [
  { id: 'ariadne', title: 'Project Ariadne', sub: 'Causal auditing of LLM agents', load: () => import('./ariadne.js') },
  { id: 'gaszero', title: 'GasZero', sub: 'Fuzz-tested smart-contract optimization', load: () => import('./gaszero.js') },
  { id: 'search', title: 'Heuristic Search', sub: 'Planning and automated refactoring', load: () => import('./search.js') },
  { id: 'gansemble', title: 'GANsemble', sub: 'Learning from small, imbalanced datasets', load: () => import('./gansemble.js') },
  { id: 'iss', title: 'Interventional Separation Selection', sub: 'Causal certification', load: () => import('./iss.js') },
  { id: 'chronicles', title: 'Provenance Preserving Chronicles', sub: 'Private AI context', load: () => import('./chronicles.js') },
  { id: 'mesh', title: 'AgentMesh & Folio', sub: 'Agent orchestration and evaluation', load: () => import('./mesh.js') },
  { id: 'pllm', title: 'PLLM+', sub: 'Reproducible Python dependency repair', load: () => import('./pllm.js') },
];

const HASH = /^#sim\/([\w-]+)$/;

export function initChamber({ world, lenis, reduced }) {
  const { gsap } = window;
  const root = document.createElement('div');
  root.className = 'chamber';
  root.hidden = true;
  root.setAttribute('role', 'dialog');
  root.setAttribute('aria-modal', 'true');
  root.setAttribute('aria-labelledby', 'chamber-title');
  root.dataset.lenisPrevent = '';
  root.dataset.noIntervene = '';
  root.innerHTML = `
    <div class="chamber__backdrop" data-close></div>
    <div class="chamber__frame">
      <header class="chamber__head">
        <div class="chamber__titles">
          <p class="chamber__kicker"><span data-index>01</span> / ${String(SIMS.length).padStart(2, '0')} · Live simulation</p>
          <h2 class="chamber__title" id="chamber-title" data-title></h2>
          <p class="chamber__sub" data-sub></p>
        </div>
        <div class="chamber__nav">
          <button type="button" class="chamber__btn" data-prev aria-label="Previous simulation">←</button>
          <button type="button" class="chamber__btn" data-next aria-label="Next simulation">→</button>
          <button type="button" class="chamber__btn chamber__btn--close" data-close>Close <span aria-hidden="true">×</span></button>
        </div>
      </header>
      <div class="chamber__body">
        <div class="chamber__stage" data-stage></div>
        <div class="chamber__panel" data-panel></div>
      </div>
    </div>`;
  document.body.append(root);

  const frame = root.querySelector('.chamber__frame');
  const backdrop = root.querySelector('.chamber__backdrop');
  const stage = root.querySelector('[data-stage]');
  const panel = root.querySelector('[data-panel]');
  const $ = (s) => root.querySelector(s);

  let current = null;
  let sim = null;
  let trigger = null;
  let token = 0;
  let inerted = [];

  const lock = (on) => {
    document.documentElement.classList.toggle('chamber-open', on);
    if (on) {
      lenis?.stop();
      inerted = [...document.body.children].filter((n) => n !== root && !n.matches('script, .cursor, .toast'));
      inerted.forEach((n) => (n.inert = true));
    } else {
      inerted.forEach((n) => (n.inert = false));
      inerted = [];
      lenis?.start();
    }
    if (world) world.paused = on;
  };

  const teardown = () => {
    try {
      sim?.destroy?.();
    } catch (err) {
      console.error(err);
    }
    sim = null;
    stage.replaceChildren();
    panel.replaceChildren();
    panel.scrollTop = 0;
  };

  async function open(id, from) {
    const index = SIMS.findIndex((s) => s.id === id);
    if (index < 0) return;
    const meta = SIMS[index];
    const mine = ++token;
    if (root.hidden) {
      trigger = from || document.activeElement;
      root.hidden = false;
      lock(true);
      if (!reduced) {
        gsap.fromTo(backdrop, { opacity: 0 }, { opacity: 1, duration: 0.5, ease: 'power2.out' });
        gsap.fromTo(frame, { opacity: 0, y: 28, scale: 0.985 }, { opacity: 1, y: 0, scale: 1, duration: 0.8, ease: 'expo.out' });
      }
    }
    teardown();
    current = meta;
    $('[data-index]').textContent = String(index + 1).padStart(2, '0');
    $('[data-title]').textContent = meta.title;
    $('[data-sub]').textContent = meta.sub;
    history.replaceState(null, '', `#sim/${meta.id}`);
    stage.innerHTML = '<p class="chamber__loading">Assembling the simulation…</p>';
    $('[data-close]:not(.chamber__backdrop)').focus({ preventScroll: true });

    try {
      const mod = await meta.load();
      if (mine !== token) return;
      stage.replaceChildren();
      sim = mod.create({ stage, panel, reduced, meta });
      sim.start?.();
    } catch (err) {
      console.error(err);
      if (mine !== token) return;
      stage.innerHTML = '<p class="chamber__loading">This simulation could not start in this browser.</p>';
    }
  }

  function close() {
    if (root.hidden) return;
    token++;
    const done = () => {
      teardown();
      root.hidden = true;
      current = null;
      lock(false);
      history.replaceState(null, '', '#research');
      trigger?.focus?.({ preventScroll: true });
    };
    if (reduced) return done();
    gsap.to(frame, { opacity: 0, y: 18, scale: 0.99, duration: 0.35, ease: 'power2.in' });
    gsap.to(backdrop, { opacity: 0, duration: 0.4, ease: 'power2.in', onComplete: done });
  }

  const step = (dir) => {
    if (!current) return;
    const i = SIMS.indexOf(current);
    open(SIMS[(i + dir + SIMS.length) % SIMS.length].id);
  };

  root.addEventListener('click', (e) => {
    if (e.target.closest('[data-close]')) close();
    else if (e.target.closest('[data-prev]')) step(-1);
    else if (e.target.closest('[data-next]')) step(1);
  });
  document.addEventListener('keydown', (e) => {
    if (root.hidden) return;
    if (e.key === 'Escape') close();
  });
  document.addEventListener('click', (e) => {
    const trig = e.target.closest('[data-sim]');
    if (!trig || root.contains(trig)) return;
    e.preventDefault();
    open(trig.dataset.sim, trig);
  });

  const fromHash = () => {
    const m = location.hash.match(HASH);
    if (m) open(m[1]);
  };
  window.addEventListener('hashchange', fromHash);
  fromHash();

  return { open, close };
}
