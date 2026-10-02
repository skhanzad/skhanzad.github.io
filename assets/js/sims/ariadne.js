// Project Ariadne: an intervention-and-replay audit of agent reasoning.
//
// Each simulated agent answers a small arithmetic task in four written steps. Faithful
// agents compute their answer from those steps; "rationalisers" compute it another way
// and write the steps afterwards; partial agents use only the first few steps. The audit
// intervenes on one step at a time, replays the agent (with sampling noise), and checks
// whether the answer moves. A stated step that can change without moving the answer is
// a faithfulness violation.
import {
  C,
  INK,
  alpha,
  rng,
  int,
  pick,
  shuffle,
  clamp,
  easeOut,
  stageCanvas,
  pointer,
  loop,
  label,
  labelFit,
  roundRect,
  glow,
  dot,
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

const N = 30;
const STEPS = 4;
const OPS = [
  { sym: '×', apply: (a, b) => a * b, operand: (r) => int(r, 2, 5) },
  { sym: '+', apply: (a, b) => a + b, operand: (r) => int(r, 6, 48) },
  { sym: '−', apply: (a, b) => a - b, operand: (r) => int(r, 4, 29) },
];

// Phase lengths of one intervention, in seconds at 1x.
const T_EDIT = 0.35;
const T_REPLAY = 0.9;
const T_SETTLE = 0.45;

function makeAgent(r, id, kind) {
  const x0 = int(r, 12, 60);
  const steps = [];
  let v = x0;
  for (let k = 0; k < STEPS; k++) {
    const op = pick(r, OPS);
    const operand = op.operand(r);
    v = op.apply(v, operand);
    steps.push({ op, operand, value: v });
  }
  const reads = kind === 'faithful' ? STEPS : kind === 'rationaliser' ? 0 : int(r, 1, STEPS - 1);
  return { id, kind, reads, x0, steps, answer: v, measured: Array(STEPS).fill(null), votes: Array(STEPS).fill(null), verdict: null };
}

// What the agent answers if its written step k is forced to w (before noise).
function counterfactual(agent, k, w) {
  if (k >= agent.reads) return agent.answer; // the agent never reads this step
  let v = w;
  for (let j = k + 1; j < STEPS; j++) v = agent.steps[j].op.apply(v, agent.steps[j].operand);
  return v;
}

export function create({ stage, panel, reduced }) {
  const params = { unfaithful: 0.5, noise: 0.06, replays: 3, speed: reduced ? 0 : 10 };
  let seed = 7;
  let agents = [];
  let sel = 0;
  let revealed = false;
  let audit = null; // { i, k } while running
  let job = null; // the intervention being animated
  let flash = []; // answer flashes
  let interventions = 0;
  let narration = { text: 'Click any step to intervene on it, or run the full audit.', tone: INK[2] };
  const L = {};

  /* ---------------------------------------------------------------- */
  /* Population                                                       */
  /* ---------------------------------------------------------------- */

  function populate() {
    const r = rng(seed);
    const nBad = Math.round(N * params.unfaithful);
    const kinds = shuffle(r, Array.from({ length: N }, (_, i) => (i < nBad ? (r() < 0.5 ? 'rationaliser' : 'partial') : 'faithful')));
    agents = kinds.map((kind, i) => makeAgent(r, i, kind));
    sel = 0;
    revealed = false;
    audit = null;
    job = null;
    interventions = 0;
    noiseRng = rng(seed * 31 + 5);
    refresh();
  }
  let noiseRng = rng(1);

  // Run one intervention on agent a, step k: returns the job to animate.
  function intervene(a, k) {
    const step = a.steps[k];
    const delta = (noiseRng() < 0.5 ? -1 : 1) * int(noiseRng, 3, 14);
    const w = step.value + delta;
    const truth = counterfactual(a, k, w);
    const outcomes = [];
    for (let i = 0; i < params.replays; i++) {
      let ans = truth;
      if (noiseRng() < params.noise) ans = noiseRng() < 0.5 ? a.answer + int(noiseRng, 1, 9) : a.answer; // sampling noise
      outcomes.push({ answer: ans, changed: ans !== a.answer });
    }
    const changedVotes = outcomes.filter((o) => o.changed).length;
    interventions++;
    return { a, k, w, outcomes, causal: changedVotes > params.replays / 2, t: 0 };
  }

  function record(jobDone) {
    const { a, k, causal, outcomes } = jobDone;
    a.measured[k] = causal;
    a.votes[k] = outcomes.map((o) => o.changed);
    if (a.measured.every((m) => m !== null)) a.verdict = a.measured.some((m) => m === false) ? 'violation' : 'faithful';
  }

  /* ---------------------------------------------------------------- */
  /* Audit driver                                                     */
  /* ---------------------------------------------------------------- */

  function startAudit() {
    agents.forEach((a) => {
      a.measured.fill(null);
      a.votes.fill(null);
      a.verdict = null;
    });
    interventions = 0;
    revealed = false;
    audit = { i: 0, k: 0 };
    job = null;
    tip.hide();
    if (params.speed === 0) {
      // Instant: run the whole protocol now; the grid flips in sequence as it draws.
      agents.forEach((a, i) => {
        for (let k = 0; k < STEPS; k++) record(intervene(a, k));
        a.flipAt = performance.now() / 1000 + i * 0.045;
      });
      audit = null;
      finishAudit();
    }
    refresh();
  }

  function narrateStart(j) {
    narration = { text: `do(step ${j.k + 1} = ${j.w}): replaying the agent ${params.replays}× from the edited step…`, tone: C.ember };
  }

  function narrateEnd(j) {
    const moved = j.outcomes.filter((o) => o.changed).length;
    narration = j.causal
      ? { text: `${moved} of ${params.replays} replays moved the answer, so step ${j.k + 1} is causal.`, tone: C.gold }
      : { text: `${moved} of ${params.replays} replays moved the answer, so step ${j.k + 1} is inert: stated, but not used.`, tone: C.ember };
  }

  function finishAudit() {
    revealed = true;
    const s = summary();
    narration = { text: `Audit complete: ${s.flagged} of ${N} flagged. Rings below show the hidden ground truth.`, tone: C.cream };
    say.say(`Audit complete. ${s.flagged} of ${N} trajectories flagged as faithfulness violations; ${s.agree} of ${N} agree with the hidden ground truth.`);
  }

  function advanceAudit() {
    if (!audit || job) return;
    if (audit.i >= N) {
      audit = null;
      finishAudit();
      refresh();
      return;
    }
    sel = audit.i;
    job = intervene(agents[audit.i], audit.k);
    narrateStart(job);
    audit.k++;
    if (audit.k >= STEPS) {
      audit.k = 0;
      audit.i++;
    }
  }

  function summary() {
    let flagged = 0;
    let agree = 0;
    let missed = 0;
    let falseAlarm = 0;
    let done = 0;
    for (const a of agents) {
      if (!a.verdict) continue;
      done++;
      const truthBad = a.kind !== 'faithful';
      const saidBad = a.verdict === 'violation';
      if (saidBad) flagged++;
      if (truthBad === saidBad) agree++;
      else if (truthBad) missed++;
      else falseAlarm++;
    }
    return { flagged, agree, missed, falseAlarm, done };
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'Thirty agents each answer a small task in four <strong>stated steps</strong>. The harness <em>intervenes</em> on one step at a time, replays the agent, and checks whether the answer moves.',
  );
  para(about, 'If a step the agent claims to rely on can change without changing the answer, the explanation is <strong>not faithful</strong>.');
  legend(about, [
    { color: C.gold, label: 'causal step / faithful' },
    { color: C.ember, label: 'inert step / violation' },
    { color: C.amber, label: 'under audit' },
  ]);

  const controls = section(panel, 'Run the audit');
  const buttons = actions(controls, [
    { id: 'run', label: 'Run audit ▸', primary: true, onClick: () => startAudit() },
    {
      id: 'reseed',
      label: 'New agents',
      onClick: () => {
        seed = (seed * 48271 + 11) % 2147483647;
        populate();
      },
    },
  ]);
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 1.5, label: 'Watch' },
      { value: 10, label: 'Brisk' },
      { value: 0, label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });
  slider(controls, {
    label: 'Unfaithful agents in the population',
    min: 0,
    max: 1,
    step: 0.05,
    value: params.unfaithful,
    format: (v) => `${Math.round(v * 100)}%`,
    onInput: (v) => {
      params.unfaithful = v;
      populate();
    },
  });
  slider(controls, {
    label: 'Replay noise (sampling randomness)',
    min: 0,
    max: 0.3,
    step: 0.01,
    value: params.noise,
    format: (v) => `${Math.round(v * 100)}%`,
    onInput: (v) => (params.noise = v),
  });
  choice(controls, {
    label: 'Replays per intervention (majority vote)',
    options: [1, 3, 5, 9].map((v) => ({ value: v, label: String(v) })),
    value: params.replays,
    onChange: (v) => (params.replays = v),
  });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'audited', label: 'Audited' },
    { id: 'flagged', label: 'Flagged violations' },
    { id: 'replays', label: 'Replays run' },
    { id: 'agree', label: 'Agree with truth' },
    { id: 'missed', label: 'Missed violations' },
    { id: 'false', label: 'False alarms' },
  ]);
  para(results, 'Ground truth stays hidden until the audit ends. Raise the noise with a single replay to watch the audit start making mistakes; more replays win it back.', 'sim-fine');

  paper(panel, {
    lines: [
      'Designed and built an intervention-and-replay harness to test whether an agent’s stated reasoning affects its answer.',
      'Identified faithfulness violations in <strong>23 of 30</strong> audited trajectories (76.7%) under the study’s counterfactual protocol.',
    ],
    links: [{ label: 'arXiv 2601.02314', href: 'https://arxiv.org/abs/2601.02314' }],
  });
  fine(
    panel,
    'The agents here are small arithmetic programs, not language models: a stand-in that makes the protocol visible. The numbers in the readout come from this simulation, not from the paper.',
  );
  const say = live(panel);

  function refresh() {
    const s = summary();
    out.set('audited', `${s.done} / ${N}`);
    out.set('flagged', s.done ? `${s.flagged}` : '—', s.flagged ? 'bad' : '');
    out.set('replays', String(interventions * params.replays));
    out.set('agree', revealed ? `${s.agree} / ${s.done}` : 'hidden', revealed ? (s.agree === s.done ? 'ok' : 'warn') : '');
    out.set('missed', revealed ? String(s.missed) : '—', s.missed ? 'bad' : '');
    out.set('false', revealed ? String(s.falseAlarm) : '—', s.falseAlarm ? 'warn' : '');
    buttons.run.textContent = audit ? 'Auditing…' : s.done === N ? 'Run again ▸' : 'Run audit ▸';
    buttons.run.disabled = !!audit;
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const tip = hint(stage, 'Click a step in the trajectory to intervene on it');
  const ptr = pointer(view.canvas, {
    down: (p) => {
      // A step node in the large trajectory: intervene by hand.
      for (let k = 0; k < STEPS; k++) {
        const n = L.nodes?.[k + 1];
        if (n && Math.hypot(p.x - n.x, p.y - n.y) < 22 && !job && !audit) {
          job = intervene(agents[sel], k);
          narrateStart(job);
          tip.hide();
          return;
        }
      }
      // A trajectory in the population grid: inspect it.
      const i = gridHit(p.x, p.y);
      if (i >= 0 && !audit) sel = i;
    },
  });

  function layout(v) {
    const w = v.w;
    const h = v.h;
    L.compact = w < 620 || h < 480;
    const pad = Math.max(16, Math.min(40, w * 0.04));
    const top = { x: pad, y: L.compact ? 40 : 52, w: w - pad * 2, h: Math.max(150, h * (L.compact ? 0.42 : 0.4)) };
    L.top = top;
    const cy = top.y + top.h * 0.56;
    const inset = 36; // room for the question and answer boxes
    const span = top.w - inset * 2;
    L.nodes = Array.from({ length: STEPS + 2 }, (_, i) => ({ x: top.x + inset + (span * i) / (STEPS + 1), y: cy }));
    const gy = top.y + top.h + (L.compact ? 22 : 30);
    const cols = w < 520 ? 5 : 6;
    const rows = Math.ceil(N / cols);
    L.grid = { x: pad, y: gy + 18, w: w - pad * 2, h: Math.max(100, h - gy - 18 - (L.compact ? 30 : 40)), cols, rows };
  }

  function cell(i) {
    const g = L.grid;
    const cw = g.w / g.cols;
    const ch = g.h / g.rows;
    const c = i % g.cols;
    const r = Math.floor(i / g.cols);
    return { x: g.x + c * cw, y: g.y + r * ch, w: cw, h: ch };
  }

  function gridHit(x, y) {
    if (!L.grid) return -1;
    for (let i = 0; i < N; i++) {
      const c = cell(i);
      if (x >= c.x && x < c.x + c.w && y >= c.y && y < c.y + c.h) return i;
    }
    return -1;
  }

  // Quadratic segment between nodes i and i + 1 (arched alternately).
  function seg(i) {
    const a = L.nodes[i];
    const b = L.nodes[i + 1];
    const lift = (i % 2 ? 1 : -1) * Math.min(26, (b.x - a.x) * 0.22);
    return [a.x, a.y, (a.x + b.x) / 2, a.y + lift, b.x, b.y];
  }

  function pointAlong(fromNode, t) {
    // t in [0, 1] across the segments from node `fromNode` to the answer node.
    const segs = STEPS + 1 - fromNode;
    const f = clamp(t) * segs;
    const i = Math.min(segs - 1, Math.floor(f));
    return quadAt(...seg(fromNode + i), f - i);
  }

  function drawTrajectory(time) {
    const a = agents[sel];
    const top = L.top;
    const nodes = L.nodes;
    const active = job && job.a === a ? job : null;

    label(ctx, `Trajectory #${String(a.id + 1).padStart(2, '0')}`, top.x, top.y + 4, { size: 11, upper: true, track: 1.6, color: C.gold });
    labelFit(ctx, narration.text, top.x, top.y + 36, top.w, { size: 19, minSize: 12, font: 'serif', italic: true, color: narration.tone });
    const kindText = revealed || a.verdict ? describe(a) : 'agent type hidden';
    label(ctx, kindText, top.x + top.w, top.y + 4, { size: 11, align: 'right', color: revealed ? INK[2] : INK[3] });

    // Thread.
    for (let i = 0; i <= STEPS; i++) {
      const [x1, y1, cx, cy, x2, y2] = seg(i);
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      const m = i >= 1 ? a.measured[i - 1] : null;
      ctx.strokeStyle = m === false ? alpha(C.ember, 0.55) : alpha(C.gold, 0.75);
      ctx.lineWidth = 1.6;
      ctx.setLineDash(m === false ? [4, 5] : []);
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Question and answer boxes.
    const q = nodes[0];
    const ans = nodes[STEPS + 1];
    box(q.x, q.y, `x = ${a.x0}`, C.cream, 'question');
    const fl = flash.find((f) => f.a === a);
    let ansText = `= ${a.answer}`;
    let ansColor = C.cream;
    if (fl) {
      const k = clamp(1 - (time - fl.t0) / 1.1);
      ansColor = fl.changed ? C.gold : C.ember;
      ansText = `= ${fl.answer}`;
      glow(ctx, ans.x, ans.y, 46 * (0.6 + 0.4 * k), fl.changed ? C.gold : C.ember, 0.55 * k);
    }
    box(ans.x, ans.y, ansText, ansColor, 'answer');

    // Steps.
    for (let k = 0; k < STEPS; k++) {
      const n = nodes[k + 1];
      const s = a.steps[k];
      const m = a.measured[k];
      const editing = active && active.k === k;
      const hover = !job && !audit && Math.hypot(ptr.x - n.x, ptr.y - n.y) < 22;
      if (editing) glow(ctx, n.x, n.y, 34, C.ember, 0.5);
      else if (hover) glow(ctx, n.x, n.y, 30, C.gold, 0.35);
      const fill = m === true ? C.gold : C.midnight;
      const stroke = m === false || editing ? C.ember : C.gold;
      dot(ctx, n.x, n.y, 11, fill, stroke, 1.6);
      if (m === false) {
        ctx.beginPath();
        ctx.moveTo(n.x - 4, n.y - 4);
        ctx.lineTo(n.x + 4, n.y + 4);
        ctx.moveTo(n.x + 4, n.y - 4);
        ctx.lineTo(n.x - 4, n.y + 4);
        ctx.strokeStyle = C.ember;
        ctx.lineWidth = 1.6;
        ctx.stroke();
      }
      label(ctx, L.compact ? `s${k + 1}` : `step ${k + 1}`, n.x, n.y - 24, { size: 10, align: 'center', upper: true, track: 1.2, color: INK[3] });
      const value = editing ? `${active.w}` : `${s.value}`;
      label(ctx, `${s.op.sym}${s.operand}`, n.x, n.y + 28, { size: 12, align: 'center', color: INK[2] });
      label(ctx, `→ ${value}`, n.x, n.y + 45, { size: 12, align: 'center', color: editing ? C.ember : C.cream });
      const votes = a.votes[k];
      if (votes && !editing) {
        votes.forEach((v, i) => dot(ctx, n.x + (i - (votes.length - 1) / 2) * 8, n.y + 60, 2.3, v ? C.gold : C.ember));
      }
      if (editing) {
        label(ctx, L.compact ? `do(${active.w})` : `do(step ${k + 1} = ${active.w})`, n.x, n.y - 40, { size: 11, align: 'center', color: C.ember });
      } else if (m !== null) {
        label(ctx, m ? 'causal' : 'inert', n.x, n.y - 40, { size: L.compact ? 9 : 10, align: 'center', upper: true, track: L.compact ? 0.4 : 1, color: m ? C.gold : C.ember });
      }
    }

    // Replays travelling from the edited step to the answer.
    if (active) {
      const tt = active.t;
      active.outcomes.forEach((o, i) => {
        const start = T_EDIT + i * 0.12;
        const p = clamp((tt - start) / T_REPLAY);
        if (p <= 0 || p >= 1) return;
        const [x, y] = pointAlong(active.k + 1, easeOut(p));
        glow(ctx, x, y, 14, o.changed ? C.gold : C.ember, 0.9);
        dot(ctx, x, y, 2.4, C.cream);
      });
    }
  }

  function box(x, y, text, color, kind) {
    const w = Math.max(64, text.length * 8 + 22);
    roundRect(ctx, x - w / 2, y - 16, w, 32, 9);
    ctx.fillStyle = alpha(C.midnight, 0.9);
    ctx.fill();
    ctx.strokeStyle = alpha(color, 0.7);
    ctx.lineWidth = 1.2;
    ctx.stroke();
    label(ctx, text, x, y + 1, { size: 13, align: 'center', baseline: 'middle', color });
    label(ctx, kind, x, y + 30, { size: 10, align: 'center', upper: true, track: 1.2, color: INK[3] });
  }

  function describe(a) {
    if (a.kind === 'faithful') return 'faithful: uses all four steps';
    if (a.kind === 'rationaliser') return 'rationaliser: steps written after the fact';
    return `partial: reads ${a.reads} of ${STEPS} steps`;
  }

  function drawGrid(time) {
    const g = L.grid;
    label(ctx, `Population · ${N} trajectories`, g.x, g.y - 12, { size: 11, upper: true, track: 1.6, color: C.gold });
    if (revealed) {
      label(ctx, 'ring = hidden ground truth', g.x + g.w, g.y - 12, { size: 10, align: 'right', color: INK[3] });
    }
    for (let i = 0; i < N; i++) {
      const a = agents[i];
      const c = cell(i);
      const flipped = a.flipAt == null || time >= a.flipAt;
      const verdict = flipped ? a.verdict : null;
      const auditing = audit && audit.i === i;
      const color = verdict === 'faithful' ? C.gold : verdict === 'violation' ? C.ember : auditing ? C.amber : INK[4];
      const x0 = c.x + c.w * 0.14;
      const x1 = c.x + c.w * 0.86;
      const y = c.y + c.h * 0.48;
      if (i === sel) {
        roundRect(ctx, c.x + 4, c.y + 4, c.w - 8, c.h - 8, 10);
        ctx.strokeStyle = alpha(C.cream, 0.35);
        ctx.lineWidth = 1;
        ctx.stroke();
      }
      ctx.beginPath();
      for (let k = 0; k < STEPS + 2; k++) {
        const x = x0 + ((x1 - x0) * k) / (STEPS + 1);
        const yy = y + (k % 2 ? -1 : 1) * Math.min(5, c.h * 0.06);
        if (k) ctx.lineTo(x, yy);
        else ctx.moveTo(x, yy);
      }
      ctx.strokeStyle = alpha(color === INK[4] ? C.cream : color, color === INK[4] ? 0.22 : 0.8);
      ctx.lineWidth = 1.2;
      ctx.stroke();
      for (let k = 0; k < STEPS + 2; k++) {
        const x = x0 + ((x1 - x0) * k) / (STEPS + 1);
        const yy = y + (k % 2 ? -1 : 1) * Math.min(5, c.h * 0.06);
        const m = k >= 1 && k <= STEPS && flipped ? a.measured[k - 1] : null;
        const col = m === false ? C.ember : m === true ? C.gold : color === INK[4] ? alpha(C.cream, 0.35) : color;
        dot(ctx, x, yy, k === 0 || k === STEPS + 1 ? 2.6 : 2, col);
      }
      if (auditing) glow(ctx, x1, y, 22, C.amber, 0.45 + 0.25 * Math.sin(time * 8));
      if (revealed && flipped) {
        const truthBad = a.kind !== 'faithful';
        dot(ctx, x1, y, 7, null, truthBad ? C.ember : C.gold, 1.1);
        if (a.verdict && truthBad !== (a.verdict === 'violation')) {
          label(ctx, '!', x1 + 11, y - 6, { size: 12, color: C.amber, weight: 500 });
        }
      }
      if (c.h >= 34) label(ctx, `#${String(i + 1).padStart(2, '0')}`, x0, c.y + c.h * 0.84, { size: 9.5, color: INK[3] });
    }
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    const speed = params.speed || 8;
    if (job) {
      job.t += dt * speed;
      if (job.t >= T_EDIT + T_REPLAY + params.replays * 0.12 && !job.arrived) {
        job.arrived = true;
        const majority = job.causal;
        const shown = job.outcomes.find((o) => o.changed === majority) || job.outcomes[0];
        flash = [{ a: job.a, t0: time, changed: majority, answer: shown.answer }];
        record(job);
        narrateEnd(job);
        refresh();
      }
      if (job.t >= T_EDIT + T_REPLAY + params.replays * 0.12 + T_SETTLE) job = null;
    }
    if (audit && !job) advanceAudit();
    flash = flash.filter((f) => time - f.t0 < 1.2);

    view.clear();
    if (!L.nodes) layout(view);
    drawTrajectory(time);
    drawGrid(time);
    const s = summary();
    stat.set(
      L.compact
        ? `${s.done}/${N} audited · ${interventions * params.replays} replays`
        : `seed ${seed} · ${s.done}/${N} audited · ${interventions * params.replays} replays · noise ${Math.round(params.noise * 100)}%`,
    );
  });

  populate();

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
