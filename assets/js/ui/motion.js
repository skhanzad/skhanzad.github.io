// Small motion pieces: the venue marquee and magnetic buttons.

// An endless marquee that drifts on its own, speeds up with the scroll and follows
// its direction.
export function initMarquee({ getVelocity, reduced }) {
  const root = document.querySelector('[data-marquee]');
  if (!root || reduced) return;
  const track = root.querySelector('.marquee__track');
  track.append(...[...track.children].map((n) => n.cloneNode(true)));
  let width = track.scrollWidth / 2;
  let x = 0;
  let dir = -1;
  let visible = false;
  new ResizeObserver(() => (width = track.scrollWidth / 2)).observe(track);
  new IntersectionObserver(([entry]) => (visible = entry.isIntersecting)).observe(root);

  window.gsap.ticker.add((time, deltaMs) => {
    if (!visible) return;
    const v = getVelocity();
    if (Math.abs(v) > 0.4) dir = v > 0 ? -1 : 1;
    const speed = 46 + Math.min(1400, Math.abs(v) * 42);
    x += (dir * speed * Math.min(deltaMs, 50)) / 1000;
    if (x <= -width) x += width;
    if (x > 0) x -= width;
    track.style.transform = `translate3d(${x.toFixed(2)}px, 0, 0)`;
  });
}

// Buttons that lean toward the pointer.
export function initMagnetic() {
  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;
  const { gsap } = window;
  document.querySelectorAll('[data-magnetic]').forEach((el) => {
    const toX = gsap.quickTo(el, 'x', { duration: 0.7, ease: 'power3.out' });
    const toY = gsap.quickTo(el, 'y', { duration: 0.7, ease: 'power3.out' });
    el.addEventListener('pointermove', (e) => {
      const r = el.getBoundingClientRect();
      toX((e.clientX - (r.left + r.width / 2)) * 0.22);
      toY((e.clientY - (r.top + r.height / 2)) * 0.32);
    });
    el.addEventListener('pointerleave', () => {
      toX(0);
      toY(0);
    });
  });
}
