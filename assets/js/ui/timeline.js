import { ScrollTrigger } from './lifecycle.js';
// The Path: a gold thread drawn through each role's knot as the timeline scrolls by.
export function initTimeline({ reduced }) {
  const root = document.querySelector('[data-timeline]');
  if (!root) return;
  const base = root.querySelector('.timeline__base');
  const thread = root.querySelector('.timeline__thread');
  const needle = root.querySelector('.timeline__needle');
  const roles = [...root.querySelectorAll('[data-role]')];
  let length = 0;
  let marks = [];
  let progress = 0;

  const build = () => {
    const box = root.getBoundingClientRect();
    const knots = roles.map((role) => {
      const k = role.querySelector('.role__knot').getBoundingClientRect();
      return { x: k.left + k.width / 2 - box.left, y: k.top + k.height / 2 - box.top };
    });
    let d = `M ${knots[0].x} ${knots[0].y}`;
    for (let i = 1; i < knots.length; i++) {
      const a = knots[i - 1];
      const b = knots[i];
      const h = b.y - a.y;
      const sway = (i % 2 ? 1 : -1) * Math.min(18, h * 0.08);
      d += ` C ${a.x + sway} ${a.y + h * 0.4}, ${b.x - sway} ${b.y - h * 0.4}, ${b.x} ${b.y}`;
    }
    base.setAttribute('d', d);
    thread.setAttribute('d', d);
    length = thread.getTotalLength();
    thread.style.strokeDasharray = `${length}`;

    // Where along the path each knot sits (the path only ever descends, so search by y).
    marks = knots.map((k) => {
      let lo = 0;
      let hi = length;
      for (let i = 0; i < 22; i++) {
        const mid = (lo + hi) / 2;
        if (thread.getPointAtLength(mid).y < k.y) lo = mid;
        else hi = mid;
      }
      return lo;
    });
    render();
  };

  const render = () => {
    const drawn = reduced ? length : progress * length;
    thread.style.strokeDashoffset = `${length - drawn}`;
    const p = thread.getPointAtLength(Math.max(0, drawn));
    needle.setAttribute('cx', p.x);
    needle.setAttribute('cy', p.y);
    needle.style.opacity = drawn > 1 && drawn < length - 1 ? '1' : '0';
    roles.forEach((role, i) => role.classList.toggle('is-lit', drawn >= marks[i] - 1));
  };

  // A restored scroll position can trigger onUpdate during construction.
  // Build the SVG path before ScrollTrigger measures its initial progress.
  build();
  ScrollTrigger.create({
    trigger: root,
    start: 'top 62%',
    end: 'bottom 62%',
    onUpdate: (self) => {
      progress = self.progress;
      render();
    },
    onRefresh: build,
  });
}
