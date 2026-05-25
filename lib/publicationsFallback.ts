import { mergeScrapedPublication } from "@/lib/scholarEnrichment";
import type { ScrapedPublication } from "@/lib/scholarParser";
import type { Publication } from "@/lib/publications";

/** Canonical Google Scholar profile (user id rMUfQ20AAAAJ). */
export const SCHOLAR_PROFILE_URL =
  "https://scholar.google.ca/citations?user=rMUfQ20AAAAJ&hl=en&authuser=1";

/**
 * Last-known Scholar snapshot (citation counts + ordering) used when live
 * scraping fails (network block, CAPTCHA, static hosting without API routes).
 */
const SNAPSHOT: ScrapedPublication[] = [
  {
    title:
      "Optimizing gas consumption in ethereum smart contracts: Best practices and techniques",
    authors: "S Khanzadeh, N Samreen, MH Alalfi",
    venue:
      "2023 IEEE 23rd International Conference on Software Quality, Reliability …, 2023",
    year: "2023",
    citations: "15",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title:
      "Agentmesh: A cooperative multi-agent generative ai framework for software development automation",
    authors: "S Khanzadeh",
    venue: "arXiv preprint arXiv:2507.19902, 2025",
    year: "2025",
    citations: "6",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title:
      "An exploratory study on domain knowledge infusion in deep learning for automated threat defense",
    authors: "S Khanzadeh, ECP Neto, S Iqbal, M Alalfi, S Buffett",
    venue: "International Journal of Information Security 24 (1), 71, 2025",
    year: "2025",
    citations: "4",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title:
      "GANsemble for Small and Imbalanced Data Sets: A Baseline for Synthetic Microplastics Data",
    authors: "D Platnick, S Khanzadeh, A Sadeghian, RA Valenzano",
    venue: "Canadian Artificial Intelligence Conference, 2024",
    year: "2024",
    citations: "4",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title: "Solosphere: A framework for gas optimization in solidity smart contracts",
    authors: "S Khanzadeh, MH Alalfi",
    venue:
      "2024 IEEE International Conference on Software Analysis, Evolution and …, 2024",
    year: "2024",
    citations: "3",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title:
      "Correction: An exploratory study on domain knowledge infusion in deep learning for automated threat defense",
    authors: "S Khanzadeh, ECP Neto, S Iqbal, M Alalfi, S Buffett",
    venue: "International Journal of Information Security 24 (3), 118, 2025",
    year: "2025",
    citations: "2",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title: "Opti code pro: A heuristic search-based approach to code refactoring",
    authors: "S Khanzadeh, SAN Chan, R Valenzano, M Alalfi",
    venue: "arXiv preprint arXiv:2305.07594, 2023",
    year: "2023",
    citations: "1",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title:
      "Breadth-First Search vs. Restarting Random Walks for Escaping Uninformed Heuristic Regions",
    authors: "D Platnick, D Tomasz, E Earl, S Khanzadeh, R Valenzano",
    venue: "AAAI Conference on Artificial Intelligence, 2025",
    year: "2025",
    citations: "—",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
  {
    title:
      "Integrating Auxiliary Knowledge into Machine Learning to Improve the Detection of Cyberattacks",
    authors: "S Iqbal, S Khanzadeh, ECP Neto, S Buffett, M Sultana, A Taylor",
    venue:
      "2025 International Symposium on Networks, Computers and Communications …, 2025",
    year: "2025",
    citations: "—",
    scholarCitationUrl: SCHOLAR_PROFILE_URL,
  },
];

export const FALLBACK_PUBLICATIONS: Publication[] =
  SNAPSHOT.map(mergeScrapedPublication);
