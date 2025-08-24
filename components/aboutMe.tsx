"use client"
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

export default function AboutMe({ isDark }: { isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -100]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 100]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -150]);

  return (
    <section 
      ref={containerRef}
      className={`relative py-20 overflow-hidden ${
        isDark ? 'bg-gradient-to-b from-slate-900 to-black' : 'bg-gradient-to-b from-purple-50 to-blue-50'
      }`}
      id="about"
    >
      {/* Animated Background Patterns */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Geometric Shapes */}
        <motion.div
          style={{ y: y1 }}
          className={`absolute top-20 left-10 w-32 h-32 border-2 rounded-full ${
            isDark ? 'border-purple-500/30' : 'border-purple-400/30'
          }`}
        />
        <motion.div
          style={{ y: y2 }}
          className={`absolute top-40 right-20 w-24 h-24 border-2 rotate-45 ${
            isDark ? 'border-blue-500/30' : 'border-blue-400/30'
          }`}
        />
        <motion.div
          style={{ y: y3 }}
          className={`absolute bottom-20 left-1/4 w-20 h-20 border-2 rounded-full ${
            isDark ? 'border-pink-500/30' : 'border-pink-400/30'
          }`}
        />
        
        {/* Grid Pattern */}
        <div className={`absolute inset-0 opacity-5 ${
          isDark ? 'text-white' : 'text-gray-900'
        }`}>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="grid" width="40" height="40" patternUnits="userSpaceOnUse">
                <path d="M 40 0 L 0 0 0 40" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#grid)" />
          </svg>
        </div>

        {/* Dots Pattern */}
        <div className={`absolute inset-0 opacity-10 ${
          isDark ? 'text-purple-400' : 'text-purple-500'
        }`}>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="dots" width="60" height="60" patternUnits="userSpaceOnUse">
                <circle cx="30" cy="30" r="2" fill="currentColor"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#dots)" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-6xl mx-auto px-6">
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
            About{" "}
            <span className={`bg-gradient-to-r ${
              isDark ? 'from-purple-400 to-pink-400' : 'from-purple-600 to-pink-600'
            } bg-clip-text text-transparent`}>
              Me
            </span>
          </h2>
          <div className={`w-24 h-1 mx-auto rounded-full ${
            isDark ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`} />
        </motion.div>

        <div className="grid lg:grid-cols-2 gap-12 items-center">
          {/* Left Column - Text Content */}
          <motion.div
            initial={{ opacity: 0, x: -50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.2 }}
            viewport={{ once: true }}
            className="space-y-6"
          >
            <p className={`text-lg leading-relaxed ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              I&apos;m a passionate AI researcher and full-stack developer with over 8 years of experience 
              building intelligent systems that solve real-world problems. My journey began with a 
              fascination for how machines can learn and think like humans.
            </p>
            
            <p className={`text-lg leading-relaxed ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              I specialize in developing scalable AI architectures, from research prototypes to 
              production-ready models. My work spans natural language processing, computer vision, 
              and reinforcement learning, always with a focus on practical applications.
            </p>

            <p className={`text-lg leading-relaxed ${
              isDark ? 'text-gray-300' : 'text-gray-700'
            }`}>
              When I&apos;m not coding or researching, you&apos;ll find me exploring new technologies, 
              contributing to open-source projects, or sharing knowledge with the developer community.
            </p>

            {/* Skills */}
            <div className="pt-6">
              <h3 className={`text-xl font-semibold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Core Skills
              </h3>
              <div className="flex flex-wrap gap-2">
                {[
                  "Python", "C/C++", "TensorFlow", "PyTorch", "React", "Node.js", 
                  "AWS", "Docker", "Kubernetes", "PostgreSQL", "MongoDB"
                ].map((skill, index) => (
                  <motion.span
                    key={skill}
                    initial={{ opacity: 0, scale: 0.8 }}
                    whileInView={{ opacity: 1, scale: 1 }}
                    transition={{ duration: 0.3, delay: index * 0.1 }}
                    viewport={{ once: true }}
                    className={`px-3 py-1 rounded-full text-sm font-medium ${
                      isDark 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                    }`}
                  >
                    {skill}
                  </motion.span>
                ))}
              </div>
            </div>
          </motion.div>

          {/* Right Column - Visual Elements */}
          <motion.div
            initial={{ opacity: 0, x: 50 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.8, delay: 0.4 }}
            viewport={{ once: true }}
            className="relative"
          >
            {/* Animated Cards */}
            <div className="space-y-6">
              {[
                { title: "Research", icon: "🔬", color: "purple" },
                { title: "Development", icon: "💻", color: "blue" },
                { title: "Innovation", icon: "🚀", color: "pink" }
              ].map((card, index) => (
                <motion.div
                  key={card.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.6 + index * 0.2 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.05, y: -5 }}
                  className={`p-6 rounded-2xl backdrop-blur-sm border ${
                    isDark 
                      ? 'bg-white/5 border-white/10' 
                      : 'bg-white/50 border-gray-200'
                  } shadow-lg`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`text-3xl ${
                      card.color === 'purple' ? 'text-purple-400' :
                      card.color === 'blue' ? 'text-blue-400' : 'text-pink-400'
                    }`}>
                      {card.icon}
                    </div>
                    <div>
                      <h4 className={`text-lg font-semibold ${
                        isDark ? 'text-white' : 'text-gray-900'
                      }`}>
                        {card.title}
                      </h4>
                      <p className={`text-sm ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        {card.title === "Research" && "Cutting-edge AI algorithms and methodologies"}
                        {card.title === "Development" && "Scalable full-stack applications and systems"}
                        {card.title === "Innovation" && "Bridging research and real-world applications"}
                      </p>
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>

            {/* Floating Elements */}
            <motion.div
              animate={{ 
                y: [0, -20, 0],
                rotate: [0, 5, 0]
              }}
              transition={{ 
                duration: 8, 
                repeat: Infinity, 
                ease: "easeInOut" 
              }}
              className={`absolute -top-10 -right-10 w-20 h-20 rounded-full ${
                isDark ? 'bg-purple-500/20' : 'bg-purple-400/20'
              } blur-xl`}
            />
            <motion.div
              animate={{ 
                y: [0, 20, 0],
                rotate: [0, -5, 0]
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity, 
                ease: "easeInOut",
                delay: 2
              }}
              className={`absolute -bottom-10 -left-10 w-16 h-16 rounded-full ${
                isDark ? 'bg-blue-500/20' : 'bg-blue-400/20'
              } blur-xl`}
            />
          </motion.div>
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-16 pt-8"
        >
          <p className={`text-lg mb-6 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Ready to collaborate on something amazing?
          </p>
          <motion.a
            href="#contact"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
              isDark
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
            }`}
          >
            Let&apos;s Connect
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
