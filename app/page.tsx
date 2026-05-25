"use client"
import Nav from "@/components/nav";
import Footer from "@/components/footer";
import { motion } from "framer-motion";
import { useState, useEffect } from "react";
import { SunIcon, MoonIcon, ArrowRightIcon, SparklesIcon } from "lucide-react";
import ThreeHero from "@/components/threeHero";
import AboutMe from "@/components/aboutMe";
import WorkTimeline from "@/components/workTimeline";
import Research from "@/components/research";
import Contact from "@/components/contact";
import ScrollToTop from "@/components/scrollToTop";
import GSAPScrollAnimations from "@/components/GSAPScrollAnimations";
import VideoScrollSection from "@/components/VideoScrollSection";
import AnimatedText from "@/components/AnimatedText";

export default function Home() {
  const [isDark, setIsDark] = useState(false);

  useEffect(() => {
    // Check system preference on mount
    if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      setIsDark(true);
    }
  }, []);

  const toggleTheme = () => {
    setIsDark(!isDark);
  };

  return (
    <>
    <GSAPScrollAnimations />
    <Nav isDark={isDark}/>
    <ThreeHero/>
    <div className={`h-20 ${isDark ? 'bg-gradient-to-br from-black via-slate-900 to-black text-white' 
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'}`}/>
    <div className={`min-h-screen transition-colors duration-500 ${
      isDark 
        ? 'bg-gradient-to-br from-black via-slate-900 to-black text-white' 
        : 'bg-gradient-to-br from-blue-50 via-white to-purple-50 text-gray-900'
    }`}>
      {/* Theme Toggle */}
      <button
        onClick={toggleTheme}
        className={`fixed top-24 right-6 z-50 p-3 rounded-full transition-all duration-300  ${
          isDark 
            ? 'bg-white/10 hover:bg-white/20 text-yellow-300' 
            : 'bg-gray-900/10 hover:bg-gray-900/20 text-gray-700'
        } backdrop-blur-sm`}
      >
        {isDark ? <SunIcon size={20} /> : <MoonIcon size={20} />}
      </button>

      {/* Hero Section */}
      <main className="relative flex flex-col items-center justify-center min-h-screen px-6 overflow-hidden">
        {/* Background Elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className={`absolute -top-40 -right-40 w-80 h-80 rounded-full blur-3xl ${
            isDark ? 'bg-purple-500 opacity-30' : 'bg-blue-400 opacity-20'
          }`}></div>
          <div className={`absolute -bottom-40 -left-40 w-80 h-80 rounded-full blur-3xl ${
            isDark ? 'bg-blue-500 opacity-30' : 'bg-purple-400 opacity-20'
          }`}></div>
        </div>

        {/* Floating Icons */}
        <motion.div
          animate={{ 
            y: [0, -20, 0],
            rotate: [0, 5, 0]
          }}
          transition={{ 
            duration: 6, 
            repeat: Infinity, 
            ease: "easeInOut" 
          }}
          className={`absolute top-32 left-20 text-4xl opacity-20 ${
            isDark ? 'text-purple-300' : 'text-purple-400'
          }`}
        >
          <SparklesIcon size={40} />
        </motion.div>

        <motion.div
          animate={{ 
            y: [0, 20, 0],
            rotate: [0, -5, 0]
          }}
          transition={{ 
            duration: 8, 
            repeat: Infinity, 
            ease: "easeInOut",
            delay: 2
          }}
          className={`absolute bottom-32 right-20 text-4xl opacity-20 ${
            isDark ? 'text-blue-300' : 'text-blue-400'
          }`}
        >
          <SparklesIcon size={40} />
        </motion.div>

        {/* Main Content */}
        <div className="relative z-10 text-center max-w-4xl mx-auto">
          {/* Greeting */}
          <div
            className={`text-lg font-medium mb-4 ${
              isDark ? 'text-purple-300' : 'text-purple-600'
            }`}
          >
            👋{" "}
            <AnimatedText text="Hello, I'm" splitBy="chars" trigger="initial" />
          </div>
          <motion.div
            className="flex justify-center mb-4"
            initial={{ opacity: 0, y: 20, scale: 0.8 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ duration: 0.8, delay: 0.2 }}
          >
            <img 
              src="/me-cartoonify.png" 
              alt="Sourena Khanzadeh" 
              className="w-32 h-32 rounded-full"
            />
          </motion.div>
          {/* Name */}
          <h1
            className={`text-6xl md:text-7xl font-bold mb-6 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}
          >
            <AnimatedText
              text="Sourena Khanzadeh"
              splitBy="chars"
              trigger="initial"
              gradientClassName={isDark ? 'bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent' : 'bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent'}
              gradientWordIndex={1}
            />
          </h1>

         

          {/* Description */}
          <motion.p
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.6 }}
            className={`text-lg md:text-xl mb-12 leading-relaxed max-w-2xl mx-auto ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}
          >
            I build scalable AI systems that turn cutting-edge research into production-ready models. 
            Passionate about bridging the gap between theoretical breakthroughs and real-world applications.
          </motion.p>

          {/* CTA Buttons */}
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.8 }}
            className="flex flex-col sm:flex-row gap-4 justify-center items-center"
          >
            <motion.a
              href="#work"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
                isDark
                  ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
                  : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
              }`}
            >
              View My Work
              <ArrowRightIcon className="inline ml-2" size={20} />
            </motion.a>
            
            <motion.a
              href="#contact"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
                isDark
                  ? 'border-2 border-purple-400 text-purple-300 hover:bg-purple-400 hover:text-white'
                  : 'border-2 border-purple-500 text-purple-600 hover:bg-purple-500 hover:text-white'
              }`}
            >
              Get In Touch
            </motion.a>
          </motion.div>


          
        </div>
      </main>
      </div>

      {/* Scroll-scrubbed video section */}
      <VideoScrollSection isDark={isDark} />
      
      {/* About Me Section */}
      <AboutMe isDark={isDark} />
      
      {/* Work Timeline Section */}
      <WorkTimeline isDark={isDark} />
      
      {/* Research Section */}
      <Research isDark={isDark} />
      
      {/* Contact Section */}
      <Contact isDark={isDark} />
      
      <Footer isDark={isDark}/>
      
      {/* Scroll to Top Button */}
      <ScrollToTop isDark={isDark} />
    </>
  );
}