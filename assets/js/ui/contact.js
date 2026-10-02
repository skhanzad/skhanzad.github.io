// Contact details: the copy-to-clipboard email, a toast, and Toronto's local time.
function toast(message, scope) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  const version = el.dataset.toastVersion = String(Number(el.dataset.toastVersion || 0) + 1);
  scope.wait(2400).then((active) => {
    if (active && el.dataset.toastVersion === version) el.classList.remove('is-on');
  });
}

export function initContact({ scope }) {
  scope.add(() => document.querySelector('[data-toast]')?.classList.remove('is-on'));
  document.querySelectorAll('[data-copy]').forEach((link) => {
    const hint = link.querySelector('[data-copy-hint]');
    const initialHint = hint?.textContent;
    scope.add(() => { if (hint) hint.textContent = initialHint; });
    link.dataset.cursorText = 'copy';
    scope.on(link, 'click', async (e) => {
      if (!navigator.clipboard) return;
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(link.dataset.copy);
        if (scope.signal.aborted) return;
        toast('Email copied to clipboard', scope);
        if (hint) hint.textContent = 'Copied ✓';
      } catch {
        if (scope.signal.aborted) return;
        window.location.href = link.href;
      }
    });
  });

  const clock = document.querySelector('[data-clock]');
  if (clock) {
    const format = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
      timeZoneName: 'short',
    });
    const tick = () => (clock.textContent = format.format(new Date()));
    tick();
    const timer = setInterval(tick, 15000);
    scope.add(() => clearInterval(timer));
  }
}
