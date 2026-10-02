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
// than as an explosion.
function coherent(data) {
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
  const out = new Float32Array(data.length);
  for (let k = 0; k < n; k++) out.set(data.subarray(order[k] * 4, order[k] * 4 + 4), k * 4);
  return out;
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
