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

export function create() {
  return { start() {}, stop() {}, destroy() {} };
}
