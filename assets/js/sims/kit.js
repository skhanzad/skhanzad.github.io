// Shared toolkit for the research simulations: palette, seeded randomness, a
// DPR-aware canvas, a frame loop, drawing and chart primitives, and the panel
// controls every simulation is built from.

/* ------------------------------------------------------------------ */
/* Palette and type                                                   */
/* ------------------------------------------------------------------ */

export const C = {
  midnight: '#020122',
  deep: '#07063a',
  ember: '#f4442e',
  amber: '#fc9e4f',
  gold: '#edd382',
  cream: '#f2f3ae',
};

// Cream at decreasing strengths, for text and hairlines on midnight.
export const INK = {
  1: '#f2f3ae',
  2: 'rgba(242, 243, 174, 0.74)',
  3: 'rgba(242, 243, 174, 0.52)',
  4: 'rgba(242, 243, 174, 0.3)',
  line: 'rgba(242, 243, 174, 0.12)',
  faint: 'rgba(242, 243, 174, 0.06)',
};

export const FONT = {
  serif: '"Instrument Serif", Georgia, serif',
  sans: 'Geist, system-ui, sans-serif',
  mono: '"Geist Mono", ui-monospace, Menlo, monospace',
};

const rgbCache = new Map();
function rgbOf(hex) {
  if (!rgbCache.has(hex)) {
    const n = parseInt(hex.slice(1), 16);
    rgbCache.set(hex, [(n >> 16) & 255, (n >> 8) & 255, n & 255]);
  }
  return rgbCache.get(hex);
}

// rgba() string for a palette hex at alpha a.
export function alpha(hex, a) {
  const [r, g, b] = rgbOf(hex);
  return `rgba(${r}, ${g}, ${b}, ${a})`;
}

// Interpolate two palette colours.
export function mix(hexA, hexB, t, a = 1) {
  const p = rgbOf(hexA);
  const q = rgbOf(hexB);
  const k = Math.min(1, Math.max(0, t));
  return `rgba(${Math.round(p[0] + (q[0] - p[0]) * k)}, ${Math.round(p[1] + (q[1] - p[1]) * k)}, ${Math.round(p[2] + (q[2] - p[2]) * k)}, ${a})`;
}

// The site's ramp: 0 ember, 1/3 amber, 2/3 gold, 1 cream.
export function ramp(t, a = 1) {
  const stops = [C.ember, C.amber, C.gold, C.cream];
  const x = Math.min(0.9999, Math.max(0, t)) * 3;
  const i = Math.floor(x);
  return mix(stops[i], stops[i + 1], x - i, a);
}

/* ------------------------------------------------------------------ */
/* Numbers                                                            */
/* ------------------------------------------------------------------ */

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

export function gauss(r) {
  let u = 0;
  while (u === 0) u = r();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r());
}

export const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const easeOut = (t) => 1 - Math.pow(1 - clamp(t), 3);
export const easeInOut = (t) => {
  const x = clamp(t);
  return x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2;
};
export const pick = (r, list) => list[Math.floor(r() * list.length)];
export const int = (r, a, b) => a + Math.floor(r() * (b - a + 1));

export function shuffle(r, list) {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export const fmt = {
  int: (v) => Math.round(v).toLocaleString('en-US'),
  pct: (v, d = 1) => `${(v * 100).toFixed(d)}%`,
  fixed: (d) => (v) => Number(v).toFixed(d),
};

/* ------------------------------------------------------------------ */
/* Canvas and frame loop                                              */
/* ------------------------------------------------------------------ */

// A canvas that fills `stage` and stays sharp on high-density screens. All drawing
// happens in CSS pixels; view.w / view.h are the current size.
export function stageCanvas(stage, { onResize } = {}) {
  const canvas = document.createElement('canvas');
  canvas.className = 'sim-canvas';
  stage.append(canvas);
  const ctx = canvas.getContext('2d');
  const view = { canvas, ctx, w: 1, h: 1, dpr: 1 };
  const fit = () => {
    const r = stage.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) return;
    view.dpr = Math.min(window.devicePixelRatio || 1, 2);
    view.w = r.width;
    view.h = r.height;
    canvas.width = Math.round(r.width * view.dpr);
    canvas.height = Math.round(r.height * view.dpr);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    ctx.setTransform(view.dpr, 0, 0, view.dpr, 0, 0);
    onResize?.(view);
  };
  const observer = new ResizeObserver(fit);
  observer.observe(stage);
  fit();
  view.clear = () => ctx.clearRect(0, 0, view.w, view.h);
  view.destroy = () => {
    observer.disconnect();
    canvas.remove();
  };
  return view;
}

// Pointer position over a canvas in CSS pixels, with optional handlers.
export function pointer(canvas, { down, move, up, leave } = {}) {
  const p = { x: -1, y: -1, over: false, pressed: false };
  const at = (e) => {
    const r = canvas.getBoundingClientRect();
    p.x = e.clientX - r.left;
    p.y = e.clientY - r.top;
  };
  const onMove = (e) => {
    at(e);
    p.over = true;
    move?.(p, e);
  };
  const onDown = (e) => {
    at(e);
    p.pressed = true;
    down?.(p, e);
  };
  const onUp = (e) => {
    at(e);
    p.pressed = false;
    up?.(p, e);
  };
  const onLeave = (e) => {
    p.over = false;
    p.pressed = false;
    leave?.(p, e);
  };
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointerleave', onLeave);
  p.destroy = () => {
    canvas.removeEventListener('pointermove', onMove);
    canvas.removeEventListener('pointerdown', onDown);
    canvas.removeEventListener('pointerup', onUp);
    canvas.removeEventListener('pointerleave', onLeave);
  };
  return p;
}

// requestAnimationFrame loop with a clamped delta (seconds).
export function loop(step) {
  let raf = 0;
  let last = 0;
  let running = false;
  const frame = (now) => {
    const dt = Math.min(0.05, Math.max(0, (now - last) / 1000));
    last = now;
    step(dt, now / 1000);
    if (running) raf = requestAnimationFrame(frame);
  };
  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}

/* ------------------------------------------------------------------ */
/* Drawing                                                            */
/* ------------------------------------------------------------------ */

// Text in one call. size in px; font is 'mono' | 'sans' | 'serif'.
export function label(ctx, str, x, y, o = {}) {
  const { size = 11, font = 'mono', color = INK[2], align = 'left', baseline = 'alphabetic', weight = 400, italic = false, upper = false, track = 0 } = o;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[font]}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = baseline;
  if ('letterSpacing' in ctx) ctx.letterSpacing = `${track}px`;
  ctx.fillText(upper ? String(str).toUpperCase() : String(str), x, y);
  if ('letterSpacing' in ctx) ctx.letterSpacing = '0px';
}

// Like label(), but shrinks the font (down to minSize) so the text fits maxWidth.
export function labelFit(ctx, str, x, y, maxWidth, o = {}) {
  const size = o.size ?? 11;
  const minSize = o.minSize ?? 10;
  const w = textWidth(ctx, str, { ...o, size });
  const fitted = w > maxWidth ? Math.max(minSize, (size * maxWidth) / w) : size;
  label(ctx, str, x, y, { ...o, size: fitted });
}

export function textWidth(ctx, str, o = {}) {
  const { size = 11, font = 'mono', weight = 400, italic = false } = o;
  ctx.font = `${italic ? 'italic ' : ''}${weight} ${size}px ${FONT[font]}`;
  return ctx.measureText(String(str)).width;
}

export function roundRect(ctx, x, y, w, h, r) {
  const rr = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + rr, y);
  ctx.arcTo(x + w, y, x + w, y + h, rr);
  ctx.arcTo(x + w, y + h, x, y + h, rr);
  ctx.arcTo(x, y + h, x, y, rr);
  ctx.arcTo(x, y, x + w, y, rr);
  ctx.closePath();
}

// A soft glowing dot (radial gradient), good for nodes and particles.
export function glow(ctx, x, y, r, hex, a = 1) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, alpha(hex, a));
  g.addColorStop(0.35, alpha(hex, a * 0.45));
  g.addColorStop(1, alpha(hex, 0));
  ctx.fillStyle = g;
  ctx.fillRect(x - r, y - r, r * 2, r * 2);
}

export function dot(ctx, x, y, r, fill, stroke, lineWidth = 1.2) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  if (fill) {
    ctx.fillStyle = fill;
    ctx.fill();
  }
  if (stroke) {
    ctx.strokeStyle = stroke;
    ctx.lineWidth = lineWidth;
    ctx.stroke();
  }
}

export function line(ctx, x1, y1, x2, y2, color, width = 1, dash = null) {
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.strokeStyle = color;
  ctx.lineWidth = width;
  ctx.setLineDash(dash || []);
  ctx.stroke();
  ctx.setLineDash([]);
}

export function arrow(ctx, x1, y1, x2, y2, color, width = 1.2, head = 6) {
  line(ctx, x1, y1, x2, y2, color, width);
  const a = Math.atan2(y2 - y1, x2 - x1);
  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(x2 - head * Math.cos(a - 0.45), y2 - head * Math.sin(a - 0.45));
  ctx.lineTo(x2 - head * Math.cos(a + 0.45), y2 - head * Math.sin(a + 0.45));
  ctx.closePath();
  ctx.fillStyle = color;
  ctx.fill();
}

// A point along a quadratic curve (used for travelling pulses).
export function quadAt(x1, y1, cx, cy, x2, y2, t) {
  const u = 1 - t;
  return [u * u * x1 + 2 * u * t * cx + t * t * x2, u * u * y1 + 2 * u * t * cy + t * t * y2];
}

/* ------------------------------------------------------------------ */
/* Charts                                                             */
/* ------------------------------------------------------------------ */

// Horizontal-axis bar chart in rect {x, y, w, h}. bars: [{ label, value, color, note }].
export function bars(ctx, rect, items, { max, format = (v) => v, title } = {}) {
  const { x, y, w, h } = rect;
  const top = title ? 22 : 0;
  if (title) label(ctx, title, x, y + 10, { size: 10, upper: true, track: 1.5, color: INK[3] });
  const m = max ?? Math.max(1e-9, ...items.map((b) => b.value));
  const gap = 10;
  const bh = Math.max(8, (h - top - gap * (items.length - 1)) / items.length);
  items.forEach((b, i) => {
    const by = y + top + i * (bh + gap);
    const labelW = Math.min(150, w * 0.38);
    label(ctx, b.label, x, by + bh / 2, { size: 11, baseline: 'middle', color: INK[2] });
    const bw = Math.max(0, (w - labelW - 70) * (b.value / m));
    roundRect(ctx, x + labelW, by + bh * 0.18, w - labelW - 70, bh * 0.64, 3);
    ctx.fillStyle = INK.faint;
    ctx.fill();
    if (bw > 0) {
      roundRect(ctx, x + labelW, by + bh * 0.18, bw, bh * 0.64, 3);
      ctx.fillStyle = b.color || C.gold;
      ctx.fill();
    }
    label(ctx, format(b.value), x + labelW + bw + 8, by + bh / 2, { size: 11, baseline: 'middle', color: b.color || C.gold });
  });
}

// Line chart. series: [{ points: [[x, y], ...], color, width, dash, label }].
export function lines(ctx, rect, series, { xMin = 0, xMax, yMin = 0, yMax, yFormat = (v) => v, xFormat = (v) => v, xLabel, yLabel, ticks = 4 } = {}) {
  const { x, y, w, h } = rect;
  const pad = { l: 38, r: 10, t: 8, b: 22 };
  const X = (v) => x + pad.l + ((v - xMin) / (xMax - xMin || 1)) * (w - pad.l - pad.r);
  const Y = (v) => y + h - pad.b - ((v - yMin) / (yMax - yMin || 1)) * (h - pad.t - pad.b);
  for (let i = 0; i <= ticks; i++) {
    const v = yMin + ((yMax - yMin) * i) / ticks;
    line(ctx, x + pad.l, Y(v), x + w - pad.r, Y(v), INK.faint);
    label(ctx, yFormat(v), x + pad.l - 6, Y(v), { size: 9.5, align: 'right', baseline: 'middle', color: INK[3] });
  }
  label(ctx, xFormat(xMin), X(xMin), y + h - 6, { size: 9.5, color: INK[3] });
  label(ctx, xFormat(xMax), X(xMax), y + h - 6, { size: 9.5, align: 'right', color: INK[3] });
  if (xLabel) label(ctx, xLabel, (X(xMin) + X(xMax)) / 2, y + h - 6, { size: 9.5, align: 'center', color: INK[3], upper: true, track: 1 });
  if (yLabel) label(ctx, yLabel, x + pad.l, y + pad.t - 2, { size: 9.5, color: INK[3], upper: true, track: 1 });
  for (const s of series) {
    if (!s.points.length) continue;
    ctx.beginPath();
    s.points.forEach(([px, py], i) => (i ? ctx.lineTo(X(px), Y(py)) : ctx.moveTo(X(px), Y(py))));
    ctx.strokeStyle = s.color;
    ctx.lineWidth = s.width || 1.6;
    ctx.setLineDash(s.dash || []);
    ctx.stroke();
    ctx.setLineDash([]);
    const [lx, ly] = s.points[s.points.length - 1];
    dot(ctx, X(lx), Y(ly), 2.6, s.color);
  }
  return { X, Y };
}

/* ------------------------------------------------------------------ */
/* Panel controls                                                     */
/* ------------------------------------------------------------------ */

let uid = 0;
const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

export function section(panel, title) {
  const s = el('section', 'sim-sec');
  if (title) s.append(el('h3', 'sim-sec__title', title));
  panel.append(s);
  return s;
}

export function para(parent, html, cls = 'sim-p') {
  const p = el('p', cls, html);
  parent.append(p);
  return p;
}

export function slider(parent, { label: text, min, max, step = 1, value, format = (v) => v, onInput }) {
  const id = `sim-${++uid}`;
  const row = el('div', 'sim-field');
  const head = el('div', 'sim-field__head');
  const lab = el('label', 'sim-field__label', text);
  lab.htmlFor = id;
  const out = el('output', 'sim-field__value');
  out.htmlFor = id;
  head.append(lab, out);
  const input = el('input', 'sim-range');
  Object.assign(input, { type: 'range', id, min, max, step, value });
  const paint = () => {
    const t = (input.value - min) / (max - min || 1);
    input.style.setProperty('--fill', `${t * 100}%`);
    out.textContent = format(Number(input.value));
  };
  input.addEventListener('input', () => {
    paint();
    onInput?.(Number(input.value));
  });
  paint();
  row.append(head, input);
  parent.append(row);
  return {
    el: row,
    input,
    get value() {
      return Number(input.value);
    },
    set(v) {
      input.value = v;
      paint();
    },
  };
}

export function toggle(parent, { label: text, value = false, onChange }) {
  const id = `sim-${++uid}`;
  const row = el('div', 'sim-toggle');
  const input = el('input');
  Object.assign(input, { type: 'checkbox', id, checked: value });
  input.setAttribute('role', 'switch');
  const lab = el('label', 'sim-toggle__label', `<span class="sim-toggle__track" aria-hidden="true"></span><span>${text}</span>`);
  lab.htmlFor = id;
  input.addEventListener('change', () => onChange?.(input.checked));
  row.append(input, lab);
  parent.append(row);
  return {
    el: row,
    get value() {
      return input.checked;
    },
    set(v) {
      input.checked = v;
    },
  };
}

// A segmented choice (radio group styled as pills).
export function choice(parent, { label: text, options, value, onChange }) {
  const name = `sim-${++uid}`;
  const row = el('fieldset', 'sim-choice');
  row.append(el('legend', 'sim-field__label', text));
  const group = el('div', 'sim-choice__group');
  let current = value;
  for (const o of options) {
    const id = `${name}-${o.value}`;
    const input = el('input');
    Object.assign(input, { type: 'radio', name, id, value: String(o.value), checked: o.value === value });
    const lab = el('label', 'sim-choice__opt', o.label);
    lab.htmlFor = id;
    input.addEventListener('change', () => {
      current = o.value;
      onChange?.(o.value);
    });
    group.append(input, lab);
  }
  row.append(group);
  parent.append(row);
  return {
    el: row,
    get value() {
      return current;
    },
    set(v) {
      current = v;
      const input = group.querySelector(`input[value="${CSS.escape(String(v))}"]`);
      if (input) input.checked = true;
    },
  };
}

// Buttons: [{ id, label, primary, onClick }] -> { [id]: HTMLButtonElement }
export function actions(parent, defs) {
  const row = el('div', 'sim-actions');
  const out = {};
  for (const d of defs) {
    const b = el('button', `sim-btn${d.primary ? ' sim-btn--primary' : ''}`, d.label);
    b.type = 'button';
    b.addEventListener('click', () => d.onClick?.(b));
    row.append(b);
    out[d.id] = b;
  }
  parent.append(row);
  return out;
}

// Live numbers: [{ id, label, value, wide }] -> { set(id, value, tone) }. tone: 'ok' | 'bad' | 'warn' | ''.
export function readout(parent, defs) {
  const grid = el('dl', 'sim-readout');
  const cells = {};
  for (const d of defs) {
    const cell = el('div', `sim-metric${d.wide ? ' sim-metric--wide' : ''}`);
    const dt = el('dt', 'sim-metric__label', d.label);
    const dd = el('dd', 'sim-metric__value', d.value ?? '—');
    cell.append(dt, dd);
    grid.append(cell);
    cells[d.id] = dd;
  }
  parent.append(grid);
  return {
    set(id, value, tone = '') {
      const dd = cells[id];
      if (!dd) return;
      if (dd.textContent !== String(value)) dd.textContent = value;
      dd.dataset.tone = tone;
    },
  };
}

// items: [{ color, label, shape: 'dot' | 'ring' | 'line' | 'dash' }]
export function legend(parent, items) {
  const list = el('ul', 'sim-legend');
  for (const it of items) {
    const li = el('li', 'sim-legend__item');
    const sw = el('i', `sim-legend__sw sim-legend__sw--${it.shape || 'dot'}`);
    sw.style.setProperty('--sw', it.color);
    li.append(sw, document.createTextNode(it.label));
    list.append(li);
  }
  parent.append(list);
  return list;
}

// "Reported in the paper": verbatim figures from the résumé, kept apart from simulated ones.
export function paper(parent, { lines: rows, links = [], title = 'Reported in the paper' }) {
  const box = el('aside', 'sim-paper');
  box.append(el('p', 'sim-paper__kicker', title));
  for (const r of rows) box.append(el('p', 'sim-paper__line', r));
  if (links.length) {
    const nav = el('p', 'sim-paper__links');
    for (const l of links) {
      const a = el('a', null, `${l.label} ↗`);
      a.href = l.href;
      a.target = '_blank';
      a.rel = 'noopener';
      nav.append(a);
    }
    box.append(nav);
  }
  parent.append(box);
  return box;
}

// Fine print under the panel, e.g. what the simulation simplifies.
export function fine(parent, html) {
  return para(parent, html, 'sim-fine');
}

// A polite live region for announcing results to screen readers.
export function live(parent) {
  const region = el('p', 'sim-sr');
  region.setAttribute('aria-live', 'polite');
  parent.append(region);
  return {
    say(text) {
      region.textContent = text;
    },
  };
}

// Overlays on the stage: a status line (bottom left) and a hint (top left).
export function status(stage) {
  const n = el('p', 'sim-status');
  stage.append(n);
  return {
    set(text) {
      if (n.textContent !== text) n.textContent = text;
    },
  };
}

export function hint(stage, text) {
  const n = el('p', 'sim-hint', text);
  stage.append(n);
  return {
    set(t) {
      n.textContent = t;
    },
    hide() {
      n.classList.add('is-hidden');
    },
    show() {
      n.classList.remove('is-hidden');
    },
  };
}
