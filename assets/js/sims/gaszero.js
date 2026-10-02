// GasZero: static analysis, LLM rewrites and differential fuzzing for gas optimization.
//
// A corpus of short Solidity-like functions goes through the pipeline one at a time.
// Static analysis flags a gas-wasteful pattern, a stand-in LLM proposes a cheaper
// rewrite (correct at the rate you set, subtly wrong otherwise), and a differential
// fuzzer runs the original and the rewrite on the same generated inputs with exact
// 256-bit arithmetic. Any difference in return value, revert or storage is a
// counterexample and rejects the rewrite; otherwise its gas saving is banked. The
// simulation knows which rewrites were wrong, so it can count the bugs that escape.
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

const N = 36;
const P_FLAG = 0.9; // how often static analysis spots a function's pattern
const P_EDGE = 0.5; // boundary-biased: share of values drawn from the edge dictionary
const BUDGETS = [1, 2, 3, 5, 8, 10, 15, 20, 30, 50, 75, 100, 150, 200, 300, 400];
const PHASES = ['static', 'llm', 'fuzz', 'verdict'];

// Phase lengths of one function, in seconds at 1x.
const T_STATIC = 1.1;
const T_LLM = 1.2;
const T_FLY = 0.8;
const T_VERDICT = 1.5;
const T_TRUTH = 0.5; // when an escaped bug is revealed, into the verdict

const W256 = (1n << 256n) - 1n;
const W160 = (1n << 160n) - 1n;
const W128 = (1n << 128n) - 1n;
const E18 = 10n ** 18n;
const SENDER = BigInt(`0xa11ce${'0'.repeat(31)}beef`); // msg.sender in every run
const BOB = BigInt(`0xb0b${'0'.repeat(33)}cafe`);
const REVERT = { revert: true };
const wrap = (v) => v & W256;

/* ------------------------------------------------------------------ */
/* A simplified gas model                                             */
/* ------------------------------------------------------------------ */

// Plausible relative costs: cold and warm storage access, writes by slot history,
// checked versus unchecked arithmetic, loop overhead and calldata-to-memory copies.
const G = {
  call: 420, // dispatch and argument decoding
  cold: 2100, // first access to a storage slot
  warm: 100, // SLOAD of a slot already touched
  set: 20000, // SSTORE zero -> non-zero
  reset: 2900, // SSTORE to a non-zero slot
  dirty: 100, // SSTORE to a slot already written, or with an unchanged value
  log: 1400, // event with two topics
  checked: 32, // checked arithmetic: the operation, an overflow test and a branch
  op: 8, // unchecked arithmetic, comparison or bit operation
  loop: 26, // loop condition and jump
  read: 9, // calldata or memory element read with bounds check
  copy: 14, // per element, calldata copied into memory
  expChecked: 190, // checked exponentiation helper
  exp: 60, // EXP opcode with a one-byte exponent
};

// One execution: storage with access tracking, checked arithmetic and a gas meter.
function machine(init) {
  const s = { ...init };
  const touched = new Set();
  const written = new Set();
  const m = {
    gas: G.call,
    s,
    load(k) {
      m.gas += touched.has(k) ? G.warm : G.cold;
      touched.add(k);
      return s[k] ?? 0n;
    },
    store(k, v) {
      if (!touched.has(k)) m.gas += G.cold;
      touched.add(k);
      if (written.has(k) || v === (s[k] ?? 0n)) m.gas += G.dirty;
      else m.gas += (init[k] ?? 0n) === 0n ? G.set : G.reset;
      written.add(k);
      s[k] = v;
    },
    op(n = 1) {
      m.gas += G.op * n;
    },
    add(a, b) {
      m.gas += G.checked;
      const v = a + b;
      if (v > W256) throw REVERT;
      return v;
    },
    sub(a, b) {
      m.gas += G.checked;
      if (b > a) throw REVERT;
      return a - b;
    },
    mul(a, b) {
      m.gas += G.checked;
      const v = a * b;
      if (v > W256) throw REVERT;
      return v;
    },
  };
  return m;
}

/* ------------------------------------------------------------------ */
/* Function templates                                                 */
/* ------------------------------------------------------------------ */

// Each template: Solidity-like source for the original, a correct rewrite and one or
// two plausible wrong ones; their semantics over exact integers; what the fuzzer
// generates (call arguments and starting storage); and a typical call for gas.
const TEMPLATES = [
  {
    name: 'withdraw',
    contracts: ['Vault', 'Staking', 'Escrow', 'Savings'],
    args: [['amt', 'u256']],
    state: () => [['bal', 'u256']],
    labels: { bal: 'bal' },
    code: () => {
      const head = 'function withdraw(uint amt) {';
      const cache = '  uint b = bal[msg.sender];';
      const debit = '  unchecked { bal[msg.sender] = b - amt; }';
      const emit = '  emit Withdrawn(msg.sender, amt);';
      return {
        orig: [head, '  require(bal[msg.sender] >= amt);', '  bal[msg.sender] -= amt;', emit, '}'],
        ok: [head, cache, '  require(b >= amt);', debit, emit, '}'],
        bad: [
          [head, cache, '  require(b > amt);', debit, emit, '}'],
          [head, cache, debit, emit, '}'],
        ],
      };
    },
    flag: [1, 2],
    find: ['it reads bal[msg.sender] from storage twice', 'balance read twice'],
    idea: ['cache the balance and subtract unchecked after the check', 'cache the balance'],
    wrong: [
      { line: 2, when: 'amt equals bal' },
      { line: 2, idea: ['drop the redundant-looking check and subtract unchecked', 'drop the check'], when: 'amt exceeds bal' },
    ],
    run: {
      orig(a, m) {
        m.op();
        if (m.load('bal') < a.amt) throw REVERT;
        m.store('bal', m.sub(m.load('bal'), a.amt));
        m.gas += G.log;
      },
      ok(a, m) {
        const b = m.load('bal');
        m.op();
        if (b < a.amt) throw REVERT;
        m.op();
        m.store('bal', b - a.amt);
        m.gas += G.log;
      },
      bad: [
        (a, m) => {
          const b = m.load('bal');
          m.op();
          if (b <= a.amt) throw REVERT;
          m.op();
          m.store('bal', b - a.amt);
          m.gas += G.log;
        },
        (a, m) => {
          const b = m.load('bal');
          m.op();
          m.store('bal', wrap(b - a.amt));
          m.gas += G.log;
        },
      ],
    },
    bench: () => ({ args: { amt: 1500n * E18 }, state: { bal: 5000n * E18 } }),
  },
  {
    name: 'addAll',
    contracts: ['Ledger', 'Rewards', 'Pool'],
    params: (r) => ({ len: pick(r, [6, 8, 12]) }),
    args: [['xs', 'arr']],
    state: () => [['total', 'u256']],
    labels: { total: 'total' },
    code: () => {
      const head = 'function addAll(uint[] calldata xs) {';
      const each = '  for (uint i; i < xs.length; ++i)';
      return {
        orig: ['function addAll(uint[] memory xs) {', '  for (uint i = 0; i < xs.length; i++)', '    total += xs[i];', '}'],
        ok: [head, '  uint t = total;', each, '    t += xs[i];', '  total = t;', '}'],
        bad: [
          [head, '  uint t = total;', each, '    unchecked { t += xs[i]; }', '  total = t;', '}'],
          [head, '  uint t = total + xs[0];', '  for (uint i = 1; i < xs.length; ++i)', '    t += xs[i];', '  total = t;', '}'],
        ],
      };
    },
    flag: [0, 2],
    find: ['it copies the array into memory and writes storage on every pass', 'storage write every pass'],
    idea: ['read calldata in place and sum into a local, writing storage once', 'sum locally, write once'],
    wrong: [
      { line: 3, idea: ['sum into a local inside unchecked, writing storage once', 'unchecked local sum'], when: 'the sum overflows' },
      { line: 1, idea: ['start the local sum from the first element, writing storage once', 'start from xs[0]'], when: 'xs is empty' },
    ],
    run: {
      orig(a, m) {
        m.gas += G.copy * a.xs.length + 2 * G.op;
        for (let i = 0; ; i++) {
          m.gas += G.loop;
          if (i >= a.xs.length) break;
          m.gas += G.read;
          m.store('total', m.add(m.load('total'), a.xs[i]));
          m.gas += G.checked;
        }
      },
      ok(a, m) {
        let t = m.load('total');
        for (let i = 0; ; i++) {
          m.gas += G.loop;
          if (i >= a.xs.length) break;
          m.gas += G.read;
          t = m.add(t, a.xs[i]);
          m.op();
        }
        m.store('total', t);
      },
      bad: [
        (a, m) => {
          let t = m.load('total');
          for (let i = 0; ; i++) {
            m.gas += G.loop;
            if (i >= a.xs.length) break;
            m.gas += G.read;
            m.op(2);
            t = wrap(t + a.xs[i]);
          }
          m.store('total', t);
        },
        (a, m) => {
          if (!a.xs.length) throw REVERT;
          m.gas += G.read;
          let t = m.add(m.load('total'), a.xs[0]);
          for (let i = 1; ; i++) {
            m.gas += G.loop;
            if (i >= a.xs.length) break;
            m.gas += G.read;
            t = m.add(t, a.xs[i]);
            m.op();
          }
          m.store('total', t);
        },
      ],
    },
    bench: () => ({ args: { xs: [3n, 7n, 12n, 5n, 9n].map((v) => v * E18) }, state: { total: 40000n * E18 } }),
  },
  {
    name: 'setBand',
    contracts: ['Oracle', 'Risk', 'Market'],
    args: [
      ['lo', 'u128'],
      ['hi', 'u128'],
    ],
    state: () => [],
    fixed: () => ({ minPrice: 9n * 10n ** 17n, maxPrice: 11n * 10n ** 17n, band: ((11n * 10n ** 17n) << 128n) | (9n * 10n ** 17n) }),
    labels: { lo: 'minPrice', hi: 'maxPrice' },
    bits: { lo: 128, hi: 128 },
    view: (s, ver) => (ver === 'orig' ? { lo: s.minPrice, hi: s.maxPrice } : { lo: s.band & W128, hi: s.band >> 128n }),
    code: () => {
      const head = 'function setBand(uint128 lo, uint128 hi) {';
      return {
        orig: [head, '  minPrice = lo;', '  maxPrice = hi;', '}'],
        ok: [head, '  band = uint(hi) << 128 | lo;  // one slot', '}'],
        bad: [[head, '  band = uint(hi) << 128 + lo;  // one slot', '}']],
      };
    },
    flag: [1, 2],
    find: ['it spends two storage slots on two 128-bit values', 'two slots, two writes'],
    idea: ['pack both values into a single storage slot', 'pack into one slot'],
    wrong: [{ line: 1, when: 'lo is not 0' }],
    run: {
      orig(a, m) {
        m.store('minPrice', a.lo);
        m.store('maxPrice', a.hi);
      },
      ok(a, m) {
        m.op(2);
        m.store('band', (a.hi << 128n) | a.lo);
      },
      bad: [
        (a, m) => {
          m.op(2);
          const shift = 128n + a.lo; // `+` binds tighter than `<<`
          m.store('band', shift >= 256n ? 0n : wrap(a.hi << shift));
        },
      ],
    },
    bench: () => ({ args: { lo: 95n * 10n ** 16n, hi: 105n * 10n ** 16n }, state: {} }),
  },
  {
    name: 'countAbove',
    contracts: ['Oracle', 'Auction', 'Book'],
    params: (r) => ({ n: int(r, 3, 6) }),
    args: [['t', 'u256']],
    state: (p) => Array.from({ length: p.n }, (_, i) => [`p${i}`, 'u256']),
    fixed: (p) => ({ len: BigInt(p.n) }),
    show: (inp, p) => `prices=${listText(Array.from({ length: p.n }, (_, i) => inp.state[`p${i}`]))}`,
    code: () => {
      const head = 'function countAbove(uint t) returns (uint c) {';
      return {
        orig: [head, '  for (uint i = 0; i < prices.length; i++)', '    if (prices[i] > t) c++;', '}'],
        ok: [head, '  uint n = prices.length;', '  for (uint i; i < n; ++i)', '    if (prices[i] > t) c++;', '}'],
        bad: [[head, '  uint n = prices.length;', '  for (uint i; i < n; ++i)', '    if (prices[i] >= t) c++;', '}']],
      };
    },
    flag: [1],
    find: ['it reads prices.length from storage on every pass', 'length read every pass'],
    idea: ['read the array length once, before the loop', 'cache the length'],
    wrong: [{ line: 3, when: 'a price equals t' }],
    run: {
      orig(a, m) {
        let c = 0n;
        for (let i = 0; ; i++) {
          m.gas += G.loop;
          if (i >= Number(m.load('len'))) break;
          m.op();
          if (m.load(`p${i}`) > a.t) c = m.add(c, 1n);
          m.gas += G.checked;
        }
        return c;
      },
      ok(a, m) {
        const n = Number(m.load('len'));
        let c = 0n;
        for (let i = 0; ; i++) {
          m.gas += G.loop;
          if (i >= n) break;
          m.op();
          if (m.load(`p${i}`) > a.t) c = m.add(c, 1n);
          m.op();
        }
        return c;
      },
      bad: [
        (a, m) => {
          const n = Number(m.load('len'));
          let c = 0n;
          for (let i = 0; ; i++) {
            m.gas += G.loop;
            if (i >= n) break;
            m.op();
            if (m.load(`p${i}`) >= a.t) c = m.add(c, 1n);
            m.op();
          }
          return c;
        },
      ],
    },
    bench: (p) => ({
      args: { t: 2n * E18 },
      state: Object.fromEntries([18n, 24n, 11n, 29n, 21n, 16n].slice(0, p.n).map((v, i) => [`p${i}`, v * 10n ** 17n])),
    }),
  },
  {
    name: 'pay',
    contracts: ['Router', 'Checkout', 'Market'],
    params: (r) => ({ bps: int(r, 5, 300) }),
    args: [['amt', 'u128']],
    state: () => [
      ['paid', 'u256'],
      ['treasury', 'u256'],
    ],
    fixed: (p) => ({ feeBps: BigInt(p.bps) }),
    labels: { paid: 'paid', treasury: 'treasury' },
    code: () => {
      const head = 'function pay(uint128 amt) returns (uint fee) {';
      const credit = '  paid[msg.sender] += amt;';
      const fee = '  fee = amt * feeBps / 10_000;';
      return {
        orig: [head, credit, fee, '  if (feeBps > 0) treasury += fee;', '}'],
        ok: [head, credit, fee, '  if (fee > 0) treasury += fee;', '}'],
        bad: [[head, fee, '  if (fee == 0) return 0;', credit, '  treasury += fee;', '}']],
      };
    },
    flag: [2, 3],
    find: ['it reads feeBps from storage twice', 'feeBps read twice'],
    idea: ['test the computed fee instead of re-reading the rate', 'test the fee instead'],
    wrong: [{ line: 2, idea: ['return early when there is no fee to collect', 'return early on zero fee'], when: 'the fee rounds to 0' }],
    run: {
      orig(a, m) {
        m.store('paid', m.add(m.load('paid'), a.amt));
        const fee = m.mul(a.amt, m.load('feeBps')) / 10000n;
        m.op(2);
        if (m.load('feeBps') > 0n) m.store('treasury', m.add(m.load('treasury'), fee));
        return fee;
      },
      ok(a, m) {
        m.store('paid', m.add(m.load('paid'), a.amt));
        const fee = m.mul(a.amt, m.load('feeBps')) / 10000n;
        m.op(2);
        if (fee > 0n) m.store('treasury', m.add(m.load('treasury'), fee));
        return fee;
      },
      bad: [
        (a, m) => {
          const fee = m.mul(a.amt, m.load('feeBps')) / 10000n;
          m.op(2);
          if (fee === 0n) return 0n;
          m.store('paid', m.add(m.load('paid'), a.amt));
          m.store('treasury', m.add(m.load('treasury'), fee));
          return fee;
        },
      ],
    },
    bench: () => ({ args: { amt: 25n * E18 }, state: { paid: 100n * E18, treasury: 4000n * E18 } }),
  },
  {
    name: 'setScale',
    contracts: ['Feed', 'Oracle', 'Vault'],
    params: (r) => ({ cap: pick(r, [6, 8, 18]) }),
    args: [['d', 'u8']],
    state: () => [],
    fixed: () => ({ scale: 1n }),
    labels: { scale: 'scale' },
    code: (p) => {
      const head = 'function setScale(uint8 d) {';
      const pow = '  unchecked { scale = 10 ** d; }';
      return {
        orig: [head, `  require(d <= ${p.cap}, "decimals");`, '  scale = 10 ** d;', '}'],
        ok: [head, `  if (d > ${p.cap}) revert TooPrecise();`, pow, '}'],
        bad: [[head, `  if (d >= ${p.cap}) revert TooPrecise();`, pow, '}']],
      };
    },
    flag: [2],
    find: ['it pays for checked exponentiation of a bounded power of ten', 'checked exponent'],
    idea: ['use a custom error and an unchecked power of ten', 'unchecked power of ten'],
    wrong: [{ line: 1, when: (p) => `d is ${p.cap}` }],
    run: {
      orig(a, m, p) {
        m.op();
        if (a.d > BigInt(p.cap)) throw REVERT;
        m.gas += G.expChecked;
        m.store('scale', 10n ** a.d);
      },
      ok(a, m, p) {
        m.op();
        if (a.d > BigInt(p.cap)) throw REVERT;
        m.gas += G.exp;
        m.store('scale', 10n ** a.d);
      },
      bad: [
        (a, m, p) => {
          m.op();
          if (a.d >= BigInt(p.cap)) throw REVERT;
          m.gas += G.exp;
          m.store('scale', 10n ** a.d);
        },
      ],
    },
    bench: (p) => ({ args: { d: BigInt(p.cap - 2) }, state: {} }),
  },
  {
    name: 'transfer',
    contracts: ['Token', 'Shares', 'Points'],
    args: [
      ['to', 'addr'],
      ['amt', 'u256'],
    ],
    state: (p, args) => (args.to === SENDER ? [['bal', 'u256']] : [['bal', 'u256'], ['balTo', 'u256']]),
    labels: { bal: 'bal[sender]', balTo: 'bal[to]' },
    code: () => {
      const head = 'function transfer(address to, uint amt) {';
      const cache = '  uint b = bal[msg.sender];';
      return {
        orig: [head, '  require(bal[msg.sender] >= amt);', '  bal[msg.sender] -= amt;', '  bal[to] += amt;', '}'],
        ok: [head, cache, '  require(b >= amt);', '  unchecked { bal[msg.sender] = b - amt; }', '  bal[to] += amt;', '}'],
        bad: [[head, cache, '  uint c = bal[to];', '  require(b >= amt);', '  bal[msg.sender] = b - amt;', '  bal[to] = c + amt;', '}']],
      };
    },
    flag: [1, 2],
    find: ['it reads bal[msg.sender] from storage twice', 'sender balance read twice'],
    idea: ['cache the sender balance and debit it unchecked', 'cache the sender balance'],
    wrong: [{ line: 5, idea: ['cache both balances and write each one once', 'cache both balances'], when: 'to is msg.sender' }],
    run: {
      orig(a, m) {
        const to = a.to === SENDER ? 'bal' : 'balTo';
        m.op();
        if (m.load('bal') < a.amt) throw REVERT;
        m.store('bal', m.sub(m.load('bal'), a.amt));
        m.store(to, m.add(m.load(to), a.amt));
      },
      ok(a, m) {
        const to = a.to === SENDER ? 'bal' : 'balTo';
        const b = m.load('bal');
        m.op();
        if (b < a.amt) throw REVERT;
        m.op();
        m.store('bal', b - a.amt);
        m.store(to, m.add(m.load(to), a.amt));
      },
      bad: [
        (a, m) => {
          const to = a.to === SENDER ? 'bal' : 'balTo';
          const b = m.load('bal');
          const c = m.load(to); // stale when `to` is the sender
          m.op();
          if (b < a.amt) throw REVERT;
          m.store('bal', m.sub(b, a.amt));
          m.store(to, m.add(c, a.amt));
        },
      ],
    },
    bench: () => ({ args: { to: BOB, amt: E18 }, state: { bal: 1000n * E18, balTo: 200n * E18 } }),
  },
  {
    name: 'isPow2',
    contracts: ['Bits', 'MathLib', 'Pool'],
    args: [['x', 'u256']],
    state: () => [],
    code: () => {
      const head = 'function isPow2(uint x) returns (bool) {';
      return {
        orig: [head, '  if (x == 0) return false;', '  while (x % 2 == 0) x /= 2;', '  return x == 1;', '}'],
        ok: [head, '  return x != 0 && x & (x - 1) == 0;', '}'],
        bad: [[head, '  return x & (x - 1) == 0;', '}']],
      };
    },
    flag: [2],
    find: ['it loops to answer what one bit trick can', 'loop for a bit test'],
    idea: ['replace the loop with the bit trick x & (x - 1)', 'bit trick'],
    wrong: [{ line: 1, when: 'x is 0' }],
    run: {
      orig(a, m) {
        m.op();
        if (a.x === 0n) return false;
        let x = a.x;
        for (;;) {
          m.gas += G.loop + 2 * G.op;
          if (x % 2n !== 0n) break;
          m.op();
          x /= 2n;
        }
        m.op();
        return x === 1n;
      },
      ok(a, m) {
        m.op(4);
        return a.x !== 0n && (a.x & (a.x - 1n)) === 0n;
      },
      bad: [
        (a, m) => {
          const y = m.sub(a.x, 1n); // checked: underflows at x = 0
          m.op(2);
          return (a.x & y) === 0n;
        },
      ],
    },
    bench: () => ({ args: { x: 1024n }, state: {} }),
  },
];

// Line diff (longest common subsequence): [{ t: ' ' | '-' | '+', s, a, b }].
function diff(A, B) {
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Int16Array(m + 1));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n || j < m) {
    if (i < n && j < m && A[i] === B[j]) ops.push({ t: ' ', s: A[i], a: i++, b: j++ });
    else if (i < n && (j >= m || dp[i + 1][j] >= dp[i][j + 1])) ops.push({ t: '-', s: A[i], a: i++ });
    else ops.push({ t: '+', s: B[j], b: j++ });
  }
  return ops;
}

// Sizes the stage has to make room for, over every template and variant.
const SAMPLE = TEMPLATES.map((t) => t.code(t.params ? t.params(() => 0.99) : {}));
const MAX_LINES = Math.max(...SAMPLE.flatMap((c) => [c.orig, c.ok, ...c.bad].map((v) => v.length)));
const MAX_DIFF = Math.max(...SAMPLE.flatMap((c) => [c.ok, ...c.bad].map((v) => diff(c.orig, v).length)));
const MAX_CHARS = Math.max(...SAMPLE.flatMap((c) => [c.orig, c.ok, ...c.bad].flat().map((s) => s.length)));

/* ------------------------------------------------------------------ */
/* Differential fuzzing                                               */
/* ------------------------------------------------------------------ */

const BITS = { u256: 256, u128: 128, u8: 8 };

function bitsOf(r, n) {
  let v = 0n;
  for (let i = 0; i < n; i += 32) v = (v << 32n) | BigInt((r() * 4294967296) >>> 0);
  return n % 32 ? v & ((1n << BigInt(n)) - 1n) : v;
}

// An unsigned value: uniform over the type, or (boundary-biased) often an edge value.
function uintOf(r, n, edgy) {
  if (!edgy || r() >= P_EDGE) return bitsOf(r, n);
  const max = (1n << BigInt(n)) - 1n;
  const u = r();
  if (u < 0.3) return 0n;
  if (u < 0.5) return 1n;
  if (u < 0.7) return max;
  if (u < 0.8) return max - 1n;
  return 1n << BigInt(int(r, 1, n - 1));
}

function valueOf(r, type, edgy, p) {
  if (type === 'addr') {
    if (!edgy || r() >= P_EDGE) return bitsOf(r, 160);
    const u = r();
    return u < 0.25 ? 0n : u < 0.75 ? SENDER : W160;
  }
  if (type === 'arr') {
    let len = int(r, 0, p.len);
    if (edgy && r() < P_EDGE) {
      const u = r();
      len = u < 0.45 ? 0 : u < 0.8 ? 1 : p.len;
    }
    return Array.from({ length: len }, () => uintOf(r, 256, edgy));
  }
  return uintOf(r, BITS[type], edgy);
}

function makeInput(r, f, edgy) {
  const args = {};
  for (const [k, t] of f.tpl.args) args[k] = valueOf(r, t, edgy, f.p);
  const state = f.tpl.fixed ? f.tpl.fixed(f.p) : {};
  for (const [k, t] of f.tpl.state(f.p, args)) state[k] = valueOf(r, t, edgy, f.p);
  return { args, state };
}

function exec(f, ver, inp) {
  const m = machine(inp.state);
  const run = ver === 'orig' ? f.tpl.run.orig : ver === 'ok' ? f.tpl.run.ok : f.tpl.run.bad[ver];
  try {
    const ret = run(inp.args, m, f.p);
    return { revert: false, ret, obs: f.tpl.view ? f.tpl.view(m.s, ver) : m.s, gas: m.gas };
  } catch (err) {
    if (err !== REVERT) throw err;
    return { revert: true, gas: m.gas };
  }
}

// Same return value, same revert, same observable storage.
function agree(a, b) {
  if (a.revert || b.revert) return a.revert === b.revert;
  if (a.ret !== b.ret) return false;
  for (const k in a.obs) if (a.obs[k] !== b.obs[k]) return false;
  for (const k in b.obs) if (!(k in a.obs)) return false;
  return true;
}

// A fuzzing campaign for one function. Marks: 0 outputs agree, 1 both reverted, 2 diverged.
function campaign(f, budget, edgy, seed, keep) {
  const r = rng((Math.imul(seed, 2654435761) ^ Math.imul(f.i + 1, 40503) ^ (edgy ? 0x5bd1e995 : 0)) >>> 0);
  const z = { budget, edgy, k: 0, marks: new Uint8Array(budget), cex: 0, io: keep ? [] : null, last: null };
  z.done = () => z.cex > 0 || z.k >= z.budget;
  z.next = () => {
    const inp = makeInput(r, f, edgy);
    const a = exec(f, 'orig', inp);
    const b = exec(f, f.variant, inp);
    const same = agree(a, b);
    z.marks[z.k] = same ? (a.revert ? 1 : 0) : 2;
    z.last = [inp, a, b];
    if (keep) z.io.push(z.last);
    z.k++;
    if (!same) z.cex = z.k;
  };
  z.run = (deadline) => {
    while (!z.done() && performance.now() < deadline) z.next();
    return z.done();
  };
  return z;
}

function gasOf(f, ver) {
  const b = f.tpl.bench(f.p);
  const inp = { args: b.args, state: { ...(f.tpl.fixed ? f.tpl.fixed(f.p) : {}), ...b.state } };
  const a = exec(f, 'orig', inp);
  const z = exec(f, ver, inp);
  return { orig: a.gas, rew: z.gas, save: a.gas - z.gas, pct: (a.gas - z.gas) / a.gas };
}

/* ------------------------------------------------------------------ */
/* Text                                                               */
/* ------------------------------------------------------------------ */

function num(v, n = 256) {
  if (typeof v === 'boolean') return String(v);
  const max = (1n << BigInt(n)) - 1n;
  if (v < 100000n) return v.toString();
  if (v === max) return 'max';
  if (max - v < 1000n) return `max−${max - v}`;
  if ((v & (v - 1n)) === 0n) return `2**${v.toString(2).length - 1}`;
  const s = v.toString();
  return `${s[0]}.${s[1]}e${s.length - 1}`;
}

function addrText(v) {
  if (v === 0n) return '0x0';
  if (v === SENDER) return 'msg.sender';
  if (v === W160) return '0xff…ff';
  const h = v.toString(16).padStart(40, '0');
  return `0x${h.slice(0, 4)}…${h.slice(-2)}`;
}

function listText(xs) {
  return `[${xs
    .slice(0, 2)
    .map((x) => num(x))
    .join(', ')}${xs.length > 2 ? ', …' : ''}]`;
}

function valText(v, type) {
  if (type === 'addr') return addrText(v);
  if (type === 'arr') return listText(v);
  return num(v, BITS[type]);
}

// "withdraw(amt=0) · bal=0": the call and the starting storage the fuzzer chose.
function callText(f, inp) {
  const args = f.tpl.args.map(([k, t]) => `${k}=${valText(inp.args[k], t)}`).join(', ');
  const st = f.tpl.show
    ? f.tpl.show(inp, f.p)
    : f.tpl
        .state(f.p, inp.args)
        .map(([k]) => `${f.tpl.labels?.[k] ?? k}=${num(inp.state[k])}`)
        .join(', ');
  return st ? `${f.tpl.name}(${args}) · ${st}` : `${f.tpl.name}(${args})`;
}

// What one version did on an input, phrased against what the other version did.
function outText(f, inp, o, other) {
  if (o.revert) return 'revert';
  const ret = o.ret === undefined ? 'ok' : num(o.ret);
  if (!other || other.revert || o.ret !== other.ret) return ret;
  for (const k of Object.keys(o.obs)) {
    if (o.obs[k] === other.obs[k]) continue;
    const name = f.tpl.labels?.[k] ?? k;
    const before = inp.state[k];
    if (before === undefined) return `${name}=${num(o.obs[k], f.tpl.bits?.[k])}`;
    const d = o.obs[k] - before;
    return `${name} ${d < 0n ? '−' : '+'}${num(d < 0n ? -d : d)}`;
  }
  return ret;
}

const pct = (v) => `${(v * 100).toFixed(1)}%`;
const pad2 = (v) => String(v).padStart(2, '0');

export function create({ stage, panel, reduced }) {
  const params = { bi: BUDGETS.indexOf(50), accuracy: 0.7, edgy: true, speed: reduced ? 0 : 8 };
  let seed = 11;
  let fns = [];
  let contracts = 0;
  let potential = 0;
  let cur = 0;
  let job = null; // the function being animated
  let batch = null; // { queue, single, cur } while the pipeline runs
  let fx = [];
  let now = 0;
  let lastFlip = 0;
  let meterShown = 0;
  let dead = false;
  let narration = null;
  const L = { hover: -1 };
  const budget = () => BUDGETS[params.bi];
  const tell = (full, short, tone = INK[2]) => (narration = { full, short: short || full, tone });

  /* ---------------------------------------------------------------- */
  /* Corpus                                                           */
  /* ---------------------------------------------------------------- */

  function populate() {
    const r = rng(seed);
    const order = shuffle(
      r,
      Array.from({ length: N }, (_, i) => TEMPLATES[i % TEMPLATES.length]),
    );
    fns = order.map((tpl, i) => {
      const p = tpl.params ? tpl.params(r) : {};
      const f = { i, tpl, p, code: tpl.code(p), contract: pick(r, tpl.contracts), flagged: r() < P_FLAG, llm: r(), roll: r() };
      f.name = `${f.contract}.${tpl.name}`;
      f.okGas = gasOf({ ...f, variant: 'ok' }, 'ok');
      return f;
    });
    contracts = new Set(fns.map((f) => f.contract)).size;
    potential = fns.reduce((s, f) => s + (f.flagged ? f.okGas.save : 0), 0);
    cur = 0;
    assign();
    tell('Run the pipeline, or click a function block to optimize it and fuzz the rewrite.', 'Run the pipeline, or tap a block to test one.');
  }

  // Which rewrite the stand-in LLM writes for each function, at the current accuracy.
  function assign() {
    for (const f of fns) {
      const n = f.tpl.wrong.length;
      f.variant = f.llm < params.accuracy ? 'ok' : Math.min(n - 1, Math.floor(f.roll * n));
      f.rew = f.variant === 'ok' ? f.code.ok : f.code.bad[f.variant];
      f.ops = diff(f.code.orig, f.rew);
      f.added = new Set(f.ops.filter((o) => o.t === '+').map((o) => o.b));
      const w = f.variant === 'ok' ? null : f.tpl.wrong[f.variant];
      f.idea = w?.idea ?? f.tpl.idea;
      f.bugLine = w ? w.line : -1;
      f.when = w ? (typeof w.when === 'function' ? w.when(f.p) : w.when) : '';
      f.gas = f.variant === 'ok' ? f.okGas : gasOf(f, f.variant);
    }
    clearResults();
  }

  function clearResults() {
    for (const f of fns) {
      f.status = 'pending';
      f.rec = null;
      f.flipAt = null;
    }
    job = null;
    batch = null;
    fx = [];
    refresh();
  }

  /* ---------------------------------------------------------------- */
  /* Pipeline driver                                                  */
  /* ---------------------------------------------------------------- */

  function settle(f, z) {
    const [inp, a, b] = z.last;
    f.rec = {
      marks: z.marks,
      tried: z.k,
      budget: z.budget,
      edgy: z.edgy,
      cex: z.cex,
      call: callText(f, inp),
      oa: outText(f, inp, a, b),
      ob: outText(f, inp, b, a),
    };
    f.status = z.cex ? 'caught' : f.variant === 'ok' ? 'accepted' : 'escaped';
  }

  function skip(f) {
    f.rec = { marks: null, tried: 0, budget: 0, edgy: params.edgy, cex: 0 };
    f.status = 'skipped';
  }

  // Instant runs flip the corpus blocks in quick sequence as results come in.
  function reveal(f) {
    f.flipAt = Math.max(now, lastFlip + 0.035);
    lastFlip = f.flipAt;
  }

  const shown = (f) => f.status !== 'pending' && f.status !== 'running' && (f.flipAt == null || now >= f.flipAt);

  function runAll() {
    if (job || batch) return;
    tip.hide();
    if (!fns.some((f) => f.status === 'pending')) clearResults();
    batch = { queue: fns.filter((f) => f.status === 'pending').map((f) => f.i), single: false, cur: null };
    lastFlip = now;
    refresh();
  }

  function runOne(f) {
    if (job || batch || f.status !== 'pending') return;
    tip.hide();
    cur = f.i;
    batch = { queue: [f.i], single: true, cur: null };
    lastFlip = now;
    refresh();
  }

  function stepOne() {
    const f = fns.find((g) => g.status === 'pending');
    if (f) runOne(f);
  }

  function select(i) {
    tip.hide();
    if (job || batch) return;
    const f = fns[i];
    if (f.status === 'pending') runOne(f);
    else {
      cur = i;
      narrateVerdict(f, true);
    }
  }

  function startJob(f) {
    cur = f.i;
    f.status = 'running';
    job = { f, phase: 'static', t: 0, z: null, rate: 1, spawned: 0, landed: 0, landT: -1, truth: false };
    tell(`Static analysis scans ${f.name} for gas-wasteful patterns…`, `Scanning ${f.tpl.name}…`, C.amber);
  }

  function stepJob(dt) {
    const j = job;
    const f = j.f;
    j.t += dt;
    if (j.phase === 'static' && j.t >= T_STATIC) {
      if (!f.flagged) {
        skip(f);
        narrateVerdict(f);
        refresh();
        enter('verdict');
      } else {
        tell(`Static analysis flags ${f.name}: ${f.tpl.find[0]}.`, `Flagged: ${f.tpl.find[1]}.`, C.amber);
        enter('llm');
      }
    } else if (j.phase === 'llm' && j.t >= T_LLM) {
      j.z = campaign(f, budget(), params.edgy, seed, true);
      j.rate = clamp(j.z.budget / 1.2, 4, 140);
      const kind = params.edgy ? 'boundary-biased' : 'uniform';
      tell(`Differential fuzzing: ${j.z.budget} ${kind} inputs, each run on both versions and compared…`, `Fuzzing ${j.z.budget} ${params.edgy ? 'boundary' : 'uniform'} inputs…`, C.amber);
      enter('fuzz');
    } else if (j.phase === 'fuzz') {
      const z = j.z;
      const want = Math.min(z.budget, Math.floor(j.t * j.rate) + 1);
      while (j.spawned < want && !(z.cex && j.spawned >= z.cex)) {
        if (z.k <= j.spawned) z.next();
        j.spawned++;
      }
      const landed = j.t < T_FLY ? 0 : Math.min(j.spawned, Math.floor((j.t - T_FLY) * j.rate) + 1);
      if (landed > j.landed) j.landT = now;
      j.landed = landed;
      if (j.landed >= (z.cex || z.budget)) {
        settle(f, z);
        if (f.status === 'escaped') {
          tell(
            `No counterexample in ${z.k} inputs: accepted, saving ${fmt.int(f.gas.save)} gas per call (${pct(f.gas.pct)}).`,
            `Accepted: −${fmt.int(f.gas.save)} gas (${pct(f.gas.pct)}).`,
            C.gold,
          );
        } else narrateVerdict(f);
        verdictFx(f);
        refresh();
        enter('verdict');
      }
    } else if (j.phase === 'verdict') {
      if (f.status === 'escaped' && !j.truth && j.t >= T_TRUTH) {
        j.truth = true;
        narrateVerdict(f);
        const b = blockRect(f.i);
        fx.push({ kind: 'burst', x: b.x + b.w / 2, y: b.y + b.h / 2, t0: now, dur: 0.9, color: C.ember });
      }
      if (j.t >= (f.status === 'skipped' ? T_VERDICT * 0.6 : T_VERDICT)) job = null;
    }
  }

  function enter(phase) {
    job.phase = phase;
    job.t = 0;
  }

  // Finish the animated function at once (the speed was switched to Instant).
  function finishJob() {
    const f = job.f;
    if (job.phase !== 'verdict') {
      if (!f.flagged) skip(f);
      else {
        const z = job.z || campaign(f, budget(), params.edgy, seed, false);
        while (!z.done()) z.next();
        settle(f, z);
      }
      narrateVerdict(f);
    }
    job = null;
    refresh();
  }

  // Instant mode: fuzz in slices of about 7 ms per frame so the page stays responsive.
  function instantSlice() {
    const deadline = performance.now() + 7;
    while (batch && performance.now() < deadline) {
      if (!batch.cur) {
        if (!batch.queue.length) return endBatch();
        const f = fns[batch.queue.shift()];
        if (!f.flagged) {
          skip(f);
          reveal(f);
          if (batch.single) narrateVerdict(f);
          continue;
        }
        f.status = 'running';
        batch.cur = { f, z: campaign(f, budget(), params.edgy, seed, false) };
      }
      const { f, z } = batch.cur;
      if (z.run(deadline)) {
        settle(f, z);
        reveal(f);
        if (batch.single) narrateVerdict(f);
        batch.cur = null;
      }
    }
    if (batch && !batch.single) {
      const done = fns.filter((f) => f.status !== 'pending' && f.status !== 'running').length;
      tell(`Fuzzing the whole corpus at full speed: ${done} of ${N} functions done…`, `Fuzzing the corpus: ${done} / ${N}…`, C.amber);
    }
  }

  function nextJob() {
    if (batch.cur) {
      // Switched from Instant mid-function: finish it, then animate the rest.
      const { f, z } = batch.cur;
      while (!z.done()) z.next();
      settle(f, z);
      batch.cur = null;
    }
    if (!batch.queue.length) return endBatch();
    startJob(fns[batch.queue.shift()]);
  }

  function endBatch() {
    const single = batch.single;
    batch = null;
    if (single) {
      const f = fns[cur];
      say.say(verdictSpeech(f));
    } else {
      const s = summary(true);
      const first = fns.find((f) => f.status === 'escaped');
      if (first) cur = first.i;
      tell(
        `Pipeline complete: ${s.acc} rewrites accepted, ${s.caught} wrong ones caught, ${s.esc} escaped.${s.esc ? ' Ember blocks shipped wrong code.' : ' No wrong rewrite slipped through.'}`,
        `Done: ${s.acc} accepted, ${s.caught} caught, ${s.esc} escaped.`,
        C.cream,
      );
      say.say(
        `Pipeline complete. ${s.acc} of ${N} functions got an accepted rewrite; fuzzing caught ${s.caught} wrong rewrites and ${s.esc} escaped. ${fmt.int(s.saved)} gas saved per call in total, simulated.`,
      );
    }
    refresh();
  }

  function narrateVerdict(f, browsing = false) {
    const r = f.rec;
    if (f.status === 'skipped') {
      tell(`Static analysis finds no gas-wasteful pattern in ${f.name}, so it stays as written.`, `No pattern in ${f.tpl.name}: left as is.`, INK[2]);
    } else if (f.status === 'caught') {
      tell(`Counterexample at input ${r.cex}: ${r.call} gives ${r.oa} in the original, ${r.ob} in the rewrite. Rejected.`, `Caught at input ${r.cex}: fails when ${f.when}.`, C.ember);
    } else if (f.status === 'accepted') {
      tell(
        `No input told them apart in ${r.tried} tries: accepted, saving ${fmt.int(f.gas.save)} gas per call (${pct(f.gas.pct)}).`,
        `Accepted: −${fmt.int(f.gas.save)} gas per call (${pct(f.gas.pct)}).`,
        C.gold,
      );
    } else if (f.status === 'escaped') {
      tell(`Accepted after ${r.tried} agreeing inputs, but wrong: it fails when ${f.when}, and no input tried that.`, `Accepted, but wrong when ${f.when}.`, C.ember);
    } else if (browsing) {
      tell(`${f.name} has not been through the pipeline yet.`, `${f.tpl.name}: not run yet.`);
    }
  }

  function verdictSpeech(f) {
    const r = f.rec;
    if (f.status === 'skipped') return `${f.name}: no pattern flagged, left as written.`;
    if (f.status === 'caught') return `${f.name}: rewrite rejected. Counterexample ${r.call}: original ${r.oa}, rewrite ${r.ob}.`;
    if (f.status === 'accepted') return `${f.name}: rewrite accepted after ${r.tried} inputs, saving ${f.gas.save} gas per call.`;
    return `${f.name}: rewrite accepted after ${r.tried} inputs, but it is wrong when ${f.when}.`;
  }

  function summary(all = false) {
    const s = { done: 0, acc: 0, caught: 0, esc: 0, saved: 0, tainted: 0, pctSum: 0, inputs: 0 };
    for (const f of fns) {
      if (all ? f.status === 'pending' || f.status === 'running' : !shown(f)) continue;
      s.done++;
      s.inputs += f.rec.tried;
      if (f.status === 'caught') s.caught++;
      else if (f.status === 'accepted' || f.status === 'escaped') {
        s.acc++;
        s.saved += f.gas.save;
        s.pctSum += f.gas.pct;
        if (f.status === 'escaped') {
          s.esc++;
          s.tainted += f.gas.save;
        }
      }
    }
    s.avg = s.acc ? s.pctSum / s.acc : 0;
    return s;
  }

  /* ---------------------------------------------------------------- */
  /* Panel                                                            */
  /* ---------------------------------------------------------------- */

  const about = section(panel, 'What you are seeing');
  para(
    about,
    'Each function goes through three steps. <strong>Static analysis</strong> flags a gas-wasteful pattern, an <strong>LLM</strong> proposes a cheaper rewrite, and a <strong>differential fuzzer</strong> runs the original and the rewrite on the same generated inputs. One disagreement in output, revert or storage rejects the rewrite; otherwise its gas saving is banked.',
  );
  para(
    about,
    'Changed lines are <em>amber</em>. Each fuzz input flows through both versions and lands as a tick (faint if both reverted), or as an ember cross when they diverge. Every block below is one function; the simulation knows which rewrites were wrong, so it can show the bugs that slip through.',
  );
  legend(about, [
    { color: C.gold, label: 'accepted / outputs agree' },
    { color: C.ember, label: 'bug caught by fuzzing', shape: 'ring' },
    { color: C.ember, label: 'bug escaped (accepted, wrong)' },
    { color: C.amber, label: 'flagged or rewritten line' },
    { color: INK[4], label: 'not flagged, no rewrite' },
  ]);

  const controls = section(panel, 'Run the pipeline');
  const buttons = actions(controls, [
    { id: 'run', label: 'Run pipeline ▸', primary: true, onClick: () => runAll() },
    { id: 'step', label: 'Step one function', onClick: () => stepOne() },
    {
      id: 'reseed',
      label: 'New corpus',
      onClick: () => {
        seed = (seed * 48271 + 11) % 2147483647;
        populate();
      },
    },
  ]);
  choice(controls, {
    label: 'Speed',
    options: [
      { value: 1, label: 'Watch' },
      { value: 8, label: 'Brisk' },
      { value: 0, label: 'Instant' },
    ],
    value: params.speed,
    onChange: (v) => (params.speed = v),
  });
  slider(controls, {
    label: 'Fuzz budget per function',
    min: 0,
    max: BUDGETS.length - 1,
    step: 1,
    value: params.bi,
    format: (i) => `${BUDGETS[i]} input${BUDGETS[i] === 1 ? '' : 's'}`,
    onInput: (i) => (params.bi = i),
  });
  slider(controls, {
    label: 'LLM rewrite accuracy',
    min: 0,
    max: 1,
    step: 0.05,
    value: params.accuracy,
    format: (v) => `${Math.round(v * 100)}%`,
    onInput: (v) => {
      params.accuracy = v;
      assign();
      tell(`Rewrites redrawn at ${Math.round(v * 100)}% accuracy. Run the pipeline to fuzz them.`, `Rewrites redrawn at ${Math.round(v * 100)}%.`);
    },
  });
  toggle(controls, { label: 'Boundary-biased inputs', value: params.edgy, onChange: (v) => (params.edgy = v) });

  const results = section(panel, 'Live readout');
  const out = readout(results, [
    { id: 'done', label: 'Functions processed' },
    { id: 'acc', label: 'Rewrites accepted' },
    { id: 'caught', label: 'Bugs caught by fuzzing' },
    { id: 'esc', label: 'Bugs escaped' },
    { id: 'gas', label: 'Gas saved (sim. units)' },
    { id: 'avg', label: 'Avg saving / accepted' },
  ]);
  para(
    results,
    'Try a budget of 5 with boundary inputs off, then on. Uniform inputs almost never hit 0, max or an exact balance, so a bigger budget alone rarely finds those bugs.',
    'sim-fine',
  );

  paper(panel, {
    lines: [
      'Combined static analysis, LLM rewrites, and differential fuzzing.',
      'The evaluation across <strong>59 contracts</strong> and <strong>527 functions</strong> reported <strong>56.6 million gas</strong> in cumulative savings and <strong>3.99%</strong> average execution savings.',
      'First author · IEEE COMPSAC 2026.',
    ],
    links: [{ label: 'IEEE · COMPSAC 2026', href: 'https://doi.org/10.1109/COMPSAC69091.2026.00126' }],
  });
  fine(
    panel,
    'The functions are short Solidity-like snippets run with exact 256-bit arithmetic and a simplified gas model; the LLM is a stand-in that writes a correct rewrite at the rate you set and a plausible wrong one otherwise. The numbers in the readout come from this simulation, not from the paper.',
  );
  const say = live(panel);

  function refresh() {
    const s = summary();
    out.set('done', `${s.done} / ${N}`);
    out.set('acc', s.done ? String(s.acc) : '—', s.acc ? 'ok' : '');
    out.set('caught', s.done ? String(s.caught) : '—', s.caught ? 'warn' : '');
    out.set('esc', s.done ? String(s.esc) : '—', s.esc ? 'bad' : s.done ? 'ok' : '');
    out.set('gas', s.acc ? fmt.int(s.saved) : '—', s.acc ? 'ok' : '');
    out.set('avg', s.acc ? pct(s.avg) : '—');
    const busy = !!(job || batch);
    const pending = fns.some((f) => f.status === 'pending');
    buttons.run.textContent = busy ? 'Running…' : pending ? 'Run pipeline ▸' : 'Run again ▸';
    buttons.run.disabled = busy;
    buttons.step.disabled = busy || !pending;
  }

  /* ---------------------------------------------------------------- */
  /* Canvas                                                           */
  /* ---------------------------------------------------------------- */

  const view = stageCanvas(stage, { onResize: layout });
  const { ctx } = view;
  const stat = status(stage);
  const tip = hint(stage, 'Click any function block to put it through the pipeline');
  const ptr = pointer(view.canvas, {
    down: (p) => {
      const i = blockAt(p.x, p.y);
      if (i >= 0) select(i);
    },
    move: (p) => {
      L.hover = blockAt(p.x, p.y);
      view.canvas.style.cursor = L.hover >= 0 && !job && !batch ? 'pointer' : '';
    },
    leave: () => {
      L.hover = -1;
      view.canvas.style.cursor = '';
    },
  });
  document.fonts?.ready.then(() => !dead && layout(view));

  function layout(v) {
    const w = v.w;
    const h = v.h;
    if (w < 80 || h < 80) return;
    const compact = w < 620 || h < 480;
    L.compact = compact;
    L.ready = true;
    const pad = compact ? 16 : Math.round(clamp(w * 0.036, 22, 40));
    L.x = pad;
    L.w = w - pad * 2;
    L.headY = compact ? 58 : 64;
    L.narrY = compact ? 82 : 98;
    L.em = textWidth(ctx, '0'.repeat(20), { size: 20 }) / 400 || 0.6;
    const top = compact ? 96 : 120;
    const bottom = h - (compact ? 34 : 44);

    // Corpus: 9 x 4 blocks with names when tall enough, otherwise 12 x 3.
    const meterW = compact ? 0 : Math.round(clamp(L.w * 0.27, 200, 290));
    const cw = compact ? L.w : L.w - meterW - 36;
    const tall = !compact && h >= 640;
    const cols = tall ? 9 : 12;
    const rows = Math.ceil(N / cols);
    const gap = compact ? 4 : 7;
    const bh = compact ? 18 : tall ? 30 : 24;
    const head = compact ? 24 : 26;
    const Hk = head + rows * bh + (rows - 1) * gap;
    const Hf = compact ? 80 : Math.round(clamp((bottom - top) * 0.25, 96, 140));
    let Hc = bottom - top - Hf - Hk - (compact ? 22 : 40);
    const cap = compact ? 30 + MAX_DIFF * 14 : 70 + MAX_LINES * 19;
    const extra = Math.max(0, Hc - cap);
    Hc -= extra;
    L.code = { y: top + extra * 0.2, h: Hc };
    L.fuzz = { x: pad, y: L.code.y + Hc + (compact ? 10 : 16) + extra * 0.4, w: L.w, h: Hf };
    L.corpus = { x: pad, y: L.fuzz.y + Hf + (compact ? 12 : 24) + extra * 0.4, w: cw, cols, rows, gap, bh, head, bw: (cw - (cols - 1) * gap) / cols };
    L.meter = compact ? null : { x: pad + cw + 36, y: L.corpus.y, w: meterW, h: Hk };
    L.names = !compact && L.corpus.bw >= textWidth(ctx, 'countAbove', { size: 9 }) + 12;

    // Code panes: two side by side, or one diff pane on small screens.
    if (compact) {
      const lh = clamp((Hc - 32) / MAX_DIFF, 9.5, 14);
      L.panes = [{ x: pad, w: L.w }];
      L.font = { lh, gut: 16, footer: false, size: Math.min(11, lh * 0.84, (L.w - 26) / (MAX_CHARS * L.em)) };
    } else {
      const gp = 30;
      const pw = (L.w - gp) / 2;
      const footer = Hc >= 30 + 26 + 12 + MAX_LINES * 14;
      const lh = clamp((Hc - 30 - 12 - (footer ? 26 : 0)) / MAX_LINES, 11, 19);
      L.panes = [
        { x: pad, w: pw },
        { x: pad + pw + gp, w: pw },
      ];
      L.font = { lh, gut: 30, footer, size: Math.min(12.5, lh * 0.74, (pw - 42) / (MAX_CHARS * L.em)) };
    }

    // Fuzzer geometry: source, fork to the two versions, comparison, result marks.
    const F = L.fuzz;
    const ix = F.x + (compact ? 12 : 18);
    const iw = F.w - (compact ? 24 : 36);
    const iy = F.y + (compact ? 10 : 14);
    const ih = F.h - (compact ? 10 : 14) - (compact ? 22 : 28);
    const src = compact ? 72 : clamp(iw * 0.17, 118, 160);
    const execW = compact ? 44 : clamp(iw * 0.17, 108, 168);
    const sx = ix + src + 8;
    const ex = sx + (compact ? 22 : clamp(iw * 0.07, 34, 70));
    const mx = ex + execW + (compact ? 22 : clamp(iw * 0.06, 30, 60));
    const cr = compact ? 9 : 12;
    const dy = compact ? 14 : clamp(ih * 0.25, 16, 24);
    const cy = iy + ih / 2;
    L.fz = { ix, iw, iy, ih, src, sx, ex, execW, mx, cr, cy, y1: cy - dy, y2: cy + dy, boxH: compact ? 16 : clamp(dy * 1.15, 18, 26), gx: mx + cr + (compact ? 14 : 24) };
    L.fz.gw = ix + iw - L.fz.gx;
    tip.set(compact ? 'Tap a block to test it' : 'Click any function block to put it through the pipeline');
  }

  function blockRect(i) {
    const K = L.corpus;
    const c = i % K.cols;
    const r = Math.floor(i / K.cols);
    return { x: K.x + c * (K.bw + K.gap), y: K.y + K.head + r * (K.bh + K.gap), w: K.bw, h: K.bh };
  }

  function blockAt(x, y) {
    if (!L.corpus) return -1;
    for (let i = 0; i < N; i++) {
      const b = blockRect(i);
      if (x >= b.x - 2 && x < b.x + b.w + 2 && y >= b.y - 2 && y < b.y + b.h + 2) return i;
    }
    return -1;
  }

  // What the stage shows for the current function at this moment.
  function scene() {
    const f = fns[cur];
    const j = job && job.f === f ? job : null;
    const ph = j ? j.phase : null;
    const settled = f.status !== 'pending' && f.status !== 'running';
    const scanned = ph === 'static' ? clamp(j.t / T_STATIC) : settled || ph ? 1 : 0;
    let typed = 0;
    if (f.flagged) {
      if (ph === 'llm') typed = clamp(j.t / T_LLM);
      else if (ph === 'fuzz' || ph === 'verdict' || (settled && !ph)) typed = 1;
    }
    const truth = (f.status === 'caught' || f.status === 'escaped') && (!ph || (ph === 'verdict' && (f.status === 'caught' || j.truth)));
    return { f, j, ph, settled, scanned, typed, truth };
  }

  /* ---- header, rail and narration ---- */

  function drawHeader(S) {
    const { f } = S;
    const y = L.headY;
    const o = { size: L.compact ? 10 : 11, upper: true, track: L.compact ? 1.2 : 1.6, color: C.gold };
    const tag = L.compact ? `${pad2(cur + 1)}/${N}` : `Function ${pad2(cur + 1)} / ${N}`;
    label(ctx, tag, L.x, y, o);
    const tw = textWidth(ctx, tag.toUpperCase(), o) + o.track * tag.length;
    label(ctx, f.name, L.x + tw + 10, y, { size: L.compact ? 11 : 12.5, color: C.cream });
    drawRail(S, L.x + L.w, y);
  }

  function railStates(S) {
    const { f, ph } = S;
    const st = ['idle', 'idle', 'idle', 'idle'];
    if (ph) {
      const k = PHASES.indexOf(ph);
      for (let i = 0; i < k; i++) st[i] = 'done';
      st[k] = ph === 'verdict' ? (f.status === 'escaped' && !S.truth ? 'accepted' : f.status) : 'active';
    } else if (S.settled) {
      st.fill('done');
      st[3] = f.status;
    }
    if (f.status === 'skipped') {
      st[1] = 'skip';
      st[2] = 'skip';
    }
    return st;
  }

  function railColor(s) {
    if (s === 'active') return C.amber;
    if (s === 'done' || s === 'accepted') return C.gold;
    if (s === 'caught' || s === 'escaped') return C.ember;
    return INK[4];
  }

  function drawRail(S, right, y) {
    const st = railStates(S);
    const names = ['Static', 'Rewrite', 'Fuzz', 'Verdict'];
    const o = { size: L.compact ? 9 : 10, upper: true, track: 1.2 };
    const node = (x, s) => {
      const col = railColor(s);
      if (s === 'active') glow(ctx, x, y - 3.5, 13, C.amber, reduced ? 0.4 : 0.35 + 0.15 * Math.sin(now * 6));
      if (s === 'caught') dot(ctx, x, y - 3.5, 3.6, alpha(C.midnight, 0.9), col, 1.5);
      else if (s === 'idle' || s === 'skip') dot(ctx, x, y - 3.5, 3.2, null, col, 1.1);
      else dot(ctx, x, y - 3.5, 3.6, col);
    };
    if (L.compact) {
      // Dots only, with the active step (or the verdict) named to their left.
      const step = 13;
      const x0 = right - step * 3 - 4;
      for (let i = 0; i < 3; i++) line(ctx, x0 + i * step + 5, y - 3.5, x0 + (i + 1) * step - 5, y - 3.5, INK.line, 1);
      st.forEach((s, i) => node(x0 + i * step, s));
      const k = st.findIndex((s) => s === 'active');
      const v = st[3];
      const text = k >= 0 ? ['scanning', 'rewriting', 'fuzzing', ''][k] : { accepted: 'accepted', caught: 'rejected', escaped: 'bug escaped', skipped: 'not flagged' }[v] || '';
      if (text) label(ctx, text, x0 - 12, y, { ...o, align: 'right', color: k >= 0 ? C.amber : railColor(v) });
      return;
    }
    const widths = names.map((n) => textWidth(ctx, n.toUpperCase(), o) + o.track * n.length);
    const total = widths.reduce((a, b) => a + b, 0) + names.length * 13 + (names.length - 1) * 22;
    let x = right - total;
    names.forEach((n, i) => {
      const s = st[i];
      node(x + 4, s);
      label(ctx, n, x + 13, y, { ...o, color: s === 'active' ? C.amber : s === 'idle' || s === 'skip' ? INK[4] : s === 'done' ? INK[2] : railColor(s) });
      x += 13 + widths[i];
      if (i < names.length - 1) {
        line(ctx, x + 6, y - 3.5, x + 16, y - 3.5, INK.line, 1);
        x += 22;
      }
    });
  }

  function drawNarration() {
    const text = L.compact ? narration.short : narration.full;
    labelFit(ctx, text, L.x, L.narrY, L.w, { size: L.compact ? 15 : 19, minSize: L.compact ? 10.5 : 12, font: 'serif', italic: true, color: narration.tone });
  }

  /* ---- code ---- */

  function paneFrame(P, title, right, rightColor) {
    const y = L.code.y;
    roundRect(ctx, P.x, y, P.w, L.code.h, 12);
    ctx.fillStyle = alpha(C.midnight, 0.55);
    ctx.fill();
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = 1;
    ctx.stroke();
    const hy = y + (L.compact ? 13 : 16);
    label(ctx, title, P.x + 14, hy, { size: L.compact ? 9 : 10, upper: true, track: 1.4, baseline: 'middle', color: INK[3] });
    if (right) {
      const tw = textWidth(ctx, title.toUpperCase(), { size: L.compact ? 9 : 10 }) + title.length * 1.4;
      labelFit(ctx, right, P.x + P.w - 14, hy, P.w - tw - 44, { size: L.compact ? 9.5 : 10.5, minSize: 8.5, align: 'right', baseline: 'middle', color: rightColor });
    }
    line(ctx, P.x + 1, y + (L.compact ? 25 : 31), P.x + P.w - 1, y + (L.compact ? 25 : 31), INK.faint);
  }

  function rowsTop() {
    return L.code.y + (L.compact ? 25 : 31) + (L.compact ? 5 : 8);
  }

  // One row of code. o: { mark, band, num, gut, color, chars, strike, caret }
  function codeRow(P, cy, s, o) {
    const { lh, size, gut } = L.font;
    if (o.band) {
      ctx.fillStyle = o.band;
      ctx.fillRect(P.x + 1, cy - lh / 2, P.w - 2, lh);
    }
    if (o.mark) {
      ctx.fillStyle = o.mark;
      ctx.fillRect(P.x + 1, cy - lh / 2, 2, lh);
    }
    if (o.num != null) label(ctx, String(o.num), P.x + 20, cy, { size: Math.min(9.5, size - 1), align: 'right', baseline: 'middle', color: INK[4] });
    if (o.gut) label(ctx, o.gut, P.x + 9, cy, { size, align: 'center', baseline: 'middle', color: o.gutColor || INK[4] });
    const text = o.chars != null ? s.slice(0, o.chars) : s;
    label(ctx, text, P.x + gut, cy, { size, baseline: 'middle', color: o.color || INK[2] });
    if (o.strike) {
      const tw = textWidth(ctx, s.trimEnd(), { size }) * o.strike;
      const lead = textWidth(ctx, s.match(/^ */)[0], { size });
      line(ctx, P.x + gut + lead, cy + 0.5, P.x + gut + Math.max(lead, tw), cy + 0.5, alpha(C.cream, 0.42), 1);
    }
    if (o.caret) {
      const tw = textWidth(ctx, text, { size });
      ctx.fillStyle = C.amber;
      ctx.fillRect(P.x + gut + tw + 1, cy - size * 0.5, 1.4, size);
    }
  }

  function clipPane(P) {
    ctx.save();
    roundRect(ctx, P.x, L.code.y, P.w, L.code.h, 12);
    ctx.clip();
  }

  function footerText(P, text, color) {
    if (!L.font.footer || !text) return;
    labelFit(ctx, text, P.x + 14, L.code.y + L.code.h - 14, P.w - 28, { size: 10.5, minSize: 9, baseline: 'middle', color });
  }

  function verdictLine(S) {
    const { f } = S;
    if (f.status === 'accepted') return [`Accepted · −${fmt.int(f.gas.save)} gas per call (${pct(f.gas.pct)})`, C.gold];
    if (f.status === 'caught') return [`Rejected · fails when ${f.when}`, C.ember];
    if (f.status === 'escaped') return S.truth ? [`Accepted, but wrong · fails when ${f.when}`, C.ember] : [`Accepted · −${fmt.int(f.gas.save)} gas per call (${pct(f.gas.pct)})`, C.gold];
    return null;
  }

  function drawCode(S) {
    if (L.compact) return drawDiff(S);
    const { f, ph, scanned, typed, truth } = S;
    const [P0, P1] = L.panes;
    const { lh } = L.font;
    const y0 = rowsTop() + lh / 2;
    const flags = new Set(f.flagged ? f.tpl.flag : []);
    const lines0 = f.code.orig;

    // Original, with the static-analysis sweep and its findings.
    paneFrame(P0, 'Original', `${fmt.int(f.gas.orig)} gas`, INK[3]);
    clipPane(P0);
    lines0.forEach((s, i) => {
      const lit = flags.has(i) && scanned * lines0.length > i + 0.5;
      codeRow(P0, y0 + i * lh, s, { num: i + 1, band: lit ? alpha(C.amber, 0.07) : null, mark: lit ? C.amber : null, color: lit ? C.cream : INK[2] });
    });
    if (ph === 'static') {
      const sy = y0 - lh / 2 + scanned * lines0.length * lh;
      line(ctx, P0.x + 1, sy, P0.x + P0.w - 1, sy, alpha(C.amber, 0.8), 1.2);
      glow(ctx, P0.x + P0.w * (0.2 + 0.6 * scanned), sy, 34, C.amber, 0.25);
    }
    ctx.restore();
    const scanning = ph === 'static' && scanned < 1;
    footerText(
      P0,
      f.status === 'pending' && !ph ? '' : scanning ? 'Static analysis · scanning…' : f.flagged ? `Static analysis · ${f.tpl.find[0]}` : 'Static analysis · no gas-wasteful pattern found',
      scanning || !f.flagged ? INK[3] : C.amber,
    );

    // The LLM's rewrite: changed lines amber; the wrong line ember once the truth is out.
    const v = verdictLine(S);
    const rightText = typed >= 1 ? `${fmt.int(f.gas.rew)} gas · −${pct(f.gas.pct)}` : '';
    const rightColor = v ? (v[1] === C.ember && f.status === 'caught' ? INK[4] : v[1]) : C.amber;
    paneFrame(P1, 'LLM rewrite', rightText, rightColor);
    if (typed > 0) {
      clipPane(P1);
      const rows = f.rew;
      rows.forEach((s, i) => {
        const start = (i / rows.length) * 0.8;
        const p = clamp((typed - start) / 0.2);
        if (p <= 0) return;
        const changed = f.added.has(i);
        const bug = truth && i === f.bugLine;
        const color = bug ? C.ember : changed ? C.amber : INK[2];
        const chars = changed && p < 1 ? Math.floor(s.length * p) : null;
        codeRow(P1, y0 + i * lh, s, {
          num: i + 1,
          band: bug ? alpha(C.ember, 0.1) : changed ? alpha(C.amber, 0.07) : null,
          mark: bug ? C.ember : changed ? C.amber : null,
          color: chars == null && !changed ? alpha(C.cream, 0.74 * p) : color,
          chars,
          caret: chars != null,
        });
      });
      ctx.restore();
    } else {
      const text = f.status === 'skipped' ? 'nothing flagged · no rewrite' : ph === 'static' ? 'waiting for findings' : 'awaiting static analysis';
      label(ctx, text, P1.x + P1.w / 2, L.code.y + L.code.h / 2 + 4, { size: 10, upper: true, track: 1.4, align: 'center', baseline: 'middle', color: INK[4] });
    }
    if (ph === 'llm' || (typed >= 1 && !v)) footerText(P1, `LLM · ${f.idea[0]}`, ph === 'llm' ? C.amber : INK[3]);
    else if (v) footerText(P1, v[0], v[1]);

    // The hand-off between the panes.
    const ay = L.code.y + L.code.h / 2;
    const ac = ph === 'llm' ? C.amber : typed >= 1 ? alpha(C.gold, 0.6) : INK[4];
    line(ctx, P0.x + P0.w + 7, ay, P1.x - 9, ay, ac, 1.2);
    ctx.beginPath();
    ctx.moveTo(P1.x - 6, ay);
    ctx.lineTo(P1.x - 11, ay - 3.5);
    ctx.lineTo(P1.x - 11, ay + 3.5);
    ctx.closePath();
    ctx.fillStyle = ac;
    ctx.fill();
    if (ph === 'llm') glow(ctx, P0.x + P0.w + 15, ay, 18, C.amber, 0.4);
  }

  // Compact: one unified diff, original lines struck, rewrite lines amber.
  function drawDiff(S) {
    const { f, ph, scanned, typed, truth } = S;
    const P = L.panes[0];
    const { lh } = L.font;
    const flags = new Set(f.flagged ? f.tpl.flag : []);
    const v = verdictLine(S);
    let right = `${fmt.int(f.gas.orig)} gas`;
    let rc = INK[3];
    if (v) [right, rc] = [{ accepted: `accepted −${fmt.int(f.gas.save)} gas`, caught: 'rejected', escaped: S.truth ? 'bug escaped' : `accepted −${fmt.int(f.gas.save)} gas` }[f.status], v[1]];
    else if (typed >= 1) [right, rc] = [`−${fmt.int(f.gas.save)} gas (${pct(f.gas.pct)})`, C.amber];
    else if (f.status === 'skipped') [right, rc] = ['not flagged', INK[3]];
    paneFrame(P, typed > 0 ? 'Diff' : 'Original', right, rc);
    clipPane(P);
    let y = rowsTop();
    const rows = typed > 0 ? f.ops : f.code.orig.map((s, i) => ({ t: ' ', s, a: i }));
    rows.forEach((o, k) => {
      const lit = o.a != null && flags.has(o.a) && scanned * f.code.orig.length > o.a + 0.5;
      if (o.t === '+') {
        const start = (k / rows.length) * 0.75;
        const p = clamp((typed - start) / 0.25);
        const hgt = lh * easeOut(Math.min(1, p * 2));
        if (hgt < 0.5) return;
        const bug = truth && o.b === f.bugLine;
        const chars = p < 1 ? Math.floor(o.s.length * p) : null;
        codeRow(P, y + hgt / 2, o.s, {
          gut: '+',
          gutColor: bug ? C.ember : C.amber,
          band: bug ? alpha(C.ember, 0.12) : alpha(C.amber, 0.08),
          mark: bug ? C.ember : C.amber,
          color: bug ? C.ember : C.amber,
          chars,
          caret: chars != null,
        });
        y += hgt;
        return;
      }
      const removed = o.t === '-';
      codeRow(P, y + lh / 2, o.s, {
        gut: removed ? '−' : null,
        mark: lit ? C.amber : null,
        band: lit ? alpha(C.amber, 0.06) : null,
        color: removed ? INK[4] : lit ? C.cream : INK[2],
        strike: removed ? clamp(typed * 2) : 0,
      });
      y += lh;
    });
    if (ph === 'static') {
      const sy = rowsTop() + scanned * f.code.orig.length * lh;
      line(ctx, P.x + 1, sy, P.x + P.w - 1, sy, alpha(C.amber, 0.8), 1.2);
    }
    ctx.restore();
  }

  /* ---- fuzzer ---- */

  function drawFuzz(S) {
    const { f, j } = S;
    const F = L.fuzz;
    const Z = L.fz;
    roundRect(ctx, F.x, F.y, F.w, F.h, 14);
    ctx.fillStyle = alpha(C.midnight, 0.4);
    ctx.fill();
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = 1;
    ctx.stroke();

    const fuzzing = j && (j.phase === 'fuzz' || j.phase === 'verdict') && j.z ? j : null;
    const rec = !fuzzing && S.settled ? f.rec : null;
    const skipped = f.status === 'skipped' && (!j || j.phase === 'verdict');
    const B = fuzzing ? fuzzing.z.budget : rec && rec.budget ? rec.budget : budget();
    const edgy = fuzzing ? fuzzing.z.edgy : rec && rec.budget ? rec.edgy : params.edgy;
    const landed = fuzzing ? fuzzing.landed : rec ? rec.tried : 0;
    const spawned = fuzzing ? fuzzing.spawned : landed;
    const marks = fuzzing ? fuzzing.z.marks : rec ? rec.marks : null;
    const cexAt = fuzzing ? fuzzing.z.cex : rec ? rec.cex : 0;
    const diverged = cexAt > 0 && landed >= cexAt;
    const io = fuzzing && landed ? fuzzing.z.io[landed - 1] : null;
    const latest = fuzzing && spawned ? fuzzing.z.io[spawned - 1] : null;

    // Source: the counter, the strategy and the input just generated.
    const { ix, iy, ih, src } = Z;
    if (L.compact) {
      label(ctx, 'Fuzzer', ix, iy + 9, { size: 9, upper: true, track: 1.2, color: INK[3] });
      label(ctx, skipped ? '—' : `${spawned}/${B}`, ix, iy + 28, { size: 13, color: C.cream });
      label(ctx, edgy ? 'boundary' : 'uniform', ix, iy + 44, { size: 9, upper: true, track: 1, color: edgy ? C.amber : INK[3] });
    } else {
      const big = ih >= 84;
      let y = iy + (big ? 10 : 6);
      if (big) {
        label(ctx, 'Fuzzer', ix, y, { size: 10, upper: true, track: 1.4, color: INK[3] });
        y += 24;
      } else y += 12;
      label(ctx, skipped ? '—' : `${spawned} / ${B}`, ix, y, { size: big ? 17 : 15, color: C.cream });
      y += big ? 19 : 17;
      label(ctx, edgy ? 'boundary-biased' : 'uniform inputs', ix, y, { size: 10, upper: true, track: 1, color: edgy ? C.amber : INK[3] });
      y += big ? 19 : 16;
      const inputText = latest ? callText(f, latest[0]) : rec && rec.call ? rec.call : '';
      if (inputText) labelFit(ctx, inputText.replace(`${f.tpl.name}(`, '('), ix, y, src, { size: 10, minSize: 8, color: INK[2] });
    }

    // Rails: one input forks into both versions and meets again at the comparison.
    const { sx, ex, execW, mx, cr, cy, y1, y2, boxH } = Z;
    ctx.strokeStyle = INK.line;
    ctx.lineWidth = 1;
    for (const y of [y1, y2]) {
      ctx.beginPath();
      ctx.moveTo(sx, cy);
      ctx.quadraticCurveTo(sx + (ex - sx) * 0.55, y, ex, y);
      ctx.lineTo(ex + execW, y);
      ctx.quadraticCurveTo(ex + execW + (mx - cr - ex - execW) * 0.45, y, mx - cr, cy);
      ctx.stroke();
    }
    line(ctx, Z.ix + src - (L.compact ? 6 : 0), cy, sx, cy, INK.line, 1);

    // The two versions, with what each returned on the latest input.
    const outs = io ? [outText(f, io[0], io[1], io[2]), outText(f, io[0], io[2], io[1])] : rec && rec.oa ? [rec.oa, rec.ob] : ['', ''];
    const differ = io ? !agree(io[1], io[2]) : diverged;
    [
      [y1, L.compact ? 'orig' : 'original', outs[0], C.cream],
      [y2, L.compact ? 'new' : 'rewrite', outs[1], differ ? C.ember : outs[1] ? C.gold : C.cream],
    ].forEach(([y, name, o, col]) => {
      roundRect(ctx, ex, y - boxH / 2, execW, boxH, 7);
      ctx.fillStyle = alpha(C.midnight, 0.92);
      ctx.fill();
      ctx.strokeStyle = INK.line;
      ctx.lineWidth = 1;
      ctx.stroke();
      if (L.compact) label(ctx, name, ex + execW / 2, y + 0.5, { size: 9, align: 'center', baseline: 'middle', color: INK[3] });
      else {
        label(ctx, name, ex + 10, y + 0.5, { size: 9.5, baseline: 'middle', color: INK[3] });
        if (o) labelFit(ctx, o, ex + execW - 9, y + 0.5, execW - 62, { size: 11, minSize: 8, align: 'right', baseline: 'middle', color: col });
      }
    });

    // Comparison node.
    const flash = fuzzing ? clamp(1 - (now - fuzzing.landT) / 0.35) : 0;
    if (flash > 0 && !diverged) glow(ctx, mx, cy, cr * 2.6, C.gold, 0.45 * flash);
    if (diverged) glow(ctx, mx, cy, cr * 3, C.ember, 0.4);
    dot(ctx, mx, cy, cr, alpha(C.midnight, 0.92), diverged ? C.ember : landed ? C.gold : INK[3], 1.4);
    const eqc = diverged ? C.ember : landed ? C.gold : INK[3];
    const ew = cr * 0.45;
    line(ctx, mx - ew, cy - 2.2, mx + ew, cy - 2.2, eqc, 1.3);
    line(ctx, mx - ew, cy + 2.2, mx + ew, cy + 2.2, eqc, 1.3);
    if (diverged) line(ctx, mx + ew * 0.7, cy - ew * 1.2, mx - ew * 0.7, cy + ew * 1.2, eqc, 1.3);
    line(ctx, mx + cr, cy, Z.gx - 6, cy, INK.line, 1);

    drawMarks(B, marks, landed, skipped);
    if (fuzzing && fuzzing.phase === 'fuzz') drawParticles(fuzzing);

    // Bottom strip: what the comparison means, or what it found.
    const sy = F.y + F.h - (L.compact ? 11 : 14);
    let text = L.compact ? 'outputs, reverts and storage must match' : 'Each input runs through both versions; return values, reverts and storage must all match.';
    let col = INK[3];
    if (skipped) text = L.compact ? 'not flagged · nothing to fuzz' : 'Not flagged by static analysis · nothing to fuzz.';
    else if (diverged) {
      const r = rec || { call: callText(f, io[0]), oa: outs[0], ob: outs[1] };
      text = L.compact ? `${r.call}: ${r.oa} vs ${r.ob}` : `Counterexample at input ${cexAt} · ${r.call} · original ${r.oa}, rewrite ${r.ob}`;
      col = C.ember;
    } else if (S.settled && (!j || j.phase === 'verdict') && f.rec?.tried) {
      if (f.status === 'escaped' && S.truth) {
        text = L.compact ? `${f.rec.tried} agreed · wrong when ${f.when}` : `No counterexample in ${f.rec.tried} inputs · accepted, but it fails when ${f.when}`;
        col = C.ember;
      } else {
        text = L.compact ? `${f.rec.tried} inputs agreed · accepted` : `No counterexample in ${f.rec.tried} inputs · rewrite accepted`;
        col = C.gold;
      }
    }
    labelFit(ctx, text, Z.ix, sy, Z.iw, { size: L.compact ? 9.5 : 10.5, minSize: 8, baseline: 'middle', color: col });
  }

  // Result grid: one slot per input in the budget; ticks agree, crosses diverge.
  function drawMarks(B, marks, landed, skipped) {
    const Z = L.fz;
    const gh = Z.ih;
    const gw = Z.gw;
    let c = Math.min(L.compact ? 14 : 20, Math.sqrt((gw * gh) / Math.max(1, B)));
    let cols = Math.max(1, Math.floor(gw / c));
    while (Math.ceil(B / cols) * c > gh && c > 2) {
      c -= 0.25;
      cols = Math.max(1, Math.floor(gw / c));
    }
    const rows = Math.ceil(B / cols);
    const gx = Z.gx;
    const gy = Z.iy + (gh - rows * c) / 2;
    const at = (k) => [gx + ((k % cols) + 0.5) * c, gy + (Math.floor(k / cols) + 0.5) * c];
    const half = c * 0.28;
    if (skipped) {
      label(ctx, 'not fuzzed', gx, Z.cy, { size: 10, upper: true, track: 1.2, baseline: 'middle', color: INK[4] });
      return;
    }
    const paths = [new Path2D(), new Path2D(), new Path2D()];
    let cross = -1;
    for (let k = 0; k < B; k++) {
      const [x, y] = at(k);
      if (!marks || k >= landed) {
        paths[2].moveTo(x + 0.9, y);
        paths[2].arc(x, y, Math.max(0.7, c * 0.06), 0, Math.PI * 2);
      } else if (marks[k] === 2) cross = k;
      else {
        paths[marks[k]].moveTo(x, y - half);
        paths[marks[k]].lineTo(x, y + half);
      }
    }
    ctx.lineWidth = c >= 12 ? 1.6 : 1.2;
    ctx.strokeStyle = alpha(C.gold, 0.9);
    ctx.stroke(paths[0]);
    ctx.strokeStyle = alpha(C.gold, 0.32);
    ctx.stroke(paths[1]);
    ctx.fillStyle = alpha(C.cream, 0.14);
    ctx.fill(paths[2]);
    if (cross >= 0) {
      const [x, y] = at(cross);
      const s = Math.max(2.6, c * 0.3);
      glow(ctx, x, y, Math.max(12, c * 1.4), C.ember, 0.6);
      line(ctx, x - s, y - s, x + s, y + s, C.ember, 1.6);
      line(ctx, x - s, y + s, x + s, y - s, C.ember, 1.6);
    }
  }

  // Inputs in flight: fork, run through both versions, meet at the comparison.
  function drawParticles(j) {
    const Z = L.fz;
    const { sx, ex, execW, mx, cr, cy, y1, y2 } = Z;
    const first = j.landed;
    const n = j.spawned - first;
    const every = Math.max(1, Math.ceil(n / (L.compact ? 24 : 48)));
    for (let k = first; k < j.spawned; k += every) {
      const u = (j.t - k / j.rate) / T_FLY;
      if (u < 0 || u >= 1) continue;
      const io = j.z.io[k];
      const differ = io && !agree(io[1], io[2]);
      [y1, y2].forEach((y, side) => {
        let x;
        let yy;
        if (u < 0.38) [x, yy] = quadAt(sx, cy, sx + (ex - sx) * 0.55, y, ex, y, easeInOut(u / 0.38));
        else if (u < 0.62) [x, yy] = [ex + ((u - 0.38) / 0.24) * execW, y];
        else [x, yy] = quadAt(ex + execW, y, ex + execW + (mx - cr - ex - execW) * 0.45, y, mx - cr, cy, (u - 0.62) / 0.38);
        const after = u >= 0.62;
        const col = after ? (differ && side === 1 ? C.ember : C.gold) : C.amber;
        glow(ctx, x, yy, L.compact ? 7 : 9, col, 0.55);
        dot(ctx, x, yy, 1.6, C.cream);
      });
    }
  }

  /* ---- corpus and gas meter ---- */

  function blockLook(f, time) {
    if (!shown(f)) return f.status === 'running' || (job && job.f === f) ? 'running' : 'pending';
    if (f.status === 'escaped' && job && job.f === f && !job.truth) return 'accepted';
    return f.status;
  }

  function drawCorpus(time) {
    const K = L.corpus;
    const s = summary();
    const hy = K.y + 10;
    label(ctx, L.compact ? `Corpus · ${N} functions` : `Corpus · ${N} functions · ${contracts} contracts`, K.x, hy, {
      size: L.compact ? 10 : 11,
      upper: true,
      track: L.compact ? 1.2 : 1.6,
      color: C.gold,
    });
    if (L.compact) {
      const t = s.acc ? `saved ${fmt.int(meterShown)} gas · avg ${pct(s.avg)}` : 'gas saved · —';
      labelFit(ctx, t, K.x + K.w, hy, K.w * 0.5, { size: 9.5, minSize: 8, align: 'right', upper: true, track: 0.6, color: s.acc ? C.gold : INK[3] });
      meterBar(K.x, K.y + 16, K.w, 2.5, s);
    } else if (L.hover >= 0) {
      const f = fns[L.hover];
      const look = blockLook(f, time);
      const t = {
        pending: 'not run yet',
        running: 'in the pipeline',
        skipped: 'not flagged',
        accepted: `accepted · −${fmt.int(f.gas.save)} gas (${pct(f.gas.pct)})`,
        caught: `caught at input ${f.rec?.cex}`,
        escaped: `escaped · wrong when ${f.when}`,
      }[look];
      const w0 = textWidth(ctx, `Corpus · ${N} functions · ${contracts} contracts`.toUpperCase(), { size: 11 }) + 60;
      labelFit(ctx, `${f.name} · ${t}`, K.x + K.w, hy, K.w - w0, { size: 10.5, minSize: 8.5, align: 'right', color: look === 'caught' || look === 'escaped' ? C.ember : look === 'accepted' ? C.gold : INK[2] });
    }
    for (let i = 0; i < N; i++) drawBlock(fns[i], blockRect(i), time);
  }

  function drawBlock(f, b, time) {
    const look = blockLook(f, time);
    const r = L.compact ? 4 : 6;
    if (f.i === cur) {
      roundRect(ctx, b.x - 3, b.y - 3, b.w + 6, b.h + 6, r + 3);
      ctx.strokeStyle = alpha(C.cream, 0.45);
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    roundRect(ctx, b.x, b.y, b.w, b.h, r);
    let text = INK[3];
    if (look === 'accepted' || look === 'escaped') {
      ctx.fillStyle = look === 'accepted' ? alpha(C.gold, 0.88) : alpha(C.ember, 0.9);
      ctx.fill();
      text = C.midnight;
    } else if (look === 'caught') {
      ctx.fillStyle = alpha(C.ember, 0.08);
      ctx.fill();
      ctx.strokeStyle = C.ember;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      text = C.ember;
    } else if (look === 'running') {
      glow(ctx, b.x + b.w / 2, b.y + b.h / 2, b.w * 0.75, C.amber, reduced ? 0.3 : 0.25 + 0.12 * Math.sin(time * 7));
      ctx.fillStyle = alpha(C.amber, 0.14);
      ctx.fill();
      ctx.strokeStyle = C.amber;
      ctx.lineWidth = 1.4;
      ctx.stroke();
      text = C.amber;
    } else if (look === 'skipped') {
      ctx.fillStyle = INK.faint;
      ctx.fill();
      text = INK[4];
    } else {
      ctx.strokeStyle = L.hover === f.i && !job && !batch ? INK[3] : INK.line;
      ctx.lineWidth = 1;
      ctx.stroke();
    }
    if (look === 'escaped') {
      // The mark of a wrong rewrite that shipped.
      const mx = b.x + b.w - (L.compact ? 6 : 9);
      const my = b.y + b.h / 2;
      line(ctx, mx, my - b.h * 0.24, mx, my + b.h * 0.08, C.midnight, 1.6);
      dot(ctx, mx, my + b.h * 0.22, 1.1, C.midnight);
    }
    if (L.names) label(ctx, f.tpl.name, b.x + 8, b.y + b.h / 2 + 0.5, { size: 9, baseline: 'middle', color: text });
  }

  function meterBar(x, y, w, h, s) {
    roundRect(ctx, x, y, w, h, h / 2);
    ctx.fillStyle = INK.faint;
    ctx.fill();
    if (!potential) return;
    const good = (w * Math.min(potential, s.saved - s.tainted)) / potential;
    const bad = (w * s.tainted) / potential;
    if (good > 0.5) {
      roundRect(ctx, x, y, Math.min(w, good), h, h / 2);
      ctx.fillStyle = C.gold;
      ctx.fill();
    }
    if (bad > 0.5) {
      roundRect(ctx, x + Math.min(w, good), y, Math.min(bad, w - good), h, h / 2);
      ctx.fillStyle = C.ember;
      ctx.fill();
    }
  }

  function drawMeter() {
    const M = L.meter;
    const s = summary();
    label(ctx, 'Gas saved · simulated', M.x, M.y + 10, { size: 11, upper: true, track: 1.6, color: C.gold });
    const big = M.h >= 140 ? 38 : 30;
    const ny = M.y + 26 + big * 0.8;
    label(ctx, fmt.int(meterShown), M.x, ny, { size: big, font: 'serif', color: s.acc ? C.gold : INK[3] });
    const nw = textWidth(ctx, fmt.int(meterShown), { size: big, font: 'serif' });
    label(ctx, 'gas per call', M.x + nw + 8, ny, { size: 10, upper: true, track: 1, color: INK[3] });
    const by = ny + 14;
    meterBar(M.x, by, M.w, 5, s);
    label(ctx, `of ${fmt.int(potential)} possible`, M.x, by + 22, { size: 10, color: INK[3] });
    if (s.acc) label(ctx, `avg ${pct(s.avg)} / fn`, M.x + M.w, by + 22, { size: 10, align: 'right', color: C.gold });
    if (s.tainted && by + 40 < M.y + M.h + 6) {
      labelFit(ctx, `${fmt.int(s.tainted)} of it from wrong rewrites`, M.x, by + 40, M.w, { size: 10, minSize: 8.5, color: C.ember });
    }
  }

  /* ---- effects ---- */

  function verdictFx(f) {
    const Z = L.fz;
    const b = blockRect(f.i);
    if (f.status === 'caught') fx.push({ kind: 'burst', x: Z.mx, y: Z.cy, t0: now, dur: 0.9, color: C.ember });
    else fx.push({ kind: 'spark', x0: Z.mx, y0: Z.cy, x1: b.x + b.w / 2, y1: b.y + b.h / 2, t0: now, dur: 0.75, color: C.gold });
  }

  function drawFx() {
    fx = fx.filter((e) => now - e.t0 < e.dur);
    for (const e of fx) {
      const u = (now - e.t0) / e.dur;
      if (e.kind === 'burst') {
        glow(ctx, e.x, e.y, 14 + 34 * u, e.color, 0.55 * (1 - u));
        dot(ctx, e.x, e.y, 8 + 26 * easeOut(u), null, alpha(e.color, 0.7 * (1 - u)), 1.2);
      } else {
        const [x, y] = quadAt(e.x0, e.y0, (e.x0 + e.x1) / 2, Math.min(e.y0, e.y1) - 30, e.x1, e.y1, easeInOut(u));
        glow(ctx, x, y, 14, e.color, 0.7 * (1 - u * 0.5));
        dot(ctx, x, y, 2, C.cream);
      }
    }
  }

  /* ---------------------------------------------------------------- */
  /* Frame                                                            */
  /* ---------------------------------------------------------------- */

  const tick = loop((dt, time) => {
    now = time;
    if (!L.ready) layout(view);
    if (!L.ready) return;
    if (params.speed === 0) {
      if (job) finishJob();
      if (batch) instantSlice();
    } else {
      if (batch && !job) nextJob();
      if (job) stepJob(dt * params.speed);
    }
    const s = summary();
    meterShown = reduced || params.speed === 0 ? s.saved : meterShown + (s.saved - meterShown) * Math.min(1, dt * 7);
    if (Math.abs(s.saved - meterShown) < 1) meterShown = s.saved;
    if (fns.some((f) => f.flipAt != null && f.flipAt > now - 0.1)) refresh();

    view.clear();
    const S = scene();
    drawHeader(S);
    drawNarration();
    drawCode(S);
    drawFuzz(S);
    drawCorpus(time);
    if (!L.compact) drawMeter();
    drawFx();
    const inputs = s.inputs + (job && job.z ? job.spawned : 0);
    stat.set(
      L.compact
        ? `${s.done}/${N} · ${fmt.int(inputs)} inputs · seed ${seed}`
        : `seed ${seed} · ${s.done}/${N} functions · ${fmt.int(inputs)} fuzz inputs · budget ${budget()} · ${params.edgy ? 'boundary-biased' : 'uniform'}`,
    );
  });

  populate();

  return {
    start: () => tick.start(),
    stop: () => tick.stop(),
    destroy() {
      dead = true;
      tick.stop();
      ptr.destroy();
      view.destroy();
    },
  };
}
