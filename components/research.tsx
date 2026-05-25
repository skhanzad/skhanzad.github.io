"use client"
import { motion, useScroll, useTransform } from "framer-motion";
import { useRef, useState, useEffect } from "react";
import { BookOpen, FileText, Award, ExternalLink, Calendar, Users, Globe, TrendingUp } from "lucide-react";
import ResearchThreeBackdrop from "@/components/researchThree";
import type {
  Publication,
  ScholarMetrics,
  ScholarPublicationsResponse,
} from "@/lib/publications";
import { FALLBACK_PUBLICATIONS, SCHOLAR_PROFILE_URL } from "@/lib/publicationsFallback";

export default function Research({ isDark }: { isDark: boolean }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [publications, setPublications] =
    useState<Publication[]>(FALLBACK_PUBLICATIONS);
  const [scholarMetrics, setScholarMetrics] = useState<ScholarMetrics | null>(
    null
  );
  const [scholarUpdatedAt, setScholarUpdatedAt] = useState<string | null>(null);
  const [scholarOk, setScholarOk] = useState<boolean | null>(null);
  const [scholarLoading, setScholarLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/scholar-publications", {
          cache: "no-store",
        });
        const data: ScholarPublicationsResponse = await res.json();
        if (cancelled) return;
        setPublications(data.publications);
        setScholarMetrics(data.metrics);
        setScholarUpdatedAt(data.updatedAt);
        setScholarOk(data.ok);
      } catch {
        if (!cancelled) {
          setPublications(FALLBACK_PUBLICATIONS);
          setScholarMetrics(null);
          setScholarOk(false);
        }
      } finally {
        if (!cancelled) setScholarLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const { scrollYProgress } = useScroll({
    target: containerRef,
    offset: ["start end", "end start"]
  });

  const y1 = useTransform(scrollYProgress, [0, 1], [0, -60]);
  const y2 = useTransform(scrollYProgress, [0, 1], [0, 80]);
  const y3 = useTransform(scrollYProgress, [0, 1], [0, -100]);

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
      className={`relative py-12 sm:py-20 overflow-hidden ${
        isDark ? 'bg-gradient-to-b from-slate-900 to-black' : 'bg-gradient-to-b from-purple-50 to-blue-50'
      }`}
      id="research"
    >
      <div
        className="pointer-events-none absolute inset-y-0 right-0 z-0 w-[min(88vw,720px)] sm:w-[min(52vw,760px)] lg:w-[min(46%,820px)] [mask-image:linear-gradient(90deg,transparent,black_32%)] [-webkit-mask-image:linear-gradient(90deg,transparent,black_32%)]"
        aria-hidden
      >
        <ResearchThreeBackdrop isDark={isDark} />
      </div>
      {/* Animated Background Patterns - hidden on small screens to avoid overlap */}
      <div className="absolute inset-0 z-[1] overflow-hidden pointer-events-none">
        <motion.div
          style={{ y: y1 }}
          className={`absolute top-20 left-4 sm:left-20 w-24 h-24 sm:w-32 sm:h-32 border-2 rounded-full hidden sm:block ${
            isDark ? 'border-purple-500/20' : 'border-purple-400/20'
          }`}
        />
        <motion.div
          style={{ y: y2 }}
          className={`absolute top-40 right-4 sm:right-32 w-20 h-20 sm:w-24 sm:h-24 border-2 rotate-45 hidden sm:block ${
            isDark ? 'border-blue-500/20' : 'border-blue-400/20'
          }`}
        />
        <motion.div
          style={{ y: y3 }}
          className={`absolute bottom-20 left-1/4 sm:left-1/3 w-16 h-16 sm:w-20 sm:h-20 border-2 rounded-full hidden sm:block ${
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
      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6">
        {/* Header */}
        <div data-gsap="section-header" className="text-center mb-10 sm:mb-16">
          <h2 className={`text-3xl sm:text-4xl md:text-5xl font-bold mb-4 sm:mb-6 ${
            isDark ? 'text-white' : 'text-gray-900'
          }`}>
            Research &{" "}
            <span className={`bg-gradient-to-r ${
              isDark ? 'from-purple-400 to-pink-400' : 'from-purple-600 to-pink-600'
            } bg-clip-text text-transparent`}>
              Publications
            </span>
          </h2>
          <p className={`text-base sm:text-lg max-w-3xl mx-auto px-1 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Exploring the frontiers of blockchain technology, artificial intelligence, and distributed systems
          </p>
          <div data-gsap="section-underline" className={`w-24 h-1 mx-auto rounded-full mt-4 sm:mt-6 ${
            isDark ? 'bg-gradient-to-r from-purple-400 to-pink-400' : 'bg-gradient-to-r from-purple-500 to-pink-500'
          }`} />
        </div>

        {/* Main Thesis Section */}
        <div data-gsap="research-focus-block" className="mb-12 sm:mb-20">
          <div className={`p-4 sm:p-6 md:p-8 rounded-2xl sm:rounded-3xl backdrop-blur-sm border shadow-2xl ${
            isDark 
              ? 'bg-white/5 border-white/10' 
              : 'bg-white/70 border-gray-200'
          }`}>
            <div className="text-center mb-6 sm:mb-8">
              <div className={`inline-flex items-center justify-center w-16 h-16 sm:w-20 sm:h-20 rounded-full mb-4 sm:mb-6 ${
                isDark ? 'bg-purple-500/20' : 'bg-purple-100'
              }`}>
                <BookOpen size={32} className={`sm:w-10 sm:h-10 ${isDark ? 'text-purple-400' : 'text-purple-600'}`} />
              </div>
              <h3 className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 ${
                isDark ? 'text-white' : 'text-gray-900'
              }`}>
                Main Research Focus
              </h3>
              <p className={`text-sm sm:text-base md:text-lg max-w-4xl mx-auto ${
                isDark ? 'text-gray-300' : 'text-gray-700'
              }`}>
                My research centers on developing innovative solutions at the intersection of blockchain technology, 
                artificial intelligence, and distributed systems. I focus on creating scalable architectures that 
                address real-world challenges in decentralized applications and intelligent systems.
              </p>
            </div>

            {/* Research Areas Grid */}
            <div data-gsap="research-areas-group" className="grid sm:grid-cols-2 gap-4 sm:gap-6">
              {researchAreas.map((area) => (
                <motion.div
                  key={area.title}
                  data-gsap="research-area"
                  whileHover={{ scale: 1.02, y: -5 }}
                  className={`p-4 sm:p-6 rounded-xl sm:rounded-2xl border transition-all duration-300 ${
                    isDark 
                      ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                      : 'bg-white/50 border-gray-200 hover:bg-white/70'
                  }`}
                >
                  <div className={`inline-flex items-center justify-center w-10 h-10 sm:w-12 sm:h-12 rounded-lg mb-3 sm:mb-4 ${
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
                  <h4 className={`text-base sm:text-lg md:text-xl font-semibold mb-2 sm:mb-3 ${
                    isDark ? 'text-white' : 'text-gray-900'
                  }`}>
                    {area.title}
                  </h4>
                  <p className={`text-xs sm:text-sm ${
                    isDark ? 'text-gray-300' : 'text-gray-600'
                  }`}>
                    {area.description}
                  </p>
                </motion.div>
              ))}
            </div>
          </div>
        </div>

        {/* Publications Section */}
        <div className="mb-12 sm:mb-16">
          <div data-gsap="subsection-header" className="text-center mb-8 sm:mb-12">
            <h3 className={`text-2xl sm:text-3xl font-bold mb-3 sm:mb-4 ${
              isDark ? 'text-white' : 'text-gray-900'
            }`}>
              Publications
            </h3>
            <p className={`text-sm sm:text-base md:text-lg ${
              isDark ? 'text-gray-300' : 'text-gray-600'
            }`}>
              {publications.length} works listed on{" "}
              <a
                href={SCHOLAR_PROFILE_URL}
                target="_blank"
                rel="noopener noreferrer"
                className={`underline-offset-2 hover:underline ${
                  isDark ? "text-purple-300" : "text-purple-700"
                }`}
              >
                Google Scholar
              </a>
              {scholarMetrics ? (
                <>
                  {" "}
                  · Profile citations{" "}
                  <span className="font-semibold text-current">
                    {scholarMetrics.citations}
                  </span>
                  , h-index{" "}
                  <span className="font-semibold">{scholarMetrics.hIndex}</span>
                  , i10-index{" "}
                  <span className="font-semibold">{scholarMetrics.i10Index}</span>
                </>
              ) : null}
              {scholarUpdatedAt ? (
                <span
                  className={`mt-2 block text-xs ${
                    isDark ? "text-gray-500" : "text-gray-500"
                  }`}
                >
                  Last fetch: {new Date(scholarUpdatedAt).toLocaleString()}
                  {scholarOk === false
                    ? " — showing bundled snapshot (Scholar unreachable or blocked)."
                    : null}
                </span>
              ) : null}
            </p>
            {scholarLoading ? (
              <p
                className={`mt-2 text-xs ${
                  isDark ? "text-purple-300/90" : "text-purple-600/90"
                }`}
              >
                Refreshing publication list from Google Scholar…
              </p>
            ) : null}
          </div>

          {/* Publications Grid - pub-card animated in GSAPScrollAnimations */}
          <div className="space-y-6 sm:space-y-8">
            {publications.map((pub) => (
              <motion.div
                key={`${pub.title}-${pub.year}`}
                data-gsap="pub-card"
                whileHover={{ scale: 1.01, y: -2 }}
                className={`p-4 sm:p-6 md:p-8 rounded-xl sm:rounded-2xl backdrop-blur-sm border shadow-lg transition-all duration-300 ${
                  isDark 
                    ? 'bg-white/5 border-white/10 hover:bg-white/10' 
                    : 'bg-white/70 border-gray-200 hover:bg-white/90'
                }`}
              >
                <div className="flex flex-col lg:flex-row gap-4 sm:gap-6">
                  {/* Main Content */}
                  <div className="flex-1 min-w-0">
                    {/* Title */}
                    <h4 className={`text-base sm:text-lg md:text-xl font-bold mb-2 sm:mb-3 leading-snug ${
                      isDark ? 'text-white' : 'text-gray-900'
                    }`}>
                      {pub.title}
                    </h4>

                    {/* Authors */}
                    <p className={`text-xs sm:text-sm mb-2 sm:mb-3 break-words ${
                      isDark ? 'text-purple-300' : 'text-purple-600'
                    }`}>
                      {pub.authors}
                    </p>

                    {/* Venue and Year */}
                    <div className={`flex flex-wrap items-center gap-x-4 gap-y-1 mb-3 sm:mb-4 text-xs sm:text-sm ${
                      isDark ? 'text-gray-400' : 'text-gray-600'
                    }`}>
                      <div className="flex items-start gap-2 min-w-0">
                        <Globe size={14} className="shrink-0 mt-0.5 sm:w-4 sm:h-4" />
                        <span className="break-words">{pub.venue}</span>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <Calendar size={14} className="shrink-0 sm:w-4 sm:h-4" />
                        {pub.year}
                      </div>
                    </div>

                    {/* Abstract - line clamp on mobile to keep cards scannable */}
                    <p className={`text-xs sm:text-sm leading-relaxed mb-3 sm:mb-4 line-clamp-4 md:line-clamp-6 ${
                      isDark ? 'text-gray-300' : 'text-gray-700'
                    }`}>
                      {pub.abstract}
                    </p>

                    {/* DOI - smaller on mobile, hide if empty */}
                    {pub.doi ? (
                      <p className={`text-[10px] sm:text-xs font-mono truncate ${
                        isDark ? 'text-gray-500' : 'text-gray-500'
                      }`} title={pub.doi}>
                        DOI: {pub.doi}
                      </p>
                    ) : null}
                  </div>

                  {/* Sidebar - stacks on mobile, fixed width on lg */}
                  <div className="flex flex-row flex-wrap items-center gap-3 sm:flex-col sm:flex-nowrap lg:w-48 lg:flex-col lg:flex-nowrap lg:shrink-0 lg:space-y-4">
                    {/* Category Badge */}
                    <div className={`inline-block px-3 py-1 rounded-full text-xs font-medium shrink-0 ${
                      isDark 
                        ? 'bg-purple-500/20 text-purple-300 border border-purple-500/30' 
                        : 'bg-purple-100 text-purple-700 border border-purple-200'
                    }`}>
                      {pub.category}
                    </div>

                    {/* Citations - inline on mobile */}
                    <div className="flex items-center gap-3 sm:flex-col sm:gap-2 sm:w-full">
                      <div className={`text-center px-3 py-2 sm:p-3 rounded-lg shrink-0 ${
                        isDark ? 'bg-white/5' : 'bg-gray-50'
                      }`}>
                        <div className={`text-sm sm:text-lg font-bold ${
                          isDark ? 'text-blue-400' : 'text-blue-600'
                        }`}>
                          {pub.citations}
                        </div>
                        <div className={`text-[10px] sm:text-xs ${
                          isDark ? 'text-gray-400' : 'text-gray-600'
                        }`}>
                          Citations
                        </div>
                      </div>
                    </div>

                    {/* Read Paper Button - full width on mobile */}
                    <motion.a
                      href={pub.link}
                      target="_blank"
                      rel="noopener noreferrer"
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.95 }}
                      className={`w-full sm:w-full text-center px-4 py-2.5 sm:py-2 rounded-lg text-sm font-medium transition-all duration-300 inline-flex items-center justify-center ${
                        isDark
                          ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30 border border-purple-500/30'
                          : 'bg-purple-100 text-purple-700 hover:bg-purple-200 border border-purple-200'
                      }`}
                    >
                      <ExternalLink size={16} className="shrink-0 mr-2" />
                      Read Paper
                    </motion.a>
                    {pub.scholarCitationUrl &&
                    pub.scholarCitationUrl !== pub.link ? (
                      <motion.a
                        href={pub.scholarCitationUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.97 }}
                        className={`w-full text-center text-xs font-medium underline-offset-2 hover:underline ${
                          isDark ? "text-gray-400" : "text-gray-600"
                        }`}
                      >
                        View on Google Scholar
                      </motion.a>
                    ) : null}
                  </div>
                </div>
              </motion.div>
            ))}
          </div>
        </div>

        {/* Call to Action */}
        <div data-gsap="research-cta" className="text-center px-2">
          <p className={`text-base sm:text-lg mb-4 sm:mb-6 ${
            isDark ? 'text-gray-300' : 'text-gray-600'
          }`}>
            Interested in collaborating on research projects?
          </p>
          <motion.a
            href="#contact"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            className={`inline-block px-6 py-3 sm:px-8 sm:py-4 rounded-full font-semibold text-base sm:text-lg transition-all duration-300 ${
              isDark
                ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
                : 'bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white shadow-lg shadow-purple-500/25'
            }`}
          >
            Get In Touch
          </motion.a>
        </div>
      </div>
    </section>
  );
}
