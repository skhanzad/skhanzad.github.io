// Interventional Separation Selection: certifying that candidate causal abstractions of
// a black box agree, using a bounded set of interventions.
//
// The black box labels coloured digits 1 or 0. Twenty candidate abstractions are short
// rules over the digit d and its colour; the black box follows one of them (or, with the
// toggle off, a rule outside the set). For each base image the allowed queries are the
// image itself and every image one intervention away: do(digit = k), do(colour = c) and
// do(weight = w), optionally also two-variable pairs. A query eliminates each candidate
// that predicted the wrong label. Separation selection asks about the image that splits
// the survivors most evenly; random selection asks about any unqueried one. Agreement is
// certified once every survivor gives the same label on every allowed image.
import {
  C,
  INK,
  alpha,
  rng,
  int,
  clamp,
  lerp,
  easeOut,
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
  arrow,
  quadAt,
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

const COLOURS = [
  { name: 'red', hex: C.ember },
  { name: 'orange', hex: C.amber },
  { name: 'gold', hex: C.gold },
  { name: 'cream', hex: C.cream },
];
const WEIGHTS = ['thin', 'bold'];
const [RED, ORANGE, GOLD, CREAM] = [0, 1, 2, 3];
const warm = (c) => c === RED || c === ORANGE;
const odd = (d) => d % 2 === 1;
const prime = (d) => d === 2 || d === 3 || d === 5 || d === 7;

// The candidate abstractions. None of them reads stroke weight, a nuisance variable.
const CANDIDATES = [
  ['d ≥ 5', (d) => d >= 5],
  ['odd(d)', (d) => odd(d)],
  ['d mod 3 = 0', (d) => d % 3 === 0],
  ['prime(d)', (d) => prime(d)],
  ['d ≥ 7', (d) => d >= 7],
  ['red', (d, c) => c === RED],
  ['warm', (d, c) => warm(c)],
  ['gold', (d, c) => c === GOLD],
  ['not cream', (d, c) => c !== CREAM],
  ['odd(d) ∧ gold', (d, c) => odd(d) && c === GOLD],
  ['d ≥ 5 ∨ red', (d, c) => d >= 5 || c === RED],
  ['d ≥ 5 ∧ warm', (d, c) => d >= 5 && warm(c)],
  ['odd(d) ∨ cream', (d, c) => odd(d) || c === CREAM],
  ['d ≥ 5 xor red', (d, c) => (d >= 5) !== (c === RED)],
  ['d mod 3 = 0 ∧ warm', (d, c) => d % 3 === 0 && warm(c)],
  ['prime(d) ∨ orange', (d, c) => prime(d) || c === ORANGE],
  ['d ≥ 5 ∧ not red', (d, c) => d >= 5 && c !== RED],
  ['odd(d) ∧ warm', (d, c) => odd(d) && warm(c)],
  ['d ≥ 5 ∧ odd(d)', (d) => d >= 5 && odd(d)],
  ['d ≤ 2 ∨ gold', (d, c) => d <= 2 || c === GOLD],
].map(([text, f]) => ({ text, f: (d, c) => (f(d, c) ? 1 : 0) }));
const K = CANDIDATES.length;

// Rules outside the candidate set, used when the toggle is off.
const OUTSIDE = [
  ['d ≥ 5, flipped when bold', (d, c, w) => (d >= 5) !== (w === 1)],
  ['d ≥ 6', (d) => d >= 6],
  ['d ≥ 5 ∨ orange', (d, c) => d >= 5 || c === ORANGE],
  ['odd(d) ∧ not cream', (d, c) => odd(d) && c !== CREAM],
].map(([text, f]) => ({ text, outside: true, f: (d, c, w) => (f(d, c, w) ? 1 : 0) }));

// Phases of one query, in seconds at 1x.
const T_PICK = 0.5; // the chosen image travels to the query slot
const T_ASK = 0.55; // the black box reads it
const T_JUDGE = 0.6; // its label comes back; wrong candidates are struck out
const T_SETTLE = 0.4;
const BATCH = 100;

// Digit strokes in a unit box (y down), traced like handwriting.
const PATHS = [
  (g) => {
    g.moveTo(0.75, 0.5);
    g.ellipse(0.5, 0.5, 0.25, 0.38, 0, 0, Math.PI * 2);
  },
  (g) => {
    g.moveTo(0.38, 0.26);
    g.lineTo(0.55, 0.11);
    g.lineTo(0.55, 0.89);
  },
  (g) => {
    g.moveTo(0.26, 0.3);
    g.bezierCurveTo(0.3, 0.05, 0.76, 0.07, 0.73, 0.33);
    g.bezierCurveTo(0.7, 0.52, 0.42, 0.67, 0.25, 0.88);
    g.lineTo(0.78, 0.88);
  },
  (g) => {
    g.moveTo(0.28, 0.2);
    g.bezierCurveTo(0.44, 0.04, 0.79, 0.1, 0.72, 0.31);
    g.bezierCurveTo(0.67, 0.45, 0.52, 0.48, 0.43, 0.48);
    g.bezierCurveTo(0.62, 0.48, 0.8, 0.57, 0.75, 0.73);
    g.bezierCurveTo(0.69, 0.94, 0.36, 0.94, 0.25, 0.79);
  },
  (g) => {
    g.moveTo(0.34, 0.11);
    g.lineTo(0.27, 0.6);
    g.lineTo(0.78, 0.6);
    g.moveTo(0.64, 0.13);
    g.lineTo(0.64, 0.89);
  },
  (g) => {
    g.moveTo(0.73, 0.12);
    g.lineTo(0.36, 0.12);
    g.lineTo(0.31, 0.46);
    g.bezierCurveTo(0.5, 0.35, 0.79, 0.43, 0.76, 0.67);
    g.bezierCurveTo(0.73, 0.93, 0.36, 0.94, 0.25, 0.8);
  },
  (g) => {
    g.moveTo(0.68, 0.13);
    g.bezierCurveTo(0.42, 0.19, 0.26, 0.44, 0.27, 0.66);
    g.bezierCurveTo(0.28, 0.93, 0.72, 0.93, 0.73, 0.67);
    g.bezierCurveTo(0.74, 0.45, 0.38, 0.44, 0.28, 0.62);
  },
  (g) => {
    g.moveTo(0.25, 0.13);
    g.lineTo(0.76, 0.13);
    g.lineTo(0.42, 0.89);
  },
  (g) => {
    g.moveTo(0.69, 0.29);
    g.ellipse(0.5, 0.29, 0.19, 0.17, 0, 0, Math.PI * 2);
    g.moveTo(0.74, 0.68);
    g.ellipse(0.5, 0.68, 0.24, 0.21, 0, 0, Math.PI * 2);
  },
  (g) => {
    g.moveTo(0.7, 0.34);
    g.ellipse(0.5, 0.34, 0.2, 0.2, 0, 0, Math.PI * 2);
    g.moveTo(0.7, 0.36);
    g.bezierCurveTo(0.71, 0.6, 0.67, 0.78, 0.6, 0.89);
  },
];

// A sub-seed per (black box, image, purpose), so every run is reproducible.
const sub = (seed, n, salt) => (seed * 7919 + n * 104729 + salt * 15485863) >>> 0;

function makeImage(seed, n) {
  const r = rng(sub(seed, n, 1));
  return {
    n,
    d: int(r, 0, 9),
    c: int(r, 0, 3),
    w: r() < 0.5 ? 0 : 1,
    // Handwriting style: kept fixed under intervention, like exogenous noise.
    slant: (r() - 0.5) * 0.34,
    tilt: (r() - 0.5) * 0.14,
    squash: 0.9 + r() * 0.14,
  };
}

// The bounded set: the base image and every image one intervention away (plus pairs).
function boundedSet(b, pairs) {
  const set = [{ kind: 'base', d: b.d, c: b.c, w: b.w }];
  for (let d = 0; d < 10; d++) if (d !== b.d) set.push({ kind: 'digit', d, c: b.c, w: b.w });
  for (let c = 0; c < 4; c++) if (c !== b.c) set.push({ kind: 'colour', d: b.d, c, w: b.w });
  set.push({ kind: 'weight', d: b.d, c: b.c, w: 1 - b.w });
  if (pairs) {
    for (let d = 0; d < 10; d++) {
      for (let c = 0; c < 4; c++) if (d !== b.d && c !== b.c) set.push({ kind: 'pair', d, c, w: b.w });
    }
  }
  return set;
}

function doText(q, short = false) {
  const col = COLOURS[q.c].name;
  if (q.kind === 'base') return short ? 'base image' : 'the base image';
  if (q.kind === 'digit') return short ? `do(d=${q.d})` : `do(digit = ${q.d})`;
  if (q.kind === 'colour') return short ? `do(c=${col})` : `do(colour = ${col})`;
  if (q.kind === 'weight') return short ? `do(w=${WEIGHTS[q.w]})` : `do(weight = ${WEIGHTS[q.w]})`;
  return short ? `do(d=${q.d}, c=${col})` : `do(digit = ${q.d}, colour = ${col})`;
}

function newRun(image, truth, pairs) {
  const set = boundedSet(image, pairs);
  const at = {};
  set.forEach((q, i) => (at[`${q.d}.${q.c}.${q.w}`] = i));
  return {
    image,
    set,
    at,
    pred: set.map((q) => CANDIDATES.map((k) => k.f(q.d, q.c))),
    truth: set.map((q) => truth.f(q.d, q.c, q.w)),
    alive: new Array(K).fill(true),
    outAt: new Array(K).fill(0), // the query that eliminated each candidate
    seen: new Array(set.length).fill(-1), // the black box's label, once queried
    log: [],
    used: 0,
    status: 'open',
    wrong: 0, // allowed images where a certificate disagrees with the hidden truth
    plan: -1, // the strategy's next pick
  };
}

const aliveCount = (run) => run.alive.reduce((n, a) => n + (a ? 1 : 0), 0);

// How the survivors label allowed image i: [say 1, say 0].
function split(run, i) {
  let ones = 0;
  let zeros = 0;
  for (let k = 0; k < K; k++) if (run.alive[k]) run.pred[i][k] ? ones++ : zeros++;
  return [ones, zeros];
}

function contested(run) {
  const list = [];
  for (let i = 0; i < run.set.length; i++) {
    if (run.seen[i] >= 0) continue;
    const [a, b] = split(run, i);
    if (a && b) list.push(i);
  }
  return list;
}

// Separation selection: the contested image whose predicted labels split the survivors
// most evenly, so either answer eliminates as many as possible. Ties break at random.
function pickSeparation(run, r) {
  let best = -1;
  let ties = [];
  for (const i of contested(run)) {
    const score = Math.min(...split(run, i));
    if (score > best) {
      best = score;
      ties = [i];
    } else if (score === best) ties.push(i);
  }
  return ties.length ? ties[Math.floor(r() * ties.length)] : -1;
}

function pickRandom(run, r) {
  const open = [];
  for (let i = 0; i < run.set.length; i++) if (run.seen[i] < 0) open.push(i);
  return open.length ? open[Math.floor(r() * open.length)] : -1;
}

const picker = (strategy) => (strategy === 'separation' ? pickSeparation : pickRandom);

function settle(run, budget) {
  if (!aliveCount(run)) run.status = 'contradiction';
  else if (!contested(run).length) run.status = 'certified';
  else run.status = run.used >= budget ? 'uncertified' : 'open';
  run.wrong = 0;
  if (run.status === 'certified') {
    const k0 = run.alive.indexOf(true);
    for (let i = 0; i < run.set.length; i++) if (run.seen[i] < 0 && run.pred[i][k0] !== run.truth[i]) run.wrong++;
  }
}

// Ask the black box about allowed image i and eliminate every candidate it contradicts.
function query(run, i, budget) {
  const out = run.truth[i];
  const [ones, zeros] = split(run, i);
  const before = aliveCount(run);
  run.used++;
  run.seen[i] = out;
  const gone = [];
  for (let k = 0; k < K; k++) {
    if (run.alive[k] && run.pred[i][k] !== out) {
      run.alive[k] = false;
      run.outAt[k] = run.used;
      gone.push(k);
    }
  }
  const entry = { i, out, ones, zeros, before, gone, n: run.used };
  run.log.push(entry);
  settle(run, budget);
  return entry;
}

function certifyAll(run, strategy, budget, r) {
  settle(run, budget);
  while (run.status === 'open') query(run, picker(strategy)(run, r), budget);
  return run;
}

function stats(list) {
  const n = Math.max(1, list.length);
  let used = 0;
  let ok = 0;
  for (const x of list) {
    used += x.used;
    if (x.status === 'certified') ok++;
  }
  return { avg: used / n, certified: ok / n };
}

const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;
const cap = (s) => (s.startsWith('the ') ? `T${s.slice(1)}` : s);

export function create({ stage, panel, reduced }) {
  const params = { strategy: 'separation', speed: reduced ? 0 : 1, budget: 10, inSet: true, pairs: false };
  let seed = 7;
  let image = null;
  let run = null;
  let choose = rng(1); // the current run's seeded choices and tie-breaks
  let job = null; // the query being animated
  let certifying = false;
  let revealed = false;
  let batch = null; // { sep, rnd, done, preview }
  let mode = 'single'; // what the lower half of the stage shows: 'single' | 'batch'
  let hover = null; // { i, q } for the image under the pointer
  let now = 0;
  const struck = new Array(K).fill(null); // when each candidate's strike-out began
  let narration = { text: '', short: '', tone: INK[2] };
  const L = {};

  const truthOf = () => (params.inSet ? CANDIDATES[int(rng(sub(seed, 0, 9)), 0, K - 1)] : OUTSIDE[int(rng(sub(seed, 0, 10)), 0, OUTSIDE.length - 1)]);
  const busyBatch = () => !!(batch && !batch.done);
  const shown = () => (busyBatch() && batch.preview ? batch.preview : run);

  function narrate(text, short = text, tone = INK[2]) {
    narration = { text, short, tone };
  }

  /* ---------------------------------------------------------------- */
  /* Runs                                                             */
  /* ---------------------------------------------------------------- */

  function loadImage(n) {
    image = makeImage(seed, n);
    glyphs.clear();
    resetRun();
  }

  function resetRun() {
    run = newRun(image, truthOf(), params.pairs);
    choose = rng(sub(seed, image.n, params.strategy === 'separation' ? 2 : 3));
    settle(run, params.budget);
    plan();
    job = null;
    certifying = false;
    revealed = false;
    struck.fill(null);
    refresh();
  }

  // The strategy's next pick is fixed in advance so the stage can show it.
  function plan() {
    run.plan = run.status === 'open' ? picker(params.strategy)(run, choose) : -1;
  }

  function strike(entry, at) {
    for (const k of entry.gone) struck[k] = at;
  }

  function ask(i) {
    tip.hide();
    mode = 'single';
    const [ones, zeros] = split(run, i);
    const prev = run.status;
    if (params.speed === 0) {
      const entry = query(run, i, params.budget);
      strike(entry, reduced ? now - 1 : now);
      plan();
      narrateEnd(entry, prev);
      if (run.status !== prev) finish();
      refresh();
      return;
    }
    job = { i, t: 0, entry: null, ones, zeros, before: aliveCount(run), prev };
    narrateStart(job);
    refresh();
  }

  function advanceJob(dt, time) {
    job.t += dt * (params.speed || 8);
    if (!job.entry && job.t >= T_PICK + T_ASK) {
      job.entry = query(run, job.i, params.budget);
      job.judgeAt = time;
      strike(job.entry, time);
      plan();
      narrateEnd(job.entry, job.prev);
      refresh();
    }
    if (job.t >= T_PICK + T_ASK + T_JUDGE + T_SETTLE) {
      const prev = job.prev;
      job = null;
      if (run.status !== prev) finish();
      refresh();
    }
  }

  function certify() {
    if (busyBatch() || certifying) return;
    if (run.status !== 'open') loadImage(image.n + 1);
    mode = 'single';
    tip.hide();
    if (params.speed === 0) {
      instantRest();
    } else {
      certifying = true;
    }
    refresh();
  }

  // Finish the current run at once; struck cards flip in query order unless motion is reduced.
  function instantRest() {
    const prev = run.status;
    while (run.status === 'open') {
      const entry = query(run, run.plan, params.budget);
      strike(entry, reduced ? now - 1 : now + (entry.n - 1) * 0.12);
      plan();
    }
    certifying = false;
    if (run.status !== prev) finish();
  }

  function step() {
    if (busyBatch() || certifying || job) return;
    if (run.status !== 'open') {
      narrate('This run is over. Tap an agreed image to spot-check it, or load a new image.', 'Run over: tap an image to spot-check it.');
      return;
    }
    ask(run.plan);
  }

  function manual(i, q) {
    if (busyBatch() || certifying || job) return;
    if (i < 0) {
      narrate(`${doText({ ...q, kind: 'pair' })} changes two variables at once: outside the bounded set.`, 'Two variables at once: outside the bounded set.');
      return;
    }
    const name = doText(run.set[i]);
    if (run.seen[i] >= 0) {
      narrate(`Already asked: the black box labelled ${name} ${run.seen[i]}.`, `Already asked: label ${run.seen[i]}.`);
      return;
    }
    if (run.status === 'contradiction') {
      narrate('No candidate is left to test: the candidate set itself is refuted.', 'No candidate left to test.', C.ember);
      return;
    }
    if (run.used >= params.budget) {
      narrate(`The budget of ${plural(params.budget, 'query', 'queries')} is spent. Raise it to keep going.`, 'The query budget is spent.', C.amber);
      return;
    }
    ask(i);
  }

  function newImage() {
    if (busyBatch()) return;
    mode = 'single';
    loadImage(image.n + 1);
    const img = image;
    narrate(
      `Image #${img.n}: a ${COLOURS[img.c].name} ${img.d} in ${WEIGHTS[img.w]} strokes. All ${K} candidates are back in play.`,
      `A ${COLOURS[img.c].name} ${img.d}: all ${K} candidates back in play.`,
    );
  }

  function reseed() {
    if (busyBatch()) return;
    seed = (seed * 48271 + 11) % 2147483647;
    batch = null;
    mode = 'single';
    loadImage(1);
    narrate(
      params.inSet ? `A new black box. Its rule is one of the ${K} candidates; which one stays hidden.` : 'A new black box. Its rule is hidden outside the candidate set.',
      params.inSet ? 'A new black box, its rule among the candidates.' : 'A new black box, its rule outside the set.',
    );
  }

  function finish() {
    certifying = false;
    revealed = true;
    const n = aliveCount(run);
    const all = run.set.length;
    const t = truthOf();
    if (run.status === 'certified') {
      const survivors = run.alive.map((a, k) => (a ? CANDIDATES[k].text : null)).filter(Boolean);
      if (t.outside && run.wrong) {
        narrate(
          `Certified after ${plural(run.used, 'intervention')}, but the true rule is not a candidate: the certificate is wrong on ${run.wrong} of ${all} allowed images.`,
          `Certified, yet wrong on ${run.wrong} of ${all}: the truth was not a candidate.`,
          C.ember,
        );
      } else if (n === 1) {
        narrate(`Only ${survivors[0]} survives: agreement certified after ${plural(run.used, 'intervention')}.`, `Only ${survivors[0]} survives: certified after ${run.used}.`, C.gold);
      } else {
        const who = n === 2 ? 'Both survivors' : `All ${n} survivors`;
        narrate(
          `${who} agree on every allowed intervention: agreement certified after ${plural(run.used, 'intervention')}.`,
          `${who} agree on all ${all}: certified after ${run.used}.`,
          C.gold,
        );
      }
      const agree = n === 1 ? 'one candidate survives and fixes the label of' : `${n} surviving candidates agree on`;
      say.say(`Image ${run.image.n} certified after ${plural(run.used, 'intervention')}: ${agree} all ${all} allowed images.${t.outside && run.wrong ? ` The true rule was outside the candidate set, so the certificate is wrong on ${run.wrong} of them.` : ''}`);
    } else if (run.status === 'contradiction') {
      say.say(`Contradiction after ${plural(run.used, 'intervention')}: no candidate survives, so the true rule is not in the candidate set.`);
    } else if (run.status === 'uncertified') {
      const open = contested(run).length;
      narrate(
        `Budget spent after ${plural(run.used, 'intervention')}: ${plural(open, 'allowed image')} still split the survivors. Uncertified.`,
        `Budget spent: ${plural(open, 'image')} still split the survivors.`,
        C.amber,
      );
      say.say(`Uncertified: the budget of ${plural(params.budget, 'query', 'queries')} ran out with ${plural(n, 'candidate')} still disagreeing on ${plural(open, 'allowed image')}.`);
    }
    refresh();
  }

  function narrateStart(j) {
    const name = doText(run.set[j.i]);
    const sh = doText(run.set[j.i], true);
    const n = j.before;
    if (j.ones && j.zeros) {
      narrate(`${cap(name)} splits the ${n} survivors ${j.ones} / ${j.zeros}. Asking the black box…`, `${sh} splits ${n} survivors ${j.ones} / ${j.zeros}…`, C.amber);
    } else {
      const v = j.ones ? 1 : 0;
      const who = n === 1 ? 'The one survivor predicts' : `All ${n} survivors predict`;
      narrate(`${who} ${v} for ${name}. Asking anyway…`, `${sh}: survivors already agree…`, C.amber);
    }
  }

  function narrateEnd(e, prev) {
    const name = doText(run.set[e.i]);
    const sh = doText(run.set[e.i], true);
    const g = e.gone.length;
    if (run.status === 'contradiction') {
      const who = e.before === 1 ? 'the one survivor' : `all ${e.before} survivors`;
      narrate(
        `The black box said ${e.out} where ${who} predicted ${1 - e.out}: no candidate survives. Contradiction.`,
        `Said ${e.out}, against all survivors: contradiction.`,
        C.ember,
      );
    } else if (e.ones && e.zeros) {
      const half = g * 2 === e.before ? 'half eliminated' : `${g} eliminated`;
      narrate(`${cap(name)} split the ${e.before} survivors ${e.ones} / ${e.zeros} — the black box said ${e.out}: ${half}.`, `${sh} → ${e.out}: ${g} of ${e.before} eliminated.`, C.cream);
    } else if (prev === 'certified') {
      narrate(`Spot check: the black box said ${e.out} for ${name}, as every survivor predicted. The certificate stands.`, `Spot check passed: ${sh} → ${e.out}.`, C.gold);
    } else {
      narrate(`The black box said ${e.out} for ${name}, as every survivor predicted: nobody eliminated, a wasted query.`, `${sh} → ${e.out}: nobody eliminated.`, INK[2]);
    }
  }

  /* ---------------------------------------------------------------- */
  /* Batch                                                            */
  /* ---------------------------------------------------------------- */

  const newBatch = () => ({ sep: [], rnd: [], done: false, preview: null });

  function startBatch() {
    if (busyBatch()) return;
    job = null;
    certifying = false;
    mode = 'batch';
    tip.hide();
    batch = newBatch();
    narrate(`Certifying ${BATCH} images with each strategy, on the same images and budget…`, `Certifying ${BATCH} images per strategy…`, C.amber);
    refresh();
  }

  // Both strategies certify the same images; chunked so the page stays responsive.
  function advanceBatch() {
    const t0 = performance.now();
    const cap = reduced ? BATCH : 3;
    const truth = truthOf();
    let done = 0;
    while (batch.sep.length < BATCH && done < cap && performance.now() - t0 < 7) {
      const img = makeImage(seed, batch.sep.length + 1);
      const a = certifyAll(newRun(img, truth, params.pairs), 'separation', params.budget, rng(sub(seed, img.n, 2)));
      const b = certifyAll(newRun(img, truth, params.pairs), 'random', params.budget, rng(sub(seed, img.n, 3)));
      batch.sep.push({ used: a.used, status: a.status, wrong: a.wrong });
      batch.rnd.push({ used: b.used, status: b.status, wrong: b.wrong });
      batch.preview = a;
      done++;
    }
    if (batch.sep.length >= BATCH) {
      batch.done = true;
      const s = stats(batch.sep);
      const r = stats(batch.rnd);
      narrate(
        `${BATCH} images: separation needed ${s.avg.toFixed(1)} interventions per image on average, random ${r.avg.toFixed(1)}.`,
        `Separation ${s.avg.toFixed(1)} vs random ${r.avg.toFixed(1)} per image.`,
        C.cream,
      );
      say.say(
        `Batch complete. Over ${BATCH} images, separation selection averaged ${s.avg.toFixed(1)} interventions per image and certified ${Math.round(s.certified * 100)}%; random selection averaged ${r.avg.toFixed(1)} and certified ${Math.round(r.certified * 100)}%.`,
      );
    }
    refresh();
  }

  // Settings changed: restart a running batch, drop a finished one.
  function invalidateBatch() {
    if (!batch) return;
    if (!batch.done) batch = newBatch();
    else {
      batch = null;
      if (mode === 'batch') mode = 'single';
    }
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'A black box labels coloured digits <strong>1</strong> or <strong>0</strong>. Twenty <strong>candidate abstractions</strong>, short rules over the digit <em>d</em> and its colour, each claim to explain it. An <em>intervention</em> redraws the image with one variable set, such as do(colour = gold), and asks again; candidates that predicted the wrong label are eliminated.',
  );
  para(
    about,
    'The grid is the <strong>bounded set</strong>: every image one intervention from the base. Separation selection asks about the image that splits the survivors most evenly. When all survivors agree on every image in the set, agreement is <strong>certified</strong>, provided the true rule was a candidate.',
  );
  legend(about, [
    { color: C.gold, label: 'survivors agree / certified' },
    { color: C.ember, label: 'eliminated / contradiction' },
    { color: C.amber, label: 'query in flight / budget spent' },
    { color: C.cream, shape: 'ring', label: 'image already asked' },
  ]);

  const controls = section(panel, 'Certify an image');
  const buttons = actions(controls, [
    { id: 'run', label: 'Certify ▸', primary: true, onClick: () => certify() },
    { id: 'step', label: 'Step', onClick: () => step() },
    { id: 'next', label: 'New image', onClick: () => newImage() },
  ]);
  choice(controls, {
    label: 'Selection strategy',
    options: [
      { value: 'separation', label: 'Separation' },
      { value: 'random', label: 'Random' },
    ],
    value: params.strategy,
    onChange: (v) => {
      params.strategy = v;
      resetRun();
      if (busyBatch()) return;
      narrate(
        v === 'separation' ? 'Same image, fresh run: each query now splits the survivors as evenly as possible.' : 'Same image, fresh run: each query is now any allowed image not yet asked.',
        v === 'separation' ? 'Fresh run with separation selection.' : 'Fresh run with random selection.',
      );
    },
  });
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 1, label: 'Watch' },
      { value: 3, label: 'Brisk' },
      { value: 0, label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });
  slider(controls, {
    label: 'Query budget per image',
    min: 2,
    max: 20,
    step: 1,
    value: params.budget,
    format: (v) => plural(v, 'query', 'queries'),
    onInput: (v) => {
      params.budget = v;
      invalidateBatch();
      if (job) return;
      const prev = run.status;
      settle(run, v);
      plan();
      if (run.status !== prev && run.status !== 'open') finish();
      refresh();
    },
  });

  const bounds = section(panel, 'Assumptions and batch');
  const more = actions(bounds, [
    { id: 'batch', label: `Run ${BATCH} images`, onClick: () => startBatch() },
    { id: 'reseed', label: 'New black box', onClick: () => reseed() },
  ]);
  toggle(bounds, {
    label: 'True abstraction is in the candidate set',
    value: params.inSet,
    onChange: (v) => {
      params.inSet = v;
      invalidateBatch();
      resetRun();
      narrate(
        v ? `Same image, fresh run: the black box's rule is again one of the ${K} candidates.` : 'Same image, fresh run: the black box now follows a rule outside the candidate set.',
        v ? 'Fresh run: the true rule is a candidate.' : 'Fresh run: the true rule is outside the set.',
      );
    },
  });
  toggle(bounds, {
    label: 'Allow two-variable interventions',
    value: params.pairs,
    onChange: (v) => {
      params.pairs = v;
      invalidateBatch();
      resetRun();
      narrate(
        v ? `Same image, fresh run: the bounded set grows to ${run.set.length} images, pairs included.` : `Same image, fresh run: back to ${run.set.length} single-variable images.`,
        v ? `Fresh run: ${run.set.length} allowed images.` : `Fresh run: ${run.set.length} allowed images.`,
      );
    },
  });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'used', label: 'Interventions used' },
    { id: 'left', label: 'Candidates left' },
    { id: 'status', label: 'Status', wide: true },
    { id: 'bsep', label: 'Batch avg · separation' },
    { id: 'brnd', label: 'Batch avg · random' },
  ]);
  para(
    results,
    'Switch off “True abstraction is in the candidate set”: separation still certifies, and the reveal shows where that certificate is wrong. Random selection’s wasted queries sometimes expose a contradiction instead.',
    'sim-fine',
  );

  paper(panel, {
    lines: [
      'Co-authored a method for certifying agreement across candidate causal models under bounded interventions.',
      'On a colored-MNIST causal-abstraction task, required <strong>13.6 interventions per image</strong> on average, with guarantees conditional on the true abstraction belonging to the candidate set.',
      'First author · Preprint 2026.',
    ],
    links: [{ label: 'arXiv 2609.32247', href: 'https://arxiv.org/abs/2609.32247' }],
  });
  fine(
    panel,
    'A simplified stand-in for the paper’s task: twenty readable rules play the candidate abstractions, digits are drawn procedurally, and separation is a plain greedy even-split rule. The numbers in the readout come from this simulation, not from the paper.',
  );
  const say = live(panel);

  function setText(b, text) {
    if (b.textContent !== text) b.textContent = text;
  }

  function refresh() {
    if (!run) return;
    const n = aliveCount(run);
    const busy = busyBatch();
    out.set('used', `${run.used} / ${params.budget}`, run.status === 'uncertified' ? 'warn' : '');
    out.set('left', `${n} / ${K}`, n === 0 ? 'bad' : run.status === 'certified' ? 'ok' : '');
    let st = [run.used ? 'open' : 'ready', ''];
    if (certifying) st = ['certifying…', 'warn'];
    else if (run.status === 'certified') st = revealed && run.wrong ? [`certified · wrong on ${run.wrong}`, 'bad'] : ['certified', 'ok'];
    else if (run.status === 'contradiction') st = ['contradiction', 'bad'];
    else if (run.status === 'uncertified') st = ['uncertified', 'warn'];
    out.set('status', st[0], st[1]);
    const partial = busy ? '…' : '';
    out.set('bsep', batch?.sep.length ? `${stats(batch.sep).avg.toFixed(1)}${partial}` : '—');
    out.set('brnd', batch?.rnd.length ? `${stats(batch.rnd).avg.toFixed(1)}${partial}` : '—');
    setText(buttons.run, certifying ? 'Certifying…' : run.status === 'open' ? 'Certify ▸' : 'Next image ▸');
    buttons.run.disabled = certifying || busy;
    buttons.step.disabled = certifying || busy || run.status !== 'open';
    buttons.next.disabled = busy;
    setText(more.batch, busy ? `Running… ${batch.sep.length}%` : `Run ${BATCH} images`);
    more.batch.disabled = busy;
    more.reseed.disabled = busy;
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const tip = hint(stage, `${window.matchMedia?.('(pointer: coarse)').matches ? 'Tap' : 'Click'} an image in the grid to query it`);
  const ptr = pointer(view.canvas, {
    move: (p) => {
      hover = cellAt(p.x, p.y);
      view.canvas.style.cursor = hover && !busyBatch() ? 'pointer' : '';
    },
    down: (p) => {
      const h = cellAt(p.x, p.y);
      if (h) manual(h.i, h.q);
    },
    leave: () => {
      hover = null;
      view.canvas.style.cursor = '';
    },
  });

  // MNIST-like bitmaps: each digit is stroked into a 28×28 image in its colour.
  const glyphs = new Map();
  function glyph(q, style) {
    const key = `${style.n}.${q.d}.${q.c}.${q.w}`;
    let g = glyphs.get(key);
    if (!g) {
      if (glyphs.size > 240) glyphs.clear();
      g = document.createElement('canvas');
      g.width = g.height = 28;
      const x = g.getContext('2d');
      x.translate(14, 14);
      x.rotate(style.tilt);
      x.transform(1, 0, -style.slant, 1, 0, 0);
      x.scale(20 * style.squash, 20);
      x.translate(-0.5, -0.5);
      x.lineCap = 'round';
      x.lineJoin = 'round';
      x.lineWidth = q.w ? 0.17 : 0.1;
      x.strokeStyle = COLOURS[q.c].hex;
      x.beginPath();
      PATHS[q.d](x);
      x.stroke();
      glyphs.set(key, g);
    }
    return g;
  }

  function layout(v) {
    const { w, h } = v;
    const compact = (L.compact = w < 620 || h < 480);
    const pad = Math.max(16, Math.min(40, w * 0.04));
    const cw = w - pad * 2;
    L.head = { x: pad, y: compact ? 56 : 60, w: cw };
    const top = L.head.y + (compact ? 42 : 58);
    if (!compact) {
      // Upper band: bench and query log on the left, the bounded set on the right.
      const colL = cw * 0.42;
      const gap = Math.max(24, cw * 0.035);
      const mx = pad + colL + gap;
      const mw = w - pad - mx;
      const lw = 58;
      const s = Math.round(clamp(Math.min(colL * 0.22, (h - top) * 0.2), 56, 112));
      const cell = Math.floor(clamp(Math.min((mw - lw - 14) / 11, (h - top) * 0.075), 24, 46));
      const logRows = h < 600 ? 3 : h < 700 ? 4 : 5;
      const bandH = Math.max(56 + 4 * cell, 64 + s + 20 + logRows * 17);
      const A = clamp(colL * 0.075, 24, 40);
      L.base = { x: pad, y: top + 14, s };
      L.query = { x: pad + s + A, y: top + 14, s };
      const bw = clamp(s * 0.64, 44, 72);
      const bh = s * 0.62;
      L.box = { x: L.query.x + s + A * 0.8, y: top + 14 + (s - bh) / 2, w: bw, h: bh };
      L.out = { x: L.box.x + bw + A * 0.8, y: top + 14 + s / 2 };
      const logY = top + 14 + s + 50;
      L.log = { x: pad, y: logY, w: colL, h: top + bandH - logY };
      L.mat = { x: mx, y: top, w: mw, lw, cw: cell, ch: cell, gx: mx + lw, gy: top + 30, wx: mx + lw + cell * 10 + 14 };
      // Lower band: the candidates (or the batch chart), five rows of cards.
      const lowY = top + bandH + 26;
      const cardsH = Math.min(h - 40 - (lowY + 16), 5 * 58 + 4 * 8);
      L.cards = { x: pad, title: lowY, y: lowY + 16, w: cw, h: cardsH, cols: 4, rows: 5 };
    } else {
      // Stacked: bench, bounded set, then the candidates as a dense list.
      const s = Math.round(clamp(Math.min(h * 0.095, cw * 0.14), 40, 72));
      const A = 18;
      L.base = { x: pad, y: top, s };
      L.query = { x: pad + s + A, y: top, s };
      const bw = 40;
      const bh = s * 0.66;
      L.box = { x: L.query.x + s + 14, y: top + (s - bh) / 2, w: bw, h: bh };
      L.out = { x: L.box.x + bw + 14, y: top + s / 2 };
      L.log = null;
      const my = top + s + 22;
      const lw = 44;
      const cellW = (cw - lw - 8) / 11;
      const ch = clamp(h * 0.041, 15, 30);
      L.mat = { x: pad, y: my, w: cw, lw, cw: cellW, ch, gx: pad + lw, gy: my + 8, wx: pad + lw + cellW * 10 + 8 };
      const listY = my + 8 + ch * 4 + 22;
      L.cards = { x: pad, title: listY, y: listY + 10, w: cw, h: Math.min(h - 30 - (listY + 10), 10 * 26), cols: 2, rows: 10 };
    }
  }

  function lastIndex(R) {
    return R.log.length ? R.log[R.log.length - 1].i : -1;
  }

  function currentIndex(R) {
    return R === run && job ? job.i : lastIndex(R);
  }

  function cellRect(d, c) {
    const M = L.mat;
    return { x: M.gx + d * M.cw, y: M.gy + c * M.ch, w: M.cw, h: M.ch };
  }

  function weightRect(R) {
    const M = L.mat;
    return { x: M.wx, y: M.gy + R.image.c * M.ch, w: M.cw, h: M.ch };
  }

  function rectOf(R, i) {
    const q = R.set[i];
    return q.kind === 'weight' ? weightRect(R) : cellRect(q.d, q.c);
  }

  const inside = (x, y, r) => x >= r.x && x < r.x + r.w && y >= r.y && y < r.y + r.h;

  // The image under the pointer: its index in the bounded set (or -1 outside it).
  function cellAt(x, y) {
    if (!L.mat || !run || busyBatch()) return null;
    const img = run.image;
    const wr = weightRect(run);
    if (inside(x, y, wr)) {
      const q = { d: img.d, c: img.c, w: 1 - img.w };
      return { i: run.at[`${q.d}.${q.c}.${q.w}`], q };
    }
    for (let c = 0; c < 4; c++) {
      for (let d = 0; d < 10; d++) {
        if (!inside(x, y, cellRect(d, c))) continue;
        const q = { d, c, w: img.w };
        const i = run.at[`${d}.${c}.${img.w}`];
        return { i: i ?? -1, q };
      }
    }
    return null;
  }

  function tile(x, y, s, q, style, o = {}) {
    const r = Math.min(10, s * 0.14);
    roundRect(ctx, x, y, s, s, r);
    ctx.fillStyle = alpha(C.midnight, 0.92);
    ctx.fill();
    if (q) {
      ctx.save();
      ctx.globalAlpha = o.alpha ?? 1;
      // Big tiles show the 28×28 pixels crisply; small ones are smoothed.
      const inner = Math.floor(s / 24) * 24;
      if (inner >= 48) {
        ctx.imageSmoothingEnabled = false;
        const off = (s - inner) / 2;
        ctx.drawImage(glyph(q, style), 2, 2, 24, 24, x + off, y + off, inner, inner);
      } else {
        ctx.drawImage(glyph(q, style), x, y, s, s);
      }
      ctx.restore();
    }
    roundRect(ctx, x, y, s, s, r);
    ctx.strokeStyle = o.stroke || INK.line;
    ctx.lineWidth = o.lw || 1;
    ctx.stroke();
  }

  function drawHeader() {
    const H = L.head;
    const R = shown();
    label(ctx, `Image #${String(R.image.n).padStart(2, '0')}`, H.x, H.y, { size: 11, upper: true, track: 1.6, color: C.gold });
    const t = truthOf();
    let text = busyBatch() ? `batch · ${batch.sep.length} / ${BATCH}` : 'true rule hidden';
    let color = INK[3];
    if (revealed && R === run) {
      text = t.outside ? `true rule (not a candidate): ${t.text}` : `true rule: ${t.text}`;
      color = t.outside ? C.ember : C.gold;
    }
    labelFit(ctx, text, H.x + H.w, H.y, H.w - 110, { size: 11, minSize: 8.5, align: 'right', color });
    const n = narration;
    labelFit(ctx, L.compact ? n.short : n.text, H.x, H.y + (L.compact ? 30 : 34), H.w, { size: L.compact ? 16 : 19, minSize: 11, font: 'serif', italic: true, color: n.tone });
  }

  function drawBench(time) {
    const R = shown();
    const img = R.image;
    const { base: B, query: Q, box: X, out: O } = L;
    const s = B.s;
    const cy = B.y + s / 2;
    const cur = currentIndex(R);
    const q = cur >= 0 ? R.set[cur] : null;
    const pending = R === run && job && !job.entry;
    const tj = job ? job.t : 0;
    const asking = pending && tj >= T_PICK;
    const last = R.log[R.log.length - 1];

    if (!L.compact) {
      const o = { size: 10, upper: true, track: 1.2, color: INK[3] };
      label(ctx, 'base image', B.x, B.y - 9, o);
      label(ctx, 'query', Q.x, B.y - 9, o);
      label(ctx, 'black box', X.x + X.w / 2, B.y - 9, { ...o, align: 'center' });
      label(ctx, 'label', O.x, B.y - 9, o);
    }

    tile(B.x, B.y, s, img, img, { stroke: alpha(C.cream, 0.3) });
    const about = `${img.d} · ${COLOURS[img.c].name} · ${WEIGHTS[img.w]}`;
    if (!L.compact) label(ctx, about, B.x, B.y + s + 17, { size: 10.5, color: INK[3] });
    arrow(ctx, B.x + s + 5, cy, Q.x - 5, cy, INK[4], 1.2, 5);

    if (q) {
      tile(Q.x, Q.y, s, q, img, { alpha: pending ? easeOut(tj / T_PICK) : 1, stroke: pending ? C.amber : alpha(C.cream, 0.3), lw: pending ? 1.4 : 1 });
    } else {
      roundRect(ctx, Q.x, Q.y, s, s, Math.min(10, s * 0.14));
      ctx.setLineDash([3, 4]);
      ctx.strokeStyle = INK[4];
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.setLineDash([]);
      label(ctx, '?', Q.x + s / 2, cy + 1, { font: 'serif', size: s * 0.4, align: 'center', baseline: 'middle', color: INK[4] });
    }
    if (!L.compact) {
      const text = q ? doText(q) : 'no query yet';
      labelFit(ctx, text, Q.x, Q.y + s + 17, X.x + X.w - Q.x, { size: 10.5, minSize: 9, color: pending ? C.amber : q ? INK[2] : INK[4] });
    }
    arrow(ctx, Q.x + s + 5, cy, X.x - 5, cy, INK[4], 1.2, 5);

    // The black box: a small lattice of units that lights up while it reads the image.
    roundRect(ctx, X.x, X.y, X.w, X.h, 8);
    ctx.fillStyle = alpha(C.midnight, 0.96);
    ctx.fill();
    ctx.strokeStyle = asking ? C.amber : INK[4];
    ctx.lineWidth = asking ? 1.4 : 1.1;
    ctx.stroke();
    for (let col = 0; col < 3; col++) {
      for (let row = 0; row < 3; row++) {
        const ux = X.x + X.w * (0.28 + col * 0.22);
        const uy = X.y + X.h * (0.28 + row * 0.22);
        let a = 0;
        if (asking) a = reduced ? 1 : clamp(Math.sin(((tj - T_PICK) / T_ASK) * Math.PI * 2.2 - col * 1.1) * 0.5 + 0.5);
        dot(ctx, ux, uy, 1.7, a > 0.05 ? alpha(C.amber, 0.25 + 0.75 * a) : INK[4]);
      }
    }
    arrow(ctx, X.x + X.w + 5, cy, O.x - 5, cy, INK[4], 1.2, 5);

    const value = pending ? '?' : last ? String(last.out) : '–';
    if (!reduced && R === run && job?.entry && time - job.judgeAt < 0.9) {
      glow(ctx, O.x + s * 0.13, cy, s * 0.5, C.cream, 0.32 * (1 - (time - job.judgeAt) / 0.9));
    }
    label(ctx, value, O.x, cy + 2, { font: 'serif', size: Math.round(s * 0.56), baseline: 'middle', color: pending || !last ? INK[4] : C.cream });

    // Compact: the base image's values and the latest query, beside the output.
    if (L.compact) {
      const sx = O.x + Math.round(s * 0.4) + 10;
      const w = L.head.x + L.head.w - sx;
      labelFit(ctx, `base ${about}`, sx, cy - 12, w, { size: 9.5, minSize: 8, color: INK[3] });
      labelFit(ctx, q ? doText(q, true) : 'no query yet', sx, cy + 2, w, { size: 10, minSize: 8, color: pending ? C.amber : q ? INK[2] : INK[4] });
      let note = `${R.set.length} allowed images`;
      if (pending) note = `split ${job.ones} / ${job.zeros}`;
      else if (last) note = last.gone.length ? `${last.gone.length} eliminated` : 'nobody eliminated';
      labelFit(ctx, note, sx, cy + 16, w, { size: 9.5, minSize: 8, color: INK[3] });
    }

    // Travelling pulses: the chosen image to the query slot, then into the black box.
    if (pending && !reduced) {
      if (tj < T_PICK && job.i >= 0) {
        const r = rectOf(run, job.i);
        const x1 = r.x + r.w / 2;
        const y1 = r.y + r.h / 2;
        const x2 = Q.x + s / 2;
        const y2 = Q.y + s / 2;
        const lift = L.compact ? 0 : -Math.max(40, Math.abs(x1 - x2) * 0.18);
        const [px, py] = quadAt(x1, y1, (x1 + x2) / 2, Math.min(y1, y2) + lift, x2, y2, easeOut(tj / T_PICK));
        glow(ctx, px, py, 16, C.amber, 0.85);
        dot(ctx, px, py, 2.4, C.cream);
      } else {
        const p = easeOut((tj - T_PICK) / (T_ASK * 0.6));
        if (p < 1) {
          const px = lerp(Q.x + s, X.x, p);
          glow(ctx, px, cy, 14, C.amber, 0.85);
          dot(ctx, px, cy, 2.3, C.cream);
        }
      }
    }
  }

  function drawLog() {
    const G = L.log;
    const rowH = 17;
    const rows = Math.max(1, Math.floor((G.h - 14) / rowH));
    const x2 = G.x + G.w;
    label(ctx, `Queries · ${run.used} of ${params.budget}`, G.x, G.y, { size: 10, upper: true, track: 1.4, color: C.gold });
    const head = { size: 9.5, align: 'right', color: INK[4] };
    label(ctx, 'split', x2 - 100, G.y, head);
    label(ctx, 'label', x2 - 54, G.y, head);
    label(ctx, 'removed', x2, G.y, head);
    const entries = run.log.map((e) => ({ ...e, pending: false }));
    if (job && !job.entry) entries.push({ i: job.i, n: run.used + 1, ones: job.ones, zeros: job.zeros, pending: true });
    if (!entries.length) {
      label(ctx, 'No queries yet.', G.x, G.y + 20, { size: 10.5, color: INK[4] });
      return;
    }
    const shownRows = entries.slice(-rows);
    const hidden = entries.length - shownRows.length;
    shownRows.forEach((e, j) => {
      const y = G.y + 20 + j * rowH;
      const tone = e.pending ? C.amber : INK[2];
      label(ctx, `${hidden && j === 0 ? '…' : '#'}${e.n}`, G.x, y, { size: 10.5, color: INK[4] });
      labelFit(ctx, doText(run.set[e.i]).replace(/^the /, ''), G.x + 34, y, G.w - 34 - 150, { size: 10.5, minSize: 8.5, color: tone });
      label(ctx, `${e.ones} / ${e.zeros}`, x2 - 100, y, { size: 10.5, align: 'right', color: INK[3] });
      label(ctx, e.pending ? '→ ?' : `→ ${e.out}`, x2 - 54, y, { size: 10.5, align: 'right', color: e.pending ? C.amber : C.cream });
      const g = e.pending ? '' : e.gone.length ? `−${e.gone.length}` : '±0';
      label(ctx, g, x2, y, { size: 10.5, align: 'right', color: e.pending ? INK[4] : e.gone.length ? C.ember : INK[4] });
    });
  }

  function drawMatrix(time) {
    const M = L.mat;
    const R = shown();
    const img = R.image;
    const cur = currentIndex(R);
    const pending = R === run && job && !job.entry;
    const nAll = R.set.length;
    let agreed = 0;
    for (let i = 0; i < nAll; i++) {
      const [a, b] = split(R, i);
      if (R.seen[i] >= 0 || (a + b > 0 && !(a && b))) agreed++;
    }
    label(ctx, L.compact ? `Bounded set · ${nAll}` : `Bounded set · ${nAll} allowed images`, M.x, M.y + (L.compact ? 0 : 4), { size: L.compact ? 10 : 11, upper: true, track: L.compact ? 1 : 1.6, color: C.gold });
    const allAgree = agreed === nAll && aliveCount(R) > 0;
    label(ctx, `${agreed} / ${nAll} agreed`, M.x + M.w, M.y + (L.compact ? 0 : 4), { size: 10, align: 'right', color: allAgree ? C.gold : INK[3] });

    // The single-variable cross through the base image (or the whole grid with pairs).
    if (!params.pairs) {
      ctx.fillStyle = INK.faint;
      roundRect(ctx, M.gx - 2, M.gy + img.c * M.ch, M.cw * 10 + 4, M.ch, 7);
      ctx.fill();
      roundRect(ctx, M.gx + img.d * M.cw, M.gy - 2, M.cw, M.ch * 4 + 4, 7);
      ctx.fill();
    }
    for (let c = 0; c < 4; c++) {
      label(ctx, COLOURS[c].name, M.x, M.gy + (c + 0.5) * M.ch + 1, { size: L.compact ? 9 : 10, baseline: 'middle', upper: !L.compact, track: L.compact ? 0 : 1, color: c === img.c ? INK[2] : INK[4] });
    }
    if (!L.compact) {
      for (let d = 0; d < 10; d++) label(ctx, String(d), M.gx + (d + 0.5) * M.cw, M.gy - 7, { size: 9.5, align: 'center', color: d === img.d ? INK[2] : INK[4] });
    }
    // The weight intervention sits beside the base row; its label goes above it (below on the top row).
    const wr = weightRect(R);
    const wy = img.c === 0 ? wr.y + wr.h + (L.compact ? 9 : 11) : wr.y - (L.compact ? 3 : 5);
    label(ctx, L.compact ? WEIGHTS[1 - img.w] : 'weight', wr.x + wr.w / 2, wy, { size: L.compact ? 8.5 : 9.5, align: 'center', color: INK[3] });
    for (let c = 0; c < 4; c++) {
      for (let d = 0; d < 10; d++) {
        const i = R.at[`${d}.${c}.${img.w}`] ?? -1;
        drawCell(cellRect(d, c), { d, c, w: img.w }, i, R, cur, pending, time);
      }
    }
    const wq = { d: img.d, c: img.c, w: 1 - img.w };
    drawCell(weightRect(R), wq, R.at[`${wq.d}.${wq.c}.${wq.w}`], R, cur, pending, time);

    if (!L.compact) drawMatrixCaption(M.gy + 4 * M.ch + 22);
  }

  function drawCell(r, q, i, R, cur, pending, time) {
    const inSet = i >= 0;
    const g = L.compact ? 1.5 : 2;
    const x = r.x + g;
    const y = r.y + g;
    const w = r.w - g * 2;
    const h = r.h - g * 2;
    const seen = inSet ? R.seen[i] : -1;
    const [a, b] = inSet ? split(R, i) : [0, 0];
    const agreed = inSet && seen < 0 && a + b > 0 && !(a && b);
    const isCur = inSet && i === cur;
    const isHover = hover && R === run && hover.q.d === q.d && hover.q.c === q.c && hover.q.w === q.w;
    const wrong = revealed && R === run && R.status === 'certified' && agreed && (a ? 1 : 0) !== R.truth[i];
    const rad = L.compact ? 4 : 6;

    roundRect(ctx, x, y, w, h, rad);
    ctx.fillStyle = alpha(C.midnight, inSet ? 0.9 : 0.55);
    ctx.fill();
    if (wrong && !reduced) glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 0.9, C.ember, 0.35);
    if (isCur && pending && !reduced) glow(ctx, x + w / 2, y + h / 2, Math.max(w, h) * 0.8, C.amber, 0.3 + 0.15 * Math.sin(time * 9));
    const s = Math.min(w, h) * (L.compact ? 1 : 0.9);
    ctx.save();
    ctx.globalAlpha = !inSet ? 0.13 : seen >= 0 || agreed ? 0.5 : 1;
    ctx.drawImage(glyph(q, R.image), x + (w - s) / 2 - (L.compact ? 0 : 1.5), y + (h - s) / 2 - (L.compact ? 0 : 1), s, s);
    ctx.restore();

    // Frame: gold once every survivor agrees, cream once asked, amber while in flight.
    let stroke = inSet ? INK.line : null;
    let lw = 1;
    if (agreed) stroke = alpha(C.gold, 0.75);
    if (seen >= 0) stroke = alpha(C.cream, 0.65);
    if (isHover) stroke = C.cream;
    if (wrong || (isCur && R.status === 'contradiction')) {
      stroke = C.ember;
      lw = 1.5;
    }
    if (isCur && pending) {
      stroke = C.amber;
      lw = 1.6;
    }
    if (stroke) {
      roundRect(ctx, x, y, w, h, rad);
      ctx.strokeStyle = stroke;
      ctx.lineWidth = lw;
      ctx.stroke();
    }
    if (R === run && i === run.plan && !job && !certifying && run.status === 'open') {
      roundRect(ctx, x - 2.5, y - 2.5, w + 5, h + 5, rad + 2);
      ctx.setLineDash([3, 3]);
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.2;
      ctx.stroke();
      ctx.setLineDash([]);
    }
    if (L.compact || !inSet) return;

    // Contested: how the survivors split (cream = say 1, dim = say 0). Settled: the agreed label.
    if (seen < 0 && a && b) {
      const bx = x + 5;
      const bw = w - 10;
      const by = y + h - 3.5;
      const t = a / (a + b);
      line(ctx, bx, by, bx + bw * t, by, C.cream, 2);
      line(ctx, Math.min(bx + bw, bx + bw * t + 2), by, bx + bw, by, INK[4], 2);
    } else if (seen >= 0 || agreed) {
      const v = seen >= 0 ? seen : a ? 1 : 0;
      const col = wrong ? C.ember : seen >= 0 ? C.cream : C.gold;
      const br = Math.min(5.5, w * 0.15);
      dot(ctx, x + w - br - 1.5, y + br + 1.5, br, alpha(C.midnight, 0.95), alpha(col, 0.8), 1);
      label(ctx, String(v), x + w - br - 1.5, y + br + 2, { size: br * 1.5, align: 'center', baseline: 'middle', color: col });
    }
  }

  function drawMatrixCaption(y) {
    const M = L.mat;
    if (hover && !busyBatch()) {
      const { i, q } = hover;
      let text = `${doText({ ...q, kind: 'pair' })}: outside the bounded set`;
      if (i >= 0) {
        const name = doText(run.set[i]);
        const [a, b] = split(run, i);
        if (run.seen[i] >= 0) text = `${name}: asked, the black box said ${run.seen[i]}`;
        else if (a && b) text = `${name}: survivors split ${a} / ${b} · click to query`;
        else if (a + b) text = `${name}: every survivor says ${a ? 1 : 0}`;
        else text = `${name}: no survivors left`;
      }
      labelFit(ctx, text, M.x, y, M.w, { size: 10.5, minSize: 8.5, color: INK[2] });
      return;
    }
    // A small key for the cell marks.
    let x = M.x;
    const o = { size: 10, baseline: 'middle', color: INK[3] };
    const items = [
      ['split', 'split of 1 / 0'],
      ['agree', 'all agree'],
      ['asked', 'asked'],
      ['next', 'next pick'],
    ];
    for (const [kind, text] of items) {
      if (kind === 'split') {
        line(ctx, x, y, x + 9, y, C.cream, 2);
        line(ctx, x + 11, y, x + 18, y, INK[4], 2);
      } else {
        roundRect(ctx, x + 1, y - 6, 16, 12, 3);
        ctx.setLineDash(kind === 'next' ? [3, 3] : []);
        ctx.strokeStyle = kind === 'next' ? C.amber : kind === 'agree' ? alpha(C.gold, 0.75) : alpha(C.cream, 0.65);
        ctx.lineWidth = 1.1;
        ctx.stroke();
        ctx.setLineDash([]);
      }
      label(ctx, text, x + 25, y + 1, o);
      x += 25 + textWidth(ctx, text, o) + 16;
    }
  }

  function cardRect(k) {
    const G = L.cards;
    const col = k % G.cols;
    const row = Math.floor(k / G.cols);
    const gx = L.compact ? 10 : 12;
    const gy = L.compact ? 2 : 8;
    const w = (G.w - gx * (G.cols - 1)) / G.cols;
    const h = (G.h - gy * (G.rows - 1)) / G.rows;
    return { x: G.x + col * (w + gx), y: G.y + row * (h + gy), w, h };
  }

  function drawCandidates(time) {
    const G = L.cards;
    const n = aliveCount(run);
    const titleO = { size: L.compact ? 10 : 11, upper: true, track: L.compact ? 1 : 1.6, color: C.gold };
    const title = L.compact ? 'Candidates' : 'Candidate abstractions';
    label(ctx, title, G.x, G.title, titleO);
    const tw = textWidth(ctx, title.toUpperCase(), titleO) + title.length * titleO.track;
    label(ctx, ` · ${n} of ${K} survive`, G.x + tw, G.title, { ...titleO, color: n ? INK[2] : C.ember, track: titleO.track });
    if (!L.compact) {
      const cur = currentIndex(run);
      const text = cur >= 0 ? `badge = predicted label for ${doText(run.set[cur])}` : 'badge = predicted label for the query';
      labelFit(ctx, text, G.x + G.w, G.title, G.w * 0.42, { size: 10, minSize: 8.5, align: 'right', color: INK[3] });
    }
    for (let k = 0; k < K; k++) drawCard(k, cardRect(k), time);
  }

  function drawCard(k, r, time) {
    const cand = CANDIDATES[k];
    const alive = run.alive[k];
    const t0 = struck[k];
    const p = alive ? 0 : t0 == null ? 1 : clamp((time - t0) / 0.4);
    const fade = alive ? 1 : lerp(1, 0.42, easeOut(p));
    const certified = run.status === 'certified' && alive;
    const isTruth = revealed && cand === truthOf();
    const cur = currentIndex(run);
    const pending = job && !job.entry;
    const lastE = run.log[run.log.length - 1];
    const two = !L.compact && r.h >= 40;
    const c = L.compact;
    const cy = two ? r.y + r.h * 0.4 : r.y + r.h / 2;

    roundRect(ctx, r.x, r.y, r.w, r.h, c ? 5 : 8);
    ctx.fillStyle = alive ? (certified ? alpha(C.gold, 0.07) : INK.faint) : alpha(C.cream, 0.02 * fade);
    ctx.fill();
    ctx.strokeStyle = certified ? alpha(C.gold, 0.6) : alpha(C.cream, alive ? 0.12 : 0.06);
    ctx.lineWidth = 1;
    ctx.stroke();

    // Status dot (ringed in gold for the true rule, once revealed).
    const dx = r.x + (c ? 7 : 12);
    dot(ctx, dx, cy, c ? 2.2 : 2.6, alive ? (certified ? C.gold : INK[2]) : alpha(C.ember, 0.55 * fade + 0.15));
    if (isTruth) dot(ctx, dx, cy, c ? 4.6 : 5.6, null, C.gold, 1.2);

    // Rule text, struck out when eliminated.
    const tx = dx + (c ? 8 : 12);
    const badgeW = c ? 16 : 34;
    const maxW = r.x + r.w - badgeW - tx - 4;
    const size = c ? Math.min(10, Math.max(8.5, r.h * 0.68)) : 11.5;
    labelFit(ctx, cand.text, tx, cy + 0.5, maxW, { size, minSize: 8, baseline: 'middle', color: alive ? (certified ? C.gold : INK[1]) : alpha(C.cream, 0.32 * fade + 0.1) });
    if (!alive && p > 0) {
      const tw = Math.min(maxW, textWidth(ctx, cand.text, { size }));
      line(ctx, tx - 2, cy + 0.5, tx - 2 + (tw + 4) * easeOut(p), cy + 0.5, alpha(C.ember, 0.8), 1.2);
    }
    if (two) {
      let note = '';
      let col = INK[3];
      if (isTruth) {
        note = 'true rule';
        col = C.gold;
      } else if (!alive) note = `out at query #${run.outAt[k]}`;
      else if (certified) {
        note = 'agrees on every allowed image';
        col = alpha(C.gold, 0.7);
      }
      if (note) labelFit(ctx, note, tx, r.y + r.h * 0.76, r.w - (tx - r.x) - 10, { size: 9.5, minSize: 8, baseline: 'middle', color: col });
    }

    // Badge: this candidate's predicted label for the current query.
    const bx = r.x + r.w - (c ? 6 : 18);
    const freshlyOut = !alive && lastE && run.outAt[k] === lastE.n && !pending;
    if (cur >= 0 && (alive || freshlyOut)) {
      const v = run.pred[cur][k];
      let col = C.cream;
      let ring = INK[4];
      if (!pending && lastE && lastE.i === cur) {
        col = alive ? C.gold : C.ember;
        ring = alive ? alpha(C.gold, 0.6) : alpha(C.ember, 0.6);
      }
      if (!c) dot(ctx, bx, cy, 9, null, ring, 1.1);
      label(ctx, String(v), bx, cy + 0.5, { size: c ? 10 : 11, align: c ? 'right' : 'center', baseline: 'middle', color: col });
    } else if (!alive && c) {
      label(ctx, `#${run.outAt[k]}`, bx, cy + 0.5, { size: 8.5, align: 'right', baseline: 'middle', color: INK[4] });
    }
  }

  function drawBatch() {
    const G = L.cards;
    const c = L.compact;
    const B = batch;
    const n = B.sep.length;
    label(ctx, c ? `${BATCH} images · queries per image` : `${BATCH} images · interventions per image`, G.x, G.title, { size: c ? 10 : 11, upper: true, track: c ? 1 : 1.6, color: C.gold });
    label(ctx, B.done ? 'same images, same budget' : `${n} / ${BATCH}`, G.x + G.w, G.title, { size: 10, align: 'right', color: INK[3] });

    const cats = [
      { name: 'certified', color: C.gold, fill: true, test: (x) => x.status === 'certified' && !x.wrong },
      { name: 'certified, but wrong', color: C.ember, fill: true, test: (x) => x.status === 'certified' && x.wrong > 0 },
      { name: 'contradiction', color: C.ember, fill: false, test: (x) => x.status === 'contradiction' },
      { name: 'budget spent', color: C.amber, fill: true, test: (x) => x.status === 'uncertified' },
    ];
    const present = cats.filter((k) => B.sep.some(k.test) || B.rnd.some(k.test));
    let lx = G.x;
    const ly = G.y + 6;
    const lo = { size: c ? 9 : 10, baseline: 'middle', color: INK[2] };
    for (const k of present) {
      if (k.fill) {
        ctx.fillStyle = k.color;
        ctx.fillRect(lx, ly - 4, 8, 8);
      } else {
        ctx.strokeStyle = k.color;
        ctx.lineWidth = 1.2;
        ctx.strokeRect(lx + 0.5, ly - 3.5, 7, 7);
      }
      label(ctx, k.name, lx + 13, ly + 0.5, lo);
      lx += 13 + textWidth(ctx, k.name, lo) + (c ? 10 : 18);
    }

    const ex = run.set.length;
    const maxK = Math.max(params.budget, ex <= 20 ? ex : 0);
    const top = G.y + 18;
    const axisH = 16;
    const rowH = (G.y + G.h - axisH - top) / 2;
    const lw = c ? 76 : 132;
    const ax0 = G.x + lw;
    const ax1 = G.x + G.w;
    const bw = (ax1 - ax0) / (maxK + 1);
    const lists = [
      ['Separation', B.sep],
      ['Random', B.rnd],
    ];
    const hist = lists.map(([, list]) => {
      const bins = Array.from({ length: maxK + 1 }, () => cats.map(() => 0));
      for (const x of list) {
        const ci = cats.findIndex((k) => k.test(x));
        bins[Math.min(maxK, x.used)][ci]++;
      }
      return bins;
    });
    const peak = Math.max(1, ...hist.flatMap((bins) => bins.map((s) => s.reduce((a, b) => a + b, 0))));

    lists.forEach(([name, list], r) => {
      const y0 = top + r * rowH;
      const base = y0 + rowH - 6;
      const hMax = rowH - 24;
      label(ctx, name, G.x, y0 + 14, { size: c ? 9.5 : 10.5, upper: true, track: c ? 0.6 : 1.2, color: C.cream });
      if (list.length) {
        const s = stats(list);
        label(ctx, s.avg.toFixed(1), G.x, y0 + (c ? 36 : 48), { font: 'serif', size: c ? 22 : 32, color: C.cream });
        label(ctx, `${Math.round(s.certified * 100)}% certified`, G.x, y0 + (c ? 50 : 66), { size: c ? 8.5 : 9.5, color: INK[3] });
        const mx = ax0 + (s.avg + 0.5) * bw;
        line(ctx, mx, y0 + 8, mx, base, alpha(C.cream, 0.8), 1, [2, 3]);
        const right = mx + 70 < ax1;
        label(ctx, `mean ${s.avg.toFixed(1)}`, right ? mx + 5 : mx - 5, y0 + 14, { size: 9.5, align: right ? 'left' : 'right', color: INK[2] });
      }
      line(ctx, ax0, base + 0.5, ax1, base + 0.5, INK.line);
      hist[r].forEach((segs, k) => {
        let yb = base;
        const x = ax0 + k * bw + bw * 0.16;
        const wBar = Math.max(2, bw * 0.68);
        segs.forEach((v, ci) => {
          if (!v) return;
          const hh = (v / peak) * hMax;
          const cat = cats[ci];
          if (cat.fill) {
            ctx.fillStyle = cat.color;
            ctx.fillRect(x, yb - hh, wBar, hh);
          } else {
            ctx.strokeStyle = cat.color;
            ctx.lineWidth = 1.2;
            ctx.strokeRect(x + 0.6, yb - hh + 0.6, wBar - 1.2, hh - 1.2);
          }
          yb -= hh;
        });
      });
    });

    // Exhaustive reference: asking every allowed image.
    const o = { size: 9.5, color: INK[3] };
    if (ex <= maxK) {
      const x = ax0 + (ex + 0.5) * bw;
      line(ctx, x, top + 18, x, top + rowH * 2 - 6, INK[4], 1, [4, 4]);
      label(ctx, c ? `all ${ex}` : `exhaustive · ${ex}`, x - 5, top + rowH * 2 - 10, { ...o, align: 'right' });
    } else {
      label(ctx, c ? `all ${ex} →` : `exhaustive needs ${ex} →`, ax1, top + rowH * 2 - 10, { ...o, align: 'right' });
    }
    const stepK = maxK > 12 ? 2 : 1;
    for (let k = 0; k <= maxK; k += stepK) label(ctx, String(k), ax0 + (k + 0.5) * bw, top + rowH * 2 + 10, { ...o, align: 'center' });
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    now = time;
    if (busyBatch()) advanceBatch();
    if (job) advanceJob(dt, time);
    if (certifying && !job) {
      if (run.status !== 'open') finish();
      else if (params.speed === 0) {
        instantRest();
        refresh();
      } else ask(run.plan);
    }

    view.clear();
    if (!L.mat) layout(view);
    drawHeader();
    drawBench(time);
    drawMatrix(time);
    if (L.log) drawLog();
    if (mode === 'batch' && batch) drawBatch();
    else drawCandidates(time);
    const R = shown();
    stat.set(
      busyBatch()
        ? `seed ${seed} · batch ${batch.sep.length}/${BATCH} · budget ${params.budget}`
        : L.compact
          ? `seed ${seed} · image ${R.image.n} · ${run.used}/${params.budget} queries`
          : `seed ${seed} · image ${R.image.n} · ${params.strategy} selection · ${run.used}/${params.budget} queries · ${run.set.length} allowed images`,
    );
  });

  loadImage(1);
  narrate(`Twenty candidate rules could explain this black box. Which interventions tell them apart?`, 'Which interventions tell the candidates apart?');

  return {
    start: () => tick.start(),
    stop: () => tick.stop(),
    destroy() {
      tick.stop();
      ptr.destroy();
      view.destroy();
    },
  };
}
