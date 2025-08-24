"use client"
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState } from "react";
import { Mail, Copy, Check, MessageCircle, Phone, ExternalLink } from "lucide-react";

export default function Contact({ isDark }: { isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [copied, setCopied] = useState(false);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const email = "sourena.khanzadeh@gmail.com";



  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(email);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error('Failed to copy: ', err);
    }
  };

  const contactInfo = [
    {
      icon: Mail,
      title: "Email",
      value: email,
      description: "Primary contact method",
      action: copyToClipboard,
      actionText: copied ? "Copied!" : "Copy Email",
      actionIcon: copied ? Check : Copy,
      isPrimary: true
    },
    {
      icon: MessageCircle,
      title: "LinkedIn",
      value: "sourenak",
      description: "Professional network",
      action: () => window.open("https://linkedin.com/in/sourenak", "_blank"),
      actionText: "Visit Profile",
      actionIcon: ExternalLink,
      isPrimary: false
    },
    {
      icon: Phone,
      title: "GitHub",
      value: "skhanzad",
      description: "Code repositories",
      action: () => window.open("https://github.com/skhanzad", "_blank"),
      actionText: "View Profile",
      actionIcon: ExternalLink,
      isPrimary: false
    }
  ];

  return (
    <section 
      ref={containerRef}
      className={`relative py-20 overflow-hidden ${
        isDark ? 'bg-gradient-to-b from-black to-slate-900' : 'bg-gradient-to-b from-blue-50 to-purple-50'
      }`}
      id="contact"
    >
      {/* Animated Background Patterns */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Elements */}
        <motion.div
          style={{ y: y1 }}
          className={`absolute top-20 left-20 w-32 h-32 border-2 rounded-full ${
            isDark ? 'border-blue-500/20' : 'border-blue-400/20'
          }`}
        />
        <motion.div
          style={{ y: y2 }}
          className={`absolute top-40 right-32 w-24 h-24 border-2 rotate-45 ${
            isDark ? 'border-purple-500/20' : 'border-purple-400/20'
          }`}
        />
        <motion.div
          style={{ y: y3 }}
          className={`absolute bottom-20 left-1/3 w-20 h-20 border-2 rounded-full ${
            isDark ? 'border-pink-500/20' : 'border-pink-400/20'
          }`}
        />
        
        {/* Contact Pattern */}
        <div className={`absolute inset-0 opacity-5 ${
          isDark ? 'text-blue-400' : 'text-blue-500'
        }`}>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="contact" width="120" height="120" patternUnits="userSpaceOnUse">
                <path d="M 0 60 L 120 60 M 60 0 L 60 120" 
                      fill="none" stroke="currentColor" strokeWidth="1"/>
                <circle cx="60" cy="60" r="6" fill="currentColor"/>
                <rect x="30" y="30" width="60" height="60" fill="none" stroke="currentColor" strokeWidth="1"/>
                <circle cx="30" cy="30" r="3" fill="currentColor"/>
                <circle cx="90" cy="30" r="3" fill="currentColor"/>
                <circle cx="30" cy="90" r="3" fill="currentColor"/>
                <circle cx="90" cy="90" r="3" fill="currentColor"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#contact)" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8 }}
          viewport={{ once: true }}
          className="text-center mb-16"
        >
          <h2 className={`text-4xl md:text-5xl font-bold mb-6 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Get In{" "}
            <span className={`bg-gradient-to-r ${
              isDark ? 'from-blue-400 to-purple-400' : 'from-blue-600 to-purple-600'
            } bg-clip-text text-transparent`}>
              Touch
            </span>
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Ready to collaborate on something amazing? Let&apos;s connect and discuss how we can work together.
          </p>
          <div className={`w-24 h-1 mx-auto rounded-full mt-6 ${
            isDark ? 'bg-gradient-to-r from-blue-400 to-purple-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'
          }`} />
        </motion.div>

        {/* Contact Cards */}
        <div className="grid md:grid-cols-3 gap-8 mb-16">
          {contactInfo.map((info, index) => (
            <motion.div
              key={info.title}
              initial={{ opacity: 0, y: 50 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.8, delay: 0.2 + index * 0.1 }}
              viewport={{ once: true }}
              whileHover={{ scale: 1.02, y: -5 }}
              className={`p-8 rounded-2xl backdrop-blur-sm border shadow-lg transition-all duration-300 ${
                info.isPrimary 
                  ? (isDark 
                      ? 'bg-gradient-to-br from-blue-500/10 to-purple-500/10 border-blue-500/30' 
                      : 'bg-gradient-to-br from-blue-100 to-purple-100 border-blue-300')
                  : (isDark 
                      ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                      : 'bg-white/70 border-gray-200 hover:bg-white/90')
              }`}
            >
              {/* Icon */}
              <div className={`inline-flex items-center justify-center w-16 h-16 rounded-2xl mb-6 ${
                info.isPrimary 
                  ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100')
                  : (isDark ? 'bg-purple-500/20' : 'bg-purple-100')
              }`}>
                <info.icon size={32} className={
                  info.isPrimary 
                    ? (isDark ? 'text-blue-400' : 'text-blue-600')
                    : (isDark ? 'text-purple-400' : 'text-purple-600')
                } />
              </div>

              {/* Content */}
              <h3 className={`text-xl font-bold mb-3 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                {info.title}
              </h3>
              
              <p className={`text-sm mb-4 ${
                isDark ? 'text-gray-400' : 'text-gray-600'
              }`}>
                {info.description}
              </p>

              {/* Value */}
              <div className={`mb-6 p-3 rounded-lg font-mono text-sm ${
                isDark ? 'bg-white/5' : 'bg-gray-50'
              }`}>
                <span className={
                  isDark ? 'text-gray-300' : 'text-gray-700'
                }>
                  {info.value}
                </span>
              </div>

              {/* Action Button */}
              <motion.button
                onClick={info.action}
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
                className={`w-full px-4 py-3 rounded-lg font-medium transition-all duration-300 ${
                  info.isPrimary
                    ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/25'
                    : (isDark
                        ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
                        : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200')
                }`}
              >
                <info.actionIcon size={18} className="inline mr-2" />
                {info.actionText}
              </motion.button>
            </motion.div>
          ))}
        </div>

        {/* Additional Info */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.6 }}
          viewport={{ once: true }}
          className={`text-center p-8 rounded-2xl backdrop-blur-sm border ${
            isDark 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white/70 border-gray-200'
          }`}
        >
          <h3 className={`text-2xl font-bold mb-4 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Let&apos;s Build Something Amazing Together
          </h3>
          <p className={`text-lg max-w-3xl mx-auto ${
            isDark ? 'text-gray-300' : 'text-gray-700'
          }`}>
            Whether you&apos;re interested in AI research, blockchain development, or software engineering projects, 
            I&apos;m always excited to explore new opportunities and collaborations. Feel free to reach out!
          </p>
        </motion.div>

        {/* Quick Copy Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16"
        >
          <div className={`inline-block p-6 rounded-2xl ${
            isDark ? 'bg-white/5 border border-white/10' : 'bg-white/50 border border-gray-200'
          }`}>
            <p className={`text-sm mb-3 ${
              isDark ? 'text-gray-400' : 'text-gray-600'
            }`}>
              Quick copy my email:
            </p>
            <div className="flex items-center gap-3 justify-center">
              <code className={`px-4 py-2 rounded-lg font-mono text-lg ${
                isDark ? 'bg-white/5 text-white' : 'bg-gray-100 text-gray-900'
              }`}>
                {email}
              </code>
              <motion.button
                onClick={copyToClipboard}
                whileHover={{ scale: 1.1 }}
                whileTap={{ scale: 0.9 }}
                className={`p-3 rounded-lg transition-all duration-300 ${
                  copied
                    ? (isDark ? 'bg-green-500/20 text-green-400' : 'bg-green-100 text-green-600')
                    : (isDark ? 'bg-blue-500/20 text-blue-400 hover:bg-blue-500/30' : 'bg-blue-100 text-blue-600 hover:bg-blue-200')
                }`}
                title="Copy email address"
              >
                {copied ? <Check size={20} /> : <Copy size={20} />}
              </motion.button>
            </div>
            {copied && (
              <motion.p
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className={`text-sm mt-3 ${
                  isDark ? 'text-green-400' : 'text-green-600'
                }`}
              >
                ✓ Email copied to clipboard!
              </motion.p>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
}
