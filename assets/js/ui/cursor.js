// A two-part cursor: a dot that tracks the pointer exactly and a ring that trails it.
// The ring swells over links and turns ember while the pointer is "intervening".
export function initCursor() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return null;
  const root = document.querySelector('[data-cursor]');
  if (!root) return null;
  const ring = root.querySelector('.cursor__ring');
  const dot = root.querySelector('.cursor__dot');
  const label = root.querySelector('[data-cursor-label]');
  document.documentElement.classList.add('has-cursor');

  let x = -100;
  let y = -100;
  let rx = x;
  let ry = y;
  let seen = false;
  let hold = false;
  let hoverLabel = '';

  const setLabel = (text) => {
    label.textContent = text;
    root.classList.toggle('has-label', !!text);
  };

  window.addEventListener(
    'pointermove',
    (e) => {
      if (e.pointerType !== 'mouse') return;
      x = e.clientX;
      y = e.clientY;
      if (!seen) {
        rx = x;
        ry = y;
        seen = true;
      }
      root.style.opacity = '1';
    },
    { passive: true },
  );
  document.documentElement.addEventListener('mouseleave', () => {
    root.style.opacity = '0';
  });

  document.addEventListener('pointerover', (e) => {
    const target = e.target.closest?.('a, button, [data-cursor-text]');
    root.classList.toggle('is-link', !!target);
    hoverLabel = target?.dataset.cursorText || (target?.matches('a[target="_blank"]') ? 'open ↗' : '');
    if (!hold) setLabel(hoverLabel);
  });

  window.gsap.ticker.add(() => {
    rx += (x - rx) * 0.2;
    ry += (y - ry) * 0.2;
    dot.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
  });

  return {
    setHold(on) {
      hold = on;
      root.classList.toggle('is-hold', on);
      setLabel(on ? 'do(x)' : hoverLabel);
    },
  };
}
