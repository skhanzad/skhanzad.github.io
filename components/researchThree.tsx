"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { isDark: boolean };

/**
 * Research section WebGL: nucleus + nested wire shell + tilted orbital rings — distinct from hero / About / Work.
 */
export default function ResearchThreeBackdrop({ isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0.45, 0.1, 6.2);
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

    const core = isDark ? 0xe879f9 : 0xa855f7;
    const ringC = isDark ? 0x38bdf8 : 0x6366f1;
    const shell = isDark ? 0xf472b6 : 0xec4899;

    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.26 : 0.44);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, isDark ? 0.55 : 0.65);
    key.position.set(3, 5, 4);
    scene.add(key);
    const fill = new THREE.DirectionalLight(core, isDark ? 0.32 : 0.22);
    fill.position.set(-4, -1, -2);
    scene.add(fill);

    const root = new THREE.Group();
    scene.add(root);

    const nucleusGeo = new THREE.IcosahedronGeometry(0.42, 1);
    const nucleusMat = new THREE.MeshStandardMaterial({
      color: core,
      emissive: shell,
      emissiveIntensity: isDark ? 0.75 : 0.5,
      metalness: 0.35,
      roughness: 0.32,
    });
    const nucleus = new THREE.Mesh(nucleusGeo, nucleusMat);
    root.add(nucleus);

    const cageGeo = new THREE.DodecahedronGeometry(0.78, 0);
    const cageMat = new THREE.MeshStandardMaterial({
      color: ringC,
      wireframe: true,
      transparent: true,
      opacity: isDark ? 0.35 : 0.28,
    });
    const cage = new THREE.Mesh(cageGeo, cageMat);
    root.add(cage);

    const ringMat = new THREE.MeshBasicMaterial({
      color: ringC,
      transparent: true,
      opacity: isDark ? 0.38 : 0.3,
    });

    const ringGeoms: THREE.TorusGeometry[] = [];
    const rings: THREE.Mesh[] = [];
    const ringSpeeds: number[] = [];

    for (let i = 0; i < 5; i++) {
      const major = 1.05 + i * 0.32;
      const geo = new THREE.TorusGeometry(major, 0.013, 10, 128);
      ringGeoms.push(geo);
      const ring = new THREE.Mesh(geo, ringMat);
      ring.rotation.x = Math.PI / 2 + i * 0.31;
      ring.rotation.y = i * 0.74;
      ring.rotation.z = i * 0.21;
      root.add(ring);
      rings.push(ring);
      ringSpeeds.push(0.045 + i * 0.018);
    }

    const electronGeo = new THREE.SphereGeometry(0.055, 12, 12);
    const electronMat = new THREE.MeshStandardMaterial({
      color: shell,
      emissive: shell,
      emissiveIntensity: isDark ? 1.2 : 0.85,
      metalness: 0.15,
      roughness: 0.35,
    });
    const electrons = new THREE.Group();
    const eCount = 7;
    for (let i = 0; i < eCount; i++) {
      const m = new THREE.Mesh(electronGeo, electronMat);
      const ang = (i / eCount) * Math.PI * 2;
      const R = 1.85 + (i % 3) * 0.12;
      m.position.set(R * Math.cos(ang), Math.sin(i * 1.7) * 0.35, R * Math.sin(ang));
      electrons.add(m);
    }
    root.add(electrons);

    const disposables: THREE.BufferGeometry[] = [
      nucleusGeo,
      cageGeo,
      ...ringGeoms,
      electronGeo,
    ];
    const mats: THREE.Material[] = [nucleusMat, cageMat, ringMat, electronMat];

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

      nucleus.rotation.y = t * 0.5;
      nucleus.rotation.x = Math.sin(t * 0.25) * 0.15;

      cage.rotation.y = -t * 0.28;
      cage.rotation.z = t * 0.19;

      rings.forEach((ring, i) => {
        ring.rotation.z += ringSpeeds[i] * 0.016;
        ring.rotation.x += Math.sin(t * 0.2 + i) * 0.0008;
      });

      electrons.rotation.y = t * 0.65;
      electrons.rotation.x = Math.sin(t * 0.15) * 0.2;

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
      disposables.forEach((g) => g.dispose());
      mats.forEach((m) => m.dispose());
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
