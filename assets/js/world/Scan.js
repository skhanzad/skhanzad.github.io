import * as THREE from 'three';
import { scanVertex, scanFragment } from './shaders.js';

// The audit scanner of the mind formation: a calibrated ring with a sheet of light,
// carried down through the mind at its scan level (a CT gantry, more or less).
export class Scan {
  constructor({ centre, extent }) {
    this.uniforms = {
      uPlace: { value: new THREE.Matrix4() },
      uLevel: { value: 0 },
      uExtent: { value: new THREE.Vector2(...extent) },
      uCentre: { value: new THREE.Vector3(...centre) },
      uOpacity: { value: 0 },
      uTime: { value: 0 },
    };
    // A disc in the xy plane, -1..1; the vertex shader lays it flat in the formation.
    const geometry = new THREE.CircleGeometry(1, 128);
    this.object = new THREE.Mesh(
      geometry,
      new THREE.ShaderMaterial({
        uniforms: this.uniforms,
        vertexShader: scanVertex,
        fragmentShader: scanFragment,
        transparent: true,
        depthWrite: false,
        depthTest: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
      }),
    );
    this.object.frustumCulled = false;
    this.object.visible = false;
  }

  dispose() {
    this.object.geometry.dispose();
    this.object.material.dispose();
  }
}
