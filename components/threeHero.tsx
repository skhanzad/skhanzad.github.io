"use client";
import { useEffect, useRef } from "react";
import * as THREE from "three";

/** Point along polyline `path` (newest-first: [head, ...]) at arc length `dist` from head. */
function pointAtDistance(path: THREE.Vector3[], dist: number): THREE.Vector3 {
  if (path.length === 0) return new THREE.Vector3();
  if (dist <= 0) return path[0].clone();

  let remaining = dist;
  for (let i = 0; i < path.length - 1; i++) {
    const p0 = path[i];
    const p1 = path[i + 1];
    const segDist = p0.distanceTo(p1);
    if (remaining <= segDist) {
      const t = segDist > 1e-6 ? remaining / segDist : 0;
      return p0.clone().lerp(p1, t);
    }
    remaining -= segDist;
  }
  return path[path.length - 1].clone();
}

type PathKind = "knot" | "lissajous" | "torus" | "diagonal";

/** Base spatial scale for parametric paths (larger = wider sweeps). */
const PATH_BASE = 2.55;

function headPosition(
  t: number,
  opts: {
    phase: number;
    scale: number;
    zAmp: number;
    path: PathKind;
    /** Frequency multipliers inside the parametric path (spreads motion in space). */
    pathFreq: { x: number; y: number; z: number };
  }
): THREE.Vector3 {
  const { phase, scale, zAmp, path: kind, pathFreq } = opts;
  const a = PATH_BASE * scale;
  const tp = t + phase;
  const fx = pathFreq.x * tp;
  const fy = pathFreq.y * tp;
  const fz = pathFreq.z * tp;

  if (kind === "knot") {
    const u = ((pathFreq.x + pathFreq.y) * 0.5) * tp;
    return new THREE.Vector3(
      a * Math.cos(u) * (1 + 0.34 * Math.cos(3 * u)),
      a * Math.sin(u) * (1 + 0.34 * Math.cos(3 * u)),
      zAmp * a * 0.72 * Math.sin(2 * fz)
    );
  }

  if (kind === "lissajous") {
    return new THREE.Vector3(
      a * 1.08 * Math.sin(2 * fx + 0.4),
      a * 1.02 * Math.sin(3 * fy),
      zAmp * a * 0.68 * Math.sin(fz)
    );
  }

  if (kind === "diagonal") {
    const w = a * 1.12;
    // Coupled XY + different phase on secondary term → wide diagonal-ish ribbons in 3D
    return new THREE.Vector3(
      w * Math.sin(fx) + w * 0.58 * Math.cos(1.65 * fy),
      w * Math.sin(fx) - w * 0.58 * Math.cos(1.65 * fy),
      zAmp * a * 0.78 * Math.sin(1.2 * fz)
    );
  }

  // torus: major circle in XY, poloidal wobble in Z
  const R = a * 1.02;
  const r = a * 0.46;
  return new THREE.Vector3(
    (R + r * Math.cos(fz)) * Math.cos(fx),
    (R + r * Math.cos(fz)) * Math.sin(fx),
    zAmp * r * Math.sin(fz)
  );
}

type SnakeLayer = {
  /** Extra world offset after the parametric path (positions snakes around the canvas). */
  offset: THREE.Vector3;
  /** Three.js draw order when transparent (higher ≈ on top). */
  renderOrder: number;
  opacity: number;
  hue: number;
  hueSpread: number;
  timeScale: number;
  phase: number;
  scale: number;
  zAmp: number;
  emissiveMul: number;
  path: PathKind;
  pathFreq: { x: number; y: number; z: number };
  /** Local Euler rotation (rad) on the path before `offset` — reads as diagonal / tilted motion. */
  rotate: { x: number; y: number; z: number };
  headLight: boolean;
};

const SNAKE_LAYERS: SnakeLayer[] = [
  {
    offset: new THREE.Vector3(-3.55, 1.95, -2.05),
    renderOrder: 0,
    opacity: 0.18,
    hue: 0.52,
    hueSpread: 0.06,
    timeScale: 0.72,
    phase: 1.9,
    scale: 0.78,
    zAmp: 1.05,
    emissiveMul: 0.4,
    path: "diagonal",
    pathFreq: { x: 1, y: 1.03, z: 0.97 },
    rotate: { x: 0.12, y: Math.PI / 4, z: -0.08 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(3.65, 1.55, -1.55),
    renderOrder: 1,
    opacity: 0.22,
    hue: 0.58,
    hueSpread: 0.07,
    timeScale: 0.78,
    phase: 2.4,
    scale: 0.74,
    zAmp: 1.18,
    emissiveMul: 0.45,
    path: "knot",
    pathFreq: { x: 0.92, y: 0.95, z: 1.08 },
    rotate: { x: -0.18, y: -Math.PI / 3.2, z: 0.22 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(-2.85, -2.35, -0.85),
    renderOrder: 2,
    opacity: 0.28,
    hue: 0.62,
    hueSpread: 0.08,
    timeScale: 0.66,
    phase: 0.35,
    scale: 0.72,
    zAmp: 1.12,
    emissiveMul: 0.5,
    path: "torus",
    pathFreq: { x: 1.05, y: 1, z: 1.12 },
    rotate: { x: 0.28, y: Math.PI / 5, z: -0.15 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(2.75, -2.15, 0.45),
    renderOrder: 3,
    opacity: 0.38,
    hue: 0.7,
    hueSpread: 0.08,
    timeScale: 0.88,
    phase: -0.8,
    scale: 0.88,
    zAmp: 1.2,
    emissiveMul: 0.65,
    path: "diagonal",
    pathFreq: { x: 1.1, y: 0.88, z: 1.02 },
    rotate: { x: -0.22, y: Math.PI / 2.45, z: 0.18 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(0.15, 2.65, -0.65),
    renderOrder: 4,
    opacity: 0.42,
    hue: 0.74,
    hueSpread: 0.09,
    timeScale: 0.95,
    phase: 3.1,
    scale: 0.82,
    zAmp: 0.92,
    emissiveMul: 0.7,
    path: "torus",
    pathFreq: { x: 0.88, y: 0.88, z: 0.95 },
    rotate: { x: 0.35, y: -Math.PI / 6, z: 0.1 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(-1.35, 0.25, 0.75),
    renderOrder: 5,
    opacity: 0.52,
    hue: 0.78,
    hueSpread: 0.09,
    timeScale: 1,
    phase: 0,
    scale: 1.05,
    zAmp: 1.15,
    emissiveMul: 0.85,
    path: "knot",
    pathFreq: { x: 1, y: 1, z: 1 },
    rotate: { x: 0.08, y: Math.PI / 5.5, z: 0 },
    headLight: true,
  },
  {
    offset: new THREE.Vector3(1.55, -0.95, 1.25),
    renderOrder: 6,
    opacity: 0.48,
    hue: 0.82,
    hueSpread: 0.07,
    timeScale: 1.05,
    phase: -1.9,
    scale: 0.92,
    zAmp: 1.1,
    emissiveMul: 0.8,
    path: "lissajous",
    pathFreq: { x: 0.95, y: 1.12, z: 1.05 },
    rotate: { x: -0.32, y: Math.PI / 3.8, z: -0.2 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(-0.55, -1.35, 1.85),
    renderOrder: 7,
    opacity: 0.72,
    hue: 0.88,
    hueSpread: 0.06,
    timeScale: 1.08,
    phase: 1.55,
    scale: 0.98,
    zAmp: 1.08,
    emissiveMul: 0.95,
    path: "diagonal",
    pathFreq: { x: 1.12, y: 1.12, z: 1.0 },
    rotate: { x: 0.2, y: -Math.PI / 4.2, z: 0.28 },
    headLight: false,
  },
  {
    offset: new THREE.Vector3(3.35, -1.15, 1.05),
    renderOrder: 8,
    opacity: 0.88,
    hue: 0.93,
    hueSpread: 0.06,
    timeScale: 1.12,
    phase: -1.25,
    scale: 0.9,
    zAmp: 1.12,
    emissiveMul: 1.05,
    path: "knot",
    pathFreq: { x: 1.06, y: 0.98, z: 1.04 },
    rotate: { x: 0.15, y: Math.PI / 2.2, z: -0.12 },
    headLight: false,
  },
];

const SEGMENT_COUNT = 28;
const segmentSpacing = 0.175;
const PATH_CAP = 560;

export default function ThreeHero() {
  const mountRef = useRef<HTMLDivElement>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const animationRef = useRef<number | null>(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      48,
      window.innerWidth / window.innerHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 9.6);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    rendererRef.current = renderer;

    mount.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.35);
    scene.add(ambient);

    const dir = new THREE.DirectionalLight(0xffffff, 0.85);
    dir.position.set(4, 6, 5);
    scene.add(dir);

    const rim = new THREE.DirectionalLight(0xa78bfa, 0.45);
    rim.position.set(-5, -2, -4);
    scene.add(rim);

    const sharedGeometries: THREE.BufferGeometry[] = [];
    for (let i = 0; i < SEGMENT_COUNT; i++) {
      const t = i / (SEGMENT_COUNT - 1);
      const radius = 0.22 * (1 - t * 0.65) + 0.06;
      sharedGeometries.push(new THREE.SphereGeometry(radius, 24, 24));
    }

    const materials: THREE.MeshStandardMaterial[] = [];

    type SnakeInst = {
      layer: SnakeLayer;
      path: THREE.Vector3[];
      meshes: THREE.Mesh[];
    };

    const snakes: SnakeInst[] = SNAKE_LAYERS.map((layer) => {
      const path: THREE.Vector3[] = [];
      const meshes: THREE.Mesh[] = [];
      for (let i = 0; i < SEGMENT_COUNT; i++) {
        const t = i / (SEGMENT_COUNT - 1);
        const mat = new THREE.MeshStandardMaterial({
          color: new THREE.Color().setHSL(
            layer.hue - t * layer.hueSpread,
            0.72,
            0.52
          ),
          emissive: new THREE.Color().setHSL(layer.hue, 0.9, 0.25),
          emissiveIntensity:
            (0.35 + (1 - t) * 0.25) * layer.emissiveMul,
          metalness: 0.25,
          roughness: 0.42,
          transparent: layer.opacity < 0.999,
          opacity: layer.opacity,
          depthWrite: layer.opacity >= 0.88,
        });
        materials.push(mat);
        const mesh = new THREE.Mesh(sharedGeometries[i], mat);
        mesh.renderOrder = layer.renderOrder;
        scene.add(mesh);
        meshes.push(mesh);
      }
      return { layer, path, meshes };
    });

    const headLight = new THREE.PointLight(0xe879f9, 2.2, 8, 2);
    scene.add(headLight);

    const pathEuler = new THREE.Euler(0, 0, 0, "XYZ");
    const pathQuat = new THREE.Quaternion();

    let time = 0;

    const animate = () => {
      animationRef.current = requestAnimationFrame(animate);

      time += 0.011;

      for (const snake of snakes) {
        const { layer, path, meshes } = snake;
        const head = headPosition(time * layer.timeScale, {
          phase: layer.phase,
          scale: layer.scale,
          zAmp: layer.zAmp,
          path: layer.path,
          pathFreq: layer.pathFreq,
        });
        pathEuler.set(layer.rotate.x, layer.rotate.y, layer.rotate.z);
        pathQuat.setFromEuler(pathEuler);
        head.applyQuaternion(pathQuat);
        head.add(layer.offset);

        path.unshift(head.clone());
        if (path.length > PATH_CAP) path.pop();

        for (let i = 0; i < SEGMENT_COUNT; i++) {
          const pos = pointAtDistance(path, i * segmentSpacing);
          meshes[i].position.copy(pos);
        }

        if (layer.headLight) {
          headLight.position.copy(meshes[0].position);
        }
      }

      renderer.render(scene, camera);
    };

    animate();

    const handleResize = () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      if (animationRef.current) cancelAnimationFrame(animationRef.current);
      sharedGeometries.forEach((g) => g.dispose());
      materials.forEach((m) => m.dispose());
      renderer.dispose();
      if (mount.contains(renderer.domElement)) {
        mount.removeChild(renderer.domElement);
      }
      window.removeEventListener("resize", handleResize);
    };
  }, []);

  return (
    <div
      ref={mountRef}
      className="absolute inset-0 pointer-events-none z-[-10]"
      style={{ zIndex: 0 }}
    />
  );
}
