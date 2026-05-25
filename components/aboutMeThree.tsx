"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

type Props = { isDark: boolean };

/**
 * Section-sized WebGL backdrop: torus knot + particle halo — distinct from the hero snake field.
 */
export default function AboutMeThreeBackdrop({ isDark }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(42, 1, 0.1, 100);
    camera.position.set(0.55, 0.12, 5.8);

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

    const main = isDark ? 0x9d7cff : 0x6d28d9;
    const accent = isDark ? 0xff6ec7 : 0xd946ef;

    const ambient = new THREE.AmbientLight(0xffffff, isDark ? 0.28 : 0.45);
    scene.add(ambient);
    const key = new THREE.DirectionalLight(0xffffff, isDark ? 0.55 : 0.65);
    key.position.set(3, 4, 5);
    scene.add(key);
    const fill = new THREE.DirectionalLight(accent, isDark ? 0.22 : 0.18);
    fill.position.set(-4, -1, -3);
    scene.add(fill);

    const knotGroup = new THREE.Group();
    scene.add(knotGroup);

    const tkWire = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.12, 0.34, 128, 16),
      new THREE.MeshStandardMaterial({
        color: main,
        wireframe: true,
        transparent: true,
        opacity: isDark ? 0.42 : 0.32,
      })
    );
    knotGroup.add(tkWire);

    const tkGlow = new THREE.Mesh(
      new THREE.TorusKnotGeometry(1.02, 0.3, 96, 14),
      new THREE.MeshStandardMaterial({
        color: main,
        emissive: accent,
        emissiveIntensity: isDark ? 0.45 : 0.28,
        transparent: true,
        opacity: isDark ? 0.14 : 0.1,
        metalness: 0.35,
        roughness: 0.55,
      })
    );
    knotGroup.add(tkGlow);

    const ringGeom = new THREE.TorusGeometry(2.35, 0.012, 12, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: accent,
      transparent: true,
      opacity: isDark ? 0.35 : 0.28,
    });
    const ring = new THREE.Mesh(ringGeom, ringMat);
    ring.rotation.x = Math.PI / 2.35;
    scene.add(ring);

    const particleCount = 900;
    const pos = new Float32Array(particleCount * 3);
    const rnd = (a: number, b: number) => a + Math.random() * (b - a);
    for (let i = 0; i < particleCount; i++) {
      const u = Math.random() * Math.PI * 2;
      const v = Math.acos(2 * Math.random() - 1);
      const r = rnd(2.05, 2.85) + (Math.random() - 0.5) * 0.15;
      const sinV = Math.sin(v);
      pos[i * 3] = r * sinV * Math.cos(u);
      pos[i * 3 + 1] = r * sinV * Math.sin(u);
      pos[i * 3 + 2] = r * Math.cos(v);
    }
    const pGeom = new THREE.BufferGeometry();
    pGeom.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    const points = new THREE.Points(
      pGeom,
      new THREE.PointsMaterial({
        color: accent,
        size: isDark ? 0.045 : 0.038,
        transparent: true,
        opacity: isDark ? 0.55 : 0.42,
        depthWrite: false,
        sizeAttenuation: true,
      })
    );
    scene.add(points);

    const coreGeom = new THREE.IcosahedronGeometry(0.22, 0);
    const coreMat = new THREE.MeshStandardMaterial({
      color: accent,
      emissive: accent,
      emissiveIntensity: isDark ? 1.1 : 0.75,
      metalness: 0.2,
      roughness: 0.35,
    });
    const core = new THREE.Mesh(coreGeom, coreMat);
    knotGroup.add(core);

    const disposables: Array<THREE.BufferGeometry | THREE.Material> = [
      tkWire.geometry,
      tkWire.material,
      tkGlow.geometry,
      tkGlow.material,
      ringGeom,
      ringMat,
      pGeom,
      points.material as THREE.Material,
      coreGeom,
      coreMat,
    ];

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

      knotGroup.rotation.x = t * 0.31;
      knotGroup.rotation.y = t * 0.42;
      knotGroup.rotation.z = Math.sin(t * 0.2) * 0.12;

      ring.rotation.z = t * 0.18;
      ring.rotation.y = t * 0.11;

      points.rotation.y = t * 0.08;
      points.rotation.x = t * 0.05;

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
      disposables.forEach((d) => {
        if ("dispose" in d) d.dispose();
      });
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
