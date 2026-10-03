import { gsap } from '../ui/lifecycle.js';
import * as THREE from 'three';
import { Particles } from './Particles.js';
import { Thread } from './Thread.js';
import { Dust } from './Dust.js';
import { Scan } from './Scan.js';
import { Glow } from './Glow.js';
import { STAGES } from './stages.js';
import * as F from './formations.js';

const FOV = 35;
const CAM_Z = 10;
const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
const ease = (rate, dt) => 1 - Math.exp(-rate * dt);

// Each builder returns a formation's points, and `alt` for one with a lucid state.
const BUILDERS = {
  labyrinth: (n, ctx) => ({ points: ctx.lab.points }),
  mind: (n) => F.mind(n),
  orbit: (n) => F.orbit(n),
  trajectories: (n) => F.trajectories(n),
  portrait: (n, ctx) => F.portrait(n, ctx.portraitMap),
  knot: (n) => F.knot(n),
  graph: (n) => F.graph(n),
  futures: (n) => F.futures(n),
  armillary: (n) => F.armillary(n),
  galaxy: (n) => F.galaxy(n),
};

// The whole WebGL layer: one fixed canvas behind the page. Sections of the page
// (data-formation) each own a formation; scrolling between sections morphs the
// particles from one to the next.
export class World {
  constructor(canvas, { size, portraitMap, sections, slot, reduced }) {
    this.events = new AbortController();
    this.canvas = canvas;
    try {
      this.reduced = reduced;

      this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, alpha: false, powerPreference: 'high-performance' });
      this.dprCap = size >= 256 ? 1.75 : 1.5;
      this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, this.dprCap));
      this.renderer.setClearColor(0x020122, 1);
      // Bloom where there is GPU to spare (the larger particle budgets).
      this.glow = size >= 192 ? new Glow(this.renderer, { background: 0x020122 }) : null;
      this.bufferSize = new THREE.Vector2();

      this.scene = new THREE.Scene();
      this.camera = new THREE.PerspectiveCamera(FOV, 1, 0.1, 120);
      this.camera.position.set(0, 0, CAM_Z);

      this.ctx = { w: 1, h: 1, mobile: false, reduced, t: 0, p: 0, pin: 0, mx: 0, my: 0, slot: null };
      this.tmp = { position: new THREE.Vector3(), rotation: new THREE.Euler(), scale: 1, depth: 1 };
      this.quat = new THREE.Quaternion();
      this.scaleVec = new THREE.Vector3();
      this.measure();

      const n = size * size;
      const lab = F.labyrinth(n);
      const build = { lab, portraitMap };
      this.stages = sections.map((s) => ({
        ...s,
        cfg: STAGES[s.name],
        // An element the formation sits on, tracked every frame (the portrait's photo
        // slot, the expertise chart).
        slotEl: s.el.querySelector('[data-formation-slot]') || (s.name === 'portrait' ? slot : null),
        matrix: new THREE.Matrix4(),
        lucid: new THREE.Vector4(9, 0, 0, 0),
        spot: new THREE.Vector4(),
        spotTo: new THREE.Vector4(),
        top: 0,
        height: 1,
        pinLength: 0,
      }));
      // Sections that share a formation share its data.
      const cache = new Map();
      const built = this.stages.map((s) => {
        if (!cache.has(s.name)) cache.set(s.name, BUILDERS[s.name](n, build));
        return cache.get(s.name);
      });
      const data = built.map((b) => b.points);
      const alts = built.map((b) => b.alt || null);

      // The big bang: every particle starts at the labyrinth's centre and flies outward.
      this.place(this.stages[0], 0);
      const origin = new THREE.Vector3().setFromMatrixPosition(this.stages[0].matrix);
      const positions = F.singularity(n);
      const velocities = new Float32Array(n * 4);
      for (let i = 0; i < n; i++) {
        positions[i * 4] += origin.x;
        positions[i * 4 + 1] += origin.y;
        positions[i * 4 + 2] += origin.z;
        const z = Math.random() * 2 - 1;
        const a = Math.random() * Math.PI * 2;
        const s = Math.sqrt(1 - z * z);
        const speed = reduced ? 0 : 1.2 + Math.pow(Math.random(), 2) * 7.5;
        velocities[i * 4] = s * Math.cos(a) * speed;
        velocities[i * 4 + 1] = s * Math.sin(a) * speed;
        velocities[i * 4 + 2] = z * speed * 0.6;
      }

      this.particles = new Particles(this.renderer, size, data, { positions, velocities }, alts);
      this.thread = new Thread(lab.path);
      this.dust = new Dust(this.ctx.mobile ? 700 : 1600);
      this.scene.add(this.dust.points, this.particles.points, this.thread.object);
      if (this.stages.some((s) => s.name === 'mind')) {
        this.scan = new Scan({ centre: [0, 0, -0.03], extent: [1.02, 1.24] });
        this.scene.add(this.scan.object);
      }
      this.count = n;
      this.labIndex = this.stages.findIndex((s) => s.name === 'labyrinth');
      this.portraitIndex = this.stages.findIndex((s) => s.name === 'portrait');

      // Animated state.
      this.springBoost = reduced ? 1 : 0;
      this.threadReveal = reduced ? 1 : 0;
      this.reveal = 0;
      this.pulseLevel = 0;
      this.probe = 0;
      this.lens = 0; // the lucid lens follows an active pointer
      this.hold = 0;
      this.burst = 0;
      if (reduced) this.thread.uniforms.uDraw.value = 1;

      this.raycaster = new THREE.Raycaster();
      this.ndc = new THREE.Vector2();
      this.hit = new THREE.Vector3();
      this.lastHit = new THREE.Vector3();
      this.moved = new THREE.Vector3();
      this.pointerVel = new THREE.Vector3();
      this.far = new THREE.Vector3(0, 0, 1000);
      this.bindPointer();

      this.frameListeners = new Set();
      this.projected = new THREE.Vector3();
      this.stageA = null;
      this.stageB = null;
      this.frameTimes = [];
      this.downgraded = false;
      this.paused = false; // set while a simulation has the stage
      this.clock = 0; // the world's own time, so pausing doesn't make it jump
      this.resize(true);
    } catch (error) {
      this.dispose();
      throw error;
    }
  }

  dispose() {
    this.events.abort();
    this.onHold = null;
    this.frameListeners?.clear();
    gsap.killTweensOf(this);
    if (this.thread) gsap.killTweensOf(this.thread.uniforms.uDraw);
    this.particles?.dispose();
    this.thread?.dispose();
    this.scan?.dispose();
    this.glow?.dispose();
    this.dust?.dispose();
    this.renderer?.dispose();
    this.scene?.clear();
  }

  measure() {
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    this.W = W;
    this.H = H;
    this.ctx.h = 2 * CAM_Z * Math.tan(((FOV / 2) * Math.PI) / 180);
    this.ctx.w = (this.ctx.h * W) / H;
    this.ctx.mobile = W < 820;
    this.wpp = this.ctx.h / H;
    if (this.particles) this.particles.sim.uLensRadius.value = Math.min(this.ctx.h, this.ctx.w) * 0.16;
  }

  resize(force = false) {
    const W = this.canvas.clientWidth || window.innerWidth;
    const H = this.canvas.clientHeight || window.innerHeight;
    // Mobile URL bars resize the viewport while scrolling; ignore small height changes.
    if (!force && W === this.W && Math.abs(H - this.H) < 140) return;
    this.measure();
    this.renderer.setSize(W, H, false);
    this.renderer.getDrawingBufferSize(this.bufferSize);
    this.glow?.setSize(this.bufferSize.x, this.bufferSize.y);
    this.camera.aspect = W / H;
    this.camera.updateProjectionMatrix();
    const scale = this.renderer.getPixelRatio() * (H / 900) * CAM_Z;
    this.particles.uniforms.uScale.value = scale;
    this.thread.uniforms.uScale.value = scale;
    this.dust.uniforms.uScale.value = scale;
  }

  // Document positions of each stage's section (pinned sections measure their spacer,
  // and how far they stay pinned).
  refresh() {
    const y = window.scrollY;
    for (const s of this.stages) {
      const pinned = s.el.parentElement?.classList.contains('pin-spacer');
      const el = pinned ? s.el.parentElement : s.el;
      const r = el.getBoundingClientRect();
      s.top = r.top + y;
      s.height = r.height;
      s.pinLength = pinned ? Math.max(0, r.height - s.el.offsetHeight) : 0;
    }
  }

  bindPointer() {
    const { signal } = this.events;
    const p = (this.pointer = { x: 0, y: 0, sx: 0, sy: 0, active: false, down: false, touch: false });
    const read = (e) => {
      p.x = (e.clientX / window.innerWidth) * 2 - 1;
      p.y = -(e.clientY / window.innerHeight) * 2 + 1;
      p.touch = e.pointerType !== 'mouse';
      p.active = true;
    };
    window.addEventListener('pointermove', read, { passive: true, signal });
    window.addEventListener('pointerdown', read, { passive: true, signal });
    // Mouse only: pressing (anywhere but on text or controls) starts an intervention.
    // Cancelling mousedown keeps the drag from turning into a text selection. Touch
    // devices also fire a compatibility mousedown after each tap; p.touch screens it out.
    window.addEventListener('mousedown', (e) => {
      if (p.touch || e.button !== 0 || !this.canIntervene(e)) return;
      e.preventDefault();
      p.down = true;
      this.onHold?.(true);
    }, { signal });
    const release = () => {
      if (p.down) {
        p.down = false;
        this.burst = 1;
        this.onHold?.(false);
      }
      if (p.touch) p.active = false;
    };
    window.addEventListener('pointerup', release, { passive: true, signal });
    window.addEventListener('pointercancel', release, { passive: true, signal });
    window.addEventListener('mouseup', release, { passive: true, signal });
    document.documentElement.addEventListener('mouseleave', () => {
      p.active = false;
      release();
    }, { signal });
    window.addEventListener('blur', release, { signal });
  }

  // Holding the mouse is an intervention, but never on controls or on the glyphs
  // of any text (so selecting text still works).
  canIntervene(e) {
    if (e.target.closest?.('a, button, input, textarea, select, label, summary, [data-no-intervene]')) return false;
    let node = null;
    if (document.caretPositionFromPoint) node = document.caretPositionFromPoint(e.clientX, e.clientY)?.offsetNode;
    else if (document.caretRangeFromPoint) node = document.caretRangeFromPoint(e.clientX, e.clientY)?.startContainer;
    if (node?.nodeType !== Node.TEXT_NODE || !node.textContent.trim()) return true;
    const range = document.createRange();
    range.selectNodeContents(node);
    for (const r of range.getClientRects()) {
      if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return false;
    }
    return true;
  }

  place(stage, time) {
    const c = this.ctx;
    const vh = window.innerHeight;
    c.t = time;
    c.p = clamp((window.scrollY + vh - stage.top) / (stage.height + vh));
    // Progress through the pinned stretch; unpinned, the middle of the section's passage.
    c.pin = stage.pinLength > 1 ? clamp((window.scrollY - stage.top) / stage.pinLength) : clamp((c.p - 0.25) / 0.5);
    c.slot = null;
    if (stage.slotEl) {
      const r = stage.slotEl.getBoundingClientRect();
      if (r.height > 0) {
        c.slot = {
          x: (r.left + r.width / 2 - this.W / 2) * this.wpp,
          y: -(r.top + r.height / 2 - this.H / 2) * this.wpp,
          h: r.height * this.wpp,
        };
      }
    }
    const o = this.tmp;
    o.depth = 1;
    o.position.set(0, 0, 0);
    o.rotation.set(0, 0, 0);
    stage.cfg.place(c, o);
    this.quat.setFromEuler(o.rotation);
    this.scaleVec.set(o.scale, o.scale, o.scale * o.depth);
    stage.matrix.compose(o.position, this.quat, this.scaleVec);
    if (stage.cfg.lucid) stage.cfg.lucid(c, stage.lucid);
  }

  intro() {
    if (this.reduced) return;
    gsap.to(this, { springBoost: 1, duration: 2.1, delay: 0.15, ease: 'power2.in' });
    gsap.to(this, { threadReveal: 1, duration: 1.2, delay: 1.1 });
    gsap.fromTo(this.thread.uniforms.uDraw, { value: 0 }, { value: 1, duration: 6.5, delay: 1.2, ease: 'power1.inOut' });
  }

  setReveal(v) {
    gsap.to(this, { reveal: v, duration: 1.1, ease: 'power2.inOut' });
    const stage = this.stages[this.portraitIndex];
    if (v > 0 && stage) {
      // A soft outward breath from the face as the photograph takes over.
      this.particles.sim.uHoldPoint.value.setFromMatrixPosition(stage.matrix);
      this.burst = 0.35;
    }
  }

  pulse(strength = 1) {
    this.pulseLevel = Math.max(this.pulseLevel, strength);
  }

  // Light a point of a formation (local space); the glow glides there.
  spotlight(name, point, amount = 1) {
    for (const s of this.stages) if (s.name === name) s.spotTo.set(point[0], point[1], point[2], amount);
  }

  // Run `fn` after every rendered frame (for DOM that follows the formations).
  afterFrame(fn) {
    this.frameListeners.add(fn);
    return () => this.frameListeners.delete(fn);
  }

  // Where a point in a formation's local space appears on screen, in CSS pixels.
  // Only current while that formation is on stage. Returns null if it isn't.
  project(name, local, out = { x: 0, y: 0 }) {
    const stage = this.stages.find((s) => s.name === name);
    if (!stage || (stage !== this.stageA && stage !== this.stageB)) return null;
    const v = this.projected.set(local[0], local[1], local[2]).applyMatrix4(stage.matrix).project(this.camera);
    out.x = ((v.x + 1) / 2) * this.W;
    out.y = ((1 - v.y) / 2) * this.H;
    return out;
  }

  update(delta) {
    const dt = Math.min(Math.max(delta, 1 / 240), 1 / 30);
    this.clock += dt;
    const time = this.clock;
    const y = window.scrollY;
    const vh = window.innerHeight;
    const stages = this.stages;

    // Which two formations are we between, and how far?
    let k = 0;
    for (let i = 1; i < stages.length; i++) if (y >= stages[i].top - vh * 0.85) k = i;
    let a = k;
    let morph = 0;
    if (k > 0) {
      morph = clamp((y - (stages[k].top - vh * 0.85)) / (vh * 0.65));
      if (morph < 1) a = k - 1;
      else morph = 0;
    }
    const A = stages[a];
    const B = stages[k];
    this.stageA = A;
    this.stageB = B;
    const weight = (i) => (i < 0 ? 0 : (a === i ? 1 - morph : 0) + (k === i && a !== k ? morph : 0));
    const wPortrait = weight(this.portraitIndex);
    const wLab = weight(this.labIndex);

    this.updatePointer(dt, wPortrait);
    this.place(A, time);
    if (B !== A) this.place(B, time);

    const sim = this.particles.sim;
    const mix = (key) => A.cfg[key] + (B.cfg[key] - A.cfg[key]) * morph;
    this.particles.setFormations(a, k);
    sim.uPlaceA.value.copy(A.matrix);
    sim.uPlaceB.value.copy(B.matrix);
    sim.uLucidA.value.copy(A.lucid);
    sim.uLucidB.value.copy(B.lucid);
    sim.uLucidA.value.z *= this.lens;
    sim.uLucidB.value.z *= this.lens;
    sim.uSwirlA.value = A.cfg.swirl;
    sim.uSwirlB.value = B.cfg.swirl;
    sim.uMorph.value = morph;
    sim.uSpread.value = mix('spread');
    // Reduced motion: shorter, calmer transitions.
    const calm = this.reduced ? 1.7 : 1;
    sim.uScatter.value = this.reduced ? 0.35 : 0.9;
    sim.uSpring.value = mix('spring') * (0.04 + 0.96 * this.springBoost) * calm;
    sim.uDamping.value = mix('damping') * (this.springBoost < 1 ? 0.75 + 0.25 * this.springBoost : 1) * Math.sqrt(calm);
    sim.uNoise.value = mix('noise') * (this.reduced ? 0.3 : 1);
    sim.uNoiseScale.value = mix('noiseScale');
    sim.uProbeRadius.value = mix('probeRadius');
    sim.uProbe.value *= mix('probe');
    this.pulseLevel *= Math.exp(-dt * 2.2);
    sim.uPulse.value = this.pulseLevel;

    const u = this.particles.uniforms;
    const mobile = this.ctx.mobile;
    const opacity = mobile ? mix('mobileOpacity') : mix('opacity');
    u.uOpacity.value = opacity * (1 - this.reveal * 0.9 * wPortrait) * (1 + this.pulseLevel * 0.35);
    const glide = ease(5, dt);
    A.spot.lerp(A.spotTo, glide);
    if (B !== A) B.spot.lerp(B.spotTo, glide);
    u.uSpotA.value.copy(A.spot);
    u.uSpotB.value.copy(B.spot);
    u.uSize.value = mix('size');
    u.uHeat.value = mix('heat');

    const t = this.thread.uniforms;
    t.uTime.value = time;
    t.uOpacity.value = wLab * this.threadReveal * (mobile ? 0.8 : 1);
    if (wLab > 0) t.uPlace.value.copy(stages[this.labIndex].matrix);

    this.dust.uniforms.uTime.value = time;
    this.updateScan(A, B, morph, time);

    // A slow drift of the camera with the pointer; held still while the portrait is up,
    // so the particle face stays registered with the photo slot.
    const par = this.reduced ? 0 : 1 - wPortrait * 0.92;
    this.camera.position.set(this.pointer.sx * 0.32 * par, this.pointer.sy * 0.2 * par, CAM_Z);
    this.camera.lookAt(0, 0, 0);

    this.particles.step(time, dt);
    if (this.glow) this.glow.render(this.scene, this.camera);
    else this.renderer.render(this.scene, this.camera);
    this.frameListeners.forEach((fn) => fn(this));
    this.watchPerformance(delta);
  }

  // The scanner rides the mind's scan level while an audit is under way.
  updateScan(A, B, morph, time) {
    if (!this.scan) return;
    const L = A.cfg.lucid ? A : B.cfg.lucid ? B : null;
    const level = L?.lucid.x ?? 9;
    const from = F.MIND.scanFrom + 0.1;
    const to = F.MIND.scanTo - 0.1;
    const w = !L ? 0 : A === B ? 1 : L === A ? 1 - morph : morph;
    const fade = clamp((from - level) / 0.25) * clamp((level - to) / 0.25);
    const opacity = this.reduced ? 0 : w * fade;
    this.scan.object.visible = opacity > 0.001;
    if (!this.scan.object.visible) return;
    const u = this.scan.uniforms;
    u.uOpacity.value = opacity;
    u.uLevel.value = level;
    u.uTime.value = time;
    u.uPlace.value.copy(L.matrix);
  }

  updatePointer(dt, wPortrait) {
    const p = this.pointer;
    const sim = this.particles.sim;
    p.sx += (p.x - p.sx) * ease(3, dt);
    p.sy += (p.y - p.sy) * ease(3, dt);
    this.ctx.mx = p.sx;
    this.ctx.my = p.sy;

    this.ndc.set(p.x, p.y);
    this.raycaster.setFromCamera(this.ndc, this.camera);
    const ray = this.raycaster.ray;
    const t = -ray.origin.z / ray.direction.z;
    this.hit.copy(ray.direction).multiplyScalar(t).add(ray.origin);

    // Pointer velocity on the z = 0 plane (ignoring jumps, e.g. re-entering the window).
    const v = this.pointerVel;
    const jump = this.lastHit.distanceTo(this.hit) > 3;
    this.moved.copy(this.hit).sub(this.lastHit).multiplyScalar(jump ? 0 : 1 / dt);
    v.lerp(this.moved, ease(10, dt));
    if (v.length() > 7) v.setLength(7);
    this.lastHit.copy(this.hit);

    const speed = v.length();
    const target = p.active && !this.reduced ? Math.min(1, 0.3 + speed * 0.11) : 0;
    this.probe += (target - this.probe) * ease(8, dt);
    this.lens += ((p.active && !this.reduced ? 1 : 0) - this.lens) * ease(5, dt);
    this.hold += ((p.down ? 1 : 0) - this.hold) * ease(p.down ? 3.2 : 10, dt);
    this.burst *= Math.exp(-dt * 6);

    sim.uRayOrigin.value.copy(p.active || this.hold > 0.01 ? ray.origin : this.far);
    sim.uRayDir.value.copy(ray.direction);
    if (p.active) sim.uPointerVel.value.copy(v);
    else sim.uPointerVel.value.set(0, 0, 0);
    sim.uProbe.value = this.probe * (1 - wPortrait * 0.25);
    if (p.down || this.hold > 0.01) sim.uHoldPoint.value.copy(this.hit);
    sim.uHold.value = this.hold;
    sim.uBurst.value = this.burst;
  }

  // If the GPU struggles, trade resolution for frame rate (once).
  watchPerformance(delta) {
    if (this.downgraded || this.clock < 5) return;
    this.frameTimes.push(delta);
    if (this.frameTimes.length < 120) return;
    const avg = this.frameTimes.reduce((s, x) => s + x, 0) / this.frameTimes.length;
    this.frameTimes.length = 0;
    if (avg > 1 / 38 && this.renderer.getPixelRatio() > 1) {
      this.downgraded = true;
      this.renderer.setPixelRatio(1);
      this.resize(true);
    }
  }
}
