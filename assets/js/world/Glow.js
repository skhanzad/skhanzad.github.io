import * as THREE from 'three';
import { FullScreenQuad } from 'three/addons/postprocessing/Pass.js';

const quadVertex = /* glsl */ `
varying vec2 vUv;
void main() {
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

// Dual-filter (Kawase) downsample; the first pass also keeps only what is bright.
const downFragment = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
uniform float uThreshold;
varying vec2 vUv;

vec3 bright(vec3 c) {
  if (uThreshold <= 0.0) return c;
  float l = max(c.r, max(c.g, c.b));
  return c * smoothstep(uThreshold, uThreshold + 0.25, l);
}

void main() {
  vec2 o = uTexel;
  vec3 c = bright(texture2D(tInput, vUv).rgb) * 4.0;
  c += bright(texture2D(tInput, vUv + vec2(-o.x, -o.y)).rgb);
  c += bright(texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb);
  c += bright(texture2D(tInput, vUv + vec2(-o.x, o.y)).rgb);
  c += bright(texture2D(tInput, vUv + vec2(o.x, o.y)).rgb);
  gl_FragColor = vec4(c / 8.0, 1.0);
}
`;

const upFragment = /* glsl */ `
uniform sampler2D tInput;
uniform vec2 uTexel;
varying vec2 vUv;

void main() {
  vec2 o = uTexel;
  vec3 c = texture2D(tInput, vUv + vec2(-o.x * 2.0, 0.0)).rgb;
  c += texture2D(tInput, vUv + vec2(-o.x, o.y)).rgb * 2.0;
  c += texture2D(tInput, vUv + vec2(0.0, o.y * 2.0)).rgb;
  c += texture2D(tInput, vUv + vec2(o.x, o.y)).rgb * 2.0;
  c += texture2D(tInput, vUv + vec2(o.x * 2.0, 0.0)).rgb;
  c += texture2D(tInput, vUv + vec2(o.x, -o.y)).rgb * 2.0;
  c += texture2D(tInput, vUv + vec2(0.0, -o.y * 2.0)).rgb;
  c += texture2D(tInput, vUv + vec2(-o.x, -o.y)).rgb * 2.0;
  gl_FragColor = vec4(c / 12.0, 1.0);
}
`;

// The scene was drawn on black, so the page's midnight goes back in here, exactly.
const compositeFragment = /* glsl */ `
uniform sampler2D tScene;
uniform sampler2D tGlow;
uniform vec3 uBackground;
uniform float uStrength;
varying vec2 vUv;

void main() {
  vec3 scene = texture2D(tScene, vUv).rgb;
  vec3 glow = texture2D(tGlow, vUv).rgb * uStrength;
  gl_FragColor = vec4(min(uBackground + scene + glow, vec3(1.0)), 1.0);
}
`;

const material = (fragmentShader, uniforms) =>
  new THREE.ShaderMaterial({ uniforms, vertexShader: quadVertex, fragmentShader, depthTest: false, depthWrite: false });

// A soft bloom around the brightest particles: the scene renders to a target, its
// bright parts are blurred down a short mip chain and back up, then both are laid
// over the page colour. Shader output is written as is, so colours match the plain
// render exactly; only the glow is new.
export class Glow {
  constructor(renderer, { background, strength = 0.6, threshold = 0.42, levels = 5 }) {
    this.renderer = renderer;
    this.threshold = threshold;
    // Half floats keep faint glows from banding, where they can be rendered to.
    const ext = renderer.extensions;
    const type = ext.has('EXT_color_buffer_float') || ext.has('EXT_color_buffer_half_float') ? THREE.HalfFloatType : THREE.UnsignedByteType;
    const options = { type, depthBuffer: false, minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter };
    this.sceneTarget = new THREE.WebGLRenderTarget(1, 1, options);
    this.chain = Array.from({ length: levels }, () => new THREE.WebGLRenderTarget(1, 1, options));
    this.down = material(downFragment, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() }, uThreshold: { value: threshold } });
    this.up = material(upFragment, { tInput: { value: null }, uTexel: { value: new THREE.Vector2() } });
    this.up.blending = THREE.AdditiveBlending;
    this.up.transparent = true;
    // The page colour as the screen shows it (sRGB), since nothing here is converted.
    const bg = new THREE.Color(background).getRGB({ r: 0, g: 0, b: 0 }, THREE.SRGBColorSpace);
    this.composite = material(compositeFragment, {
      tScene: { value: this.sceneTarget.texture },
      tGlow: { value: this.chain[0].texture },
      uBackground: { value: new THREE.Vector3(bg.r, bg.g, bg.b) },
      uStrength: { value: strength },
    });
    this.quad = new FullScreenQuad();
    this.black = new THREE.Color(0x000000);
  }

  setSize(width, height) {
    this.sceneTarget.setSize(width, height);
    let w = width;
    let h = height;
    for (const target of this.chain) {
      w = Math.max(1, Math.round(w / 2));
      h = Math.max(1, Math.round(h / 2));
      target.setSize(w, h);
    }
  }

  render(scene, camera) {
    const r = this.renderer;
    r.setClearColor(this.black, 1);
    r.setRenderTarget(this.sceneTarget);
    r.clear();
    r.render(scene, camera);

    // Down the chain, keeping only the bright parts on the first step...
    let source = this.sceneTarget;
    this.quad.material = this.down;
    this.chain.forEach((target, i) => {
      this.down.uniforms.tInput.value = source.texture;
      this.down.uniforms.uTexel.value.set(0.5 / source.width, 0.5 / source.height);
      this.down.uniforms.uThreshold.value = i === 0 ? this.threshold : 0;
      r.setRenderTarget(target);
      this.quad.render(r);
      source = target;
    });
    // ...and back up, each level added onto the next larger one.
    this.quad.material = this.up;
    for (let i = this.chain.length - 2; i >= 0; i--) {
      const from = this.chain[i + 1];
      this.up.uniforms.tInput.value = from.texture;
      this.up.uniforms.uTexel.value.set(0.5 / from.width, 0.5 / from.height);
      r.setRenderTarget(this.chain[i]);
      this.quad.render(r);
    }

    r.setRenderTarget(null);
    this.quad.material = this.composite;
    this.quad.render(r);
  }

  dispose() {
    this.sceneTarget.dispose();
    this.chain.forEach((t) => t.dispose());
    [this.down, this.up, this.composite].forEach((m) => m.dispose());
    this.quad.dispose();
  }
}
