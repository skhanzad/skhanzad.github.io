import { gsap } from './lifecycle.js';
import { split } from './text.js';
import { ACTS, mindProgress, scanLevel } from '../world/stages.js';
import { MIND } from '../world/formations.js';

// How many viewport heights the chapter stays pinned for.
const PIN = 3.2;
const SLICES = MIND.slices.top + 1;
// Where the text hands over from one act to the next (just before each act's
// visuals begin).
const HANDOVER = [ACTS.scan[0] - 0.04, ACTS.build[0] - 0.04];
// The box's dimension lines are drawn by this point of its construction.
const MEASURED = 0.9;

const add3 = (a, d, s) => a.map((v, i) => v + d[i] * s);

// "Trust by design": the title defined a word at a time while the particle mind
// behind it is audited, then housed in a glass box. The section pins; its scroll
// drives the words here and, through the World, the mind itself.
export function initTrust({ world, reduced, scope }) {
  const section = document.querySelector('#trust');
  if (!section) return;
  const stage = section.querySelector('[data-trust]');
  const acts = [...section.querySelectorAll('[data-trust-act]')];
  const gauges = [...section.querySelectorAll('[data-trust-gauge]')];
  const bars = gauges.map((g) => g.querySelector('.trust__gauge-bar i'));
  const readout = section.querySelector('[data-trust-readout]');
  const initialReadout = readout.textContent;
  const rail = document.querySelector('[data-rail]');
  const lens = section.querySelector('.trust__lens');
  const hint = section.querySelector('.trust__hint');
  const lensText = lens.dataset.cursorText;

  const say = (text) => {
    if (readout.textContent !== text) readout.textContent = text;
  };
  const status = (p) => {
    const { scan, build } = mindProgress(p);
    if (p < ACTS.scan[0]) return 'mind · unexamined';
    if (scan < 1) return `audit · do(x) · slice ${Math.max(1, Math.round(scan * SLICES))} of ${SLICES}`;
    if (build <= 0) return `audit · ${SLICES} of ${SLICES} slices lucid`;
    // The box's twelve edges are drawn during the first 74% of its construction.
    if (build < 1) return `structure · ${Math.min(12, Math.floor((build / 0.74) * 12))} of 12 edges`;
    return 'glass box · verified ✓';
  };

  const mm = gsap.matchMedia();
  scope.add(() => {
    mm.revert();
    say(initialReadout);
  });

  // Reduced motion, or no WebGL to show the mind: no pin; the acts read as a list.
  const pinned = !!world && !reduced;
  if (!pinned) {
    gauges.forEach((g) => g.classList.add('is-done'));
    say(status(1));
    // Nothing to point at: the lens needs motion.
    hint.hidden = true;
    delete lens.dataset.cursorText;
    scope.add(() => {
      gauges.forEach((g) => g.classList.remove('is-done'));
      hint.hidden = false;
      lens.dataset.cursorText = lensText;
    });
    return;
  }

  mm.add('(prefers-reduced-motion: no-preference)', () => {
    section.classList.add('is-pinned');
    const words = acts.map((act) => split(act.querySelector('[data-trust-word]'), { chars: true }));
    const rest = acts.map((act) => act.querySelectorAll('.trust__sense-no, .trust__sense, .trust__note'));
    const callouts = world ? followMind({ world, section, stage }) : null;

    let last = 0;
    const tl = gsap.timeline({
      defaults: { ease: 'none' },
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${window.innerHeight * PIN}`,
        pin: true,
        scrub: 0.35,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onToggle: (self) => {
          stage.classList.toggle('is-live', self.isActive);
          // The chapter is immersive: the rail keeps its dots but drops its label.
          rail?.classList.toggle('is-quiet', self.isActive);
        },
        onUpdate: (self) => {
          const p = self.progress;
          const act = p < HANDOVER[0] ? 0 : p < HANDOVER[1] ? 1 : 2;
          say(status(p));
          callouts?.update(p, act);
          gauges.forEach((g, i) => g.classList.toggle('is-active', i === act));
          // The lens only works until the box goes up.
          if (act === 2) delete lens.dataset.cursorText;
          else lens.dataset.cursorText = lensText;
          // The mind flares as the audit begins and as the box locks shut.
          if (last < ACTS.scan[0] && p >= ACTS.scan[0]) world?.pulse(0.55);
          if (last < ACTS.build[1] && p >= ACTS.build[1]) world?.pulse(0.9);
          last = p;
        },
      },
    });
    // Timeline positions are fractions of the pinned scroll.
    tl.to({}, { duration: 1 }, 0);

    // Only opacity changes, so every act stays in the accessibility tree.
    gsap.set(words.slice(1).flatMap((w) => w.chars), { yPercent: 115 });
    gsap.set(rest.slice(1).flatMap((r) => [...r]), { opacity: 0, y: 26 });

    HANDOVER.forEach((at, i) => {
      tl.to(words[i].chars, { yPercent: -115, duration: 0.05, stagger: 0.004, ease: 'power2.in' }, at - 0.05)
        .to(rest[i], { opacity: 0, y: -22, duration: 0.04, ease: 'power1.in' }, at - 0.05)
        .to(words[i + 1].chars, { yPercent: 0, duration: 0.06, stagger: 0.005, ease: 'power3.out' }, at + 0.005)
        .to(rest[i + 1], { opacity: 1, y: 0, duration: 0.05, stagger: 0.012, ease: 'power2.out' }, at + 0.02);
    });

    // Gauges fill with their acts: reading, then the scan, then the build.
    const spans = [[0, HANDOVER[0]], ACTS.scan, ACTS.build];
    bars.forEach((bar, i) => {
      tl.fromTo(bar, { scaleX: 0 }, { scaleX: 1, duration: spans[i][1] - spans[i][0] }, spans[i][0]);
    });
    tl.to(hint, { opacity: 0, y: 10, duration: 0.04 }, HANDOVER[1] - 0.04);

    return () => {
      callouts?.destroy();
      lens.dataset.cursorText = lensText;
      section.classList.remove('is-pinned');
      stage.classList.remove('is-live');
      rail?.classList.remove('is-quiet');
      gauges.forEach((g) => g.classList.remove('is-active'));
      words.forEach((w) => w.revert());
    };
  });
}

// The brain's bounding box in the mind's local space, for laying labels around it.
const BRAIN_BOUNDS = [[-0.85, 0.85], [-1.1, 0.72], [-1.1, 1.04]];
const CORNERS = [0, 1, 2, 3, 4, 5, 6, 7].map((i) => BRAIN_BOUNDS.map((b, k) => b[(i >> k) & 1]));
const CENTRE = BRAIN_BOUNDS.map(([a, b]) => (a + b) / 2);

// Labels pinned to points of the 3D mind, repositioned after every frame: the trace's
// steps light up as the scan passes them (set around the brain, like an anatomical
// plate, with leaders back to their nodes); the box's dimensions are named once drawn.
function followMind({ world, section, stage }) {
  const nodes = [...section.querySelectorAll('[data-trust-node]')].map((el, i) => ({
    el,
    leader: section.querySelector(`[data-trust-leader="${i}"]`),
    at: MIND.trace[MIND.traceNodes[i]],
    on: false,
    x: 0,
    y: 0,
    ax: 0,
    ay: 0,
    right: true,
  }));
  nodes.forEach((n) => {
    n.line = n.leader.querySelector('line');
    n.ring = n.leader.querySelector('circle');
  });
  const offset = MIND.dimOffset;
  const dims = [...section.querySelectorAll('[data-trust-dim]')].map((el, i) => {
    const { from, to, dir } = MIND.dims[i];
    const a = add3(from, dir, offset);
    const b = add3(to, dir, offset);
    return { el, a, b, at: a.map((v, k) => (v + b[k]) / 2), on: false };
  });
  const p = { x: 0, y: 0 };
  const pa = { x: 0, y: 0 };
  const pb = { x: 0, y: 0 };
  const set = (item, on) => {
    if (item.on === on) return;
    item.on = on;
    item.el.classList.toggle('is-on', on);
    item.leader?.classList.toggle('is-on', on);
  };

  const follow = () => {
    if (!stage.classList.contains('is-live')) return;
    const box = stage.getBoundingClientRect();
    const live = nodes.filter((n) => n.on);
    if (live.length && world.project('mind', CENTRE, p)) {
      // The brain's outline on screen, roughly: an ellipse about its projected centre,
      // reaching most of the way to its projected bounding box.
      const cx = p.x - box.left;
      const cy = p.y - box.top;
      let rx = 0;
      let ry = 0;
      for (const corner of CORNERS) {
        world.project('mind', corner, p);
        rx = Math.max(rx, Math.abs(p.x - box.left - cx));
        ry = Math.max(ry, Math.abs(p.y - box.top - cy));
      }
      rx = rx * 0.76 + 34;
      ry = ry * 0.74 + 22;
      for (const n of live) {
        world.project('mind', n.at, p);
        n.x = p.x - box.left;
        n.y = p.y - box.top;
        const a = Math.atan2((n.y - cy) / ry, (n.x - cx) / rx);
        n.right = Math.cos(a) >= 0;
        n.ax = cx + Math.cos(a) * rx;
        n.ay = cy + Math.sin(a) * ry;
      }
      // Keep labels on the same side at least a line apart.
      for (const side of [true, false]) {
        const column = live.filter((n) => n.right === side).sort((a, b) => a.ay - b.ay);
        for (let i = 1; i < column.length; i++) column[i].ay = Math.max(column[i].ay, column[i - 1].ay + 26);
      }
      for (const n of live) {
        // Labels are about 150px wide: keep them inside the stage.
        n.ax = n.right ? Math.min(n.ax, box.width - 170) : Math.max(n.ax, 170);
        n.el.classList.toggle('is-left', !n.right);
        n.el.style.transform = `translate3d(${n.ax.toFixed(1)}px, ${n.ay.toFixed(1)}px, 0)`;
        n.line.setAttribute('x1', n.x.toFixed(1));
        n.line.setAttribute('y1', n.y.toFixed(1));
        n.line.setAttribute('x2', (n.ax + (n.right ? -6 : 6)).toFixed(1));
        n.line.setAttribute('y2', n.ay.toFixed(1));
        n.ring.setAttribute('cx', n.x.toFixed(1));
        n.ring.setAttribute('cy', n.y.toFixed(1));
      }
    }
    for (const d of dims) {
      if (!d.on || !world.project('mind', d.at, p) || !world.project('mind', d.a, pa) || !world.project('mind', d.b, pb)) continue;
      // Set along the projected line, and never upside down.
      let angle = (Math.atan2(pb.y - pa.y, pb.x - pa.x) * 180) / Math.PI;
      if (angle > 90) angle -= 180;
      if (angle < -90) angle += 180;
      d.el.style.transform = `translate3d(${(p.x - box.left).toFixed(1)}px, ${(p.y - box.top).toFixed(1)}px, 0) rotate(${angle.toFixed(2)}deg)`;
    }
  };
  const stop = world.afterFrame(follow);

  return {
    update(progress, act) {
      const { build, scan } = mindProgress(progress);
      const level = scanLevel(scan);
      nodes.forEach((n) => set(n, act === 1 && level < n.at[1]));
      dims.forEach((d) => set(d, build >= MEASURED));
    },
    destroy() {
      stop();
      [...nodes, ...dims].forEach((item) => {
        item.el.classList.remove('is-on', 'is-left');
        item.leader?.classList.remove('is-on');
        item.el.style.removeProperty('transform');
      });
    },
  };
}
