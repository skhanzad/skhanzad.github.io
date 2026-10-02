// Text utilities: splitting into animatable spans, and a "decoding" scramble.

// Wrap every word (and optionally every character) of `el` in spans, keeping inline
// markup such as <em>. Words are wrapped in an overflow mask so they can rise into view.
export function split(el, { chars = false, mask = true } = {}) {
  if (el._split) return el._split;
  const replacements = [];
  const originalLabel = el.getAttribute('aria-label');
  const heading = /^H[1-6]$/.test(el.tagName);
  if (heading && !el.hasAttribute('aria-label')) {
    el.setAttribute('aria-label', el.textContent.trim().replace(/\s+/g, ' '));
  }
  const words = [];
  const letters = [];

  const walk = (node) => {
    for (const child of [...node.childNodes]) {
      if (child.nodeType === Node.ELEMENT_NODE) {
        walk(child);
        continue;
      }
      if (child.nodeType !== Node.TEXT_NODE) continue;
      const frag = document.createDocumentFragment();
      for (const part of child.textContent.split(/(\s+)/)) {
        if (!part) continue;
        if (/^\s+$/.test(part)) {
          frag.append(document.createTextNode(' '));
          continue;
        }
        const word = document.createElement('span');
        word.className = 'split-word';
        if (chars) {
          for (const ch of part) {
            const c = document.createElement('span');
            c.className = 'split-char';
            c.textContent = ch;
            word.append(c);
            letters.push(c);
          }
        } else {
          word.textContent = part;
        }
        words.push(word);
        if (mask) {
          const m = document.createElement('span');
          m.className = 'split-mask';
          if (heading) m.setAttribute('aria-hidden', 'true');
          m.append(word);
          frag.append(m);
        } else {
          frag.append(word);
        }
      }
      replacements.push({ original: child, nodes: [...frag.childNodes] });
      child.replaceWith(frag);
    }
  };
  walk(el);
  el._split = {
    words,
    chars: letters,
    revert() {
      replacements.forEach(({ original, nodes }) => {
        nodes[0]?.replaceWith(original);
        nodes.slice(1).forEach((node) => node.remove());
      });
      if (originalLabel === null) el.removeAttribute('aria-label');
      else el.setAttribute('aria-label', originalLabel);
      delete el._split;
    },
  };
  return el._split;
}

const GLYPHS = '▚▞▖▗▘▝/\\<>_=+*#%&$01';

// Resolve `el`'s text from noise, left to right. Best on monospace text.
export function scramble(el, { duration = 1.2, delay = 0, signal } = {}) {
  if (!el || signal?.aborted) return Promise.resolve();
  const text = el.dataset.text || el.textContent;
  el.dataset.text = text;
  if (!el.hasAttribute('aria-label')) el.setAttribute('aria-label', text);
  const start = performance.now() + delay * 1000;
  const len = text.length;
  return new Promise((resolve) => {
    let last = 0;
    let raf;
    const finish = () => {
      cancelAnimationFrame(raf);
      signal?.removeEventListener('abort', finish);
      el.textContent = text;
      resolve();
    };
    signal?.addEventListener('abort', finish, { once: true });
    const tick = (now) => {
      const t = (now - start) / (duration * 1000);
      if (now - last > 45 || t >= 1) {
        last = now;
        let out = '';
        for (let i = 0; i < len; i++) {
          const ch = text[i];
          const at = 0.15 + 0.85 * (i / len);
          if (ch === ' ' || t >= at) out += ch;
          else if (t > at - 0.35) out += GLYPHS[(Math.random() * GLYPHS.length) | 0];
          else out += ' ';
        }
        el.textContent = out;
      }
      if (t < 1) raf = requestAnimationFrame(tick);
      else {
        finish();
      }
    };
    raf = requestAnimationFrame(tick);
  });
}
