import { gsap } from './lifecycle.js';
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

export function initLab({ world, reduced, scope }) {
  const root = document.querySelector('[data-lab]');
  if (!root) return;
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
  const emptyLog = log.querySelector('.log__empty');
  const entries = new Set();
  const initial = [...root.querySelectorAll('[data-var], [data-explain], [data-answer], [data-lab-status], .verdict__title, .verdict__body')]
    .map((el) => ({ el, text: el.textContent, className: el.className }));

  let agent = 'alpha';
  const active = new Set();
  let busy = false;
  scope.add(() => {
    [...doButtons, reset, ...tabs].forEach((button) => (button.disabled = false));
    steps.forEach((step) => step.classList.remove('is-scan'));
    entries.forEach((entry) => entry.remove());
    if (emptyLog) emptyLog.hidden = false;
    initial.forEach(({ el, text, className }) => {
      el.textContent = text;
      el.className = className;
    });
    verdict.className = 'verdict';
    doButtons.forEach((button) => button.setAttribute('aria-pressed', 'false'));
    tabs.forEach((tab) => {
      const selected = tab.dataset.agent === 'alpha';
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
    });
  });

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
      const finish = () => {
        scope.signal.removeEventListener('abort', finish);
        resolve();
      };
      scope.signal.addEventListener('abort', finish, { once: true });
      scope.run(() => gsap
        .timeline({ onComplete: finish })
        .to(el, { opacity: 0, y: -8, duration: 0.16, ease: 'power2.in' })
        .add(mutate)
        .fromTo(el, { opacity: 0, y: 10 }, { opacity: 1, y: 0, duration: 0.38, ease: 'expo.out' }));
    });
  };

  const renderVars = (s) => {
    vars.days.textContent = `${s.days} days`;
    vars.tier.textContent = s.tier;
    vars.days.classList.toggle('is-do', active.has('days'));
    vars.tier.classList.toggle('is-do', active.has('tier'));
  };

  const setVerdict = scope.wrap(({ tone, title, body }) => {
    verdict.className = `verdict${tone ? ` verdict--${tone}` : ''}`;
    verdict.querySelector('.verdict__title').textContent = title;
    verdict.querySelector('.verdict__body').textContent = body;
    if (!reduced) gsap.fromTo(verdict, { y: 10, opacity: 0.4 }, { y: 0, opacity: 1, duration: 0.6, ease: 'expo.out' });
  });

  const addLog = scope.wrap((s, decision, changed, result) => {
    if (emptyLog) emptyLog.hidden = true;
    const parts = [...active].map((k) => (k === 'days' ? `delivered = ${s.days}d` : `tier = ${s.tier}`));
    const li = document.createElement('li');
    const mark = result.tone === 'bad' ? '✗' : result.tone === 'ok' ? '✓' : '~';
    li.innerHTML = `<span class="log__mark log__mark--${result.tone || 'none'}">${mark}</span><span></span><span></span>`;
    li.children[1].textContent = `${AGENTS[agent].name} · do(${parts.join(', ')}) → ${decision === 'approve' ? 'approved' : 'denied'}${changed ? '' : ' (unchanged)'}`;
    li.children[2].textContent = result.title.toLowerCase();
    entries.add(li);
    log.prepend(li);
    if (entries.size > 5) {
      const oldest = entries.values().next().value;
      oldest.remove();
      entries.delete(oldest);
    }
    if (!reduced) gsap.from(li, { opacity: 0, x: -12, duration: 0.5, ease: 'expo.out' });
  });

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
      if (scope.signal.aborted) return;
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
      if (!await scope.wait(reduced ? 0 : 220)) return;
      step.classList.remove('is-scan');
    }
    const result = judge(active, changed);
    setVerdict(result);
    if (record && active.size) addLog(s, decision, changed, result);
    world?.pulse(result.tone === 'bad' ? 1 : 0.55);
    setBusy(false);
  };

  doButtons.forEach((button) => {
    scope.on(button, 'click', () => {
      if (busy) return;
      const key = button.dataset.do;
      if (active.has(key)) active.delete(key);
      else active.add(key);
      button.setAttribute('aria-pressed', String(active.has(key)));
      replay();
    });
  });

  scope.on(reset, 'click', () => {
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
    scope.on(t, 'click', () => select(t.dataset.agent));
    scope.on(t, 'keydown', (e) => {
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      e.preventDefault();
      const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
      select(next.dataset.agent, true);
    });
  });
}
