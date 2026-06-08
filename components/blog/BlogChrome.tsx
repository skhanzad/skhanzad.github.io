"use client";

import { useEffect, useState } from "react";
import { SunIcon, MoonIcon } from "lucide-react";
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import ScrollToTop from "@/components/scrollToTop";

export default function BlogChrome({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
      setIsDark(true);
    }
  }, []);

  return (
    <>
      <Nav isDark={isDark} />
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
      <div
        className={`min-h-screen pt-20 transition-colors duration-500 ${
          isDark
            ? "bg-gradient-to-br from-black via-slate-900 to-black text-white"
            : "bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900"
        }`}
      >
        {children}
      </div>
      <Footer isDark={isDark} />
      <ScrollToTop isDark={isDark} />
    </>
  );
}
