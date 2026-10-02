// Contact details: the copy-to-clipboard email, a toast, and Toronto's local time.
let toastTimer;

export function toast(message) {
  const el = document.querySelector('[data-toast]');
  if (!el) return;
  el.textContent = message;
  el.classList.add('is-on');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('is-on'), 2400);
}

export function initContact() {
  document.querySelectorAll('[data-copy]').forEach((link) => {
    const hint = link.querySelector('[data-copy-hint]');
    link.dataset.cursorText = 'copy';
    link.addEventListener('click', async (e) => {
      if (!navigator.clipboard) return;
      e.preventDefault();
      try {
        await navigator.clipboard.writeText(link.dataset.copy);
        toast('Email copied to clipboard');
        if (hint) hint.textContent = 'Copied ✓';
      } catch {
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
    setInterval(tick, 15000);
  }
}
