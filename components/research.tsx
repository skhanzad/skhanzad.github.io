"use client"
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";
import { BookOpen, FileText, Award, ExternalLink, Calendar, Users, Globe, TrendingUp } from "lucide-react";

export default function Research({ isDark }: { isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -100]);

  const publications = [
    {
      title: "Optimizing gas consumption in ethereum smart contracts: Best practices and techniques",
      authors: "S Khanzadeh, N Samreen, MH Alalfi",
      venue: "2023 IEEE 23rd International Conference on Software Quality, Reliability, and Security Companion (QRS-C)",
      year: "2023",
      doi: "10.1109/QRS-C60940.2023.00056",
      abstract: "Full-fledged applications, known as “smart contracts,” may be executed on blockchains. At this time, the quantity of Ethereum smart contracts written in the Solidity programming language is skyrocketing. The cost for executing smart contract code is measured using gas. Gas is used to allocate resources of the Ethereum virtual machine (EVM) so that wallet transactions and smart contract transactions can self-execute. Complicated transactions involving smart contracts require more computational work, so they require a higher gas amount than a simple payment. Optimizing smart contract code is an important practice in software engineering smart contracts and that to reduce gas consumption and, in some instances, to even avoid malicious attacks. This means that reducing the cost of gas consumption in smart contracts is important for anyone who use it, including developers. For inexperienced programmers, learning the mechanics of a smart contract and blockchain technology may be a considerable hurdle when it comes to gas optimization. In this paper, we present around 28 gas efficient patterns with examples in solidity, providing data on how much gas each pattern saves. We provide a categorization of those code patterns and a comparison between the state of the art tools used to address the problem of gas optimization in smart contracts.",
      citations: "4+",
      category: "Blockchain & Cryptocurrency",
      link: "https://ieeexplore.ieee.org/abstract/document/10429984"
    },
    {
      title: "Solosphere: A framework for gas optimization in solidity smart contracts",
      authors: "Sourena Khanzadeh, Manar H Alalfi",
      venue: "2024 IEEE International Conference on Software Analysis, Evolution and Reengineering-Companion (SANER-C)",
      year: "2024",
      doi: "10.1109/SANER-C62648.2024.00010",
      abstract: "SolOSphere is a Sphere of tools designed for the complete checking out, deploying, verification, and gas optimization of Ethereum smart contracts. With its three center elements - SolO, SMARTS, and SolOLab - SolOSphere offers functionality consisting of parsing and deparsing Solidity code, fetching smart contracts from GitHub, and a committed environment for gas analysis. The integration of OpenAI's GPT via SMARTS-GPT highlights the supportive role of AI in enhancing smart contract development. Although there are regions for improvement, substantially with the deparser, SolOSphere stands as a unified toolkit that could significantly enhance the smart contract development lifecycle and holds promise for enhancements and contributions.",
      citations: "3+",
      category: "Blockchain Development",
      link: "https://ieeexplore.ieee.org/abstract/document/10621683"
    },
    {
      title: "GANsemble for Small and Imbalanced Data Sets: A Baseline for Synthetic Microplastics Data",
      authors: "Daniel Platnick, Sourena Khanzadeh, Alireza Sadeghian, Richard Anthony Valenzano",
      venue: "PubPub",
      year: "2024",
      doi: "arXiv:2404.07356",
      abstract: "Microplastic particle ingestion or inhalation by humans is a problem of growing concern. Unfortunately, current research methods that use machine learning to understand their potential harms are obstructed by a lack of available data. Deep learning techniques in particular are challenged by such domains where only small or imbalanced data sets are available. Overcoming this challenge often involves oversampling underrepresented classes or augmenting the existing data to improve model performance. This paper proposes GANsemble: a two-module framework connecting data augmentation with conditional generative adversarial networks (cGANs) to generate class-conditioned synthetic data. First, the data chooser module automates augmentation strategy selection by searching for the best data augmentation strategy. Next, the cGAN module uses this strategy to train a cGAN for generating enhanced synthetic data. We experiment with the GANsemble framework on a small and imbalanced microplastics data set. A Microplastic-cGAN (MPcGAN) algorithm is introduced, and baselines for synthetic microplastics (SYMP) data are established in terms of Fréchet Inception Distance (FID) and Inception Scores (IS). We also provide a synthetic microplastics filter (SYMP-Filter) algorithm to increase the quality of generated SYMP. Additionally, we show the best amount of oversampling with augmentation to fix class imbalance in small microplastics data sets. To our knowledge, this study is the first application of generative AI to synthetically create microplastics data.",
      citations: "2+",
      category: "Machine Learning",
      link: "https://assets.pubpub.org/gokuyo6b/PLATNICK-51716777406141.pdf"
    },
    {
        title: "An exploratory study on domain knowledge infusion in deep learning for automated threat defense",
        authors: "Sourena Khanzadeh, Euclides Carlos Pinto Neto, Shahrear Iqbal, Manar Alalfi, Scott Buffett",
        venue: "International Journal of Information Security",
        year: "2025",
        doi: "",
        abstract: "The wide adoption of interconnected services leads to the creation of supportive solutions and business opportunities. Conversely, this new paradigm is targeted by malicious activities, aiming to compromise systems’ confidentiality, integrity, and availability. However, advanced methods lack contextual awareness, which prevents their deployment to real-world systems. Considering that the process of making informed decisions stems from the expertise of analysts based on their experience, the use of cybersecurity domain knowledge has the potential to improve Deep Learning and Deep Reinforcement Learning operations in real scenarios. Therefore, the main goal of this research is to study and evaluate the use of Knowledge Infused Learning in the context of automated threat defense. We define how cybersecurity domain knowledge can be infused into Deep Learning and Reinforcement Learning, highlighting the main challenges and benefits. Besides, we present a roadmap to apply domain knowledge for red and blue teaming activities and discuss the implications of Knowledge Infused Learning in explainability, and actionable reporting. Finally, we list the open challenges to guide the development of next-generation security solutions.",
        citations: "1+",
        category: "Machine Learning",
        link: "https://link.springer.com/article/10.1007/s10207-025-00987-4#citeas"
    },
    {
        title: "Opti Code Pro: A Heuristic Search-based Approach to Code Refactoring",
        authors: "Sourena Khanzadeh, Samad Alias Nyein Chan, Richard Valenzano, Manar Alalfi",
        venue: "arXiv",
        year: "2023",
        doi: "2305.07594",
        abstract: "This paper presents an approach that evaluates best-first search methods to code refactoring. The motivation for code refactoring could be to improve the design, structure, or implementation of an existing program without changing its functionality. To solve a very specific problem of coupling and cohesion, we propose using heuristic search-based techniques on an approximation of the full code refactoring problem, to guide the refactoring process toward solutions that have high cohesion and low coupling. We evaluated our approach by providing demonstrative examples of the effectiveness of this approach on random state problems and created a tool to implement the algorithm on Java projects.",
        citations: "1+",
        category: "Software Engineering",
        link: "https://arxiv.org/abs/2305.07594"
    },
    {
      title: "AgentMesh: A Cooperative Multi-Agent Generative AI Framework for Software Development Automation",
      authors: "Sourena Khanzadeh",
      venue: "arXiv",
      year: "2025",
      doi: "arXiv:2507.19902",
      abstract: "Software development is a complex, multi-phase process traditionally requiring collaboration among individuals with diverse expertise. We propose AgentMesh, a Python-based framework that uses multiple cooperating LLM-powered agents to automate software development tasks. In AgentMesh, specialized agents - a Planner, Coder, Debugger, and Reviewer - work in concert to transform a high-level requirement into fully realized code. The Planner agent first decomposes user requests into concrete subtasks; the Coder agent implements each subtask in code; the Debugger agent tests and fixes the code; and the Reviewer agent validates the final output for correctness and quality. We describe the architecture and design of these agents and their communication, and provide implementation details including prompt strategies and workflow orchestration. A case study illustrates AgentMesh handling a non-trivial development request via sequential task planning, code generation, iterative debugging, and final code review. We discuss how dividing responsibilities among cooperative agents leverages the strengths of large language models while mitigating single-agent limitations. Finally, we examine current limitations - such as error propagation and context scaling - and outline future work toward more robust, scalable multi-agent AI systems for software engineering automation.",
      citations: "0",
      category: "Multi-Agent Systems",
      link: "https://arxiv.org/abs/2507.19902"
    }
  ];

  const researchAreas = [
    {
      title: "Blockchain & Distributed Systems",
      description: "Researching scalable blockchain architectures, smart contract optimization, and decentralized applications",
      icon: TrendingUp,
      color: "purple"
    },
    {
      title: "Artificial Intelligence & Machine Learning",
      description: "Developing novel AI algorithms, ensemble methods, and intelligent systems for complex problem solving",
      icon: Award,
      color: "blue"
    },
    {
      title: "Multi-Agent Systems",
      description: "Creating distributed agent architectures for collaborative problem-solving and resource optimization",
      icon: Users,
      color: "pink"
    },
    {
      title: "Software Engineering & Optimization",
      description: "Building intelligent tools for code analysis, performance optimization, and development efficiency",
      icon: FileText,
      color: "green"
    }
  ];

  return (
    <section 
      ref={containerRef}
      className={`relative py-20 overflow-hidden ${
        isDark ? 'bg-gradient-to-b from-slate-900 to-black' : 'bg-gradient-to-b from-purple-50 to-blue-50'
      }`}
      id="research"
    >
      {/* Animated Background Patterns */}
      <div className="absolute inset-0 overflow-hidden">
        {/* Floating Elements */}
        <motion.div
          style={{ y: y1 }}
          className={`absolute top-20 left-20 w-32 h-32 border-2 rounded-full ${
            isDark ? 'border-purple-500/20' : 'border-purple-400/20'
          }`}
        />
        <motion.div
          style={{ y: y2 }}
          className={`absolute top-40 right-32 w-24 h-24 border-2 rotate-45 ${
            isDark ? 'border-blue-500/20' : 'border-blue-400/20'
          }`}
        />
        <motion.div
          style={{ y: y3 }}
          className={`absolute bottom-20 left-1/3 w-20 h-20 border-2 rounded-full ${
            isDark ? 'border-pink-500/20' : 'border-pink-400/20'
          }`}
        />
        
        {/* Academic Pattern */}
        <div className={`absolute inset-0 opacity-5 ${
          isDark ? 'text-purple-400' : 'text-purple-500'
        }`}>
          <svg className="w-full h-full" xmlns="http://www.w3.org/2000/svg">
            <defs>
              <pattern id="academic" width="100" height="100" patternUnits="userSpaceOnUse">
                <path d="M 0 50 L 100 50 M 50 0 L 50 100 M 0 0 L 100 100 M 0 100 L 100 0" 
                      fill="none" stroke="currentColor" strokeWidth="1"/>
                <circle cx="50" cy="50" r="4" fill="currentColor"/>
                <rect x="25" y="25" width="50" height="50" fill="none" stroke="currentColor" strokeWidth="1"/>
              </pattern>
            </defs>
            <rect width="100%" height="100%" fill="url(#academic)" />
          </svg>
        </div>
      </div>

      {/* Content */}
      <div className="relative z-10 max-w-7xl mx-auto px-6">
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
            Research &{" "}
            <span className={`bg-gradient-to-r ${
              isDark ? 'from-purple-400 to-pink-400' : 'from-purple-600 to-pink-600'
            } bg-clip-text text-transparent`}>
              Publications
            </span>
          </h2>
          <p className={`text-lg max-w-3xl mx-auto ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Exploring the frontiers of blockchain technology, artificial intelligence, and distributed systems
          </p>
          <div className={`w-24 h-1 mx-auto rounded-full mt-6 ${
            isDark ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`} />
        </motion.div>

        {/* Main Thesis Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          viewport={{ once: true }}
          className="mb-20"
        >
          <div className={`p-8 rounded-3xl backdrop-blur-sm border shadow-2xl ${
            isDark 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white/70 border-gray-200'
          }`}>
            <div className="text-center mb-8">
              <div className={`inline-flex items-center justify-center w-20 h-20 rounded-full mb-6 ${
                isDark ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <BookOpen size={40} className={isDark ? 'text-purple-400' : 'text-purple-600'} />
              </div>
              <h3 className={`text-3xl font-bold mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Main Research Focus
              </h3>
              <p className={`text-lg max-w-4xl mx-auto ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                My research centers on developing innovative solutions at the intersection of blockchain technology, 
                artificial intelligence, and distributed systems. I focus on creating scalable architectures that 
                address real-world challenges in decentralized applications and intelligent systems.
              </p>
            </div>

            {/* Research Areas Grid */}
            <div className="grid md:grid-cols-2 gap-6">
              {researchAreas.map((area, index) => (
                <motion.div
                  key={area.title}
                  initial={{ opacity: 0, y: 30 }}
                  whileInView={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.6, delay: 0.4 + index * 0.1 }}
                  viewport={{ once: true }}
                  whileHover={{ scale: 1.02, y: -5 }}
                  className={`p-6 rounded-2xl border transition-all duration-300 ${
                    isDark 
                      ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                      : 'bg-white/50 border-gray-200 hover:bg-white/70'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-12 h-12 rounded-lg mb-4 ${
                    area.color === 'purple' ? (isDark ? 'bg-purple-500/20' : 'bg-purple-100') :
                    area.color === 'blue' ? (isDark ? 'bg-blue-500/20' : 'bg-blue-100') :
                    area.color === 'pink' ? (isDark ? 'bg-pink-500/20' : 'bg-pink-100') :
                    (isDark ? 'bg-green-500/20' : 'bg-green-100')
                  }`}>
                    <area.icon size={24} className={
                      area.color === 'purple' ? (isDark ? 'text-purple-400' : 'text-purple-600') :
                      area.color === 'blue' ? (isDark ? 'text-blue-400' : 'text-blue-600') :
                      area.color === 'pink' ? (isDark ? 'text-pink-400' : 'text-pink-600') :
                      (isDark ? 'text-green-400' : 'text-green-600')
                    } />
                  </div>
                  <h4 className={`text-xl font-semibold mb-3 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {area.title}
                  </h4>
                  <p className={`text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {area.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </motion.div>

        {/* Publications Section */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.4 }}
          viewport={{ once: true }}
          className="mb-16"
        >
          <div className="text-center mb-12">
            <h3 className={`text-3xl font-bold mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Publications
            </h3>
            <p className={`text-lg ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {publications.length} research papers published in top-tier conferences and journals
            </p>
          </div>

          {/* Publications Grid */}
          <div className="space-y-8">
            {publications.map((pub, index) => (
              <motion.div
                key={pub.doi}
                initial={{ opacity: 0, y: 50 }}
                whileInView={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 0.6 + index * 0.1 }}
                viewport={{ once: true }}
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-8 rounded-2xl backdrop-blur-sm border shadow-lg transition-all duration-300 ${
                  isDark 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                    : 'bg-white/70 border-gray-200 hover:bg-white/90'
                }`}
              >
                <div className="flex flex-col lg:flex-row gap-6">
                  {/* Main Content */}
                  <div className="flex-1">
                    {/* Title */}
                    <h4 className={`text-xl font-bold mb-3 ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {pub.title}
                    </h4>

                    {/* Authors */}
                    <p className={`text-sm mb-3 ${
                      isDark ? 'text-purple-300' : 'text-purple-600'
                    }`}>
                      {pub.authors}
                    </p>

                    {/* Venue and Year */}
                    <div className={`flex items-center gap-4 mb-4 text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <div className="flex items-center gap-2">
                        <Globe size={16} />
                        {pub.venue}
                      </div>
                      <div className="flex items-center gap-2">
                        <Calendar size={16} />
                        {pub.year}
                      </div>
                    </div>

                    {/* Abstract */}
                    <p className={`text-sm leading-relaxed mb-4 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {pub.abstract}
                    </p>

                    {/* DOI */}
                    <p className={`text-xs font-mono ${
                      isDark ? 'text-gray-500' : 'text-gray-500'
                    }`}>
                      DOI: {pub.doi}
                    </p>
                  </div>

                  {/* Sidebar */}
                  <div className="lg:w-48 space-y-4">
                    {/* Category Badge */}
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium ${
                      isDark 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                    }`}>
                      {pub.category}
                    </div>

                    {/* Impact and Citations */}
                    <div className="space-y-2">
                      <div className={`text-center p-3 rounded-lg ${
                        isDark ? 'bg-white/5' : 'bg-gray-50'
                      }`}>
                        {/* <div className={`text-lg font-bold ${
                          isDark ? 'text-purple-400' : 'text-purple-600'
                        }`}>
                          {pub.impact}
                        </div> */}
                        <div className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Impact
                        </div>
                      </div>
                      <div className={`text-center p-3 rounded-lg ${
                        isDark ? 'bg-white/5' : 'bg-gray-50'
                      }`}>
                        <div className={`text-lg font-bold ${
                          isDark ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          {pub.citations}
                        </div>
                        <div className={`text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Citations
                        </div>
                      </div>
                    </div>

                    {/* Read Paper Button */}
                    <motion.a
                      href={pub.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`block w-full text-center px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300 ${
                        isDark
                          ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
                      }`}
                    >
                      <ExternalLink size={16} className="inline mr-2" />
                      Read Paper
                    </motion.a>
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </motion.div>

        {/* Call to Action */}
        <motion.div
          initial={{ opacity: 0, y: 50 }}
          whileInView={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.8 }}
          viewport={{ once: true }}
          className="text-center"
        >
          <p className={`text-lg mb-6 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Interested in collaborating on research projects?
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
            Get In Touch
          </motion.a>
        </motion.div>
      </div>
    </section>
  );
}
