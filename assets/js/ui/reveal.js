import { gsap, ScrollTrigger } from './lifecycle.js';
import { split } from './text.js';

const format = (el, value) => {
  const decimals = Number(el.dataset.decimals || 0);
  return el.dataset.separator
    ? value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
    : value.toFixed(decimals);
};

// Count a [data-count] element up from zero.
export function countUp(el, { duration = 2, delay = 0 } = {}) {
  const to = parseFloat(el.dataset.count);
  const state = { v: 0 };
  el.textContent = format(el, 0);
  return gsap.to(state, {
    v: to,
    duration,
    delay,
    ease: 'expo.out',
    onUpdate: () => {
      el.textContent = format(el, state.v);
    },
  });
}

export function primeCount(el) {
  el.textContent = format(el, 0);
}

// Scroll-driven reveals for everything outside the horizontal research track.
export function initReveals({ reduced, scope }) {

  document.querySelectorAll('[data-split="words"]').forEach((el) => {
    const { words, revert } = split(el);
    scope.add(revert);
    if (reduced) return;
    gsap.set(words, { yPercent: 108 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 86%',
      once: true,
      onEnter: scope.wrap(() => gsap.to(words, { yPercent: 0, duration: 1.35, stagger: 0.045, ease: 'expo.out' })),
    });
  });

  document.querySelectorAll('[data-reveal]').forEach((el) => {
    if (reduced) return;
    gsap.set(el, { opacity: 0, y: 32 });
    ScrollTrigger.create({
      trigger: el,
      start: 'top 90%',
      once: true,
      onEnter: scope.wrap(() => gsap.to(el, { opacity: 1, y: 0, duration: 1.3, ease: 'expo.out' })),
    });
  });

  document.querySelectorAll('[data-count]').forEach((el) => {
    if (reduced || el.closest('[data-research-track]')) return;
    primeCount(el);
    ScrollTrigger.create({ trigger: el, start: 'top 96%', once: true, onEnter: scope.wrap(() => countUp(el, { delay: 0.2 })) });
  });

  // The manifesto lights up word by word as it scrolls through the viewport.
  document.querySelectorAll('[data-highlight]').forEach((el) => {
    const { words, revert } = split(el, { mask: false });
    scope.add(revert);
    if (reduced) return;
    gsap.set(words, { opacity: 0.2 });
    gsap.to(words, {
      opacity: 1,
      stagger: 0.12,
      ease: 'none',
      scrollTrigger: { trigger: el, start: 'top 78%', end: 'bottom 45%', scrub: 0.6 },
    });
  });

  // Chips arrive one after another.
  document.querySelectorAll('.chips').forEach((list) => {
    if (reduced) return;
    const items = list.querySelectorAll('li');
    gsap.set(items, { opacity: 0, y: 14 });
    ScrollTrigger.create({
      trigger: list,
      start: 'top 90%',
      once: true,
      onEnter: scope.wrap(() => gsap.to(items, { opacity: 1, y: 0, duration: 0.9, stagger: 0.035, ease: 'expo.out' })),
    });
  });
}
