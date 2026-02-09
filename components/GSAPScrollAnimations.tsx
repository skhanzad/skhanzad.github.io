"use client";

import { useEffect, useRef } from "react";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";

gsap.registerPlugin(ScrollTrigger);

export default function GSAPScrollAnimations() {
  const initialized = useRef(false);

  useEffect(() => {
    if (initialized.current) return;
    initialized.current = true;

    const ctx = gsap.context(() => {
      // Text spell-out loop: letters always visible, each letter emphasized one-by-one slowly in a loop
      gsap.utils.toArray<HTMLElement>("[data-gsap='text-reveal'], [data-gsap='text-reveal-initial']").forEach((container) => {
        const chars = container.querySelectorAll<HTMLElement>("[data-gsap='text-word']");
        const inners = Array.from(chars)
          .map((el) => el.querySelector("span"))
          .filter(Boolean) as HTMLElement[];
        if (inners.length === 0) return;

        const tl = gsap.timeline({ repeat: -1, repeatDelay: 1.5 });
        const durationPerLetter = 0.7;
        inners.forEach((inner, i) => {
          tl.to(
            inner,
            {
              scale: 1.12,
              duration: durationPerLetter * 0.6,
              yoyo: true,
              repeat: 1,
              ease: "sine.inOut",
            },
            i * durationPerLetter
          );
        });
      });

      // Section headers: fade up + slight scale
      gsap.utils.toArray<HTMLElement>("[data-gsap='section-header']").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 80, opacity: 0, scale: 0.95 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              end: "top 50%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Section underline bars: scale from center
      gsap.utils.toArray<HTMLElement>("[data-gsap='section-underline']").forEach((el) => {
        gsap.fromTo(
          el,
          { scaleX: 0, transformOrigin: "center center" },
          {
            scaleX: 1,
            duration: 0.8,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el.closest("[data-gsap='section-header']") || el,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Content blocks: stagger fade up with delay
      gsap.utils.toArray<HTMLElement>("[data-gsap='stagger-group']").forEach((group) => {
        const children = group.querySelectorAll("[data-gsap='stagger-item']");
        gsap.fromTo(
          children,
          { y: 60, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            stagger: 0.12,
            ease: "power3.out",
            scrollTrigger: {
              trigger: group,
              start: "top 82%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Cards: scale in + fade with subtle rotation
      gsap.utils.toArray<HTMLElement>("[data-gsap='card-reveal']").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 50, opacity: 0, scale: 0.92, rotationX: -8 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            rotationX: 0,
            duration: 0.9,
            ease: "back.out(1.1)",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Skill tags: quick pop-in stagger
      gsap.utils.toArray<HTMLElement>("[data-gsap='skills-group']").forEach((group) => {
        const tags = group.querySelectorAll("[data-gsap='skill-tag']");
        gsap.fromTo(
          tags,
          { scale: 0, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.4,
            stagger: 0.04,
            ease: "back.out(1.4)",
            scrollTrigger: {
              trigger: group,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Timeline items: slide in from alternating sides
      gsap.utils.toArray<HTMLElement>("[data-gsap='timeline-item']").forEach((el, i) => {
        const direction = i % 2 === 0 ? -1 : 1;
        gsap.fromTo(
          el,
          { x: 80 * direction, opacity: 0 },
          {
            x: 0,
            opacity: 1,
            duration: 0.9,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Publication cards: slide up with blur-in effect
      gsap.utils.toArray<HTMLElement>("[data-gsap='pub-card']").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 70, opacity: 0, filter: "blur(8px)" },
          {
            y: 0,
            opacity: 1,
            filter: "blur(0px)",
            duration: 0.85,
            delay: i * 0.08,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 90%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Contact cards: 3D flip-in feel
      gsap.utils.toArray<HTMLElement>("[data-gsap='contact-card']").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 40, opacity: 0, rotationY: -15 },
          {
            y: 0,
            opacity: 1,
            rotationY: 0,
            duration: 0.8,
            delay: i * 0.1,
            ease: "power2.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Hero stats: pop in on load
      gsap.utils.toArray<HTMLElement>("[data-gsap='stat-item']").forEach((el, i) => {
        gsap.fromTo(
          el,
          { scale: 0.5, opacity: 0 },
          {
            scale: 1,
            opacity: 1,
            duration: 0.6,
            delay: 1.2 + i * 0.1,
            ease: "back.out(1.2)",
            scrollTrigger: {
              trigger: el.closest("main") || el,
              start: "top top",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Parallax on floating background shapes in sections
      gsap.utils.toArray<HTMLElement>("[data-gsap='parallax-shape']").forEach((el, i) => {
        const speed = (i % 2 === 0 ? 1 : -1) * (30 + i * 15);
        gsap.to(el, {
          y: speed,
          ease: "none",
          scrollTrigger: {
            trigger: el.closest("section"),
            start: "top bottom",
            end: "bottom top",
            scrub: 1.5,
          },
        });
      });

      // Research section: Main Research Focus block (big card with icon + intro)
      gsap.utils.toArray<HTMLElement>("[data-gsap='research-focus-block']").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 60, opacity: 0, scale: 0.97 },
          {
            y: 0,
            opacity: 1,
            scale: 1,
            duration: 1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Research section: Research area cards (stagger)
      gsap.utils.toArray<HTMLElement>("[data-gsap='research-area']").forEach((el, i) => {
        gsap.fromTo(
          el,
          { y: 40, opacity: 0, rotationX: -6 },
          {
            y: 0,
            opacity: 1,
            rotationX: 0,
            duration: 0.75,
            delay: i * 0.1,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el.closest("[data-gsap='research-areas-group']") || el,
              start: "top 82%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Research section: Publications subsection header
      gsap.utils.toArray<HTMLElement>("[data-gsap='subsection-header']").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 50, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 85%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });

      // Research section: CTA block
      gsap.utils.toArray<HTMLElement>("[data-gsap='research-cta']").forEach((el) => {
        gsap.fromTo(
          el,
          { y: 40, opacity: 0 },
          {
            y: 0,
            opacity: 1,
            duration: 0.8,
            ease: "power3.out",
            scrollTrigger: {
              trigger: el,
              start: "top 88%",
              toggleActions: "play none none reverse",
            },
          }
        );
      });
    });

    return () => ctx.revert();
  }, []);

  return null;
}
