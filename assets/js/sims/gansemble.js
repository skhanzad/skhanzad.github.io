// GANsemble: what to add when a classifier has to learn from a small, imbalanced set.
//
// Three classes live in 2-D: a crescent (the majority), a cluster, and a thin arc (the
// minority) squeezed between them. The training set is imbalanced; the test set is
// balanced. Before the same small network is trained, each strategy tops the smaller
// classes up to the majority's size: with nothing, with duplicates, with jittered copies
// whose strength is chosen on a validation split, or with samples from a conditional GAN
// trained here, live. Everything is seeded, so a seed always reproduces the same numbers.
import {
  C,
  INK,
  alpha,
  rng,
  gauss,
  shuffle,
  clamp,
  easeOut,
  fmt,
  stageCanvas,
  pointer,
  loop,
  label,
  labelFit,
  textWidth,
  roundRect,
  glow,
  dot,
  line,
  section,
  para,
  slider,
  toggle,
  choice,
  actions,
  readout,
  legend,
  paper,
  fine,
  live,
  status,
  hint,
} from './kit.js';

const CLASSES = [
  { name: 'crescent', color: C.gold },
  { name: 'cluster', color: C.amber },
  { name: 'arc', color: C.ember },
];
const SHAPES = [
  { kind: 'crescent', c: [0.135, 0], R: 0.62, from: 0.25, to: 1.75, thick: 0.09 },
  { kind: 'blob', c: [0.255, 0], sd: 0.11 },
  { kind: 'arc', c: [0.135, 0], R: 0.38, from: 0.3, to: 1.7, thick: 0.045 },
];
const STRATS = [
  { id: 'none', label: 'None', short: 'None' },
  { id: 'dup', label: 'Duplicate', short: 'Dup' },
  { id: 'aug', label: 'Augment', short: 'Aug' },
  { id: 'gan', label: 'cGAN', short: 'cGAN' },
];
const POOL = 120; // points per class in the pool; the majority uses all of them
const TEST_N = 60; // balanced test set, per class
const VIEW = 0.95; // the plot shows [-VIEW, VIEW]²
const SEEDS = 10;
const CLF = { hidden: 16, steps: 400, batch: 32, lr: 0.02 };
const GAN = { z: 4, hidden: 24, steps: 1000, batch: 36, lr: 1e-3, noise: 0.18 };
const SIGMAS = [0.02, 0.04, 0.06, 0.09, 0.13, 0.18];
const BUDGET = 7; // ms of training per frame
const PACE = 10; // work units per frame when a run is paced for watching
const PREVIEW = 48; // generator samples drawn per class while the GAN trains

/* ------------------------------------------------------------------ */
/* Data                                                               */
/* ------------------------------------------------------------------ */

// Independent, reproducible random streams: one per (seed, purpose).
const stream = (seed, k) => rng((Math.imul(seed ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(k + 1, 0xc2b2ae35)) >>> 0);

function drawShape(r, s) {
  if (s.kind === 'blob') return [s.c[0] + gauss(r) * s.sd, s.c[1] + gauss(r) * s.sd];
  const u = r();
  const t = Math.PI * (s.from + (s.to - s.from) * u);
  const thick = s.kind === 'crescent' ? s.thick * (0.3 + 0.7 * Math.sin(Math.PI * u)) : s.thick;
  const rad = s.R + thick * gauss(r);
  return [s.c[0] + rad * Math.cos(t), s.c[1] + rad * Math.sin(t)];
}

const counts = (ratio) => [POOL, Math.round(POOL / Math.sqrt(ratio)), Math.max(5, Math.round(POOL / ratio))];

// Pools are drawn in a fixed order, so changing the imbalance only adds or removes
// points at the end of each class: the rest of the dataset stays put.
function makeData(seed, ratio) {
  const r = stream(seed, 1);
  const pools = SHAPES.map((s) => Array.from({ length: POOL }, () => drawShape(r, s)));
  const tests = SHAPES.map((s) => Array.from({ length: TEST_N }, () => drawShape(r, s)));
  const n = counts(ratio);
  const train = [];
  const test = [];
  n.forEach((k, c) => pools[c].slice(0, k).forEach(([x, y]) => train.push({ x, y, c })));
  tests.forEach((list, c) => list.forEach(([x, y]) => test.push({ x, y, c })));
  return { seed, ratio, n, train, test, key: `${seed}:${ratio}` };
}

function classCounts(set) {
  const n = [0, 0, 0];
  for (const p of set) n[p.c]++;
  return n;
}

const needOf = (n) => n.map((k) => Math.max(...n) - k);

/* ------------------------------------------------------------------ */
/* A small dense network with Adam                                    */
/* ------------------------------------------------------------------ */

// sizes = [in, hidden…, out]; tanh or leaky-ReLU hidden units, linear output. It works one
// sample at a time and accumulates gradients until step().
function mlp(sizes, r, act = 'tanh', outScale = 1) {
  const L = sizes.length - 1;
  const tanh = act === 'tanh';
  const W = [];
  const B = [];
  const gW = [];
  const gB = [];
  const params = [];
  const a = sizes.map((n) => new Float64Array(n));
  const d = sizes.map((n) => new Float64Array(n));
  for (let l = 0; l < L; l++) {
    const fi = sizes[l];
    const fo = sizes[l + 1];
    const s = Math.sqrt((tanh ? 1 : 2) / fi) * (l === L - 1 ? outScale : 1);
    const w = Float64Array.from({ length: fi * fo }, () => gauss(r) * s);
    W.push(w);
    B.push(new Float64Array(fo));
    gW.push(new Float64Array(fi * fo));
    gB.push(new Float64Array(fo));
    params.push([w, gW[l], new Float64Array(w.length), new Float64Array(w.length)]);
    params.push([B[l], gB[l], new Float64Array(fo), new Float64Array(fo)]);
  }
  let t = 0;
  return {
    forward(x) {
      a[0].set(x);
      for (let l = 0; l < L; l++) {
        const fi = sizes[l];
        const w = W[l];
        const ai = a[l];
        const ao = a[l + 1];
        const last = l === L - 1;
        for (let j = 0; j < ao.length; j++) {
          let s = B[l][j];
          const off = j * fi;
          for (let i = 0; i < fi; i++) s += w[off + i] * ai[i];
          ao[j] = last ? s : tanh ? Math.tanh(s) : s > 0 ? s : 0.2 * s;
        }
      }
      return a[L];
    },
    // Backpropagate dOut through the last forward pass. Weight gradients accumulate unless
    // `accumulate` is false; with `wantInput` the gradient at the input is returned.
    backward(dOut, accumulate = true, wantInput = false) {
      d[L].set(dOut);
      for (let l = L - 1; l >= 0; l--) {
        const fi = sizes[l];
        const w = W[l];
        const ai = a[l];
        const dn = d[l + 1];
        const dp = d[l];
        const back = l > 0 || wantInput;
        if (back) dp.fill(0);
        for (let j = 0; j < dn.length; j++) {
          const g = dn[j];
          const off = j * fi;
          if (accumulate) {
            gB[l][j] += g;
            const gw = gW[l];
            for (let i = 0; i < fi; i++) gw[off + i] += g * ai[i];
          }
          if (back) for (let i = 0; i < fi; i++) dp[i] += w[off + i] * g;
        }
        if (l > 0) {
          if (tanh) for (let i = 0; i < fi; i++) dp[i] *= 1 - ai[i] * ai[i];
          else for (let i = 0; i < fi; i++) if (ai[i] <= 0) dp[i] *= 0.2;
        }
      }
      return d[0];
    },
    step(lr, scale, b1 = 0.9, b2 = 0.999) {
      t++;
      const c1 = 1 - b1 ** t;
      const c2 = 1 - b2 ** t;
      for (const [p, g, m, v] of params) {
        for (let i = 0; i < p.length; i++) {
          const gi = g[i] * scale;
          m[i] = b1 * m[i] + (1 - b1) * gi;
          v[i] = b2 * v[i] + (1 - b2) * gi * gi;
          p[i] -= (lr * m[i]) / c1 / (Math.sqrt(v[i] / c2) + 1e-8);
          g[i] = 0;
        }
      }
    },
  };
}

/* ------------------------------------------------------------------ */
/* Classifier and oversamplers                                        */
/* ------------------------------------------------------------------ */

const xy = new Float64Array(2);
const g3 = new Float64Array(3);

function logits(net, x, y) {
  xy[0] = x;
  xy[1] = y;
  return net.forward(xy);
}

// One Adam step of softmax cross-entropy on a minibatch drawn with replacement, so a
// class's share of every batch is its share of the training set.
function clfStep(net, set, r) {
  let loss = 0;
  for (let b = 0; b < CLF.batch; b++) {
    const p = set[(r() * set.length) | 0];
    const o = logits(net, p.x, p.y);
    const m = Math.max(o[0], o[1], o[2]);
    let s = 0;
    for (let k = 0; k < 3; k++) s += g3[k] = Math.exp(o[k] - m);
    loss += Math.log(s) + m - o[p.c];
    for (let k = 0; k < 3; k++) g3[k] = g3[k] / s - (k === p.c ? 1 : 0);
    net.backward(g3);
  }
  net.step(CLF.lr, 1 / CLF.batch);
  return loss / CLF.batch;
}

function evaluate(net, pts) {
  const hit = [0, 0, 0];
  const tot = [0, 0, 0];
  let nll = 0;
  for (const p of pts) {
    const o = logits(net, p.x, p.y);
    const k = o[1] > o[0] ? (o[2] > o[1] ? 2 : 1) : o[2] > o[0] ? 2 : 0;
    tot[p.c]++;
    if (k === p.c) hit[p.c]++;
    const m = Math.max(o[0], o[1], o[2]);
    nll += Math.log(Math.exp(o[0] - m) + Math.exp(o[1] - m) + Math.exp(o[2] - m)) + m - o[p.c];
  }
  const recall = hit.map((h, c) => (tot[c] ? h / tot[c] : 0));
  return { acc: (hit[0] + hit[1] + hit[2]) / pts.length, recall, bal: (recall[0] + recall[1] + recall[2]) / 3, nll: nll / pts.length };
}

// Repeat each smaller class's points (evenly, in shuffled order) until it matches the majority.
function duplicate(set, r) {
  const need = needOf(classCounts(set));
  const synth = [];
  const halo = new Map();
  for (let c = 0; c < 3; c++) {
    const pts = shuffle(
      r,
      set.filter((p) => p.c === c),
    );
    for (let k = 0; k < need[c]; k++) {
      const p = pts[k % pts.length];
      synth.push({ x: p.x, y: p.y, c });
      halo.set(p, (halo.get(p) || 0) + 1);
    }
  }
  return { synth, halo };
}

// Oversample with Gaussian-jittered copies of random points of the same class.
function jitter(set, sigma, r) {
  const need = needOf(classCounts(set));
  const synth = [];
  for (let c = 0; c < 3; c++) {
    const pts = set.filter((p) => p.c === c);
    for (let k = 0; k < need[c]; k++) {
      const p = pts[(r() * pts.length) | 0];
      synth.push({ x: p.x + sigma * gauss(r), y: p.y + sigma * gauss(r), c });
    }
  }
  return synth;
}

// A stratified 70/30 split of the training set for the augmentation search.
function split(set, r) {
  const fit = [];
  const val = [];
  for (let c = 0; c < 3; c++) {
    const pts = shuffle(
      r,
      set.filter((p) => p.c === c),
    );
    const nv = Math.max(2, Math.round(pts.length * 0.3));
    pts.forEach((p, i) => (i < nv ? val : fit).push(p));
  }
  return { fit, val };
}

const sigmoid = (o) => (o >= 0 ? 1 / (1 + Math.exp(-o)) : Math.exp(o) / (1 + Math.exp(o)));

// Fixed latent codes per class: the synthetic points are G(z) for the first ones, so the
// samples that drift into shape during training are exactly the ones that get used.
function latents(seed) {
  const r = stream(seed, 50);
  return [0, 1, 2].map(() => Array.from({ length: POOL }, () => Float64Array.from({ length: GAN.z }, () => gauss(r))));
}

const gin = new Float64Array(GAN.z + 3);

function generate(G, z, c) {
  gin.set(z);
  gin.fill(0, GAN.z);
  gin[GAN.z + c] = 1;
  return G.forward(gin);
}

const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
const sd = (a) => (a.length > 1 ? Math.sqrt(a.reduce((s, v) => s + (v - mean(a)) ** 2, 0) / (a.length - 1)) : 0);
const pct = (v, d = 1) => fmt.pct(v, d);
const tone = (v, good, warn) => (v >= good ? 'ok' : v >= warn ? 'warn' : 'bad');

/* ------------------------------------------------------------------ */
/* Simulation                                                         */
/* ------------------------------------------------------------------ */

export function create({ stage, panel, reduced }) {
  const params = { strategy: 'none', ratio: 8.5, showTest: false };
  let seed = 7;
  let data = makeData(seed, params.ratio);
  let single = {}; // results on the current dataset, by strategy
  let multi = null; // the latest ten-seed run
  let ganCache = null; // the trained cGAN for the current dataset
  let job = null; // { it, live, done } the computation being stepped
  let run = null; // { k, s } while the ten-seed protocol runs
  let pending = 0; // time (ms) at which a debounced retrain starts
  let narration = { text: '', tone: INK[2] };
  const show = { data, net: null, synth: [], halo: null, search: null, gan: null, trace: null, held: null, step: 0, phase: '', dirty: true, born: 0, netAt: 0 };
  const L = {};
  const HOLD = Infinity;

  const narrate = (text, t = INK[2]) => (narration = { text, tone: t });

  /* ---------------------------------------------------------------- */
  /* Jobs: generators that yield work units, stepped by the frame loop */
  /* ---------------------------------------------------------------- */

  function* hold(sec) {
    const until = performance.now() + sec * 1000;
    while (performance.now() < until) yield HOLD;
  }

  // Train the classifier (same seed, same budget for every strategy); re-initialise on divergence.
  function* fit(set, s, ui, cost = 1) {
    let net = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const r = stream(s, 10 + attempt);
      net = mlp([2, CLF.hidden, CLF.hidden, 3], r, 'tanh');
      if (ui.view) setNet(net);
      let ok = true;
      for (let k = 0; k < CLF.steps; k++) {
        if (!Number.isFinite(clfStep(net, set, r))) {
          ok = false;
          break;
        }
        if (ui.view) {
          show.dirty = true;
          show.step = k + 1;
        }
        yield cost;
      }
      if (ok) break;
      if (ui.view) narrate('The classifier diverged, so it was re-initialised.', C.ember);
    }
    return net;
  }

  function* search(d, ui) {
    const { fit: part, val } = split(d.train, stream(d.seed, 3));
    const state = { scores: [], current: -1, best: -1 };
    if (ui.view) {
      show.search = state;
      show.held = new Set(val);
    }
    if (needOf(classCounts(part)).every((k) => k === 0)) return state;
    for (let i = 0; i < SIGMAS.length; i++) {
      state.current = i;
      const synth = jitter(part, SIGMAS[i], stream(d.seed, 20 + i));
      if (ui.view) {
        present({ synth });
        show.phase = 'search';
        narrate(`Jitter σ = ${SIGMAS[i]}: training on 70% of the points, scoring on the dimmed 30%…`, C.amber);
      }
      const net = yield* fit([...part, ...synth], d.seed, ui, ui.live ? 0.25 : 1);
      state.scores.push(evaluate(net, val));
      if (ui.live) yield* hold(0.14);
    }
    let best = 0;
    state.scores.forEach((e, i) => {
      const b = state.scores[best];
      if (e.bal > b.bal + 1e-9 || (Math.abs(e.bal - b.bal) < 1e-9 && e.nll < b.nll)) best = i;
    });
    state.current = -1;
    state.best = best;
    if (ui.view) {
      show.held = null;
      narrate(`σ = ${SIGMAS[best]} scores best on validation (${pct(state.scores[best].bal, 0)}): oversampling with it.`, C.amber);
    }
    if (ui.live) yield* hold(0.6);
    return state;
  }

  // Train the conditional GAN: non-saturating loss, Adam (β1 = 0.5), class-balanced batches
  // and instance noise annealed to zero. Restart from a fresh seed if it diverges.
  function* trainGan(d, ui) {
    const zs = latents(d.seed);
    const byClass = [0, 1, 2].map((c) => d.train.filter((p) => p.c === c));
    const din = new Float64Array(5);
    const d1 = new Float64Array(1);
    const d2 = new Float64Array(2);
    let state = null;
    for (let attempt = 0; attempt < 4; attempt++) {
      const r = stream(d.seed, 40 + attempt);
      const G = mlp([GAN.z + 3, GAN.hidden, GAN.hidden, 2], r, 'lrelu', 0.3);
      const D = mlp([5, GAN.hidden, GAN.hidden, 1], r, 'lrelu');
      state = { key: d.key, G, zs, step: 0, trace: [], ema: null };
      if (ui.view) show.gan = state;
      const z = new Float64Array(GAN.z);
      let ok = true;
      for (let s = 0; s < GAN.steps && ok; s++) {
        const noise = GAN.noise * Math.max(0, 1 - s / (GAN.steps * 0.85));
        let real = 0;
        let fake = 0;
        let loss = 0;
        // Discriminator: real points up, generated points down.
        for (let b = 0; b < GAN.batch; b++) {
          const c = b % 3;
          const p = byClass[c][(r() * byClass[c].length) | 0];
          din.fill(0);
          din[2 + c] = 1;
          din[0] = p.x + noise * gauss(r);
          din[1] = p.y + noise * gauss(r);
          let q = sigmoid(D.forward(din)[0]);
          d1[0] = q - 1;
          D.backward(d1);
          loss -= Math.log(q + 1e-12);
          real += q;
          for (let i = 0; i < GAN.z; i++) z[i] = gauss(r);
          const g = generate(G, z, c);
          din[0] = g[0] + noise * gauss(r);
          din[1] = g[1] + noise * gauss(r);
          q = sigmoid(D.forward(din)[0]);
          d1[0] = q;
          D.backward(d1);
          loss -= Math.log(1 - q + 1e-12);
          fake += q;
        }
        D.step(GAN.lr, 1 / GAN.batch, 0.5, 0.999);
        // Generator: move samples toward where the discriminator says "real".
        for (let b = 0; b < GAN.batch; b++) {
          const c = b % 3;
          for (let i = 0; i < GAN.z; i++) z[i] = gauss(r);
          const g = generate(G, z, c);
          if (!(Math.abs(g[0]) < 20 && Math.abs(g[1]) < 20)) ok = false;
          din.fill(0);
          din[2 + c] = 1;
          din[0] = g[0] + noise * gauss(r);
          din[1] = g[1] + noise * gauss(r);
          const q = sigmoid(D.forward(din)[0]);
          d1[0] = q - 1;
          const dx = D.backward(d1, false, true);
          d2[0] = dx[0];
          d2[1] = dx[1];
          G.backward(d2);
          loss -= Math.log(q + 1e-12);
        }
        G.step(GAN.lr, 1 / GAN.batch, 0.5, 0.999);
        if (!Number.isFinite(loss)) ok = false;
        const now = [real / GAN.batch, fake / GAN.batch];
        state.ema = state.ema ? state.ema.map((v, i) => v * 0.9 + now[i] * 0.1) : now;
        if (s % 10 === 0) state.trace.push(state.ema);
        state.step = s + 1;
        if (ui.view) show.step = s + 1;
        yield 2.5;
      }
      if (ok) break;
      if (ui.view) narrate('The GAN diverged, so it was re-initialised from a fresh seed…', C.ember);
    }
    return state;
  }

  function ganSamples(gan, need) {
    const out = [];
    for (let c = 0; c < 3; c++) {
      for (let k = 0; k < need[c]; k++) {
        const g = generate(gan.G, gan.zs[c][k], c);
        if (Number.isFinite(g[0] + g[1])) out.push({ x: g[0], y: g[1], c });
      }
    }
    return out;
  }

  // One strategy on dataset d: build the synthetic set, train, evaluate on the balanced test set.
  function* strategy(id, d, ui) {
    const res = { id, key: d.key, synth: [], halo: null, search: null, gan: null };
    if (ui.view) {
      show.data = d;
      present({ synth: [] });
      show.phase = 'train';
    }
    if (id === 'dup') {
      Object.assign(res, duplicate(d.train, stream(d.seed, 2)));
    } else if (id === 'aug') {
      res.search = yield* search(d, ui);
      if (res.search.best >= 0) res.synth = jitter(d.train, SIGMAS[res.search.best], stream(d.seed, 5));
    } else if (id === 'gan') {
      if (ganCache && ganCache.key === d.key) res.gan = ganCache;
      else {
        if (ui.view) {
          setNet(null);
          show.phase = 'gan';
        }
        res.gan = yield* trainGan(d, ui);
        if (d.key === data.key) ganCache = res.gan;
      }
      res.synth = ganSamples(res.gan, needOf(d.n));
      if (ui.view) {
        show.gan = null;
        show.fade = { gan: res.gan, t0: performance.now() };
        narrate(`Sampling ${fmt.int(res.synth.length)} synthetic points from the trained generator…`, C.amber);
      }
      if (ui.live) yield* hold(0.45);
    }
    if (ui.view) {
      present(res);
      show.phase = 'train';
      if (id !== 'aug' || res.search.best < 0) narrate(startText(id, d), C.amber);
      else narrate(`Training on the real points plus ${fmt.int(res.synth.length)} copies jittered with σ = ${SIGMAS[res.search.best]}…`, C.amber);
    }
    res.net = yield* fit([...d.train, ...res.synth], d.seed, ui);
    Object.assign(res, evaluate(res.net, d.test));
    return res;
  }

  // The protocol: every strategy on ten seeds (new train and test draws each time). The
  // current seed runs last, so the stage ends where it started.
  function* protocol() {
    const res = { none: [], dup: [], aug: [], gan: [] };
    multi = { res, done: 0, ratio: params.ratio };
    for (let k = 0; k < SEEDS; k++) {
      const s = seed + ((k + 1) % SEEDS);
      const d = s === seed ? data : makeData(s, params.ratio);
      run = { k, s };
      show.data = d;
      setNet(null);
      present({ synth: [] });
      const order = [params.strategy, ...STRATS.map((t) => t.id).filter((id) => id !== params.strategy)];
      for (const id of order) {
        const view = id === params.strategy;
        run.id = id;
        let r = d === data ? single[id] : null;
        if (!r) r = yield* strategy(id, d, { view, live: false });
        if (d === data) single[id] = r;
        if (view) present(r);
        res[id].push({ acc: r.acc, recall: r.recall });
        if (view) narrate(`Seed ${k + 1} of ${SEEDS} · ${label_(id)}: ${pct(r.acc)} test accuracy, arc recall ${pct(r.recall[2], 0)}.`, C.amber);
      }
      multi.done = k + 1;
    }
  }

  const label_ = (id) => STRATS.find((t) => t.id === id).label;

  function startText(id, d) {
    const [, nB, nC] = d.n;
    const total = d.n[0] + nB + nC;
    if (id === 'none') return `Training on the raw set, where the arc is ${nC} of ${total} points…`;
    if (id === 'dup') return `Repeating the ${nC} arc and ${nB} cluster points until each class has ${d.n[0]}…`;
    if (id === 'aug') return 'The classes are already balanced: there is nothing to add.';
    return `Training on the real points plus ${fmt.int(needOf(d.n).reduce((a, b) => a + b, 0))} generated ones…`;
  }

  function resultText(r) {
    const head = {
      none: 'No oversampling',
      dup: 'Duplication',
      aug: r.search?.best >= 0 ? `Jitter σ = ${SIGMAS[r.search.best]}` : 'Augmentation',
      gan: 'cGAN samples',
    }[r.id];
    return `${head}: ${pct(r.acc)} test accuracy, and ${pct(r.recall[2], 0)} of the arc's test points recovered.`;
  }

  /* ---------------------------------------------------------------- */
  /* Driving the jobs                                                 */
  /* ---------------------------------------------------------------- */

  function startJob(it, liveRun, done) {
    job = { it, live: liveRun, done };
  }

  function pump() {
    const t0 = performance.now();
    let spent = 0;
    while (job) {
      const { done, value } = job.it.next();
      if (done) {
        const j = job;
        job = null;
        j.done?.(value);
        break;
      }
      spent += value;
      if (job.live && spent >= PACE) break;
      if (performance.now() - t0 > BUDGET) break;
    }
  }

  function trainLive(id) {
    pending = 0;
    run = null;
    if (id === 'gan' && !(ganCache && ganCache.key === data.key)) narrate(`The conditional GAN is learning each class's shape from ${data.train.length} real points…`, C.amber);
    startJob(strategy(id, data, { view: true, live: !reduced }), !reduced, (res) => {
      single[id] = res;
      present(res);
      show.phase = '';
      narrate(resultText(res), C.cream);
      say.say(`${label_(id)}: test accuracy ${pct(res.acc)}, minority recall ${pct(res.recall[2], 0)}.`);
      refresh();
    });
    refresh();
  }

  function select(id) {
    params.strategy = id;
    pick.set(id);
    tip.hide();
    if (run) {
      // During the ten-seed run, the choice only changes what the stage follows.
      const r = show.data === data ? single[id] : null;
      if (r) present(r);
      refresh();
      return;
    }
    trainLive(id);
  }

  function startProtocol() {
    tip.hide();
    pending = 0;
    narrate(`Running all four strategies on ${SEEDS} seeds, each with fresh training and test draws…`, C.amber);
    startJob(protocol(), false, () => {
      run = null;
      show.phase = '';
      const order = STRATS.map((t) => ({ t, m: mean(multi.res[t.id].map((r) => r.acc)), s: sd(multi.res[t.id].map((r) => r.acc)) })).sort((a, b) => b.m - a.m);
      const best = order[0];
      const last = order[order.length - 1];
      narrate(`${SEEDS} seeds: ${best.t.label} leads at ${pct(best.m)} ± ${(best.s * 100).toFixed(1)}; ${last.t.label} trails at ${pct(last.m)}.`, C.gold);
      say.say(`Ten-seed run complete. Mean test accuracy: ${STRATS.map((t) => `${t.label} ${pct(mean(multi.res[t.id].map((r) => r.acc)))}`).join(', ')}.`);
      present(single[params.strategy]);
      refresh();
    });
    refresh();
  }

  function stopProtocol() {
    job = null;
    run = null;
    narrate(multi.done ? `Stopped after ${multi.done} of ${SEEDS} seeds; the chart shows those.` : 'Stopped before the first seed finished.', INK[2]);
    show.data = data;
    if (single[params.strategy]) present(single[params.strategy]);
    else trainLive(params.strategy);
    refresh();
  }

  // A new dataset (seed or imbalance): forget every result and retrain what is selected.
  function resetData(debounce) {
    job = null;
    run = null;
    data = makeData(seed, params.ratio);
    single = {};
    multi = null;
    ganCache = null;
    show.data = data;
    setNet(null);
    present({ synth: [] });
    show.phase = '';
    narrate(`${data.n.join(' : ')} training points; the test set stays balanced at ${TEST_N} per class.`, INK[2]);
    if (debounce) pending = performance.now() + 220;
    else trainLive(params.strategy);
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* What the stage shows                                             */
  /* ---------------------------------------------------------------- */

  function setNet(net) {
    if (show.net !== net) show.netAt = performance.now();
    show.net = net;
    show.dirty = true;
  }

  // Show a (partial) result: its classifier, synthetic points and mechanism.
  function present(r) {
    if (!r) return;
    if (r.net) setNet(r.net);
    show.synth = r.synth || [];
    show.halo = r.halo || null;
    show.search = r.search || null;
    show.trace = r.gan ? r.gan.trace : null;
    show.ganStep = r.gan ? r.gan.step : 0;
    show.born = performance.now();
    if (r.acc != null) show.result = r;
    else show.result = null;
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'A small network must learn three shapes from a <strong>small, imbalanced</strong> training set: the thin arc has only a handful of points. <strong>Oversampling</strong> tops up the smaller classes before training, with <em>duplicates</em>, <em>jittered copies</em> (strength picked by a validation search) or samples from a <em>conditional GAN</em>.',
  );
  para(
    about,
    'Filled dots are real training points; rings are synthetic. Tinted regions are what the network predicts. Every strategy gets the same network and training budget, and is scored on a <strong>balanced</strong> held-out test set.',
  );
  legend(about, [
    { color: C.gold, label: 'crescent · majority' },
    { color: C.amber, label: 'cluster' },
    { color: C.ember, label: 'arc · minority' },
    { color: C.cream, label: 'synthetic sample', shape: 'ring' },
    { color: C.cream, label: 'decision boundary', shape: 'line' },
  ]);

  const controls = section(panel, 'Run the comparison');
  const buttons = actions(controls, [
    { id: 'run', label: 'Run 10 seeds ▸', primary: true, onClick: () => (run ? stopProtocol() : startProtocol()) },
    {
      id: 'gan',
      label: 'Train GAN',
      onClick: () => {
        ganCache = null;
        delete single.gan;
        select('gan');
      },
    },
    {
      id: 'reseed',
      label: 'New dataset',
      onClick: () => {
        seed = (seed * 48271 + 11) % 2147483647;
        resetData(false);
      },
    },
  ]);
  const pick = choice(controls, {
    label: 'Oversampling strategy',
    options: STRATS.map((t) => ({ value: t.id, label: t.label })),
    value: params.strategy,
    onChange: (v) => select(v),
  });
  slider(controls, {
    label: 'Imbalance (training points per class)',
    min: 1,
    max: 20,
    step: 0.5,
    value: params.ratio,
    format: (v) => counts(v).join(' : '),
    onInput: (v) => {
      params.ratio = v;
      resetData(true);
    },
  });
  toggle(controls, { label: 'Show test points (× = misclassified)', value: params.showTest, onChange: (v) => (params.showTest = v) });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'acc', label: 'Test accuracy' },
    { id: 'recall', label: 'Minority recall' },
    { id: 'synth', label: 'Synthetic added' },
    { id: 'gan', label: 'GAN step' },
    { id: 'multi', label: '10-seed mean · None / Dup / Aug / cGAN', wide: true },
  ]);
  para(results, 'Push the imbalance to 120 : 27 : 6 and compare the arc’s recall across strategies; turn on the test points to see where its misclassified points fall.', 'sim-fine');

  paper(panel, {
    lines: [
      'Co-developed augmentation search and a conditional-GAN pipeline for a 210-image microplastics dataset.',
      'Augmentation selection achieved <strong>91.5%</strong> mean classifier accuracy over 10 runs: <strong>+4 percentage points</strong> versus duplication and <strong>+5.5</strong> versus no oversampling.',
      'Co-author · Canadian AI 2024.',
    ],
    links: [{ label: 'arXiv 2404.07356', href: 'https://arxiv.org/abs/2404.07356' }],
  });
  fine(
    panel,
    'Toy 2-D shapes and tiny networks stand in for the paper’s microplastics images, and the jitter search and GAN schedule are simplified stand-ins: the simulation illustrates the pipeline and does not reproduce the paper’s images or numbers. Every number in the readout comes from this simulation.',
  );
  const say = live(panel);

  function refresh() {
    const r = single[params.strategy];
    const here = show.data === data;
    out.set('acc', r ? pct(r.acc) : '—', r ? tone(r.acc, 0.92, 0.85) : '');
    out.set('recall', r ? pct(r.recall[2], 0) : '—', r ? tone(r.recall[2], 0.85, 0.7) : '');
    const added = here && job && !run ? show.synth.length : r ? r.synth.length : null;
    out.set('synth', added == null ? '—' : fmt.int(added));
    const g = here && show.gan ? show.gan : ganCache;
    out.set('gan', g ? `${fmt.int(g.step)} / ${fmt.int(GAN.steps)}` : '—', g ? (g.step < GAN.steps ? 'warn' : 'ok') : '');
    out.set('multi', multi?.done ? STRATS.map((t) => (mean(multi.res[t.id].map((x) => x.acc)) * 100).toFixed(1)).join(' · ') : '—', multi?.done === SEEDS ? 'ok' : '');
    buttons.run.textContent = run ? 'Stop run ■' : multi?.done === SEEDS ? 'Run again ▸' : 'Run 10 seeds ▸';
    buttons.gan.disabled = !!run;
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const tip = hint(stage, 'Tap a strategy on the right to retrain it on this seed');
  let hover = -1;
  const ptr = pointer(view.canvas, {
    move: (p) => {
      hover = rowAt(p.x, p.y);
      view.canvas.style.cursor = hover >= 0 ? 'pointer' : '';
    },
    down: (p) => {
      const i = rowAt(p.x, p.y);
      if (i >= 0) select(STRATS[i].id);
    },
    leave: () => {
      hover = -1;
      view.canvas.style.cursor = '';
    },
  });

  function rowAt(x, y) {
    const rows = L.rows || [];
    return rows.findIndex((r) => x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h);
  }

  function layout(v) {
    const w = v.w;
    const h = v.h;
    L.compact = w < 620 || h < 480;
    const pad = L.compact ? 16 : Math.max(22, Math.min(40, w * 0.035));
    L.pad = pad;
    L.kick = L.compact ? 58 : 60;
    L.narr = L.kick + (L.compact ? 25 : 31);
    L.textW = w - pad * 2;
    const top = L.narr + (L.compact ? 16 : 26);
    const bottom = h - (L.compact ? 34 : 44);
    L.res = L.compact ? 44 : 56;
    L.rows = [];
    if (!L.compact) {
      const S = Math.max(160, Math.min(bottom - top, (w - pad * 2) * 0.58));
      const gap = Math.max(28, Math.min(52, w * 0.04));
      const colW = Math.min(440, w - pad * 2 - S - gap);
      const x0 = Math.max(pad, (w - (S + gap + colW)) / 2);
      L.plot = { x: x0, y: top, s: S };
      const col = { x: x0 + S + gap, y: top, w: colW, h: S };
      const rowH = clamp((S - 280) / 4, 24, 34);
      L.forest = { x: col.x, y: col.y, w: col.w, rowH, foot: true };
      const fh = 62 + rowH * 4 + 26;
      L.set = { x: col.x, y: col.y + fh + 18, w: col.w };
      const ctxTop = L.set.y + 92;
      const ch = Math.min(170, col.y + col.h - ctxTop);
      L.context = ch >= 84 ? { x: col.x, y: col.y + col.h - ch, w: col.w, h: ch } : null;
      L.side = null;
      L.narrW = x0 + S + gap + colW - x0;
      L.textX = x0;
    } else if (w >= 560) {
      const S = Math.max(150, bottom - top);
      L.plot = { x: pad, y: top, s: S };
      const cx = pad + S + 24;
      const cw = Math.min(420, w - cx - pad);
      const rowH = clamp((S - 150) / 4, 18, 26);
      L.forest = { x: cx, y: top, w: cw, rowH, foot: false };
      L.set = { x: cx, y: top + 46 + rowH * 4 + 26, w: cw };
      L.context = null;
      L.side = null;
      L.narrW = cx + cw - pad;
      L.textX = pad;
    } else {
      const forestH = 40 + 4 * 19 + 14;
      const sideW = 98;
      const S = Math.max(150, Math.min(w - pad * 2 - sideW - 12, bottom - top - forestH - 14));
      L.plot = { x: pad, y: top, s: S };
      L.side = { x: pad + S + 12, y: top, w: w - pad - (pad + S + 12), h: S };
      L.forest = { x: pad, y: top + S + 16, w: w - pad * 2, rowH: 19, foot: false };
      L.set = null;
      L.context = null;
      L.narrW = w - pad * 2;
      L.textX = pad;
    }
    // Strategy rows are hit targets (taps select a strategy).
    const f = L.forest;
    const y0 = f.y + (L.compact ? 34 : 44);
    for (let i = 0; i < STRATS.length; i++) L.rows.push({ x: f.x - 8, y: y0 + i * f.rowH, w: f.w + 16, h: f.rowH });
    tip.set(L.compact ? (L.side ? 'Tap a strategy below to retrain' : 'Tap a strategy to retrain it') : 'Tap a strategy on the right to retrain it on this seed');
    show.dirty = true;
  }

  // Data coordinates → stage pixels.
  const X = (x) => L.plot.x + ((x + VIEW) / (2 * VIEW)) * L.plot.s;
  const Y = (y) => L.plot.y + ((VIEW - y) / (2 * VIEW)) * L.plot.s;

  /* ---------------------------------------------------------------- */
  /* Decision field: a soft low-resolution image plus boundary lines   */
  /* ---------------------------------------------------------------- */

  const fieldCanvas = document.createElement('canvas');
  const fieldCtx = fieldCanvas.getContext('2d');
  const prevCanvas = document.createElement('canvas');
  const prevCtx = prevCanvas.getContext('2d');
  let field = null; // { res, img, f, segs }
  let preds = null;
  let fieldNet = null;
  let prevAt = -1;
  const RGB = CLASSES.map((k) => [1, 3, 5].map((i) => parseInt(k.color.slice(i, i + 2), 16)));

  function computeField() {
    show.dirty = false;
    const res = L.res;
    const net = show.net;
    if (net !== fieldNet && field && fieldNet && !reduced) {
      // Keep the outgoing field for a short crossfade.
      prevCanvas.width = fieldCanvas.width;
      prevCanvas.height = fieldCanvas.height;
      prevCtx.drawImage(fieldCanvas, 0, 0);
      prevAt = performance.now();
    }
    fieldNet = net;
    if (!net) {
      field = null;
      preds = null;
      return;
    }
    if (fieldCanvas.width !== res) {
      fieldCanvas.width = res;
      fieldCanvas.height = res;
    }
    const img = fieldCtx.createImageData(res, res);
    const f = new Float32Array(res * res * 3);
    for (let j = 0; j < res; j++) {
      const y = VIEW - ((j + 0.5) * 2 * VIEW) / res;
      for (let i = 0; i < res; i++) {
        const x = -VIEW + ((i + 0.5) * 2 * VIEW) / res;
        const o = logits(net, x, y);
        const m = Math.max(o[0], o[1], o[2]);
        const e0 = Math.exp(o[0] - m);
        const e1 = Math.exp(o[1] - m);
        const e2 = Math.exp(o[2] - m);
        const s = e0 + e1 + e2;
        const p = [e0 / s, e1 / s, e2 / s];
        const conf = clamp((Math.max(p[0], p[1], p[2]) - 1 / 3) * 1.5);
        const k = (j * res + i) * 4;
        for (let ch = 0; ch < 3; ch++) img.data[k + ch] = p[0] * RGB[0][ch] + p[1] * RGB[1][ch] + p[2] * RGB[2][ch];
        img.data[k + 3] = 255 * (0.035 + 0.15 * conf);
        const q = (j * res + i) * 3;
        f[q] = o[0] - Math.max(o[1], o[2]);
        f[q + 1] = o[1] - Math.max(o[0], o[2]);
        f[q + 2] = o[2] - Math.max(o[0], o[1]);
      }
    }
    fieldCtx.putImageData(img, 0, 0);
    field = { res, f, segs: contours(f, res) };
    preds = show.data.test.map((p) => {
      const o = logits(net, p.x, p.y);
      return o[1] > o[0] ? (o[2] > o[1] ? 2 : 1) : o[2] > o[0] ? 2 : 0;
    });
  }

  // Marching squares on each class's margin; the union of the zero lines is the boundary.
  const CASES = [[], [3, 0], [0, 1], [3, 1], [1, 2], [3, 2, 0, 1], [0, 2], [3, 2], [3, 2], [0, 2], [0, 3, 1, 2], [1, 2], [3, 1], [0, 1], [3, 0], []];
  function contours(f, res) {
    const segs = [];
    const at = (i, j, c) => f[(j * res + i) * 3 + c];
    for (let c = 0; c < 3; c++) {
      for (let j = 0; j < res - 1; j++) {
        for (let i = 0; i < res - 1; i++) {
          const v = [at(i, j, c), at(i + 1, j, c), at(i + 1, j + 1, c), at(i, j + 1, c)];
          const id = (v[0] >= 0) | ((v[1] >= 0) << 1) | ((v[2] >= 0) << 2) | ((v[3] >= 0) << 3);
          const e = CASES[id];
          for (let s = 0; s < e.length; s += 2) {
            for (const edge of [e[s], e[s + 1]]) {
              const a = edge;
              const b = (edge + 1) % 4;
              const t = v[a] / (v[a] - v[b]);
              const corner = [
                [i, j],
                [i + 1, j],
                [i + 1, j + 1],
                [i, j + 1],
              ];
              segs.push(corner[a][0] + (corner[b][0] - corner[a][0]) * t, corner[a][1] + (corner[b][1] - corner[a][1]) * t);
            }
          }
        }
      }
    }
    return segs;
  }

  /* ---------------------------------------------------------------- */
  /* Drawing                                                          */
  /* ---------------------------------------------------------------- */

  function drawHeader() {
    const strat = STRATS.find((t) => t.id === params.strategy);
    const kicker = `Strategy · ${strat.id === 'gan' ? 'cGAN' : strat.label.toUpperCase()}`;
    label(ctx, strat.id === 'gan' ? 'STRATEGY · cGAN' : kicker.toUpperCase(), L.textX, L.kick, { size: L.compact ? 10 : 11, track: 1.6, color: C.gold });
    let meta = '';
    if (run) meta = L.compact ? `seed ${run.k + 1}/${SEEDS}` : `seed ${run.k + 1} of ${SEEDS} · ${label_(run.id || params.strategy)}`;
    else if (job && show.phase === 'gan') meta = `GAN step ${fmt.int(show.step)} / ${fmt.int(GAN.steps)}`;
    else if (job && show.phase === 'search') meta = L.compact ? 'searching σ' : 'searching jitter strength';
    else if (job) meta = `training step ${show.step} / ${CLF.steps}`;
    else meta = L.compact ? '' : `balanced test set · ${3 * TEST_N} points`;
    if (meta) label(ctx, meta, L.textX + L.narrW, L.kick, { size: L.compact ? 10 : 11, align: 'right', color: INK[3] });
    labelFit(ctx, narration.text, L.textX, L.narr, L.narrW, { size: L.compact ? 16 : 19, minSize: L.compact ? 10.5 : 12, font: 'serif', italic: true, color: narration.tone });
  }

  function drawPlot(time) {
    const { x, y, s } = L.plot;
    const d = show.data;
    const now = performance.now();
    const rDot = L.compact ? 2.5 : 3.1;

    // Corner brackets frame the plot.
    ctx.strokeStyle = INK[4];
    ctx.lineWidth = 1;
    const k = 10;
    ctx.beginPath();
    for (const [cx, cy, dx, dy] of [
      [x, y, 1, 1],
      [x + s, y, -1, 1],
      [x, y + s, 1, -1],
      [x + s, y + s, -1, -1],
    ]) {
      ctx.moveTo(cx + dx * k, cy);
      ctx.lineTo(cx, cy);
      ctx.lineTo(cx, cy + dy * k);
    }
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.rect(x, y, s, s);
    ctx.clip();

    // Field (with a short crossfade from the previous one).
    const fadeIn = reduced ? 1 : easeOut((now - show.netAt) / 350);
    if (prevAt > 0 && !reduced) {
      const a = 1 - (now - prevAt) / 350;
      if (a > 0) {
        ctx.globalAlpha = a;
        ctx.imageSmoothingEnabled = true;
        ctx.drawImage(prevCanvas, x, y, s, s);
      } else prevAt = -1;
    }
    if (field) {
      ctx.globalAlpha = fadeIn;
      ctx.imageSmoothingEnabled = true;
      ctx.drawImage(fieldCanvas, x, y, s, s);
      const cell = s / field.res;
      ctx.beginPath();
      const g = field.segs;
      for (let i = 0; i < g.length; i += 4) {
        ctx.moveTo(x + (g[i] + 0.5) * cell, y + (g[i + 1] + 0.5) * cell);
        ctx.lineTo(x + (g[i + 2] + 0.5) * cell, y + (g[i + 3] + 0.5) * cell);
      }
      ctx.strokeStyle = alpha(C.cream, 0.42);
      ctx.lineWidth = 1;
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.globalAlpha = 1;
    }
    ctx.globalAlpha = 1;

    // Test points: + where the classifier is right, × where it is wrong.
    if (params.showTest) {
      d.test.forEach((p, i) => {
        const px = X(p.x);
        const py = Y(p.y);
        const wrong = preds && preds[i] !== p.c;
        const col = CLASSES[p.c].color;
        ctx.beginPath();
        const a = wrong ? 3.4 : 2.4;
        if (wrong) {
          ctx.moveTo(px - a, py - a);
          ctx.lineTo(px + a, py + a);
          ctx.moveTo(px + a, py - a);
          ctx.lineTo(px - a, py + a);
        } else {
          ctx.moveTo(px - a, py);
          ctx.lineTo(px + a, py);
          ctx.moveTo(px, py - a);
          ctx.lineTo(px, py + a);
        }
        ctx.strokeStyle = alpha(col, wrong ? 0.95 : 0.5);
        ctx.lineWidth = wrong ? 1.5 : 1;
        ctx.stroke();
      });
    }

    // Duplicates: a halo whose size grows with the number of copies.
    const born = reduced ? 1 : easeOut((now - show.born) / 450);
    if (show.halo) {
      for (const [p, n] of show.halo) {
        dot(ctx, X(p.x), Y(p.y), (rDot + 2 + 1.5 * Math.sqrt(n)) * (0.4 + 0.6 * born), null, alpha(CLASSES[p.c].color, 0.42 * born), 1);
      }
    } else {
      // Synthetic samples: hollow rings.
      for (const p of show.synth) dot(ctx, X(p.x), Y(p.y), rDot + 0.3, null, alpha(CLASSES[p.c].color, 0.72 * born), 1.1);
    }

    // The generator's samples, drifting into shape while the GAN trains.
    const gan = show.gan && show.data.key === show.gan.key ? show.gan : null;
    const fade = show.fade && now - show.fade.t0 < 600 ? show.fade : null;
    for (const src of [gan, fade?.gan]) {
      if (!src) continue;
      const need = needOf(d.n);
      const out = src === gan ? 1 : 1 - (now - fade.t0) / 600;
      if (src === gan && reduced && src.step < GAN.steps && src.step % 100 !== 0 && src.pos) {
        drawPreview(src.pos, need, rDot, 1);
        continue;
      }
      src.pos = previewPositions(src, need);
      drawPreview(src.pos, need, rDot, src === gan ? 1 : 0, out);
    }

    // Real training points, on top; held-out validation points are dimmed.
    for (const p of d.train) {
      const held = show.held && show.held.has(p);
      dot(ctx, X(p.x), Y(p.y), rDot, alpha(CLASSES[p.c].color, held ? 0.28 : 1), alpha(C.midnight, held ? 0.4 : 0.9), 1.2);
    }
    ctx.restore();

    // Direct labels on the open side of the shapes (identity is never colour alone).
    if (!L.compact) {
      const n = d.n;
      const tags = [
        { c: 0, at: [0.6, 0.53], text: `crescent · ${n[0]}` },
        { c: 2, at: [0.42, 0.3], text: `arc · ${n[2]}` },
        { c: 1, at: [0.6, -0.04], text: `cluster · ${n[1]}` },
      ];
      for (const t of tags) {
        const tx = X(t.at[0]);
        const ty = Y(t.at[1]);
        dot(ctx, tx, ty - 3.5, 2.6, CLASSES[t.c].color);
        label(ctx, t.text, tx + 8, ty, { size: 10.5, color: INK[2] });
      }
    }
    if (time && !reduced && show.phase === 'gan' && gan) glow(ctx, x + s - 14, y + 14, 10, C.amber, 0.35 + 0.2 * Math.sin(time * 5));
  }

  function previewPositions(src, need) {
    const pos = [];
    for (let c = 0; c < 3; c++) {
      const n = Math.max(need[c], PREVIEW);
      for (let k = 0; k < n; k++) {
        const g = generate(src.G, src.zs[c][k], c);
        pos.push(c, k, g[0], g[1]);
      }
    }
    return pos;
  }

  // Preview rings: the ones that will become synthetic points at full strength, the
  // generator's other samples faintly (they fade out when training ends).
  function drawPreview(pos, need, rDot, extra = 1, out = 1) {
    for (let i = 0; i < pos.length; i += 4) {
      const c = pos[i];
      const used = pos[i + 1] < need[c];
      const a = used ? 0.75 * out : 0.3 * extra * out;
      if (a <= 0.01) continue;
      const px = X(pos[i + 2]);
      const py = Y(pos[i + 3]);
      dot(ctx, px, py, rDot + 0.3, null, alpha(CLASSES[c].color, a), 1.1);
    }
  }

  // Strategy rows: test accuracy and minority recall, this seed (ring) and over seeds
  // (per-seed dots, mean ± sd).
  function drawForest(time) {
    const F = L.forest;
    const compact = L.compact;
    const lw = compact ? 66 : 92;
    const nw = compact ? 30 : 40;
    const gap = compact ? 10 : 16;
    const cw = (F.w - lw - nw * 2 - gap) / 2;
    const cols = [
      { x: F.x + lw, lo: 0.5, hi: 1, title: compact ? 'Accuracy %' : 'Test accuracy %', get: (r) => r.acc, dec: 1, ticks: [0.5, 0.75, 1] },
      { x: F.x + lw + cw + nw + gap, lo: 0, hi: 1, title: compact ? 'Arc recall %' : 'Minority recall %', get: (r) => r.recall[2], dec: 0, ticks: [0, 0.5, 1] },
    ];
    const px = (col, v) => col.x + clamp((v - col.lo) / (col.hi - col.lo)) * cw;
    const n = multi?.done || 0;
    label(ctx, 'Strategies', F.x, F.y + 10, { size: compact ? 9.5 : 10.5, upper: true, track: 1.6, color: C.gold });
    const meta = n ? `${n} seed${n > 1 ? 's' : ''}${n < SEEDS ? ` of ${SEEDS}` : ''}` : 'this seed';
    label(ctx, meta, F.x + F.w, F.y + 10, { size: compact ? 9.5 : 10, align: 'right', color: INK[3] });
    const headY = F.y + (compact ? 26 : 32);
    for (const col of cols) label(ctx, col.title, col.x, headY, { size: compact ? 8.5 : 9.5, upper: true, track: compact ? 0.6 : 1, color: INK[3] });
    const rows = L.rows;
    const y0 = rows[0].y;
    const y1 = rows[rows.length - 1].y + rows[rows.length - 1].h;
    // Hairline ticks shared by all rows.
    for (const col of cols) {
      for (const t of col.ticks) {
        const tx = px(col, t);
        line(ctx, tx, y0 + 3, tx, y1 - 3, INK.faint);
        const txt = String(Math.round(t * 100));
        label(ctx, txt, tx, y1 + (compact ? 10 : 12), { size: compact ? 8.5 : 9.5, align: t === col.lo ? 'left' : t === col.hi ? 'right' : 'center', color: INK[3] });
      }
    }
    // Best mean per column (only once there are several seeds).
    const means = cols.map((col) => STRATS.map((t) => (n ? mean(multi.res[t.id].map(col.get)) : null)));
    const best = means.map((m) => (n > 1 ? m.indexOf(Math.max(...m)) : -1));
    STRATS.forEach((t, i) => {
      const R = rows[i];
      const cy = R.y + R.h / 2;
      const selected = t.id === params.strategy;
      const busy = (run && run.id === t.id) || (!run && job && selected);
      if (hover === i || selected) {
        roundRect(ctx, R.x, R.y + 1, R.w, R.h - 2, 8);
        ctx.fillStyle = selected ? alpha(C.cream, 0.05) : INK.faint;
        ctx.fill();
      }
      if (selected) dot(ctx, F.x + 2, cy, 2.6, C.amber);
      label(ctx, t.label, F.x + 12, cy, { size: compact ? 11 : 12, baseline: 'middle', color: selected ? C.cream : INK[2] });
      const r = single[t.id];
      cols.forEach((col, ci) => {
        line(ctx, col.x, cy, col.x + cw, cy, INK.line);
        if (n) {
          const vals = multi.res[t.id].map(col.get);
          vals.forEach((v, k) => dot(ctx, px(col, v), cy + ((k % 3) - 1) * 2.4, compact ? 1.4 : 1.7, alpha(C.cream, 0.34)));
          if (vals.length > 1) {
            const m = means[ci][i];
            const e = sd(vals);
            const a = px(col, m - e);
            const b = px(col, m + e);
            line(ctx, a, cy, b, cy, alpha(C.cream, 0.85), 1.3);
            line(ctx, a, cy - 3.5, a, cy + 3.5, alpha(C.cream, 0.85), 1.3);
            line(ctx, b, cy - 3.5, b, cy + 3.5, alpha(C.cream, 0.85), 1.3);
          }
          dot(ctx, px(col, means[ci][i]), cy, compact ? 3 : 3.6, best[ci] === i ? C.gold : C.cream, C.midnight, 1.5);
        }
        if (r && (!run || r.key === data.key)) dot(ctx, px(col, col.get(r)), cy, compact ? 4.2 : 5, null, selected ? C.amber : alpha(C.cream, 0.6), 1.3);
        else if (busy && !reduced) glow(ctx, col.x + 6, cy, 9, C.amber, 0.35 + 0.25 * Math.sin(time * 6));
        const v = n ? means[ci][i] : r ? col.get(r) : null;
        const txt = v == null ? '—' : (v * 100).toFixed(col.dec);
        label(ctx, txt, col.x + cw + nw - 2, cy, { size: compact ? 10 : 11, align: 'right', baseline: 'middle', color: selected ? C.cream : INK[2] });
      });
    });
    if (F.foot) {
      const fy = y1 + 34;
      let fx = F.x;
      dot(ctx, fx + 5, fy - 3.5, 4.2, null, C.amber, 1.3);
      label(ctx, 'this seed', fx + 14, fy, { size: 9.5, color: INK[3] });
      fx += 14 + textWidth(ctx, 'this seed', { size: 9.5 }) + 16;
      dot(ctx, fx + 4, fy - 3.5, 3.4, C.cream, C.midnight, 1.5);
      line(ctx, fx - 4, fy - 3.5, fx + 12, fy - 3.5, alpha(C.cream, 0.85), 1.2);
      label(ctx, `mean ± sd over ${SEEDS} seeds`, fx + 18, fy, { size: 9.5, color: INK[3] });
      fx += 18 + textWidth(ctx, `mean ± sd over ${SEEDS} seeds`, { size: 9.5 }) + 16;
      dot(ctx, fx + 2, fy - 3.5, 1.7, alpha(C.cream, 0.5));
      label(ctx, 'one seed', fx + 9, fy, { size: 9.5, color: INK[3] });
    }
  }

  function synthByClass() {
    const n = [0, 0, 0];
    for (const p of show.synth) n[p.c]++;
    return n;
  }

  // Training set: real points (filled) and synthetic ones (outlined) per class.
  function drawSet() {
    const S = L.set;
    if (!S) return;
    const d = show.data;
    const add = synthByClass();
    label(ctx, 'Training set', S.x, S.y + 10, { size: 10.5, upper: true, track: 1.6, color: C.gold });
    label(ctx, 'real + synthetic', S.x + S.w, S.y + 10, { size: 10, align: 'right', color: INK[3] });
    const nameW = 80;
    const textW = 64;
    const bw = S.w - nameW - textW;
    CLASSES.forEach((k, c) => {
      const cy = S.y + 34 + c * 21;
      dot(ctx, S.x + 4, cy, 3.2, k.color);
      label(ctx, k.name, S.x + 14, cy, { size: 11, baseline: 'middle', color: INK[2] });
      const x0 = S.x + nameW;
      const wReal = (d.n[c] / POOL) * bw;
      const wAdd = (add[c] / POOL) * bw;
      roundRect(ctx, x0, cy - 4, Math.max(2, wReal), 8, 2);
      ctx.fillStyle = alpha(k.color, 0.85);
      ctx.fill();
      if (add[c] > 0) {
        roundRect(ctx, x0 + wReal + 2, cy - 3.5, Math.max(2, wAdd - 2), 7, 2);
        ctx.strokeStyle = alpha(k.color, 0.75);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      const txt = add[c] ? `${d.n[c]} +${add[c]}` : String(d.n[c]);
      label(ctx, txt, S.x + S.w, cy, { size: 11, align: 'right', baseline: 'middle', color: INK[2] });
    });
  }

  // The strategy's own mechanism: the jitter search, the GAN's discriminator, or recall by class.
  function drawContext(time) {
    const R = L.context;
    if (!R) return;
    const id = params.strategy;
    const srch = show.search;
    if (id === 'aug' && srch) return drawSearch(R, srch, time);
    if (id === 'gan' && (show.gan || show.trace)) return drawTrace(R, show.gan ? show.gan.trace : show.trace, show.gan ? show.gan.step : show.ganStep);
    drawRecall(R);
  }

  function chartBox(R, title, meta) {
    label(ctx, title, R.x, R.y + 10, { size: 10.5, upper: true, track: 1.6, color: C.gold });
    if (meta) label(ctx, meta, R.x + R.w, R.y + 10, { size: 10, align: 'right', color: INK[3] });
    return { x: R.x + 30, y: R.y + 28, w: R.w - 34, h: R.h - 28 - 22 };
  }

  function drawSearch(R, srch, time) {
    const done = srch.best >= 0;
    const B = chartBox(R, 'Jitter search', done ? `best σ = ${SIGMAS[srch.best]}` : 'validation score');
    const yOf = (v) => B.y + B.h - clamp((v - 0.5) / 0.5) * B.h;
    for (const t of [0.5, 0.75, 1]) {
      line(ctx, B.x, yOf(t), B.x + B.w, yOf(t), INK.faint);
      label(ctx, String(t * 100), B.x - 6, yOf(t), { size: 9.5, align: 'right', baseline: 'middle', color: INK[3] });
    }
    const xOf = (i) => B.x + ((i + 0.5) * B.w) / SIGMAS.length;
    ctx.beginPath();
    srch.scores.forEach((e, i) => (i ? ctx.lineTo(xOf(i), yOf(e.bal)) : ctx.moveTo(xOf(i), yOf(e.bal))));
    ctx.strokeStyle = INK[3];
    ctx.lineWidth = 1.2;
    ctx.stroke();
    SIGMAS.forEach((sg, i) => {
      const e = srch.scores[i];
      const cx = xOf(i);
      label(ctx, `.${String(Math.round(sg * 100)).padStart(2, '0')}`, cx, B.y + B.h + 16, { size: 9.5, align: 'center', color: i === srch.best ? C.cream : INK[3] });
      if (i === srch.current) {
        if (!reduced) glow(ctx, cx, yOf(e ? e.bal : 0.5), 12, C.amber, 0.35 + 0.2 * Math.sin(time * 6));
        dot(ctx, cx, e ? yOf(e.bal) : B.y + B.h, 5, null, C.amber, 1.4);
      }
      if (!e) {
        line(ctx, cx, B.y + B.h - 3, cx, B.y + B.h + 3, INK[4]);
        return;
      }
      if (i === srch.best) {
        if (!reduced) glow(ctx, cx, yOf(e.bal), 16, C.gold, 0.4);
        dot(ctx, cx, yOf(e.bal), 7.5, null, alpha(C.gold, 0.6), 1.2);
      }
      dot(ctx, cx, yOf(e.bal), i === srch.best ? 4 : 3, i === srch.best ? C.gold : C.cream, C.midnight, 1.4);
    });
    label(ctx, 'σ', B.x - 6, B.y + B.h + 16, { size: 10, align: 'right', color: INK[3] });
  }

  function drawTrace(R, trace, step) {
    const B = chartBox(R, 'cGAN · discriminator', `step ${fmt.int(step)} / ${fmt.int(GAN.steps)}`);
    const yOf = (v) => B.y + B.h - clamp(v) * B.h;
    const xOf = (i) => B.x + ((i * 10) / GAN.steps) * B.w;
    for (const t of [0, 0.5, 1]) label(ctx, t.toFixed(1), B.x - 6, yOf(t), { size: 9.5, align: 'right', baseline: 'middle', color: INK[3] });
    line(ctx, B.x, yOf(0), B.x + B.w, yOf(0), INK.faint);
    line(ctx, B.x, yOf(1), B.x + B.w, yOf(1), INK.faint);
    line(ctx, B.x, yOf(0.5), B.x + B.w, yOf(0.5), INK[4], 1, [3, 4]);
    label(ctx, 'equilibrium: cannot tell real from fake', B.x + B.w, yOf(0.5) - 6, { size: 9.5, align: 'right', color: INK[3] });
    const series = [
      { k: 0, color: C.cream, name: 'D(real)' },
      { k: 1, color: C.amber, name: 'D(fake)' },
    ];
    for (const s of series) {
      if (!trace?.length) continue;
      ctx.beginPath();
      trace.forEach((v, i) => (i ? ctx.lineTo(xOf(i), yOf(v[s.k])) : ctx.moveTo(xOf(i), yOf(v[s.k]))));
      ctx.strokeStyle = s.color;
      ctx.lineWidth = 1.5;
      ctx.lineJoin = 'round';
      ctx.stroke();
      const lx = xOf(trace.length - 1);
      const ly = yOf(trace[trace.length - 1][s.k]);
      dot(ctx, lx, ly, 2.6, s.color);
    }
    let lx = B.x;
    const ly = B.y + B.h + 16;
    for (const s of series) {
      line(ctx, lx, ly - 3.5, lx + 12, ly - 3.5, s.color, 1.5);
      label(ctx, s.name, lx + 17, ly, { size: 9.5, color: INK[2] });
      lx += 17 + textWidth(ctx, s.name, { size: 9.5 }) + 18;
    }
  }

  function drawRecall(R) {
    const r = show.result && show.result.id === params.strategy ? show.result : null;
    const B = chartBox(R, 'Recall by class', 'this seed');
    const nameW = 80;
    const bw = B.w + 34 - nameW - 48;
    CLASSES.forEach((k, c) => {
      const cy = B.y + 10 + c * Math.min(26, (B.h + 10) / 3);
      dot(ctx, R.x + 4, cy, 3.2, k.color);
      label(ctx, k.name, R.x + 14, cy, { size: 11, baseline: 'middle', color: INK[2] });
      const x0 = R.x + nameW;
      roundRect(ctx, x0, cy - 4, bw, 8, 2);
      ctx.fillStyle = INK.faint;
      ctx.fill();
      if (r) {
        roundRect(ctx, x0, cy - 4, Math.max(2, r.recall[c] * bw), 8, 2);
        ctx.fillStyle = alpha(k.color, 0.85);
        ctx.fill();
      }
      label(ctx, r ? pct(r.recall[c], 0) : '—', R.x + R.w, cy, { size: 11, align: 'right', baseline: 'middle', color: INK[2] });
    });
  }

  // Phones: a narrow column beside the plot with the training set and one key number.
  function drawSide() {
    const S = L.side;
    if (!S) return;
    const add = synthByClass();
    const d = show.data;
    label(ctx, 'Train set', S.x, S.y + 8, { size: 9.5, upper: true, track: 1.2, color: C.gold });
    CLASSES.forEach((k, c) => {
      const cy = S.y + 28 + c * 20;
      dot(ctx, S.x + 3.5, cy, 3, k.color);
      label(ctx, add[c] ? `${d.n[c]}+${add[c]}` : String(d.n[c]), S.x + 12, cy, { size: 10, baseline: 'middle', color: INK[2] });
    });
    const y = S.y + 104;
    const r = show.result && show.result.id === params.strategy ? show.result : null;
    let head = 'Arc recall';
    let big = r ? pct(r.recall[2], 0) : '—';
    if (show.phase === 'gan' && show.gan) {
      head = 'GAN step';
      big = fmt.int(show.gan.step);
    } else if (params.strategy === 'aug' && show.search?.best >= 0 && !r) {
      head = 'Best σ';
      big = String(SIGMAS[show.search.best]);
    }
    label(ctx, head, S.x, y, { size: 9.5, upper: true, track: 1.2, color: INK[3] });
    label(ctx, big, S.x, y + 30, { size: 28, font: 'serif', color: C.cream });
    if (params.strategy === 'aug' && show.search?.best >= 0 && r) label(ctx, `σ = ${SIGMAS[show.search.best]}`, S.x, y + 50, { size: 10, color: INK[3] });
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    pump();
    if (pending && performance.now() >= pending) trainLive(params.strategy);
    if (!L.plot) layout(view);
    if (show.dirty) computeField();
    view.clear();
    drawHeader();
    drawPlot(time);
    drawForest(time);
    drawSet();
    drawContext(time);
    drawSide();
    if (job) refresh();
    const d = show.data;
    const added = synthByClass().reduce((a, b) => a + b, 0);
    const runTxt = run ? ` · run ${run.k + 1}/${SEEDS}` : '';
    stat.set(
      L.compact
        ? `seed ${d.seed} · ${d.n.join('/')} · +${added}${runTxt}`
        : `seed ${d.seed} · train ${d.n.join('/')} · test ${TEST_N}/${TEST_N}/${TEST_N} · +${fmt.int(added)} synthetic${ganCache ? ` · GAN ${fmt.int(ganCache.step)} steps` : ''}${runTxt}`,
    );
  });

  narrate(`${data.n.join(' : ')} training points; the test set stays balanced at ${TEST_N} per class.`);
  trainLive('none');

  return {
    start: () => tick.start(),
    stop: () => tick.stop(),
    destroy() {
      tick.stop();
      job = null;
      ptr.destroy();
      view.destroy();
    },
  };
}
