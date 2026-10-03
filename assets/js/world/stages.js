// How each formation sits in the viewport and how its particles behave.
//
// place(c, o) receives the frame context:
//   c.w, c.h     world units visible at z = 0
//   c.mobile     narrow layout
//   c.reduced    the visitor prefers reduced motion
//   c.t          seconds since start
//   c.p          scroll progress through the stage's section, 0..1
//   c.pin        progress through the section's pinned stretch, 0..1
//   c.mx, c.my   smoothed pointer, -1..1
//   c.slot       the section's formation slot (portrait photo, expertise chart, toolkit
//                orrery) in world units ({ x, y, h }), when it has one
// and writes o.position, o.rotation, o.scale (and optionally o.depth, a z multiplier).
// A formation with a lucid state also has lucid(c, out), which writes the uLucid
// vector described in shaders.js.

import { MIND } from './formations.js';

// The trust chapter's acts, as fractions of its pinned scroll: the mind as it is,
// the audit scan, then the glass box built around it.
export const ACTS = {
  scan: [0.3, 0.62],
  build: [0.68, 0.94],
};

const span = (v, a, b) => Math.min(1, Math.max(0, (v - a) / (b - a)));
const smooth = (t) => t * t * (3 - 2 * t);

// How far the audit scan and the box have come at a given pinned progress.
export function mindProgress(pin) {
  return { scan: smooth(span(pin, ...ACTS.scan)), build: span(pin, ...ACTS.build) };
}

// The scan plane's local height: above the mind before the audit, below it after.
export function scanLevel(scan) {
  if (scan <= 0) return 9;
  if (scan >= 1) return -9;
  const from = MIND.scanFrom + 0.1;
  const to = MIND.scanTo - 0.1;
  return from + (to - from) * scan;
}

const BASE = {
  spring: 10,
  damping: 3.8,
  noise: 0.3,
  noiseScale: 0.6,
  size: 2.4,
  opacity: 0.8,
  mobileOpacity: 0.55,
  swirl: 0,
  probe: 1,
  probeRadius: 0.55,
  heat: 1,
  spread: 0.75,
};

const stage = (cfg) => ({ ...BASE, ...cfg });

export const STAGES = {
  labyrinth: stage({
    spring: 12,
    damping: 4.2,
    noise: 0.14,
    noiseScale: 0.8,
    size: 2.3,
    opacity: 0.85,
    mobileOpacity: 0.75,
    place(c, o) {
      if (c.mobile) {
        o.scale = Math.min(c.w * 0.43, c.h * 0.21) / 1.8;
        o.position.set(0, c.h * 0.18, 0);
      } else {
        o.scale = Math.min(c.h * 0.46, c.w * 0.3) / 1.8;
        o.position.set(c.w * 0.21, -c.h * 0.02, 0);
      }
      o.rotation.set(-0.86 - c.p * 0.5 + c.my * 0.06, c.mx * 0.09, c.t * 0.035);
    },
  }),

  mind: stage({
    spring: 11,
    damping: 4.1,
    noise: 0.3,
    noiseScale: 0.9,
    size: 2.2,
    opacity: 0.86,
    mobileOpacity: 0.66,
    // The pointer is a lens here: it should reveal the slices, not scatter them.
    probe: 0.12,
    probeRadius: 0.32,
    heat: 0.85,
    place(c, o) {
      // Pull back just before the box rises around the mind.
      const back = c.reduced ? 1 : smooth(span(c.pin, ACTS.build[0] - 0.08, ACTS.build[0] + 0.1));
      const fit = 1 - 0.36 * back;
      if (c.mobile) {
        o.scale = ((c.w * 0.74) / 2.4) * fit;
        o.position.set(0, c.h * (0.12 + 0.02 * back), 0);
      } else {
        o.scale = (Math.min(c.h * 0.78, c.w * 0.4) / 2.4) * fit;
        o.position.set(c.w * (0.2 - 0.025 * back), c.h * (-0.03 + 0.05 * back), 0);
      }
      // A brain reads best in profile: swing gently about a three-quarter side view
      // rather than spinning through the less legible front and back. The box, then,
      // turns a corner to the viewer so all three of its dimensions show.
      const swing = 0.3 * Math.sin(c.t * 0.16 + c.pin * 3.2) * (1 - 0.65 * back);
      const yaw = -1.28 + 0.48 * back + swing + c.mx * 0.22;
      o.rotation.set(0.26 + 0.1 * back + c.my * 0.08, yaw, 0);
    },
    lucid(c, out) {
      if (c.reduced) return out.set(-9, 1, 0, 1);
      const { scan, build } = mindProgress(c.pin);
      return out.set(scanLevel(scan), build, 1 - span(c.pin, ACTS.build[0], ACTS.build[0] + 0.06), 1);
    },
  }),

  orbit: stage({
    spring: 13,
    damping: 4.6,
    noise: 0.12,
    noiseScale: 1.1,
    size: 2.1,
    opacity: 0.8,
    mobileOpacity: 0.62,
    probeRadius: 0.4,
    place(c, o) {
      if (c.slot) {
        o.scale = c.slot.h * 0.5;
        o.position.set(c.slot.x, c.slot.y, -0.2);
      } else {
        o.scale = c.h * 0.3;
        o.position.set(-c.w * 0.22, 0, 0);
      }
      o.rotation.set(c.my * 0.06, c.mx * 0.08, 0);
    },
  }),

  trajectories: stage({
    spring: 10,
    damping: 3.8,
    noise: 0.22,
    size: 2.0,
    opacity: 0.6,
    mobileOpacity: 0.4,
    place(c, o) {
      if (c.mobile) {
        o.scale = (c.w * 0.92) / 3.7;
        o.position.set(0, 0, -0.5);
      } else {
        o.scale = (c.h * 0.56) / 3.1;
        o.position.set(c.w * 0.265, -c.h * 0.01, 0);
      }
      o.rotation.set(0.1 + c.my * 0.08, -0.22 + Math.sin(c.t * 0.25) * 0.1 + c.mx * 0.12, 0);
    },
  }),

  portrait: stage({
    spring: 15,
    damping: 4.8,
    noise: 0.08,
    noiseScale: 1.2,
    size: 2.0,
    opacity: 0.78,
    mobileOpacity: 0.7,
    probeRadius: 0.42,
    place(c, o) {
      if (c.slot) {
        o.scale = c.slot.h;
        o.position.set(c.slot.x, c.slot.y, -0.06 * c.slot.h * 0.5);
      } else {
        o.scale = c.h * 0.7;
        o.position.set(c.w * 0.24, 0, 0);
      }
      o.depth = 0.5;
      o.rotation.set(c.my * 0.05, c.mx * 0.08, 0);
    },
  }),

  knot: stage({
    spring: 9,
    damping: 3.4,
    noise: 0.36,
    size: 2.3,
    opacity: 0.7,
    mobileOpacity: 0.28,
    place(c, o) {
      if (c.mobile) {
        o.scale = (c.w * 0.44) / 1.6;
        o.position.set(0, 0, -2);
      } else {
        o.scale = (c.h * 0.31) / 1.6;
        o.position.set(c.w * 0.3, 0, 0);
      }
      o.rotation.set(0.55 + c.p * 1.1 + c.my * 0.1, c.t * 0.07 + c.p * 2.2 + c.mx * 0.15, 0.2);
    },
  }),

  graph: stage({
    spring: 9,
    damping: 3.4,
    noise: 0.26,
    size: 2.3,
    opacity: 0.75,
    mobileOpacity: 0.45,
    place(c, o) {
      if (c.mobile) {
        o.scale = (c.w * 0.46) / 1.7;
        o.position.set(0, 0, -1);
      } else {
        o.scale = (c.h * 0.42) / 1.7;
        o.position.set(c.w * 0.14, -c.h * 0.03, 0);
      }
      o.rotation.set(0.25 + c.my * 0.1, c.t * 0.06 + c.p * 1.4 + c.mx * 0.15, 0);
    },
  }),

  futures: stage({
    spring: 8,
    damping: 3.2,
    noise: 0.42,
    size: 2.4,
    opacity: 0.72,
    mobileOpacity: 0.42,
    place(c, o) {
      if (c.mobile) {
        o.scale = (c.w * 0.48) / 1.9;
        o.position.set(0, -c.h * 0.05, -1);
      } else {
        o.scale = Math.min((c.w * 0.26) / 1.9, (c.h * 0.3) / 1.5);
        o.position.set(-c.w * 0.25, -c.h * 0.28, 0);
      }
      o.rotation.set(0.18 + c.my * 0.1, -0.42 + Math.sin(c.t * 0.2) * 0.12 + c.mx * 0.16, 0.06);
    },
  }),

  armillary: stage({
    spring: 11,
    damping: 4,
    noise: 0.18,
    size: 2.2,
    opacity: 0.74,
    mobileOpacity: 0.42,
    place(c, o) {
      if (c.slot) {
        // Sized so the outer ring stays inside the toolkit's orrery slot.
        o.scale = (c.slot.h * 0.5) / 1.55;
        o.position.set(c.slot.x, c.slot.y, 0);
      } else if (c.mobile) {
        o.scale = (c.w * 0.42) / 1.6;
        o.position.set(0, 0, -1);
      } else {
        o.scale = (c.h * 0.33) / 1.6;
        o.position.set(c.w * 0.3, c.h * 0.1, 0);
      }
      o.rotation.set(0.55 + c.t * 0.05 + c.my * 0.1, c.t * 0.14 + c.p * 1.6 + c.mx * 0.15, 0.32);
    },
  }),

  galaxy: stage({
    spring: 7,
    damping: 3,
    noise: 0.44,
    size: 2.4,
    opacity: 0.78,
    mobileOpacity: 0.55,
    swirl: 0.22,
    place(c, o) {
      if (c.mobile) {
        o.scale = (c.w * 0.6) / 2.1;
        o.position.set(0, -c.h * 0.42, -1);
      } else {
        o.scale = (c.w * 0.38) / 2.1;
        o.position.set(0, -c.h * 0.36, 0);
      }
      o.rotation.set(-1.2 + c.my * 0.06, c.mx * 0.08, c.t * 0.02);
    },
  }),
};
