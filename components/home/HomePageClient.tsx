"use client";

import type { CSSProperties } from "react";
import { useState, useEffect } from "react";
import { SunIcon, MoonIcon, ArrowRightIcon, SparklesIcon } from "lucide-react";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import { motion } from "framer-motion";
import ThreeHero from "@/components/threeHero";
import AboutMe from "@/components/aboutMe";
import WorkTimeline from "@/components/workTimeline";
import Research from "@/components/research";
import Contact from "@/components/contact";
import ScrollToTop from "@/components/scrollToTop";
import GSAPScrollAnimations from "@/components/GSAPScrollAnimations";
import VideoScrollSection from "@/components/VideoScrollSection";
import AnimatedText from "@/components/AnimatedText";

type Props = {
  /** Server-rendered featured posts (passed as a slot from the App Router page). */
  featured?: React.ReactNode;
};

export default function HomePageClient({ featured }: Props) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setIsDark(true);
    }
  }, []);

  return (
    <>
      <GSAPScrollAnimations />
      <Nav isDark={isDark} />
      <ThreeHero />
      <div
        className={`h-20 ${
          isDark
            ? "bg-gradient-to-br from-black via-slate-900 to-black text-white"
            : "bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900"
        }`}
      />
      <div
        className={`min-h-screen transition-colors duration-500 ${
          isDark
            ? "bg-gradient-to-br from-black via-slate-900 to-black text-white"
            : "bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900"
        }`}
      >
        <button
          type="button"
          onClick={() => setIsDark(!isDark)}
          className={`fixed top-24 right-6 z-50 rounded-full p-3 transition-all duration-300 ${
            isDark
              ? "bg-white/10 text-yellow-300 hover:bg-white/20"
              : "bg-gray-900/10 text-gray-700 hover:bg-gray-900/20"
          } backdrop-blur-sm`}
          aria-label={isDark ? "Switch to light mode" : "Switch to dark mode"}
        >
          {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
        </button>

        <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6">
          <div className="absolute inset-0 overflow-hidden">
            <div
              className={`absolute -top-40 -right-40 h-80 w-80 rounded-full blur-3xl ${
                isDark ? "bg-purple-500 opacity-30" : "bg-blue-400 opacity-20"
              }`}
            />
            <div
              className={`absolute -bottom-40 -left-40 h-80 w-80 rounded-full blur-3xl ${
                isDark ? "bg-blue-500 opacity-30" : "bg-purple-400 opacity-20"
              }`}
            />
          </div>

          <motion.div
            animate={{
              y: [0, -20, 0],
              rotate: [0, 5, 0],
            }}
            transition={{
              duration: 6,
              repeat: Infinity,
              ease: "easeInOut",
            }}
            className={`absolute left-20 top-32 text-4xl opacity-20 ${
              isDark ? "text-purple-300" : "text-purple-400"
            }`}
          >
            <SparklesIcon size={40} />
          </motion.div>

          <motion.div
            animate={{
              y: [0, 20, 0],
              rotate: [0, -5, 0],
            }}
            transition={{
              duration: 8,
              repeat: Infinity,
              ease: "easeInOut",
              delay: 2,
            }}
            className={`absolute bottom-32 right-20 text-4xl opacity-20 ${
              isDark ? "text-blue-300" : "text-blue-400"
            }`}
          >
            <SparklesIcon size={40} />
          </motion.div>

          <div className="relative z-10 mx-auto max-w-4xl text-center">
            <div
              className={`mb-4 text-lg font-medium ${
                isDark ? "text-purple-300" : "text-purple-600"
              }`}
            >
              👋{" "}
              <AnimatedText text="Hello, I'm" splitBy="chars" trigger="initial" />
            </div>
            <motion.div
              className="mb-4 flex justify-center"
              initial={{ opacity: 0, y: 20, scale: 0.8 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.8, delay: 0.2 }}
            >
              <img
                src="/me-cartoonify.png"
                alt="Sourena Khanzadeh"
                className="h-32 w-32 rounded-full"
              />
            </motion.div>
            <h1
              className={`mb-6 text-6xl font-bold md:text-7xl ${
                isDark ? "text-white" : "text-gray-900"
              }`}
            >
              <AnimatedText
                text="Sourena Khanzadeh"
                splitBy="chars"
                trigger="initial"
                gradientClassName={
                  isDark
                    ? "bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent"
                    : "bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent"
                }
                gradientWordIndex={1}
              />
            </h1>

            <motion.p
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.6 }}
              className={`mx-auto mb-12 max-w-2xl text-lg leading-relaxed md:text-xl ${
                isDark ? "text-gray-300" : "text-gray-600"
              }`}
            >
              I build scalable AI systems that turn cutting-edge research into
              production-ready models. Passionate about bridging the gap between
              theoretical breakthroughs and real-world applications.
            </motion.p>

            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.8 }}
              className="flex flex-col items-center justify-center gap-4 sm:flex-row"
            >
              <motion.a
                href="#work"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`rounded-full px-8 py-4 text-lg font-semibold transition-all duration-300 ${
                  isDark
                    ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-pink-600"
                    : "bg-gradient-to-r from-purple-500 to-pink-500 text-white shadow-lg shadow-purple-500/25 hover:from-purple-600 hover:to-pink-600"
                }`}
              >
                View My Work
                <ArrowRightIcon className="ml-2 inline" size={20} />
              </motion.a>

              <motion.a
                href="#contact"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`rounded-full px-8 py-4 text-lg font-semibold transition-all duration-300 ${
                  isDark
                    ? "border-2 border-purple-400 text-purple-300 hover:bg-purple-400 hover:text-white"
                    : "border-2 border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white"
                }`}
              >
                Get In Touch
              </motion.a>
            </motion.div>
          </div>
        </main>

        <div
          className="w-full"
          style={
            isDark
              ? ({
                  "--foreground": "#f4f4f5",
                  "--background": "#0a0a0a",
                } as CSSProperties)
              : ({
                  "--foreground": "#171717",
                  "--background": "#ffffff",
                } as CSSProperties)
          }
        >
          {featured}
        </div>
      </div>

      <VideoScrollSection isDark={isDark} />

      <AboutMe isDark={isDark} />
      <WorkTimeline isDark={isDark} />
      <Research isDark={isDark} />
      <Contact isDark={isDark} />

      <Footer isDark={isDark} />
      <ScrollToTop isDark={isDark} />
    </>
  );
}
