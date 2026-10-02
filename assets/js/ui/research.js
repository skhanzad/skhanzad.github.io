import { drawGlyphs } from './glyphs.js';
import { countUp, primeCount } from './reveal.js';

// Research: on wide screens the section pins and the cards travel sideways;
// on narrow screens they simply stack.
export function initResearch({ reduced }) {
  const { gsap, ScrollTrigger } = window;
  const section = document.querySelector('#research');
  if (!section) return;
  const track = section.querySelector('[data-research-track]');
  const bar = section.querySelector('[data-research-progress]');
  const cards = [...section.querySelectorAll('[data-card]')];
  drawGlyphs(section);

  const arrive = (card) => {
    if (card.classList.contains('is-drawn')) return;
    card.classList.add('is-drawn');
    const num = card.querySelector('[data-count]');
    if (num && !reduced) countUp(num, { duration: 1.8 });
  };
  if (!reduced) cards.forEach((card) => card.querySelectorAll('[data-count]').forEach(primeCount));
  else cards.forEach(arrive);

  const mm = gsap.matchMedia();
  mm.add('(min-width: 901px) and (prefers-reduced-motion: no-preference)', () => {
    const distance = () => Math.max(0, track.scrollWidth - window.innerWidth);
    // A card "arrives" once most of it is on screen, whichever way it got there.
    const check = () => {
      if (section.getBoundingClientRect().top > window.innerHeight * 0.4) return;
      for (const card of cards) {
        if (card.getBoundingClientRect().left < window.innerWidth * 0.82) arrive(card);
      }
    };
    const travel = gsap.to(track, {
      x: () => -distance(),
      ease: 'none',
      onUpdate: check,
      scrollTrigger: {
        trigger: section,
        start: 'top top',
        end: () => `+=${distance()}`,
        pin: true,
        scrub: 0.8,
        anticipatePin: 1,
        invalidateOnRefresh: true,
        onUpdate: (self) => {
          bar.style.transform = `scaleX(${self.progress})`;
          check();
        },
      },
    });
    ScrollTrigger.create({ trigger: section, start: 'top 40%', onEnter: check, onEnterBack: check });
    cards.forEach((card) => {
      if (!reduced) {
        gsap.fromTo(
          card,
          { opacity: 0.35, scale: 0.94, rotate: 1.2 },
          {
            opacity: 1,
            scale: 1,
            rotate: 0,
            ease: 'none',
            scrollTrigger: { trigger: card, containerAnimation: travel, start: 'left 100%', end: 'left 62%', scrub: true },
          },
        );
      }
    });
  });
  mm.add('(max-width: 900px), (prefers-reduced-motion: reduce)', () => {
    cards.forEach((card) => ScrollTrigger.create({ trigger: card, start: 'top 82%', once: true, onEnter: () => arrive(card) }));
  });

  // A soft spotlight that follows the pointer across each card.
  cards.forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
}
