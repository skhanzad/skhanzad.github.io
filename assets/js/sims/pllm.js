// PLLM+: replay an old snippet's own era before repairing it by trial and error.
//
// A synthetic package ecosystem evolves from 2014 to 2026: releases add and remove the
// calls snippets make, constrain one another, and install only on the Python versions of
// their day. Each snippet is written at one date with the calls of that date. The
// baseline installs today's versions and moves whichever package an error blames one
// release at a time. Replay-and-repair dates the snippet, rebuilds that era's
// configuration, tries nearby dates when it fails, and only then asks an LLM for a pin.
import {
  C,
  INK,
  alpha,
  rng,
  gauss,
  clamp,
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
  bars,
  section,
  para,
  slider,
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

const NOW = 2026.75; // October 2026
const SPAN = [2014, 2026.95]; // the timeline's date range
const BATCH = 200;
const CAP = 600; // simulated seconds each strategy may spend on one snippet
const MAX_NEARBY = 4; // nearby dates replay tries before the LLM fallback
const MAX_LLM = 2; // LLM proposals per snippet
const P_LLM = 0.35; // chance that an LLM proposal is the right pin
const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
const MONTH = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

const ym = (d) => {
  const y = Math.floor(d);
  return { y, m: Math.min(11, Math.floor((d - y) * 12)) };
};
const monYear = (d) => `${MON[ym(d).m]} ${ym(d).y}`;
const monthYear = (d) => `${MONTH[ym(d).m]} ${ym(d).y}`;
const pad2 = (n) => String(n).padStart(2, '0');
const clockText = (t) => `${Math.floor(t / 60)}:${pad2(Math.floor(t % 60))}`;
const secs = (t) => {
  const s = Math.round(t);
  return s < 60 ? `${s} s` : `${Math.floor(s / 60)} min ${s % 60} s`;
};
// Long call names, shortened for the narrow gutter on phones.
const shortName = (name) => (name.length <= 11 ? name : name.includes('(') ? name.slice(name.indexOf('(') + 1, -1) : name.slice(name.indexOf('.')));

function seedOf(...parts) {
  let h = 0x811c9dc5;
  for (const p of parts) h = Math.imul(h ^ (p >>> 0), 0x01000193) >>> 0;
  return h;
}

/* ---------------------------------------------------------------- */
/* The ecosystem                                                    */
/* ---------------------------------------------------------------- */

// Python's release dates are real; every package below is invented.
const PY = [
  ['2.7', 2010.5],
  ['3.4', 2014.2],
  ['3.5', 2015.7],
  ['3.6', 2016.97],
  ['3.7', 2018.49],
  ['3.8', 2019.79],
  ['3.9', 2020.76],
  ['3.10', 2021.76],
  ['3.11', 2022.81],
  ['3.12', 2023.75],
  ['3.13', 2024.77],
  ['3.14', 2025.77],
].map(([v, d], i) => ({ v, d, i }));
const PY_TOP = PY.length - 1;
const PYI = (v) => PY.findIndex((p) => p.v === v);

// What the interpreter must accept: a print statement needs 2.7, f-strings 3.6, := 3.8.
const SYNTAX = {
  plain: { min: 1, track: 'syntax', print: "print('done')" },
  py2: { min: 0, track: 'print stmt', print: 'print "done"' },
  fstring: { min: PYI('3.6'), track: 'f-string', print: "print(f'done in {secs:.1f}s')" },
  walrus: { min: PYI('3.8'), track: 'walrus :=', print: 'print(total := 42)' },
};

// series: [major, releases, first date, last date, first minor]. A call exists from the
// release `from` until the release `to` removed it. ahead / behind: how many years after
// a release its build still works on newer Pythons, and how far back it supports older ones.
const PKGS = [
  {
    name: 'arrayx',
    as: 'ax',
    weight: 0.8,
    mb: 5,
    ahead: 1.2,
    behind: 4.5,
    series: [
      [1, 16, 2012.6, 2018.95],
      [2, 10, 2019.2, 2022.85],
      [3, 5, 2023.15, 2026.45],
    ],
    yanked: ['2.4'],
    setup: 'rows = ax.ones((4, 3))',
    calls: [
      { name: 'matrix', line: 'm = ax.matrix(rows)', hl: 'ax.matrix', from: '1.0', to: '3.0' },
      { name: 'asscalar', line: 'n = ax.asscalar(m.sum())', hl: 'ax.asscalar', from: '1.0', to: '2.0' },
      { name: 'stack', line: 'grid = ax.stack([rows, rows])', hl: 'ax.stack', from: '1.6' },
      { name: 'rng', line: 'noise = ax.rng(7).normal(3)', hl: 'ax.rng', from: '2.4' },
    ],
  },
  {
    name: 'tablekit',
    as: 'tk',
    weight: 0.85,
    mb: 6,
    ahead: 1,
    behind: 4.5,
    series: [
      [1, 13, 2014.35, 2018.85],
      [2, 12, 2019.05, 2023.45],
      [3, 5, 2023.7, 2026.3],
    ],
    setup: "df = tk.read_table('sales.csv')",
    calls: [
      { name: 'Frame.ix', line: 'top = df.ix[:5]', hl: '.ix', from: '1.0', to: '2.0' },
      { name: 'Frame.append', line: 'df = df.append(row)', hl: '.append', from: '1.0', to: '3.0', group: 'add' },
      { name: 'concat', line: 'df = tk.concat([df, row])', hl: 'tk.concat', from: '1.4', group: 'add' },
      { name: 'Frame.map_rows', line: 'df = df.map_rows(str.strip)', hl: '.map_rows', from: '2.6' },
    ],
  },
  {
    name: 'plotwise',
    as: 'pw',
    weight: 0.5,
    mb: 4,
    ahead: 1.6,
    behind: 4.5,
    series: [
      [1, 10, 2013.4, 2016.85],
      [2, 15, 2017.1, 2021.25],
      [3, 8, 2021.5, 2026.2],
    ],
    setup: 'fig = pw.figure()',
    calls: [
      { name: 'hold', line: 'pw.hold(True)', hl: 'pw.hold', from: '1.0', to: '2.0' },
      { name: 'Figure.tight', line: 'fig.tight()', hl: '.tight', from: '1.0', to: '3.0' },
      { name: 'style.use', line: "pw.style.use('grid')", hl: 'pw.style.use', from: '1.4' },
      { name: 'colormap', line: "pw.colormap('dusk')", hl: 'pw.colormap', from: '2.3' },
    ],
  },
  {
    name: 'learnlab',
    as: 'll',
    weight: 0.4,
    mb: 7,
    ahead: 0.9,
    behind: 4,
    series: [
      [0, 10, 2014.6, 2020.9, 15],
      [1, 7, 2021.6, 2024.55],
      [2, 4, 2024.9, 2026.35],
    ],
    yanked: ['0.21'],
    setup: "X, y = ll.load('iris')",
    calls: [
      { name: 'validation', line: 'from learnlab.validation import split', hl: 'learnlab.validation', from: '0.15', to: '1.0', kind: 'module', group: 'split' },
      { name: 'split', line: 'from learnlab import split', hl: 'split', from: '0.19', kind: 'import', group: 'split' },
      { name: 'Forest(n=)', line: 'model = ll.Forest(n=50)', hl: 'n=50', from: '0.15', to: '2.0', kind: 'kwarg', group: 'forest' },
      { name: 'Forest(trees=)', line: 'model = ll.Forest(trees=50)', hl: 'trees=50', from: '0.21', kind: 'kwarg', group: 'forest' },
    ],
  },
  {
    name: 'netfetch',
    as: 'nf',
    weight: 0.35,
    mb: 1.5,
    ahead: 4,
    behind: 6,
    series: [
      [2, 15, 2014, 2021.85],
      [3, 5, 2022.2, 2026.1],
    ],
    setup: "URL = 'https://feed.local/v1'",
    calls: [
      { name: 'get(verify=)', line: 'page = nf.get(URL, verify=False)', hl: 'verify=False', from: '2.0', to: '3.0', kind: 'kwarg' },
      { name: 'compat', line: 'host = nf.compat.urlparse(URL)', hl: 'nf.compat', from: '2.0', to: '3.0' },
      { name: 'Client', line: 'api = nf.Client(retries=3)', hl: 'nf.Client', from: '2.10' },
    ],
  },
  {
    name: 'gradflux',
    as: 'gf',
    weight: 0.25,
    mb: 12,
    ahead: 0.5,
    behind: 3,
    py2Until: 2018.3,
    series: [
      [0, 12, 2016.4, 2018.05, 1],
      [1, 16, 2018.3, 2020.6],
      [2, 12, 2020.85, 2026.3],
    ],
    setup: 'x = gf.zeros([8])',
    calls: [
      { name: 'Session', line: 'sess = gf.Session()', hl: 'gf.Session', from: '0.1', to: '2.0', group: 'graph' },
      { name: 'placeholder', line: "x = gf.placeholder('float')", hl: 'gf.placeholder', from: '0.1', to: '2.0' },
      { name: 'compile', line: 'step = gf.compile(loss)', hl: 'gf.compile', from: '1.8', group: 'graph' },
      { name: 'Param', line: 'w = gf.Param(x)', hl: 'gf.Param', from: '1.2' },
    ],
  },
];
const PKG = {};

for (const P of PKGS) {
  PKG[P.name] = P;
  const wobble = rng(P.name.length * 7919 + P.name.charCodeAt(1));
  P.rel = [];
  for (const [major, count, a, b, first = 0] of P.series) {
    const gap = (b - a) / (count - 1);
    for (let k = 0; k < count; k++) {
      const jitter = k > 0 && k < count - 1 ? (wobble() - 0.5) * gap * 0.5 : 0;
      P.rel.push({ v: `${major}.${first + k}`, d: a + gap * k + jitter, major: k === 0 });
    }
  }
  P.rel.forEach((R, i) => {
    R.i = i;
    R.yanked = !!P.yanked?.includes(R.v);
    R.py2 = R.d < (P.py2Until ?? 2020);
    R.pyMax = Math.max(1, ...PY.filter((p) => p.i >= 1 && p.d <= R.d + P.ahead).map((p) => p.i));
    R.pyMin = PY.find((p) => p.i >= 1 && p.d >= R.d - P.behind)?.i ?? PY_TOP;
  });
  P.at = Object.fromEntries(P.rel.map((R) => [R.v, R.i]));
  for (const c of P.calls) {
    c.pkg = P;
    c.kind = c.kind || 'attr';
    c.lo = P.at[c.from];
    c.hi = c.to ? P.at[c.to] : Infinity;
  }
}

// While `P` is in [lo, hi), `D` must be in [min, max).
const RULES = [
  ['tablekit', '1.0', '2.0', 'arrayx', null, '2.0'],
  ['tablekit', '2.0', '2.11', 'arrayx', null, '3.0'],
  ['tablekit', '3.0', null, 'arrayx', '2.0', null],
  ['plotwise', '3.0', null, 'arrayx', '2.0', null],
  ['learnlab', '0.15', '0.22', 'arrayx', null, '2.0'],
  ['learnlab', '1.0', null, 'arrayx', '2.0', null],
  ['learnlab', '2.0', null, 'tablekit', '3.0', null],
  ['gradflux', '0.1', '1.10', 'arrayx', null, '2.0'],
  ['gradflux', '2.0', null, 'arrayx', '2.0', null],
].map(([a, lo, hi, b, min, max]) => {
  const P = PKG[a];
  const D = PKG[b];
  return { P, D, lo: P.at[lo], hi: hi ? P.at[hi] : Infinity, min: min ? D.at[min] : -Infinity, max: max ? D.at[max] : Infinity };
});

const REMOVED = { attr: 'AttributeError', module: 'ModuleNotFoundError', import: 'ImportError', kwarg: 'TypeError' };
const MISSING = { attr: 'AttributeError', module: 'ImportError', import: 'ImportError', kwarg: 'TypeError' };
const NODIST = { stage: 'resolve', type: 'InstallError', msg: "no package on the index provides 'helpers'", pkg: null, dir: 0, line: -1 };
const FILES = [
  ['gradflux', 'train_net.py'],
  ['learnlab', 'fit_model.py'],
  ['plotwise', 'plot_rates.py'],
  ['netfetch', 'fetch_feed.py'],
  ['tablekit', 'clean_sales.py'],
  ['arrayx', 'grid_stats.py'],
];

/* ---------------------------------------------------------------- */
/* Resolving and running a configuration                            */
/* ---------------------------------------------------------------- */

const key = (cfg) => `${cfg.py}:${Object.values(cfg.v).join('.')}`;

// The newest release out by date d (the oldest one if none was out yet).
function newestAt(P, d, yanked = false) {
  let best = -1;
  for (const R of P.rel) if (R.d <= d && (yanked || !R.yanked)) best = R.i;
  return best >= 0 ? best : P.rel.findIndex((R) => yanked || !R.yanked);
}

function ruleBreak(v) {
  for (const R of RULES) {
    const a = v[R.P.name];
    const b = v[R.D.name];
    if (a == null || b == null || a < R.lo || a >= R.hi) continue;
    if (b < R.min) return { R, low: true };
    if (b >= R.max) return { R, low: false };
  }
  return null;
}

// Step releases back until no cross-package requirement is broken.
function settle(v, yanked = false) {
  for (let k = 0; k < 12; k++) {
    const c = ruleBreak(v);
    if (!c) break;
    const [P, limit] = c.low ? [c.R.P, c.R.lo] : [c.R.D, c.R.max];
    let i = Math.min(limit, v[P.name]) - 1;
    while (i >= 0 && !yanked && P.rel[i].yanked) i--;
    if (i < 0) break;
    v[P.name] = i;
  }
  return v;
}

const fitsPy = (rels, i) => rels.every((R) => i >= R.pyMin && i <= R.pyMax);

// The interpreter for a configuration: the syntax decides first, then the newest Python
// out by date d that every chosen release installs on.
function pickPy(syntax, pkgs, v, d) {
  if (syntax === 'py2') return 0;
  const rels = pkgs.map((P) => P.rel[v[P.name]]);
  const min = SYNTAX[syntax].min;
  let best = -1;
  for (let i = min; i <= PY_TOP; i++) if (PY[i].d <= d && fitsPy(rels, i)) best = i;
  for (let i = min; i <= PY_TOP && best < 0; i++) if (fitsPy(rels, i)) best = i;
  if (best < 0) {
    best = min;
    for (let i = min; i <= PY_TOP; i++) if (PY[i].d <= d) best = i;
  }
  return best;
}

// The configuration that was current at date d.
function resolveAt(sn, d) {
  const v = {};
  for (const P of sn.pkgs) v[P.name] = newestAt(P, d);
  settle(v);
  return { py: pickPy(sn.syntax, sn.pkgs, v, d), v };
}

const fail = (stage, type, msg, pkg, dir, line = -1, at = null) => ({ stage, type, msg, pkg, dir, line, at });

function syntaxError(syntax, py) {
  if (syntax === 'py2' && py > 0) return { msg: "Missing parentheses in call to 'print'", dir: -1 };
  const min = SYNTAX[syntax].min;
  if (min > 1 && (py === 0 || py < min)) return { msg: `${syntax === 'walrus' ? "':=' needs" : 'f-strings need'} Python ${PY[min].v} or newer`, dir: 1 };
  return null;
}

// Install and run a snippet under a configuration: null if it runs, else the first error,
// the package it blames ('py' for the interpreter) and which way that package should move.
function check(sn, cfg) {
  const { py } = cfg;
  for (const P of sn.pkgs) {
    const R = P.rel[cfg.v[P.name]];
    if (R.yanked) return fail('resolve', 'InstallError', `${P.name} ${R.v} was yanked from the index`, P, -1);
    if (py === 0 ? !R.py2 : py < R.pyMin) return fail('resolve', 'InstallError', `${P.name} ${R.v} requires Python ${py === 0 ? '3' : `≥ ${PY[R.pyMin].v}`}`, P, -1);
  }
  const c = ruleBreak(cfg.v);
  if (c) {
    const { R, low } = c;
    const who = `${R.P.name} ${R.P.rel[cfg.v[R.P.name]].v}`;
    return low
      ? fail('resolve', 'VersionConflict', `${who} needs ${R.D.name} ≥ ${R.D.rel[R.min].v}`, R.P, -1)
      : fail('resolve', 'VersionConflict', `${who} needs ${R.D.name} < ${R.D.rel[R.max].v}`, R.D, -1);
  }
  if (py > 0) {
    for (const P of sn.pkgs) {
      const R = P.rel[cfg.v[P.name]];
      if (py > R.pyMax) return fail('build', 'BuildError', `no build of ${P.name} ${R.v} for Python ${PY[py].v}`, 'py', -1, -1, P);
    }
  }
  const s = syntaxError(sn.syntax, py);
  if (s) return fail('compile', 'SyntaxError', s.msg, 'py', s.dir, sn.lines.length - 1);
  for (let i = 0; i < sn.lines.length; i++) {
    const ln = sn.lines[i];
    if (ln.kind === 'local') return fail('run', 'ModuleNotFoundError', "No module named 'helpers'", null, 0, i);
    const k = ln.call;
    if (!k) continue;
    const P = k.pkg;
    const ri = cfg.v[P.name];
    if (ri < k.lo) {
      const added = P.rel[k.lo];
      return fail('run', MISSING[k.kind], `${P.name} ${P.rel[ri].v} has no ${k.name} (added in ${added.v}${added.yanked ? ', since yanked' : ''})`, P, 1, i);
    }
    if (ri >= k.hi) return fail('run', REMOVED[k.kind], `${P.name}.${k.name} was removed in ${P.rel[k.hi].v}`, P, -1, i);
  }
  return null;
}

// Simulated seconds for one install-and-run attempt: create an environment, resolve,
// install (a failed source build is slow), then run until the first error.
function cost(sn, e, r, extra = 0) {
  const j = (base, s = 0.2) => base * clamp(1 + s * gauss(r), 0.4, 2);
  let t = extra + j(3.5);
  if (e?.stage === 'resolve') return t + j(2.6);
  for (const P of sn.pkgs) {
    if (e?.stage === 'build' && e.at === P) return t + j(38, 0.25);
    t += j(P.mb);
  }
  if (e?.stage === 'compile') return t + j(0.8);
  return t + j(e ? 1.4 : 2.6);
}

function add(tr, a) {
  a.t0 = tr.time;
  a.t1 = tr.time + a.dt;
  tr.time = a.t1;
  tr.attempts.push(a);
}

// One release older (dir -1) or newer (+1) for the package an error blames.
function move(cfg, e) {
  const next = { py: cfg.py, v: { ...cfg.v } };
  if (e.pkg === 'py') {
    next.py = cfg.py + e.dir;
    return next.py >= 0 && next.py <= PY_TOP ? next : null;
  }
  const P = e.pkg;
  let i = cfg.v[P.name] + e.dir;
  while (i >= 0 && i < P.rel.length && P.rel[i].yanked) i += e.dir;
  if (i < 0 || i >= P.rel.length) return null;
  next.v[P.name] = i;
  return next;
}

/* ---------------------------------------------------------------- */
/* The two strategies                                               */
/* ---------------------------------------------------------------- */

// Baseline: today's versions, then move the blamed package one release per error.
function runBaseline(sn, budget, seed) {
  const r = rng(seedOf(seed, sn.n, 2));
  const tr = { key: 'base', attempts: [], ok: false, time: 0, start: 0, end: '' };
  let cfg = { py: PY_TOP, v: {} };
  for (const P of sn.pkgs) cfg.v[P.name] = newestAt(P, Infinity);
  let lbl = { long: 'today’s versions', short: 'latest' };
  const seen = new Set();
  while (tr.attempts.length < budget && tr.time < CAP) {
    seen.add(key(cfg));
    const e = check(sn, cfg);
    add(tr, { cfg, e, label: lbl, stage: 'base', dt: cost(sn, e, r) });
    if (!e) {
      tr.ok = true;
      break;
    }
    if (!e.pkg) {
      // A local module: look for it on the index once, then stop.
      if (tr.attempts.length < budget) add(tr, { cfg, e: NODIST, label: { long: 'pip install helpers', short: 'pip helpers' }, stage: 'base', dt: cost(sn, NODIST, r) });
      tr.end = 'local';
      break;
    }
    const next = move(cfg, e);
    if (!next || seen.has(key(next))) {
      tr.end = next ? 'circle' : 'stuck';
      break;
    }
    const arrow = e.dir < 0 ? '↓' : '↑';
    lbl =
      e.pkg === 'py'
        ? { long: `python ${arrow} ${PY[next.py].v}`, short: `py ${arrow} ${PY[next.py].v}` }
        : { long: `${e.pkg.name} ${arrow} ${e.pkg.rel[next.v[e.pkg.name]].v}`, short: `${e.pkg.as} ${arrow} ${e.pkg.rel[next.v[e.pkg.name]].v}` };
    cfg = next;
  }
  if (!tr.ok && !tr.end) tr.end = tr.time >= CAP ? 'time' : 'budget';
  return tr;
}

// The LLM fallback reads the last error and proposes a pin: sometimes the right one (the
// author's own versions), otherwise a plausible move of the blamed package.
function propose(sn, cfg, e, r) {
  if (!e.pkg) return { cfg, e: NODIST, label: { long: 'LLM: pip install helpers', short: 'LLM helpers' } };
  let next;
  if (r() < P_LLM) {
    next = { py: sn.env.py, v: { ...sn.env.v } };
    for (const P of sn.pkgs) if (P.rel[next.v[P.name]].yanked) next.v[P.name] += 1;
  } else {
    next = move(cfg, e) || { py: cfg.py, v: { ...cfg.v } };
    for (let k = Math.floor(r() * 3); k > 0; k--) next = move(next, e) || next;
  }
  const diff = [];
  for (const P of sn.pkgs) if (next.v[P.name] !== cfg.v[P.name]) diff.push([`${P.name} ${P.rel[next.v[P.name]].v}`, `${P.as} ${P.rel[next.v[P.name]].v}`]);
  if (next.py !== cfg.py) diff.push([`python ${PY[next.py].v}`, `py ${PY[next.py].v}`]);
  const more = diff.length > 1 ? ` +${diff.length - 1}` : '';
  return {
    cfg: next,
    label: diff.length ? { long: `LLM: pin ${diff[0][0]}${more}`, short: `LLM ${diff[0][1]}` } : { long: 'LLM: retry as is', short: 'LLM retry' },
  };
}

// Replay-and-repair: date the snippet, replay that era, steer to nearby dates, then the LLM.
function runReplay(sn, budget, seed) {
  const r = rng(seedOf(seed, sn.n, 3));
  const tr = { key: 'replay', attempts: [], ok: false, time: 0, start: 0, end: '', source: null };
  tr.time = tr.start = 3 * clamp(1 + 0.2 * gauss(r), 0.5, 1.6); // read the imports and syntax, date the snippet
  const seen = new Set();
  let e = null;
  let cfg = null;
  const attempt = (c, stage, lbl, extra, date, forced) => {
    seen.add(key(c));
    cfg = c;
    e = forced || check(sn, c);
    add(tr, { cfg: c, e, label: lbl, stage, date, dt: cost(sn, e, r, extra) });
    if (!e) {
      tr.ok = true;
      tr.source = stage;
    }
  };
  let d = sn.meta;
  attempt(resolveAt(sn, d), 'replay', { long: `replay ${monYear(d)}`, short: monYear(d) }, 0, d);
  // The error says which way to move in time; overshooting halves the step.
  let step = 0.25;
  let last = 0;
  for (let n = 0; !tr.ok && e.pkg && n < MAX_NEARBY && tr.attempts.length < budget && tr.time < CAP; n++) {
    const dir = e.dir || -1;
    if (last) step = dir === last ? step * 2 : step / 2;
    last = dir;
    let next = clamp(d + dir * step, SPAN[0], NOW);
    let c = resolveAt(sn, next);
    for (let k = 0; seen.has(key(c)) && k < 8; k++) {
      next = clamp(next + dir * 0.25, SPAN[0], NOW);
      c = resolveAt(sn, next);
    }
    if (seen.has(key(c))) break;
    d = next;
    attempt(c, 'nearby', { long: `date ${monYear(d)}`, short: monYear(d) }, 1, d);
  }
  for (let n = 0; !tr.ok && n < MAX_LLM && tr.attempts.length < budget && tr.time < CAP; n++) {
    const p = propose(sn, cfg, e, r);
    attempt(p.cfg, 'llm', p.label, 16 * clamp(1 + 0.3 * gauss(r), 0.4, 2), null, p.e);
  }
  if (!tr.ok) tr.end = tr.time >= CAP ? 'time' : tr.attempts.length >= budget ? 'budget' : 'exhausted';
  return tr;
}

/* ---------------------------------------------------------------- */
/* Snippets                                                         */
/* ---------------------------------------------------------------- */

// Snippet n of a seed. Every random draw is made up front, so moving the age or date
// sliders slides the same snippet through time rather than drawing a new one.
function makeSnippet(seed, n, p) {
  const u = Array.from({ length: 32 }, rng(seedOf(seed, n, 1)));
  const nrm = (a, b) => Math.sqrt(-2 * Math.log(Math.max(1e-9, u[a]))) * Math.cos(2 * Math.PI * u[b]);
  const T = Math.max(2014.3, NOW - clamp(p.age * Math.exp(0.5 * nrm(0, 1)), 0.3, 12.5));
  const meta = clamp(T + (p.noise / 12) * nrm(2, 3), SPAN[0] + 0.05, NOW - 0.02);
  const pool = PKGS.filter((P) => P.rel[0].d <= T);
  const chosen = [];
  for (let k = 0; k < (u[4] < 0.55 ? 2 : 3) && pool.length; k++) {
    let x = u[5 + k] * pool.reduce((s, P) => s + P.weight, 0);
    let i = 0;
    while (i < pool.length - 1 && (x -= pool[i].weight) > 0) i++;
    chosen.push(pool.splice(i, 1)[0]);
  }
  const pkgs = PKGS.filter((P) => chosen.includes(P));

  // The author's environment: what was current then, sometimes with one package left stale.
  const envAt = (stale) => {
    const v = {};
    for (const P of pkgs) v[P.name] = newestAt(P, P === stale ? T - 1.5 - 2.5 * u[11] : T, true);
    return settle(v, true);
  };
  let v = envAt(u[9] < 0.16 ? pkgs[Math.floor(u[10] * pkgs.length)] : null);
  let rels = pkgs.map((P) => P.rel[v[P.name]]);
  if (!PY.some((p) => p.i >= 1 && fitsPy(rels, p.i))) {
    v = envAt(null);
    rels = pkgs.map((P) => P.rel[v[P.name]]);
  }
  let syntax = u[12] < clamp((2019.6 - T) * 0.15, 0, 0.5) && rels.every((R) => R.py2) ? 'py2' : 'plain';
  let envPy = pickPy(syntax, pkgs, v, T);
  if (syntax === 'plain') syntax = envPy >= PYI('3.8') && u[13] < 0.2 ? 'walrus' : envPy >= PYI('3.6') && u[13] < 0.5 ? 'fstring' : 'plain';
  if (syntax === 'py2') envPy = 0;

  // One or two calls per package, from what the author's release offered; calls that
  // were later removed are likelier, since those are the snippets that stop running.
  const calls = [];
  pkgs.forEach((P, s) => {
    let cands = P.calls.filter((c) => v[P.name] >= c.lo && v[P.name] < c.hi);
    for (let j = 0; j < (u[14 + 3 * s] < 0.5 ? 1 : 2) && cands.length; j++) {
      const wts = cands.map((c) => (c.hi < Infinity ? 2 : 1));
      let x = u[15 + 3 * s + j] * wts.reduce((a, b) => a + b, 0);
      let i = 0;
      while (i < cands.length - 1 && (x -= wts[i]) > 0) i++;
      const c = cands[i];
      calls.push(c);
      cands = cands.filter((o) => o !== c && !(c.group && o.group === c.group));
    }
  });
  const local = u[23] < 0.28;

  const lines = [];
  const isImport = (c) => c.kind === 'module' || c.kind === 'import';
  for (const P of pkgs) {
    lines.push({ kind: 'import', text: `import ${P.name} as ${P.as}`, pkg: P });
    for (const c of calls) if (c.pkg === P && isImport(c)) lines.push({ kind: 'call', text: c.line, call: c });
  }
  if (local) lines.push({ kind: 'local', text: 'from helpers import clean' });
  for (const P of pkgs) if (calls.some((c) => c.pkg === P && !isImport(c))) lines.push({ kind: 'setup', text: P.setup });
  for (const c of calls) if (!isImport(c)) lines.push({ kind: 'call', text: c.line, call: c });
  lines.push({ kind: 'print', text: SYNTAX[syntax].print });

  // The era in which every call (and the syntax) works: the band behind the timeline.
  let lo = -Infinity;
  let hi = Infinity;
  for (const c of calls) {
    lo = Math.max(lo, c.pkg.rel[c.lo].d);
    if (c.hi < Infinity) hi = Math.min(hi, c.pkg.rel[c.hi].d);
  }
  if (SYNTAX[syntax].min > 1) lo = Math.max(lo, PY[SYNTAX[syntax].min].d);
  if (syntax === 'py2') hi = Math.min(hi, 2020);

  return {
    n,
    T,
    meta,
    pkgs,
    calls,
    syntax,
    local,
    lines,
    env: { py: envPy, v },
    window: lo < hi ? [Math.max(lo, SPAN[0]), Math.min(hi, NOW)] : null,
    id: Math.floor(u[24] * 0xffff)
      .toString(16)
      .padStart(4, '0'),
    file: FILES.find(([name]) => pkgs.some((P) => P.name === name))[1],
  };
}

const monthIndex = (d) => clamp(Math.floor((d - 2014) * 12), 0, 152);
const monthDate = (m) => 2014 + (m + 0.5) / 12;

export function create({ stage, panel, reduced }) {
  const params = { age: 5, noise: 6, budget: 12, speed: reduced ? 0 : 20, mode: 'both' };
  let seed = 17;
  let index = 0;
  let sn = null; // the snippet on the timeline
  let race = null; // the strategies' traces for it, run against one simulated clock
  let probe = null; // a date replayed by hand
  let hoverD = null; // the date under the pointer
  let batch = null;
  let showing = 'snippet';
  let hoverItem = -1;
  let flashes = [];
  let narration = { text: '', tone: INK[2] };
  let held = { until: 0, next: null }; // keeps a line up long enough to read
  const L = {};

  /* ---------------------------------------------------------------- */
  /* Snippets and the race                                            */
  /* ---------------------------------------------------------------- */

  function load(i) {
    index = i;
    sn = makeSnippet(seed, index, params);
    race = null;
    probe = null;
    flashes = [];
    showing = 'snippet';
    held = { until: 0, next: null };
    narration = {
      text: `${sn.file} is dated ${monthYear(sn.meta)}. Repair it${params.mode === 'both' ? ' to race both strategies' : ''}, or replay a date by hand.`,
      tone: INK[2],
    };
    dateSlider.set(monthIndex(sn.meta));
    rowsLayout();
    refresh();
  }

  const lane = (k) => race?.lanes.find((t) => t.key === k) || null;
  const laneKeys = () => (params.mode === 'both' ? ['base', 'replay'] : [params.mode]);

  function repair() {
    showing = 'snippet';
    probe = null;
    hoverD = null;
    const lanes = laneKeys().map((k) => (k === 'base' ? runBaseline(sn, params.budget, seed) : runReplay(sn, params.budget, seed)));
    race = { lanes, clock: 0, end: Math.max(...lanes.map((t) => t.time)), done: false };
    flashes = [];
    held = { until: 0, next: null };
    const when = monthYear(sn.meta);
    narration = {
      text:
        params.mode === 'base'
          ? 'The baseline installs today’s version of every import and runs the snippet…'
          : params.mode === 'replay'
            ? `Replay dates the snippet to ${when} and rebuilds that configuration…`
            : `Both start at once: the baseline from today’s versions, replay from ${when}.`,
      tone: C.amber,
    };
    if (params.speed === 0) finishRace();
    refresh();
  }

  function advance(dt, time) {
    if (!race || race.done) return;
    const prev = race.clock;
    race.clock = params.speed === 0 ? race.end : Math.min(race.end, race.clock + dt * params.speed);
    const events = [];
    for (const tr of race.lanes) tr.attempts.forEach((a, k) => a.t1 > prev && a.t1 <= race.clock && events.push({ tr, a, k }));
    events.sort((p, q) => p.a.t1 - q.a.t1);
    for (const ev of events) {
      // A fix stays up for a couple of seconds; failures for at least a moment.
      const line = attemptText(ev.tr, ev.a, ev.k);
      if (time < held.until) held.next = line;
      else {
        narration = line;
        held = { until: time + (ev.a.e ? 0.6 : 2.2), next: null };
      }
      flashes.push({ a: ev.a, t0: time });
    }
    if (held.next && time >= held.until) {
      narration = held.next;
      held = { until: time + 0.6, next: null };
    }
    if (race.clock >= race.end) finishRace();
  }

  function attemptText(tr, a, k) {
    const err = a.e ? `${a.e.type} — ${a.e.msg}.` : '';
    if (tr.key === 'base') {
      if (!a.e) return { text: k ? `Baseline · ${a.label.long}: it runs, on attempt ${k + 1}.` : 'Baseline · today’s versions run as they are.', tone: C.gold };
      return { text: k ? `Baseline · ${a.label.long}: ${err}` : `Installing today’s versions: ${err}`, tone: C.ember };
    }
    const when = a.date != null ? monthYear(a.date) : '';
    if (a.stage === 'replay') return { text: `Replaying the ${when} configuration: ${a.e ? err : 'it runs on the first attempt.'}`, tone: a.e ? C.ember : C.gold };
    if (a.stage === 'nearby') return a.e ? { text: `Replay · ${when}: ${err}`, tone: C.ember } : { text: `Replay · ${when} runs, on attempt ${k + 1}.`, tone: C.gold };
    const pin = a.label.long.replace('LLM: ', '');
    return a.e ? { text: `LLM fallback · ${pin}: ${err}`, tone: C.ember } : { text: `LLM fallback · ${pin}: it runs.`, tone: C.gold };
  }

  function outcome(tr) {
    if (tr.key === 'base') return tr.ok ? `the baseline fixed it on attempt ${tr.attempts.length}, after ${secs(tr.time)}` : `the baseline gave up after ${tr.attempts.length} attempts and ${secs(tr.time)}`;
    if (!tr.ok) return `replay could not fix it in ${tr.attempts.length} attempts`;
    const how = tr.source === 'replay' ? 'replay fixed it on the first attempt' : tr.source === 'nearby' ? `replay fixed it at a nearby date, attempt ${tr.attempts.length}` : `the LLM fallback fixed it on attempt ${tr.attempts.length}`;
    return `${how}, in ${secs(tr.time)}`;
  }

  function finishRace() {
    race.clock = race.end;
    race.done = true;
    held = { until: 0, next: null };
    const B = lane('base');
    const R = lane('replay');
    if (sn.local && !B?.ok && !R?.ok) {
      narration = { text: 'No configuration can fix this one: it imports helpers, a local module the gist never included.', tone: C.cream };
    } else {
      const s = [R, B].filter(Boolean).map(outcome).join('; ');
      narration = { text: `${s[0].toUpperCase()}${s.slice(1)}.`, tone: C.cream };
    }
    say.say(`Snippet ${index + 1}: ${narration.text}`);
    refresh();
  }

  function pin(d) {
    showing = 'snippet';
    probe = { d };
    hoverD = null;
    tip.hide();
    dateSlider.set(monthIndex(d));
    if (race && !race.done) return;
    const e = check(sn, resolveAt(sn, d));
    narration = e ? { text: `By hand · the ${monthYear(d)} configuration: ${e.type} — ${e.msg}.`, tone: C.ember } : { text: `By hand · the ${monthYear(d)} configuration runs.`, tone: C.gold };
  }

  /* ---------------------------------------------------------------- */
  /* The 200-snippet run                                              */
  /* ---------------------------------------------------------------- */

  function runBatch() {
    showing = 'batch';
    tip.hide();
    hoverItem = -1;
    const counts = new Map();
    const items = Array.from({ length: BATCH }, (_, i) => {
      const s = makeSnippet(seed, i, params);
      const bin = Math.floor((s.meta - SPAN[0]) / 0.5);
      const slot = counts.get(bin) || 0;
      counts.set(bin, slot + 1);
      return { i, sn: s, bin, slot, b: null, r: null };
    });
    batch = { items, done: 0, t0: performance.now(), maxSlot: Math.max(...counts.values()), budget: params.budget, seed };
    swarmLayout();
    narration = { text: `Running ${BATCH} snippets through both strategies…`, tone: C.amber };
    refresh();
  }

  // Run as many snippets as fit in ~7 ms (and the chosen pace) this frame.
  function batchStep() {
    if (!batch || batch.done >= BATCH) return;
    const start = performance.now();
    const rate = params.speed === 0 ? Infinity : params.speed > 20 ? 240 : 70;
    const allowed = Math.min(BATCH, Math.floor(((start - batch.t0) / 1000) * rate) + 1);
    while (batch.done < allowed && performance.now() - start < 7) {
      const it = batch.items[batch.done];
      const b = runBaseline(it.sn, batch.budget, batch.seed);
      const r = runReplay(it.sn, batch.budget, batch.seed);
      it.b = { ok: b.ok, time: b.time };
      it.r = { ok: r.ok, time: r.time, source: r.source };
      batch.done++;
    }
    if (batch.done >= BATCH) {
      const s = batchStats();
      if (showing === 'batch') narration = { text: `Replay resolved ${s.r} of ${BATCH} snippets, the baseline ${s.b}. Pick any dot to replay that snippet.`, tone: C.cream };
      say.say(
        `Batch of ${BATCH} snippets complete. Baseline resolved ${s.b}, replay ${s.r} (${s.replay} by replay, ${s.nearby} at a nearby date, ${s.llm} by the LLM fallback). Mean simulated time ${Math.round(s.mb)} seconds versus ${Math.round(s.mr)}.`,
      );
    }
    refresh();
  }

  function batchStats() {
    const s = { n: 0, b: 0, r: 0, bt: 0, rt: 0, replay: 0, nearby: 0, llm: 0, mb: 0, mr: 0 };
    for (const it of batch.items) {
      if (!it.b) continue;
      s.n++;
      s.b += it.b.ok;
      s.r += it.r.ok;
      s.bt += it.b.time;
      s.rt += it.r.time;
      if (it.r.ok) s[it.r.source]++;
    }
    if (s.n) {
      s.mb = s.bt / s.n;
      s.mr = s.rt / s.n;
    }
    return s;
  }

  function openItem(i) {
    load(i);
    repair();
  }

  // A slider moved: rebuild the snippet (age and date move it in time) and rerun the batch.
  function settingsChanged(snippetToo) {
    const wasBatch = showing === 'batch';
    if (snippetToo) load(index);
    else race = null;
    if (wasBatch) runBatch();
    else batch = null;
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'Old Python snippets stop running as the libraries under them change. The <strong>baseline</strong> installs today’s versions and, after each error, moves the blamed package one release. <strong>Replay-and-repair</strong> rebuilds the configuration from the snippet’s own date, tries nearby dates, and only then asks an <em>LLM</em> for a fix.',
  );
  para(
    about,
    'Rows are packages on a 2014–2026 timeline and ticks are releases. Gold spans show when each call in the snippet exists, ember dashes where it was removed; the faint band is the era when all of them exist. Replay probes are single dates (straight lines); baseline probes mix eras (zigzags).',
  );
  legend(about, [
    { color: C.gold, label: 'call exists / runs' },
    { color: C.ember, label: 'removed / fails' },
    { color: C.amber, label: 'attempt running' },
    { color: C.cream, label: 'snippet’s recorded date', shape: 'line' },
  ]);

  const controls = section(panel, 'Repair a snippet');
  const buttons = actions(controls, [
    { id: 'run', label: 'Repair snippet ▸', primary: true, onClick: () => repair() },
    { id: 'next', label: 'New snippet', onClick: () => load(index + 1) },
  ]);
  choice(controls, {
    label: 'Strategies',
    options: [
      { value: 'both', label: 'Side by side' },
      { value: 'base', label: 'Baseline' },
      { value: 'replay', label: 'Replay + LLM' },
    ],
    value: params.mode,
    onChange: (v) => {
      params.mode = v;
      race = null;
      showing = 'snippet';
      refresh();
    },
  });
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 20, label: 'Watch' },
      { value: 80, label: 'Brisk' },
      { value: 0, label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });
  const dateSlider = slider(controls, {
    label: 'Replay a date by hand',
    min: 0,
    max: 152,
    step: 1,
    value: 0,
    format: (m) => monYear(monthDate(m)),
    onInput: (m) => pin(monthDate(m)),
  });

  const bench = section(panel, 'Benchmark');
  const benchButtons = actions(bench, [
    { id: 'batch', label: `Run ${BATCH} snippets`, onClick: () => runBatch() },
    {
      id: 'reseed',
      label: 'New seed',
      onClick: () => {
        seed = (seed * 48271 + 11) % 2147483647;
        index = 0;
        settingsChanged(true);
      },
    },
  ]);
  slider(bench, {
    label: 'Typical snippet age',
    min: 1,
    max: 10,
    step: 0.5,
    value: params.age,
    format: (v) => `${v} years`,
    onInput: (v) => {
      params.age = v;
      settingsChanged(true);
    },
  });
  slider(bench, {
    label: 'Recorded date vs real date',
    min: 0,
    max: 24,
    step: 1,
    value: params.noise,
    format: (v) => (v ? `± ${v} months` : 'exact'),
    onInput: (v) => {
      params.noise = v;
      settingsChanged(true);
    },
  });
  slider(bench, {
    label: 'Attempt budget per strategy',
    min: 3,
    max: 20,
    step: 1,
    value: params.budget,
    format: (v) => `${v} tries`,
    onInput: (v) => {
      params.budget = v;
      settingsChanged(false);
    },
  });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'bRes', label: 'Baseline · result' },
    { id: 'rRes', label: 'Replay · fix source' },
    { id: 'bCost', label: 'Baseline · tries, time' },
    { id: 'rCost', label: 'Replay · tries, time' },
    { id: 'batchRes', label: 'Batch resolved · baseline vs replay', wide: true },
    { id: 'batchTime', label: 'Batch mean time · baseline vs replay', wide: true },
  ]);
  para(
    results,
    'Set the recorded date to exact and almost every replay fix comes on the first try; widen the gap to watch replay walk to nearby dates. Older snippets and a smaller budget leave the baseline out of tries long before it reaches the snippet’s era.',
    'sim-fine',
  );

  paper(panel, {
    lines: [
      'Co-authored a replay-and-repair pipeline that resolved <strong>1,500/2,891</strong> benchmark snippets versus <strong>1,169</strong> for the baseline, reducing average runtime from <strong>368.7</strong> to <strong>71.8 seconds</strong>.',
      'Historical configuration replay supplied <strong>1,495</strong> fixes; LLM fallback supplied <strong>five</strong>.',
      'Co-author · Preprint 2026.',
    ],
    links: [{ label: 'arXiv 2609.26952', href: 'https://arxiv.org/abs/2609.26952' }],
  });
  fine(
    panel,
    'The packages, their releases and APIs are invented (only Python’s release years are real), install times follow a rough cost model, and the LLM fallback is a simplified stand-in that proposes a version pin from the error message. The numbers in the readout come from this simulation, not from the paper.',
  );
  const say = live(panel);

  function refresh() {
    const B = lane('base');
    const R = lane('replay');
    const tries = (t) => t.attempts.filter((a) => a.t1 <= race.clock).length;
    const over = (t) => race.clock >= t.time;
    const cost = (t) => `${tries(t)} · ${Math.round(Math.min(race.clock, t.time))} s`;
    if (B) {
      out.set('bRes', over(B) ? (B.ok ? 'Resolved' : 'Gave up') : 'Running', over(B) ? (B.ok ? 'ok' : 'bad') : 'warn');
      out.set('bCost', cost(B));
    } else {
      out.set('bRes', '—');
      out.set('bCost', '—');
    }
    if (R) {
      const src = { replay: 'Replay', nearby: 'Nearby date', llm: 'LLM fallback' }[R.source];
      out.set('rRes', over(R) ? (R.ok ? src : 'Unresolved') : 'Running', over(R) ? (R.ok ? 'ok' : 'bad') : 'warn');
      out.set('rCost', cost(R));
    } else {
      out.set('rRes', '—');
      out.set('rCost', '—');
    }
    if (batch) {
      const s = batchStats();
      const running = s.n < BATCH;
      out.set('batchRes', s.n ? `${s.b} vs ${s.r} of ${s.n}` : '…', running ? 'warn' : 'ok');
      out.set('batchTime', s.n ? `${s.mb.toFixed(1)} s vs ${s.mr.toFixed(1)} s` : '…', running ? 'warn' : '');
    } else {
      out.set('batchRes', '—');
      out.set('batchTime', '—');
    }
    buttons.run.textContent = race && !race.done ? 'Repairing…' : race ? 'Repair again ▸' : 'Repair snippet ▸';
    buttons.run.disabled = !!race && !race.done;
    benchButtons.batch.textContent = batch && batch.done < BATCH ? `Running ${batch.done} / ${BATCH}…` : `Run ${BATCH} snippets`;
    benchButtons.batch.disabled = !!batch && batch.done < BATCH;
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const tip = hint(stage, 'Drag across the timeline to replay any date');
  const ptr = pointer(view.canvas, {
    move: (p) => {
      if (showing === 'batch') {
        hoverItem = itemAt(p.x, p.y);
        return;
      }
      const d = onTimeline(p.x, p.y) ? dateAt(p.x) : null;
      if (p.pressed && d != null) pin(d);
      else hoverD = d;
    },
    down: (p) => {
      if (showing === 'batch') {
        const i = itemAt(p.x, p.y);
        if (i >= 0) openItem(i);
      } else if (onTimeline(p.x, p.y)) pin(dateAt(p.x));
    },
    leave: () => {
      hoverD = null;
      hoverItem = -1;
    },
  });

  function layout(v) {
    const { w, h } = v;
    const c = (L.compact = w < 620 || h < 480);
    const pad = (L.pad = Math.max(16, Math.min(40, w * 0.04)));
    L.w = w;
    L.h = h;
    L.headY = 56;
    L.narrY = c ? 80 : 88;
    const top = c ? 114 : 106;
    const bottom = h - (c ? 34 : 42);
    const avail = bottom - top;
    // Short stages (a phone on its side) keep the timeline and drop the log.
    const low = avail < 250 ? 0 : clamp(avail * 0.42, c ? 128 : 150, 250);
    const gap = low ? (c ? 12 : 20) : 0;
    L.tl = { x: pad, y: top, w: w - pad * 2, h: avail - low - gap };
    L.low = { x: pad, y: top + L.tl.h + gap, w: w - pad * 2, h: low };
    L.gutter = c ? 70 : w < 900 ? 108 : 124;
    L.tx0 = pad + L.gutter;
    L.tx1 = w - pad - 4;
    L.x27 = L.tx0 - (c ? 11 : 16);
    if (c) {
      L.code = null;
      L.log = L.low;
    } else {
      const cw = Math.round(clamp(L.low.w * 0.38, 250, 380));
      L.code = { x: pad, y: L.low.y, w: cw, h: L.low.h };
      L.log = { x: pad + cw + 24, y: L.low.y, w: L.low.w - cw - 24, h: L.low.h };
    }
    // The 200-snippet view: a mirrored swarm by recorded date, then bars.
    const btop = c ? 118 : 112;
    const sw = (bottom - btop) * (c ? 0.52 : 0.58);
    L.b = { prog: btop - 6, top: btop + 4, h: sw, bars: { x: pad, y: btop + sw + (c ? 34 : 44), w: w - pad * 2, h: bottom - (btop + sw + (c ? 34 : 44)) } };
    rowsLayout();
    swarmLayout();
  }

  // Rows: the interpreter, then each imported package with a track per call it makes.
  function rowsLayout() {
    if (!sn || !L.tl) return;
    const c = L.compact;
    const head = c ? 12 : 15;
    const symH = c ? 10 : 12;
    const gap = c ? 7 : 12;
    const rows = [{ kind: 'py', n: 1 }, ...sn.pkgs.map((P) => ({ kind: 'pkg', P, n: sn.calls.filter((k) => k.pkg === P).length }))];
    const need = rows.reduce((s, r) => s + head + r.n * symH + gap, 0) - gap;
    const top = L.tl.y + (c ? 22 : 26);
    const bottom = L.tl.y + L.tl.h - (c ? 20 : 24);
    const k = clamp((bottom - top) / need, 0.6, 2);
    let y = top + Math.max(0, (bottom - top - need * k) / 2);
    for (const r of rows) {
      r.y = y + head * k;
      const tracks = r.kind === 'py' ? [{ syntax: true }] : sn.calls.filter((cl) => cl.pkg === r.P).map((call) => ({ call }));
      r.tracks = tracks.map((t, i) => ({ ...t, y: r.y + (i + 1) * symH * k }));
      y = r.y + r.n * symH * k + gap * k;
    }
    L.rows = rows;
    L.rowsTop = rows[0].y - (c ? 12 : 14);
    L.rowsBottom = rows.at(-1).tracks.at(-1).y;
  }

  function swarmLayout() {
    if (!batch || !L.b) return;
    const B = L.b;
    const binW = X(SPAN[0] + 0.5) - X(SPAN[0]);
    B.mid = B.top + B.h / 2 - 4;
    const laneH = B.h / 2 - 16;
    const n = batch.maxSlot + 1;
    let best = 0;
    for (let cols = 1; cols <= Math.max(1, Math.floor(binW / 2.5)); cols++) {
      const pitch = Math.min(binW / cols, laneH / Math.ceil(n / cols), L.compact ? 6 : 9);
      if (pitch > best + 0.01) {
        best = pitch;
        B.cols = cols;
      }
    }
    B.pitch = best;
    B.pitchX = binW / B.cols;
  }

  function X(d) {
    return L.tx0 + ((clamp(d, SPAN[0], SPAN[1]) - SPAN[0]) / (SPAN[1] - SPAN[0])) * (L.tx1 - L.tx0);
  }
  const dateAt = (x) => clamp(SPAN[0] + ((x - L.tx0) / (L.tx1 - L.tx0)) * (SPAN[1] - SPAN[0]), SPAN[0], NOW);
  const onTimeline = (x, y) => showing === 'snippet' && L.rows && x >= L.tx0 - 6 && x <= L.tx1 + 6 && y >= L.rowsTop - 16 && y <= L.rowsBottom + 12;
  const vertexX = (row, cfg) => (row.kind === 'py' ? (cfg.py === 0 ? L.x27 : X(PY[cfg.py].d)) : X(row.P.rel[cfg.v[row.P.name]].d));

  function cross(x, y, r, color, width = 1.4) {
    ctx.beginPath();
    ctx.moveTo(x - r, y - r);
    ctx.lineTo(x + r, y + r);
    ctx.moveTo(x + r, y - r);
    ctx.lineTo(x - r, y + r);
    ctx.strokeStyle = color;
    ctx.lineWidth = width;
    ctx.stroke();
  }

  // Mono text with letter-spacing: textWidth() does not count the tracking.
  const tracked = (str, size, track) => textWidth(ctx, str, { size }) + str.length * track;

  function drawHeader(title, sub, right, rightColor) {
    const x = L.pad;
    label(ctx, title, x, L.headY, { size: 11, upper: true, track: 1.6, color: C.gold });
    let end = x + tracked(title.toUpperCase(), 11, 1.6);
    if (sub) {
      label(ctx, sub, end + 10, L.headY, { size: 11, color: INK[3] });
      end += 10 + textWidth(ctx, sub, { size: 11 });
    }
    if (right && L.w - L.pad - textWidth(ctx, right, { size: 11 }) > end + 16) label(ctx, right, L.w - L.pad, L.headY, { size: 11, align: 'right', color: rightColor });
  }

  // The narration: one line on wide stages, up to two on phones.
  function drawNarration() {
    const w = L.w - L.pad * 2;
    const o = { size: L.compact ? 15 : 19, minSize: L.compact ? 11 : 12, font: 'serif', italic: true, color: narration.tone };
    if (!L.compact || textWidth(ctx, narration.text, o) <= w) {
      labelFit(ctx, narration.text, L.pad, L.narrY, w, o);
      return;
    }
    const words = narration.text.split(' ');
    let first = '';
    let i = 0;
    for (; i < words.length; i++) {
      const next = first ? `${first} ${words[i]}` : words[i];
      if (textWidth(ctx, next, o) > w) break;
      first = next;
    }
    labelFit(ctx, first, L.pad, L.narrY, w, o);
    labelFit(ctx, words.slice(i).join(' '), L.pad, L.narrY + 18, w, o);
  }

  /* ---------------------------------------------------------------- */
  /* Timeline                                                         */
  /* ---------------------------------------------------------------- */

  function drawTimeline(time) {
    const c = L.compact;
    const top = L.rowsTop - 2;
    const bot = L.rowsBottom + 6;
    const yearY = L.tl.y + L.tl.h - 4;
    for (let y = 2015; y <= 2026; y++) {
      const x = X(y);
      line(ctx, x, top, x, yearY - 11, INK.faint);
      if (!c || y % 2 === 0) label(ctx, String(y), x, yearY, { size: c ? 9 : 9.5, align: 'center', color: INK[3] });
    }
    if (sn.window) {
      const [a, b] = sn.window.map(X);
      ctx.fillStyle = alpha(C.gold, 0.07);
      ctx.fillRect(a, top, Math.max(3, b - a), bot - top);
    }
    line(ctx, X(NOW), top, X(NOW), bot, INK[4], 1, [2, 4]);
    for (const row of L.rows) drawRow(row);

    // The snippet's recorded date and, once a race ends, the date it was really written.
    const xm = X(sn.meta);
    line(ctx, xm, top, xm, bot, alpha(C.cream, 0.9), 1.2);
    const revealed = race?.done && Math.abs(X(sn.T) - xm) > 3;
    if (revealed) line(ctx, X(sn.T), top, X(sn.T), bot, alpha(C.cream, 0.5), 1, [3, 3]);

    drawProbes(time);
    const manual = hoverD ?? probe?.d;
    const tags = [];
    if (manual != null) tags.push(drawManual(manual));
    const after = !revealed || sn.T < sn.meta;
    tags.push({ text: `dated ${monYear(sn.meta)}`, x: xm + (after ? 5 : -5), align: after ? 'left' : 'right', color: C.cream });
    if (revealed) tags.push({ text: `written ${monYear(sn.T)}`, x: X(sn.T) + (after ? -5 : 5), align: after ? 'right' : 'left', color: alpha(C.cream, 0.7) });
    tags.push({ text: 'today', x: X(NOW) - 4, align: 'right', color: INK[4] });
    placeTags(tags, L.rowsTop - 8);
  }

  // Labels on one line above the rows, skipping any that would collide.
  function placeTags(tags, y) {
    const placed = [];
    for (const t of tags) {
      const w = textWidth(ctx, t.text, { size: 10 });
      let x0 = t.align === 'left' ? t.x : t.align === 'right' ? t.x - w : t.x - w / 2;
      x0 = clamp(x0, L.tl.x, L.tl.x + L.tl.w - w);
      if (placed.some(([a, b]) => x0 < b + 10 && x0 + w > a - 10)) continue;
      placed.push([x0, x0 + w]);
      label(ctx, t.text, x0, y, { size: 10, color: t.color });
    }
  }

  function drawRow(row) {
    const c = L.compact;
    const { y } = row;
    label(ctx, row.kind === 'py' ? 'python' : row.P.name, L.tl.x, y + 4, { size: c ? 10 : 11, color: C.cream });
    line(ctx, L.tx0, y, L.tx1, y, INK.line);
    const size = c ? 8.5 : 9;
    let last = -Infinity;
    const tickLabel = (text, x, color = INK[3]) => {
      const w = textWidth(ctx, text, { size });
      if (x - w / 2 < last + 5) return;
      label(ctx, text, x, y - 7, { size, align: 'center', color });
      last = x + w / 2;
    };
    if (row.kind === 'py') {
      // 2.7 stands apart: it was maintained alongside 3.x until 2020.
      line(ctx, L.x27, y - 5, L.x27, y + 1, INK[3]);
      tickLabel('2.7', L.x27);
      for (const p of PY.slice(1)) {
        line(ctx, X(p.d), y - 4, X(p.d), y, INK[3]);
        if (!c || p.i % 2 === 1) tickLabel(p.v, X(p.d));
      }
    } else {
      let first = true;
      for (const R of row.P.rel) {
        if (R.d < SPAN[0]) continue;
        const x = X(R.d);
        line(ctx, x, y - (R.major ? 6 : 3.5), x, y, R.yanked ? C.ember : R.major ? INK[3] : INK[4]);
        if (R.yanked && !c) tickLabel(`${R.v} yanked`, x, alpha(C.ember, 0.85));
        else if (R.major || first) tickLabel(R.v, x);
        first = false;
      }
    }
    for (const t of row.tracks) drawTrack(t);
  }

  // A call's track: gold while it exists, an ember dash from the release that removed it.
  function drawTrack(t) {
    const c = L.compact;
    const { y } = t;
    let from = SPAN[0];
    let to = null;
    let name;
    let after = '';
    if (t.syntax) {
      const s = SYNTAX[sn.syntax];
      name = s.track;
      if (sn.syntax === 'py2') from = null;
      else if (s.min > 1) from = PY[s.min].d;
      const ok27 = sn.syntax === 'py2' || sn.syntax === 'plain';
      if (ok27) line(ctx, L.x27 - 3, y, L.x27 + 3, y, C.gold, 2);
      else cross(L.x27, y, 2.5, C.ember, 1.2);
      if (sn.syntax === 'py2') {
        to = SPAN[0];
        after = c ? '' : 'Python 3 cannot parse it';
      }
    } else {
      const k = t.call;
      name = c ? shortName(k.name) : k.name;
      from = k.pkg.rel[k.lo].d;
      if (k.hi < Infinity) {
        to = k.pkg.rel[k.hi].d;
        after = c ? '' : `removed in ${k.pkg.rel[k.hi].v}`;
      }
    }
    const gx = L.tl.x + (c ? 5 : 10);
    labelFit(ctx, name, gx, y + 3, L.tx0 - gx - (c ? 14 : 20), { size: c ? 8.5 : 9.5, minSize: 7.5, color: INK[3] });
    line(ctx, L.tx0, y, L.tx1, y, INK.faint);
    if (from != null) line(ctx, X(from), y, to != null ? X(to) : L.tx1, y, alpha(C.gold, 0.85), c ? 1.6 : 2);
    if (to != null) {
      const x = X(to);
      line(ctx, x, y, L.tx1, y, alpha(C.ember, 0.6), 1.2, [3, 4]);
      cross(x, y, c ? 2.5 : 3, C.ember, 1.3);
      if (after) {
        const w = textWidth(ctx, after, { size: 9 });
        const left = x + 8 + w > L.tx1;
        label(ctx, after, left ? x - 8 : x + 8, y - 3.5, { size: 9, align: left ? 'right' : 'left', color: alpha(C.ember, 0.85) });
      }
    }
  }

  function drawProbes(time) {
    if (!race) return;
    for (const tr of race.lanes) {
      const seen = tr.attempts.filter((a) => a.t0 <= race.clock);
      seen.forEach((a, k) => drawProbe(tr, a, k === seen.length - 1, time));
    }
  }

  // One attempted configuration: a vertical line for a replayed date, a zigzag for a mix
  // of eras. While it installs, it draws in from the top.
  function drawProbe(tr, a, current, time) {
    const running = race.clock < a.t1;
    const p = running ? clamp((race.clock - a.t0) / a.dt) : 1;
    const col = running ? C.amber : a.e ? C.ember : C.gold;
    const pts = L.rows.map((row) => ({ x: vertexX(row, a.cfg), y: row.y }));
    const y0 = L.rowsTop - 2;
    const y1 = L.rowsBottom + 2;
    ctx.save();
    if (running) {
      ctx.beginPath();
      ctx.rect(0, 0, L.w, y0 + (y1 - y0) * p + 4);
      ctx.clip();
    }
    ctx.globalAlpha = current ? 0.95 : 0.22;
    const lw = current ? 1.5 : 1;
    if (a.date != null) {
      const x = X(a.date);
      line(ctx, x, y0, x, y1, col, lw);
      for (const q of pts) line(ctx, q.x, q.y, x, q.y, col, 1, q.x < L.tx0 ? [2, 3] : null);
    } else {
      ctx.beginPath();
      pts.forEach((q, i) => (i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y)));
      ctx.strokeStyle = col;
      ctx.lineWidth = lw;
      ctx.setLineDash(tr.key === 'base' ? [4, 3] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }
    for (const q of pts) dot(ctx, q.x, q.y, current ? 3 : 1.8, col);
    ctx.restore();
    if (!current) return;
    if (running) {
      const q = pts[Math.min(pts.length - 1, Math.floor(p * pts.length))];
      glow(ctx, q.x, q.y, 16, C.amber, reduced ? 0.4 : 0.3 + 0.2 * Math.sin(time * 9));
      return;
    }
    const fl = flashes.find((f) => f.a === a);
    const k = fl ? clamp(1 - (time - fl.t0) / 0.9) : 0;
    if (a.e && a.e.pkg) {
      const q = pts[a.e.pkg === 'py' ? 0 : 1 + sn.pkgs.indexOf(a.e.pkg)];
      if (k > 0) glow(ctx, q.x, q.y, 26, C.ember, 0.7 * k);
      cross(q.x, q.y, 5, C.ember, 1.6);
    } else if (!a.e) {
      for (const q of pts) glow(ctx, q.x, q.y, 14 + 12 * k, C.gold, 0.35 + 0.4 * k);
    }
  }

  // A date replayed by hand: its configuration, the version on each row, and the verdict.
  function drawManual(d) {
    const cfg = resolveAt(sn, d);
    const e = check(sn, cfg);
    const x = X(d);
    line(ctx, x, L.rowsTop - 2, x, L.rowsBottom + 2, alpha(C.cream, 0.8), 1, [2, 3]);
    L.rows.forEach((row) => {
      const vx = vertexX(row, cfg);
      line(ctx, vx, row.y, x, row.y, alpha(C.cream, 0.35), 1);
      dot(ctx, vx, row.y, 3.2, C.midnight, C.cream, 1.2);
      // The chosen release, written over its own tick label.
      const v = row.kind === 'py' ? PY[cfg.py].v : row.P.rel[cfg.v[row.P.name]].v;
      const w = textWidth(ctx, v, { size: 9.5 });
      ctx.fillStyle = C.midnight;
      ctx.fillRect(vx - w / 2 - 4, row.y - 18, w + 8, 12);
      label(ctx, v, vx, row.y - 8, { size: 9.5, align: 'center', color: C.cream });
    });
    return { text: `${monYear(d)} · ${e ? e.type : 'runs'}`, x, align: 'center', color: e ? C.ember : C.gold };
  }

  /* ---------------------------------------------------------------- */
  /* Code card and attempt log                                        */
  /* ---------------------------------------------------------------- */

  // The latest finished attempt of a lane.
  function shown(tr) {
    if (!tr) return null;
    let a = null;
    for (const x of tr.attempts) if (x.t1 <= race.clock) a = x;
    return a;
  }

  function lineState(a, i) {
    if (!a) return null;
    const { e } = a;
    if (!e) return 'ok';
    if (e === NODIST) return sn.lines[i].kind === 'local' ? 'bad' : 'idle';
    if (e.stage === 'resolve' || e.stage === 'build') return 'idle';
    if (e.stage === 'compile') return i === e.line ? 'bad' : 'idle';
    return i < e.line ? 'ok' : i === e.line ? 'bad' : 'idle';
  }

  function drawCode() {
    const c = L.code;
    roundRect(ctx, c.x, c.y, c.w, c.h, 12);
    ctx.fillStyle = alpha(C.midnight, 0.55);
    ctx.fill();
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    const px = 14;
    const gx = c.x + px + 3;
    const tx = c.x + px + 26;
    const head = `gist ${sn.id} · ${sn.file}`;
    label(ctx, head, tx, c.y + 21, { size: 10, color: INK[3] });
    const dated = `dated ${monYear(sn.meta)}`;
    if (tx + textWidth(ctx, `${head}   ${dated}`, { size: 10 }) < c.x + c.w - px) label(ctx, dated, c.x + c.w - px, c.y + 21, { size: 10, align: 'right', color: C.cream });
    line(ctx, c.x + px, c.y + 31, c.x + c.w - px, c.y + 31, INK.faint);

    // Gutter: one dot per strategy and line (ran, failed here, or never reached).
    const lanes = race ? race.lanes : [];
    const attempts = lanes.map(shown);
    const focus = attempts.at(-1);
    lanes.forEach((tr, j) => label(ctx, tr.key === 'base' ? 'b' : 'r', gx + j * 10, c.y + 21, { size: 9, align: 'center', color: INK[3] }));
    let idx = sn.lines.map((_, i) => i);
    let lh = Math.min(17, (c.h - 44) / idx.length);
    if (lh < 13.5) {
      idx = idx.filter((i) => sn.lines[i].kind !== 'setup');
      lh = Math.min(17, (c.h - 44) / idx.length);
    }
    const segs = idx.map((i) => segments(sn.lines[i], focus));
    const longest = Math.max(...segs.map((sg) => sg.reduce((n, [text]) => n + text.length, 0)));
    const size = Math.max(8, Math.min(11.5, lh - 3.5, (c.x + c.w - px - tx) / (longest * 0.61)));
    const cw = textWidth(ctx, 'M', { size });
    idx.forEach((i, row) => {
      const y = c.y + 38 + (row + 0.75) * lh;
      attempts.forEach((a, j) => {
        const s = lineState(a, i);
        if (s) dot(ctx, gx + j * 10, y - size * 0.32, s === 'idle' ? 1.4 : 2.2, s === 'ok' ? C.gold : s === 'bad' ? C.ember : INK[4]);
      });
      let x = tx;
      for (const [text, color] of segs[row]) {
        label(ctx, text, x, y, { size, color });
        x += text.length * cw;
      }
      if (focus && lineState(focus, i) === 'bad') line(ctx, tx, y + 3.5, Math.min(x, c.x + c.w - px), y + 3.5, alpha(C.ember, 0.6), 1);
    });
  }

  // A code line as coloured runs: calls are gold if they exist in the configuration of the
  // latest finished attempt, ember if they do not.
  function segments(ln, a) {
    if (ln.kind === 'import') return [['import ', INK[3]], [ln.pkg.name, C.cream], [` as ${ln.pkg.as}`, INK[3]]];
    if (ln.kind === 'setup') return [[ln.text, INK[3]]];
    if (ln.kind === 'local') {
      const segs = [['from ', INK[3]], ['helpers', INK[2]], [' import clean', INK[3]]];
      return L.code.w > 330 ? [...segs, ['  # not in the gist', INK[4]]] : segs;
    }
    if (ln.kind === 'print') {
      const ok = !a || !syntaxError(sn.syntax, a.cfg.py);
      return [[ln.text, !a ? C.cream : ok ? C.gold : C.ember]];
    }
    const k = ln.call;
    const at = ln.text.lastIndexOf(k.hl);
    let color = C.cream;
    if (a) {
      const v = a.cfg.v[k.pkg.name];
      color = v >= k.lo && v < k.hi ? C.gold : C.ember;
    }
    return [
      [ln.text.slice(0, at), INK[2]],
      [k.hl, color],
      [ln.text.slice(at + k.hl.length), INK[2]],
    ];
  }

  function drawLog() {
    const R = L.log;
    const keys = race ? race.lanes.map((t) => t.key) : laneKeys();
    const gap = L.compact ? 16 : 24;
    const w = (R.w - gap * (keys.length - 1)) / keys.length;
    keys.forEach((k, i) => drawLane({ x: R.x + i * (w + gap), y: R.y, w, h: R.h }, k, lane(k)));
  }

  function drawLane(rect, key, tr) {
    const c = L.compact;
    const { x, y, w, h } = rect;
    line(ctx, x, y, x + w, y, INK.line);
    label(ctx, key === 'base' ? 'Baseline' : 'Replay + LLM', x, y + 17, { size: 10, upper: true, track: 1.4, color: INK[2] });
    const finished = tr && race.clock >= tr.time;
    const col = !tr ? INK[3] : !finished ? C.amber : tr.ok ? C.gold : C.ember;
    const tries = tr ? tr.attempts.filter((a) => a.t1 <= race.clock).length : 0;
    const state = !tr
      ? 'ready'
      : !finished
        ? race.clock < tr.start
          ? 'dating the snippet'
          : `running · ${tries} ${tries === 1 ? 'try' : 'tries'}`
        : `${tr.ok ? 'resolved' : 'gave up'} · ${tries} ${tries === 1 ? 'try' : 'tries'}`;
    label(ctx, state, x, y + 32, { size: 9.5, color: col });
    label(ctx, clockText(tr ? Math.min(race.clock, tr.time) : 0), x + w, y + (c ? 26 : 30), { font: 'serif', size: c ? 22 : 30, align: 'right', color: col });

    const fs = c ? 9.5 : 10;
    const rh = c ? 14 : 15.5;
    const y0 = y + (c ? 52 : 56);
    const max = Math.max(1, Math.floor((y + h - y0) / rh) + 1);
    const cw = textWidth(ctx, '0', { size: fs });
    const rows = [];
    if (!tr) {
      // Before a run, each lane lists its plan.
      const plan =
        key === 'base'
          ? c
            ? ['today’s versions', 'error: move the', 'blamed package', `stop at ${params.budget} tries`]
            : ['today’s versions first', 'each error moves the blamed', 'package one release', `stop at ${params.budget} tries`]
          : c
            ? [`date it: ${monYear(sn.meta)}`, 'replay that era', 'then nearby dates', 'then an LLM pin']
            : [`date the snippet: ${monYear(sn.meta)}`, 'replay that era’s versions', 'then nearby dates', 'then an LLM-proposed pin'];
      plan.slice(0, max).forEach((t, i) => labelFit(ctx, `${pad2(i + 1)}  ${t}`, x, y0 + i * rh, w, { size: fs, minSize: 8, color: INK[3] }));
      return;
    }
    if (tr.key === 'replay') {
      const dating = race.clock < tr.start;
      rows.push({ num: '00', act: dating ? 'dating the snippet…' : `dated ${monYear(sn.meta)}`, res: '', time: dating ? '' : `${Math.round(tr.start)} s`, col: dating ? C.amber : INK[3] });
    }
    tr.attempts.forEach((a, k) => {
      if (a.t0 > race.clock) return;
      const running = race.clock < a.t1;
      const p = (race.clock - a.t0) / a.dt;
      rows.push({
        num: pad2(k + 1),
        act: a.label,
        res: running ? (p < 0.75 ? 'installing…' : 'running…') : a.e ? `× ${a.e.type}` : 'runs',
        time: `${Math.round(running ? race.clock - a.t0 : a.dt)} s`,
        col: running ? C.amber : a.e ? C.ember : C.gold,
      });
    });
    let list = rows;
    if (rows.length > max) {
      list = rows.slice(rows.length - (max - 1));
      label(ctx, `+ ${rows.length - list.length} earlier`, x, y0, { size: fs, color: INK[4] });
    }
    const offset = rows.length > max ? 1 : 0;
    list.forEach((r, i) => {
      const yy = y0 + (i + offset) * rh;
      const timeW = cw * 5;
      label(ctx, r.num, x, yy, { size: fs, color: INK[4] });
      label(ctx, r.time, x + w, yy, { size: fs, align: 'right', color: INK[3] });
      const resX = x + w - timeW - r.res.length * cw;
      if (r.res) label(ctx, r.res, resX, yy, { size: fs, color: r.col });
      // The action column, shortened (or dropped) to leave room for the result.
      const room = (r.res ? resX - cw : x + w - timeW) - (x + cw * 3);
      let act = typeof r.act === 'string' ? r.act : r.act.long;
      if (act.length * cw > room && typeof r.act !== 'string') act = r.act.short;
      if (act.length * cw > room) act = `${act.slice(0, Math.max(0, Math.floor(room / cw) - 1))}…`;
      if (room > cw * 7) label(ctx, act, x + cw * 3, yy, { size: fs, color: r.res ? INK[2] : r.col });
    });
  }

  /* ---------------------------------------------------------------- */
  /* Batch view                                                       */
  /* ---------------------------------------------------------------- */

  function dotPos(it, up) {
    const B = L.b;
    const x0 = X(SPAN[0] + it.bin * 0.5);
    const col = it.slot % B.cols;
    const row = Math.floor(it.slot / B.cols);
    const x = x0 + (col + 0.5) * B.pitchX;
    return [x, up ? B.mid - 6 - (row + 0.5) * B.pitch : B.mid + 18 + (row + 0.5) * B.pitch];
  }

  function itemAt(x, y) {
    if (!batch) return -1;
    let best = -1;
    let bd = Math.max(6, L.b.pitch);
    for (const it of batch.items) {
      if (!it.b) continue;
      for (const up of [true, false]) {
        const [px, py] = dotPos(it, up);
        const dd = Math.hypot(px - x, py - y);
        if (dd < bd) {
          bd = dd;
          best = it.i;
        }
      }
    }
    return best;
  }

  function drawBatch() {
    const c = L.compact;
    const B = L.b;
    const s = batchStats();
    const done = batch.done >= BATCH;
    drawHeader(`Benchmark · ${BATCH} snippets`, null, done ? `seed ${batch.seed}` : `${batch.done} / ${BATCH}`, INK[3]);
    drawNarration();
    const w = L.w - L.pad * 2;
    line(ctx, L.pad, B.prog, L.pad + w, B.prog, INK.faint, 1.4);
    line(ctx, L.pad, B.prog, L.pad + (w * batch.done) / BATCH, B.prog, done ? C.gold : C.amber, 1.4);

    // Mirrored swarm: each snippet sits at its recorded date, baseline above, replay below.
    line(ctx, L.tx0, B.mid, L.tx1, B.mid, INK.line);
    for (let y = 2015; y <= 2026; y++) if (!c || y % 2 === 0) label(ctx, String(y), X(y), B.mid + 12, { size: c ? 9 : 9.5, align: 'center', color: INK[3] });
    label(ctx, 'Baseline', L.pad, B.mid - 22, { size: 10, upper: true, track: 1.4, color: INK[2] });
    label(ctx, `${s.b} fixed`, L.pad, B.mid - 8, { size: 10, color: C.gold });
    label(ctx, c ? 'Replay' : 'Replay + LLM', L.pad, B.mid + 20, { size: 10, upper: true, track: 1.4, color: INK[2] });
    label(ctx, `${s.r} fixed`, L.pad, B.mid + 34, { size: 10, color: C.gold });
    const r = Math.max(1.1, B.pitch * 0.34);
    for (const it of batch.items) {
      if (!it.b) continue;
      const [bx, by] = dotPos(it, true);
      dot(ctx, bx, by, r, it.b.ok ? C.gold : alpha(C.ember, 0.85));
      const [rx, ry] = dotPos(it, false);
      if (!it.r.ok) dot(ctx, rx, ry, r, alpha(C.ember, 0.85));
      else if (it.r.source === 'nearby') dot(ctx, rx, ry, r * 0.8, null, C.gold, 1);
      else dot(ctx, rx, ry, r, it.r.source === 'llm' ? C.amber : C.gold);
      if (it.i === hoverItem) {
        dot(ctx, bx, by, r + 3, null, C.cream, 1);
        dot(ctx, rx, ry, r + 3, null, C.cream, 1);
      }
    }

    // Key (or, under the pointer, the snippet's own story).
    const ky = B.top + B.h + (c ? 14 : 18);
    if (hoverItem >= 0 && batch.items[hoverItem].b) {
      const it = batch.items[hoverItem];
      const rs = it.r.ok ? `replay fixed it (${{ replay: 'first try', nearby: 'nearby date', llm: 'LLM fallback' }[it.r.source]})` : 'replay could not';
      const text = `#${pad2(it.i + 1)} · dated ${monYear(it.sn.meta)} · baseline ${it.b.ok ? 'fixed it' : 'gave up'} · ${rs} · select to open`;
      labelFit(ctx, text, L.pad, ky, w, { size: 10, minSize: 8, color: C.cream });
    } else {
      let x = L.pad;
      const items = [
        [C.gold, 'fill', `replay ${s.replay}`],
        [C.gold, 'ring', `nearby date ${s.nearby}`],
        [C.amber, 'fill', `LLM fallback ${s.llm}`],
        [C.ember, 'fill', `unresolved ${s.n - s.r}`],
      ];
      for (const [color, kind, text] of items) {
        if (kind === 'ring') dot(ctx, x + 3, ky - 3.5, 2.6, null, color, 1);
        else dot(ctx, x + 3, ky - 3.5, 3, color);
        label(ctx, text, x + 11, ky, { size: c ? 9 : 10, color: INK[2] });
        x += 11 + textWidth(ctx, text, { size: c ? 9 : 10 }) + (c ? 12 : 22);
      }
    }

    // Totals as bars.
    const bb = B.bars;
    const groups = [
      { title: `Resolved, of ${BATCH}`, items: [{ label: 'baseline', value: s.b, color: INK[2] }, { label: 'replay + LLM', value: s.r, color: C.gold }], max: BATCH, format: (v) => String(v) },
      { title: 'Mean simulated time', items: [{ label: 'baseline', value: s.mb, color: INK[2] }, { label: 'replay + LLM', value: s.mr, color: C.gold }], max: Math.max(1, s.mb, s.mr) * 1.08, format: (v) => `${v.toFixed(1)} s` },
      {
        title: 'Replay fixes by source',
        items: [
          { label: 'replay', value: s.replay, color: C.gold },
          { label: 'nearby date', value: s.nearby, color: alpha(C.gold, 0.55) },
          { label: 'LLM fallback', value: s.llm, color: C.amber },
        ],
        max: Math.max(1, s.r),
        format: (v) => String(v),
      },
    ];
    if (c) {
      const shownGroups = groups.slice(0, bb.h >= 110 ? 2 : bb.h >= 56 ? 1 : 0);
      const gh = bb.h / Math.max(1, shownGroups.length);
      shownGroups.forEach((g, i) => bars(ctx, { x: bb.x, y: bb.y + i * gh, w: bb.w, h: Math.min(gh - 10, 60) }, g.items, g));
    } else {
      const gw = (bb.w - 48) / 3;
      groups.forEach((g, i) => bars(ctx, { x: bb.x + i * (gw + 24), y: bb.y, w: gw, h: Math.min(bb.h, 12 + g.items.length * 32) }, g.items, g));
    }
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    advance(dt, time);
    batchStep();
    if (race && !race.done) refresh();
    flashes = flashes.filter((f) => time - f.t0 < 1);
    view.clear();
    if (!L.tl) layout(view);
    if (showing === 'batch' && batch) {
      drawBatch();
      stat.set(L.compact ? `seed ${seed} · ${batch.done}/${BATCH}` : `seed ${seed} · batch ${batch.done}/${BATCH} · budget ${params.budget} tries · dates ± ${params.noise} mo`);
      return;
    }
    drawHeader(`Snippet ${pad2(index + 1)}`, sn.file, race?.done ? `written ${monYear(sn.T)}` : 'writing date hidden', race?.done ? C.cream : INK[3]);
    drawNarration();
    drawTimeline(time);
    if (L.low.h) {
      if (L.code) drawCode();
      drawLog();
    }
    stat.set(L.compact ? `seed ${seed} · #${pad2(index + 1)} · ${params.budget} tries` : `seed ${seed} · snippet ${pad2(index + 1)} · budget ${params.budget} tries · dates ± ${params.noise} mo`);
  });

  load(0);

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
