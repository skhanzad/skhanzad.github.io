// AgentMesh & Folio: agent roles moving programming tasks to completion, and a
// reproducible log of every run.
//
// A batch of tasks flows through five roles. The Planner splits each task into subtasks,
// the Coder drafts it against its unit tests, the Executor runs them, the Debugger
// repairs what failed and the Reviewer approves or asks for a revision. With
// execution-driven repair the Debugger sees which tests failed and their traces; blind
// repair gets no feedback; with no repair a failing task closes as it is. The run is a
// seeded discrete-event simulation and every random draw comes from a per-task stream,
// so the same seed and settings replay the same run event for event. The log checks
// that with a digest of the whole event trace.
import {
  C,
  INK,
  alpha,
  rng,
  gauss,
  shuffle,
  clamp,
  lerp,
  easeOut,
  easeInOut,
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
  lines,
  quadAt,
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

const WIP = 5; // tasks in flight at once
const HOP = 2.5; // simulated seconds per handoff
const STAGGER = 1.2; // simulated seconds between dispatches from the queue
const EXEC_SETUP = 0.6;
const EXEC_STEP = 0.5; // simulated seconds per unit test
const HOLD = 0.9; // real seconds a narration line stays up before the next one

const ROLES = ['plan', 'code', 'exec', 'debug', 'review'];
const ROLE = {
  plan: { name: 'Planner', short: 'Plan' },
  code: { name: 'Coder', short: 'Code' },
  exec: { name: 'Executor', short: 'Exec' },
  debug: { name: 'Debugger', short: 'Debug' },
  review: { name: 'Reviewer', short: 'Review' },
};

// Per repair round: the chance to fix a failing test (lower for hard tests) and to
// break one that was passing.
const MODES = {
  exec: { label: 'Execution-driven', short: 'exec', fix: 0.64, hard: 0.25, brk: 0.03 },
  blind: { label: 'Blind', short: 'blind', fix: 0.24, hard: 0.08, brk: 0.1 },
  none: { label: 'No repair', short: 'none', fix: 0, hard: 0, brk: 0 },
};
const DASH = { exec: [], blind: [5, 4], none: [1.5, 3.5] };

const FUNCS = [
  ['parse_csv', 'parse'],
  ['merge_intervals', 'merge'],
  ['lru_cache', 'lru'],
  ['rate_limiter', 'limit'],
  ['slugify', 'slug'],
  ['topo_sort', 'topo'],
  ['diff_lines', 'diff'],
  ['flatten_json', 'flat'],
  ['roman_to_int', 'roman'],
  ['tokenize', 'tok'],
  ['chunk_text', 'chunk'],
  ['retry_backoff', 'retry'],
  ['next_cron', 'cron'],
  ['semver_cmp', 'semver'],
  ['url_join', 'url'],
  ['bloom_filter', 'bloom'],
  ['trie_insert', 'trie'],
  ['mat_mul', 'mat'],
  ['html_escape', 'esc'],
  ['dedupe_rows', 'dedupe'],
  ['round_money', 'money'],
  ['parse_date', 'date'],
  ['norm_path', 'path'],
  ['b64_encode', 'b64'],
  ['word_wrap', 'wrap'],
  ['median_stream', 'median'],
  ['ring_buffer', 'ring'],
  ['glob_match', 'glob'],
];

const CASES = [
  ['empty', 'IndexError', 'list index out of range'],
  ['none', 'TypeError', "'NoneType' object is not subscriptable"],
  ['unicode', 'UnicodeEncodeError', "can't encode '\\xe9'"],
  ['negative', 'ValueError', 'negative size'],
  ['nested', 'RecursionError', 'maximum recursion depth exceeded'],
  ['zero', 'ZeroDivisionError', 'division by zero'],
  ['dupes', 'AssertionError', 'expected 3 rows, got 4'],
  ['order', 'AssertionError', 'expected [1, 2], got [2, 1]'],
  ['bounds', 'IndexError', 'index 8 out of range'],
  ['missing', 'KeyError', "'id'"],
  ['large', 'TimeoutError', 'exceeded 2.0 s'],
  ['overflow', 'OverflowError', 'int too large to convert'],
  ['spaces', 'AssertionError', "expected 'a b', got 'a  b'"],
  ['cycle', 'RecursionError', 'maximum recursion depth exceeded'],
  ['types', 'TypeError', 'unsupported operand type(s)'],
  ['single', 'AssertionError', 'expected [5], got []'],
];

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const clock = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;
const hex = (h) => (h >>> 0).toString(16).padStart(8, '0').slice(0, 6);

// Independent random streams: one per (seed, task, purpose).
function mixSeed(a, b, c) {
  let h = Math.imul(a ^ 0x9e3779b9, 0x85ebca6b) ^ Math.imul(b + 0x632be5ab, 0xc2b2ae35) ^ Math.imul(c + 0x27d4eb2f, 0x165667b1);
  h ^= h >>> 16;
  h = Math.imul(h, 0x7feb352d);
  h ^= h >>> 15;
  h = Math.imul(h, 0x846ca68b);
  h ^= h >>> 16;
  return h >>> 0;
}

// A batch of task specs. Task i depends only on (seed, i), so a larger batch keeps the
// same first tasks and every mode sees the same work.
function makeTasks(seed, n) {
  const names = shuffle(rng(mixSeed(seed, 0, 0)), FUNCS);
  return Array.from({ length: n }, (_, i) => {
    const r = rng(mixSeed(seed, i + 1, 1));
    const d = 0.1 + 0.8 * r();
    const T = Math.round(clamp(3 + d * 4.2 + gauss(r) * 0.7, 3, 8));
    const [fn, stem] = names[i % names.length];
    const tests = shuffle(r, CASES)
      .slice(0, T)
      .map(([cs, err, msg]) => ({ name: `test_${stem}_${cs}`, err, msg, hard: r() * d }));
    const subtasks = clamp(1 + Math.round(d * 3 + (r() - 0.5)), 1, 4);
    return { id: i, label: String(i + 1).padStart(2, '0'), fn, d, T, tests, subtasks, goodPlan: r() < 0.9 - 0.5 * d };
  });
}

const passChance = (t, j, skill) => clamp(0.3 + 0.8 * skill - 0.22 * t.d - 0.15 * t.tests[j].hard + (t.goodPlan ? 0.05 : 0), 0.03, 0.98);
const approveChance = (t) => clamp(0.92 - 0.12 * t.d + (t.goodPlan ? 0.05 : -0.05), 0.6, 0.97);

/* ------------------------------------------------------------------ */
/* One run: a discrete-event simulation of the orchestration           */
/* ------------------------------------------------------------------ */

function makeRun(cfg) {
  const mode = MODES[cfg.mode];
  const tasks = makeTasks(cfg.seed, cfg.n);
  for (const t of tasks) {
    const stream = (k) => rng(mixSeed(cfg.seed, t.id + 1, k));
    Object.assign(t, {
      rCode: stream(2),
      rFix: stream(3),
      rReview: stream(4),
      rTime: stream(5),
      truth: Array(t.T).fill(false),
      known: Array(t.T).fill(null),
      was: Array(t.T).fill(null),
      flipAt: Array(t.T).fill(-1e9),
      stale: false,
      rounds: 0,
      attempts: 0,
      loc: 'queue',
      at: null,
      hop: null,
      serve: null,
      arrivedAt: 0,
      status: null,
      slot: -1,
      closeIdx: -1,
    });
  }
  const roles = Object.fromEntries(ROLES.map((k) => [k, { busy: null, queue: [] }]));
  const evq = [];
  const run = { cfg, tasks, roles, clock: 0, done: false, started: false, next: 0, inflight: 0, closed: 0, trays: { solved: 0, unsolved: 0 }, notes: [], events: 0, digest: 0x811c9dc5, lastExec: null };
  let seq = 0;
  let pending = false;
  let lastDispatch = -STAGGER;

  // FNV-1a over a canonical line per event: the run's fingerprint.
  const stamp = (str) => {
    let h = run.digest;
    for (let i = 0; i < str.length; i++) {
      h ^= str.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    run.digest = h >>> 0;
  };
  const push = (t, kind, task = null, role = null) => {
    const ev = { t, s: seq++, kind, task, role };
    let i = evq.length;
    while (i > 0 && evq[i - 1].t > t) i--;
    evq.splice(i, 0, ev);
  };
  const note = (task, text, short, tone) => run.notes.push({ id: task.id, text, short, tone });
  const failing = (t) => t.truth.reduce((n, v) => n + (v ? 0 : 1), 0);
  const name = (t) => `#${t.label} · ${t.fn}`;

  function hop(t, from, to) {
    t.loc = 'hop';
    t.at = null;
    t.hop = { from, to, t0: run.clock, t1: run.clock + HOP };
    if (to === 'solved' || to === 'unsolved') t.slot = run.trays[to]++;
    push(run.clock + HOP, 'arrive', t, to);
  }

  function pump() {
    if (pending || run.next >= cfg.n || run.inflight >= WIP) return;
    pending = true;
    push(Math.max(run.clock, lastDispatch + STAGGER), 'dispatch');
  }

  function latency(role, t) {
    const u = t.rTime();
    if (role === 'plan') return 2 + t.subtasks + 1.5 * u;
    if (role === 'code') return (t.attempts ? 0.55 : 1) * (3.5 + 1.5 * t.subtasks + 0.4 * t.T + 2 * u);
    if (role === 'exec') return EXEC_SETUP + EXEC_STEP * t.T + 0.4 * u;
    if (role === 'debug') return cfg.mode === 'exec' ? 2.6 + 0.8 * failing(t) + 1.5 * u : 3.1 + 0.4 * t.T + 1.5 * u;
    return 1.8 + 0.6 * t.subtasks + 1.2 * u;
  }

  function tryStart(role) {
    const R = roles[role];
    if (R.busy || !R.queue.length) return;
    const t = R.queue.shift();
    R.busy = t;
    t.loc = 'serve';
    t.at = role;
    const dur = latency(role, t);
    t.serve = { t0: run.clock, t1: run.clock + dur };
    if (role === 'exec') t.was = t.known.slice();
    if (role === 'debug') {
      const first = t.tests.find((_, j) => !t.truth[j]);
      if (cfg.mode === 'exec') note(t, `The Debugger reads the trace (${first.err} in ${first.name}) and patches #${t.label}.`, `Debugger reads the trace, patches #${t.label}`, C.amber);
      else note(t, `The Debugger patches #${t.label} blind: it knows tests failed, not which or why.`, `Debugger patches #${t.label} blind`, C.amber);
    }
    push(run.clock + dur, 'done', t, role);
  }

  const finish = {
    plan(t) {
      note(t, `The Planner splits ${name(t)} into ${plural(t.subtasks, 'subtask')}${t.goodPlan ? '.' : ': a rough plan.'}`, `Planner: #${t.label} → ${plural(t.subtasks, 'subtask')}`, C.cream);
      hop(t, 'plan', 'code');
    },
    code(t) {
      if (!t.attempts) t.truth = t.truth.map((_, j) => t.rCode() < passChance(t, j, cfg.skill));
      else t.truth = t.truth.map((v) => (t.rCode() < 0.05 ? false : v)); // a revision can regress
      t.stale = t.known[0] !== null;
      if (t.attempts) note(t, `The Coder revises #${t.label} as the Reviewer asked; its tests must run again.`, `Coder revises #${t.label}; tests rerun`, C.amber);
      else note(t, `The Coder drafts ${name(t)} against its ${t.T} unit tests.`, `Coder drafts #${t.label} for ${t.T} tests`, C.cream);
      t.attempts++;
      hop(t, 'code', 'exec');
    },
    exec(t) {
      t.known = t.truth.slice();
      t.stale = false;
      t.flipAt = t.known.map((_, j) => t.serve.t0 + EXEC_SETUP + EXEC_STEP * (j + 1));
      const f = failing(t);
      const fails = t.tests.filter((_, j) => !t.truth[j]);
      run.lastExec = { t, fails, passed: t.T - f, dur: run.clock - t.serve.t0, round: t.rounds };
      stamp(`x${t.id}:${t.truth.map(Number).join('')}`);
      if (!f) {
        note(t, `All ${t.T} tests pass on #${t.label}; it goes to the Reviewer.`, `#${t.label}: all ${t.T} tests pass → Reviewer`, C.gold);
        hop(t, 'exec', 'review');
      } else if (!mode.fix) {
        note(t, `No repair: #${t.label} closes with ${f} of ${t.T} tests failing.`, `No repair: #${t.label} closes, ${f} failing`, C.ember);
        hop(t, 'exec', 'unsolved');
      } else if (t.rounds >= cfg.rounds) {
        note(t, `Out of repair rounds: #${t.label} closes with ${f} of ${t.T} tests failing.`, `#${t.label} out of rounds, ${f} failing`, C.ember);
        hop(t, 'exec', 'unsolved');
      } else {
        t.rounds++;
        note(t, `#${t.label} fails ${f} of ${t.T} tests; ${fails[0].name} raised ${fails[0].err}.`, `#${t.label} fails ${f}/${t.T}: ${fails[0].err}`, C.ember);
        hop(t, 'exec', 'debug');
      }
    },
    debug(t) {
      t.truth = t.truth.map((v, j) => {
        const u = t.rFix();
        if (!v) return u < mode.fix - mode.hard * t.tests[j].hard;
        return !(u < mode.brk);
      });
      t.stale = true;
      hop(t, 'debug', 'exec');
    },
    review(t) {
      const ok = t.rReview() < approveChance(t);
      stamp(`r${t.id}:${ok ? 1 : 0}`);
      if (ok) {
        note(t, `The Reviewer approves #${t.label} ${t.rounds ? `after ${plural(t.rounds, 'repair round')}` : 'on the first try'}.`, `Reviewer approves #${t.label} (${plural(t.rounds, 'round')})`, C.gold);
        hop(t, 'review', 'solved');
      } else if (t.rounds < cfg.rounds) {
        t.rounds++;
        note(t, `The Reviewer asks for a revision of #${t.label}; back to the Coder.`, `Reviewer: revise #${t.label} → Coder`, C.amber);
        hop(t, 'review', 'code');
      } else {
        note(t, `The Reviewer still wants changes and no rounds remain: #${t.label} closes unapproved.`, `#${t.label} unapproved, no rounds left`, C.ember);
        hop(t, 'review', 'unsolved');
      }
    },
  };

  function handle(ev) {
    const t = ev.task;
    run.events++;
    stamp(`${ev.t.toFixed(4)}${ev.kind[0]}${t ? t.id : ''}${ev.role || ''}`);
    if (ev.kind === 'dispatch') {
      pending = false;
      if (run.inflight < WIP && run.next < cfg.n) {
        const task = tasks[run.next++];
        run.inflight++;
        lastDispatch = run.clock;
        hop(task, 'queue', 'plan');
      }
      pump();
    } else if (ev.kind === 'arrive') {
      t.hop = null;
      t.arrivedAt = run.clock;
      if (ev.role === 'solved' || ev.role === 'unsolved') {
        t.loc = 'tray';
        t.at = ev.role;
        t.status = ev.role;
        t.closeIdx = run.closed++;
        run.inflight--;
        pump();
      } else {
        t.loc = 'wait';
        t.at = ev.role;
        roles[ev.role].queue.push(t);
        tryStart(ev.role);
      }
    } else {
      roles[ev.role].busy = null;
      finish[ev.role](t);
      t.serve = null;
      tryStart(ev.role);
    }
  }

  // Process every event up to simulated time `until`, within a time budget (ms).
  run.advance = (until, budget = 7) => {
    const start = performance.now();
    while (evq.length && evq[0].t <= until) {
      const ev = evq.shift();
      run.clock = ev.t;
      handle(ev);
      if (performance.now() - start > budget) return;
    }
    if (!evq.length) run.done = true;
    else run.clock = until;
  };
  run.begin = () => {
    run.started = true;
    pump();
  };
  return run;
}

function stats(r) {
  let solved = 0;
  let rounds = 0;
  let pass = 0;
  let tested = 0;
  for (const t of r.tasks) {
    if (t.status) rounds += t.rounds;
    if (t.status === 'solved') solved++;
    if (t.known[0] !== null) {
      tested += t.T;
      pass += t.known.filter(Boolean).length;
    }
  }
  return {
    solved,
    closed: r.closed,
    avgRounds: r.closed ? rounds / r.closed : 0,
    passRate: tested ? pass / tested : null,
    throughput: r.closed && r.clock > 0 ? r.closed / (r.clock / 60) : 0,
  };
}

// Share of the whole batch solved within k repair rounds, for k = 0, 1, 2, …
function curveOf(r, final) {
  let kMax = r.cfg.rounds;
  if (!final) {
    kMax = 0;
    for (const t of r.tasks) if (t.loc !== 'queue') kMax = Math.max(kMax, t.rounds);
  }
  const pts = [];
  for (let k = 0; k <= kMax; k++) {
    let s = 0;
    for (const t of r.tasks) if (t.status === 'solved' && t.rounds <= k) s++;
    pts.push([k, s / r.cfg.n]);
  }
  return pts;
}

const sameCfg = (a, b) => a.seed === b.seed && a.mode === b.mode && a.skill === b.skill && a.rounds === b.rounds && a.n === b.n;

export function create({ stage, panel, reduced }) {
  const params = { mode: 'exec', skill: 0.7, rounds: 3, n: 12, speed: reduced ? 0 : 10 };
  let seed = 7;
  let run = null;
  let target = 0;
  let noteIdx = 0;
  let pendingNote = null;
  let focus = 0;
  let pinned = false;
  let narration = { text: '', short: '', tone: INK[2], at: -10 };
  let warned = false;
  let frame = 0;
  let hoverRow = -1;
  const heat = {};
  const runs = [];
  const L = {};
  const now = () => performance.now() / 1000;

  /* ---------------------------------------------------------------- */
  /* Runs                                                             */
  /* ---------------------------------------------------------------- */

  const currentCfg = () => ({ seed, mode: params.mode, skill: params.skill, rounds: params.rounds, n: params.n });

  function resetView() {
    target = 0;
    noteIdx = 0;
    pendingNote = null;
    focus = 0;
    pinned = false;
    warned = false;
    for (const k of Object.keys(heat)) delete heat[k];
  }

  function toPreview() {
    run = makeRun(currentCfg());
    resetView();
    setNarration({ text: `${run.cfg.n} tasks wait in the queue. Run the batch to watch five agent roles take them to completion.`, short: `${run.cfg.n} tasks queued. Run the batch to start.`, tone: INK[2] }, -10);
    refresh();
  }

  function startRun(cfg, of = null) {
    run = makeRun(cfg);
    run.k = runs.length + 1;
    run.of = of;
    resetView();
    run.begin();
    tip.hide();
    const m = MODES[cfg.mode];
    setNarration(
      of
        ? { text: `Replaying run #${of.k}: the same seed and settings, from a clean start…`, short: `Replaying run #${of.k}…`, tone: C.amber }
        : { text: `Run #${run.k}: ${cfg.n} tasks, ${m.label.toLowerCase()} repair, up to ${plural(cfg.rounds, 'round')} each.`, short: `Run #${run.k} · ${cfg.n} tasks · ${m.short}`, tone: C.amber },
      now(),
    );
    refresh();
  }

  function replay(entry) {
    const c = entry.cfg;
    Object.assign(params, { mode: c.mode, skill: c.skill, rounds: c.rounds, n: c.n });
    seed = c.seed;
    modeCtl.set(c.mode);
    skillCtl.set(c.skill);
    roundsCtl.set(c.rounds);
    nCtl.set(c.n);
    startRun({ ...c }, entry);
  }

  function finishRun(time) {
    const s = stats(run);
    const entry = { k: run.k, cfg: run.cfg, solved: s.solved, avg: s.avgRounds, pass: s.passRate, digest: run.digest, events: run.events, curve: curveOf(run, true), same: null, repeat: false, of: run.of };
    const twin = runs.find((e) => sameCfg(e.cfg, entry.cfg));
    if (twin) {
      entry.repeat = true;
      if (twin.digest === entry.digest && twin.events === entry.events) entry.same = twin.k;
    }
    runs.push(entry);
    run.entry = entry;
    pendingNote = null;
    if (params.speed === 0) run.revealAt = time;
    const n = run.cfg.n;
    const avg = s.avgRounds.toFixed(2);
    if (entry.same) {
      setNarration({ text: `Run #${entry.k} matched run #${entry.same} event for event: ${entry.events} events, digest ${hex(entry.digest)}.`, short: `Matched run #${entry.same} exactly · ${hex(entry.digest)}`, tone: C.gold }, time);
    } else if (entry.repeat) {
      setNarration({ text: `Run #${entry.k} did not reproduce run #${twin.k}.`, short: `Did not reproduce run #${twin.k}`, tone: C.ember }, time);
    } else {
      setNarration({ text: `Run #${entry.k} complete: ${s.solved} of ${n} solved, ${avg} repair rounds on average. Logged with digest ${hex(entry.digest)}.`, short: `Run #${entry.k}: ${s.solved}/${n} solved · ${avg} rounds avg`, tone: C.cream }, time);
    }
    say.say(
      `Run ${entry.k} complete. ${s.solved} of ${n} tasks solved with ${MODES[run.cfg.mode].label.toLowerCase()} repair, ${avg} repair rounds on average, ${fmt.pct(s.passRate ?? 0, 0)} of tests passing.${entry.same ? ` Identical to run ${entry.same}.` : ''}`,
    );
    refresh();
  }

  function setParam(key, value) {
    params[key] = value;
    if (!run.started) toPreview();
    else if (!run.done && !warned) {
      warned = true;
      setNarration({ text: 'New settings apply to the next run; this one keeps its own so it stays reproducible.', short: 'Settings apply to the next run.', tone: INK[2] }, now());
    }
    refresh();
  }

  function nextSeed(s) {
    return 1 + Math.floor(rng(mixSeed(s, 99, 7))() * 9999);
  }

  /* ---------------------------------------------------------------- */
  /* Narration                                                        */
  /* ---------------------------------------------------------------- */

  function setNarration(n, time) {
    narration = { text: n.text, short: n.short || n.text, tone: n.tone, at: time };
  }

  function describe(t) {
    const name = `#${t.label} · ${t.fn}`;
    if (t.status === 'solved') return { text: `${name}: solved after ${plural(t.rounds, 'repair round')}; all ${t.T} tests pass.`, short: `#${t.label} solved · ${plural(t.rounds, 'round')}`, tone: C.gold };
    if (t.status === 'unsolved') {
      const f = t.known.filter((v) => !v).length;
      return { text: `${name}: unsolved after ${plural(t.rounds, 'round')}; ${f} of ${t.T} tests still fail.`, short: `#${t.label} unsolved · ${f}/${t.T} failing`, tone: C.ember };
    }
    if (t.loc === 'queue') return { text: `${name} waits in the queue: ${t.T} unit tests, difficulty ${t.d.toFixed(2)}.`, short: `#${t.label} queued · ${t.T} tests`, tone: INK[2] };
    if (t.loc === 'serve') return { text: `The ${ROLE[t.at].name} is working on ${name}.`, short: `${ROLE[t.at].name} on #${t.label}`, tone: C.amber };
    if (t.loc === 'wait') return { text: `${name} waits for the ${ROLE[t.at].name}.`, short: `#${t.label} waits for the ${ROLE[t.at].short}`, tone: INK[2] };
    const to = t.hop.to === 'solved' || t.hop.to === 'unsolved' ? 'its tray' : `the ${ROLE[t.hop.to].name}`;
    return { text: `${name} is on its way to ${to}.`, short: `#${t.label} → ${to}`, tone: INK[2] };
  }

  function follow(id, time) {
    focus = id;
    const notes = run.notes;
    noteIdx = notes.length;
    pendingNote = null;
    setNarration(describe(run.tasks[id]), time);
  }

  // The narration follows one task at a time; it moves on when that task closes.
  function pullNotes(time) {
    const notes = run.notes;
    for (; noteIdx < notes.length; noteIdx++) if (notes[noteIdx].id === focus) pendingNote = notes[noteIdx];
    if (pendingNote && (params.speed === 0 || time - narration.at >= HOLD)) {
      setNarration(pendingNote, time);
      pendingNote = null;
    }
    const f = run.tasks[focus];
    if (f && f.status && !pendingNote && time - narration.at >= HOLD * (pinned ? 2.4 : 1.4)) {
      let next = null;
      for (const t of run.tasks) if (t.loc !== 'queue' && !t.status && (!next || t.id < next.id)) next = t;
      if (next) {
        pinned = false;
        focus = next.id;
        const own = notes.filter((n) => n.id === next.id).pop();
        setNarration(own || describe(next), time);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'Five agent roles move a batch of programming tasks to completion. The <strong>Planner</strong> splits each task, the <strong>Coder</strong> drafts it, the <strong>Executor</strong> runs its unit tests, the <strong>Debugger</strong> repairs failures and the <strong>Reviewer</strong> approves or sends it back.',
  );
  para(
    about,
    'Each card is a task and its dots are unit tests. With <em>execution-driven repair</em> the Debugger reads which tests failed and why; blind repair gets no feedback. Every run is seeded and logged with a digest of its events, so a replay can be checked against the original.',
  );
  legend(about, [
    { color: C.gold, label: 'test passing / solved' },
    { color: C.ember, label: 'test failing / unsolved' },
    { color: C.amber, label: 'agent at work' },
    { color: C.cream, label: 'test not yet run', shape: 'ring' },
    { color: C.cream, label: 'this run', shape: 'line' },
    { color: INK[4], label: 'earlier runs', shape: 'line' },
  ]);

  const controls = section(panel, 'Run the batch');
  const buttons = actions(controls, [
    { id: 'run', label: 'Run batch ▸', primary: true, onClick: () => startRun(currentCfg()) },
    { id: 'replay', label: 'Replay run', onClick: () => runs.length && replay(runs[runs.length - 1]) },
    {
      id: 'reseed',
      label: 'New seed',
      onClick: () => {
        seed = nextSeed(seed);
        toPreview();
      },
    },
  ]);
  const modeCtl = choice(controls, {
    label: 'Repair mode',
    options: [
      { value: 'exec', label: 'Execution-driven' },
      { value: 'blind', label: 'Blind' },
      { value: 'none', label: 'No repair' },
    ],
    value: params.mode,
    onChange: (v) => setParam('mode', v),
  });
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 3.5, label: 'Watch' },
      { value: 10, label: 'Brisk' },
      { value: 0, label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });

  const agents = section(panel, 'Agents and batch');
  const skillCtl = slider(agents, {
    label: 'Coder skill',
    min: 0.3,
    max: 0.95,
    step: 0.05,
    value: params.skill,
    format: (v) => v.toFixed(2),
    onInput: (v) => setParam('skill', Math.round(v * 100) / 100),
  });
  const roundsCtl = slider(agents, {
    label: 'Max repair rounds per task',
    min: 0,
    max: 6,
    step: 1,
    value: params.rounds,
    onInput: (v) => setParam('rounds', v),
  });
  const nCtl = slider(agents, {
    label: 'Tasks in batch',
    min: 6,
    max: 24,
    step: 1,
    value: params.n,
    onInput: (v) => setParam('n', v),
  });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'solved', label: 'Solved' },
    { id: 'rounds', label: 'Avg repair rounds' },
    { id: 'pass', label: 'Tests passing' },
    { id: 'thru', label: 'Tasks per sim minute' },
    { id: 'runs', label: 'Runs logged' },
    { id: 'match', label: 'Replays identical' },
  ]);
  para(
    results,
    'Keep the seed and switch the repair mode to compare modes on the very same tasks; earlier runs stay on the chart, dimmer. Replay a run and the log checks that it matched.',
    'sim-fine',
  );

  paper(panel, {
    title: 'From the projects',
    lines: [
      'Created <strong>AgentMesh</strong>, a Python prototype coordinating planning, coding, debugging, and review with <strong>execution-driven repair</strong>.',
      'Built <strong>Folio</strong>, an experimental paper-review application with PDF ingestion, live rescoring, and a <strong>reproducible classifier-evaluation workflow</strong>.',
      'Independent projects · 2025–2026.',
    ],
    links: [
      { label: 'AgentMesh · arXiv 2507.19902', href: 'https://arxiv.org/abs/2507.19902' },
      { label: 'Folio · GitHub', href: 'https://github.com/skhanzad/Folio' },
    ],
  });
  fine(
    panel,
    'The agents are small stochastic stand-ins, not language models: their pass, fix and approval rates and every latency are illustrative. All numbers here come from this simulation, not from AgentMesh or Folio.',
  );
  const say = live(panel);

  function refresh() {
    const s = stats(run);
    const n = run.cfg.n;
    const running = run.started && !run.done;
    const rate = s.solved / n;
    out.set('solved', run.started ? `${s.solved} / ${n}` : '—', run.done ? (rate >= 0.7 ? 'ok' : rate >= 0.4 ? 'warn' : 'bad') : '');
    out.set('rounds', s.closed ? s.avgRounds.toFixed(2) : '—');
    out.set('pass', s.passRate == null ? '—' : fmt.pct(s.passRate, 0), s.passRate == null ? '' : s.passRate >= 0.9 ? 'ok' : s.passRate >= 0.6 ? 'warn' : 'bad');
    out.set('thru', s.closed ? s.throughput.toFixed(1) : '—');
    out.set('runs', String(runs.length));
    const repeats = runs.filter((e) => e.repeat);
    const same = repeats.filter((e) => e.same).length;
    out.set('match', repeats.length ? `${same} / ${repeats.length}` : '—', repeats.length ? (same === repeats.length ? 'ok' : 'bad') : '');
    buttons.run.textContent = running ? 'Running…' : run.done ? 'Run again ▸' : 'Run batch ▸';
    buttons.run.disabled = running;
    buttons.replay.disabled = !runs.length;
    buttons.replay.textContent = runs.length ? `Replay run #${runs[runs.length - 1].k}` : 'Replay run';
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const verb = window.matchMedia('(pointer: coarse)').matches ? 'Tap' : 'Click';
  const tip = hint(stage, `${verb} a task to follow it`);
  const ptr = pointer(view.canvas, {
    down: (p) => {
      const row = (L.rows || []).find((r) => inside(p, r));
      if (row) {
        tip.hide();
        replay(row.entry);
        return;
      }
      const t = hitTask(p.x, p.y);
      if (t) {
        tip.hide();
        pinned = true;
        follow(t.id, now());
      }
    },
    move: (p) => {
      hoverRow = (L.rows || []).findIndex((r) => inside(p, r));
      view.canvas.style.cursor = hoverRow >= 0 || hitTask(p.x, p.y) ? 'pointer' : '';
    },
    leave: () => {
      hoverRow = -1;
    },
  });

  const inside = (p, r) => p.x >= r.x && p.x <= r.x + r.w && p.y >= r.y && p.y <= r.y + r.h;

  function hitTask(x, y) {
    const hits = L.hits || [];
    for (let i = hits.length - 1; i >= 0; i--) if (inside({ x, y }, hits[i])) return run.tasks[hits[i].id];
    return null;
  }

  function layout(v) {
    const w = v.w;
    const h = v.h;
    L.compact = w < 620 || h < 480;
    L.narrow = w < 540;
    L.big = !L.compact && h >= 640 && w >= 900;
    const k = L.big ? clamp(Math.min(w / 1050, h / 740), 1, 1.25) : 1; // grow a little on large stages
    const pad = Math.max(16, Math.min(40, w * 0.04));
    L.pad = pad;
    L.kickerY = L.compact ? 60 : 64;
    L.narrY = L.compact ? 84 : 96;
    const top = L.narrY + (L.compact ? 12 : 22);
    const bottom = h - (L.compact ? 32 : 44);
    const gap = L.compact ? 12 : 24;
    const avail = bottom - top;
    const stripH = clamp(avail * 0.36, L.compact ? 112 : 140, 230 * k);
    const m = { x: pad, y: top, w: w - pad * 2, h: avail - stripH - gap };
    L.mesh = m;
    const cw = Math.round((w - pad * 2 - gap) * 0.54);
    L.chart = { x: pad, y: m.y + m.h + gap, w: cw, h: stripH };
    L.log = { x: pad + cw + gap, y: L.chart.y, w: w - pad * 2 - cw - gap, h: stripH };

    // Cards, stations and the grid they sit on.
    L.tok = L.big ? { step: 8 * k, r: 2.9 * k, h: 32 * k, id: 10.5 * k, pad: 12 * k, minW: 40 * k } : { step: 5.2, r: 2, h: 22, id: 8.5, pad: 8, minW: 28 };
    const band = L.big ? 18 * k : 14;
    const padB = L.big ? 8 * k : 6;
    L.st = { w: Math.round(8 * L.tok.step + L.tok.pad + (L.big ? 12 * k : 10)), h: band + L.tok.h + padB, band, slot: (band - padB) / 2 };
    const st = L.st;
    const trayH = clamp(m.h * 0.27, 44, 96);
    const yA = m.y + st.h / 2 + (L.compact ? 6 : 10);
    const yC = m.y + m.h - trayH / 2;
    const yB = (yA + yC) / 2;
    const xs = [0.09, 0.36, 0.63, 0.89].map((u) => m.x + m.w * u);
    const colGap = xs[1] - xs[0];
    const node = (x, y, ww = st.w, hh = st.h) => ({ x, y, w: ww, h: hh });
    L.nodes = {
      plan: node(xs[1], yA),
      code: node(xs[2], yA),
      debug: node(xs[1], yB),
      exec: node(xs[2], yB),
      review: node(xs[3], yB),
    };
    const qW = Math.min(L.big ? 150 : 96, xs[1] - st.w / 2 - (L.big ? 60 : 26) - m.x);
    const qH = st.h + (L.big ? 36 : 22);
    const qx = Math.max(m.x + qW / 2, xs[0]);
    L.nodes.queue = node(qx, Math.max(yA, m.y - 2 + qH / 2), qW, qH);
    const tW = Math.min(L.big ? 180 : 110, colGap - 18, 2 * (m.x + m.w - xs[3]) - 2);
    L.nodes.unsolved = node(xs[2], yC, tW, trayH);
    L.nodes.solved = node(xs[3], yC, tW, trayH);
    L.trace = { x: m.x, y: yC - trayH / 2, w: xs[1] + st.w / 2 - m.x, h: trayH };
    L.lane = L.big ? 7 : 5;
    L.grids = {};

    // Edges with their bends; arrowheads sit where each curve meets its target.
    L.edges = [
      { a: 'queue', b: 'plan', bend: -0.12 },
      { a: 'plan', b: 'code', bend: -0.12 },
      { a: 'code', b: 'exec', bend: 0.1 },
      { a: 'exec', b: 'debug', lane: 1, bend: 0.14, tone: 'trace' },
      { a: 'debug', b: 'exec', lane: 1, bend: 0.14, tone: 'patch' },
      { a: 'exec', b: 'review', bend: -0.1, tone: 'pass', note: 'all pass' },
      { a: 'review', b: 'code', corner: true, tone: 'revise', note: 'revise' },
      { a: 'review', b: 'solved', bend: -0.12, tone: 'pass', note: 'approve' },
      { a: 'exec', b: 'unsolved', bend: 0.12, tone: 'fail', note: 'out of rounds' },
      { a: 'review', b: 'unsolved', bend: -0.12, tone: 'fail' },
    ].map((e) => {
      const pts = curve(e, L.nodes[e.a], L.nodes[e.b]);
      return { ...e, key: `${e.a}>${e.b}`, pts, ...visible(pts, L.nodes[e.a], L.nodes[e.b]) };
    });
  }

  function curve(e, p, q) {
    let [x1, y1, x2, y2] = [p.x, p.y, q.x, q.y];
    const len = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / len;
    const ny = (x2 - x1) / len;
    if (e.lane) {
      x1 += nx * L.lane;
      y1 += ny * L.lane;
      x2 += nx * L.lane;
      y2 += ny * L.lane;
    }
    if (e.corner) return [x1, y1, x1, y2, x2, y2];
    const b = (e.bend || 0) * len;
    return [x1, y1, (x1 + x2) / 2 + nx * b, (y1 + y2) / 2 + ny * b, x2, y2];
  }

  // The stretch of a curve between its two boxes, and the arrow where it meets the target.
  function visible(pts, A, B) {
    const inBox = (P, [x, y]) => Math.abs(x - P.x) <= P.w / 2 + 3 && Math.abs(y - P.y) <= P.h / 2 + 3;
    const N = 80;
    let t0 = 0;
    let t1 = 1;
    while (t0 < 1 && inBox(A, quadAt(...pts, t0))) t0 += 1 / N;
    while (t1 > t0 && inBox(B, quadAt(...pts, t1))) t1 -= 1 / N;
    const path = Array.from({ length: 25 }, (_, i) => quadAt(...pts, lerp(t0, t1, i / 24)));
    const [ax, ay] = path[23];
    const [bx, by] = path[24];
    return { path, tip: { x: bx, y: by, a: Math.atan2(by - ay, bx - ax) } };
  }

  // Cells of the queue and the trays: the largest grid of mini-cards that fits n.
  function grid(key, n) {
    const id = `${key}:${n}`;
    if (L.grids[id]) return L.grids[id];
    const B = L.nodes[key];
    const head = L.big ? 22 : 15;
    const inset = L.big ? 10 : 6;
    const iw = B.w - inset * 2;
    const ih = B.h - head - inset;
    const gap = L.big ? 4 : 2;
    let best = null;
    for (let cols = 1; cols <= n; cols++) {
      const rows = Math.ceil(n / cols);
      let cw = (iw - gap * (cols - 1)) / cols;
      let ch = (ih - gap * (rows - 1)) / rows;
      if (cw <= 0 || ch <= 0) continue;
      if (cw / ch > 1.5) cw = ch * 1.5;
      else ch = cw / 1.5;
      if (!best || cw * ch > best.cw * best.ch) best = { cols, rows, cw, ch, gap };
    }
    const gw = best.cols * best.cw + (best.cols - 1) * gap;
    const gh = best.rows * best.ch + (best.rows - 1) * gap;
    best.x0 = B.x - gw / 2;
    best.y0 = B.y - B.h / 2 + head + (ih - gh) / 2;
    L.grids[id] = best;
    return best;
  }

  function cell(key, i, n) {
    const g = grid(key, n);
    const c = i % g.cols;
    const r = Math.floor(i / g.cols);
    return { x: g.x0 + c * (g.cw + g.gap), y: g.y0 + r * (g.ch + g.gap), w: g.cw, h: g.ch };
  }

  const tokenW = (t) => Math.max(L.tok.minW, t.T * L.tok.step + L.tok.pad);
  const slot = (key) => ({ x: L.nodes[key].x, y: L.nodes[key].y + L.st.slot });
  const settle = (dt) => easeOut(clamp(dt / (0.3 * Math.max(1, params.speed || 1))));

  // Where a node sits for a given task: its own cell on a board, or a station's slot.
  function anchor(key, t) {
    if (key === 'queue') {
      const c = cell('queue', t.id, run.cfg.n);
      return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
    }
    if (key === 'solved' || key === 'unsolved') {
      const c = cell(key, t.slot, run.cfg.n);
      return { x: c.x + c.w / 2, y: c.y + c.h / 2 };
    }
    return slot(key);
  }

  // The k-th card waiting behind a station peeks out above its top edge.
  function waitPos(key, k) {
    const S = L.nodes[key];
    const j = Math.min(k, 3);
    return { x: S.x + 5 + 4 * j, y: S.y - S.h / 2 + L.tok.h / 2 - 4 - 3.5 * j };
  }

  // Position, scale and layer of a task card this frame (null when it is a cell).
  function place(t) {
    const c = run.clock;
    if (t.loc === 'hop') {
      const { from, to } = t.hop;
      const e = L.edges.find((E) => E.a === from && E.b === to);
      const u = clamp((c - t.hop.t0) / (t.hop.t1 - t.hop.t0));
      const [x, y] = quadAt(...curve(e, anchor(from, t), anchor(to, t)), easeInOut(u));
      let scale = 1;
      if (from === 'queue') scale = Math.min(1, 0.35 + u * 1.6);
      if (to === 'solved' || to === 'unsolved') scale = Math.min(1, 0.35 + (1 - u) * 1.6);
      // A card bound for a busy station slides in under it, onto the waiting stack.
      let over = true;
      const R = run.roles[to];
      if (R && R.busy) {
        const S = L.nodes[to];
        over = Math.abs(x - S.x) >= (S.w + tokenW(t) * scale) / 2 || Math.abs(y - S.y) >= (S.h + L.tok.h * scale) / 2;
      }
      return { x, y, scale, over, edge: e.key };
    }
    if (t.loc === 'wait') return { ...waitPos(t.at, run.roles[t.at].queue.indexOf(t)), scale: 1, over: false, sliver: true };
    if (t.loc === 'serve') {
      // Taken off the stack, the card settles into the slot as the previous one leaves.
      const fade = t.serve.t0 > t.arrivedAt + 1e-6 ? settle(c - t.serve.t0) : 1;
      return { ...slot(t.at), scale: 1, over: true, fade };
    }
    return null;
  }

  /* ---------------------------------------------------------------- */
  /* Drawing                                                          */
  /* ---------------------------------------------------------------- */

  function drawHeader() {
    const x = L.pad;
    const w = view.w - L.pad * 2;
    const c = run.cfg;
    let left;
    if (!run.started) left = L.compact ? `Batch · ${c.n} tasks` : `Batch · ${c.n} tasks · seed ${c.seed}`;
    else if (L.compact) left = `Run #${run.k} · ${MODES[c.mode].short}${run.of ? ` · replay` : ''}`;
    else left = `Run #${run.k} · ${MODES[c.mode].label}${run.of ? ` · replay of #${run.of.k}` : ''}`;
    label(ctx, left, x, L.kickerY, { size: 11, upper: true, track: 1.6, color: C.gold });
    const next = currentCfg();
    const diff = [];
    if (run.started) {
      if (next.mode !== c.mode) diff.push(MODES[next.mode].short);
      if (next.skill !== c.skill) diff.push(`skill ${next.skill.toFixed(2)}`);
      if (next.rounds !== c.rounds) diff.push(`≤${next.rounds} rounds`);
      if (next.n !== c.n) diff.push(`${next.n} tasks`);
      if (next.seed !== c.seed) diff.push(`seed ${next.seed}`);
    }
    let right = '';
    let tone = INK[3];
    if (diff.length) {
      right = `${L.compact ? 'next' : 'next run'}: ${diff.join(' · ')}`;
      tone = C.amber;
    } else if (run.tasks[focus] && ((run.started && !run.done) || pinned)) {
      const t = run.tasks[focus];
      right = L.compact ? `following #${t.label}` : `following #${t.label} · ${t.fn}`;
    }
    const lw = textWidth(ctx, left.toUpperCase(), { size: 11 }) + left.length * 1.6;
    if (right && lw + textWidth(ctx, right, { size: 10.5 }) + 24 < w) label(ctx, right, x + w, L.kickerY, { size: 10.5, align: 'right', color: tone });
    const text = L.narrow ? narration.short : narration.text;
    labelFit(ctx, text, x, L.narrY, w, { size: L.compact ? 16 : 19, minSize: L.compact ? 11 : 12, font: 'serif', italic: true, color: narration.tone });
  }

  function edgeColor(e) {
    const mode = run.cfg.mode;
    if (e.tone === 'trace') return mode === 'exec' ? C.amber : C.cream;
    if (e.tone === 'patch' || e.tone === 'revise') return C.amber;
    if (e.tone === 'pass') return C.gold;
    if (e.tone === 'fail') return C.ember;
    return C.cream;
  }

  function drawEdges(dt) {
    const off = run.cfg.mode === 'none';
    for (const e of L.edges) {
      const dead = off && (e.a === 'debug' || e.b === 'debug');
      const hk = heat[e.key] || 0;
      const col = edgeColor(e);
      const a = dead ? 0.07 : 0.16 + 0.42 * hk;
      const stroke = hk > 0.02 && !dead ? alpha(col, a) : alpha(C.cream, dead ? 0.07 : 0.16);
      ctx.beginPath();
      e.path.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y)));
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1.2 + 0.4 * hk;
      ctx.setLineDash(dead ? [2, 5] : e.tone === 'trace' && run.cfg.mode === 'blind' ? [4, 4] : []);
      ctx.stroke();
      ctx.setLineDash([]);
      {
        const s = L.big ? 6 : 5;
        const { x, y, a: ang } = e.tip;
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.lineTo(x - s * Math.cos(ang - 0.45), y - s * Math.sin(ang - 0.45));
        ctx.lineTo(x - s * Math.cos(ang + 0.45), y - s * Math.sin(ang + 0.45));
        ctx.closePath();
        ctx.fillStyle = hk > 0.02 && !dead ? alpha(col, 0.3 + 0.6 * hk) : alpha(C.cream, dead ? 0.1 : 0.3);
        ctx.fill();
      }
      heat[e.key] = Math.max(0, hk - dt * 1.6);
    }
  }

  function drawEdgeNotes() {
    if (L.compact) {
      const e = L.edges.find((E) => E.key === 'review>code');
      const [x, y] = e.path[12];
      label(ctx, 'revise', x + 6, y - 4, { size: 9, color: INK[4] });
      return;
    }
    for (const e of L.edges) {
      if (!e.note) continue;
      const [x, y] = e.path[12];
      let text = e.note;
      if (e.key === 'exec>unsolved' && run.cfg.mode === 'none') text = 'no repair';
      if (e.key === 'exec>review') label(ctx, text, x, y - 9, { size: 9.5, align: 'center', color: INK[4] });
      else if (e.key === 'review>code') label(ctx, text, x + 10, y - 6, { size: 9.5, color: INK[4] });
      else if (e.key === 'review>solved') label(ctx, text, x + 9, y + 3, { size: 9.5, color: INK[4] });
      else label(ctx, text, x - 9, y + 3, { size: 9.5, align: 'right', color: INK[4] });
    }
  }

  function board(key, title, count, tone) {
    const B = L.nodes[key];
    roundRect(ctx, B.x - B.w / 2, B.y - B.h / 2, B.w, B.h, L.big ? 12 : 9);
    ctx.fillStyle = alpha(C.midnight, 0.85);
    ctx.fill();
    ctx.strokeStyle = tone ? alpha(tone, 0.4) : alpha(C.cream, 0.22);
    ctx.lineWidth = 1;
    ctx.stroke();
    const ty = B.y - B.h / 2 + (L.big ? 14 : 10.5);
    const inset = L.big ? 10 : 6;
    label(ctx, title, B.x - B.w / 2 + inset, ty, { size: L.big ? 10 : 8.5, upper: true, track: L.big ? 1.4 : 0.8, color: tone || INK[3] });
    label(ctx, String(count), B.x + B.w / 2 - inset, ty, { size: L.big ? 11 : 9, align: 'right', color: tone || INK[2] });
  }

  function miniCard(c, t, fill, stroke, text, ring) {
    roundRect(ctx, c.x, c.y, c.w, c.h, Math.min(3, c.h / 3));
    if (fill) {
      ctx.fillStyle = fill;
      ctx.fill();
    }
    if (stroke) {
      ctx.strokeStyle = stroke;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (c.h >= 11 && c.w >= 18) label(ctx, t.label, c.x + c.w / 2, c.y + c.h / 2 + 0.5, { size: Math.min(10, c.h * 0.62), align: 'center', baseline: 'middle', color: text });
    if (ring && t.id === focus && ((run.started && !run.done) || pinned)) {
      roundRect(ctx, c.x - 2.5, c.y - 2.5, c.w + 5, c.h + 5, 4);
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
  }

  function drawBoards(time) {
    const n = run.cfg.n;
    const waiting = run.tasks.filter((t) => t.loc === 'queue').length;
    board('queue', 'Queue', waiting);
    for (const t of run.tasks) {
      const c = cell('queue', t.id, n);
      if (t.loc === 'queue') {
        miniCard(c, t, alpha(C.cream, 0.12), alpha(C.cream, 0.45), INK[2], true);
        L.hits.push({ ...c, id: t.id });
      } else miniCard(c, t, null, alpha(C.cream, 0.1), INK[4], false);
    }
    for (const key of ['solved', 'unsolved']) {
      const tone = key === 'solved' ? C.gold : C.ember;
      const shown = run.tasks.filter((t) => t.loc === 'tray' && t.at === key && (!run.revealAt || time >= run.revealAt + t.closeIdx * 0.035));
      board(key, L.compact ? key : key === 'solved' ? 'Solved' : 'Unsolved', shown.length, tone);
      for (const t of shown) {
        const c = cell(key, t.slot, n);
        miniCard(c, t, alpha(tone, 0.85), null, C.midnight, true);
        L.hits.push({ ...c, id: t.id });
      }
    }
  }

  function glyph(key, x, y, color) {
    const s = L.big ? 1 : 0.78;
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    if (key === 'plan') {
      for (let i = 0; i < 3; i++) {
        ctx.moveTo(x - 7 * s + i * 3 * s, y + (i - 1) * 5 * s);
        ctx.lineTo(x + 7 * s, y + (i - 1) * 5 * s);
      }
    } else if (key === 'code') {
      ctx.moveTo(x - 4 * s, y - 5 * s);
      ctx.lineTo(x - 9 * s, y);
      ctx.lineTo(x - 4 * s, y + 5 * s);
      ctx.moveTo(x + 4 * s, y - 5 * s);
      ctx.lineTo(x + 9 * s, y);
      ctx.lineTo(x + 4 * s, y + 5 * s);
      ctx.moveTo(x + 2 * s, y - 6 * s);
      ctx.lineTo(x - 2 * s, y + 6 * s);
    } else if (key === 'exec') {
      ctx.moveTo(x - 4 * s, y - 6 * s);
      ctx.lineTo(x + 6 * s, y);
      ctx.lineTo(x - 4 * s, y + 6 * s);
      ctx.closePath();
    } else if (key === 'debug') {
      ctx.arc(x, y, 5 * s, 0, Math.PI * 2);
      for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        ctx.moveTo(x + dx * 7 * s, y + dy * 7 * s);
        ctx.lineTo(x + dx * 10 * s, y + dy * 10 * s);
      }
    } else {
      ctx.moveTo(x - 7 * s, y);
      ctx.lineTo(x - 2 * s, y + 5 * s);
      ctx.lineTo(x + 8 * s, y - 6 * s);
    }
    ctx.stroke();
  }

  function drawStation(key, time) {
    const S = L.nodes[key];
    const R = run.roles[key];
    const busy = R.busy;
    const off = key === 'debug' && run.cfg.mode === 'none';
    const x0 = S.x - S.w / 2;
    const y0 = S.y - S.h / 2;
    if (busy) glow(ctx, S.x, S.y, S.w * 0.95, C.amber, reduced ? 0.2 : 0.18 + 0.05 * Math.sin(time * 3));
    roundRect(ctx, x0, y0, S.w, S.h, L.big ? 12 : 9);
    ctx.fillStyle = alpha(C.midnight, 0.94);
    ctx.fill();
    ctx.strokeStyle = busy ? alpha(C.amber, 0.9) : off ? alpha(C.cream, 0.14) : alpha(C.cream, 0.3);
    ctx.lineWidth = busy ? 1.4 : 1;
    ctx.setLineDash(off ? [3, 4] : []);
    ctx.stroke();
    ctx.setLineDash([]);
    const name = ROLE[key].name.toUpperCase();
    const track = L.big ? 1.4 : 0.6;
    labelFit(ctx, name, S.x, y0 + (L.big ? 13 : 10.5), S.w - 10 - name.length * track, { size: L.big ? 10 : 8.5, minSize: 7, align: 'center', track, color: busy ? C.amber : off ? INK[4] : INK[3] });
    const sl = slot(key);
    if (busy) {
      const p = clamp((run.clock - busy.serve.t0) / (busy.serve.t1 - busy.serve.t0));
      line(ctx, x0 + 8, y0 + S.h - 3, x0 + S.w - 8, y0 + S.h - 3, alpha(C.amber, 0.18), 1.4);
      line(ctx, x0 + 8, y0 + S.h - 3, x0 + 8 + (S.w - 16) * p, y0 + S.h - 3, C.amber, 1.4);
    } else {
      glyph(key, sl.x, sl.y, off ? alpha(C.cream, 0.14) : INK[4]);
    }
    if (R.queue.length) label(ctx, `${R.queue.length} waiting`, x0, y0 - (L.big ? 7 : 5), { size: L.big ? 9.5 : 8, align: 'right', color: C.amber });
  }

  function dotView(t, j) {
    if (t.loc === 'serve' && t.at === 'exec') {
      const at = t.serve.t0 + EXEC_SETUP + EXEC_STEP * (j + 1);
      if (run.clock >= at) return { v: t.truth[j], at, was: t.known[j] };
      return { v: t.known[j], stale: t.known[j] !== null };
    }
    return { v: t.known[j], stale: t.stale && t.known[j] !== null, at: t.flipAt[j], was: t.was[j] };
  }

  function drawToken(t, x, y, scale) {
    const k = L.tok;
    const w = tokenW(t) * scale;
    const h = k.h * scale;
    const focused = t.id === focus;
    if (scale < 0.55) {
      roundRect(ctx, x - w / 2, y - h / 2, w, h, 3);
      ctx.fillStyle = t.status ? alpha(t.status === 'solved' ? C.gold : C.ember, 0.85) : alpha(C.cream, 0.3);
      ctx.fill();
      return;
    }
    if (focused) glow(ctx, x, y, w * 0.8, C.cream, 0.1);
    roundRect(ctx, x - w / 2, y - h / 2, w, h, 6 * scale);
    ctx.fillStyle = alpha(C.midnight, 0.95);
    ctx.fill();
    ctx.strokeStyle = focused ? C.cream : alpha(C.cream, 0.42);
    ctx.lineWidth = focused ? 1.3 : 1;
    ctx.stroke();
    label(ctx, `#${t.label}`, x, y - h * 0.18, { size: k.id * scale, align: 'center', baseline: 'middle', color: focused ? C.cream : INK[2] });
    const toDebug = t.at === 'debug' || t.hop?.to === 'debug';
    const blind = toDebug && run.cfg.mode === 'blind';
    const target = toDebug && run.cfg.mode === 'exec';
    const speed = Math.max(1, params.speed);
    const dy = y + h * 0.24;
    for (let j = 0; j < t.T; j++) {
      const dx = x + (j - (t.T - 1) / 2) * k.step * scale;
      const d = dotView(t, j);
      const r = k.r * scale;
      if (blind || d.v === null) {
        dot(ctx, dx, dy, r, null, blind ? alpha(C.cream, 0.22) : INK[4], 1);
        continue;
      }
      const col = d.v ? C.gold : C.ember;
      const age = (run.clock - (d.at ?? -1e9)) / speed;
      const pop = params.speed && age >= 0 && age < 0.35 ? 1 - age / 0.35 : 0;
      if (pop && d.was !== null && d.was !== d.v) glow(ctx, dx, dy, 12 * scale, col, 0.8 * pop);
      dot(ctx, dx, dy, r * (1 + 0.7 * pop), d.stale ? alpha(col, 0.32) : col);
      if (target && !d.v) dot(ctx, dx, dy, r + 2.2, null, alpha(C.amber, 0.85), 1);
    }
  }

  function drawTokens(time, layer) {
    for (const t of run.tasks) {
      const p = place(t);
      if (!p || p.over !== layer) continue;
      if (p.edge) heat[p.edge] = 1;
      if (p.sliver) {
        const w = tokenW(t);
        roundRect(ctx, p.x - w / 2, p.y - L.tok.h / 2, w, L.tok.h, 6);
        ctx.fillStyle = alpha(C.midnight, 0.96);
        ctx.fill();
        ctx.strokeStyle = t.id === focus ? C.cream : alpha(C.cream, 0.38);
        ctx.lineWidth = 1;
        ctx.stroke();
        continue;
      }
      ctx.globalAlpha = p.fade ?? 1;
      drawToken(t, p.x, p.y, p.scale);
      ctx.globalAlpha = 1;
      const w = tokenW(t) * p.scale;
      const h = L.tok.h * p.scale;
      if (layer) L.hits.push({ x: p.x - w / 2, y: p.y - h / 2, w, h, id: t.id });
    }
  }

  function drawTrace() {
    const B = L.trace;
    const D = L.nodes.debug;
    const mode = run.cfg.mode;
    const note = mode === 'exec' ? (L.compact ? 'reads traces' : 'reads failing tests + traces') : mode === 'blind' ? (L.compact ? 'blind' : 'no execution feedback') : L.compact ? 'off' : 'repair off';
    const nx = D.x - D.w / 2 - (L.compact ? 8 : 14);
    if (nx - L.mesh.x > 30) labelFit(ctx, note, nx, D.y + 3, nx - L.mesh.x, { size: L.big ? 10.5 : 9, minSize: 8, align: 'right', color: mode === 'exec' ? C.amber : INK[4] });

    const busy = run.roles.exec.busy;
    roundRect(ctx, B.x, B.y, B.w, B.h, L.big ? 12 : 9);
    ctx.fillStyle = alpha(C.midnight, 0.6);
    ctx.fill();
    ctx.strokeStyle = busy ? alpha(C.amber, 0.35) : alpha(C.cream, 0.14);
    ctx.lineWidth = 1;
    ctx.stroke();
    const ex = run.lastExec;
    const inset = L.big ? 12 : 7;
    const x = B.x + inset;
    const w = B.w - inset * 2;
    const fs = L.big ? 10.5 : 8.5;
    const lh = L.big ? 17 : 12;
    let y = B.y + (L.big ? 16 : 11.5);
    label(ctx, L.compact ? 'Last test run' : 'Executor · last test run', x, y, { size: L.big ? 10 : 8.5, upper: true, track: L.big ? 1.4 : 0.6, color: busy ? C.amber : INK[3] });
    if (ex) label(ctx, `#${ex.t.label}${ex.round ? ` · round ${ex.round}` : ''}`, x + w, y, { size: fs, align: 'right', color: INK[3] });
    y += lh + (L.big ? 4 : 1);
    if (!ex) {
      label(ctx, run.started ? 'waiting for the first test run…' : 'no tests run yet', x, y, { size: fs, color: INK[4] });
      return;
    }
    const room = Math.floor((B.y + B.h - 6 - y) / lh);
    const failed = ex.fails.length;
    for (const f of ex.fails.slice(0, Math.max(0, room))) {
      const head = 'FAILED ';
      label(ctx, head, x, y, { size: fs, color: C.ember });
      const hw = textWidth(ctx, head, { size: fs });
      const full = `${f.name} - ${f.err}: ${f.msg}`;
      const detail = L.compact ? f.name : textWidth(ctx, full, { size: fs }) <= w - hw ? full : `${f.name} - ${f.err}`;
      labelFit(ctx, detail, x + hw, y, w - hw, { size: fs, minSize: 7, color: INK[2] });
      y += lh;
    }
    const sum = failed ? `${failed} failed, ${ex.passed} passed in ${ex.dur.toFixed(1)}s` : `${ex.passed} passed in ${ex.dur.toFixed(1)}s`;
    let tail = '';
    if (failed && !L.compact) tail = mode === 'exec' ? ' · trace → Debugger' : mode === 'blind' ? ' · trace withheld' : '';
    labelFit(ctx, sum + tail, x, y, w, { size: fs, minSize: 7, color: failed ? INK[3] : C.gold });
  }

  function drawMesh(time, dt) {
    L.hits = [];
    drawEdges(dt);
    drawEdgeNotes();
    drawBoards(time);
    drawTokens(time, false);
    for (const k of ROLES) drawStation(k, time);
    drawTrace();
    drawTokens(time, true);
  }

  function drawChart(time) {
    const c = L.chart;
    label(ctx, L.compact ? 'Solved vs rounds' : 'Solved rate vs repair rounds', c.x, c.y + 10, { size: L.compact ? 10 : 11, upper: true, track: L.compact ? 1 : 1.6, color: C.gold });
    const finished = run.entry || null;
    const prev = runs.filter((e) => e !== finished).slice(-5);
    const cur = run.started ? (finished ? finished.curve : curveOf(run, false)) : null;
    const xMax = Math.max(1, run.cfg.rounds, ...prev.map((e) => e.cfg.rounds));
    const tagSize = L.compact ? 8.5 : 9.5;
    const endRoom = textWidth(ctx, L.compact ? 'blind 100%' : 'blind 100% ≡#00', { size: tagSize }) + 10;
    const rect = { x: c.x, y: c.y + 18, w: c.w - endRoom, h: c.h - 18 };
    const series = prev.map((e) => ({ points: e.curve, color: alpha(C.cream, 0.3), width: 1.2, dash: DASH[e.cfg.mode] }));
    if (cur) series.push({ points: cur, color: C.cream, width: 1.8, dash: DASH[run.cfg.mode] });
    const { X, Y } = lines(ctx, rect, series, { xMin: 0, xMax, yMin: 0, yMax: 1, yFormat: (v) => `${Math.round(v * 100)}%`, xFormat: () => '', ticks: L.compact ? 2 : 4 });
    for (let k = 0; k <= xMax; k++) label(ctx, String(k), X(k), rect.y + rect.h - 6, { size: 9.5, align: 'center', color: INK[3] });
    label(ctx, 'rounds', X(xMax) + 10, rect.y + rect.h - 6, { size: 9.5, color: INK[4] });
    if (cur) {
      cur.forEach(([px, py], i) => {
        const head = i === cur.length - 1 && !run.done;
        if (head) glow(ctx, X(px), Y(py), 12, C.amber, 0.6);
        dot(ctx, X(px), Y(py), head ? 3 : 2.2, head ? C.amber : C.cream);
      });
    }
    // End labels: this run, then the latest earlier run of each other mode.
    const tags = [];
    if (cur) {
      const [lx, ly] = cur[cur.length - 1];
      const same = finished && finished.same && !L.compact ? ` ≡#${finished.same}` : '';
      tags.push({ x: X(lx), y: Y(ly), text: `${MODES[run.cfg.mode].short} ${Math.round(ly * 100)}%${same}`, color: C.cream });
    }
    const seen = new Set([cur ? run.cfg.mode : '']);
    for (const e of [...prev].reverse()) {
      if (seen.has(e.cfg.mode)) continue;
      seen.add(e.cfg.mode);
      const [lx, ly] = e.curve[e.curve.length - 1];
      tags.push({ x: X(lx), y: Y(ly), text: `${MODES[e.cfg.mode].short} ${Math.round(ly * 100)}%`, color: INK[3] });
    }
    tags.sort((a, b) => a.y - b.y);
    const minGap = L.compact ? 10 : 12;
    for (let i = 1; i < tags.length; i++) tags[i].y = Math.max(tags[i].y, tags[i - 1].y + minGap);
    const floor = rect.y + rect.h - 22;
    for (let i = tags.length - 1; i >= 0; i--) {
      const limit = i === tags.length - 1 ? floor : tags[i + 1].y - minGap;
      tags[i].y = Math.min(tags[i].y, limit);
    }
    for (const tg of tags) label(ctx, tg.text, tg.x + 7, tg.y, { size: tagSize, baseline: 'middle', color: tg.color });
  }

  function drawLog() {
    const g = L.log;
    label(ctx, L.compact ? 'Run log' : 'Reproducibility log', g.x, g.y + 10, { size: L.compact ? 10 : 11, upper: true, track: L.compact ? 1 : 1.6, color: C.gold });
    if (runs.length) label(ctx, L.compact ? `${verb.toLowerCase()} to replay` : `${verb.toLowerCase()} a run to replay it`, g.x + g.w, g.y + 10, { size: L.compact ? 8.5 : 9.5, align: 'right', color: INK[4] });
    const fs = L.compact ? 8.5 : 10;
    const rowH = L.compact ? 14 : 17;
    const gap = L.compact ? 6 : 12;
    const wide = g.w >= 380;
    const cols = [
      { key: 'k', title: 'run', sample: '#00', get: (e) => `#${e.k}` },
      { key: 'seed', title: 'seed', sample: '0000', get: (e) => String(e.cfg.seed) },
      { key: 'mode', title: 'mode', sample: 'blind', get: (e) => MODES[e.cfg.mode].short },
      { key: 'solved', title: 'solved', sample: '24/24', get: (e) => `${e.solved}/${e.cfg.n}` },
      { key: 'avg', title: 'rds', sample: '0.00', get: (e) => e.avg.toFixed(2) },
      { key: 'digest', title: 'digest', sample: '000000', get: (e) => hex(e.digest) },
      { key: 'same', title: '', sample: wide ? 'identical to #00' : '≡ #00', get: (e) => (e.same ? (wide ? `identical to #${e.same}` : `≡ #${e.same}`) : '') },
    ];
    const widthOf = (col) => Math.max(textWidth(ctx, col.sample, { size: fs }), textWidth(ctx, col.title, { size: fs - 1 }) + col.title.length);
    const order = ['digest', 'avg', 'seed'];
    let use = cols;
    const total = (list) => list.reduce((s, col) => s + widthOf(col), 0) + gap * (list.length - 1);
    for (const drop of order) {
      if (total(use) <= g.w) break;
      use = use.filter((col) => col.key !== drop);
    }
    let cx = g.x;
    for (const col of use) {
      col.x = cx;
      cx += widthOf(col) + gap;
    }
    let y = g.y + (L.compact ? 26 : 32);
    for (const col of use) if (col.title) label(ctx, col.title, col.x, y, { size: fs - 1, upper: true, track: 1, color: INK[4] });
    y += rowH;
    const liveRow = run.started && !run.done;
    const fit = Math.max(1, Math.floor((g.y + g.h - 2 - y) / rowH) + 1);
    const keep = Math.max(0, fit - (liveRow ? 1 : 0));
    const entries = keep ? runs.slice(-keep) : [];
    L.rows = [];
    const rowY = {};
    entries.forEach((e, i) => {
      const ry = y + i * rowH;
      rowY[e.k] = ry;
      const hovered = hoverRow === i;
      if (hovered) {
        roundRect(ctx, g.x - 4, ry - rowH + 4, g.w + 8, rowH, 4);
        ctx.fillStyle = alpha(C.cream, 0.06);
        ctx.fill();
      }
      const latest = e === runs[runs.length - 1];
      for (const col of use) {
        const v = col.get(e);
        if (!v) continue;
        const color = col.key === 'same' ? C.gold : col.key === 'solved' ? (e.solved / e.cfg.n >= 0.7 ? C.gold : e.solved / e.cfg.n >= 0.4 ? C.amber : C.ember) : latest || hovered ? INK[1] : INK[2];
        label(ctx, v, col.x, ry, { size: fs, color });
      }
      L.rows.push({ x: g.x - 4, y: ry - rowH + 4, w: g.w + 8, h: rowH, entry: e });
    });
    if (liveRow) {
      const ry = y + entries.length * rowH;
      const s = stats(run);
      for (const col of use) {
        let v = '';
        if (col.key === 'k') v = `#${run.k}`;
        else if (col.key === 'seed') v = String(run.cfg.seed);
        else if (col.key === 'mode') v = MODES[run.cfg.mode].short;
        else if (col.key === 'solved') v = `${s.solved}/${run.cfg.n}`;
        else if (col.key === 'avg') v = s.closed ? s.avgRounds.toFixed(2) : '—';
        else if (col.key === 'digest') v = 'running…';
        label(ctx, v, col.x, ry, { size: fs, color: C.amber });
      }
    }
    // A bracket ties the latest run to the earlier run it reproduced.
    const last = runs[runs.length - 1];
    if (last && last.same && rowY[last.same] != null && rowY[last.k] != null) {
      const bx = g.x - (L.compact ? 6 : 10);
      const y1 = rowY[last.same] - fs * 0.35;
      const y2 = rowY[last.k] - fs * 0.35;
      ctx.beginPath();
      ctx.moveTo(bx + 4, y1);
      ctx.lineTo(bx, y1);
      ctx.lineTo(bx, y2);
      ctx.lineTo(bx + 4, y2);
      ctx.strokeStyle = alpha(C.gold, 0.7);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    if (run.started && !run.entry) {
      if (params.speed === 0) run.advance(Infinity);
      else if (!run.done) {
        target = Math.max(target, run.clock) + dt * params.speed;
        run.advance(target);
      }
      if (run.done) finishRun(time);
      else pullNotes(time);
    }
    view.clear();
    if (!L.mesh) layout(view);
    drawHeader();
    drawMesh(time, dt);
    drawChart(time);
    drawLog();
    const s = stats(run);
    const c = run.cfg;
    stat.set(
      L.compact
        ? `seed ${c.seed} · ${s.closed}/${c.n} closed · t ${clock(run.clock)}`
        : `seed ${c.seed}${run.started ? ` · run #${run.k}` : ''} · ${s.closed}/${c.n} closed · ${run.inflight} in flight · t ${clock(run.clock)}`,
    );
    if (++frame % 6 === 0) refresh();
  });

  toPreview();

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
