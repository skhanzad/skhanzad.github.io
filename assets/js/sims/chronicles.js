// Provenance Preserving Chronicles: federated disclosure of personal context.
//
// An agent answers a question that needs personal context kept by four holders. Under naive
// sharing the holders hand over whole records. Under the protocol the agent sends a scoped
// request; a policy gate at each holder releases only the authorized fields, as derived
// claims that carry provenance (holder, source artifact, time, and a SHA-256 hash bound to
// the question). The agent re-hashes every claim before chaining it into its ledger, and a
// raw artifact leaves its holder only when the holder (the visitor) approves.
import {
  C,
  INK,
  alpha,
  rng,
  int,
  pick,
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
  quadAt,
  section,
  para,
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

/* ------------------------------------------------------------------ */
/* Holders, fields and questions                                      */
/* ------------------------------------------------------------------ */

// Every holder keeps artifacts made of fields: [id, name, sensitive].
const HOLDERS = [
  {
    id: 'health',
    name: 'Health record',
    short: 'Health',
    artifacts: [
      { id: 'appt', name: 'appointment', fields: [['time', 'appointment time'], ['notice', 'notice rule'], ['reason', 'reason for visit', 1]] },
      { id: 'history', name: 'history', fields: [['diagnosis', 'diagnosis', 1], ['meds', 'medication', 1], ['allergies', 'allergies', 1], ['labs', 'lab results', 1]] },
      { id: 'vaccines', name: 'vaccine cert', doc: 'vaccine certificate', fields: [['list', 'vaccines'], ['dates', 'dates'], ['lots', 'lot numbers']] },
    ],
  },
  {
    id: 'calendar',
    name: 'Calendar',
    short: 'Calendar',
    artifacts: [
      { id: 'week', name: 'this week', fields: [['titles', 'event titles', 1], ['people', 'attendees', 1], ['places', 'locations', 1], ['free', 'free/busy']] },
      { id: 'visits', name: 'visits', fields: [['visit', 'clinic visit'], ['notes', 'visit notes', 1]] },
    ],
  },
  {
    id: 'bank',
    name: 'Bank',
    short: 'Bank',
    artifacts: [
      { id: 'account', name: 'account', fields: [['balance', 'balance', 1], ['surplus', 'monthly surplus'], ['number', 'account number', 1]] },
      { id: 'bills', name: 'bills', fields: [['fixed', 'fixed costs'], ['payees', 'payees', 1]] },
      { id: 'txns', name: 'transactions', fields: [['merchants', 'merchants', 1], ['amounts', 'amounts'], ['places', 'places visited', 1]] },
    ],
  },
  {
    id: 'messages',
    name: 'Messages',
    short: 'Messages',
    artifacts: [
      { id: 'work', name: 'work thread', fields: [['recipient', 'recipient'], ['due', 'promise'], ['body', 'work messages', 1]] },
      { id: 'travel', name: 'travel thread', fields: [['quote', 'trip quote'], ['itinerary', 'itinerary']] },
      { id: 'clinic', name: 'clinic thread', fields: [['intake', 'intake address'], ['body', 'clinic messages', 1]] },
      { id: 'family', name: 'family thread', fields: [['body', 'family messages', 1]] },
    ],
  },
];

const FIELDS = [];
const FIELD = {};
HOLDERS.forEach((holder, h) => {
  for (const ar of holder.artifacts) {
    ar.keys = ar.fields.map(([id, name, sensitive]) => {
      const key = `${holder.id}.${ar.id}.${id}`;
      FIELD[key] = { key, h, ar, name, sensitive: !!sensitive };
      FIELDS.push(FIELD[key]);
      return key;
    });
  }
});

const holderOf = (id) => HOLDERS.findIndex((x) => x.id === id);
const artifactOf = (h, id) => HOLDERS[h].artifacts.find((a) => a.id === id);
const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const list = (items) => (items.length < 2 ? items.join('') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`);
const money = (v) => `$${fmt.int(v)}`;

// A claim a holder may derive: which fields it reads, how it is worded, and which value a
// tamperer in transit would change.
function claim(holder, artifact, fields, say, alters) {
  const h = holderOf(holder);
  return { h, ar: artifactOf(h, artifact), keys: fields.map((f) => `${holder}.${artifact}.${f}`), say, alters: `${holder}.${artifact}.${alters}` };
}

// Answer tokens: plain words, values (marked when altered) and provenance citations.
const words = (s) => s.split(' ').map((w) => ({ s: w }));
const val = (f) => ({ s: String(f.v), val: true, altered: f.altered });
const cite = (id, after = '') => (id ? { cite: id, after } : after ? { s: after, glue: true } : null);

const QUESTIONS = [
  {
    short: 'Vaccine record',
    text: 'Send my vaccine record to the travel clinic.',
    claims: [
      claim('messages', 'clinic', ['intake'], (v) => `clinic intake: ${v['messages.clinic.intake']}`, 'intake'),
      claim('calendar', 'visits', ['visit'], (v) => `travel-clinic visit: ${v['calendar.visits.visit']}`, 'visit'),
    ],
    raw: { h: holderOf('health'), ar: artifactOf(holderOf('health'), 'vaccines') },
    answer({ get, c, raw }) {
      const intake = get('messages.clinic.intake');
      const visit = get('calendar.visits.visit');
      if (raw.state === 'denied') return [...words('Not sent: you kept the certificate. Your visit is'), val(visit), cite(c(1), '.')];
      return [...words('Sent your vaccine certificate'), cite(raw.id), ...words('to'), val(intake), cite(c(0), ','), ...words('ahead of your'), val(visit), ...words('visit'), cite(c(1), '.')];
    },
  },
  {
    short: 'Move appointment',
    text: 'Can I move my appointment to Friday?',
    claims: [
      claim('health', 'appt', ['time', 'notice'], (v) => `appointment ${v['health.appt.time']}; moving needs ${v['health.appt.notice']} notice`, 'notice'),
      claim('calendar', 'week', ['free'], (v) => (v['calendar.week.free'] === 'none' ? 'Friday: fully booked' : `Friday free ${v['calendar.week.free']}`), 'free'),
    ],
    answer({ get, c }) {
      const time = get('health.appt.time');
      const notice = get('health.appt.notice');
      const free = get('calendar.week.free');
      if (free.v === 'none') return [...words('No: Friday is fully booked'), cite(c(1), '.'), ...words('Keep'), val(time), cite(c(0), '.')];
      return [...words('Yes: Friday'), val(free), ...words('is free'), cite(c(1), ','), ...words('and'), val(time), ...words('can move with'), val({ ...notice, v: `${notice.v} notice` }), cite(c(0), '.')];
    },
  },
  {
    short: 'Afford the trip',
    text: 'Can I afford the trip in May?',
    claims: [
      claim('bank', 'account', ['balance', 'surplus'], (v) => `projected 1 May balance: ${money(v['bank.account.balance'] + 3 * v['bank.account.surplus'])}`, 'balance'),
      claim('messages', 'travel', ['quote'], (v) => `trip quote: ${money(v['messages.travel.quote'])}`, 'quote'),
    ],
    answer({ get, c }) {
      const bal = get('bank.account.balance');
      const sur = get('bank.account.surplus');
      const quote = get('messages.travel.quote');
      const proj = bal.v + 3 * sur.v;
      const p = { v: money(proj), altered: bal.altered || sur.altered };
      const q = { v: money(quote.v), altered: quote.altered };
      const d = { v: money(Math.abs(proj - quote.v)), altered: p.altered || q.altered };
      if (proj >= quote.v) return [...words('Yes:'), val(p), ...words('projected for 1 May'), cite(c(0)), ...words('covers the'), val(q), ...words('quote'), cite(c(1), ','), ...words('with'), val(d), ...words('to spare.')];
      return [...words('Not yet:'), val(p), ...words('projected for 1 May'), cite(c(0)), ...words('is'), val(d), ...words('short of the'), val(q), ...words('quote'), cite(c(1), '.')];
    },
  },
  {
    short: 'Promised report',
    text: 'Who did I promise the report to?',
    claims: [claim('messages', 'work', ['recipient', 'due'], (v) => `Q3 report promised to ${v['messages.work.recipient']}, due ${v['messages.work.due']}`, 'recipient')],
    answer({ get, c }) {
      const who = get('messages.work.recipient');
      const due = get('messages.work.due');
      return [...words('You promised the Q3 report to'), val(who), { s: ',', glue: true }, ...words('due'), val(due), cite(c(0), '.')];
    },
  },
];

// The personal records behind one seed, plus what a tamperer would change them to.
function makeWorld(seed) {
  const r = rng(seed);
  const names = shuffle(r, ['Maya', 'Jonas', 'Priya', 'Teo', 'Ines', 'Omar']);
  const visitTime = pick(r, ['09:20', '10:40', '15:10']);
  const balance = int(r, 110, 340) * 10;
  const quote = int(r, 150, 330) * 10;
  const v = {
    'health.appt.time': `${pick(r, ['Wed', 'Thu'])} ${pick(r, ['09:30', '11:15', '16:40'])}`,
    'health.appt.notice': pick(r, ['24 h', '48 h']),
    'health.appt.reason': 'thyroid follow-up',
    'health.history.diagnosis': 'hypothyroidism',
    'health.history.meds': 'levothyroxine',
    'health.history.allergies': 'penicillin',
    'health.history.labs': `TSH ${(1.2 + r() * 2.6).toFixed(1)}`,
    'health.vaccines.list': 'hepatitis A, typhoid, Tdap',
    'health.vaccines.dates': '2019, 2023, 2024',
    'health.vaccines.lots': `${int(r, 3, 6)} lots`,
    'calendar.week.titles': `${int(r, 7, 14)} events`,
    'calendar.week.people': `${names[2]}, ${names[3]}`,
    'calendar.week.places': 'office, gym, clinic',
    'calendar.week.free': pick(r, ['14:00–16:00', '10:00–12:00', '15:30–17:30', 'none']),
    'calendar.visits.visit': `${pick(r, ['Mon', 'Tue', 'Wed'])} ${visitTime}`,
    'calendar.visits.notes': 'bring passport',
    'bank.account.balance': balance,
    'bank.account.surplus': int(r, 15, 55) * 10,
    'bank.account.number': `**** ${int(r, 1000, 9999)}`,
    'bank.bills.fixed': int(r, 90, 160) * 10,
    'bank.bills.payees': 'landlord, utilities',
    'bank.txns.merchants': `${int(r, 30, 60)} merchants`,
    'bank.txns.amounts': `${int(r, 80, 140)} payments`,
    'bank.txns.places': `${int(r, 3, 9)} cities`,
    'messages.work.recipient': names[0],
    'messages.work.due': pick(r, ['Thu', 'Fri', 'Mon']),
    'messages.work.body': `${int(r, 12, 40)} messages`,
    'messages.travel.quote': quote,
    'messages.travel.itinerary': `${pick(r, ['Lisbon', 'Kyoto', 'Oaxaca', 'Porto'])}, 12–19 May`,
    'messages.clinic.intake': 'intake@clinic.example',
    'messages.clinic.body': '3 messages',
    'messages.family.body': `${int(r, 20, 90)} messages`,
  };
  const fake = {
    'messages.clinic.intake': 'intake@c1inic.example',
    'calendar.visits.visit': `Sat ${visitTime}`,
    'health.appt.notice': 'no',
    'calendar.week.free': '08:00–18:00',
    'bank.account.balance': balance * 10,
    'messages.travel.quote': Math.round(quote / 100) * 10,
    'messages.work.recipient': names[1],
  };
  return { v, fake, base: int(r, 9, 16) * 3600 + int(r, 0, 59) * 60 + int(r, 0, 59) };
}

const clock = (sec) => {
  const s = Math.floor(sec) % 86400;
  return [Math.floor(s / 3600), Math.floor(s / 60) % 60, s % 60].map((n) => String(n).padStart(2, '0')).join(':');
};

/* ------------------------------------------------------------------ */
/* SHA-256 (synchronous, so every run is reproducible frame by frame) */
/* ------------------------------------------------------------------ */

const K = new Uint32Array(64);
const H0 = new Uint32Array(8);
for (let n = 2, k = 0; k < 64; n++) {
  let prime = true;
  for (let d = 2; d * d <= n; d++) if (n % d === 0) prime = false;
  if (!prime) continue;
  if (k < 8) H0[k] = (Math.pow(n, 1 / 2) * 4294967296) | 0;
  K[k++] = (Math.pow(n, 1 / 3) * 4294967296) | 0;
}
const ror = (x, n) => (x >>> n) | (x << (32 - n));

function sha256(text) {
  const bytes = new TextEncoder().encode(text);
  const n = bytes.length;
  const words32 = new Uint32Array(((n + 8) >> 6) * 16 + 16);
  for (let i = 0; i < n; i++) words32[i >> 2] |= bytes[i] << (24 - (i % 4) * 8);
  words32[n >> 2] |= 0x80 << (24 - (n % 4) * 8);
  words32[words32.length - 1] = n * 8;
  const H = H0.slice();
  const W = new Uint32Array(64);
  for (let o = 0; o < words32.length; o += 16) {
    for (let t = 0; t < 64; t++) {
      if (t < 16) W[t] = words32[o + t];
      else {
        const a = W[t - 15];
        const b = W[t - 2];
        W[t] = W[t - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + W[t - 7] + (ror(b, 17) ^ ror(b, 19) ^ (b >>> 10));
      }
    }
    let [a, b, c, d, e, f, g, h] = H;
    for (let t = 0; t < 64; t++) {
      const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K[t] + W[t]) | 0;
      const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) | 0;
      h = g;
      g = f;
      f = e;
      e = (d + t1) | 0;
      d = c;
      c = b;
      b = a;
      a = (t1 + t2) | 0;
    }
    H[0] += a;
    H[1] += b;
    H[2] += c;
    H[3] += d;
    H[4] += e;
    H[5] += f;
    H[6] += g;
    H[7] += h;
  }
  return Array.from(H, (x) => x.toString(16).padStart(8, '0')).join('');
}

/* ------------------------------------------------------------------ */
/* Timing                                                             */
/* ------------------------------------------------------------------ */

// Protocol time in seconds at normal speed.
const T = { ask: 0.9, plan: 0.55, hop: 1.0, check: 0.28, read: 0.5, stagger: 0.16, dump: 0.13, verify: 0.42, retry: 0.3 };
const GATE = 0.72; // where each holder's policy gate sits along its edge
const TAMPER_AT = 0.45; // how far into its trip a tampered packet is altered
const SPEED = { watch: 0.55, normal: 1, instant: 400 };
const ARC = [162, 116, 64, 18].map((d) => (d * Math.PI) / 180); // holder angles around the agent

export function create({ stage, panel, reduced }) {
  const params = { q: 0, mode: 'protocol', curious: false, tamper: false, auto: false, speed: reduced ? 'instant' : 'normal' };
  let seed = 7;
  let world = makeWorld(seed);
  let runs = 0;
  let run = null;
  let narration = null;
  let hover = null;
  const L = { hit: {} };

  const selected = () => QUESTIONS[params.q];
  const neededOf = (q) => new Set([...q.claims.flatMap((c) => c.keys), ...(q.raw ? q.raw.ar.keys : [])]);
  const holdersOf = (q) => new Set([...q.claims.map((c) => c.h), ...(q.raw ? [q.raw.h] : [])]);
  const clockNow = () => performance.now() / 1000;

  function narrate(text, tone = INK[2], short = text) {
    narration = { text, tone, short };
  }

  function idle() {
    const n = neededOf(selected()).size;
    narrate(`This question needs ${n} of the ${FIELDS.length} fields the holders keep, ringed in gold. Ask the agent.`, INK[2], `It needs ${n} of ${FIELDS.length} fields. Ask the agent.`);
  }

  /* ---------------------------------------------------------------- */
  /* Run engine: a small event queue on a protocol clock               */
  /* ---------------------------------------------------------------- */

  function at(delay, fn) {
    run.queue.push({ at: run.now + delay, seq: run.seq++, fn });
  }

  const hop = (f = 1) => T.hop * f * (0.92 + run.r() * 0.16);

  function send(kind, h, s0, s1, dur, extra = {}) {
    const p = { kind, h, s0, s1, t0: run.now, dur, ...extra };
    run.packets.push(p);
    run.stats.packets++;
    return p;
  }

  function burst(h, s, color) {
    if (!reduced) run.bursts.push({ h, s, color, t0: clockNow() });
  }

  function addRow(row) {
    row.born = clockNow();
    run.ledger.push(row);
    return row;
  }

  // One outstanding step finished; when none remain, the run moves to its next stage.
  function settle() {
    run.open--;
    if (run.open > 0) return;
    if (run.phase === 'gather' && run.mode === 'protocol' && run.q.raw) requestRaw();
    else if (run.phase === 'gather' || run.phase === 'raw') compose();
  }

  function pump(dt) {
    if (run.phase === 'done' && !run.queue.length) return;
    if (!run.pending) run.t += dt * SPEED[params.speed];
    let changed = false;
    for (let guard = 0; guard < 400 && !run.pending; guard++) {
      let next = null;
      for (const e of run.queue) if (e.at <= run.t && (!next || e.at < next.at || (e.at === next.at && e.seq < next.seq))) next = e;
      if (!next) break;
      run.queue.splice(run.queue.indexOf(next), 1);
      run.now = next.at;
      next.fn();
      changed = true;
    }
    if (run.pending) run.t = run.now; // the protocol clock waits for the holder
    run.packets = run.packets.filter((p) => run.t < p.t0 + p.dur + 0.05 || (p.park && !p.done));
    if (changed) refresh();
  }

  function curiousPicks(r, q) {
    const needed = neededOf(q);
    const involved = holdersOf(q);
    const pool = FIELDS.filter((f) => f.sensitive && !needed.has(f.key));
    const outside = shuffle(r, pool.filter((f) => !involved.has(f.h)));
    const inside = shuffle(r, pool.filter((f) => involved.has(f.h)));
    return [outside[0], inside[0], inside[1] || outside[1]].filter(Boolean).map((f) => f.key);
  }

  function ask() {
    if (run && run.phase !== 'done') return;
    tip.hide();
    const q = selected();
    const r = rng(seed * 977 + params.q * 131 + 17);
    // Threats are drawn first, so naive and protocol runs of one seed face the same ones.
    const extras = params.curious ? curiousPicks(r, q) : [];
    const target = params.tamper ? Math.floor(r() * q.claims.length) : -1;
    runs++;
    const base = world.base + runs * 47;
    const root = sha256(`chronicles|${seed}|${runs}|${q.text}`);
    run = {
      q,
      mode: params.mode,
      curious: params.curious,
      tamper: params.tamper,
      extras,
      target,
      r,
      base,
      root,
      head: root,
      needed: neededOf(q),
      t: 0,
      now: 0,
      seq: 0,
      queue: [],
      open: 0,
      packets: [],
      bursts: [],
      ledger: [],
      ids: 0,
      rawIds: 0,
      sent: new Set(),
      exposed: new Set(),
      reading: new Set(),
      blocked: new Set(),
      waiting: new Set(),
      withheld: new Set(),
      gates: HOLDERS.map(() => ({ blocked: 0, checkAt: -9, state: '' })),
      know: {},
      cites: [],
      raw: { state: null, id: null, auto: false },
      stats: { packets: 0, verified: 0, rejected: 0, tampered: 0, caught: 0, asked: extras.length, blocked: 0, released: 0, approved: 0, dumps: 0 },
      phase: 'ask',
      pending: null,
      reply: null,
      answer: null,
      flash: null,
      said: {},
    };
    if (run.mode === 'protocol') addRow({ id: 'q', kind: 'root', h: -1, src: 'question', ts: clock(base), text: q.text, digest: root, status: 'ok' });
    narrate(`You ask the agent: “${q.text}”`, C.cream, `“${q.text}”`);
    send('ask', -1, 1, 0, T.ask);
    at(T.ask, () => (run.mode === 'naive' ? planNaive() : planProtocol()));
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* The protocol                                                     */
  /* ---------------------------------------------------------------- */

  const digestOf = (h, ar, ts, text) => sha256(`${run.root}|${HOLDERS[h].id}|${ar.id}|${ts}|${text}`);

  function planProtocol() {
    const q = run.q;
    run.phase = 'gather';
    const asks = new Map();
    const entry = (h) => {
      if (!asks.has(h)) asks.set(h, { claims: [], extra: [] });
      return asks.get(h);
    };
    q.claims.forEach((c, i) => entry(c.h).claims.push(i));
    run.extras.forEach((k) => entry(FIELD[k].h).extra.push(k));
    const nf = q.claims.reduce((n, c) => n + c.keys.length, 0);
    const nh = new Set(q.claims.map((c) => c.h)).size;
    if (run.extras.length) {
      narrate(`The curious agent also asks for ${list(run.extras.map((k) => FIELD[k].name))}, which this question does not need.`, C.ember, `It also asks for ${run.extras.length} out-of-scope fields.`);
    } else {
      narrate(`The agent scopes its request: ${plural(nf, 'field')} from ${plural(nh, 'holder')}${q.raw ? ', and the raw certificate later' : ''}.`, C.amber, `Scoped request: ${plural(nf, 'field')}, ${plural(nh, 'holder')}.`);
    }
    [...asks.keys()]
      .sort((a, b) => a - b)
      .forEach((h, i) => {
        run.open++;
        at(T.plan + i * T.stagger, () => query(h, asks.get(h)));
      });
  }

  // A scoped request travels to the holder's policy gate; out-of-scope fields stop there.
  function query(h, req, retry = false) {
    const d = hop(GATE);
    send('query', h, 0, GATE, d);
    at(d, () => {
      const g = run.gates[h];
      g.checkAt = clockNow();
      if (req.extra.length) {
        req.extra.forEach((k) => run.blocked.add(k));
        g.blocked += req.extra.length;
        run.stats.blocked += req.extra.length;
        burst(h, GATE, C.ember);
        narrate(`The ${HOLDERS[h].name.toLowerCase()} policy blocks the ${list(req.extra.map((k) => FIELD[k].name))}.`, C.ember, `${HOLDERS[h].short} policy blocks ${plural(req.extra.length, 'field')}.`);
      }
      if (!req.claims.length) {
        settle();
        return;
      }
      at(T.check, () => {
        const d2 = hop(1 - GATE);
        send('query', h, GATE, 1, d2);
        at(d2, () => atHolder(h, req.claims, retry));
      });
    });
  }

  function atHolder(h, claimIdx, retry) {
    const keys = claimIdx.flatMap((i) => run.q.claims[i].keys);
    keys.forEach((k) => run.reading.add(k));
    at(T.read, () => {
      keys.forEach((k) => run.reading.delete(k));
      claimIdx.forEach((ci, j) => {
        run.open++;
        at(j * T.stagger, () => emitClaim(h, ci, retry));
      });
      settle();
    });
  }

  function emitClaim(h, ci, retry) {
    const c = run.q.claims[ci];
    const ts = clock(run.base + run.now);
    const text = c.say(world.v);
    const msg = { h, ci, ts, received: text, digest: digestOf(h, c.ar, ts, text), retry };
    c.keys.forEach((k) => run.sent.add(k));
    const d = hop();
    const p = send('claim', h, 1, 0, d);
    if (!run.said.claims) {
      run.said.claims = true;
      narrate('Holders answer with claims, not records, each stamped with its source, time and hash.', C.gold, 'Claims, not records, each with provenance.');
    }
    if (!retry && ci === run.target) {
      at(d * TAMPER_AT, () => {
        p.tampered = true;
        msg.received = c.say({ ...world.v, [c.alters]: world.fake[c.alters] });
        run.stats.tampered++;
        burst(h, lerp(1, 0, easeInOut(TAMPER_AT)), C.ember);
        narrate(`Something alters the ${HOLDERS[h].name.toLowerCase()} claim in transit…`, C.ember, 'A claim is altered in transit…');
      });
    }
    at(d, () => arriveClaim(msg));
  }

  // The agent recomputes the hash from what arrived and compares it with the holder's.
  function arriveClaim(msg) {
    const c = run.q.claims[msg.ci];
    c.keys.forEach((k) => run.exposed.add(k));
    const row = { id: `c${++run.ids}`, kind: 'claim', h: msg.h, src: c.ar.name, ts: msg.ts, text: msg.received, digest: msg.digest, status: 'checking', retry: msg.retry };
    addRow(row);
    at(T.verify, () => {
      const got = digestOf(msg.h, c.ar, msg.ts, msg.received);
      if (got === msg.digest) {
        row.status = 'ok';
        run.head = sha256(run.head + got);
        run.stats.verified++;
        run.cites[msg.ci] = row.id;
        c.keys.forEach((k) => (run.know[k] = { v: world.v[k], altered: false }));
        run.flash = { color: C.gold, t0: clockNow() };
        narrate(`Hash matches: ${row.id} is verified and chained to the question.`, C.gold, `${row.id}: hash matches, verified.`);
        settle();
        return;
      }
      row.status = 'bad';
      row.got = got;
      run.stats.rejected++;
      run.stats.caught++;
      run.flash = { color: C.ember, t0: clockNow() };
      narrate(`Hash mismatch: ${row.id} was altered in transit, so the agent rejects it and asks again.`, C.ember, `${row.id}: hash mismatch, rejected.`);
      at(T.retry, () => {
        run.open++;
        query(msg.h, { claims: [msg.ci], extra: [] }, true);
        settle();
      });
    });
  }

  function requestRaw() {
    const { h, ar } = run.q.raw;
    run.phase = 'raw';
    run.open++;
    narrate(`Sending the record needs the ${ar.doc} itself: a raw artifact, not a claim.`, C.amber, `It needs the raw ${ar.doc}.`);
    const d = hop(GATE);
    run.rawReq = send('rawreq', h, 0, GATE, d, { park: true });
    at(d, () => {
      ar.keys.forEach((k) => run.waiting.add(k));
      run.gates[h].checkAt = clockNow();
      if (params.auto) {
        decide(true, true);
        return;
      }
      run.pending = { h, ar };
      narrate(`Only you, the holder, can release the raw ${ar.doc}. Approve or deny.`, C.amber, 'Only you can release it: approve or deny.');
      say.say(`Approval needed: the agent asks the ${HOLDERS[h].name} holder for the raw ${ar.doc}, ${plural(ar.keys.length, 'field')}. Use Approve release or Deny.`);
      refresh();
      const a = document.activeElement;
      if (!a || a === document.body || a === buttons.ask) consent.approve.focus({ preventScroll: true });
    });
  }

  function decide(ok, auto = false) {
    if (!run || run.phase !== 'raw' || run.raw.state || (!run.pending && !auto)) return;
    const { h, ar } = run.q.raw;
    run.pending = null;
    run.rawReq.done = true;
    ar.keys.forEach((k) => run.waiting.delete(k));
    const g = run.gates[h];
    g.checkAt = clockNow();
    if (ok) {
      g.state = 'open';
      run.stats.approved++;
      run.stats.released++;
      run.raw.state = 'released';
      run.raw.auto = auto;
      narrate(
        auto ? `Auto-approved by your standing rule: the ${ar.doc} leaves with its own provenance.` : `You approved: the ${ar.doc} leaves with its own provenance.`,
        C.gold,
        auto ? 'Auto-approved: the raw artifact is released.' : 'Approved: the raw artifact is released.',
      );
      const ts = clock(run.base + run.now);
      const body = ar.keys.map((k) => `${FIELD[k].name}=${world.v[k]}`).join('; ');
      const digest = digestOf(h, ar, ts, body);
      ar.keys.forEach((k) => run.sent.add(k));
      const d = hop();
      send('raw', h, 1, 0, d);
      at(d, () => {
        ar.keys.forEach((k) => run.exposed.add(k));
        const row = { id: `r${++run.rawIds}`, kind: 'raw', h, src: ar.name, ts, text: `raw ${ar.doc} · ${auto ? 'auto-approved' : 'approved by you'}`, digest, status: 'checking' };
        addRow(row);
        at(T.verify, () => {
          const got = digestOf(h, ar, ts, body);
          row.status = got === digest ? 'ok' : 'bad';
          run.head = sha256(run.head + got);
          run.raw.id = row.id;
          run.flash = { color: C.gold, t0: clockNow() };
          narrate(`Hash matches: ${row.id}, the ${ar.doc}, is verified and chained.`, C.gold, `${row.id}: hash matches, verified.`);
          settle();
        });
      });
    } else {
      g.state = 'denied';
      ar.keys.forEach((k) => run.withheld.add(k));
      run.raw.state = 'denied';
      addRow({ id: `r${++run.rawIds}`, kind: 'raw', h, src: ar.name, ts: clock(run.base + run.now), text: `raw ${ar.doc} · withheld by you`, status: 'withheld' });
      narrate(`You denied it: the ${ar.doc} never leaves the ${HOLDERS[h].name.toLowerCase()}.`, C.cream, 'Denied: the raw artifact stays put.');
      at(T.read, settle);
    }
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Naive sharing                                                    */
  /* ---------------------------------------------------------------- */

  function planNaive() {
    run.phase = 'gather';
    const hs = [...new Set([...holdersOf(run.q), ...run.extras.map((k) => FIELD[k].h)])].sort((a, b) => a - b);
    narrate(
      `Naive sharing: the agent asks ${plural(hs.length, 'holder')} for everything they hold${run.extras.length ? ', and nothing stops it' : ''}.`,
      C.ember,
      `Naive: it asks ${plural(hs.length, 'holder')} for everything.`,
    );
    hs.forEach((h, i) => {
      run.open++;
      at(T.plan + i * T.stagger, () => {
        const d = hop();
        send('query', h, 0, 1, d);
        at(d, () => dumpAll(h));
      });
    });
  }

  function dumpAll(h) {
    const arts = HOLDERS[h].artifacts;
    const target = run.target >= 0 ? run.q.claims[run.target] : null;
    arts.forEach((ar) => ar.keys.forEach((k) => run.reading.add(k)));
    at(T.read * 0.6, () => {
      arts.forEach((ar, j) => {
        run.open++;
        at(j * T.dump, () => {
          ar.keys.forEach((k) => {
            run.reading.delete(k);
            run.sent.add(k);
          });
          run.stats.released++;
          const d = hop();
          const p = send('raw', h, 1, 0, d);
          const item = { h, ar, altered: null };
          if (target && target.ar === ar) {
            at(d * TAMPER_AT, () => {
              p.tampered = true;
              item.altered = target.alters;
              run.stats.tampered++;
              burst(h, lerp(1, 0, easeInOut(TAMPER_AT)), C.ember);
              narrate(`Something alters the ${ar.name} in transit. Nothing on this path can notice.`, C.ember, 'A record is altered in transit, unseen.');
            });
          }
          at(d, () => arriveDump(item));
        });
      });
      settle();
    });
  }

  function arriveDump(item) {
    const { h, ar } = item;
    for (const k of ar.keys) {
      run.exposed.add(k);
      run.know[k] = { v: item.altered === k ? world.fake[k] : world.v[k], altered: item.altered === k };
    }
    run.stats.dumps++;
    addRow({ id: '', kind: 'dump', h, src: ar.name, text: `${ar.name} · ${plural(ar.keys.length, 'field')}`, status: 'unverified', altered: !!item.altered });
    const leaked = FIELDS.filter((f) => f.sensitive && run.exposed.has(f.key) && !run.needed.has(f.key)).map((f) => f.name);
    if (!run.said.dump && leaked.length >= 2 && !item.altered) {
      run.said.dump = true;
      narrate(`Whole records pour in, including your ${list(leaked.slice(0, 2))}.`, C.ember, 'Whole records pour in, sensitive ones too.');
    }
    settle();
  }

  /* ---------------------------------------------------------------- */
  /* The answer                                                       */
  /* ---------------------------------------------------------------- */

  function compose() {
    run.phase = 'answer';
    if (run.mode === 'naive' && run.q.raw) run.raw.state = 'naive';
    const get = (k) => run.know[k] || { v: world.v[k], altered: false };
    run.reply = run.q.answer({ get, c: (i) => run.cites[i] || null, raw: run.raw }).filter(Boolean);
    narrate(
      run.mode === 'naive' ? 'The agent answers from whatever it was handed.' : 'The agent answers, citing the provenance id of every claim it used.',
      C.cream,
      run.mode === 'naive' ? 'The agent answers from what it was handed.' : 'The agent answers, citing provenance ids.',
    );
    send('answer', -1, 0, 1, T.ask);
    at(T.ask, finish);
  }

  function finish() {
    run.phase = 'done';
    run.answer = run.reply;
    run.answeredAt = clockNow();
    const s = run.stats;
    const exposed = run.exposed.size;
    const needed = run.needed.size;
    if (run.mode === 'naive') {
      if (run.answer.some((t) => t.altered)) narrate('The answer repeats an altered record: with no provenance, nothing could tell.', C.ember, 'The answer rests on an altered record.');
      else narrate(`Answered, but ${exposed} fields were exposed for ${needed} needed, none traceable to a source.`, C.ember, `${exposed} fields exposed for ${needed} needed.`);
    } else {
      const sources = s.verified + (run.raw.state === 'released' ? 1 : 0);
      if (s.caught) narrate(`Answered from ${plural(sources, 'verified source')}; the altered claim never reached the answer.`, C.gold, 'Answered; the altered claim was caught.');
      else if (s.blocked) narrate(`Answered from ${plural(sources, 'verified source')}; the ${plural(s.blocked, 'out-of-scope field')} never left home.`, C.gold, `Answered; ${s.blocked} out-of-scope fields blocked.`);
      else if (run.raw.state === 'denied') narrate(`Answered without the certificate, from the ${exposed} fields you allowed.`, C.gold, 'Answered without the raw artifact.');
      else narrate(`Answered from ${plural(sources, 'verified source')}, exposing only the ${exposed} fields it needed.`, C.gold, `Answered: ${exposed} of ${needed} fields, all verified.`);
    }
    const mode = run.mode === 'naive' ? 'naive sharing' : 'the Chronicles protocol';
    say.say(
      `Run ${runs} complete under ${mode}. ${exposed} fields exposed for ${needed} needed; ${s.verified} claims verified; ` +
        `tampering caught ${s.caught} of ${s.tampered}; ${s.blocked} of ${s.asked} out-of-scope requests blocked; ` +
        `${s.released} raw artifacts released, ${s.approved} with approval.`,
    );
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'An agent needs personal context that four <strong>holders</strong> keep. Under the protocol it sends a scoped request, and each holder’s policy releases only the fields the question needs, as <em>claims</em> rather than records.',
  );
  para(
    about,
    'Every claim carries <strong>provenance</strong>: holder, source, time and a hash the agent re-checks before chaining it into its ledger. A raw artifact leaves its holder only if you approve. <strong>Naive sharing</strong> hands over whole records instead.',
  );
  legend(about, [
    { color: C.cream, label: 'request', shape: 'ring' },
    { color: C.gold, label: 'claim / verified' },
    { color: C.ember, label: 'raw record / blocked / tampered' },
    { color: C.amber, label: 'awaiting approval' },
    { color: C.gold, label: 'field the question needs', shape: 'ring' },
  ]);

  const controls = section(panel, 'Ask the agent');
  const buttons = actions(controls, [
    { id: 'ask', label: 'Ask ▸', primary: true, onClick: () => ask() },
    {
      id: 'fresh',
      label: 'New run',
      onClick: () => {
        seed = (seed * 48271 + 11) % 2147483647;
        world = makeWorld(seed);
        runs = 0;
        run = null;
        ask();
      },
    },
  ]);
  const consent = actions(controls, [
    { id: 'approve', label: 'Approve release', primary: true, onClick: () => decide(true) },
    { id: 'deny', label: 'Deny', onClick: () => decide(false) },
  ]);
  const consentRow = consent.approve.parentElement;
  consentRow.setAttribute('role', 'group');
  consentRow.setAttribute('aria-label', 'Holder approval for a raw artifact');
  choice(controls, {
    label: 'Question',
    options: QUESTIONS.map((q, i) => ({ value: i, label: q.short })),
    value: params.q,
    onChange: (v) => {
      params.q = v;
      reset();
    },
  });
  choice(controls, {
    label: 'Sharing',
    options: [
      { value: 'naive', label: 'Naive sharing' },
      { value: 'protocol', label: 'Chronicles protocol' },
    ],
    value: params.mode,
    onChange: (v) => {
      params.mode = v;
      reset();
    },
  });
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 'watch', label: 'Watch' },
      { value: 'normal', label: 'Normal' },
      { value: 'instant', label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });

  const threats = section(panel, 'Threats and consent');
  const threatNote = (name, on) => {
    if (run) narrate(`${name} ${on ? 'on' : 'off'}: it applies from the next question.`, INK[2], `${name} ${on ? 'on' : 'off'}: next question.`);
  };
  toggle(threats, {
    label: 'Curious agent (asks beyond its scope)',
    value: params.curious,
    onChange: (v) => {
      params.curious = v;
      threatNote('Curious agent', v);
    },
  });
  toggle(threats, {
    label: 'Tamper in transit',
    value: params.tamper,
    onChange: (v) => {
      params.tamper = v;
      threatNote('Tampering', v);
    },
  });
  toggle(threats, {
    label: 'Auto-approve raw requests',
    value: params.auto,
    onChange: (v) => {
      params.auto = v;
      if (v && run?.pending) decide(true, true);
    },
  });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'exposed', label: 'Fields exposed' },
    { id: 'needed', label: 'Fields needed' },
    { id: 'verified', label: 'Claims verified' },
    { id: 'tamper', label: 'Tampering caught' },
    { id: 'blocked', label: 'Out-of-scope blocked' },
    { id: 'raw', label: 'Raw artifacts released', wide: true },
  ]);
  para(results, 'Ask the same question under naive sharing, then switch on both threats: the protocol blocks and catches what naive sharing lets through.', 'sim-fine');

  paper(panel, {
    lines: [
      'Co-authored a federated disclosure protocol that <strong>limits shared context to authorized evidence</strong>, <strong>preserves provenance</strong>, and <strong>requires holder approval before releasing raw artifacts</strong>; specified the architecture and threat model.',
      'First author · Preprint 2026.',
    ],
    links: [{ label: 'arXiv 2607.22953', href: 'https://arxiv.org/abs/2607.22953' }],
  });
  fine(
    panel,
    'The holders, records, policy and messages here are a simplified stand-in for the protocol, and the hashes are real SHA-256 but unkeyed, where a deployment would bind provenance with keys. The numbers in the readout come from this simulation, not from the paper.',
  );
  const say = live(panel);

  function reset() {
    run = null;
    idle();
    refresh();
  }

  function refresh() {
    const needed = run ? run.needed.size : neededOf(selected()).size;
    out.set('needed', String(needed));
    if (!run) {
      ['exposed', 'verified', 'tamper', 'blocked', 'raw'].forEach((id) => out.set(id, '—'));
    } else {
      const s = run.stats;
      const exposed = run.exposed.size;
      const naive = run.mode === 'naive';
      const done = run.phase === 'done';
      out.set('exposed', String(exposed), exposed > needed ? 'bad' : exposed ? 'ok' : '');
      if (naive) out.set('verified', s.dumps ? '0' : '—', s.dumps ? 'bad' : '');
      else out.set('verified', s.rejected ? `${s.verified} · ${s.rejected} ✗` : String(s.verified), s.verified ? 'ok' : '');
      out.set('tamper', s.tampered ? `${s.caught} of ${s.tampered}` : '—', !s.tampered ? '' : s.caught === s.tampered ? 'ok' : naive ? 'bad' : 'warn');
      out.set('blocked', s.asked ? `${s.blocked} of ${s.asked}` : '—', !s.asked ? '' : s.blocked === s.asked ? 'ok' : naive && done ? 'bad' : 'warn');
      let raw = '—';
      let tone = '';
      if (naive && s.released) [raw, tone] = [`${s.released}, none with approval`, 'bad'];
      else if (run.raw.state === 'released') [raw, tone] = [`${s.released}, ${run.raw.auto ? 'auto-approved' : 'with your approval'}`, 'ok'];
      else if (run.raw.state === 'denied') [raw, tone] = ['0, you denied it', ''];
      else if (run.pending) [raw, tone] = ['0, awaiting you', 'warn'];
      else if (!naive && done) raw = '0';
      out.set('raw', raw, tone);
    }
    const busy = run && run.phase !== 'done';
    buttons.ask.disabled = !!busy;
    buttons.ask.textContent = !run ? 'Ask ▸' : run.pending ? 'Waiting for you…' : busy ? 'Asking…' : 'Ask again ▸';
    consentRow.style.display = run?.pending ? '' : 'none';
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  // The overlays come first: layout() runs as soon as the canvas exists.
  const stat = status(stage);
  const tip = hint(stage, 'Click the question to ask the agent');
  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const hitTest = (x, y) => {
    for (const [id, r] of Object.entries(L.hit)) if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return id;
    return null;
  };
  const ptr = pointer(view.canvas, {
    down: (p) => {
      const t = hitTest(p.x, p.y);
      if (t === 'approve') decide(true);
      else if (t === 'deny') decide(false);
      else if (t === 'ask') ask();
    },
    move: (p) => {
      hover = hitTest(p.x, p.y);
      view.canvas.style.cursor = hover ? 'pointer' : '';
    },
    leave: () => {
      hover = null;
      view.canvas.style.cursor = '';
    },
  });

  function layout(v) {
    const w = v.w;
    const h = v.h;
    L.w = w;
    L.h = h;
    L.compact = w < 620 || h < 480;
    const pad = Math.max(16, Math.min(40, w * 0.04));
    L.pad = pad;
    // On phones the title row starts below the hint pill.
    L.topY = L.compact ? 50 : 52;
    L.narrY = L.topY + (L.compact ? 22 : 34);
    const bottom = h - (L.compact ? 34 : 44);
    tip.set(L.compact ? 'Tap the question to ask the agent' : 'Click the question to ask the agent');
    let net;
    if (L.compact) {
      net = { x: pad, y: L.narrY + 11, w: w - pad * 2 };
      const ph = clamp(h * 0.29, 122, 150);
      L.panel = { x: pad, y: bottom - ph, w: net.w, h: ph };
      L.meter = { x: pad, y: L.panel.y - 36, w: net.w };
    } else {
      const colW = clamp(w * 0.34, 260, 360);
      const colX = w - pad - colW;
      net = { x: pad, y: L.narrY + 24, w: colX - pad - 34 };
      L.col = { x: colX, y: net.y, w: colW, h: bottom - net.y };
      const slotH = clamp(L.col.h * 0.3, 128, 168);
      L.slot = { x: colX, y: bottom - slotH, w: colW, h: slotH };
      L.meter = { x: net.x, y: bottom - 48, w: net.w };
    }
    L.net = net;
    L.bubble = { cx: net.x + net.w / 2, y: net.y, h: L.compact ? 26 : 30, maxW: net.w };
    L.names = !L.compact && net.w >= 440;
    L.rowH = L.compact ? 7 : 13;
    L.labelGap = L.compact ? 11 : 15; // node edge to the holder's name
    L.firstRow = L.compact ? 8 : 13; // name to its first artifact row
    const nodeR = L.compact ? 10 : 15;
    // The two lower holders carry the deepest tables below the arc.
    const rowsLow = Math.max(HOLDERS[1].artifacts.length, HOLDERS[2].artifacts.length);
    const tableH = nodeR + L.labelGap + L.firstRow + (rowsLow - 1) * L.rowH + 5;
    const top = L.bubble.y + L.bubble.h;
    const lead = L.compact ? 28 : 72; // bubble to agent
    const room = L.meter.y - (L.compact ? 8 : 26) - top - lead - tableH;
    const rx = net.w * (L.compact ? 0.4 : 0.41);
    const ry = clamp(room / Math.sin(ARC[1]), 40, rx * (L.compact ? 0.62 : 0.95));
    const slack = Math.max(0, room - ry * Math.sin(ARC[1]));
    L.agent = { x: L.bubble.cx, y: top + lead + slack * 0.5, r: L.compact ? 13 : 20 };
    L.holders = ARC.map((t) => ({ x: L.agent.x + Math.cos(t) * rx, y: L.agent.y + Math.sin(t) * ry, r: nodeR }));
    L.edges = L.holders.map((n) => {
      const a = L.agent;
      const ang = Math.atan2(n.y - a.y, n.x - a.x);
      const x1 = a.x + Math.cos(ang) * (a.r + 5);
      const y1 = a.y + Math.sin(ang) * (a.r + 5);
      const x2 = n.x - Math.cos(ang) * (n.r + 5);
      const y2 = n.y - Math.sin(ang) * (n.r + 5);
      const side = n.x < a.x ? -1 : 1;
      // Bow each edge gently outward, away from the centre line.
      return [x1, y1, (x1 + x2) / 2 + side * (y2 - y1) * 0.14, (y1 + y2) / 2 - side * (x2 - x1) * 0.14, x2, y2];
    });
  }

  // A point along a path: s = 0 at the agent, 1 at the holder (or at you, for h = -1).
  function pathAt(h, s) {
    if (h < 0) {
      const a = L.agent;
      return [a.x, lerp(a.y - a.r - 4, L.bubble.y + L.bubble.h + 3, s)];
    }
    return quadAt(...L.edges[h], s);
  }

  const tracked = (str, o) => textWidth(ctx, o.upper ? String(str).toUpperCase() : str, o) + (o.track || 0) * String(str).length;

  function ellipsize(str, maxW, o) {
    if (textWidth(ctx, str, o) <= maxW) return str;
    let s = str;
    while (s.length > 1 && textWidth(ctx, `${s}…`, o) > maxW) s = s.slice(0, -1);
    return `${s.trimEnd()}…`;
  }

  function wrap(text, maxW, o) {
    const rows = [];
    let cur = '';
    for (const w of text.split(' ')) {
      const next = cur ? `${cur} ${w}` : w;
      if (cur && textWidth(ctx, next, o) > maxW) {
        rows.push(cur);
        cur = w;
      } else cur = next;
    }
    if (cur) rows.push(cur);
    return rows;
  }

  function diamond(x, y, s, fill, stroke) {
    ctx.beginPath();
    ctx.moveTo(x, y - s);
    ctx.lineTo(x + s, y);
    ctx.lineTo(x, y + s);
    ctx.lineTo(x - s, y);
    ctx.closePath();
    ctx.fillStyle = fill;
    ctx.fill();
    ctx.strokeStyle = stroke;
    ctx.lineWidth = 1.2;
    ctx.stroke();
  }

  // ✓, ✗ and – drawn as strokes, so they look the same in every font.
  function mark(kind, x, y, color, s = 3.4) {
    ctx.beginPath();
    if (kind === 'ok') {
      ctx.moveTo(x - s, y);
      ctx.lineTo(x - s * 0.25, y + s * 0.8);
      ctx.lineTo(x + s, y - s * 0.85);
    } else if (kind === 'bad') {
      ctx.moveTo(x - s * 0.8, y - s * 0.8);
      ctx.lineTo(x + s * 0.8, y + s * 0.8);
      ctx.moveTo(x + s * 0.8, y - s * 0.8);
      ctx.lineTo(x - s * 0.8, y + s * 0.8);
    } else {
      ctx.moveTo(x - s * 0.7, y);
      ctx.lineTo(x + s * 0.7, y);
    }
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.stroke();
    ctx.lineCap = 'butt';
    ctx.lineJoin = 'miter';
  }

  // Two links pulled apart: the sign of a broken provenance chain.
  function brokenLink(x, y, color) {
    ctx.save();
    ctx.translate(x, y);
    ctx.rotate(-Math.PI / 4);
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.3;
    roundRect(ctx, -8.5, -2.4, 6.5, 4.8, 2.4);
    ctx.stroke();
    roundRect(ctx, 2, -2.4, 6.5, 4.8, 2.4);
    ctx.stroke();
    ctx.restore();
  }

  function icon(id, x, y, s, color) {
    ctx.strokeStyle = color;
    ctx.lineWidth = 1.2;
    if (id === 'calendar') {
      roundRect(ctx, x - s, y - s * 0.75, s * 2, s * 1.65, 1.5);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s, y - s * 0.2);
      ctx.lineTo(x + s, y - s * 0.2);
      ctx.moveTo(x - s * 0.45, y - s * 1.05);
      ctx.lineTo(x - s * 0.45, y - s * 0.5);
      ctx.moveTo(x + s * 0.45, y - s * 1.05);
      ctx.lineTo(x + s * 0.45, y - s * 0.5);
      ctx.stroke();
      return;
    }
    if (id === 'messages') {
      roundRect(ctx, x - s, y - s * 0.8, s * 2, s * 1.3, s * 0.35);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x - s * 0.35, y + s * 0.5);
      ctx.lineTo(x - s * 0.65, y + s);
      ctx.lineTo(x + s * 0.1, y + s * 0.5);
      ctx.stroke();
      return;
    }
    ctx.beginPath();
    if (id === 'health') {
      ctx.moveTo(x - s, y);
      ctx.lineTo(x + s, y);
      ctx.moveTo(x, y - s);
      ctx.lineTo(x, y + s);
    } else {
      ctx.moveTo(x - s, y - s * 0.35);
      ctx.lineTo(x, y - s);
      ctx.lineTo(x + s, y - s * 0.35);
      ctx.moveTo(x - s, y + s * 0.85);
      ctx.lineTo(x + s, y + s * 0.85);
      for (const dx of [-0.6, 0, 0.6]) {
        ctx.moveTo(x + dx * s, y - s * 0.15);
        ctx.lineTo(x + dx * s, y + s * 0.6);
      }
    }
    ctx.stroke();
  }

  function canvasButton(id, x, y, w, h, text, primary) {
    const hot = hover === id;
    roundRect(ctx, x, y, w, h, h / 2);
    if (primary) {
      ctx.fillStyle = hot ? C.cream : C.gold;
      ctx.fill();
    } else {
      ctx.fillStyle = hot ? alpha(C.ember, 0.18) : alpha(C.midnight, 0.6);
      ctx.fill();
      ctx.strokeStyle = alpha(C.ember, 0.85);
      ctx.lineWidth = 1.2;
      ctx.stroke();
    }
    label(ctx, text, x + w / 2, y + h / 2 + 0.5, { size: 11, align: 'center', baseline: 'middle', upper: true, track: 1.2, color: primary ? C.midnight : C.ember });
    L.hit[id] = { x, y, w, h };
  }

  /* ---------------------------------------------------------------- */
  /* Drawing                                                          */
  /* ---------------------------------------------------------------- */

  function drawHeader() {
    const mode = run ? run.mode : params.mode;
    const curious = run ? run.curious : params.curious;
    const tamper = run ? run.tamper : params.tamper;
    const left = `${run ? `Run ${String(runs).padStart(2, '0')}` : 'Ready'} · ${mode === 'naive' ? 'Naive sharing' : L.compact ? 'Protocol' : 'Chronicles protocol'}`;
    const o = { size: L.compact ? 10 : 11, upper: true, track: L.compact ? 1.2 : 1.6, color: C.gold };
    label(ctx, left, L.pad, L.topY + 4, o);
    const tags = [curious && (L.compact ? 'curious' : 'curious agent'), tamper && (L.compact ? 'tamper' : 'tamper in transit')].filter(Boolean);
    const right = tags.length ? tags.join(' · ') : L.compact ? '' : 'no threats';
    if (right) {
      const ro = { size: L.compact ? 9.5 : 10, align: 'right', upper: true, track: 1.2, color: tags.length ? C.ember : INK[3] };
      const room = L.w - 2 * L.pad - tracked(left, o) - 18;
      if (tracked(right, ro) <= room) label(ctx, right, L.w - L.pad, L.topY + 4, ro);
    }
    const maxW = L.w - 2 * L.pad;
    const no = { size: L.compact ? 16 : 19, minSize: L.compact ? 11 : 12, font: 'serif', italic: true, color: narration.tone };
    let text = L.compact ? narration.short : narration.text;
    if (textWidth(ctx, text, { ...no, size: no.minSize }) > maxW) text = narration.short;
    labelFit(ctx, text, L.pad, L.narrY, maxW, no);
  }

  function drawNetwork(time) {
    const mode = run ? run.mode : params.mode;
    const scope = holdersOf(run ? run.q : selected());
    if (run) run.extras.forEach((k) => scope.add(FIELD[k].h));
    // You and the agent.
    const [ux, uy0] = pathAt(-1, 0);
    const [, uy1] = pathAt(-1, 1);
    line(ctx, ux, uy0, ux, uy1, alpha(C.cream, 0.3), 1.1);
    for (let h = 0; h < HOLDERS.length; h++) {
      const [x1, y1, cx, cy, x2, y2] = L.edges[h];
      ctx.beginPath();
      ctx.moveTo(x1, y1);
      ctx.quadraticCurveTo(cx, cy, x2, y2);
      ctx.strokeStyle = alpha(C.cream, scope.has(h) ? 0.3 : 0.1);
      ctx.lineWidth = 1.1;
      ctx.stroke();
    }
    if (mode === 'protocol') {
      for (let h = 0; h < HOLDERS.length; h++) drawGate(h, time);
      if (!L.compact) {
        const [gx, gy] = pathAt(0, GATE);
        label(ctx, 'policy gate', gx + 10, gy + 18, { size: 9, upper: true, track: 1, color: INK[4] });
      }
    }
    for (let h = 0; h < HOLDERS.length; h++) drawHolder(h, time, scope.has(h));
    drawAgent(time);
  }

  function drawGate(h, time) {
    const [x, y] = pathAt(h, GATE);
    const g = run?.gates[h];
    const s = L.compact ? 3.6 : 4.6;
    const k = g ? clamp(1 - (time - g.checkAt) / 0.9) : 0;
    const blocked = g && (g.blocked || g.state === 'denied');
    if (k > 0 && !reduced) glow(ctx, x, y, 18, blocked ? C.ember : C.gold, 0.55 * k);
    const open = g?.state === 'open';
    diamond(x, y, s, open ? alpha(C.gold, 0.4) : alpha(C.midnight, 0.95), blocked ? C.ember : alpha(C.gold, open ? 1 : 0.6));
    if (g?.blocked) {
      const toRight = L.holders[h].x > L.agent.x;
      label(ctx, `×${g.blocked}`, x + (toRight ? s + 5 : -s - 5), y - s - 3, { size: L.compact ? 9 : 10, align: toRight ? 'left' : 'right', color: C.ember });
    }
  }

  function fieldState(k) {
    if (!run) return 'idle';
    if (run.reading.has(k)) return 'reading';
    if (run.sent.has(k)) return run.needed.has(k) ? 'ok' : 'excess';
    if (run.blocked.has(k)) return 'blocked';
    if (run.waiting.has(k)) return 'waiting';
    if (run.withheld.has(k)) return 'withheld';
    return 'idle';
  }

  function fieldDot(k, x, y, time, needed) {
    const st = fieldState(k);
    const r = L.compact ? 2.2 : 2.6;
    if (needed.has(k) && st !== 'waiting') dot(ctx, x, y, r + 2.1, null, alpha(C.gold, st === 'idle' ? 0.6 : 0.85), 1);
    if (st === 'reading') {
      glow(ctx, x, y, 10, C.amber, 0.55);
      dot(ctx, x, y, r, C.amber);
    } else if (st === 'ok') dot(ctx, x, y, r, C.gold);
    else if (st === 'excess') dot(ctx, x, y, r, C.ember);
    else if (st === 'blocked') {
      dot(ctx, x, y, r + 0.9, null, C.ember, 1.2);
      line(ctx, x - r - 0.6, y + r + 0.6, x + r + 0.6, y - r - 0.6, C.ember, 1.1);
    } else if (st === 'waiting') {
      const k2 = reduced ? 1 : 0.6 + 0.4 * Math.sin(time * 4);
      dot(ctx, x, y, r + 2.1, null, alpha(C.amber, 0.55 + 0.45 * k2), 1.2);
      dot(ctx, x, y, r * 0.8, alpha(C.amber, 0.6));
    } else if (st === 'withheld') dot(ctx, x, y, r, alpha(C.cream, 0.55));
    else dot(ctx, x, y, r * 0.85, alpha(C.cream, 0.24));
  }

  function drawHolder(h, time, inScope) {
    const n = L.holders[h];
    const hd = HOLDERS[h];
    const awaiting = run?.pending?.h === h;
    if (awaiting) glow(ctx, n.x, n.y, n.r * 2.8, C.amber, reduced ? 0.4 : 0.3 + 0.15 * Math.sin(time * 4));
    dot(ctx, n.x, n.y, n.r, alpha(C.midnight, 0.95), awaiting ? C.amber : alpha(C.cream, inScope ? 0.75 : 0.35), 1.3);
    icon(hd.id, n.x, n.y, n.r * 0.46, awaiting ? C.amber : inScope ? C.cream : INK[3]);
    const ly = n.y + n.r + L.labelGap;
    label(ctx, L.compact ? hd.short : hd.name, n.x, ly, { size: L.compact ? 8.5 : 10, align: 'center', upper: true, track: L.compact ? 0.6 : 1.2, color: inScope ? INK[2] : INK[3] });
    // Its artifacts, one row each, one dot per field.
    const needed = run ? run.needed : neededOf(selected());
    const dx = L.compact ? 7 : 9;
    const tw = L.names ? 112 : 0;
    hd.artifacts.forEach((ar, j) => {
      const y = ly + L.firstRow + j * L.rowH;
      if (L.names) label(ctx, ar.name, n.x - tw / 2, y, { size: 9.5, baseline: 'middle', color: INK[3] });
      ar.keys.forEach((k, i) => {
        const x = L.names ? n.x + tw / 2 - (ar.keys.length - 1 - i) * dx : n.x + (i - (ar.keys.length - 1) / 2) * dx;
        fieldDot(k, x, y, time, needed);
      });
    });
  }

  function drawAgent(time) {
    const a = L.agent;
    const f = run?.flash;
    if (f) {
      const k = clamp(1 - (time - f.t0) / 0.9);
      if (k > 0) glow(ctx, a.x, a.y, a.r * 3, f.color, 0.55 * k);
    }
    if (run?.ledger.some((r) => r.status === 'checking')) glow(ctx, a.x, a.y, a.r * 2.4, C.amber, 0.4);
    dot(ctx, a.x, a.y, a.r, alpha(C.midnight, 0.95), alpha(C.cream, 0.85), 1.4);
    dot(ctx, a.x, a.y, a.r * 0.55, null, alpha(C.gold, 0.75), 1.2);
    dot(ctx, a.x, a.y, 2.4, C.cream);
    // Labels sit beside the line from you, clear of the holder edges.
    const lx = a.x + 10;
    if (L.compact) {
      label(ctx, 'Agent', lx, a.y - a.r - 7, { size: 9, baseline: 'middle', upper: true, track: 1.2, color: INK[2] });
      return;
    }
    const n = run ? run.exposed.size : 0;
    label(ctx, 'Agent', lx, a.y - a.r - 26, { size: 10.5, baseline: 'middle', upper: true, track: 1.4, color: INK[2] });
    label(ctx, `${plural(n, 'field')} in context`, lx, a.y - a.r - 11, { size: 9.5, baseline: 'middle', color: run && n > run.needed.size ? C.ember : INK[3] });
  }

  function drawBubble() {
    const b = L.bubble;
    const q = run ? run.q : selected();
    const busy = run && run.phase !== 'done';
    const chip = busy ? (run.pending ? 'waiting' : 'asking') : run ? 'ask again ▸' : 'ask ▸';
    const size = L.compact ? 11 : 12.5;
    const tagO = { size: 9.5, upper: true, track: 1.4 };
    const chipO = { size: 9.5, upper: true, track: 1.2 };
    const tagW = L.compact ? 0 : tracked('you', tagO) + 12;
    const chipW = tracked(chip, chipO) + 18;
    const textW = textWidth(ctx, `“${q.text}”`, { size });
    const bw = Math.min(b.maxW, 16 + tagW + textW + 14 + chipW + 6);
    const x = b.cx - bw / 2;
    const clickable = !busy;
    const hot = clickable && hover === 'ask';
    roundRect(ctx, x, b.y, bw, b.h, b.h / 2);
    ctx.fillStyle = alpha(C.midnight, 0.85);
    ctx.fill();
    ctx.strokeStyle = alpha(C.cream, hot ? 0.7 : 0.32);
    ctx.lineWidth = 1.1;
    ctx.stroke();
    const cy = b.y + b.h / 2 + 0.5;
    if (tagW) label(ctx, 'you', x + 16, cy, { ...tagO, baseline: 'middle', color: INK[3] });
    labelFit(ctx, `“${q.text}”`, x + 16 + tagW, cy, bw - 16 - tagW - chipW - 18, { size, minSize: 9, baseline: 'middle', color: C.cream });
    // The chip at the right end doubles as the ask button.
    const cw = chipW;
    const cx0 = x + bw - cw - 4;
    roundRect(ctx, cx0, b.y + 4, cw, b.h - 8, (b.h - 8) / 2);
    ctx.fillStyle = clickable ? (hot ? C.cream : C.gold) : alpha(C.amber, 0.14);
    ctx.fill();
    label(ctx, chip, cx0 + cw / 2, cy, { ...chipO, align: 'center', baseline: 'middle', color: clickable ? C.midnight : C.amber });
    if (clickable) L.hit.ask = { x, y: b.y - 4, w: bw, h: b.h + 8 };
  }

  function drawPackets(time) {
    for (const p of run.packets) {
      const k0 = (run.t - p.t0) / p.dur;
      if (k0 < 0 || (k0 >= 1 && !(p.park && !p.done))) continue;
      const k = clamp(k0);
      const at2 = (kk) => pathAt(p.h, lerp(p.s0, p.s1, easeInOut(kk)));
      const [x, y] = at2(k);
      const color = p.tampered ? C.ember : p.kind === 'claim' || p.kind === 'answer' ? C.gold : p.kind === 'raw' ? C.ember : C.cream;
      if (p.kind === 'claim' || p.kind === 'raw' || p.kind === 'answer') {
        for (let i = 1; i <= 3; i++) {
          const kk = k - i * 0.035;
          if (kk <= 0) break;
          const [tx, ty] = at2(kk);
          dot(ctx, tx, ty, 2.2 - i * 0.45, alpha(color, 0.42 - i * 0.11));
        }
      }
      if (p.kind === 'query') {
        glow(ctx, x, y, 10, C.cream, 0.25);
        dot(ctx, x, y, 3.4, alpha(C.midnight, 0.9), C.cream, 1.3);
      } else if (p.kind === 'rawreq') {
        const parked = k0 >= 1;
        const pulse = parked && !reduced ? 0.5 + 0.5 * Math.sin(time * 4) : 0.5;
        glow(ctx, x, y, 14 + (parked ? 8 * pulse : 0), C.amber, 0.5);
        dot(ctx, x, y, 4.2, alpha(C.midnight, 0.9), C.amber, 1.4);
      } else if (p.kind === 'raw') {
        glow(ctx, x, y, 16, C.ember, 0.6);
        roundRect(ctx, x - 3.5, y - 4.5, 7, 9, 1.5);
        ctx.fillStyle = C.ember;
        ctx.fill();
      } else {
        glow(ctx, x, y, 14, color, 0.7);
        dot(ctx, x, y, 3.2, color);
        dot(ctx, x, y, 1.2, C.cream);
      }
      if (p.tampered) brokenLink(x + 11, y - 10, C.ember);
    }
    run.bursts = run.bursts.filter((b) => time - b.t0 < 1);
    for (const b of run.bursts) {
      const k = clamp(time - b.t0);
      const [x, y] = pathAt(b.h, b.s);
      dot(ctx, x, y, 6 + 22 * easeOut(k), null, alpha(b.color, 0.8 * (1 - k)), 1.4);
      glow(ctx, x, y, 24, b.color, 0.5 * (1 - k));
    }
  }

  function drawMeter() {
    const m = L.meter;
    const needed = run ? run.needed : neededOf(selected());
    const exposed = run ? run.exposed : new Set();
    const over = exposed.size > needed.size;
    const tone = over ? C.ember : exposed.size ? C.gold : INK[3];
    label(ctx, L.compact ? 'Exposure' : 'Fields in the agent’s context', m.x, m.y + 8, { size: 10, upper: true, track: 1.3, color: INK[3] });
    const right = over && !L.compact ? `${exposed.size} exposed · ${needed.size} needed · ${(exposed.size / needed.size).toFixed(1)}×` : `${exposed.size} exposed · ${needed.size} needed`;
    label(ctx, right, m.x + m.w, m.y + 8, { size: 10, align: 'right', color: tone });
    const gap = L.compact ? 6 : 10;
    const slot = (m.w - gap * (HOLDERS.length - 1)) / FIELDS.length;
    const bw = Math.max(2, slot - (L.compact ? 2 : 3));
    const bh = L.compact ? 8 : 10;
    const y = m.y + 18;
    let x = m.x;
    FIELDS.forEach((f, i) => {
      if (i && f.h !== FIELDS[i - 1].h) x += gap;
      // Ticks are grouped by holder, named underneath on wider stages.
      if (!L.compact && (!i || f.h !== FIELDS[i - 1].h)) label(ctx, HOLDERS[f.h].short, x, y + bh + 13, { size: 8.5, upper: true, track: 1, color: INK[4] });
      roundRect(ctx, x, y, bw, bh, 1.5);
      if (exposed.has(f.key)) {
        ctx.fillStyle = needed.has(f.key) ? C.gold : C.ember;
        ctx.fill();
      } else if (needed.has(f.key)) {
        ctx.strokeStyle = alpha(C.gold, 0.7);
        ctx.lineWidth = 1;
        ctx.stroke();
      } else {
        ctx.fillStyle = alpha(C.cream, 0.1);
        ctx.fill();
      }
      x += slot;
    });
  }

  // Answer tokens laid out in lines: [{ tk, x, w }].
  function flow(tokens, maxW, size) {
    const o = { size };
    const co = { size: size - 1.5 };
    const space = textWidth(ctx, ' ', o);
    const rows = [[]];
    let x = 0;
    for (const tk of tokens) {
      const w = tk.cite ? textWidth(ctx, tk.cite, co) + 9 + (tk.after ? textWidth(ctx, tk.after, o) : 0) : textWidth(ctx, tk.s, o);
      const row = rows[rows.length - 1];
      const gap = row.length && !tk.glue ? space : 0;
      if (row.length && !tk.glue && x + gap + w > maxW) {
        rows.push([{ tk, x: 0, w }]);
        x = w;
      } else {
        row.push({ tk, x: x + gap, w });
        x += gap + w;
      }
    }
    return rows;
  }

  function drawTokens(rows, x, y, lh, size) {
    const o = { size, baseline: 'middle' };
    rows.forEach((row, i) => {
      const yy = y + i * lh;
      for (const { tk, x: tx, w } of row) {
        if (tk.cite) {
          const cw = textWidth(ctx, tk.cite, { size: size - 1.5 }) + 7;
          roundRect(ctx, x + tx, yy - size * 0.62, cw, size * 1.24, 3);
          ctx.strokeStyle = alpha(C.gold, 0.75);
          ctx.lineWidth = 1;
          ctx.stroke();
          label(ctx, tk.cite, x + tx + cw / 2, yy + 0.5, { size: size - 1.5, align: 'center', baseline: 'middle', color: C.gold });
          if (tk.after) label(ctx, tk.after, x + tx + cw + 2, yy, { ...o, color: INK[2] });
        } else if (tk.val) {
          label(ctx, tk.s, x + tx, yy, { ...o, color: tk.altered ? C.ember : C.cream, weight: 500 });
          if (tk.altered) line(ctx, x + tx, yy + size * 0.6, x + tx + w, yy + size * 0.6, C.ember, 1);
        } else label(ctx, tk.s, x + tx, yy, { ...o, color: INK[2] });
      }
    });
  }

  function card(s, border) {
    roundRect(ctx, s.x, s.y, s.w, s.h, 14);
    ctx.fillStyle = alpha(C.midnight, 0.78);
    ctx.fill();
    ctx.strokeStyle = border;
    ctx.lineWidth = 1.1;
    ctx.stroke();
  }

  function drawAnswer(s, time) {
    const done = run?.phase === 'done';
    const naive = (run ? run.mode : params.mode) === 'naive';
    const ok = done && !naive;
    if (done) {
      const k = clamp(1 - (time - run.answeredAt) / 1.2);
      if (k > 0 && !reduced) glow(ctx, s.x + s.w / 2, s.y + s.h / 2, s.w * 0.6, naive ? C.ember : C.gold, 0.22 * k);
    }
    card(s, done ? alpha(naive ? C.ember : C.gold, 0.55) : INK.line);
    const px = L.compact ? 14 : 16;
    const hy = s.y + (L.compact ? 18 : 22);
    label(ctx, 'Agent’s answer', s.x + px, hy, { size: L.compact ? 9.5 : 10.5, upper: true, track: 1.4, color: done ? (naive ? C.ember : C.gold) : INK[3] });
    if (done) {
      const sources = run.stats.verified + (run.raw.state === 'released' ? 1 : 0);
      const tag = naive ? 'no sources' : `${plural(sources, 'source')} verified`;
      label(ctx, tag, s.x + s.w - px, hy, { size: 9.5, align: 'right', upper: true, track: 1, color: ok ? C.gold : C.ember });
    }
    const maxW = s.w - px * 2;
    const top = hy + (L.compact ? 16 : 22);
    if (!done) {
      const msg = !run
        ? 'Ask a question: the answer will cite where each fact came from.'
        : naive
          ? 'Waiting for the records to arrive…'
          : 'Waiting for verified claims…';
      wrap(msg, maxW, { size: 11.5 }).forEach((r, i) => label(ctx, r, s.x + px, top + i * 17, { size: 11.5, baseline: 'middle', color: INK[3] }));
      return;
    }
    let size = L.compact ? 11.5 : 12.5;
    let rows = flow(run.answer, maxW, size);
    const room = s.y + s.h - top - (L.compact ? 22 : 10);
    while (rows.length * size * 1.55 > room && size > 9.5) {
      size -= 0.5;
      rows = flow(run.answer, maxW, size);
    }
    drawTokens(rows, s.x + px, top, size * 1.55, size);
    if (L.compact) {
      const s2 = run.stats;
      const tail = naive
        ? `${plural(run.stats.dumps, 'raw record')} · nothing verifiable`
        : `ledger: ${s2.verified} verified${s2.rejected ? ` · ${s2.rejected} rejected` : ''} · head ${run.head.slice(0, 8)}`;
      label(ctx, tail, s.x + px, s.y + s.h - 12, { size: 9.5, color: naive ? C.ember : INK[3] });
    }
  }

  function drawPrompt(s, time) {
    const { h, ar } = run.pending;
    const k = reduced ? 1 : 0.7 + 0.3 * Math.sin(time * 3);
    card(s, alpha(C.amber, 0.45 + 0.4 * k));
    const px = L.compact ? 14 : 16;
    const hy = s.y + (L.compact ? 18 : 22);
    label(ctx, `Holder approval · ${HOLDERS[h].name}`, s.x + px, hy, { size: L.compact ? 9.5 : 10.5, upper: true, track: 1.4, color: C.amber });
    const size = L.compact ? 11 : 12;
    const msg = `The agent asks for the raw ${ar.doc}: ${list(ar.keys.map((x) => FIELD[x].name))}. It leaves only if you approve.`;
    const bh = L.compact ? 30 : 32;
    const rows = wrap(msg, s.w - px * 2, { size });
    const maxRows = Math.max(1, Math.floor((s.h - (hy - s.y) - bh - 26) / (size * 1.5)));
    rows.slice(0, maxRows).forEach((r, i) => label(ctx, r, s.x + px, hy + 20 + i * size * 1.5, { size, baseline: 'middle', color: C.cream }));
    const by = s.y + s.h - bh - (L.compact ? 12 : 16);
    const aw = Math.min(150, (s.w - px * 2 - 10) * 0.56);
    canvasButton('approve', s.x + px, by, aw, bh, 'Approve', true);
    canvasButton('deny', s.x + px + aw + 10, by, Math.min(110, s.w - px * 2 - aw - 10), bh, 'Deny', false);
  }

  function drawLedger(time) {
    const c = L.col;
    const naive = (run ? run.mode : params.mode) === 'naive';
    label(ctx, 'Provenance ledger', c.x, c.y + 10, { size: 11, upper: true, track: 1.6, color: C.gold });
    label(ctx, naive ? 'no provenance' : 'sha-256', c.x + c.w, c.y + 10, { size: 9.5, align: 'right', upper: true, track: 1.2, color: naive ? C.ember : INK[3] });
    const top = c.y + 34;
    const limit = L.slot.y - 28;
    const rows = run ? run.ledger : [];
    if (!rows.length) {
      const msg = naive ? 'Raw records will land here, with no source, time or hash.' : 'Each claim will be hashed, checked and chained here, starting from your question.';
      wrap(msg, c.w, { size: 11.5 }).forEach((r, i) => label(ctx, r, c.x, top + 4 + i * 17, { size: 11.5, baseline: 'middle', color: INK[3] }));
      return;
    }
    if (naive) {
      const rh = 21;
      const fit = Math.max(1, Math.floor((limit - top - 20) / rh));
      const shown = rows.slice(-fit);
      shown.forEach((row, i) => {
        const y = top + i * rh + 4;
        ctx.globalAlpha = fade(row, time);
        roundRect(ctx, c.x, y - 4.5, 7, 9, 1.5);
        ctx.fillStyle = alpha(C.ember, 0.85);
        ctx.fill();
        label(ctx, ellipsize(`${HOLDERS[row.h].short.toUpperCase()} · ${row.text}`, c.w - 110, { size: 10.5 }), c.x + 16, y, { size: 10.5, baseline: 'middle', color: INK[2] });
        if (row.altered) brokenLink(c.x + c.w - 84, y, C.ember);
        label(ctx, 'unverified', c.x + c.w, y, { size: 10, align: 'right', baseline: 'middle', color: INK[3] });
        ctx.globalAlpha = 1;
      });
      label(ctx, `${plural(rows.length, 'raw record')} · no source, time or hash`, c.x, top + shown.length * rh + 12, { size: 10, color: C.ember });
      return;
    }
    const rh = 38;
    const fit = Math.max(1, Math.floor((limit - top - 14) / rh));
    const shown = rows.slice(-fit);
    // The chain runs through every accepted row.
    const linked = shown.map((r, i) => (r.status === 'ok' || r.status === 'checking' ? i : -1)).filter((i) => i >= 0);
    if (linked.length > 1) line(ctx, c.x + 5, top + linked[0] * rh, c.x + 5, top + linked[linked.length - 1] * rh, alpha(C.gold, 0.4), 1.2);
    shown.forEach((row, i) => {
      ctx.globalAlpha = fade(row, time);
      drawRow(row, c.x, top + i * rh, c.w, time);
      ctx.globalAlpha = 1;
    });
    const links = rows.filter((r) => r.status === 'ok' && r.kind !== 'root').length;
    label(ctx, `chain head ${run.head.slice(0, 8)} · ${plural(links, 'link')}`, c.x + 18, top + shown.length * rh + 4, { size: 10, color: INK[3] });
  }

  // New ledger rows ease in.
  const fade = (row, time) => (reduced ? 1 : clamp((time - row.born) / 0.4));

  function drawRow(row, x, y, w, time) {
    const st = row.status;
    const tone = st === 'bad' ? C.ember : st === 'withheld' ? INK[3] : st === 'checking' ? C.amber : C.gold;
    if (st === 'bad') brokenLink(x + 5, y, C.ember);
    else if (st === 'checking') dot(ctx, x + 5, y, 3.6, C.midnight, C.amber, 1.3);
    else if (st === 'withheld') dot(ctx, x + 5, y, 3.4, C.midnight, INK[3], 1.2);
    else if (row.kind === 'root') dot(ctx, x + 5, y, 3.6, C.midnight, C.gold, 1.3);
    else dot(ctx, x + 5, y, 3.4, C.gold);
    label(ctx, row.id, x + 18, y, { size: 10.5, baseline: 'middle', weight: 500, color: tone });
    // Right side: the hash and its verdict.
    const ho = { size: 10, baseline: 'middle' };
    let rightW = 14;
    if (st === 'checking') {
      for (let i = 0; i < 3; i++) dot(ctx, x + w - 10 + i * 4, y, 1.2, alpha(C.amber, reduced ? 0.9 : 0.4 + 0.6 * ((Math.floor(time * 6) - i) % 3 === 0)));
    } else if (row.kind !== 'root') mark(st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : 'none', x + w - 5, y, st === 'ok' ? C.gold : st === 'bad' ? C.ember : INK[3]);
    const hash = st === 'bad' ? `${row.got.slice(0, 8)} ≠ ${row.digest.slice(0, 8)}` : st === 'withheld' ? 'not released' : row.digest.slice(0, 8);
    label(ctx, hash, x + w - rightW - 6, y, { ...ho, align: 'right', color: st === 'bad' ? C.ember : INK[2] });
    rightW += textWidth(ctx, hash, ho) + 14;
    const meta = row.kind === 'root' ? `you · question · ${row.ts}` : `${HOLDERS[row.h].short} · ${row.src} · ${row.ts}${row.retry ? ' · resent' : ''}`;
    const mx = x + 18 + textWidth(ctx, row.id, { size: 10.5, weight: 500 }) + 8;
    label(ctx, ellipsize(meta, x + w - rightW - mx, { size: 10 }), mx, y, { size: 10, baseline: 'middle', color: INK[3] });
    const to = { size: 11.5, baseline: 'middle' };
    const text = ellipsize(row.text, w - 18, to);
    label(ctx, text, x + 18, y + 16, { ...to, color: st === 'bad' ? C.ember : st === 'withheld' ? INK[3] : C.cream });
    if (st === 'bad') line(ctx, x + 18, y + 16.5, x + 18 + textWidth(ctx, text, to), y + 16.5, alpha(C.ember, 0.8), 1);
  }

  // Phones: one bottom card that shows the ledger, the approval prompt or the answer.
  function drawCompactPanel(time) {
    const s = L.panel;
    if (run?.pending) {
      drawPrompt(s, time);
      return;
    }
    if (!run || run.phase === 'done') {
      drawAnswer(s, time);
      return;
    }
    const naive = run.mode === 'naive';
    card(s, INK.line);
    const px = 14;
    const hy = s.y + 18;
    label(ctx, 'Provenance ledger', s.x + px, hy, { size: 9.5, upper: true, track: 1.4, color: C.gold });
    label(ctx, naive ? 'no provenance' : 'sha-256', s.x + s.w - px, hy, { size: 9, align: 'right', upper: true, track: 1, color: naive ? C.ember : INK[3] });
    const rh = 17;
    const top = hy + 18;
    const fit = Math.max(1, Math.floor((s.y + s.h - 10 - top) / rh) + 1);
    const rows = run.ledger.slice(-fit);
    rows.forEach((row, i) => {
      const y = top + i * rh;
      const x = s.x + px;
      const o = { size: 10, baseline: 'middle' };
      if (naive) {
        roundRect(ctx, x, y - 4, 6, 8, 1.2);
        ctx.fillStyle = alpha(C.ember, 0.85);
        ctx.fill();
        label(ctx, ellipsize(`${HOLDERS[row.h].short} · ${row.text}`, s.w - px * 2 - 90, o), x + 13, y, { ...o, color: INK[2] });
        if (row.altered) brokenLink(x + s.w - px * 2 - 70, y, C.ember);
        label(ctx, 'unverified', s.x + s.w - px, y, { ...o, align: 'right', color: INK[3] });
        return;
      }
      const st = row.status;
      const tone = st === 'bad' ? C.ember : st === 'checking' ? C.amber : st === 'withheld' ? INK[3] : C.gold;
      label(ctx, row.id, x, y, { ...o, weight: 500, color: tone });
      if (st === 'checking') dot(ctx, x + 24, y, 2, C.amber);
      else mark(st === 'ok' ? 'ok' : st === 'bad' ? 'bad' : 'none', x + 24, y, tone, 3);
      label(ctx, st === 'withheld' ? '--------' : row.digest.slice(0, 8), x + 34, y, { ...o, color: INK[3] });
      const tx = x + 34 + textWidth(ctx, '00000000', o) + 10;
      const text = ellipsize(row.text, s.x + s.w - px - tx, o);
      label(ctx, text, tx, y, { ...o, color: st === 'bad' ? C.ember : st === 'withheld' ? INK[3] : C.cream });
      if (st === 'bad') line(ctx, tx, y + 0.5, tx + textWidth(ctx, text, o), y + 0.5, alpha(C.ember, 0.8), 1);
    });
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    if (run) pump(dt);
    view.clear();
    if (!L.agent) layout(view);
    L.hit = {};
    drawHeader();
    drawNetwork(time);
    drawBubble();
    if (run) drawPackets(time);
    drawMeter();
    if (L.compact) drawCompactPanel(time);
    else {
      drawLedger(time);
      if (run?.pending) drawPrompt(L.slot, time);
      else drawAnswer(L.slot, time);
    }
    const s = run?.stats;
    const links = run ? run.ledger.filter((r) => r.status === 'ok' && r.kind !== 'root').length : 0;
    stat.set(
      L.compact
        ? `seed ${seed} · ${s ? s.packets : 0} packets · ${plural(links, 'link')}`
        : `seed ${seed} · run ${runs} · ${s ? s.packets : 0} packets · ${plural(links, 'chain link')} · ${(run ? run.now : 0).toFixed(1)} s protocol time`,
    );
  });

  idle();
  refresh();

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
