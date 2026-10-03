import * as THREE from 'three';
import { GPUComputationRenderer } from 'three/addons/misc/GPUComputationRenderer.js';
import { velocityShader, positionShader, particleVertex, particleFragment } from './shaders.js';

// A GPU particle simulation: position and velocity live in float textures that
// ping-pong every frame. Each particle springs toward its slot in the current
// formation (or a blend of two while the page scrolls between them). A formation
// may also have a lucid state (`alts[i]`), which its particles move into as it is
// audited (see the lucid GLSL in shaders.js).
export class Particles {
  constructor(renderer, size, formations, start, alts = []) {
    this.size = size;
    this.count = size * size;

    this.gpu = new GPUComputationRenderer(size, size, renderer);
    if (!renderer.extensions.has('EXT_color_buffer_float')) this.gpu.setDataType(THREE.HalfFloatType);

    const pos0 = this.gpu.createTexture();
    const vel0 = this.gpu.createTexture();
    pos0.image.data.set(start.positions);
    vel0.image.data.set(start.velocities);

    this.velVar = this.gpu.addVariable('textureVelocity', velocityShader, vel0);
    this.posVar = this.gpu.addVariable('texturePosition', positionShader, pos0);
    this.gpu.setVariableDependencies(this.velVar, [this.velVar, this.posVar]);
    this.gpu.setVariableDependencies(this.posVar, [this.velVar, this.posVar]);

    // One texture per distinct array: sections may share a formation.
    this.textures = new Map();
    const texture = (data) => {
      if (!this.textures.has(data)) {
        const tex = new THREE.DataTexture(data, size, size, THREE.RGBAFormat, THREE.FloatType);
        tex.needsUpdate = true;
        this.textures.set(data, tex);
      }
      return this.textures.get(data);
    };
    this.targets = formations.map(texture);
    // Formations without a lucid state sample their own target (and never use it).
    this.alts = formations.map((data, i) => texture(alts[i] || data));

    this.sim = this.velVar.material.uniforms;
    Object.assign(this.sim, {
      uTime: { value: 0 },
      uDelta: { value: 0.016 },
      uTargetA: { value: this.targets[0] },
      uTargetB: { value: this.targets[0] },
      uAltA: { value: this.alts[0] },
      uAltB: { value: this.alts[0] },
      uLucidA: { value: new THREE.Vector4(9, 0, 0, 0) },
      uLucidB: { value: new THREE.Vector4(9, 0, 0, 0) },
      uLensRadius: { value: 0.8 },
      uPlaceA: { value: new THREE.Matrix4() },
      uPlaceB: { value: new THREE.Matrix4() },
      uSwirlA: { value: 0 },
      uSwirlB: { value: 0 },
      uMorph: { value: 0 },
      uSpread: { value: 0.7 },
      uScatter: { value: 0.9 },
      uSpring: { value: 10 },
      uDamping: { value: 3.8 },
      uNoise: { value: 0.3 },
      uNoiseScale: { value: 0.6 },
      uRayOrigin: { value: new THREE.Vector3(0, 0, 1000) },
      uRayDir: { value: new THREE.Vector3(0, 0, -1) },
      uPointerVel: { value: new THREE.Vector3() },
      uProbe: { value: 0 },
      uProbeRadius: { value: 0.55 },
      uHoldPoint: { value: new THREE.Vector3(0, 0, 1000) },
      uHold: { value: 0 },
      uBurst: { value: 0 },
      uPulse: { value: 0 },
    });
    this.posVar.material.uniforms.uDelta = { value: 0.016 };

    const error = this.gpu.init();
    if (error) {
      this.dispose();
      throw new Error(error);
    }

    const geometry = new THREE.BufferGeometry();
    const ref = new Float32Array(this.count * 2);
    const rand = new Float32Array(this.count);
    for (let i = 0; i < this.count; i++) {
      ref[i * 2] = ((i % size) + 0.5) / size;
      ref[i * 2 + 1] = (Math.floor(i / size) + 0.5) / size;
      rand[i] = Math.random();
    }
    geometry.setAttribute('position', new THREE.BufferAttribute(new Float32Array(this.count * 3), 3));
    geometry.setAttribute('aRef', new THREE.BufferAttribute(ref, 2));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));

    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uPosTex: { value: null },
        uVelTex: { value: null },
        uTargetA: this.sim.uTargetA,
        uTargetB: this.sim.uTargetB,
        uAltA: this.sim.uAltA,
        uAltB: this.sim.uAltB,
        uLucidA: this.sim.uLucidA,
        uLucidB: this.sim.uLucidB,
        uLensRadius: this.sim.uLensRadius,
        uRayOrigin: this.sim.uRayOrigin,
        uRayDir: this.sim.uRayDir,
        uCentreDepth: { value: 10 },
        uSpotA: { value: new THREE.Vector4() },
        uSpotB: { value: new THREE.Vector4() },
        uTime: this.sim.uTime,
        uSize: { value: 2.5 },
        uScale: { value: 10 },
        uOpacity: { value: 0.85 },
        uHeat: { value: 1 },
      },
      vertexShader: particleVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.uniforms = this.material.uniforms;

    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
    this.publish();
  }

  dispose() {
    this.gpu.dispose();
    this.textures?.forEach((texture) => texture.dispose());
    this.points?.geometry.dispose();
    this.material?.dispose();
  }

  setFormations(a, b) {
    this.sim.uTargetA.value = this.targets[a];
    this.sim.uTargetB.value = this.targets[b];
    this.sim.uAltA.value = this.alts[a];
    this.sim.uAltB.value = this.alts[b];
  }

  step(time, delta) {
    this.sim.uTime.value = time;
    this.sim.uDelta.value = delta;
    this.posVar.material.uniforms.uDelta.value = delta;
    this.gpu.compute();
    this.publish();
  }

  publish() {
    this.uniforms.uPosTex.value = this.gpu.getCurrentRenderTarget(this.posVar).texture;
    this.uniforms.uVelTex.value = this.gpu.getCurrentRenderTarget(this.velVar).texture;
  }
}
