"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function VideoScrollSection({ isDark }: { isDark: boolean }) {
  const sectionRef = useRef<HTMLElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const section = sectionRef.current;
    const video = videoRef.current;
    if (!section || !video) return;

    const scrollTrigger = ScrollTrigger.create({
      trigger: section,
      start: "top 80%",
      once: true,
      onEnter: () => {
        video.currentTime = 0;
        video.play().catch(() => {});
      },
    });

    return () => scrollTrigger.kill();
  }, []);

  return (
    <section
      ref={sectionRef}
      className={`relative flex items-center justify-center py-20 ${
        isDark ? "bg-black" : "bg-gradient-to-b from-blue-50 to-purple-50"
      }`}
    >
      <div className="relative w-full max-w-2xl mx-auto px-4 overflow-hidden rounded-2xl shadow-2xl ring-2 ring-white/10">
        <video
          ref={videoRef}
          src="/me_drinking_coffee.mp4"
          className="w-full h-auto aspect-video object-cover"
          muted
          playsInline
          loop={false}
          preload="auto"
        />
        <div
          className={`absolute inset-0 pointer-events-none rounded-2xl ${
            isDark
              ? "shadow-[inset_0_0_80px_rgba(0,0,0,0.5)]"
              : "shadow-[inset_0_0_80px_rgba(255,255,255,0.2)]"
          }`}
        />
      </div>
    </section>
  );
}
