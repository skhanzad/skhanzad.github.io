"use client"
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { CalendarIcon, MapPinIcon, ExternalLinkIcon, Book, Table } from "lucide-react";

export default function WorkTimeline({ isDark }: { isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -50]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 50]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -75]);

  const workData = [
    {
      year: "2023",
      title: "Graduate Assistant/PhD Candidate",
      company: "Toronto Metropolitan University",
      location: "Toronto, ON",
      duration: "Jan 2023 - Present",
      description: "I am a graduate assistant at Toronto Metropolitan University, where I am responsible for teaching and research. I am also a research assistant at the Toronto Institute for computer science research, where I am responsible for research and development.",
      technologies: ["Python", "C/C++", "PyTorch", "Prolog", "SQL", "Docker", "Kubernetes", "React", "Node.js", "AWS", "Docker", "Kubernetes"],
      achievements: [
        "Published 5 research papers in top-tier AI conferences",
        "Developed a blockchain based AI project",
        "Taught 400+ students in the field of Computer Science and AI"
      ],
      links: [
        { name: "Company Website", url: "https://www.torontomu.ca/", icon: ExternalLinkIcon },
        { name: "Lab Website", url: "https://www.cs.torontomu.ca/~manar.alalfi/", icon: Table },
        { name: "Research Paper (Gas Survey)", url: "https://ieeexplore.ieee.org/abstract/document/10429984", icon: Book },
        { name: "Research Paper (Solosphere)", url: "https://ieeexplore.ieee.org/abstract/document/10621683", icon: Book },
        { name: "Research Paper (GANsemble)", url: "https://assets.pubpub.org/gokuyo6b/PLATNICK-51716777406141.pdf", icon: Book },
        { name: "Research Paper (Agent Mesh)", url: "https://arxiv.org/abs/2507.19902", icon: Book },
        { name: "Research Paper (OptiCode Pro)", url: "https://arxiv.org/abs/2305.07594", icon: Book },
      ]
    },
    {
        year: "2024",
        title: "AI Research Scientist Intern",
        company: "National Research Council Canada (NRC)",
        location: "Ottawa, ON",
        duration: "Jan 2024 - Jan 2025",
        description: "I was an AI research scientist intern at the National Research Council Canada, where I was responsible for research and development.",
        technologies: ["Python", "PyTorch", "LLM", "RAG", "LangChain", "OpenAI", "Knowledge Infusion", "Auxiliary Knowledge Infusion"],
        achievements: [
            "Surveyed the literature on the topic of AI in the field of Knowledge Infusion",
            "Developed a prototype of a Knowledge Infusion system",
            "Presented a prototype of Auxiliary Knowledge Infusion system"
        ],
        links: [
            { name: "Company Website", url: "https://www.nrc.ca/", icon: ExternalLinkIcon },
            { name: "Research Paper", url: "https://link.springer.com/article/10.1007/s10207-025-00987-4", icon: Book }
        ]
    },
    {
        year:"2022",
        title: "Software Engineer",
        company: "NTN Bearing Corporation",
        location: "Toronto, ON",
        duration: "Apr 2022 - Jan 2023",
        description: "I was a software engineer at NTN Bearing Corporation, where I was responsible for developing software for the company.",
        technologies: ["Firebase", "Docker", "Angular", "Node.js", "Git", "CI/CD", "Agile", "Scrum"],
        achievements: [
            "Developed a loyalty program for the company",
            "Developed a software for the company",
        ],
        links: [
            { name: "Company Website", url: "https://www.ntn.ca/", icon: ExternalLinkIcon },
        ]
    }
  ];

  return (
    <section 
      ref={containerRef}
      className={`relative py-20 overflow-hidden ${
        isDark ? 'bg-gradient-to-b from-black to-slate-900' : 'bg-gradient-to-b from-blue-50 to-purple-50'
      }`}
      id="work"
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
        
        {/* Circuit Pattern */}
        <div className={`absolute inset-0 opacity-5 ${
          isDark ? 'text-blue-400' : 'text-blue-500'
        }`}>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="circuit" width="80" height="80" patternUnits="userSpaceOnUse">
                <path d="M 0 40 L 80 40 M 40 0 L 40 80 M 0 0 L 80 80 M 0 80 L 80 0" 
                      fill="none" stroke="currentColor" strokeWidth="1"/>
                <circle cx="40" cy="40" r="3" fill="currentColor"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#circuit)" />
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
            Work{" "}
            <span className={`bg-gradient-to-r ${
              isDark ? 'from-blue-400 to-purple-400' : 'from-blue-600 to-purple-600'
            } bg-clip-text text-transparent`}>
              Experience
            </span>
          </h2>
          <p className={`text-lg max-w-2xl mx-auto ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            My professional journey in AI research and software development
          </p>
          <div className={`w-24 h-1 mx-auto rounded-full mt-6 ${
            isDark ? 'bg-gradient-to-r from-blue-400 to-purple-400' : 'bg-gradient-to-r from-blue-500 to-purple-500'
          }`} />
        </motion.div>

        {/* Timeline */}
        <div className="relative">
          {/* Timeline Line */}
          <div className={`absolute left-8 md:left-1/2 top-0 bottom-0 w-0.5 transform -translate-x-1/2 ${
            isDark ? 'bg-gradient-to-b from-blue-500 via-purple-500 to-pink-500' : 'bg-gradient-to-b from-blue-400 via-purple-400 to-pink-400'
          }`} />

          {/* Timeline Items */}
          <div className="space-y-16">
            {workData.map((item, index) => (
              <motion.div
                key={index}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: index * 0.2 }}
                viewport={{ once: true }}
                className={`relative flex flex-col md:flex-row gap-8 ${
                  index % 2 === 0 ? 'md:flex-row' : 'md:flex-row-reverse'
                }`}
              >
                {/* Timeline Dot */}
                <div className={`absolute left-8 md:left-1/2 w-4 h-4 rounded-full transform -translate-x-1/2 ${
                  isDark ? 'bg-purple-400' : 'bg-purple-500'
                } border-4 border-white shadow-lg z-10`} />

                {/* Content Card */}
                <div className={`flex-1 ${
                  index % 2 === 0 ? 'md:pr-8 md:text-right' : 'md:pl-8 md:text-left'
                }`}>
                  <motion.div
                    whileHover={{ scale: 1.02, y: -5 }}
                    transition={{ duration: 0.3 }}
                    className={`p-8 rounded-2xl backdrop-blur-sm border shadow-lg ${
                      isDark 
                        ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                        : 'bg-white/70 border-gray-200 hover:bg-white/90'
                    } transition-all duration-300`}
                  >
                    {/* Year Badge */}
                    <div className={`inline-block px-4 py-2 rounded-full text-sm font-bold mb-4 ${
                      isDark 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                    }`}>
                      {item.year}
                    </div>

                    {/* Title and Company */}
                    <h3 className={`text-2xl font-bold mb-2 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {item.title}
                    </h3>
                    <h4 className={`text-xl font-semibold mb-3 ${
                      isDark ? 'text-purple-300' : 'text-purple-600'
                    }`}>
                      {item.company}
                    </h4>

                    {/* Location and Duration */}
                    <div className={`flex items-center gap-4 mb-4 text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <MapPinIcon size={16} />
                        {item.location}
                      </div>
                      <div className="flex items-center gap-2">
                        <CalendarIcon size={16} />
                        {item.duration}
                      </div>
                    </div>

                    {/* Description */}
                    <p className={`text-lg leading-relaxed mb-6 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {item.description}
                    </p>

                    {/* Technologies */}
                    <div className="mb-6">
                      <h5 className={`text-sm font-semibold mb-3 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Technologies Used
                      </h5>
                      <div className="flex flex-wrap gap-2">
                        {item.technologies.map((tech, techIndex) => (
                          <span
                            key={techIndex}
                            className={`px-3 py-1 rounded-full text-sm font-medium ${
                              isDark 
                                ? 'bg-blue-500/20 text-blue-300 border border-blue-500/30' 
                                : 'bg-blue-100 text-blue-700 border border-blue-200'
                            }`}
                          >
                            {tech}
                          </span>
                        ))}
                      </div>
                    </div>

                    {/* Key Achievements */}
                    <div className="mb-6">
                      <h5 className={`text-sm font-semibold mb-3 ${
                        isDark ? 'text-gray-400' : 'text-gray-600'
                      }`}>
                        Key Achievements
                      </h5>
                      <ul className={`space-y-2 ${
                        index % 2 === 0 ? 'md:text-right' : 'md:text-left'
                      }`}>
                        {item.achievements.map((achievement, achievementIndex) => (
                          <li key={achievementIndex} className={`text-sm ${
                            isDark ? 'text-gray-300' : 'text-gray-600'
                          }`}>
                            • {achievement}
                          </li>
                        ))}
                      </ul>
                    </div>

                    {/* Links */}
                    <div className="flex gap-3">
                      {item.links.map((link, linkIndex) => (
                        <motion.a
                          key={linkIndex}
                          href={link.url}
                          whileHover={{ scale: 1.05 }}
                          whileTap={{ scale: 0.95 }}
                          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                            isDark
                              ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
                              : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
                          }`}
                        >
                          <link.icon size={16} />
                          {link.name}
                        </motion.a>
                      ))}
                    </div>
                  </motion.div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center mt-20 pt-8"
        >
          <p className={`text-lg mb-6 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Interested in working together?
          </p>
          <motion.a
            href="/resume.pdf"
            download
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`px-8 py-4 rounded-full font-semibold text-lg transition-all duration-300 ${
              isDark
                ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/25'
                : 'bg-gradient-to-r from-blue-500 to-purple-500 hover:from-blue-600 hover:to-purple-600 text-white shadow-lg shadow-blue-500/25'
            }`}
          >
            Download Resume
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
