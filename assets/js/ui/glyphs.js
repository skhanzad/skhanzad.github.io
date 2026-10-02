// Small line drawings for the research cards, one per project. Each is generated
// (seeded, so it is the same every visit) into a 300 x 104 viewBox.
import { rng } from '../world/formations.js';

const W = 300;
const H = 104;
const f = (n) => Math.round(n * 10) / 10;
const node = (x, y, r = 4.5, cls = 'g-node') => `<circle class="${cls}" cx="${f(x)}" cy="${f(y)}" r="${r}"/>`;
const line = (d, cls = 'g-line', draw = true) =>
  `<path class="${cls}${draw ? ' g-draw' : ''}" d="${d}"${draw ? ' pathLength="1"' : ''}/>`;

const GLYPHS = {
  // A five-step trajectory; an intervention at step three forks a counterfactual.
  ariadne() {
    const xs = [16, 83, 150, 217, 284];
    let s = line('M8 52 H292', 'g-dim', false);
    s += line('M16 52 C 44 24, 56 80, 83 52 S 122 24, 150 52 S 190 80, 217 52 S 256 24, 284 52');
    s += line('M150 52 C 178 60, 190 92, 220 90 S 262 82, 284 94', 'g-alt');
    s += `<circle class="g-halo" cx="150" cy="52" r="11"/>`;
    s += xs.map((x) => node(x, 52)).join('');
    s += `<path class="g-x" d="M279 89 l10 10 M289 89 l-10 10"/>`;
    s += `<text class="g-text" x="150" y="25" text-anchor="middle">do(x)</text>`;
    return s;
  },

  // Falling gas cost, with the fuzzer's probes riding the tops.
  gaszero() {
    const r = rng(4);
    let s = line('M8 94 H292', 'g-dim', false);
    let tops = '';
    for (let i = 0; i < 18; i++) {
      const x = 14 + i * 16;
      const h = 76 * (1 - i / 23) * (0.78 + 0.22 * r());
      s += `<rect class="g-bar" x="${x}" y="${f(94 - h)}" width="6" height="${f(h)}" rx="1" style="opacity:${f(0.25 + 0.7 * (1 - i / 18))}"/>`;
      tops += `${i ? 'L' : 'M'}${x + 3} ${f(94 - h - 8 - r() * 6)} `;
    }
    s += line(tops, 'g-alt');
    return s;
  },

  // A restarting random walk across a grid toward the goal.
  search() {
    const r = rng(9);
    let s = '';
    for (let c = 0; c < 14; c++) for (let k = 0; k < 4; k++) s += `<circle class="g-grid" cx="${16 + c * 20.6}" cy="${19 + k * 22}" r="1.3"/>`;
    const pt = (c, k) => `${f(16 + c * 20.6)} ${19 + k * 22}`;
    let c = 0;
    let k = 1;
    let d = `M${pt(c, k)}`;
    const visited = [[c, k]];
    while (c < 13) {
      const roll = r();
      if (roll < 0.55) c++;
      else if (roll < 0.78 && k > 0) k--;
      else if (k < 3) k++;
      else c++;
      d += ` L${pt(c, k)}`;
      visited.push([c, k]);
      if (visited.length === 9) {
        s += line(`M${pt(c, k)} Q ${f(16 + c * 20.6)} 100, ${pt(visited[3][0], visited[3][1])}`, 'g-alt');
        [c, k] = visited[3];
        d += ` M${pt(c, k)}`;
      }
    }
    s += line(d);
    s += node(16, 41) + `<circle class="g-halo" cx="${f(16 + 13 * 20.6)}" cy="${19 + k * 22}" r="9"/>` + node(16 + 13 * 20.6, 19 + k * 22, 4.5, 'g-node g-node--hot');
    return s;
  },

  // Real samples (solid) and the synthetic ones grown around them (rings).
  gansemble() {
    const r = rng(17);
    let s = '';
    const centres = [
      [62, 52],
      [150, 46],
      [238, 58],
    ];
    for (const [cx, cy] of centres) {
      s += `<ellipse class="g-dim" cx="${cx}" cy="${cy}" rx="44" ry="34"/>`;
      for (let i = 0; i < 9; i++) {
        const a = r() * Math.PI * 2;
        const d = 8 + r() * 26;
        s += `<circle class="g-ring" cx="${f(cx + Math.cos(a) * d * 1.25)}" cy="${f(cy + Math.sin(a) * d * 0.85)}" r="3"/>`;
      }
      for (let i = 0; i < 3; i++) {
        const a = r() * Math.PI * 2;
        const d = r() * 12;
        s += `<circle class="g-dot" cx="${f(cx + Math.cos(a) * d)}" cy="${f(cy + Math.sin(a) * d)}" r="3.4"/>`;
      }
    }
    return s;
  },

  // Three candidate causal graphs, each probed by an intervention; they agree.
  iss() {
    let s = '';
    const graphs = [
      [[0, 1], [0, 2], [1, 2]],
      [[0, 1], [1, 2], [0, 2]],
      [[0, 2], [1, 2], [0, 1]],
    ];
    graphs.forEach((edges, g) => {
      const ox = 22 + g * 92;
      const p = [
        [ox, 26],
        [ox + 56, 26],
        [ox + 28, 82],
      ];
      for (const [a, b] of edges) s += line(`M${p[a][0]} ${p[a][1]} L${p[b][0]} ${p[b][1]}`);
      s += `<circle class="g-halo" cx="${p[0][0]}" cy="${p[0][1]}" r="10"/>`;
      s += p.map(([x, y], i) => node(x, y, 4.5, i === 0 ? 'g-node g-node--hot' : 'g-node')).join('');
    });
    s += `<text class="g-text" x="${22 + 2 * 92 + 70}" y="58">≡</text>`;
    return s;
  },

  // A provenance chain; the raw artifact at the end stays locked.
  chronicles() {
    let s = line('M20 52 H270', 'g-line');
    for (let i = 0; i < 5; i++) {
      const x = 14 + i * 56;
      s += `<rect class="g-block" x="${x}" y="36" width="34" height="32" rx="7"/>`;
      s += `<path class="g-dim" d="M${x + 9} 47 H${x + 25} M${x + 9} 56 H${x + 20}"/>`;
    }
    s += `<rect class="g-lock" x="268" y="44" width="22" height="18" rx="4"/><path class="g-alt-solid" d="M273 44 v-5 a6 6 0 0 1 12 0 v5"/>`;
    return s;
  },

  // Planning, coding, debugging and review, coordinated around a shared hub.
  mesh() {
    const pts = [
      [150, 14],
      [246, 52],
      [150, 90],
      [54, 52],
    ];
    const labels = ['plan', 'code', 'debug', 'review'];
    let s = '';
    for (let i = 0; i < 4; i++) {
      const [x1, y1] = pts[i];
      const [x2, y2] = pts[(i + 1) % 4];
      s += line(`M${x1} ${y1} L${x2} ${y2}`);
      s += line(`M${x1} ${y1} L150 52`, 'g-dim', false);
    }
    s += `<circle class="g-halo" cx="150" cy="52" r="12"/>` + node(150, 52, 5, 'g-node g-node--hot');
    pts.forEach(([x, y], i) => {
      s += node(x, y);
      const dx = i === 1 ? 12 : i === 3 ? -12 : 0;
      const dy = i === 0 ? -1 : i === 2 ? 14 : 4;
      const anchor = i === 1 ? 'start' : i === 3 ? 'end' : 'middle';
      s += `<text class="g-label" x="${x + dx}" y="${y + dy + (i === 0 ? -8 : 0)}" text-anchor="${anchor}">${labels[i]}</text>`;
    });
    return s;
  },

  // A dependency tree with one broken edge, and the repair that routes around it.
  pllm() {
    const root = [20, 52];
    const mid = [
      [110, 26],
      [110, 78],
    ];
    const leaves = [
      [200, 12],
      [200, 40],
      [200, 66],
      [200, 92],
    ];
    let s = '';
    const curve = (a, b) => `M${a[0]} ${a[1]} C ${a[0] + 40} ${a[1]}, ${b[0] - 40} ${b[1]}, ${b[0]} ${b[1]}`;
    s += line(curve(root, mid[0])) + line(curve(root, mid[1]));
    s += line(curve(mid[0], leaves[0])) + line(curve(mid[0], leaves[1])) + line(curve(mid[1], leaves[3]));
    s += `<path class="g-broken" d="${curve(mid[1], leaves[2])}"/>`;
    s += line(`M${mid[1][0]} ${mid[1][1]} C 150 98, 250 96, 270 66 L 210 66`, 'g-alt');
    s += node(...root, 5) + mid.map((p) => node(...p)).join('') + leaves.map((p, i) => node(...p, 4, i === 2 ? 'g-node g-node--hot' : 'g-node')).join('');
    s += `<text class="g-text" x="276" y="70">fix</text>`;
    return s;
  },
};

export function drawGlyphs(scope = document) {
  scope.querySelectorAll('[data-glyph]').forEach((el) => {
    const make = GLYPHS[el.dataset.glyph];
    if (!make) return;
    el.innerHTML = `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid meet">${make()}</svg>`;
  });
}
