import * as THREE from 'three';
import { threadVertex, threadLineVertex, threadLineFragment, particleFragment } from './shaders.js';

// Ariadne's thread: a fine gold line along the maze's solution path, with a current of
// particles running along it. `uDraw` (0..1) is how far the thread has found its way in.
export class Thread {
  constructor(path, count = 5200) {
    const samples = path.length / 4;
    this.texture = new THREE.DataTexture(path, samples, 1, THREE.RGBAFormat, THREE.FloatType);
    this.texture.needsUpdate = true;

    this.uniforms = {
      uPath: { value: this.texture },
      uTime: { value: 0 },
      uDraw: { value: 0 },
      uOpacity: { value: 0 },
      uSize: { value: 3.2 },
      uScale: { value: 10 },
      uPlace: { value: new THREE.Matrix4() },
    };

    // The current of particles.
    const heads = 48;
    const total = count + heads;
    const t = new Float32Array(total);
    const rand = new Float32Array(total);
    const head = new Float32Array(total);
    const jitter = new Float32Array(total * 3);
    for (let i = 0; i < total; i++) {
      t[i] = Math.random();
      rand[i] = Math.random();
      head[i] = i >= count ? 1 : 0;
      const u = Math.random() * 2 - 1;
      const a = Math.random() * Math.PI * 2;
      const s = Math.sqrt(1 - u * u) * Math.sqrt(-2 * Math.log(Math.random() + 1e-6)) * 0.5;
      jitter[i * 3] = Math.cos(a) * s;
      jitter[i * 3 + 1] = Math.sin(a) * s;
      jitter[i * 3 + 2] = u * 0.4;
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(total * 3), 3));
    geometry.setAttribute('aT', new THREE.BufferAttribute(t, 1));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    geometry.setAttribute('aHead', new THREE.BufferAttribute(head, 1));
    geometry.setAttribute('aJitter', new THREE.BufferAttribute(jitter, 3));
    const points = new THREE.Points(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: threadVertex,
        fragmentShader: particleFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    points.frustumCulled = false;

    // The line itself, revealed up to uDraw.
    const position = new Float32Array(samples * 3);
    const along = new Float32Array(samples);
    for (let i = 0; i < samples; i++) {
      position[i * 3] = path[i * 4];
      position[i * 3 + 1] = path[i * 4 + 1];
      position[i * 3 + 2] = path[i * 4 + 2];
      along[i] = path[i * 4 + 3];
    }
    const lineGeometry = new THREE.BufferGeometry();
    lineGeometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    lineGeometry.setAttribute('aS', new THREE.BufferAttribute(along, 1));
    const line = new THREE.Line(
      lineGeometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: threadLineVertex,
        fragmentShader: threadLineFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    line.frustumCulled = false;

    this.object = new THREE.Group();
    this.object.add(line, points);
  }
}
