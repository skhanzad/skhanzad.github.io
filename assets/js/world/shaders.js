// GLSL for the particle world.

// Simplex noise with its analytic gradient (after Stefan Gustavson / webgl-noise).
// cross(grad a, grad b) of two noise fields is divergence-free: a cheap curl-like flow.
const noise = /* glsl */ `
vec3 mod289(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289(((x * 34.0) + 10.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v, out vec3 gradient) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g.xyz, l.zxy);
  vec3 i2 = max(g.xyz, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0)) +
    i.y + vec4(0.0, i1.y, i2.y, 1.0)) +
    i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x;
  p1 *= norm.y;
  p2 *= norm.z;
  p3 *= norm.w;
  vec4 m = max(0.5 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  vec4 m2 = m * m;
  vec4 m4 = m2 * m2;
  vec4 pdotx = vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3));
  vec4 temp = m2 * m * pdotx;
  gradient = -8.0 * (temp.x * x0 + temp.y * x1 + temp.z * x2 + temp.w * x3);
  gradient += m4.x * p0 + m4.y * p1 + m4.z * p2 + m4.w * p3;
  gradient *= 105.0;
  return 105.0 * dot(m4, pdotx);
}

vec3 flow(vec3 p) {
  vec3 g1;
  vec3 g2;
  snoise(p, g1);
  snoise(p + vec3(31.416, -47.853, 12.793), g2);
  return cross(g1, g2);
}
`;

// Palette ramp: ember -> amber -> gold -> cream.
const ramp = /* glsl */ `
vec3 ramp(float t) {
  t = clamp(t, 0.0, 1.0) * 3.0;
  vec3 c = mix(vec3(0.957, 0.267, 0.180), vec3(0.988, 0.620, 0.310), smoothstep(0.0, 1.0, t));
  c = mix(c, vec3(0.929, 0.827, 0.510), smoothstep(1.0, 2.0, t));
  return mix(c, vec3(0.949, 0.953, 0.682), smoothstep(2.0, 3.0, t));
}
`;

// Velocity: spring toward the (morphing) target, a turbulent flow, and the pointer,
// which behaves as a probe (a ray that parts the particles) or, while held, as an
// intervention that drags everything into a vortex. Releasing fires a burst.
export const velocityShader = /* glsl */ `
uniform float uTime;
uniform float uDelta;
uniform sampler2D uTargetA;
uniform sampler2D uTargetB;
uniform mat4 uPlaceA;
uniform mat4 uPlaceB;
uniform float uSwirlA;
uniform float uSwirlB;
uniform float uMorph;
uniform float uSpread;
uniform float uScatter;
uniform float uSpring;
uniform float uDamping;
uniform float uNoise;
uniform float uNoiseScale;
uniform vec3 uRayOrigin;
uniform vec3 uRayDir;
uniform vec3 uPointerVel;
uniform float uProbe;
uniform float uProbeRadius;
uniform vec3 uHoldPoint;
uniform float uHold;
uniform float uBurst;
uniform float uPulse;

${noise}

float hash12(vec2 p) {
  vec3 p3 = fract(vec3(p.xyx) * 0.1031);
  p3 += dot(p3, p3.yzx + 33.33);
  return fract((p3.x + p3.y) * p3.z);
}

// Differential rotation about local Z: inner particles orbit faster.
vec3 swirl(vec3 p, float s) {
  float a = uTime * s / (0.35 + length(p.xy));
  float c = cos(a);
  float n = sin(a);
  return vec3(c * p.x - n * p.y, n * p.x + c * p.y, p.z);
}

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);
  vec4 a = texture2D(uTargetA, uv);
  vec4 b = texture2D(uTargetB, uv);

  float seed = hash12(uv * 517.31);
  float m = clamp(uMorph * (1.0 + uSpread) - seed * uSpread, 0.0, 1.0);
  m = m * m * (3.0 - 2.0 * m);
  vec3 ta = (uPlaceA * vec4(swirl(a.xyz, uSwirlA), 1.0)).xyz;
  vec3 tb = (uPlaceB * vec4(swirl(b.xyz, uSwirlB), 1.0)).xyz;
  float flight = sin(m * 3.14159265);
  // Mid-flight, each particle bows out along its own direction, so neighbours
  // separate instead of travelling as a block.
  vec3 scatter = vec3(hash12(uv * 91.7), hash12(uv * 37.1 + 3.7), hash12(uv * 13.3 + 9.1)) * 2.0 - 1.0;
  vec3 target = mix(ta, tb, m) + scatter * flight * uScatter;

  // Each particle has its own stiffness, so after a sudden jump between formations
  // they arrive at different times and the shape fills in rather than snapping.
  float stiff = mix(0.45, 1.45, hash12(uv * 71.9 + 4.2));
  vec3 p = pos.xyz;
  float far = smoothstep(0.08, 1.4, length(target - p));
  vec3 acc = (target - p) * uSpring * stiff * (1.0 - flight * 0.6);

  vec3 f = flow(p * uNoiseScale + vec3(0.0, 0.0, uTime * 0.07));
  acc += f * (uNoise + flight * 1.6 + far * 1.5 + uPulse * 2.2) * 0.08;

  vec3 rel = p - uRayOrigin;
  vec3 closest = uRayOrigin + uRayDir * dot(rel, uRayDir);
  vec3 away = p - closest;
  float d = length(away) + 1e-4;
  float fall = 1.0 - smoothstep(0.0, uProbeRadius, d);
  fall *= fall;
  acc += (away / d) * fall * uProbe * 24.0;
  acc += cross(uRayDir, away / d) * fall * uProbe * 7.0;
  acc += uPointerVel * fall * 2.4;

  vec3 toH = uHoldPoint - p;
  float dh = length(toH) + 1e-4;
  float reach = 1.0 - smoothstep(0.0, uProbeRadius * 4.5, dh);
  acc += (toH / dh) * reach * uHold * 30.0;
  acc += cross(uRayDir, toH / dh) * reach * uHold * 16.0;
  acc -= (toH / dh) * reach * uBurst * 110.0;

  vel.xyz += acc * uDelta;
  vel.xyz *= exp(-uDamping * sqrt(stiff) * uDelta);
  gl_FragColor = vec4(vel.xyz, m);
}
`;

export const positionShader = /* glsl */ `
uniform float uDelta;

void main() {
  vec2 uv = gl_FragCoord.xy / resolution.xy;
  vec4 pos = texture2D(texturePosition, uv);
  vec4 vel = texture2D(textureVelocity, uv);
  pos.xyz += vel.xyz * uDelta;
  gl_FragColor = pos;
}
`;

export const particleVertex = /* glsl */ `
uniform sampler2D uPosTex;
uniform sampler2D uVelTex;
uniform sampler2D uTargetA;
uniform sampler2D uTargetB;
uniform float uTime;
uniform float uSize;
uniform float uScale;
uniform float uOpacity;
uniform float uHeat;
attribute vec2 aRef;
attribute float aRand;
varying vec3 vColor;
varying float vAlpha;

${ramp}

void main() {
  vec4 pos = texture2D(uPosTex, aRef);
  vec4 vel = texture2D(uVelTex, aRef);
  float tone = mix(texture2D(uTargetA, aRef).w, texture2D(uTargetB, aRef).w, vel.w);
  float speed = length(vel.xyz);
  float heat = smoothstep(0.8, 6.0, speed) * uHeat;

  vec3 color = ramp(tone + (aRand - 0.5) * 0.1);
  color = mix(color, vec3(1.0, 0.42, 0.26), heat * 0.7);

  vec4 mv = modelViewMatrix * vec4(pos.xyz, 1.0);
  gl_Position = projectionMatrix * mv;
  float twinkle = 0.78 + 0.22 * sin(uTime * (0.9 + aRand * 2.2) + aRand * 61.0);
  gl_PointSize = max(1.0, uSize * (0.55 + aRand * 0.9) * (1.0 + heat * 0.7) * uScale / -mv.z);
  vColor = color;
  vAlpha = uOpacity * twinkle * (0.75 + heat * 0.5);
}
`;

export const particleFragment = /* glsl */ `
varying vec3 vColor;
varying float vAlpha;

void main() {
  vec2 c = gl_PointCoord - 0.5;
  float d = dot(c, c) * 4.0;
  if (d > 1.0) discard;
  float a = 1.0 - d;
  gl_FragColor = vec4(vColor, a * a * vAlpha);
}
`;

// Ariadne's thread: particles flowing along the solution path of the maze.
export const threadVertex = /* glsl */ `
uniform sampler2D uPath;
uniform float uTime;
uniform float uDraw;
uniform float uOpacity;
uniform float uSize;
uniform float uScale;
uniform mat4 uPlace;
attribute float aT;
attribute float aRand;
attribute float aHead;
attribute vec3 aJitter;
varying vec3 vColor;
varying float vAlpha;

void main() {
  float s = aHead > 0.5 ? 1.0 : fract(aT + uTime * (0.012 + aRand * 0.01));
  float along = s * uDraw;
  vec3 p = texture2D(uPath, vec2(along, 0.5)).xyz;
  float wobble = aHead > 0.5 ? 0.035 : 0.004 + 0.012 * aRand;
  p += aJitter * wobble;
  vec4 mv = viewMatrix * (uPlace * vec4(p, 1.0));
  gl_Position = projectionMatrix * mv;
  float tip = aHead > 0.5 ? 1.0 : smoothstep(0.92, 1.0, s) * (1.0 - step(0.999, uDraw));
  gl_PointSize = max(1.0, uSize * (0.6 + aRand * 0.8 + tip * 2.2) * uScale / -mv.z);
  vColor = mix(vec3(0.96, 0.9, 0.62), vec3(1.0, 1.0, 0.88), tip * 0.8 + aRand * 0.2);
  vAlpha = uOpacity * (0.7 + 0.3 * tip) * (0.8 + 0.2 * sin(uTime * 3.0 + aRand * 40.0));
}
`;

export const threadLineVertex = /* glsl */ `
uniform mat4 uPlace;
attribute float aS;
varying float vS;

void main() {
  vS = aS;
  gl_Position = projectionMatrix * viewMatrix * uPlace * vec4(position, 1.0);
}
`;

// A pulse runs from the entrance toward the centre every few seconds.
export const threadLineFragment = /* glsl */ `
uniform float uDraw;
uniform float uOpacity;
uniform float uTime;
varying float vS;

void main() {
  if (vS > uDraw) discard;
  float wave = fract(uTime * 0.16);
  float pulse = exp(-pow((vS - wave) * 14.0, 2.0));
  vec3 color = mix(vec3(0.93, 0.83, 0.51), vec3(1.0, 1.0, 0.9), pulse);
  gl_FragColor = vec4(color, uOpacity * (0.6 + 0.4 * pulse));
}
`;

// Distant dust for depth.
export const dustVertex = /* glsl */ `
uniform float uTime;
uniform float uScale;
uniform float uOpacity;
attribute float aRand;
varying vec3 vColor;
varying float vAlpha;

${ramp}

void main() {
  vec3 p = position;
  p.y = mod(p.y + uTime * (0.03 + aRand * 0.05) + 9.0, 18.0) - 9.0;
  p.x += sin(uTime * 0.1 + aRand * 20.0) * 0.2;
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = max(1.0, (1.0 + aRand * 2.2) * uScale / -mv.z);
  vColor = ramp(0.45 + aRand * 0.55);
  vAlpha = uOpacity * (0.25 + 0.35 * aRand) * (0.6 + 0.4 * sin(uTime * (0.6 + aRand) + aRand * 30.0));
}
`;
