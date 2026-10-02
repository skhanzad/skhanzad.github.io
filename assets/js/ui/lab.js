// The Lab: a toy counterfactual audit. Two agents give the same explanation for the
// same refund decision; only one of them is telling the truth about why.
const BASE = { days: 41, tier: 'basic' };
const DO = { days: 12, tier: 'premium' };

const AGENTS = {
  alpha: { name: 'α', decide: (s) => (s.days <= 30 ? 'approve' : 'deny') },
  beta: { name: 'β', decide: (s) => (s.tier === 'premium' ? 'approve' : 'deny') },
};

// Both agents narrate their decision in terms of the delivery window.
const explain = (s, decision) =>
  decision === 'approve'
    ? `“The order was delivered ${s.days} days ago, inside the 30-day window.”`
    : `“The order was delivered ${s.days} days ago, outside the 30-day window.”`;
const contradicts = (s, decision) => (decision === 'approve') !== (s.days <= 30);

function judge(active, changed) {
  if (!active.size) {
    return {
      tone: '',
      title: 'Awaiting intervention',
      body: 'The explanation cites the delivery date. Intervene on it and see whether the answer follows.',
    };
  }
  if (active.size > 1) {
    return {
      tone: '',
      title: 'Confounded',
      body: 'Two interventions at once: whatever moved the answer, you can’t say which. Change one variable at a time to isolate the cause.',
    };
  }
  if (active.has('days')) {
    return changed
      ? {
          tone: 'ok',
          title: 'Faithful',
          body: 'The explanation cites the delivery window, and moving the delivery date flipped the answer. The stated reason is doing causal work.',
        }
      : {
          tone: 'bad',
          title: 'Faithfulness violation',
          body: 'The explanation cites the delivery window, yet moving the delivery date inside it left the answer unchanged, and the rationale now contradicts its own evidence.',
        };
  }
  return changed
    ? {
        tone: 'bad',
        title: 'Hidden cause found',
        body: 'The answer flipped when only the customer tier changed, a factor the explanation never mentions. The story and the cause have come apart.',
      }
    : {
        tone: 'ok',
        title: 'Consistent',
        body: 'The tier isn’t part of the explanation, and changing it doesn’t move the answer. Nothing hidden here.',
      };
}

const wait = (ms) => new Promise((r) => setTimeout(r, ms));

export function initLab({ world, reduced }) {
  const root = document.querySelector('[data-lab]');
  if (!root) return;
  const { gsap } = window;
  const tabs = [...root.querySelectorAll('[data-agent]')];
  const doButtons = [...root.querySelectorAll('[data-do]')];
  const reset = root.querySelector('[data-lab-reset]');
  const steps = [...root.querySelectorAll('[data-step]')];
  const vars = { days: root.querySelector('[data-var="days"]'), tier: root.querySelector('[data-var="tier"]') };
  const explainEl = root.querySelector('[data-explain]');
  const answerEl = root.querySelector('[data-answer]');
  const verdict = root.querySelector('[data-verdict]');
  const log = root.querySelector('[data-log]');
  const status = root.querySelector('[data-lab-status]');

  let agent = 'alpha';
  const active = new Set();
  let busy = false;

  const state = () => ({
    days: active.has('days') ? DO.days : BASE.days,
    tier: active.has('tier') ? DO.tier : BASE.tier,
  });

  const swap = (el, mutate) => {
    if (reduced) {
      mutate();
      return Promise.resolve();
    }
    return new Promise((resolve) => {
      gsap
        .timeline({ onComplete: resolve })
        .to(el, { opacity: 0, y: -8, duration: 0.16, ease: 'power2.in' })
        .add(mutate)
        .fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.38, ease: 'expo.out' });
    });
  };

  const renderVars = (s) => {
    vars.days.textContent = `${s.days} days`;
    vars.tier.textContent = s.tier;
    vars.days.classList.toggle('is-do', active.has('days'));
    vars.tier.classList.toggle('is-do', active.has('tier'));
  };

  const setVerdict = ({ tone, title, body }) => {
    verdict.className = `verdict${tone ? ` verdict--${tone}` : ''}`;
    verdict.querySelector('.verdict__title').textContent = title;
    verdict.querySelector('.verdict__body').textContent = body;
    if (!reduced) gsap.fromTo(verdict, { y: 10, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
  };

  const addLog = (s, decision, changed, result) => {
    log.querySelector('.log__empty')?.remove();
    const parts = [...active].map((k) => (k === 'days' ? `delivered = ${s.days}d` : `tier = ${s.tier}`));
    const li = document.createElement('li');
    const mark = result.tone === 'bad' ? '✗' : result.tone === 'ok' ? '✓' : '~';
    li.innerHTML = `<span class="log__mark log__mark--${result.tone || 'none'}">${mark}</span><span></span><span></span>`;
    li.children[1].textContent = `${AGENTS[agent].name} · do(${parts.join(', ')}) → ${decision === 'approve' ? 'approved' : 'denied'}${changed ? '' : ' (unchanged)'}`;
    li.children[2].textContent = result.title.toLowerCase();
    log.prepend(li);
    while (log.children.length > 5) log.lastElementChild.remove();
    if (!reduced) gsap.from(li, { opacity: 0, x: -12, duration: 0.5, ease: 'expo.out' });
  };

  const setBusy = (value) => {
    busy = value;
    [...doButtons, reset, ...tabs].forEach((b) => (b.disabled = value));
    status.classList.toggle('is-busy', value);
    status.textContent = value ? 'trace · replaying…' : active.size ? 'trace · replayed' : 'trace · ready';
  };

  const replay = async ({ record = true } = {}) => {
    setBusy(true);
    const s = state();
    const decide = AGENTS[agent].decide;
    const decision = decide(s);
    const changed = decision !== decide(BASE);
    for (const [i, step] of steps.entries()) {
      step.classList.add('is-scan');
      if (i === 0) renderVars(s);
      if (i === 2) {
        await swap(explainEl, () => {
          explainEl.textContent = explain(s, decision);
          explainEl.classList.toggle('is-contradiction', contradicts(s, decision));
        });
      }
      if (i === 3) {
        await swap(answerEl, () => {
          answerEl.textContent = decision === 'approve' ? 'Refund approved' : 'Refund denied';
          answerEl.className = `answer answer--${decision}`;
        });
      }
      await wait(reduced ? 0 : 220);
      step.classList.remove('is-scan');
    }
    const result = judge(active, changed);
    setVerdict(result);
    if (record && active.size) addLog(s, decision, changed, result);
    world?.pulse(result.tone === 'bad' ? 1 : 0.55);
    setBusy(false);
  };

  doButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (busy) return;
      const key = button.dataset.do;
      if (active.has(key)) active.delete(key);
      else active.add(key);
      button.setAttribute('aria-pressed', String(active.has(key)));
      replay();
    });
  });

  reset.addEventListener('click', () => {
    if (busy) return;
    active.clear();
    doButtons.forEach((b) => b.setAttribute('aria-pressed', 'false'));
    replay({ record: false });
  });

  const select = (name, focus = false) => {
    if (busy || name === agent) return;
    agent = name;
    tabs.forEach((t) => {
      const on = t.dataset.agent === name;
      t.setAttribute('aria-selected', String(on));
      t.tabIndex = on ? 0 : -1;
      if (on && focus) t.focus();
    });
    replay();
  };
  tabs.forEach((t, i) => {
    t.tabIndex = t.getAttribute('aria-selected') === 'true' ? 0 : -1;
    t.addEventListener('click', () => select(t.dataset.agent));
    t.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next.dataset.agent, true);
    });
  });
}
