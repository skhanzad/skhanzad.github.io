"use client"
import { useState, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Menu, X, Github, Linkedin, Twitter, Mail } from "lucide-react";

interface NavProps {
  isDark?: boolean;
}

export default function Nav({ isDark = false }: NavProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    window.addEventListener("scroll", handleScroll);
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const navItems = [
    { name: "About", href: "#about" },
    { name: "Work", href: "#work" },
    { name: "Research", href: "#research" },
    { name: "Contact", href: "#contact" },
  ];

  const socialLinks = [
    { icon: Github, href: "https://github.com/skhanzad", label: "GitHub" },
    { icon: Linkedin, href: "https://linkedin.com/in/sourenak", label: "LinkedIn" },
    { icon: Mail, href: "mailto:sourena.khanzadeh@gmail.com", label: "Email" },
  ];

  return (
    <>
      {/* Main Navigation */}
      <motion.nav
        initial={{ y: -100 }}
        animate={{ y: 0 }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className={`fixed top-0 left-0 right-0 z-50 transition-all duration-500 ${
          scrolled
            ? isDark
              ? "bg-black/90 backdrop-blur-xl border-b border-purple-500/30 shadow-2xl"
              : "bg-white/90 backdrop-blur-xl border-b border-purple-200/50 shadow-lg"
            : isDark
              ? "bg-black/20 backdrop-blur-sm"
              : "bg-white/20 backdrop-blur-sm"
        }`}
      >
        <div className="max-w-7xl mx-auto px-6">
          <div className="flex items-center justify-between h-20">
            {/* Logo */}
            <motion.div
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center space-x-2"
              onClick={() => {
                window.location.href = "/";
              }}
            >
              <div className={`w-10 h-10 rounded-full flex items-center justify-center ${
                isDark
                  ? "bg-gradient-to-br from-purple-500 to-pink-500"
                  : "bg-gradient-to-br from-purple-600 to-pink-600"
              }`}>
                <span className="text-white font-bold text-lg">SK</span>
              </div>
              <span className={`text-xl font-bold ${
                isDark ? "text-white" : "text-gray-900"
              }`}>
                Sourena
              </span>
            </motion.div>

            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
              {navItems.map((item, index) => (
                <motion.a
                  key={item.name}
                  href={item.href}
                  initial={{ opacity: 0, y: -20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ y: -2 }}
                  className={`relative font-medium transition-colors duration-300 ${
                    isDark
                      ? "text-gray-300 hover:text-purple-400"
                      : "text-gray-700 hover:text-purple-600"
                  }`}
                >
                  {item.name}
                  <motion.div
                    className={`absolute -bottom-1 left-0 h-0.5 ${
                      isDark ? "bg-purple-400" : "bg-purple-600"
                    }`}
                    initial={{ width: 0 }}
                    whileHover={{ width: "100%" }}
                    transition={{ duration: 0.3 }}
                  />
                </motion.a>
              ))}
            </div>

            {/* Social Links */}
            <div className="hidden md:flex items-center space-x-4">
              {socialLinks.map((social, index) => (
                <motion.a
                  key={social.label}
                  href={social.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  initial={{ opacity: 0, scale: 0 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.5, delay: index * 0.1 }}
                  whileHover={{ scale: 1.1, y: -2 }}
                  whileTap={{ scale: 0.95 }}
                  className={`p-2 rounded-full transition-all duration-300 ${
                    isDark
                      ? "text-gray-400 hover:text-purple-400 hover:bg-white/10"
                      : "text-gray-600 hover:text-purple-600 hover:bg-gray-100"
                  }`}
                  aria-label={social.label}
                >
                  <social.icon size={20} />
                </motion.a>
              ))}
            </div>

            {/* Mobile Menu Button */}
            <motion.button
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={() => setIsMenuOpen(!isMenuOpen)}
              className={`md:hidden p-2 rounded-lg transition-colors duration-300 ${
                isDark
                  ? "text-gray-300 hover:text-purple-400 hover:bg-white/10"
                  : "text-gray-700 hover:text-purple-600 hover:bg-gray-100"
              }`}
              aria-label="Toggle menu"
            >
              {isMenuOpen ? <X size={24} /> : <Menu size={24} />}
            </motion.button>
          </div>
        </div>
      </motion.nav>

      {/* Mobile Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0, x: "100%" }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: "100%" }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            className={`fixed top-20 right-0 w-80 h-screen z-40 md:hidden ${
              isDark
                ? "bg-black/95 backdrop-blur-xl border-l border-purple-500/40 shadow-2xl"
                : "bg-white/95 backdrop-blur-xl border-l border-purple-200/50 shadow-lg"
            }`}
          >
            <div className="p-6">
              {/* Mobile Navigation Items */}
              <div className="space-y-6 mb-8">
                {navItems.map((item, index) => (
                  <motion.a
                    key={item.name}
                    href={item.href}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    onClick={() => setIsMenuOpen(false)}
                    className={`block text-lg font-medium transition-colors duration-300 ${
                      isDark
                        ? "text-gray-300 hover:text-purple-400"
                        : "text-gray-700 hover:text-purple-600"
                    }`}
                  >
                    {item.name}
                  </motion.a>
                ))}
              </div>

              {/* Mobile Social Links */}
              <div className="space-y-4">
                <div className={`text-sm font-medium ${
                  isDark ? "text-gray-400" : "text-gray-500"
                }`}>
                  Connect with me
                </div>
                <div className="grid grid-cols-2 gap-4">
                  {socialLinks.map((social, index) => (
                    <motion.a
                      key={social.label}
                      href={social.href}
                      target="_blank"
                      rel="noopener noreferrer"
                      initial={{ opacity: 0, y: 20 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ duration: 0.3, delay: index * 0.1 }}
                      whileHover={{ scale: 1.05 }}
                      className={`flex items-center space-x-3 p-3 rounded-lg transition-all duration-300 ${
                        isDark
                          ? "bg-white/5 hover:bg-white/10 text-gray-300 hover:text-purple-400"
                          : "bg-gray-50 hover:bg-gray-100 text-gray-700 hover:text-purple-600"
                      }`}
                    >
                      <social.icon size={20} />
                      <span className="font-medium">{social.label}</span>
                    </motion.a>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Backdrop for mobile menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            onClick={() => setIsMenuOpen(false)}
            className="fixed inset-0 bg-black/20 backdrop-blur-sm z-30 md:hidden"
          />
        )}
      </AnimatePresence>
    </>
  );
}
