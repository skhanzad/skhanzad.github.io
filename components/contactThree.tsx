"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { isDark: boolean };

/**
 * Contact section WebGL: pulsing concentric rings + core + orbit shards — distinct from other sections.
 */
export default function ContactThreeBackdrop({ isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(-0.52, 0.12, 6.35);
    camera.lookAt(0, 0, 0);

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

    const teal = isDark ? 0x22d3ee : 0x0891b2;
    const violet = isDark ? 0xc084fc : 0x7c3aed;
    const coreC = isDark ? 0x93c5fd : 0x3b82f6;

    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.24 : 0.42);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, isDark ? 0.52 : 0.62);
    key.position.set(-3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(teal, isDark ? 0.38 : 0.28);
    fill.position.set(4, 1, -2);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    const ringMat = new THREE.MeshBasicMaterial({
      color: teal,
      transparent: true,
      opacity: isDark ? 0.32 : 0.26,
    });

    const ringGeoms: THREE.TorusGeometry[] = [];
    const rings: THREE.Mesh[] = [];
    const ringPhases: number[] = [];

    for (let i = 0; i < 7; i++) {
      const major = 0.42 + i * 0.34;
      const geo = new THREE.TorusGeometry(major, 0.016, 10, 96);
      ringGeoms.push(geo);
      const ring = new THREE.Mesh(geo, ringMat);
      ring.rotation.x = Math.PI / 2;
      ring.rotation.z = i * 0.18;
      root.add(ring);
      rings.push(ring);
      ringPhases.push(i * 0.55);
    }

    const coreGeo = new THREE.OctahedronGeometry(0.36, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: coreC,
      emissive: violet,
      emissiveIntensity: isDark ? 0.65 : 0.45,
      metalness: 0.4,
      roughness: 0.28,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    root.add(core);

    const shardGeo = new THREE.TetrahedronGeometry(0.12, 0);
    const shardMat = new THREE.MeshStandardMaterial({
      color: violet,
      emissive: teal,
      emissiveIntensity: isDark ? 0.55 : 0.4,
      metalness: 0.35,
      roughness: 0.4,
      transparent: true,
      opacity: 0.92,
    });
    const shards = new THREE.Group();
    const shardCount = 5;
    for (let i = 0; i < shardCount; i++) {
      const s = new THREE.Mesh(shardGeo, shardMat);
      const a = (i / shardCount) * Math.PI * 2;
      const R = 2.15;
      s.position.set(R * Math.cos(a), Math.sin(i * 2.1) * 0.4, R * Math.sin(a));
      s.rotation.set(i * 0.7, a, i * 0.4);
      shards.add(s);
    }
    root.add(shards);

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

      rings.forEach((ring, i) => {
        const pulse = 1 + 0.1 * Math.sin(t * 1.35 - ringPhases[i]);
        ring.scale.setScalar(pulse);
        ring.rotation.z += 0.003 + i * 0.0004;
      });

      core.rotation.y = t * 0.55;
      core.rotation.x = Math.sin(t * 0.22) * 0.2;
      const corePulse = 1 + 0.06 * Math.sin(t * 2.8);
      core.scale.setScalar(corePulse);

      shards.rotation.y = t * 0.48;
      shards.rotation.x = Math.sin(t * 0.12) * 0.15;

      root.rotation.y = Math.sin(t * 0.08) * 0.08;

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
      ringGeoms.forEach((g) => g.dispose());
      ringMat.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      shardGeo.dispose();
      shardMat.dispose();
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
