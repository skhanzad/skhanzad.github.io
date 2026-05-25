"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { isDark: boolean };

/**
 * Work section WebGL: vertical helix of boxes + perspective grid — distinct from hero snakes and About torus knot.
 */
export default function WorkTimelineThreeBackdrop({ isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(40, 1, 0.1, 100);
    camera.position.set(-0.5, 0.35, 6.4);
    camera.lookAt(0, 0.2, 0);

    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: "low-power",
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setClearColor(0x000000, 0);
    renderer.domElement.style.cssText =
      "position:absolute;inset:0;width:100%;height:100%;display:block;pointer-events:none";
    container.appendChild(renderer.domElement);

    const blue = isDark ? 0x38bdf8 : 0x0284c7;
    const violet = isDark ? 0xa78bfa : 0x7c3aed;

    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.22 : 0.42);
    scene.add(ambient);
    const dir = new THREE.DirectionalLight(0xffffff, isDark ? 0.55 : 0.62);
    dir.position.set(-2, 5, 4);
    scene.add(dir);
    const rim = new THREE.DirectionalLight(blue, isDark ? 0.35 : 0.28);
    rim.position.set(4, 2, -3);
    scene.add(rim);

    const root = new THREE.Group();
    scene.add(root);

    const helixCount = 128;
    const boxGeo = new THREE.BoxGeometry(0.1, 0.08, 0.16);
    const boxMat = new THREE.MeshStandardMaterial({
      color: blue,
      emissive: violet,
      emissiveIntensity: isDark ? 0.55 : 0.38,
      metalness: 0.45,
      roughness: 0.38,
      transparent: true,
      opacity: isDark ? 0.88 : 0.82,
    });
    const helix = new THREE.InstancedMesh(boxGeo, boxMat, helixCount);
    const dummy = new THREE.Object3D();
    const helixR = 1.22;
    const pitch = 0.095;
    const angleStep = 0.38;

    for (let i = 0; i < helixCount; i++) {
      const angle = i * angleStep;
      const y = -5.8 + i * pitch;
      const x = helixR * Math.cos(angle);
      const z = helixR * Math.sin(angle);
      dummy.position.set(x, y, z);
      dummy.rotation.y = -angle + Math.PI / 2;
      dummy.rotation.z = Math.sin(angle * 0.5) * 0.08;
      const s = 0.85 + (i % 5) * 0.04;
      dummy.scale.setScalar(s);
      dummy.updateMatrix();
      helix.setMatrixAt(i, dummy.matrix);
    }
    helix.instanceMatrix.needsUpdate = true;
    root.add(helix);

    const helix2Count = 96;
    const helix2 = new THREE.InstancedMesh(boxGeo, boxMat, helix2Count);
    const r2 = 0.72;
    const pitch2 = 0.125;
    for (let i = 0; i < helix2Count; i++) {
      const angle = i * 0.52 + Math.PI * 0.92;
      const y = -5.2 + i * pitch2;
      const x = r2 * Math.cos(angle);
      const z = r2 * Math.sin(angle);
      dummy.position.set(x, y, z);
      dummy.rotation.y = -angle;
      dummy.rotation.x = 0.15;
      dummy.scale.setScalar(0.72);
      dummy.updateMatrix();
      helix2.setMatrixAt(i, dummy.matrix);
    }
    helix2.instanceMatrix.needsUpdate = true;
    root.add(helix2);

    const spineGeo = new THREE.CylinderGeometry(0.04, 0.06, 12.5, 10, 1, true);
    const spineMat = new THREE.MeshStandardMaterial({
      color: violet,
      emissive: blue,
      emissiveIntensity: isDark ? 0.4 : 0.28,
      transparent: true,
      opacity: isDark ? 0.22 : 0.16,
      side: THREE.DoubleSide,
      metalness: 0.2,
      roughness: 0.6,
    });
    const spine = new THREE.Mesh(spineGeo, spineMat);
    spine.position.y = 0.1;
    root.add(spine);

    const grid = new THREE.GridHelper(16, 24, blue, violet);
    grid.traverse((obj) => {
      const line = obj as THREE.LineSegments;
      if (line.material) {
        const mats = Array.isArray(line.material)
          ? line.material
          : [line.material];
        for (const m of mats) {
          const mat = m as THREE.LineBasicMaterial;
          mat.transparent = true;
          mat.opacity = isDark ? 0.14 : 0.1;
        }
      }
    });
    grid.position.y = -5.85;
    grid.scale.setScalar(1.05);
    root.add(grid);

    const clock = new THREE.Clock();

    const setSize = () => {
      const w = Math.max(1, container.clientWidth);
      const h = Math.max(1, container.clientHeight);
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    setSize();

    const ro = new ResizeObserver(setSize);
    ro.observe(container);

    let raf = 0;
    let running = true;

    const tick = () => {
      if (!running) {
        raf = 0;
        return;
      }
      raf = requestAnimationFrame(tick);

      const t = clock.getElapsedTime();
      root.rotation.y = t * 0.11;
      root.rotation.x = Math.sin(t * 0.08) * 0.06;
      spine.rotation.y = t * 0.35;

      renderer.render(scene, camera);
    };

    const startLoop = () => {
      if (raf || !running) return;
      raf = requestAnimationFrame(tick);
    };

    const stopLoop = () => {
      running = false;
      if (raf) {
        cancelAnimationFrame(raf);
        raf = 0;
      }
    };

    const io = new IntersectionObserver(
      ([e]) => {
        const vis = e?.isIntersecting ?? true;
        if (vis) {
          running = true;
          startLoop();
        } else {
          stopLoop();
        }
      },
      { root: null, rootMargin: "80px", threshold: 0 }
    );
    io.observe(container);

    running = true;
    startLoop();

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      boxGeo.dispose();
      boxMat.dispose();
      spineGeo.dispose();
      spineMat.dispose();
      grid.geometry.dispose();
      const gm = grid.material;
      if (Array.isArray(gm)) gm.forEach((m) => m.dispose());
      else gm.dispose();
      renderer.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, [isDark]);

  return (
    <div
      ref={containerRef}
      className="pointer-events-none absolute inset-0 z-0 h-full min-h-[280px] w-full"
      aria-hidden
    />
  );
}
