// How each formation sits in the viewport and how its particles behave.
//
// place(c, o) receives the frame context:
//   c.w, c.h     world units visible at z = 0
//   c.mobile     narrow layout
//   c.t          seconds since start
//   c.p          scroll progress through the stage's section, 0..1
//   c.mx, c.my   smoothed pointer, -1..1
//   c.slot       the portrait's DOM slot in world units ({ x, y, h }), when present
// and writes o.position, o.rotation, o.scale (and optionally o.depth, a z multiplier).

const BASE = {
  spring: 10,
  damping: 3.8,
  noise: 0.3,
  noiseScale: 0.6,
  size: 2.4,
  opacity: 0.8,
  mobileOpacity: 0.55,
  swirl: 0,
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
      if (c.mobile) {
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
