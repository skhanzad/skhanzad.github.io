// Particle formations.
// Every generator returns N points in the formation's own local space, packed as
// [x, y, z, tone]. Tone (0..1) indexes the palette ramp in the render shader:
// 0 ember, 1/3 amber, 2/3 gold, 1 cream.

const TAU = Math.PI * 2;

export function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function gauss(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * r());
}

function onSphere(r, out = [0, 0, 0]) {
  const z = r() * 2 - 1;
  const a = r() * TAU;
  const s = Math.sqrt(1 - z * z);
  out[0] = s * Math.cos(a);
  out[1] = s * Math.sin(a);
  out[2] = z;
  return out;
}

// Rotate [x, y, z] by Euler angles (X, then Y, then Z).
function rotate(v, rx, ry, rz) {
  let [x, y, z] = v;
  let c = Math.cos(rx), s = Math.sin(rx);
  [y, z] = [y * c - z * s, y * s + z * c];
  c = Math.cos(ry); s = Math.sin(ry);
  [x, z] = [x * c + z * s, -x * s + z * c];
  c = Math.cos(rz); s = Math.sin(rz);
  [x, y] = [x * c - y * s, x * s + y * c];
  return [x, y, z];
}

class Cloud {
  constructor(n) {
    this.n = n;
    this.i = 0;
    this.data = new Float32Array(n * 4);
  }
  get full() {
    return this.i >= this.n;
  }
  push(x, y, z, tone) {
    if (this.i >= this.n) return;
    const o = this.i++ * 4;
    this.data[o] = x;
    this.data[o + 1] = y;
    this.data[o + 2] = z;
    this.data[o + 3] = Math.min(1, Math.max(0, tone));
  }
  // Sprinkle the remainder of the budget as a faint halo so every particle has a home.
  fillHalo(r, radius, tone = 0.2) {
    const v = [0, 0, 0];
    while (!this.full) {
      onSphere(r, v);
      const d = radius * (0.55 + 0.6 * Math.cbrt(r()));
      this.push(v[0] * d, v[1] * d, v[2] * d * 0.6, tone + r() * 0.15);
    }
  }
}

// Reorder points along a Z-order curve so that particle i lands in roughly the same
// region of every formation: morphs then read as one shape becoming another rather
// than as an explosion. Companion arrays (a formation's second state) follow the
// same order.
function coherent(data, ...companions) {
  const n = data.length / 4;
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity;
  for (let i = 0; i < n; i++) {
    const x = data[i * 4], y = data[i * 4 + 1];
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  const sx = 1023 / Math.max(1e-6, maxX - minX);
  const sy = 1023 / Math.max(1e-6, maxY - minY);
  const spread = (v) => {
    v &= 0x3ff;
    v = (v | (v << 8)) & 0x00ff00ff;
    v = (v | (v << 4)) & 0x0f0f0f0f;
    v = (v | (v << 2)) & 0x33333333;
    v = (v | (v << 1)) & 0x55555555;
    return v;
  };
  const code = new Uint32Array(n);
  const order = new Uint32Array(n);
  for (let i = 0; i < n; i++) {
    const qx = ((data[i * 4] - minX) * sx) | 0;
    const qy = ((data[i * 4 + 1] - minY) * sy) | 0;
    code[i] = spread(qx) | (spread(qy) << 1);
    order[i] = i;
  }
  order.sort((a, b) => code[a] - code[b]);
  const reorder = (src) => {
    const out = new Float32Array(src.length);
    for (let k = 0; k < n; k++) out.set(src.subarray(order[k] * 4, order[k] * 4 + 4), k * 4);
    return out;
  };
  return companions.length ? [reorder(data), ...companions.map(reorder)] : reorder(data);
}

// Chaikin corner cutting, keeps the end points.
function smooth(points, passes = 2) {
  let pts = points;
  for (let p = 0; p < passes; p++) {
    const out = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      const [ax, ay] = pts[i];
      const [bx, by] = pts[i + 1];
      out.push([ax * 0.75 + bx * 0.25, ay * 0.75 + by * 0.25], [ax * 0.25 + bx * 0.75, ay * 0.25 + by * 0.75]);
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

function resample(points, count, z) {
  const lengths = [0];
  for (let i = 1; i < points.length; i++) {
    const dx = points[i][0] - points[i - 1][0];
    const dy = points[i][1] - points[i - 1][1];
    lengths.push(lengths[i - 1] + Math.hypot(dx, dy));
  }
  const total = lengths[lengths.length - 1];
  const out = new Float32Array(count * 4);
  let seg = 1;
  for (let k = 0; k < count; k++) {
    const target = (k / (count - 1)) * total;
    while (seg < lengths.length - 1 && lengths[seg] < target) seg++;
    const span = lengths[seg] - lengths[seg - 1] || 1;
    const f = (target - lengths[seg - 1]) / span;
    out[k * 4] = points[seg - 1][0] + (points[seg][0] - points[seg - 1][0]) * f;
    out[k * 4 + 1] = points[seg - 1][1] + (points[seg][1] - points[seg - 1][1]) * f;
    out[k * 4 + 2] = z;
    out[k * 4 + 3] = k / (count - 1);
  }
  return { data: out, length: total };
}

/* ------------------------------------------------------------------ */
/* 1. Labyrinth: a circular maze carved by a seeded backtracker, plus  */
/*    the path through it (Ariadne's thread).                          */
/* ------------------------------------------------------------------ */
export function labyrinth(n, seed = 12) {
  const r = rng(seed);
  const RINGS = 7;
  const R0 = 0.24;
  const R1 = 1.62;
  const W = (R1 - R0) / RINGS;
  const H = 0.13;

  const counts = [];
  const offset = [];
  let cells = 8;
  let total = 0;
  for (let i = 0; i < RINGS; i++) {
    const mid = R0 + (i + 0.5) * W;
    if (i > 0 && (TAU * mid) / cells > 1.9 * W) cells *= 2;
    counts.push(cells);
    offset.push(total);
    total += cells;
  }
  const ringOf = new Int32Array(total);
  const idxOf = new Int32Array(total);
  for (let i = 0; i < RINGS; i++) {
    for (let j = 0; j < counts[i]; j++) {
      ringOf[offset[i] + j] = i;
      idxOf[offset[i] + j] = j;
    }
  }
  const cell = (i, j) => offset[i] + (((j % counts[i]) + counts[i]) % counts[i]);
  const parentOf = (i, j) => cell(i - 1, Math.floor((j * counts[i - 1]) / counts[i]));
  const neighbours = (id) => {
    const i = ringOf[id];
    const j = idxOf[id];
    const out = [cell(i, j + 1), cell(i, j - 1)];
    if (i > 0) out.push(parentOf(i, j));
    if (i < RINGS - 1) {
      const k = counts[i + 1] / counts[i];
      for (let m = 0; m < k; m++) out.push(cell(i + 1, j * k + m));
    }
    return out;
  };

  // Carve a perfect maze.
  const open = new Set();
  const key = (a, b) => (a < b ? a * 4096 + b : b * 4096 + a);
  const seen = new Uint8Array(total);
  const stack = [cell(RINGS - 1, 0)];
  seen[stack[0]] = 1;
  while (stack.length) {
    const cur = stack[stack.length - 1];
    const options = neighbours(cur).filter((x) => !seen[x]);
    if (!options.length) {
      stack.pop();
      continue;
    }
    const next = options[Math.floor(r() * options.length)];
    open.add(key(cur, next));
    seen[next] = 1;
    stack.push(next);
  }

  // Entrance at the bottom of the outer ring; the goal is the innermost cell farthest from it.
  const outer = RINGS - 1;
  const entry = cell(outer, Math.round(0.75 * counts[outer] - 0.5));
  const dist = new Int32Array(total).fill(-1);
  const prev = new Int32Array(total).fill(-1);
  const queue = [entry];
  dist[entry] = 0;
  for (let h = 0; h < queue.length; h++) {
    const a = queue[h];
    for (const b of neighbours(a)) {
      if (dist[b] < 0 && open.has(key(a, b))) {
        dist[b] = dist[a] + 1;
        prev[b] = a;
        queue.push(b);
      }
    }
  }
  let goal = cell(0, 0);
  for (let j = 0; j < counts[0]; j++) if (dist[cell(0, j)] > dist[goal]) goal = cell(0, j);

  // Walls: arcs on each cell's inner edge, radials on its counter-clockwise edge.
  const walls = [];
  for (let i = 0; i < RINGS; i++) {
    const c = counts[i];
    const rin = R0 + i * W;
    for (let j = 0; j < c; j++) {
      const id = cell(i, j);
      const a0 = (j / c) * TAU;
      const a1 = ((j + 1) / c) * TAU;
      const passIn = i === 0 ? id === goal : open.has(key(id, parentOf(i, j)));
      if (!passIn) walls.push({ arc: true, r: rin, a0, a1, len: rin * (a1 - a0) });
      if (!open.has(key(id, cell(i, j + 1)))) walls.push({ arc: false, a: a1, r0: rin, r1: rin + W, len: W });
    }
  }
  for (let j = 0; j < counts[outer]; j++) {
    if (cell(outer, j) === entry) continue;
    const a0 = (j / counts[outer]) * TAU;
    const a1 = ((j + 1) / counts[outer]) * TAU;
    walls.push({ arc: true, r: R1, a0, a1, len: R1 * (a1 - a0) });
  }
  const cum = [];
  let wallLength = 0;
  for (const w of walls) cum.push((wallLength += w.len));

  const cloud = new Cloud(n);
  const nTicks = Math.floor(n * 0.04);
  const nCore = Math.floor(n * 0.035);
  const nFloor = Math.floor(n * 0.03);
  const nWalls = n - nTicks - nCore - nFloor;

  for (let k = 0; k < nWalls; k++) {
    const u = r() * wallLength;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < u) lo = m + 1;
      else hi = m;
    }
    const w = walls[lo];
    let rad, ang;
    if (w.arc) {
      rad = w.r;
      ang = w.a0 + r() * (w.a1 - w.a0);
    } else {
      rad = w.r0 + r() * (w.r1 - w.r0);
      ang = w.a;
    }
    rad += gauss(r) * 0.004;
    const rim = r() < 0.45;
    const z = rim ? H + gauss(r) * 0.004 : Math.pow(r(), 0.8) * H;
    // Walls stay in the ember-amber range so the gold thread reads as the brightest line.
    const depth = Math.max(0, 1 - rad / R1);
    const tone = 0.03 + 0.36 * Math.pow(depth, 1.2) + (rim ? 0.06 : 0) + gauss(r) * 0.035;
    cloud.push(Math.cos(ang) * rad, Math.sin(ang) * rad, z, tone);
  }
  // A calibrated dial around the rim: the instrument the maze sits in.
  for (let k = 0; k < nTicks; k++) {
    const t = Math.floor(r() * 144);
    const ang = (t / 144) * TAU;
    const major = t % 6 === 0;
    const rad = R1 + 0.09 + r() * (major ? 0.11 : 0.05);
    cloud.push(Math.cos(ang) * rad, Math.sin(ang) * rad, gauss(r) * 0.003, major ? 0.5 : 0.26);
  }
  // The centre: what the thread is looking for.
  for (let k = 0; k < nCore; k++) {
    const s = Math.abs(gauss(r)) * 0.06;
    const v = onSphere(r);
    cloud.push(v[0] * s, v[1] * s, H * 0.6 + v[2] * s, 1);
  }
  for (let k = 0; k < nFloor; k++) {
    const rad = R1 * Math.sqrt(r());
    const ang = r() * TAU;
    cloud.push(Math.cos(ang) * rad, Math.sin(ang) * rad, 0, 0.05 + r() * 0.1);
  }

  // Ariadne's thread: the solution path from the entrance to the centre.
  const route = [];
  for (let c = goal; c !== -1; c = prev[c]) route.push(c);
  route.reverse();
  const mid = (i) => R0 + (i + 0.5) * W;
  const angle = (id) => ((idxOf[id] + 0.5) / counts[ringOf[id]]) * TAU;
  const pt = (rad, a) => [rad * Math.cos(a), rad * Math.sin(a)];
  const arcTo = (pts, rad, a0, a1) => {
    const d = ((a1 - a0 + 3 * Math.PI) % TAU) - Math.PI;
    const steps = Math.max(1, Math.ceil((Math.abs(d) * rad) / 0.03));
    for (let s = 1; s <= steps; s++) pts.push(pt(rad, a0 + (d * s) / steps));
  };
  const ea = angle(entry);
  const pts = [pt(R1 + 0.55, ea), pt(R1 + 0.1, ea), pt(mid(outer), ea)];
  for (let k = 1; k < route.length; k++) {
    const a = route[k - 1];
    const b = route[k];
    const ia = ringOf[a];
    const ib = ringOf[b];
    const aa = angle(a);
    const ab = angle(b);
    if (ia === ib) arcTo(pts, mid(ia), aa, ab);
    else if (ib < ia) {
      pts.push(pt(mid(ib), aa));
      arcTo(pts, mid(ib), aa, ab);
    } else {
      arcTo(pts, mid(ia), aa, ab);
      pts.push(pt(mid(ib), ab));
    }
  }
  const ga = angle(goal);
  pts.push(pt(R0 * 0.45, ga), [0, 0]);
  const path = resample(smooth(pts, 2), 2048, H * 0.55);

  return { points: coherent(cloud.data), path: path.data, pathLength: path.length };
}

/* ------------------------------------------------------------------ */
/* 2. Trajectories: the 30 audited runs of Project Ariadne. 7 faithful */
/*    (clean, concentric) and 23 violations (ruptured, off-centre).    */
/* ------------------------------------------------------------------ */
export function trajectories(n, seed = 5) {
  const r = rng(seed);
  const cols = 6;
  const rows = 5;
  const gap = 0.62;
  const rad = 0.2;
  const total = cols * rows;
  const order = [...Array(total).keys()];
  for (let i = total - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [order[i], order[j]] = [order[j], order[i]];
  }
  const faithful = new Set(order.slice(0, 7));
  const cloud = new Cloud(n);
  const per = Math.floor(n / total);
  const v = [0, 0, 0];
  for (let k = 0; k < total; k++) {
    const cx = ((k % cols) - (cols - 1) / 2) * gap;
    const cy = ((rows - 1) / 2 - Math.floor(k / cols)) * gap;
    const count = k === total - 1 ? n - cloud.i : per;
    const good = faithful.has(k);
    const jet = onSphere(r, [0, 0, 0]);
    jet[2] *= 0.4;
    const core = good ? [0, 0, 0] : jet.map((c) => c * 0.085);
    for (let m = 0; m < count; m++) {
      const u = r();
      if (u < 0.2) {
        const s = 0.034;
        cloud.push(cx + core[0] + gauss(r) * s, cy + core[1] + gauss(r) * s, core[2] + gauss(r) * s, good ? 1 : 0.32);
      } else if (!good && u > 0.84) {
        const t = Math.pow(r(), 0.75);
        const d = rad + t * 0.3;
        const j = 0.018 * (1 + t * 3);
        cloud.push(cx + jet[0] * d + gauss(r) * j, cy + jet[1] * d + gauss(r) * j, jet[2] * d + gauss(r) * j, 0.02);
      } else if (u < 0.3) {
        // equatorial ring, tilted toward the viewer so each orb reads as a little world
        const a = r() * TAU;
        const ring = rad * 1.45 + gauss(r) * 0.006;
        const p = rotate([Math.cos(a) * ring, Math.sin(a) * ring, 0], 1.15, 0, good ? 0.3 : 0.3 + k);
        cloud.push(cx + p[0], cy + p[1], p[2], good ? 0.72 : 0.12);
      } else {
        onSphere(r, v);
        let rr = rad * (1 + gauss(r) * 0.02);
        if (!good) rr *= 1 + 0.2 * Math.sin(v[0] * 5 + k) * Math.sin(v[1] * 4 - k);
        cloud.push(cx + v[0] * rr, cy + v[1] * rr, v[2] * rr, good ? 0.8 : 0.06);
      }
    }
  }
  return { points: coherent(cloud.data), faithful: [...faithful].sort((a, b) => a - b) };
}

/* ------------------------------------------------------------------ */
/* 3. Portrait: sampled from a luminance + alpha map of the photo.     */
/*    Local space: 0.8 wide x 1.0 tall, centred.                       */
/* ------------------------------------------------------------------ */
export function portrait(n, map, seed = 9) {
  const { width: W, height: H, lum, alpha } = map;
  const aspect = W / H;
  const cdf = new Float64Array(W * H);
  let acc = 0;
  for (let y = 0; y < H; y++) {
    const fy = y / H;
    const fade = fy > 0.66 ? Math.max(0.1, 1 - (fy - 0.66) / 0.34) : 1;
    for (let x = 0; x < W; x++) {
      const i = y * W + x;
      acc += alpha[i] * (0.04 + Math.pow(lum[i], 1.7)) * fade;
      cdf[i] = acc;
    }
  }
  const r = rng(seed);
  const cloud = new Cloud(n);
  while (!cloud.full) {
    const t = r() * acc;
    let lo = 0, hi = cdf.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cdf[m] < t) lo = m + 1;
      else hi = m;
    }
    const px = (lo % W) + r();
    const py = Math.floor(lo / W) + r();
    const L = lum[lo];
    let x = (px / W - 0.5) * aspect;
    let y = 0.5 - py / H;
    const face = Math.exp(-((x * x) / 0.05 + ((y - 0.16) * (y - 0.16)) / 0.09));
    let z = L * 0.08 + face * 0.09 + gauss(r) * 0.004;
    const dissolve = Math.max(0, py / H - 0.68) / 0.32;
    if (dissolve > 0) {
      x += gauss(r) * 0.03 * dissolve;
      y -= Math.abs(gauss(r)) * 0.06 * dissolve * dissolve;
      z += gauss(r) * 0.06 * dissolve;
    }
    cloud.push(x, y, z, 0.06 + 0.94 * Math.pow(L, 0.85));
  }
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 4. Knot: one continuous thread tied into a (3, 7) torus knot.       */
/* ------------------------------------------------------------------ */
export function knot(n, seed = 21) {
  const r = rng(seed);
  const p = 3;
  const q = 7;
  const cloud = new Cloud(n);
  const body = Math.floor(n * 0.94);
  for (let k = 0; k < body; k++) {
    const t = r() * TAU;
    const rr = 1 + 0.4 * Math.cos(q * t);
    const s = 1.12;
    const j = 0.024 * (0.4 + Math.abs(gauss(r)));
    const x = rr * Math.cos(p * t) * s + gauss(r) * j;
    const y = rr * Math.sin(p * t) * s + gauss(r) * j;
    const z = 0.4 * Math.sin(q * t) * s + gauss(r) * j;
    cloud.push(x, y, z, 0.5 + 0.5 * Math.sin(t * 2 + 0.6) + gauss(r) * 0.04);
  }
  cloud.fillHalo(r, 1.9, 0.18);
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 5. Graph: a knowledge graph. Eight hubs (the research threads),      */
/*    satellites, and the edges that bind them.                        */
/* ------------------------------------------------------------------ */
export function graph(n, seed = 33) {
  const r = rng(seed);
  const nodes = [];
  const golden = Math.PI * (3 - Math.sqrt(5));
  for (let i = 0; i < 8; i++) {
    const y = 1 - ((i + 0.5) / 8) * 2;
    const s = Math.sqrt(1 - y * y);
    const a = i * golden;
    nodes.push({ p: [Math.cos(a) * s * 1.15, y * 1.05, Math.sin(a) * s * 1.15], hub: true });
  }
  let guard = 0;
  while (nodes.length < 46 && guard++ < 5000) {
    const v = onSphere(r);
    const d = 0.45 + Math.cbrt(r()) * 1.2;
    const p = [v[0] * d * 1.25, v[1] * d * 0.95, v[2] * d * 0.9];
    if (nodes.every((o) => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) > 0.3)) nodes.push({ p, hub: false });
  }
  const edges = new Map();
  const link = (a, b) => {
    if (a === b) return;
    const k = a < b ? `${a}-${b}` : `${b}-${a}`;
    if (!edges.has(k)) edges.set(k, [a, b]);
  };
  nodes.forEach((node, i) => {
    const near = nodes
      .map((o, j) => [j, Math.hypot(o.p[0] - node.p[0], o.p[1] - node.p[1], o.p[2] - node.p[2])])
      .filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1]);
    const k = node.hub ? 4 : 2;
    for (let m = 0; m < k; m++) link(i, near[m][0]);
  });
  for (let i = 0; i < 8; i++) link(i, (i + 3) % 8);
  const list = [...edges.values()].map(([a, b]) => {
    const pa = nodes[a].p;
    const pb = nodes[b].p;
    return { pa, pb, len: Math.hypot(pa[0] - pb[0], pa[1] - pb[1], pa[2] - pb[2]) };
  });
  const cum = [];
  let totalLen = 0;
  for (const e of list) cum.push((totalLen += e.len));

  const cloud = new Cloud(n);
  const nHubs = Math.floor(n * 0.2);
  const nSat = Math.floor(n * 0.12);
  const nEdges = Math.floor(n * 0.64);
  const sats = nodes.filter((o) => !o.hub);
  for (let k = 0; k < nHubs; k++) {
    const h = nodes[k % 8].p;
    if (r() < 0.35) {
      const a = r() * TAU;
      const p = rotate([Math.cos(a) * 0.15, Math.sin(a) * 0.15, 0], 1.2 + (k % 8), 0.4 * (k % 8), 0);
      cloud.push(h[0] + p[0], h[1] + p[1], h[2] + p[2], 0.7);
    } else {
      const s = 0.05;
      cloud.push(h[0] + gauss(r) * s, h[1] + gauss(r) * s, h[2] + gauss(r) * s, 0.96);
    }
  }
  for (let k = 0; k < nSat; k++) {
    const o = sats[k % sats.length].p;
    const s = 0.026;
    cloud.push(o[0] + gauss(r) * s, o[1] + gauss(r) * s, o[2] + gauss(r) * s, 0.7);
  }
  for (let k = 0; k < nEdges; k++) {
    const u = r() * totalLen;
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < u) lo = m + 1;
      else hi = m;
    }
    const e = list[lo];
    const t = r();
    const j = 0.005;
    cloud.push(
      e.pa[0] + (e.pb[0] - e.pa[0]) * t + gauss(r) * j,
      e.pa[1] + (e.pb[1] - e.pa[1]) * t + gauss(r) * j,
      e.pa[2] + (e.pb[2] - e.pa[2]) * t + gauss(r) * j,
      0.22 + 0.22 * Math.sin(t * Math.PI),
    );
  }
  cloud.fillHalo(r, 2.1, 0.12);
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 6. Futures: one factual trajectory through six decisions; branches  */
/*    peel away at each node, the counterfactuals of an intervention.  */
/* ------------------------------------------------------------------ */
export function futures(n, seed = 44) {
  const r = rng(seed);
  const X0 = -1.85;
  const X1 = 1.85;
  const STEPS = 6;
  const factual = (x) => [x, 0.16 * Math.sin(x * 1.4 + 0.4), 0.1 * Math.cos(x * 0.9)];
  const nodeX = [...Array(STEPS).keys()].map((k) => X0 + (k / (STEPS - 1)) * (X1 - X0));
  const branches = [];
  for (let b = 0; b < 30; b++) {
    const k = Math.floor(Math.pow(r(), 1.3) * (STEPS - 1));
    const a = r() * TAU;
    const amp = 0.45 + r() * 1.05;
    branches.push({
      xs: nodeX[k],
      xe: Math.min(X1, nodeX[k] + 0.9 + r() * 2.6),
      dy: Math.cos(a) * amp,
      dz: Math.sin(a) * amp * 0.7,
      curve: 1.3 + r() * 0.9,
      tone: r() * 0.36,
    });
  }
  const cloud = new Cloud(n);
  const nFact = Math.floor(n * 0.24);
  const nNodes = Math.floor(n * 0.08);
  const nBranch = Math.floor(n * 0.62);
  for (let k = 0; k < nFact; k++) {
    const x = X0 + r() * (X1 - X0);
    const [fx, fy, fz] = factual(x);
    const j = 0.012;
    cloud.push(fx + gauss(r) * j, fy + gauss(r) * j, fz + gauss(r) * j, 0.82 + r() * 0.16);
  }
  for (let k = 0; k < nNodes; k++) {
    const [fx, fy, fz] = factual(nodeX[k % STEPS]);
    const s = 0.04;
    cloud.push(fx + gauss(r) * s, fy + gauss(r) * s, fz + gauss(r) * s, 1);
  }
  const weights = branches.map((b) => b.xe - b.xs);
  const sum = weights.reduce((a, b) => a + b, 0);
  for (let k = 0; k < nBranch; k++) {
    let u = r() * sum;
    let bi = 0;
    while (u > weights[bi]) u -= weights[bi++];
    const b = branches[Math.min(bi, branches.length - 1)];
    const x = b.xs + r() * (b.xe - b.xs);
    const f = (x - b.xs) / (X1 - b.xs);
    const off = Math.pow(f, b.curve);
    const [fx, fy, fz] = factual(x);
    const j = 0.008 + f * 0.03;
    cloud.push(fx + gauss(r) * j, fy + b.dy * off + gauss(r) * j, fz + b.dz * off + gauss(r) * j, b.tone + f * 0.12);
  }
  cloud.fillHalo(r, 2.2, 0.1);
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 7. Armillary: nested rings around a core, the architecture of the   */
/*    toolkit.                                                         */
/* ------------------------------------------------------------------ */
export function armillary(n, seed = 55) {
  const r = rng(seed);
  const rings = [
    { rot: [0, 0, 0], rad: 1.2, tone: 0.64, w: 1 },
    { rot: [Math.PI / 2, 0, 0], rad: 1.2, tone: 0.38, w: 1 },
    { rot: [Math.PI / 2, Math.PI / 3, 0], rad: 1.2, tone: 0.2, w: 1 },
    { rot: [0.42, 0, Math.PI / 5], rad: 1.5, tone: 0.06, w: 1.3 },
  ];
  const cloud = new Cloud(n);
  const nRings = Math.floor(n * 0.66);
  const nTicks = Math.floor(n * 0.08);
  const nCore = Math.floor(n * 0.2);
  const weight = rings.map((g) => g.w * g.rad);
  const wsum = weight.reduce((a, b) => a + b, 0);
  for (let k = 0; k < nRings; k++) {
    let u = r() * wsum;
    let gi = 0;
    while (gi < rings.length - 1 && u > weight[gi]) u -= weight[gi++];
    const g = rings[gi];
    const a = r() * TAU;
    const band = (r() - 0.5) * 0.05;
    const rad = g.rad + gauss(r) * 0.006;
    const p = rotate([Math.cos(a) * rad, Math.sin(a) * rad, band], ...g.rot);
    cloud.push(p[0], p[1], p[2], g.tone + gauss(r) * 0.03);
  }
  for (let k = 0; k < nTicks; k++) {
    const t = Math.floor(r() * 96);
    const a = (t / 96) * TAU;
    const major = t % 8 === 0;
    const rad = 1.2 + 0.07 + r() * (major ? 0.14 : 0.06);
    cloud.push(Math.cos(a) * rad, Math.sin(a) * rad, gauss(r) * 0.004, major ? 0.92 : 0.6);
  }
  for (let k = 0; k < nCore; k++) {
    const v = onSphere(r);
    const shell = r() < 0.65;
    const d = shell ? 0.3 + gauss(r) * 0.006 : Math.abs(gauss(r)) * 0.08;
    cloud.push(v[0] * d, v[1] * d, v[2] * d, shell ? 0.86 : 1);
  }
  cloud.fillHalo(r, 2.1, 0.12);
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 8. Galaxy: four arms around a bright bulge.                         */
/* ------------------------------------------------------------------ */
export function galaxy(n, seed = 66) {
  const r = rng(seed);
  const ARMS = 4;
  const R = 2.05;
  const cloud = new Cloud(n);
  while (!cloud.full) {
    if (r() < 0.13) {
      const s = 0.17;
      cloud.push(gauss(r) * s, gauss(r) * s, gauss(r) * s * 0.55, 0.93 + r() * 0.07);
      continue;
    }
    const rad = Math.pow(r(), 1.35) * R + 0.06;
    const arm = Math.floor(r() * ARMS);
    const a = (arm / ARMS) * TAU + rad * 2.35;
    const k = 0.42 * rad;
    const sx = Math.pow(r(), 2.6) * (r() < 0.5 ? -1 : 1) * k;
    const sy = Math.pow(r(), 2.6) * (r() < 0.5 ? -1 : 1) * k;
    const sz = Math.pow(r(), 2.6) * (r() < 0.5 ? -1 : 1) * k * 0.25;
    const x = Math.cos(a) * rad + sx;
    const y = Math.sin(a) * rad + sy;
    const z = gauss(r) * 0.035 * (1 - rad / (R + 0.1)) + sz;
    cloud.push(x, y, z, 1 - Math.pow(rad / R, 0.75) * 0.96 + gauss(r) * 0.04);
  }
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 10. Orbit: a ring around the expertise chart, with a bright cluster */
/*     beside each of its five segments. Radius 1 is the chart's edge. */
/* ------------------------------------------------------------------ */
export const ORBIT = {
  radius: 0.95,
  domains: 5,
  // Segment i sits clockwise from twelve o'clock, as in the SVG chart.
  angle: (i) => Math.PI / 2 - (i * TAU) / ORBIT.domains,
  cluster: (i) => [Math.cos(ORBIT.angle(i)) * ORBIT.radius, Math.sin(ORBIT.angle(i)) * ORBIT.radius, 0],
};

export function orbit(n, seed = 88) {
  const r = rng(seed);
  const cloud = new Cloud(n);
  const R = ORBIT.radius;
  const DOMAINS = ORBIT.domains;
  const angle = ORBIT.angle;
  const nClusters = Math.floor(n * 0.2);
  const nRing = Math.floor(n * 0.5);
  const nDash = Math.floor(n * 0.14);
  for (let k = 0; k < nClusters; k++) {
    const a = angle(k % DOMAINS);
    const s = 0.03;
    const d = R + gauss(r) * s;
    cloud.push(Math.cos(a) * d + gauss(r) * s, Math.sin(a) * d + gauss(r) * s, gauss(r) * s, 0.9 + r() * 0.1);
  }
  for (let k = 0; k < nRing; k++) {
    const a = r() * TAU;
    // Brighter near each cluster, dimmer between them.
    const near = Math.max(...[...Array(DOMAINS).keys()].map((i) => Math.cos(a - angle(i))));
    const d = R + gauss(r) * 0.006;
    cloud.push(Math.cos(a) * d, Math.sin(a) * d, gauss(r) * 0.01, 0.3 + 0.45 * Math.pow(Math.max(0, near), 12) + gauss(r) * 0.04);
  }
  // A dashed outer track, like the chart's own orbit line.
  for (let k = 0; k < nDash; k++) {
    const dash = Math.floor(r() * 120);
    const a = ((dash + r() * 0.35) / 120) * TAU;
    const d = R * 1.07;
    cloud.push(Math.cos(a) * d, Math.sin(a) * d, 0, 0.42);
  }
  cloud.fillHalo(r, 1.5, 0.08);
  return { points: coherent(cloud.data) };
}

/* ------------------------------------------------------------------ */
/* 9. Mind: the emblem of a Cognitive Trust Architect. A brain with a  */
/*    reasoning trace inside it and a haze of uncertainty around it.   */
/*    `alt` holds the same particles made lucid: the cortex resolved   */
/*    into contour slices, the trace drawn as one thread, and the haze */
/*    condensed into a glass box with its dimensions marked.           */
/*    Haze particles store 2 + their build order in the tone channel   */
/*    of `points` (decoded by the lucid GLSL in shaders.js).           */
/* ------------------------------------------------------------------ */

// Perlin's improved gradient noise, seeded.
function noise3(seed) {
  const r = rng(seed);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [p[i], p[j]] = [p[j], p[i]];
  }
  const perm = new Uint8Array(512);
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  const G = [1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1, 0, 1, 0, 1, -1, 0, 1, 1, 0, -1, -1, 0, -1, 0, 1, 1, 0, -1, 1, 0, 1, -1, 0, -1, -1];
  const grad = (h, x, y, z) => {
    const g = (h % 12) * 3;
    return G[g] * x + G[g + 1] * y + G[g + 2] * z;
  };
  const fade = (t) => t * t * t * (t * (t * 6 - 15) + 10);
  const lerp = (a, b, t) => a + (b - a) * t;
  return (x, y, z) => {
    const X = Math.floor(x), Y = Math.floor(y), Z = Math.floor(z);
    x -= X;
    y -= Y;
    z -= Z;
    const xi = X & 255, yi = Y & 255, zi = Z & 255;
    const u = fade(x), v = fade(y), w = fade(z);
    const A = perm[xi] + yi, AA = perm[A] + zi, AB = perm[A + 1] + zi;
    const B = perm[xi + 1] + yi, BA = perm[B] + zi, BB = perm[B + 1] + zi;
    return lerp(
      lerp(lerp(grad(perm[AA], x, y, z), grad(perm[BA], x - 1, y, z), u), lerp(grad(perm[AB], x, y - 1, z), grad(perm[BB], x - 1, y - 1, z), u), v),
      lerp(lerp(grad(perm[AA + 1], x, y, z - 1), grad(perm[BA + 1], x - 1, y, z - 1), u), lerp(grad(perm[AB + 1], x, y - 1, z - 1), grad(perm[BB + 1], x - 1, y - 1, z - 1), u), v),
      w,
    );
  };
}

const smoothstep = (a, b, x) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

// One hemisphere as blended lobes [cx, cy, cz, rx, ry, rz]. +x is the right side
// (the left mirrors it), +y is up, +z is the front.
const LOBES = [
  [0.4, 0.1, -0.02, 0.4, 0.55, 0.98], // cerebrum
  [0.36, 0.02, 0.52, 0.37, 0.5, 0.5], // frontal
  [0.37, 0.25, -0.25, 0.38, 0.45, 0.6], // parietal
  [0.3, 0, -0.72, 0.32, 0.42, 0.36], // occipital
];
const TEMPORAL = [0.5, -0.3, 0.1, 0.29, 0.25, 0.52];
const CEREBELLUM = [0.27, -0.47, -0.6, 0.36, 0.21, 0.3];
const STEM = { a: [0, -0.28, -0.14], b: [0, -0.98, -0.32], r: 0.115 };
const FISSURE = 0.022; // half the gap between the hemispheres

function smin(a, b, k) {
  const h = Math.max(k - Math.abs(a - b), 0) / k;
  return Math.min(a, b) - h * h * k * 0.25;
}

function ellipsoid(x, y, z, e) {
  const px = (x - e[0]) / e[3], py = (y - e[1]) / e[4], pz = (z - e[2]) / e[5];
  const k0 = Math.sqrt(px * px + py * py + pz * pz);
  const qx = px / e[3], qy = py / e[4], qz = pz / e[5];
  const k1 = Math.sqrt(qx * qx + qy * qy + qz * qz);
  return k1 > 1e-9 ? (k0 * (k0 - 1)) / k1 : -Math.min(e[3], e[4], e[5]);
}

function capsule(x, y, z, { a, b, r }) {
  const bx = b[0] - a[0], by = b[1] - a[1], bz = b[2] - a[2];
  const px = x - a[0], py = y - a[1], pz = z - a[2];
  const h = Math.min(1, Math.max(0, (px * bx + py * by + pz * bz) / (bx * bx + by * by + bz * bz)));
  const dx = px - bx * h, dy = py - by * h, dz = pz - bz * h;
  return Math.sqrt(dx * dx + dy * dy + dz * dz) - r;
}

function cerebrum(ax, y, z) {
  let d = ellipsoid(ax, y, z, LOBES[0]);
  for (let i = 1; i < LOBES.length; i++) d = smin(d, ellipsoid(ax, y, z, LOBES[i]), 0.2);
  // The temporal lobe hangs below a sharp lateral fissure at the front and merges
  // into the rest toward the back.
  return smin(d, ellipsoid(ax, y, z, TEMPORAL), 0.025 + 0.3 * smoothstep(0.1, -0.5, z));
}

// Approximate signed distance to the whole brain.
function brain(x, y, z) {
  const ax = Math.abs(x);
  const hemispheres = Math.max(cerebrum(ax, y, z), FISSURE - ax);
  const hind = smin(ellipsoid(x, y, z, CEREBELLUM), ellipsoid(-x, y, z, CEREBELLUM), 0.12);
  return Math.min(hemispheres, smin(hind, capsule(x, y, z, STEM), 0.1));
}

// Pull a point onto the brain's surface (a few Newton steps); returns the outward
// normal in `n` and the final distance.
function toSurface(p, n) {
  const h = 0.0015;
  let d = 0;
  for (let it = 0; it < 3; it++) {
    d = brain(p[0], p[1], p[2]);
    const gx = brain(p[0] + h, p[1], p[2]) - d;
    const gy = brain(p[0], p[1] + h, p[2]) - d;
    const gz = brain(p[0], p[1], p[2] + h) - d;
    const l = Math.sqrt(gx * gx + gy * gy + gz * gz) || 1e-9;
    n[0] = gx / l;
    n[1] = gy / l;
    n[2] = gz / l;
    const step = (d * h) / l;
    p[0] -= n[0] * step;
    p[1] -= n[1] * step;
    p[2] -= n[2] * step;
    if (Math.abs(d) < 5e-4) break;
  }
  return brain(p[0], p[1], p[2]);
}

// Contour slices of the lucid mind.
const SLICE = 0.068;
const SLICE_Y0 = -1.04;
const SLICE_TOP = 25;

// The reasoning trace: observe → retrieve → explain → answer, then down the stem.
const TRACE = [
  [0.3, 0.38, 0.52],
  [-0.36, 0.3, 0.1],
  [0.34, 0.1, -0.42],
  [-0.24, -0.12, -0.1],
  [0, -0.4, -0.17],
  [0, -0.95, -0.31],
];
const TRACE_NODES = [0, 1, 2, 4];

const BOX = { center: [0, -0.17, -0.03], half: 1.22 };
const boxCorner = (sx, sy, sz) => BOX.center.map((c, i) => c + [sx, sy, sz][i] * BOX.half);

export const MIND = {
  box: BOX,
  // The box's dimension lines, as on an architect's drawing: each measures one edge
  // and is drawn `dimOffset` away from it along `dir`.
  dims: [
    { from: boxCorner(-1, -1, 1), to: boxCorner(1, -1, 1), dir: [0, 0, 1] },
    { from: boxCorner(1, -1, -1), to: boxCorner(1, -1, 1), dir: [1, 0, 0] },
    { from: boxCorner(1, -1, -1), to: boxCorner(1, 1, -1), dir: [1, 0, 0] },
  ],
  dimOffset: 0.3,
  slices: { y0: SLICE_Y0, step: SLICE, top: SLICE_TOP },
  // The scan level that leaves the whole mind organic, and the one that makes it lucid.
  scanFrom: SLICE_Y0 + (SLICE_TOP + 1) * SLICE,
  scanTo: SLICE_Y0 - SLICE,
  trace: TRACE,
  traceNodes: TRACE_NODES,
};

function catmull(points, samples) {
  const out = [];
  const P = [points[0], ...points, points[points.length - 1]];
  for (let i = 1; i < P.length - 2; i++) {
    const [p0, p1, p2, p3] = [P[i - 1], P[i], P[i + 1], P[i + 2]];
    for (let s = 0; s < samples; s++) {
      const t = s / samples;
      const t2 = t * t;
      const t3 = t2 * t;
      out.push([0, 1, 2].map((k) => 0.5 * (2 * p1[k] + (-p0[k] + p2[k]) * t + (2 * p0[k] - 5 * p1[k] + 4 * p2[k] - p3[k]) * t2 + (-p0[k] + 3 * p1[k] - 3 * p2[k] + p3[k]) * t3)));
    }
  }
  out.push(points[points.length - 1]);
  return out;
}

export function mind(n, seed = 77) {
  const r = rng(seed);
  const fold = noise3(seed);
  const points = new Float32Array(n * 4);
  const alt = new Float32Array(n * 4);
  let count = 0;
  const push = (x, y, z, tone, lx, ly, lz, ltone) => {
    if (count >= n) return false;
    const o = count++ * 4;
    points[o] = x;
    points[o + 1] = y;
    points[o + 2] = z;
    points[o + 3] = tone; // unclamped: haze uses 2 + order
    alt[o] = lx;
    alt[o + 1] = ly;
    alt[o + 2] = lz;
    alt[o + 3] = Math.min(1, Math.max(0, ltone));
    return true;
  };
  const nrm = [0, 0, 0];

  // Where a cortex particle settles once lucid: its slice, on the brain's contour there.
  const toSlice = (x, y, z) => {
    const level = Math.min(SLICE_TOP, Math.max(0, Math.round((y - SLICE_Y0) / SLICE)));
    const ys = SLICE_Y0 + level * SLICE;
    let cx = x;
    let cz = z;
    const h = 0.002;
    for (let it = 0; it < 5; it++) {
      const d = brain(cx, ys, cz);
      if (Math.abs(d) < 0.0015) break;
      const gx = (brain(cx + h, ys, cz) - d) / h;
      const gz = (brain(cx, ys, cz + h) - d) / h;
      const g2 = gx * gx + gz * gz;
      if (g2 < 1e-6) break;
      let sx = (d * gx) / g2;
      let sz = (d * gz) / g2;
      const step = Math.hypot(sx, sz);
      if (step > 0.15) {
        sx *= 0.15 / step;
        sz *= 0.15 / step;
      }
      cx -= sx;
      cz -= sz;
    }
    const major = level % 4 === 1;
    const tone = 0.6 + (major ? 0.26 : 0) + 0.12 * (level / SLICE_TOP) + gauss(r) * 0.03;
    return [cx, ys, cz, tone];
  };

  /* Cortex, cerebellum and stem: 62% of the budget. */
  const parts = [];
  const area = (e) => {
    const p = 1.6075;
    const [a, b, c] = [e[3], e[4], e[5]].map((v) => Math.pow(v, p));
    return Math.pow((a * b + a * c + b * c) / 3, 1 / p);
  };
  for (const s of [1, -1]) {
    for (const l of [...LOBES, TEMPORAL]) parts.push({ e: [l[0] * s, ...l.slice(1)], kind: 0, w: area(l) });
    parts.push({ e: [CEREBELLUM[0] * s, ...CEREBELLUM.slice(1)], kind: 1, w: area(CEREBELLUM) * 0.9 });
  }
  const stemLength = Math.hypot(...STEM.b.map((v, i) => v - STEM.a[i]));
  parts.push({ kind: 2, w: (stemLength * STEM.r * 0.5) });
  parts.push({ kind: 3, w: 0.34 }); // the medial walls along the fissure
  const wsum = parts.reduce((s, p) => s + p.w, 0);

  const nCortex = Math.floor(n * 0.62);
  const p = [0, 0, 0];
  let guard = 0;
  while (count < nCortex && guard++ < n * 60) {
    let u = r() * wsum;
    let part = parts[0];
    for (const q of parts) {
      part = q;
      if ((u -= q.w) <= 0) break;
    }
    if (part.kind === 2) {
      const t = r();
      const a = r() * TAU;
      const { a: A, b: B } = STEM;
      p[0] = A[0] + (B[0] - A[0]) * t + Math.cos(a) * STEM.r;
      p[1] = A[1] + (B[1] - A[1]) * t;
      p[2] = A[2] + (B[2] - A[2]) * t + Math.sin(a) * STEM.r;
    } else if (part.kind === 3) {
      p[0] = (r() < 0.5 ? -1 : 1) * FISSURE;
      p[1] = -0.5 + r() * 1.25;
      p[2] = -1.1 + r() * 2.15;
      if (cerebrum(FISSURE, p[1], p[2]) > 0 || r() > 0.5) continue;
    } else {
      const v = onSphere(r);
      const e = part.e;
      p[0] = e[0] + v[0] * e[3];
      p[1] = e[1] + v[1] * e[4];
      p[2] = e[2] + v[2] * e[5];
    }
    // Skip what is buried inside another lobe; settle the rest onto the blended surface.
    if (brain(p[0], p[1], p[2]) < -0.07) continue;
    if (part.kind !== 3 && Math.abs(toSurface(p, nrm)) > 0.003) continue;
    let [x, y, z] = p;

    let tone;
    if (part.kind === 0) {
      // Gyri and sulci: the zero set of a noise field meanders like the folds of a cortex.
      // Sulci are narrow, sunken and nearly empty; gyri brighten toward their crowns.
      const f = Math.abs(fold(x * 7.4 + 3.1, y * 7.4, z * 7.4) + 0.35 * fold(x * 15, y * 15 + 5.3, z * 15));
      if (f < 0.085 && r() < 0.93) continue;
      // Each gyrus is shaded like a worm: bright along its crown, dark down its flanks.
      const crown = Math.pow(smoothstep(0.1, 0.46, f), 1.4);
      if (crown < 0.15 && r() < 0.45) continue;
      const relief = 0.075 * crown - 0.04;
      x += nrm[0] * relief;
      y += nrm[1] * relief;
      z += nrm[2] * relief;
      const lift = smoothstep(-0.5, 0.7, y);
      tone = 0.02 + crown * (0.36 + 0.28 * lift) + gauss(r) * 0.025;
    } else if (part.kind === 1) {
      // Folia: the cerebellum's fine horizontal leaves.
      const leaf = 0.5 + 0.5 * Math.sin(y * 92 + fold(x * 6, y * 6, z * 6) * 4);
      if (leaf < 0.3 && r() < 0.6) continue;
      tone = 0.06 + 0.22 * leaf + gauss(r) * 0.03;
    } else if (part.kind === 2) {
      tone = 0.12 + gauss(r) * 0.03;
    } else {
      tone = 0.08 + gauss(r) * 0.03;
    }
    const [lx, ly, lz, ltone] = toSlice(x, y, z);
    push(x, y, z, tone, lx, ly, lz, ltone);
  }

  /* The reasoning trace: 6%. Organic, a loose bundle of neurons; lucid, one thread. */
  const curve = catmull(TRACE, 60);
  const cum = [0];
  for (let i = 1; i < curve.length; i++) cum.push(cum[i - 1] + Math.hypot(...curve[i].map((v, k) => v - curve[i - 1][k])));
  const traceLength = cum[cum.length - 1];
  const along = (u) => {
    let lo = 0, hi = cum.length - 1;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < u) lo = m + 1;
      else hi = m;
    }
    const i = Math.max(1, lo);
    const f = (u - cum[i - 1]) / (cum[i] - cum[i - 1] || 1);
    return curve[i - 1].map((v, k) => v + (curve[i][k] - v) * f);
  };
  const nTrace = Math.floor(n * 0.06);
  const traceEnd = count + nTrace;
  const nodeShare = 0.16;
  while (count < traceEnd) {
    let p;
    let ltone;
    let jitter;
    if (r() < nodeShare) {
      const node = TRACE[TRACE_NODES[Math.floor(r() * TRACE_NODES.length)]];
      p = node;
      jitter = 0.026;
      ltone = 1;
    } else {
      p = along(r() * traceLength);
      jitter = 0.005;
      ltone = 0.9 + r() * 0.1;
    }
    const s = 0.16;
    push(
      p[0] + gauss(r) * s, p[1] + gauss(r) * s, p[2] + gauss(r) * s, 0.12 + r() * 0.08,
      p[0] + gauss(r) * jitter, p[1] + gauss(r) * jitter, p[2] + gauss(r) * jitter, ltone,
    );
  }

  /* The glass box: the rest. Organic, a haze around the mind; lucid, the box drawn
     edge by edge (bottom, rising pillars, top), then its dimensions, then its panes. */
  const [bx, by, bz] = BOX.center;
  const H = BOX.half;
  const corner = boxCorner;
  const ring = [[-1, -1], [1, -1], [1, 1], [-1, 1]]; // (x, z) around the square
  const edges = [];
  for (let i = 0; i < 4; i++) {
    const [ax, az] = ring[i];
    const [cx, cz] = ring[(i + 1) % 4];
    edges.push({ a: corner(ax, -1, az), b: corner(cx, -1, cz), o0: (i / 4) * 0.26, o1: ((i + 1) / 4) * 0.26 });
  }
  for (const [ax, az] of ring) edges.push({ a: corner(ax, -1, az), b: corner(ax, 1, az), o0: 0.26, o1: 0.5 });
  for (let i = 0; i < 4; i++) {
    const [ax, az] = ring[i];
    const [cx, cz] = ring[(i + 1) % 4];
    edges.push({ a: corner(ax, 1, az), b: corner(cx, 1, cz), o0: 0.5 + (i / 4) * 0.24, o1: 0.5 + ((i + 1) / 4) * 0.24 });
  }
  // Dimension lines: offset from an edge, with extension lines, end ticks and small
  // graduations.
  const OFF = MIND.dimOffset;
  const dims = MIND.dims.map((d) => [d.from, d.to, d.dir]);
  const lerp3 = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  const add3 = (a, d, s) => [a[0] + d[0] * s, a[1] + d[1] * s, a[2] + d[2] * s];
  const haze = (p, order) => {
    const dx = p[0] - bx, dy = p[1] - by, dz = p[2] - bz;
    const l = Math.sqrt(dx * dx + dy * dy + dz * dz) || 1;
    const rad = 1.42 + 0.62 * Math.pow(r(), 0.8);
    const j = 0.12;
    return [bx + (dx / l) * rad + gauss(r) * j, by + (dy / l) * rad * 0.92 + gauss(r) * j, bz + (dz / l) * rad + gauss(r) * j, 2 + order];
  };
  const pushBox = (p, order, tone) => {
    const h = haze(p, Math.min(0.93, Math.max(0, order)));
    return push(h[0], h[1], h[2], h[3], p[0], p[1], p[2], tone);
  };
  const remaining = n - count;
  const nEdges = Math.floor(remaining * 0.46);
  const nCorners = Math.floor(remaining * 0.06);
  const nDims = Math.floor(remaining * 0.11);
  for (let k = 0; k < nEdges; k++) {
    const e = edges[Math.floor(r() * edges.length)];
    const t = r();
    const p = lerp3(e.a, e.b, t);
    const j = 0.004;
    pushBox([p[0] + gauss(r) * j, p[1] + gauss(r) * j, p[2] + gauss(r) * j], e.o0 + (e.o1 - e.o0) * t, 0.8 + gauss(r) * 0.05);
  }
  for (let k = 0; k < nCorners; k++) {
    const sx = r() < 0.5 ? -1 : 1, sy = r() < 0.5 ? -1 : 1, sz = r() < 0.5 ? -1 : 1;
    const c = corner(sx, sy, sz);
    const s = 0.022;
    const order = sy < 0 ? (ring.findIndex(([x, z]) => x === sx && z === sz) / 4) * 0.26 : 0.5;
    pushBox([c[0] + gauss(r) * s, c[1] + gauss(r) * s, c[2] + gauss(r) * s], order, 1);
  }
  for (let k = 0; k < nDims; k++) {
    const [a, b, dir] = dims[Math.floor(r() * dims.length)];
    const u = r();
    let p;
    if (u < 0.56) {
      // the dimension line, with a gap at its centre for the figure
      let t = r();
      if (t > 0.44 && t < 0.56) t = t < 0.5 ? 0.44 - r() * 0.05 : 0.56 + r() * 0.05;
      p = add3(lerp3(a, b, t), dir, OFF);
    } else if (u < 0.76) {
      // extension lines from the box to just past the dimension line
      p = add3(r() < 0.5 ? a : b, dir, 0.06 + r() * (OFF + 0.02));
    } else if (u < 0.88) {
      // 45° ticks where the lines cross
      const end = r() < 0.5 ? a : b;
      const along = [(b[0] - a[0]) / (2 * H), (b[1] - a[1]) / (2 * H), (b[2] - a[2]) / (2 * H)];
      const t = (r() - 0.5) * 0.11;
      p = add3(add3(end, dir, OFF + t), along, t);
    } else {
      // graduations, a ruler's marks
      const g = Math.floor(r() * 9) / 8;
      p = add3(lerp3(a, b, g), dir, OFF - 0.035 + r() * 0.035);
    }
    const j = 0.003;
    pushBox([p[0] + gauss(r) * j, p[1] + gauss(r) * j, p[2] + gauss(r) * j], 0.76 + r() * 0.1, 0.5 + r() * 0.08);
  }
  // Panes: whatever is left settles faintly over the six faces.
  while (count < n) {
    const axis = Math.floor(r() * 3);
    const side = r() < 0.5 ? -1 : 1;
    const p = [bx + (r() * 2 - 1) * H, by + (r() * 2 - 1) * H, bz + (r() * 2 - 1) * H];
    p[axis] = [bx, by, bz][axis] + side * H;
    pushBox(p, 0.55 + r() * 0.38, 0.2 + r() * 0.1);
  }

  const [home, lucid] = coherent(points, alt);
  return { points: home, alt: lucid };
}

// The intro state: everything packed into a point, ready to burst.
export function singularity(n, seed = 1) {
  const r = rng(seed);
  const cloud = new Cloud(n);
  const v = [0, 0, 0];
  while (!cloud.full) {
    onSphere(r, v);
    const d = Math.cbrt(r()) * 0.05;
    cloud.push(v[0] * d, v[1] * d, v[2] * d, 1);
  }
  return cloud.data;
}
