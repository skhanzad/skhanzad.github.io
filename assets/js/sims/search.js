// Heuristic search: four planners race across one grid map whose heuristic has a
// plateau and a trap.
//
// h is the Manhattan distance to the goal, flattened inside a plateau zone (and sloping
// into it, so it stays admissible and consistent). A U-shaped wall opens towards the
// start, so greedy descent walks in and meets its closed end. Uninformed A* (h = 0) and A*
// with h show what guidance saves; enforced hill-climbing and a restarting random walk
// show how local search copes where h stops guiding. The four share one clock: every
// frame grants each the same slice of simulated time.
import {
  C,
  INK,
  alpha,
  rng,
  int,
  clamp,
  lerp,
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

const FULL = { W: 60, H: 32 };
const SMALL = { W: 30, H: 24 };
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];
const STEP_COST = 0.25; // a random-walk step; an expansion or a heuristic evaluation costs 1 tick
const LIMIT = 2; // each planner's time limit, in ticks per open cell
const WALKS = 3; // random walks per round
const PERSIST = 0.85; // chance a walk keeps its heading
const STUCK = 30; // breadth-first expansions before hill-climbing counts as stuck
const MAPS = 40;
const HOLD = 1600; // ms a narration line stays before a less important one may replace it
const PLATEAU = 1;
const TRAP = 2;
const PLACE = ['a local minimum', 'a plateau', 'the trap'];
const THE = ['the local minimum', 'the plateau', 'the trap'];
const ORD = ['1st', '2nd', '3rd', '4th'];
const ALGS = [
  { id: 'ua', name: 'Uninformed A*', short: 'A* · h = 0', tab: 'A* h=0', unit: 'exp' },
  { id: 'ia', name: 'A* + heuristic', short: 'A* + h', tab: 'A* + h', unit: 'exp' },
  { id: 'ehc', name: 'Enforced hill-climbing', short: 'Hill-climbing', tab: 'EHC', unit: 'exp' },
  { id: 'rrw', name: 'Restarting random walk', short: 'Random walk', tab: 'RRW', unit: 'steps' },
];

const COL = {
  frontier: alpha(C.amber, 0.88),
  active: alpha(C.amber, 0.14),
  trail: alpha(C.amber, 0.95),
  committed: alpha(C.cream, 0.5),
  halo: alpha(C.cream, 0.16),
};

// Hill-climbing's breadth-first search tries the moves towards the goal first, along the
// axis with more distance left: ORDERS[4·xMajor + 2·(goal is left) + (goal is up)].
const ORDERS = Array.from({ length: 8 }, (_, k) => {
  const hx = k & 2 ? 2 : 0;
  const hy = k & 1 ? 3 : 1;
  return k & 4 ? [hx, hy, (hy + 2) % 4, (hx + 2) % 4] : [hy, hx, (hx + 2) % 4, (hy + 2) % 4];
});

/* ------------------------------------------------------------------ */
/* Maps                                                               */
/* ------------------------------------------------------------------ */

function reachable(walls, W, H, from, to) {
  const seen = new Uint8Array(W * H);
  const queue = new Int32Array(W * H);
  let head = 0;
  let tail = 0;
  queue[tail++] = from;
  seen[from] = 1;
  while (head < tail) {
    const c = queue[head++];
    if (c === to) return true;
    const x = c % W;
    const y = (c - x) / W;
    for (let d = 0; d < 4; d++) {
      const nx = x + DX[d];
      const ny = y + DY[d];
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      const n = ny * W + nx;
      if (!seen[n] && !walls[n]) {
        seen[n] = 1;
        queue[tail++] = n;
      }
    }
  }
  return false;
}

function openCells(map) {
  let n = 0;
  for (let i = 0; i < map.N; i++) if (!map.walls[i]) n++;
  return n;
}

function makeMap(seed, { W, H }, { plateau, trap, density }) {
  const r = rng(seed);
  const N = W * H;
  const at = (x, y) => y * W + x;
  const lo = Math.round(H * 0.28);
  const hi = Math.round(H * 0.72) - 1;
  const sx = int(r, 1, 2);
  const sy = int(r, lo, hi);
  const gx = W - 1 - int(r, 1, 2);
  const gy = int(r, lo, hi);
  const region = new Uint8Array(N);
  const fixed = [];

  // The trap: a U whose closed end faces the goal and whose mouth faces the start.
  let box = null;
  if (trap > 0) {
    const depth = Math.max(2, Math.round(trap * W * 0.3));
    const bx = Math.round(lerp(sx, gx, 0.72));
    const margin = Math.max(2, Math.round(H * 0.07));
    const span = Math.round(H * (0.22 + 0.2 * trap));
    let y0 = Math.min(sy, gy) - margin;
    let y1 = Math.max(sy, gy) + margin;
    while (y1 - y0 + 1 < span) {
      y0--;
      y1++;
    }
    y0 = Math.max(3, y0);
    y1 = Math.min(H - 4, y1);
    for (let y = y0 - 1; y <= y1 + 1; y++) fixed.push(at(bx, y));
    for (let x = bx - depth; x < bx; x++) fixed.push(at(x, y0 - 1), at(x, y1 + 1));
    box = { x0: bx - depth, x1: bx - 1, y0, y1 };
    for (let y = y0; y <= y1; y++) for (let x = box.x0; x <= box.x1; x++) region[at(x, y)] = TRAP;
  }

  // The plateau: a zone between the start and the trap's mouth.
  let zone = null;
  if (plateau > 0) {
    const a = sx + 3;
    const b = box ? box.x0 - 3 : Math.round(lerp(sx, gx, 0.75));
    const room = b - a + 1;
    const zw = Math.min(room, Math.round(plateau * 0.42 * W));
    const zh = Math.min(H - 2, Math.round(H * (0.3 + 0.55 * plateau)));
    if (zw >= 3) {
      const x0 = a + Math.floor((room - zw) / 2);
      const y0 = clamp(Math.round((sy + gy) / 2) - Math.floor(zh / 2), 1, H - 1 - zh);
      zone = { x0, x1: x0 + zw - 1, y0, y1: y0 + zh - 1, h: 0 };
      for (let y = zone.y0; y <= zone.y1; y++) for (let x = zone.x0; x <= zone.x1; x++) region[at(x, y)] = PLATEAU;
    }
  }

  // Scattered wall segments, kept out of and around the trap so its shape stays clear,
  // and redrawn until the goal is reachable.
  const walls = new Uint8Array(N);
  const start = at(sx, sy);
  const goal = at(gx, gy);
  const near = new Uint8Array(N);
  if (box) {
    for (let y = Math.max(0, box.y0 - 2); y <= Math.min(H - 1, box.y1 + 2); y++) {
      for (let x = Math.max(0, box.x0 - 1); x <= Math.min(W - 1, box.x1 + 2); x++) near[at(x, y)] = 1;
    }
  }
  const clear = (x, y) => !near[at(x, y)] && Math.abs(x - sx) + Math.abs(y - sy) > 2 && Math.abs(x - gx) + Math.abs(y - gy) > 2;
  for (let attempt = 0; attempt <= 12; attempt++) {
    walls.fill(0);
    for (const c of fixed) walls[c] = 1;
    if (attempt === 12) break;
    let left = Math.round(density * N);
    for (let tries = 0; left > 0 && tries < N * 4; tries++) {
      const len = int(r, 1, 4);
      const across = r() < 0.5;
      let x = int(r, 0, W - 1);
      let y = int(r, 0, H - 1);
      for (let k = 0; k < len && x < W && y < H; k++) {
        if (clear(x, y) && !walls[at(x, y)]) {
          walls[at(x, y)] = 1;
          left--;
        }
        if (across) x++;
        else y++;
      }
    }
    if (reachable(walls, W, H, start, goal)) break;
  }

  const h = new Int32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) h[at(x, y)] = Math.abs(gx - x) + Math.abs(gy - y);
  if (zone) {
    // Flat inside the zone at its lowest value; outside, never steeper than one per step
    // towards it, so h stays admissible and consistent.
    let p = Infinity;
    for (let y = zone.y0; y <= zone.y1; y++) for (let x = zone.x0; x <= zone.x1; x++) p = Math.min(p, h[at(x, y)]);
    zone.h = p;
    for (let y = 0; y < H; y++) {
      for (let x = 0; x < W; x++) {
        const d = Math.max(0, zone.x0 - x, x - zone.x1) + Math.max(0, zone.y0 - y, y - zone.y1);
        h[at(x, y)] = Math.min(h[at(x, y)], p + d);
      }
    }
  }
  let hMax = 1;
  for (let i = 0; i < N; i++) hMax = Math.max(hMax, h[i]);
  return { W, H, N, walls, h, hMax, region, zone, trap: box, start, goal };
}

/* ------------------------------------------------------------------ */
/* Planners: each step() is one unit of work                          */
/* ------------------------------------------------------------------ */

// A* on a binary heap with lazy deletion. Ties on f go to the lower h, then the newest.
function aStar(map, informed) {
  const { N, W, H, walls, start, goal } = map;
  const hv = informed ? map.h : null;
  const g = new Float64Array(N).fill(Infinity);
  const parent = new Int32Array(N).fill(-1);
  const state = new Uint8Array(N); // 1 open, 2 closed
  const seen = new Uint16Array(N);
  let keys = new Float64Array(256);
  let cells = new Int32Array(256);
  let size = 0;
  let order = 0;

  const push = (c, f, hh) => {
    if (size === keys.length) {
      const k2 = new Float64Array(size * 2);
      const c2 = new Int32Array(size * 2);
      k2.set(keys);
      c2.set(cells);
      keys = k2;
      cells = c2;
    }
    const key = (f * 512 + hh) * 4194304 - ++order;
    let i = size++;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (keys[p] <= key) break;
      keys[i] = keys[p];
      cells[i] = cells[p];
      i = p;
    }
    keys[i] = key;
    cells[i] = c;
  };

  const pop = () => {
    const top = cells[0];
    const lk = keys[--size];
    const lc = cells[size];
    let i = 0;
    for (;;) {
      let m = 2 * i + 1;
      if (m >= size) break;
      if (m + 1 < size && keys[m + 1] < keys[m]) m++;
      if (keys[m] >= lk) break;
      keys[i] = keys[m];
      cells[i] = cells[m];
      i = m;
    }
    keys[i] = lk;
    cells[i] = lc;
    return top;
  };

  const self = {
    work: 0,
    time: 0,
    done: false,
    solved: false,
    reason: '',
    path: null,
    seen,
    eachOpen(fn) {
      for (let i = 0; i < size; i++) if (state[cells[i]] === 1) fn(cells[i]);
    },
    step() {
      let c = -1;
      while (size) {
        const k = pop();
        if (state[k] === 1) {
          c = k;
          break;
        }
      }
      if (c < 0) {
        self.done = true;
        self.reason = 'no path';
        return;
      }
      self.work++;
      self.time++;
      state[c] = 2;
      seen[c]++;
      if (c === goal) {
        const path = [];
        for (let k = c; k >= 0; k = parent[k]) path.push(k);
        self.path = path.reverse();
        self.done = true;
        self.solved = true;
        return;
      }
      const x = c % W;
      const y = (c - x) / W;
      for (let d = 0; d < 4; d++) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (walls[n] || g[c] + 1 >= g[n]) continue;
        g[n] = g[c] + 1;
        parent[n] = c;
        state[n] = 1;
        const hh = hv ? hv[n] : 0;
        push(n, g[n] + hh, hh);
      }
    },
  };
  g[start] = 0;
  state[start] = 1;
  push(start, hv ? hv[start] : 0, hv ? hv[start] : 0);
  return self;
}

// Enforced hill-climbing: breadth-first search from the current state until a state with
// a strictly lower h turns up; commit to the path there and search again from it.
function hillClimb(map, emit) {
  const { N, W, H, walls, h, start, goal, region } = map;
  const gx = goal % W;
  const gy = (goal - gx) / W;
  const stamp = new Int32Array(N);
  const parent = new Int32Array(N);
  const queue = new Int32Array(N);
  const seen = new Uint16Array(N);
  let head = 0;
  let tail = 0;
  let round = 0;

  const self = {
    work: 0,
    time: 0,
    done: false,
    solved: false,
    reason: '',
    path: [start],
    seen,
    cur: start,
    stuck: 0, // expansions in the current breadth-first search
    where: region[start],
    improved: 0,
    eachOpen(fn) {
      for (let i = head; i < tail; i++) fn(queue[i]);
    },
    eachSearched(fn) {
      for (let i = 0; i < head; i++) fn(queue[i]);
    },
    step() {
      if (head >= tail) {
        self.done = true;
        self.reason = 'dead end';
        return;
      }
      const c = queue[head++];
      self.work++;
      self.time++;
      self.stuck++;
      seen[c]++;
      if (self.stuck === STUCK || self.stuck === STUCK * 8 || self.stuck === STUCK * 32) emit?.('stuck', { where: self.where });
      const x = c % W;
      const y = (c - x) / W;
      const dx = gx - x;
      const dy = gy - y;
      const moves = ORDERS[(Math.abs(dx) >= Math.abs(dy) ? 4 : 0) + (dx < 0 ? 2 : 0) + (dy < 0 ? 1 : 0)];
      for (const d of moves) {
        const nx = x + DX[d];
        const ny = y + DY[d];
        if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
        const n = ny * W + nx;
        if (walls[n] || stamp[n] === round) continue;
        stamp[n] = round;
        parent[n] = c;
        if (h[n] < h[self.cur]) {
          const seg = [];
          for (let k = n; k !== self.cur; k = parent[k]) seg.push(k);
          for (let i = seg.length - 1; i >= 0; i--) self.path.push(seg[i]);
          if (self.stuck >= STUCK) emit?.('escape', { where: self.where, size: self.stuck });
          self.cur = n;
          self.improved++;
          if (n === goal) {
            self.done = true;
            self.solved = true;
            head = tail = 0;
            return;
          }
          begin();
          return;
        }
        queue[tail++] = n;
      }
    },
  };

  function begin() {
    round++;
    head = 0;
    tail = 0;
    queue[tail++] = self.cur;
    stamp[self.cur] = round;
    self.stuck = 0;
    self.where = region[self.cur];
  }
  begin();
  return self;
}

// Restarting random walk: from the best state so far, launch rounds of short random walks
// and jump to the best endpoint with a lower h. A round without one doubles the walk
// length; four such rounds in a row restart the search from the start.
function randomWalk(map, r, emit, keep = 0) {
  const { N, W, H, walls, h, start, goal, region } = map;
  const L0 = Math.max(4, Math.round((W + H) / 12));
  const Lmax = (W + H) * 2;
  const seen = new Uint16Array(N);
  const opts = [0, 0, 0, 0];
  const next = (c, d) => {
    const x = c % W;
    const y = (c - x) / W;
    const nx = x + DX[d];
    const ny = y + DY[d];
    if (nx < 0 || ny < 0 || nx >= W || ny >= H) return -1;
    const n = ny * W + nx;
    return walls[n] ? -1 : n;
  };
  const endOf = (w) => w.cells[w.cells.length - 1];

  const self = {
    work: 0,
    time: 0,
    done: false,
    solved: false,
    reason: '',
    path: [start],
    seen,
    best: start,
    L: L0,
    fails: 0,
    restarts: 0,
    rounds: 0,
    steps: 0,
    evals: 0,
    walk: null, // the walk under way
    ends: [], // finished walks of this round, not yet judged
    trails: [], // judged walks kept for drawing: { cells, round, ok }
    step() {
      if (!self.walk) self.walk = { cells: [self.best], dir: Math.floor(r() * 4), left: self.L };
      const w = self.walk;
      self.work++;
      if (w.left > 0) {
        self.time += STEP_COST;
        self.steps++;
        const c = endOf(w);
        const back = (w.dir + 2) % 4;
        let d = r() < PERSIST && next(c, w.dir) >= 0 ? w.dir : -1;
        if (d < 0) {
          let n = 0;
          for (let k = 0; k < 4; k++) if (k !== back && next(c, k) >= 0) opts[n++] = k;
          if (n) d = opts[Math.floor(r() * n)];
          else if (next(c, back) >= 0) d = back;
        }
        if (d < 0) {
          w.left = 0; // walled in
          return;
        }
        const n = next(c, d);
        w.dir = d;
        w.cells.push(n);
        w.left--;
        seen[n]++;
        if (n === goal) {
          for (let i = 1; i < w.cells.length; i++) self.path.push(w.cells[i]);
          if (keep) self.trails.push({ cells: w.cells, round: self.rounds + 1, ok: true });
          self.walk = null;
          self.done = true;
          self.solved = true;
        }
        return;
      }

      // The endpoint's evaluation: the only heuristic call a walk makes.
      self.time += 1;
      self.evals++;
      self.ends.push(w);
      self.walk = null;
      if (self.ends.length < WALKS) return;
      self.rounds++;
      let pick = null;
      for (const e of self.ends) if (h[endOf(e)] < h[self.best] && (!pick || h[endOf(e)] < h[endOf(pick)])) pick = e;
      if (keep) {
        for (const e of self.ends) self.trails.push({ cells: e.cells, round: self.rounds, ok: e === pick });
        if (self.trails.length > keep) self.trails.splice(0, self.trails.length - keep);
      }
      self.ends = [];
      if (pick) {
        const from = region[self.best];
        const to = endOf(pick);
        for (let i = 1; i < pick.cells.length; i++) self.path.push(pick.cells[i]);
        self.best = to;
        self.fails = 0;
        self.L = Math.max(L0, Math.round(self.L * 0.7));
        if (from && region[to] !== from) emit?.('escape', { where: from, restarts: self.restarts });
      } else {
        self.fails++;
        self.L = Math.min(Lmax, self.L * 2);
        if (self.fails < 4) emit?.('grow', { L: self.L, where: region[self.best] });
        if (self.fails >= 4) {
          self.fails = 0;
          self.restarts++;
          self.best = start;
          self.path = [start];
          emit?.('restart', { n: self.restarts, L: self.L });
        }
      }
    },
  };
  return self;
}

// A plan with its loops cut out (revisits make it longer, never shorter).
function loopErase(path, N) {
  const pos = new Int32Array(N).fill(-1);
  const out = [];
  for (const c of path) {
    const k = pos[c];
    if (k >= 0) {
      for (let i = k + 1; i < out.length; i++) pos[out[i]] = -1;
      out.length = k + 1;
    } else {
      pos[c] = out.length;
      out.push(c);
    }
  }
  return out;
}

const suiteSeed = (i) => ((i + 1) * 2654435761) % 2147483647;

/* ------------------------------------------------------------------ */
/* Simulation                                                         */
/* ------------------------------------------------------------------ */

export function create({ stage, panel, reduced }) {
  const params = { plateau: 0.4, trap: 0.4, density: 0.07, speed: reduced ? 0 : 0.18 };
  let seed = 7;
  let dims = FULL;
  let map = null;
  let race = null;
  let raceNo = 0;
  let painted = 0;
  let erase = false;
  let mode = 'race';
  let sel = 3; // the planner shown on small screens
  let batch = null;
  let events = [];
  let hover = -1;
  let stroke = null;
  let dirty = true; // the static map layers need repainting
  let frame = 0;
  let narration = {
    text: 'Four planners, one map, one clock. Press Race to start them together.',
    short: 'Four planners, one map. Press Race.',
    tone: INK[2],
    prio: 0,
    at: 0,
    live: null,
  };
  const L = {};
  const layers = { plain: document.createElement('canvas'), shaded: document.createElement('canvas') };
  // Explored cells accumulate on one offscreen layer per planner; each frame paints only
  // the cells whose visit count changed.
  const trace = ALGS.map(() => ({ canvas: document.createElement('canvas'), g: null, drawn: null }));
  let traceDirty = true;

  /* ---------------------------------------------------------------- */
  /* Race driver                                                      */
  /* ---------------------------------------------------------------- */

  function newMap(note = true) {
    map = makeMap(seed, dims, params);
    painted = 0;
    raceNo = 0;
    newRace();
    dirty = true;
    if (note) narrate(describeMap(), true);
    refresh();
  }

  function newRace() {
    const r = rng(seed * 7919 + raceNo * 104729 + 13);
    const emit = (i) => (type, data) => events.push({ i, type, ...data });
    race = {
      algs: [aStar(map, false), aStar(map, true), hillClimb(map, emit(2)), randomWalk(map, r, emit(3), WALKS * 2)],
      clock: 0,
      acc: 0,
      cap: LIMIT * openCells(map),
      running: false,
      started: false,
      over: false,
      order: [],
    };
    events = [];
    traceDirty = true;
  }

  function startRace() {
    mode = 'race';
    raceNo++;
    newRace();
    race.running = true;
    race.started = true;
    const again = {
      text: `Race ${raceNo}: same map, fresh random walks. The other three planners are deterministic and repeat exactly.`,
      short: `Race ${raceNo}: fresh random walks, same map.`,
    };
    const first = { text: 'Off they go: every frame grants each planner the same slice of simulated time.', short: 'Same map, same clock: go.' };
    narrate({ ...(raceNo > 1 ? again : first), prio: 5 }, true);
    refresh();
  }

  function stepRace(n) {
    race.clock = Math.min(race.cap, race.clock + n);
    race.algs.forEach((a, i) => {
      while (!a.done && a.time < race.clock) a.step();
      if (!a.done && a.time >= race.cap) {
        a.done = true;
        a.reason = 'time limit';
      }
      if (a.done && a.finish == null) finish(i, a);
    });
    if (race.algs.every((a) => a.done)) endRace();
  }

  function advanceRace(dt) {
    if (params.speed === 0) {
      const until = performance.now() + 7;
      while (race.running && performance.now() < until) stepRace(40);
      return;
    }
    race.acc += dt * params.speed * map.N;
    const n = Math.floor(race.acc);
    race.acc -= n;
    if (n > 0) stepRace(n);
  }

  function finish(i, a) {
    a.finish = Math.min(a.time, race.cap);
    a.at = performance.now();
    if (a.solved) {
      a.shown = i >= 2 ? loopErase(a.path, map.N) : a.path;
      race.order.push(i);
      a.rank = race.order.length;
    }
    events.push({ i, type: a.solved ? 'solved' : 'failed' });
  }

  function endRace() {
    race.running = false;
    race.over = true;
    const v = verdict();
    narrate({ text: v.text, short: v.short, tone: v.tone, prio: 4 }, true);
    say.say(v.sr);
    tip.hide();
    refresh();
  }

  const ticks = (a) => fmt.int(a.finish ?? a.time);
  const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

  function verdict() {
    const [ua, ia, ehc, rw] = race.algs;
    const sr = race.algs
      .map((a, i) => {
        if (a.solved) return `${ALGS[i].name}: solved at ${ticks(a)} ticks with ${fmt.int(a.work)} ${i === 3 ? 'steps and evaluations' : 'expansions'}.`;
        return `${ALGS[i].name}: ${a.reason === 'time limit' ? 'gave up at the time limit' : 'no path'}.`;
      })
      .join(' ');
    if (ua.reason === 'no path') {
      const text = 'No path exists: the walls cut the goal off. Erase a few and race again.';
      return { text, short: 'No path: walls cut the goal off.', tone: C.ember, sr: `Race over. ${sr}` };
    }
    let text;
    let short;
    if (rw.solved && ehc.solved) {
      const rwWins = rw.finish < ehc.finish;
      text = rwWins
        ? `Race over: the random walk beat hill-climbing, ${ticks(rw)} ticks to ${ticks(ehc)}`
        : `Race over: hill-climbing beat the random walk, ${ticks(ehc)} ticks to ${ticks(rw)}`;
      short = rwWins ? `Done: RRW beat EHC, ${ticks(rw)} to ${ticks(ehc)}.` : `Done: EHC beat RRW, ${ticks(ehc)} to ${ticks(rw)}.`;
    } else if (rw.solved) {
      text = 'Race over: only the random walk reached the goal before the time limit';
      short = 'Done: only the random walk got there.';
    } else if (ehc.solved) {
      text = 'Race over: hill-climbing got there; the random walk ran out of time';
      short = 'Done: the random walk ran out of time.';
    } else {
      text = 'Race over: neither local search reached the goal in time';
      short = 'Done: neither local search got there.';
    }
    if (ua.solved && ia.solved) text += `; A* + h needed ${fmt.pct(1 - ia.work / ua.work, 0)} fewer expansions than blind A*.`;
    else text += '.';
    return { text, short, tone: C.cream, sr: `Race over. ${sr}` };
  }

  function describeMap() {
    const z = map.zone;
    const t = map.trap;
    if (!z && !t) {
      return { text: 'A smooth landscape: no plateau, no trap. Press Race and watch hill-climbing stride straight in.', short: 'Smooth landscape. Press Race.', prio: 5 };
    }
    const bits = [];
    if (z) bits.push('a plateau where h goes flat');
    if (t) bits.push(`a trap ${t.x1 - t.x0 + 1} cells deep, closed towards the goal`);
    return {
      text: `New map: ${bits.join(', then ')}. Press Race to start all four on one clock.`,
      short: `New map: ${[z && 'plateau', t && 'a trap'].filter(Boolean).join(', then ')}. Press Race.`,
      prio: 5,
    };
  }

  // One narration line; a more important or newer line replaces it after HOLD ms.
  function narrate(n, force = false) {
    const now = performance.now();
    if (!force && (n.prio ?? 1) < narration.prio && now - narration.at < HOLD) return;
    narration = { tone: INK[2], prio: 1, live: null, ...n, at: now };
  }

  function onEvent(e) {
    const a = race.algs[e.i];
    const A = ALGS[e.i];
    if (e.type === 'stuck') {
      narrate({
        prio: 1,
        tone: C.amber,
        live: () => [
          `Enforced hill-climbing is stuck searching ${PLACE[e.where]}: ${fmt.int(a.stuck)} expansions without improving h.`,
          `EHC stuck in ${PLACE[e.where]}: ${fmt.int(a.stuck)} expansions.`,
        ],
      });
    } else if (e.type === 'escape' && e.i === 2) {
      narrate({
        text: `Hill-climbing broke out of ${THE[e.where]} after a ${fmt.int(e.size)}-node breadth-first search.`,
        short: `EHC escaped ${THE[e.where]}: ${fmt.int(e.size)} expansions.`,
        prio: 2,
        tone: C.cream,
      });
    } else if (e.type === 'escape') {
      const after = e.restarts ? `after ${plural(e.restarts, 'restart')}` : 'without a restart';
      narrate({ text: `The random walk escaped ${THE[e.where]} ${after}.`, short: `RRW escaped ${THE[e.where]} ${after}.`, prio: 2, tone: C.gold });
    } else if (e.type === 'grow') {
      narrate({
        text: `No walk ended on a better h${e.where ? ` inside ${THE[e.where]}` : ''}: the random walk doubles its walks to ${e.L} steps.`,
        short: `RRW stuck: walks now ${e.L} steps.`,
        prio: 0.5,
        tone: C.amber,
      });
    } else if (e.type === 'restart') {
      narrate({
        text: `Four rounds without a better endpoint: the random walk restarts from the start (restart ${e.n}) with ${e.L}-step walks.`,
        short: `RRW restart ${e.n}: walks of ${e.L} steps.`,
        prio: 1,
        tone: C.amber,
      });
    } else if (e.type === 'solved') {
      const len = a.shown.length - 1;
      const extra = e.i < 2 ? `an optimal path of ${len}` : `a path of ${len}`;
      narrate({
        text: `${A.name} reached the goal at ${ticks(a)} ticks: ${fmt.int(a.work)} ${e.i === 3 ? 'steps and evaluations' : 'expansions'}, ${extra}.`,
        short: `${A.short} solved at ${ticks(a)} ticks.`,
        prio: 3,
        tone: C.gold,
      });
    } else if (e.type === 'failed') {
      const late = a.reason === 'time limit';
      narrate({
        text: late ? `${A.name} hit the time limit at ${fmt.int(race.cap)} ticks and gave up.` : `${A.name} ran out of states to search: the goal is walled off.`,
        short: late ? `${A.short} gave up at the time limit.` : `${A.short}: goal walled off.`,
        prio: 3,
        tone: C.ember,
      });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Batch: 40 seeded maps, headless, chunked across frames           */
  /* ---------------------------------------------------------------- */

  function startBatch() {
    mode = 'batch';
    if (race?.running) newRace();
    batch = { results: [], cur: null, running: true, ticks: 0, at: performance.now() };
    tip.hide();
    const text = `Running ${MAPS} seeded maps headless: all four planners on each, under the same time limit.`;
    narrate({ text, short: `Running ${MAPS} seeded maps…`, prio: 5 }, true);
    refresh();
  }

  function runBatch() {
    const until = performance.now() + 7;
    let fresh = 0;
    while (batch.running && performance.now() < until) {
      if (!batch.cur) {
        if (!reduced && fresh >= 1) break; // one new map per frame, so the tally visibly fills
        const s = suiteSeed(batch.results.length);
        const m = makeMap(s, FULL, params);
        batch.cur = { m, algs: [aStar(m, false), aStar(m, true), hillClimb(m), randomWalk(m, rng(s * 7919 + 13))], k: 0, cap: LIMIT * openCells(m) };
        fresh++;
      }
      const c = batch.cur;
      const a = c.algs[c.k];
      for (let j = 0; j < 512 && !a.done; j++) {
        a.step();
        if (!a.done && a.time >= c.cap) {
          a.done = true;
          a.reason = 'time limit';
        }
      }
      if (!a.done) continue;
      batch.ticks += a.time;
      if (++c.k < 4) continue;
      const [ua, ia, e, w] = c.algs;
      batch.results.push({
        eT: Math.min(e.time, c.cap),
        wT: Math.min(w.time, c.cap),
        eS: e.solved,
        wS: w.solved,
        win: w.solved && (!e.solved || w.time < e.time),
        unique: w.solved && !e.solved,
        cut: ua.solved && ia.solved ? 1 - ia.work / ua.work : null,
        cap: c.cap,
        at: performance.now(),
      });
      batch.cur = null;
      if (batch.results.length === MAPS) finishBatch();
    }
  }

  function batchStats() {
    let wins = 0;
    let unique = 0;
    let cut = 0;
    let cuts = 0;
    for (const r of batch.results) {
      if (r.win) wins++;
      if (r.unique) unique++;
      if (r.cut != null) {
        cut += r.cut;
        cuts++;
      }
    }
    const done = batch.results.length;
    return { done, wins, unique, rate: done ? wins / done : 0, cut: cuts ? cut / cuts : 0 };
  }

  function finishBatch() {
    batch.running = false;
    const s = batchStats();
    narrate(
      {
        text: `Across ${MAPS} maps the random walk beat hill-climbing on ${s.wins} (${fmt.pct(s.rate)}); A* + h saved ${fmt.pct(s.cut)} of expansions.`,
        short: `RRW beat EHC on ${s.wins} of ${MAPS} maps.`,
        tone: C.cream,
        prio: 4,
      },
      true,
    );
    say.say(
      `Batch of ${MAPS} maps complete. The random walk was faster than hill-climbing, or solved a map hill-climbing could not, on ${s.wins} of ${MAPS} maps (${fmt.pct(s.rate)}). A* with the heuristic expanded ${fmt.pct(s.cut)} fewer nodes than uninformed A* on average. These are simulated results.`,
    );
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'Four planners cross the same map on one clock. <strong>A*</strong> searches systematically, either blind (h = 0) or guided by h, the distance to the goal. <strong>Enforced hill-climbing</strong> (EHC) and a <strong>restarting random walk</strong> (RRW) are local searches that chase a lower h.',
  );
  para(
    about,
    'The heuristic misleads in two places: a dashed <em>plateau</em> where h goes flat, and a <em>trap</em> that faces the goal. EHC floods them breadth-first; RRW launches short random walks, jumps to any endpoint with a better h, and restarts when stuck.',
  );
  legend(about, [
    { color: C.amber, label: 'frontier · walks' },
    { color: C.gold, label: 'explored · goal' },
    { color: C.cream, label: 'path found', shape: 'line' },
    { color: C.cream, label: 'start', shape: 'ring' },
    { color: INK[3], label: 'plateau (flat h)', shape: 'dash' },
    { color: C.ember, label: 'gave up' },
  ]);

  const controls = section(panel, 'Run the race');
  const buttons = actions(controls, [
    { id: 'race', label: 'Race ▸', primary: true, onClick: () => startRace() },
    {
      id: 'map',
      label: 'New map',
      onClick: () => {
        seed = (seed * 48271 + 11) % 2147483647;
        mode = 'race';
        newMap();
      },
    },
    { id: 'batch', label: 'Run 40 maps', onClick: () => startBatch() },
  ]);
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 0.05, label: 'Watch' },
      { value: 0.18, label: 'Brisk' },
      { value: 0, label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });
  const shown = choice(controls, {
    label: 'Planner on the map',
    options: ALGS.map((A, i) => ({ value: i, label: A.short })),
    value: sel,
    onChange: (v) => (sel = v),
  });

  const shape = section(panel, 'Shape the landscape');
  const reshape = () => {
    if (batch) batch = null; // its maps used the old settings
    mode = 'race';
    newMap();
  };
  const pctOrNone = (v) => (v === 0 ? 'none' : `${Math.round(v * 100)}%`);
  const knob = (label, key, max, step, format) =>
    slider(shape, {
      label,
      min: 0,
      max,
      step,
      value: params[key],
      format,
      onInput: (v) => {
        params[key] = v;
        reshape();
      },
    });
  knob('Plateau size', 'plateau', 1, 0.05, pctOrNone);
  knob('Trap depth', 'trap', 1, 0.05, pctOrNone);
  knob('Obstacle density', 'density', 0.25, 0.01, (v) => `${Math.round(v * 100)}%`);
  toggle(shape, { label: 'Erase walls when dragging', value: false, onChange: (v) => (erase = v) });
  const tools = actions(shape, [{ id: 'undo', label: 'Undo painting', onClick: () => ((mode = 'race'), newMap()) }]);

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'ua', label: 'Uninformed A* · exp.' },
    { id: 'ia', label: 'A* + h · exp.' },
    { id: 'ehc', label: 'EHC · exp.' },
    { id: 'rrw', label: 'RRW · steps + evals' },
    { id: 'win', label: 'RRW beat EHC · 40 maps' },
    { id: 'cut', label: 'A* exp. saved · 40 maps' },
  ]);
  para(
    results,
    'Set the plateau and the trap to none and run 40 maps: on a smooth landscape hill-climbing wins nearly every time. Then raise them again, or paint a wall across the trap’s mouth and race.',
    'sim-fine',
  );

  paper(panel, {
    lines: [
      'Co-developed a restarting-random-walk planner that was faster or uniquely successful on <strong>70.3%</strong> of agile-track tasks with unbounded heuristic regions versus standard enforced hill-climbing.',
      'In Opti Code Pro, reduced node expansions by <strong>82%</strong> and runtime by <strong>74%</strong> versus uninformed A* at full refactoring aggression.',
      'AAAI 2026 · Preprint 2023.',
    ],
    links: [
      { label: 'AAAI 2026', href: 'https://doi.org/10.1609/aaai.v40i43.41044' },
      { label: 'Opti Code Pro · arXiv 2305.07594', href: 'https://arxiv.org/abs/2305.07594' },
    ],
  });
  fine(
    panel,
    'A small grid is a simplified stand-in for the planning and refactoring tasks: the plateau is a flattened distance heuristic, the walks carry momentum, plans are shown with loops removed, and an expansion or evaluation costs one tick while a walk step costs a quarter. Every number in the readout and the batch comes from this simulation, not from the papers.',
  );
  const say = live(panel);

  const shownCache = {};
  function put(id, value, tone = '') {
    const key = `${value}|${tone}`;
    if (shownCache[id] === key) return;
    shownCache[id] = key;
    out.set(id, value, tone);
  }

  function refresh() {
    ALGS.forEach((A, i) => {
      const a = race?.algs[i];
      if (!race?.started || !a) put(A.id, '—');
      else if (!a.done) put(A.id, fmt.int(a.work), 'warn');
      else if (a.solved) put(A.id, fmt.int(a.work), 'ok');
      else put(A.id, a.reason === 'time limit' ? 'gave up' : 'no path', 'bad');
    });
    if (!batch) {
      put('win', '—');
      put('cut', '—');
    } else {
      const s = batchStats();
      if (batch.running) {
        put('win', `${s.done} / ${MAPS}…`, 'warn');
        put('cut', `${s.done} / ${MAPS}…`, 'warn');
      } else {
        put('win', fmt.pct(s.rate), s.rate >= 0.5 ? 'ok' : 'warn');
        put('cut', fmt.pct(s.cut), 'ok');
      }
    }
    const run = race?.running ? 'Racing…' : 'Race ▸';
    if (buttons.race.textContent !== run) buttons.race.textContent = run;
    buttons.race.disabled = !!race?.running;
    buttons.batch.disabled = !!batch?.running;
    tools.undo.disabled = painted === 0;
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const tip = hint(stage, 'Drag across a map to paint walls');
  const ptr = pointer(view.canvas, {
    down: (p) => {
      if (mode !== 'race' || !map) return;
      const t = tabAt(p.x, p.y);
      if (t >= 0) {
        sel = t;
        shown.set(t);
        return;
      }
      const c = cellAt(p.x, p.y);
      if (c < 0) return;
      stroke = { last: c, changed: 0 };
      paint(c);
    },
    move: (p) => {
      if (mode !== 'race' || !map) return;
      const c = cellAt(p.x, p.y);
      hover = c;
      if (stroke && p.pressed && c >= 0 && c !== stroke.last) {
        paintLine(stroke.last, c);
        stroke.last = c;
      }
    },
    up: () => endStroke(),
    leave: () => {
      hover = -1;
      endStroke();
    },
  });

  // Paint or erase one cell. Any change resets the race, since its searches no longer
  // match the map.
  function paint(c) {
    if (c === map.start || c === map.goal) return;
    const v = erase ? 0 : 1;
    if (map.walls[c] === v) return;
    if (race.started) newRace();
    map.walls[c] = v;
    race.cap = LIMIT * openCells(map);
    painted++;
    stroke.changed++;
    dirty = true;
    tip.hide();
  }

  function paintLine(a, b) {
    const W = map.W;
    let x0 = a % W;
    let y0 = (a - x0) / W;
    const x1 = b % W;
    const y1 = (b - x1) / W;
    const dx = Math.abs(x1 - x0);
    const dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1;
    const sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
      paint(y0 * W + x0);
      if (x0 === x1 && y0 === y1) break;
      const e2 = 2 * err;
      if (e2 >= dy) {
        err += dy;
        x0 += sx;
      }
      if (e2 <= dx) {
        err += dx;
        y0 += sy;
      }
    }
  }

  function endStroke() {
    if (!stroke) return;
    const n = stroke.changed;
    stroke = null;
    if (!n) return;
    narrate(
      {
        text: `You ${erase ? 'cleared' : 'painted'} ${plural(n, 'cell')}. Press Race to see how each planner copes with the new walls.`,
        short: `${plural(n, 'cell')} ${erase ? 'cleared' : 'painted'}. Press Race.`,
        prio: 5,
      },
      true,
    );
    refresh();
  }

  function panels() {
    if (!L.xs) return [];
    return L.compact ? [{ ...L.single, i: sel }] : L.panels;
  }

  // The cell under a point, in whichever map panel it falls.
  function cellAt(x, y) {
    const { xs, ys } = L;
    for (const P of panels()) {
      if (x < P.mx || x >= P.mx + P.mw || y < P.my || y >= P.my + P.mh) continue;
      let i = clamp(Math.floor((x - P.mx) / L.cell), 0, map.W - 1);
      let j = clamp(Math.floor((y - P.my) / L.cell), 0, map.H - 1);
      if (x - P.mx < xs[i]) i--;
      else if (x - P.mx >= xs[i + 1]) i++;
      if (y - P.my < ys[j]) j--;
      else if (y - P.my >= ys[j + 1]) j++;
      return clamp(j, 0, map.H - 1) * map.W + clamp(i, 0, map.W - 1);
    }
    return -1;
  }

  function tabAt(x, y) {
    if (!L.compact || !L.tabs) return -1;
    return L.tabs.findIndex((t) => x >= t.x && x < t.x + t.w && y >= t.y && y < t.y + t.h);
  }

  function layout(v) {
    const w = v.w;
    const h = v.h;
    L.compact = w < 620 || h < 480;
    L.pad = Math.max(16, Math.min(40, w * 0.04));
    const pad = L.pad;
    const want = L.compact ? SMALL : FULL;
    if (want !== dims) {
      dims = want;
      if (map) newMap(false);
    }
    shown.el.hidden = !L.compact;
    const { W, H } = dims;
    L.kicker = !L.compact && h >= 600;
    L.kickY = 62;
    L.narrY = L.compact ? (h < 300 ? 30 : 64) : L.kicker ? 94 : 70;
    const top = L.narrY + (L.compact ? 14 : 20);
    const bottom = h - 34;

    // Cell size, then pixel-snapped cell edges so tiles and walls stay crisp.
    let cell;
    if (L.compact) {
      const stacked = Math.min((w - pad * 2) / W, (bottom - top - 52 - 22) / H);
      const side = Math.min((w - pad * 2 - 132) / W, (bottom - top - 4 - 22) / H);
      L.side = side > stacked * 1.12;
      cell = L.side ? side : stacked;
    } else {
      L.gapX = Math.max(20, w * 0.028);
      L.colW = (w - pad * 2 - L.gapX) / 2;
      cell = Math.min(L.colW / W, ((bottom - top - 16) / 2 - 18 - 24) / H);
    }
    L.cell = Math.max(2, cell);
    L.xs = Array.from({ length: W + 1 }, (_, i) => Math.round(i * L.cell));
    L.ys = Array.from({ length: H + 1 }, (_, i) => Math.round(i * L.cell));
    const mw = L.xs[W];
    const mh = L.ys[H];
    L.mw = mw;
    L.mh = mh;

    if (L.compact) {
      // One map at a time, with tabs that double as a scoreboard.
      if (L.side) {
        const tw = Math.min(170, w - pad * 2 - mw - 16);
        const x0 = Math.round((w - (mw + 16 + tw)) / 2);
        const th = Math.min(46, (mh - 18) / 4);
        L.single = { mx: x0, my: Math.round(top + 4), mw, mh };
        L.tabs = ALGS.map((_, i) => ({ x: x0 + mw + 16, y: top + 4 + i * (th + 6), w: tw, h: th }));
      } else {
        const tw = (w - pad * 2 - 18) / 4;
        L.tabs = ALGS.map((_, i) => ({ x: pad + i * (tw + 6), y: top, w: tw, h: 40 }));
        L.single = { mx: Math.round((w - mw) / 2), my: Math.round(top + 52), mw, mh };
      }
      L.panels = null;
    } else {
      // Two by two: the A* pair on top, the local-search pair below.
      const blockH = (18 + mh + 24) * 2 + 16;
      const y0 = top + Math.max(0, (bottom - top - blockH) / 2);
      L.panels = ALGS.map((_, i) => {
        const mid = pad + (i % 2) * (L.colW + L.gapX) + L.colW / 2;
        return { i, mx: Math.round(mid - mw / 2), my: Math.round(y0 + (i >> 1) * (18 + mh + 24 + 16) + 18), mw, mh };
      });
      L.tabs = null;
    }

    // The batch view: two headline shares with a tally, a scatter of the duels and, on
    // larger stages, a strip of A*'s savings.
    if (L.compact) {
      const sy = L.narrY + 18;
      const colW = (w - pad * 2 - 14) / 2;
      L.stats = [
        { x: pad, y: sy, w: colW },
        { x: pad + colW + 14, y: sy, w: colW },
      ];
      const sq = Math.min(14, (w - pad * 2 - 19 * 3) / 20);
      L.tally = { x: pad, y: sy + 82, sq, gap: 3, cols: 20 };
      const py = L.tally.y + sq * 2 + 3 + 34;
      const side = Math.min(w - pad * 2 - 44, bottom - py - 30);
      L.plot = side > 90 ? { x: Math.round(pad + 38 + (w - pad * 2 - 44 - side) / 2), y: Math.round(py), w: side, h: side } : null;
      L.strip = null;
    } else {
      const side = Math.min((w - pad * 2) * 0.5, bottom - top - 56);
      const by = top + Math.max(0, (bottom - top - side - 56) / 2);
      L.plot = { x: Math.round(pad + 40), y: Math.round(by + 22), w: side, h: side };
      const rx = L.plot.x + side + Math.max(40, w * 0.05);
      const rw = w - pad - rx;
      L.stats = [
        { x: rx, y: by, w: rw },
        { x: rx, y: by + 216, w: rw },
      ];
      L.tally = { x: rx, y: by + 104, sq: Math.min(12, (rw - 19 * 4) / 20), gap: 4, cols: 20 };
      L.strip = { x: rx, y: L.stats[1].y + 140, w: rw };
    }
    dirty = true;
    traceDirty = true;
  }

  /* ---------------------------------------------------------------- */
  /* Drawing: map layers                                              */
  /* ---------------------------------------------------------------- */

  function sizeLayer(c, w, h) {
    c.width = Math.max(1, Math.ceil(w * view.dpr));
    c.height = Math.max(1, Math.ceil(h * view.dpr));
    const g = c.getContext('2d');
    g.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    return g;
  }

  // Tiles shaded by h (flat for blind A*), walls drawn like a floor plan, and the
  // plateau's dashed outline.
  function buildLayers() {
    dirty = false;
    const { W, H, N, walls, h, hMax, zone } = map;
    const { xs, ys } = L;
    const gap = L.cell >= 4.5 ? 1 : 0;
    const wall = (x, y) => x >= 0 && y >= 0 && x < W && y < H && walls[y * W + x] === 1;
    for (const shaded of [false, true]) {
      const g = sizeLayer(shaded ? layers.shaded : layers.plain, L.mw, L.mh);
      const levels = Array.from({ length: 16 }, () => new Path2D());
      for (let k = 0; k < N; k++) {
        if (walls[k]) continue;
        const x = k % W;
        const y = (k - x) / W;
        const t = shaded ? Math.pow(1 - h[k] / hMax, 1.6) : 0.15;
        levels[Math.round(t * 15)].rect(xs[x], ys[y], xs[x + 1] - xs[x] - gap, ys[y + 1] - ys[y] - gap);
      }
      levels.forEach((p, i) => {
        g.fillStyle = alpha(C.cream, 0.018 + (0.072 * i) / 15);
        g.fill(p);
      });
      const outline = new Path2D();
      g.fillStyle = alpha(C.cream, 0.12);
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          if (!walls[y * W + x]) continue;
          const x0 = xs[x];
          const x1 = xs[x + 1];
          const y0 = ys[y];
          const y1 = ys[y + 1];
          g.fillRect(x0, y0, x1 - x0, y1 - y0);
          if (!wall(x, y - 1)) {
            outline.moveTo(x0, y0 + 0.5);
            outline.lineTo(x1, y0 + 0.5);
          }
          if (!wall(x, y + 1)) {
            outline.moveTo(x0, y1 - 0.5);
            outline.lineTo(x1, y1 - 0.5);
          }
          if (!wall(x - 1, y)) {
            outline.moveTo(x0 + 0.5, y0);
            outline.lineTo(x0 + 0.5, y1);
          }
          if (!wall(x + 1, y)) {
            outline.moveTo(x1 - 0.5, y0);
            outline.lineTo(x1 - 0.5, y1);
          }
        }
      }
      g.strokeStyle = alpha(C.cream, 0.48);
      g.lineWidth = 1;
      g.lineCap = 'square';
      g.stroke(outline);
      if (shaded && zone) {
        g.strokeStyle = alpha(C.cream, 0.4);
        g.setLineDash([3, 3]);
        g.strokeRect(xs[zone.x0] + 0.5, ys[zone.y0] + 0.5, xs[zone.x1 + 1] - xs[zone.x0] - 1, ys[zone.y1 + 1] - ys[zone.y0] - 1);
        g.setLineDash([]);
      }
    }
  }

  function resetTrace() {
    traceDirty = false;
    for (const t of trace) {
      t.g = sizeLayer(t.canvas, L.mw, L.mh);
      t.drawn = new Uint8Array(map.N);
    }
  }

  // Paint the visits a planner made since the last frame. Each visit adds a little gold,
  // up to a cap, so repeated work glows brighter.
  function syncTrace(i, a) {
    const t = trace[i];
    const { W, N } = map;
    const { xs, ys } = L;
    const per = i === 3 ? 0.055 : 0.2;
    const cap = i === 3 ? 5 : 3;
    const g = t.g;
    g.fillStyle = C.gold;
    for (let k = 0; k < N; k++) {
      const n = Math.min(a.seen[k], cap);
      const d = n - t.drawn[k];
      if (d <= 0) continue;
      const x = k % W;
      const y = (k - x) / W;
      g.globalAlpha = 1 - Math.pow(1 - per, d);
      g.fillRect(xs[x], ys[y], xs[x + 1] - xs[x], ys[y + 1] - ys[y]);
      t.drawn[k] = n;
    }
    g.globalAlpha = 1;
  }

  /* ---------------------------------------------------------------- */
  /* Drawing: one planner's panel                                     */
  /* ---------------------------------------------------------------- */

  const cx = (P, c) => {
    const x = c % map.W;
    return P.mx + (L.xs[x] + L.xs[x + 1]) / 2;
  };
  const cy = (P, c) => {
    const y = Math.floor(c / map.W);
    return P.my + (L.ys[y] + L.ys[y + 1]) / 2;
  };

  function tracePath(P, cells, upto = cells.length) {
    ctx.beginPath();
    for (let i = 0; i < upto; i++) {
      const c = cells[i];
      if (i) ctx.lineTo(cx(P, c), cy(P, c));
      else ctx.moveTo(cx(P, c), cy(P, c));
    }
  }

  function fillCells(P, each, color, inset) {
    const { W } = map;
    const { xs, ys } = L;
    ctx.fillStyle = color;
    each((c) => {
      const x = c % W;
      const y = (c - x) / W;
      ctx.fillRect(P.mx + xs[x] + inset, P.my + ys[y] + inset, xs[x + 1] - xs[x] - inset * 2, ys[y + 1] - ys[y] - inset * 2);
    });
  }

  function drawPanel(P, time) {
    const i = P.i;
    const a = race.algs[i];
    const s = L.cell;
    const lw = layers.plain.width / view.dpr;
    const lh = layers.plain.height / view.dpr;
    ctx.drawImage(i === 0 ? layers.plain : layers.shaded, P.mx, P.my, lw, lh);
    if (race.started) {
      syncTrace(i, a);
      ctx.drawImage(trace[i].canvas, P.mx, P.my, lw, lh);
      if (!a.done && i === 2) fillCells(P, a.eachSearched, COL.active, 0);
      if (!a.done && i < 3) fillCells(P, a.eachOpen, COL.frontier, s >= 6 ? 1 : 0.5);
    }
    drawLabels(P, i);

    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    if (race.started && i === 3) drawWalks(P, a);
    if (race.started && !a.solved && i >= 2 && a.path.length > 1) {
      tracePath(P, committed(a));
      ctx.strokeStyle = COL.committed;
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    if (a.solved && a.shown) {
      const k = reduced ? 1 : easeOut((performance.now() - a.at) / 700);
      tracePath(P, a.shown, Math.max(2, Math.ceil(a.shown.length * k)));
      ctx.strokeStyle = COL.halo;
      ctx.lineWidth = 5;
      ctx.stroke();
      ctx.strokeStyle = C.cream;
      ctx.lineWidth = 1.7;
      ctx.stroke();
    }

    // Start, goal, and where a local search currently stands.
    const r0 = clamp(s * 0.55, 3, 6.5);
    const gx = cx(P, map.goal);
    const gy = cy(P, map.goal);
    glow(ctx, gx, gy, r0 * 3.4, C.gold, 0.5);
    dot(ctx, gx, gy, r0 * 0.85, C.gold);
    dot(ctx, cx(P, map.start), cy(P, map.start), r0, C.midnight, C.cream, 1.4);
    if (race.started && i >= 2 && !a.solved) {
      const at = i === 2 ? a.cur : a.best;
      const x = cx(P, at);
      const y = cy(P, at);
      const r = clamp(s * 0.36, 2, 4.2);
      if (a.done) {
        line(ctx, x - r0 * 0.8, y - r0 * 0.8, x + r0 * 0.8, y + r0 * 0.8, C.ember, 1.6);
        line(ctx, x + r0 * 0.8, y - r0 * 0.8, x - r0 * 0.8, y + r0 * 0.8, C.ember, 1.6);
      } else {
        if (i === 2 && a.stuck >= STUCK) glow(ctx, x, y, s * 4, C.amber, reduced ? 0.3 : 0.24 + 0.08 * Math.sin(time * 5));
        dot(ctx, x, y, r, C.amber);
        dot(ctx, x, y, r + 2.5, null, alpha(C.amber, 0.55), 1);
      }
    }
    if (hover >= 0 && !L.coarse) {
      const x = hover % map.W;
      const y = (hover - x) / map.W;
      ctx.strokeStyle = alpha(C.cream, 0.75);
      ctx.lineWidth = 1;
      ctx.strokeRect(P.mx + L.xs[x] + 0.5, P.my + L.ys[y] + 0.5, L.xs[x + 1] - L.xs[x] - 1, L.ys[y + 1] - L.ys[y] - 1);
    }
    drawCaptions(P, a, i);
  }

  // The random walk's recent trails: the walk under way, this round's finished walks and
  // earlier rounds fading. Endpoints show the verdict: gold accepted, ember rejected.
  function drawWalks(P, a) {
    const fade = !a.done ? 1 : reduced ? 0 : clamp(1 - (performance.now() - a.at) / 900);
    if (fade <= 0) return;
    const width = L.cell >= 6 ? 1.1 : 0.9;
    for (const t of a.trails) {
      const age = a.rounds - t.round;
      const k = (age <= 0 ? 0.5 : 0.2) * fade;
      tracePath(P, t.cells);
      ctx.strokeStyle = alpha(C.amber, k);
      ctx.lineWidth = width;
      ctx.stroke();
      const e = t.cells[t.cells.length - 1];
      dot(ctx, cx(P, e), cy(P, e), clamp(L.cell * 0.22, 1.3, 2.4), alpha(t.ok ? C.gold : C.ember, Math.min(1, k * 1.6)));
    }
    if (a.done) return;
    for (const w of a.ends) {
      tracePath(P, w.cells);
      ctx.strokeStyle = alpha(C.amber, 0.7);
      ctx.lineWidth = width;
      ctx.stroke();
    }
    if (a.walk && a.walk.cells.length > 1) {
      tracePath(P, a.walk.cells);
      ctx.strokeStyle = COL.trail;
      ctx.lineWidth = width + 0.3;
      ctx.stroke();
    }
  }

  // The plan so far without its loops, cached until it grows.
  function committed(a) {
    if (a.cutFor !== a.path || a.cutLen !== a.path.length) {
      a.cut = loopErase(a.path, map.N);
      a.cutFor = a.path;
      a.cutLen = a.path.length;
    }
    return a.cut;
  }

  // Small map labels on a dark backing, so walls and explored cells never swallow them.
  function tag(text, x, y, size) {
    const w = textWidth(ctx, text.toUpperCase(), { size }) + text.length + 8;
    roundRect(ctx, x - 4, y - size - 1, w, size + 6, 3);
    ctx.fillStyle = alpha(C.midnight, 0.78);
    ctx.fill();
    label(ctx, text, x, y, { size, upper: true, track: 1, color: INK[2] });
  }

  function drawLabels(P, i) {
    const { xs, ys } = L;
    const z = map.zone;
    const t = map.trap;
    const size = L.cell >= 7 ? 9 : 8;
    if (z && i > 0) {
      const zw = xs[z.x1 + 1] - xs[z.x0];
      const text = zw >= 118 ? `plateau · h = ${z.h}` : zw >= 56 ? 'plateau' : '';
      if (text) tag(text, P.mx + xs[z.x0] + 6, P.my + ys[z.y0] + size + 6, size);
    }
    if (t && xs[t.x1 + 1] - xs[t.x0] >= 34) tag('trap', P.mx + xs[t.x0] + 6, P.my + ys[t.y0] + size + 5, size);
  }

  function stateText(a, i) {
    const A = ALGS[i];
    let t;
    if (!race.started) t = 'waiting for the start';
    else if (a.solved) {
      const extra = i < 2 ? ' · optimal' : i === 3 ? ` · ${plural(a.restarts, 'restart')}` : '';
      t = `${L.compact ? `${ticks(a)} ticks · ` : ''}path ${a.shown.length - 1}${extra}`;
    }
    else if (a.done) t = a.reason === 'time limit' ? 'time limit reached' : a.reason === 'no path' ? 'no path exists' : 'nothing better is reachable';
    else if (i < 2) t = `open ${fmt.int(countOpen(a))} · closed ${fmt.int(a.work)}`;
    else if (i === 2) t = a.stuck >= STUCK ? `bfs: ${fmt.int(a.stuck)} exp. without a better h` : `${plural(a.improved, 'improvement')} of h`;
    else t = `walks of ${a.L} steps · ${plural(a.restarts, 'restart')}`;
    return L.compact ? `${A.short} · ${t}` : t;
  }

  function drawCaptions(P, a, i) {
    const A = ALGS[i];
    const started = race.started;
    const tone = !started ? INK[3] : !a.done ? C.amber : a.solved ? C.gold : C.ember;
    if (!L.compact) {
      const count = !started ? 'ready' : a.done && !a.solved ? (a.reason === 'time limit' ? 'gave up' : 'no path') : `${fmt.int(a.work)} ${A.unit}`;
      const room = P.mw - textWidth(ctx, count, { size: 11 }) - 16;
      const name = textWidth(ctx, A.name, { size: 10.5 }) + A.name.length * 1.3 < room ? A.name : A.short;
      label(ctx, name, P.mx, P.my - 7, { size: 10.5, upper: true, track: 1.3, color: INK[2] });
      label(ctx, count, P.mx + P.mw, P.my - 7, { size: 11, align: 'right', color: tone });
    }

    // The clock bar: how much of the time limit this planner has used.
    const by = P.my + P.mh + 5;
    line(ctx, P.mx, by, P.mx + P.mw, by, INK.faint, 2);
    const used = started ? clamp((a.finish ?? race.clock) / race.cap) : 0;
    if (used > 0) line(ctx, P.mx, by, P.mx + P.mw * used, by, tone, 2);

    // What the planner is doing, and where it finished.
    const fy = by + 14;
    const rank = L.compact ? '' : a.rank ? `${ORD[a.rank - 1]} · ${ticks(a)} ticks` : a.done && started ? `${ticks(a)} ticks` : '';
    const rw = rank ? textWidth(ctx, rank, { size: 10 }) + 12 : 0;
    const busy = i === 2 && started && !a.done && a.stuck >= STUCK;
    labelFit(ctx, stateText(a, i), P.mx, fy, P.mw - rw, { size: 10, minSize: 8.5, color: busy ? C.amber : INK[3] });
    if (rank) label(ctx, rank, P.mx + P.mw, fy, { size: 10, align: 'right', color: a.rank === 1 ? C.gold : a.solved ? INK[2] : C.ember });
  }

  function countOpen(a) {
    let n = 0;
    a.eachOpen(() => n++);
    return n;
  }

  function drawTabs() {
    L.tabs.forEach((t, i) => {
      const a = race.algs[i];
      const on = i === sel;
      roundRect(ctx, t.x + 0.5, t.y + 0.5, t.w - 1, t.h - 1, 9);
      ctx.fillStyle = on ? alpha(C.cream, 0.07) : alpha(C.midnight, 0.4);
      ctx.fill();
      ctx.strokeStyle = on ? alpha(C.cream, 0.7) : INK.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      const tone = !race.started ? INK[3] : !a.done ? C.amber : a.solved ? C.gold : C.ember;
      const big = t.h >= 38;
      const ny = t.y + (big ? 16 : t.h / 2 - 2);
      const vy = t.y + (big ? 31 : t.h / 2 + 10);
      labelFit(ctx, ALGS[i].tab, t.x + 9, ny, t.w - 18, { size: 9.5, minSize: 8, upper: true, track: 0.8, color: on ? C.cream : INK[2] });
      label(ctx, !race.started ? '—' : a.done && !a.solved ? 'gave up' : fmt.int(a.work), t.x + 9, vy, { size: 11.5, color: tone });
      if (a.rank) label(ctx, ORD[a.rank - 1], t.x + t.w - 8, vy, { size: 9.5, align: 'right', color: a.rank === 1 ? C.gold : INK[3] });
    });
  }

  function drawNarration() {
    let { text, short } = narration;
    if (narration.live) [text, short] = narration.live();
    const o = { size: L.compact ? 16 : 19, minSize: L.compact ? 11 : 12, font: 'serif', italic: true, color: narration.tone };
    labelFit(ctx, L.compact ? short : text, L.pad, L.narrY, view.w - L.pad * 2, o);
  }

  function raceEnd() {
    return race.over ? Math.max(...race.algs.map((a) => a.finish ?? 0)) : race.clock;
  }

  function drawRace(time) {
    if (L.kicker) {
      let head = `Race ${raceNo} · clock ${fmt.int(race.clock)} ticks`;
      if (!race.started) head = 'One map · one clock · four planners';
      else if (race.over) head = `Race ${raceNo} · finished at ${fmt.int(raceEnd())} ticks`;
      label(ctx, head, L.pad, L.kickY, { size: 11, upper: true, track: 1.6, color: C.gold });
      label(ctx, `time limit ${fmt.int(race.cap)} ticks`, view.w - L.pad, L.kickY, { size: 11, align: 'right', color: INK[3] });
    }
    drawNarration();
    for (const P of panels()) drawPanel(P, time);
    if (L.compact) drawTabs();
  }

  /* ---------------------------------------------------------------- */
  /* Drawing: the batch                                               */
  /* ---------------------------------------------------------------- */

  function drawBatch(time) {
    const s = batch ? batchStats() : { done: 0, wins: 0, rate: 0, cut: 0 };
    const running = batch?.running;
    if (L.kicker) {
      label(ctx, `Batch · ${MAPS} seeded maps · simulated`, L.pad, L.kickY, { size: 11, upper: true, track: 1.6, color: C.gold });
      label(ctx, `${s.done} / ${MAPS} maps`, view.w - L.pad, L.kickY, { size: 11, align: 'right', color: running ? C.amber : INK[3] });
    }
    drawNarration();
    const tone = running ? C.amber : C.gold;
    const big = L.compact ? 34 : 54;
    const caption = { size: L.compact ? 9.5 : 10.5, minSize: 8, color: INK[3] };
    const blocks = [
      {
        kick: L.compact ? 'RRW vs EHC' : 'Random walk vs hill-climbing',
        value: s.done ? fmt.pct(s.rate) : '—',
        lines: L.compact ? ['of maps: RRW faster', 'or alone to solve'] : ['of maps where the random walk finished first,', 'or solved what hill-climbing could not'],
      },
      {
        kick: L.compact ? 'A* + h vs h = 0' : 'A* + heuristic vs uninformed A*',
        value: s.done ? fmt.pct(s.cut) : '—',
        lines: L.compact ? ['fewer expansions,', 'on average'] : ['fewer node expansions,', 'averaged over the maps'],
      },
    ];
    blocks.forEach((b, k) => {
      const r = L.stats[k];
      labelFit(ctx, b.kick, r.x, r.y + 10, r.w, { size: L.compact ? 9.5 : 10.5, minSize: 8, upper: true, track: 1.2, color: C.gold });
      label(ctx, b.value, r.x, r.y + 12 + big * 0.92, { size: big, font: 'serif', color: tone });
      b.lines.forEach((c, j) => labelFit(ctx, c, r.x, r.y + 26 + big + j * 13, r.w, caption));
    });

    // Tally: one square per map, filled as each finishes.
    const T = L.tally;
    for (let k = 0; k < MAPS; k++) {
      const x = T.x + (k % T.cols) * (T.sq + T.gap);
      const y = T.y + Math.floor(k / T.cols) * (T.sq + T.gap);
      const r = batch?.results[k];
      if (r) {
        ctx.fillStyle = r.win ? C.gold : r.wS ? alpha(C.cream, 0.3) : C.ember;
        ctx.fillRect(x, y, T.sq, T.sq);
      } else {
        ctx.strokeStyle = INK.line;
        ctx.lineWidth = 1;
        ctx.strokeRect(x + 0.5, y + 0.5, T.sq - 1, T.sq - 1);
      }
    }
    if (!L.compact) {
      const ly = T.y + T.sq * 2 + T.gap + 20;
      let lx = T.x;
      for (const [c, t] of [
        [C.gold, 'RRW won'],
        [alpha(C.cream, 0.3), 'EHC won'],
        [C.ember, 'RRW gave up'],
      ]) {
        ctx.fillStyle = c;
        ctx.fillRect(lx, ly - 8, 8, 8);
        label(ctx, t, lx + 13, ly, { size: 10, color: INK[3] });
        lx += 13 + textWidth(ctx, t, { size: 10 }) + 16;
      }
    }
    if (L.plot) drawScatter(L.plot);
    if (L.strip) drawStrip(L.strip);
  }

  // Each map is one dot: hill-climbing's time across, the random walk's time up. Below the
  // diagonal the random walk finished first.
  function drawScatter(R) {
    // The axes span from a round value below the fastest finish to just past the limit.
    const results = batch?.results ?? [];
    const fastest = Math.min(Infinity, ...results.map((r) => Math.min(r.eT, r.wT)));
    const lo = fastest < 45 ? 10 : fastest < 150 ? 30 : 100;
    const cap = Math.max(1000, ...results.map((r) => r.cap));
    const hi = cap * 1.15;
    const k = (v) => (Math.log(Math.max(lo, v)) - Math.log(lo)) / (Math.log(hi) - Math.log(lo));
    const X = (v) => R.x + k(v) * R.w;
    const Y = (v) => R.y + R.h - k(v) * R.h;
    const size = L.compact ? 9 : 9.5;
    for (const v of [10, 30, 100, 300, 1000, 3000, 10000]) {
      if (v < lo) continue;
      if (v > hi) break;
      const t = v >= 1000 ? `${v / 1000}k` : String(v);
      line(ctx, X(v), R.y, X(v), R.y + R.h, INK.faint);
      line(ctx, R.x, Y(v), R.x + R.w, Y(v), INK.faint);
      label(ctx, t, X(v), R.y + R.h + 13, { size, align: 'center', color: INK[3] });
      label(ctx, t, R.x - 6, Y(v), { size, align: 'right', baseline: 'middle', color: INK[3] });
    }
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = 1;
    ctx.strokeRect(R.x + 0.5, R.y + 0.5, R.w - 1, R.h - 1);
    line(ctx, X(lo), Y(lo), X(hi), Y(hi), INK[4], 1, [4, 4]);
    if (results.length) {
      // The time limit: a planner that gave up sits on this line.
      line(ctx, X(cap), R.y, X(cap), R.y + R.h, alpha(C.ember, 0.35), 1, [2, 3]);
      line(ctx, R.x, Y(cap), R.x + R.w, Y(cap), alpha(C.ember, 0.35), 1, [2, 3]);
      label(ctx, 'time limit', X(cap) - 5, Y(cap) + 13, { size, align: 'right', color: alpha(C.ember, 0.75) });
    }
    label(ctx, 'RRW faster', R.x + R.w - 6, R.y + R.h - 8, { size, align: 'right', upper: true, track: 1, color: C.gold });
    label(ctx, 'EHC faster', R.x + 8, Y(cap) + 18, { size, upper: true, track: 1, color: INK[3] });
    label(ctx, L.compact ? 'EHC ticks →' : 'hill-climbing · ticks to finish →', R.x + R.w / 2, R.y + R.h + 28, { size, align: 'center', upper: true, track: 1, color: INK[3] });
    label(ctx, L.compact ? 'RRW ticks ↑' : 'random walk · ticks ↑', R.x - 32, R.y - 10, { size, upper: true, track: 1, color: INK[3] });
    const now = performance.now();
    for (const r of results) {
      const e = reduced ? 1 : easeOut((now - r.at) / 350);
      const x = X(r.eT);
      const y = Y(r.wT);
      const rad = (L.compact ? 3 : 3.6) * (0.4 + 0.6 * e);
      if (r.win) {
        if (e < 1) glow(ctx, x, y, 14, C.gold, 0.6 * (1 - e));
        dot(ctx, x, y, rad, alpha(C.gold, 0.9 * e));
      } else if (r.wS) dot(ctx, x, y, rad, null, alpha(C.cream, 0.6 * e), 1.2);
      else dot(ctx, x, y, rad, null, alpha(C.ember, e), 1.4);
    }
  }

  // A*'s saving on each map as a dot on 0–100%, with the mean marked.
  function drawStrip(R) {
    const x0 = R.x + 2;
    const x1 = R.x + R.w - 8;
    const y = R.y;
    line(ctx, x0, y, x1, y, INK.line);
    for (const v of [0, 0.5, 1]) {
      const x = lerp(x0, x1, v);
      line(ctx, x, y - 3, x, y + 3, INK[4]);
      label(ctx, `${v * 100}%`, x, y + 17, { size: 9.5, align: v === 0 ? 'left' : v === 1 ? 'right' : 'center', color: INK[3] });
    }
    if (!batch?.results.length) return;
    batch.results.forEach((r, k) => {
      if (r.cut != null) dot(ctx, lerp(x0, x1, clamp(r.cut)), y - 7 - ((k * 7) % 5) * 2, 2.2, alpha(C.gold, 0.7));
    });
    const mx = lerp(x0, x1, clamp(batchStats().cut));
    line(ctx, mx, y - 20, mx, y + 4, C.gold, 1.4);
    label(ctx, `mean ${fmt.pct(batchStats().cut, 0)}`, mx, y - 25, { size: 10, align: 'center', color: C.gold });
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    frame++;
    if (batch?.running) runBatch();
    if (race?.running) advanceRace(dt);
    for (const e of events) onEvent(e);
    events.length = 0;
    if (!L.xs) layout(view);
    if (dirty) buildLayers();
    if (traceDirty) resetTrace();

    view.clear();
    if (mode === 'race') drawRace(time);
    else drawBatch(time);

    if (frame % 6 === 0 || !race.running) refresh();
    if (mode === 'batch') {
      const done = batch?.results.length ?? 0;
      stat.set(L.compact ? `${done}/${MAPS} maps` : `seeded suite · ${done}/${MAPS} maps · ${fmt.int(batch?.ticks ?? 0)} ticks simulated`);
    } else {
      const solved = race.algs.filter((a) => a.solved).length;
      const clock = fmt.int(raceEnd());
      const extra = painted ? ` · ${plural(painted, 'cell')} painted` : '';
      const full = `seed ${seed} · race ${raceNo} · clock ${clock} / ${fmt.int(race.cap)} ticks · ${solved} of 4 solved${extra}`;
      stat.set(L.compact ? `seed ${seed} · t ${clock}` : full);
    }
  });

  L.coarse = matchMedia('(pointer: coarse)').matches;
  newMap(false);

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
