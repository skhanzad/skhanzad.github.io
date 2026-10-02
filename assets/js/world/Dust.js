import * as THREE from 'three';
import { dustVertex, particleFragment } from './shaders.js';

// Sparse, slow dust far behind the formations, so the camera's drift reads as depth.
export class Dust {
  constructor(count = 1600) {
    const position = new Float32Array(count * 3);
    const rand = new Float32Array(count);
    for (let i = 0; i < count; i++) {
      position[i * 3] = (Math.random() * 2 - 1) * 15;
      position[i * 3 + 1] = (Math.random() * 2 - 1) * 9;
      position[i * 3 + 2] = -20 + Math.random() * 22;
      rand[i] = Math.random();
    }
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.BufferAttribute(position, 3));
    geometry.setAttribute('aRand', new THREE.BufferAttribute(rand, 1));
    this.material = new THREE.ShaderMaterial({
      uniforms: {
        uTime: { value: 0 },
        uScale: { value: 10 },
        uOpacity: { value: 1 },
      },
      vertexShader: dustVertex,
      fragmentShader: particleFragment,
      transparent: true,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
    });
    this.uniforms = this.material.uniforms;
    this.points = new THREE.Points(geometry, this.material);
    this.points.frustumCulled = false;
  }

  dispose() {
    this.points.geometry.dispose();
    this.material.dispose();
  }

}
