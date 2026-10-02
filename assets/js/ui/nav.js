// Header, mobile menu, in-page links and the chapter rail.
export function initNav({ lenis, onScroll }) {
  const { gsap, ScrollTrigger } = window;
  const nav = document.querySelector('[data-nav]');
  const menu = document.querySelector('[data-menu]');
  const toggle = document.querySelector('[data-menu-toggle]');
  const toggleLabel = toggle.querySelector('.nav__menu-label');
  const railFill = document.querySelector('[data-rail-fill]');
  let open = false;

  const setMenu = (value) => {
    open = value;
    toggle.setAttribute('aria-expanded', String(value));
    toggleLabel.textContent = value ? 'Close' : 'Menu';
    nav.classList.remove('is-hidden');
    if (value) {
      menu.hidden = false;
      gsap.fromTo(
        menu.querySelectorAll('li, .menu__resume'),
        { y: 34, opacity: 0 },
        { y: 0, opacity: 1, duration: 0.9, stagger: 0.05, ease: 'expo.out' },
      );
      lenis?.stop();
      menu.querySelector('a')?.focus({ preventScroll: true });
    } else {
      menu.hidden = true;
      lenis?.start();
    }
  };
  toggle.addEventListener('click', () => setMenu(!open));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && open) {
      setMenu(false);
      toggle.focus();
    }
  });

  // In-page links glide instead of jumping.
  document.addEventListener('click', (e) => {
    const link = e.target.closest('a[href^="#"]');
    if (!link) return;
    const hash = link.getAttribute('href');
    if (!/^#[\w-]+$/.test(hash)) return;
    const target = hash === '#top' ? document.body : document.querySelector(hash);
    if (!target) return;
    e.preventDefault();
    if (open) setMenu(false);
    if (lenis) lenis.scrollTo(hash === '#top' ? 0 : target, { duration: 1.8, easing: (t) => 1 - Math.pow(1 - t, 4) });
    else window.scrollTo({ top: hash === '#top' ? 0 : target.getBoundingClientRect().top + window.scrollY });
    history.replaceState(null, '', hash);
    // Move keyboard focus along with the view.
    if (hash !== '#top') {
      if (!target.hasAttribute('tabindex')) target.setAttribute('tabindex', '-1');
      target.focus({ preventScroll: true });
    }
  });

  let lastY = window.scrollY;
  onScroll((y) => {
    nav.classList.toggle('is-scrolled', y > 30);
    if (Math.abs(y - lastY) > 6) {
      nav.classList.toggle('is-hidden', y > lastY && y > window.innerHeight * 0.6 && !open);
      lastY = y;
    }
    const max = document.documentElement.scrollHeight - window.innerHeight;
    railFill.style.transform = `scaleY(${max > 0 ? Math.min(1, y / max) : 0})`;
  });

  // Highlight the chapter in view, in both the header and the rail.
  const links = new Map();
  const register = (id, el) => {
    if (!links.has(id)) links.set(id, []);
    links.get(id).push(el);
  };
  document.querySelectorAll('[data-rail-link]').forEach((a) => register(a.dataset.railLink, a));
  document.querySelectorAll('.nav__links a').forEach((a) => register(a.getAttribute('href').slice(1), a));
  const setActive = (id) => {
    links.forEach((els, key) =>
      els.forEach((el) => {
        el.classList.toggle('is-active', key === id);
        if (key === id) el.setAttribute('aria-current', 'location');
        else el.removeAttribute('aria-current');
      }),
    );
  };
  document.querySelectorAll('[data-chapter]').forEach((section) => {
    // A pinned section scrolls for longer than its own height: track its spacer.
    const spacer = section.parentElement?.classList.contains('pin-spacer') ? section.parentElement : null;
    ScrollTrigger.create({
      trigger: spacer || section,
      start: 'top 50%',
      end: 'bottom 50%',
      onToggle: (self) => self.isActive && setActive(section.dataset.chapter),
    });
  });
  setActive('top');
}
