import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';

gsap.registerPlugin(ScrollTrigger);

export { gsap, ScrollTrigger };

// Each React mount owns its listeners, asynchronous work, and animations.
export function createScope() {
  const controller = new AbortController();
  const { signal } = controller;
  const cleanups = [];
  const context = gsap.context(() => {});
  const add = (cleanup) => {
    if (typeof cleanup === 'function') cleanups.push(cleanup);
    return cleanup;
  };
  const run = (callback, ...args) => {
    if (signal.aborted) return;
    let result;
    // Event callbacks may run inside a matchMedia context. Do not make the
    // mount context a child of its own media-query context.
    context.ignore(() => context.add(() => { result = callback(...args); }));
    return result;
  };
  const wrap = (callback) => (...args) => run(callback, ...args);
  const on = (target, type, callback, options = {}) => {
    target.addEventListener(type, wrap(callback), { ...options, signal });
  };
  const tick = (callback) => {
    const update = wrap(callback);
    gsap.ticker.add(update);
    add(() => gsap.ticker.remove(update));
  };
  const wait = (ms, frame = false) => new Promise((resolve) => {
    if (signal.aborted) return resolve(false);
    const finish = (active) => {
      signal.removeEventListener('abort', cancel);
      resolve(active);
    };
    const id = frame ? requestAnimationFrame(() => finish(true)) : setTimeout(() => finish(true), ms);
    const cancel = () => {
      if (frame) cancelAnimationFrame(id);
      else clearTimeout(id);
      finish(false);
    };
    signal.addEventListener('abort', cancel, { once: true });
  });
  return {
    signal, add, run, wrap, on, tick, wait,
    frame: () => wait(0, true),
    dispose() {
      if (signal.aborted) return;
      controller.abort();
      context.revert();
      for (const cleanup of cleanups.reverse()) {
        try { cleanup(); } catch (error) { console.error(error); }
      }
    },
  };
}
