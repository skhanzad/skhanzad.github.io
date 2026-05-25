import type { Publication } from "@/lib/publications";
import type { ScrapedPublication } from "@/lib/scholarParser";

type Enrichment = {
  match: (title: string) => boolean;
  doi: string;
  abstract: string;
  category: string;
  link: string;
  /** When Scholar truncates the venue line, prefer this full string */
  venueFull?: string;
};

const ENRICHMENTS: Enrichment[] = [
  {
    match: (t) =>
      t.toLowerCase().includes("optimizing gas consumption in ethereum"),
    doi: "10.1109/QRS-C60940.2023.00056",
    venueFull:
      "2023 IEEE 23rd International Conference on Software Quality, Reliability and Security Companion (QRS-C)",
    category: "Blockchain & Cryptocurrency",
    link: "https://ieeexplore.ieee.org/abstract/document/10429984",
    abstract:
      "Smart contracts on Ethereum consume gas proportional to computation. This work presents around 28 gas-efficient Solidity patterns with examples and measured savings, categorizes them, and compares tooling for gas optimization—supporting developers who must balance cost and security.",
  },
  {
    match: (t) =>
      t.toLowerCase().includes("agentmesh") &&
      t.toLowerCase().includes("multi-agent"),
    doi: "10.48550/arXiv.2507.19902",
    category: "Multi-Agent Systems",
    link: "https://arxiv.org/abs/2507.19902",
    abstract:
      "AgentMesh is a Python framework in which cooperating LLM agents (Planner, Coder, Debugger, Reviewer) automate software development from requirements through implementation, testing, and review—with prompt strategies, orchestration, and a case study on non-trivial tasks.",
  },
  {
    match: (t) =>
      t.toLowerCase().startsWith("correction:") &&
      t.toLowerCase().includes("domain knowledge infusion"),
    doi: "10.1007/s10207-025-00987-4",
    venueFull: "International Journal of Information Security (correction)",
    category: "Cybersecurity & Machine Learning",
    link: "https://link.springer.com/article/10.1007/s10207-025-00987-4",
    abstract:
      "Publisher correction to the exploratory study on infusing cybersecurity domain knowledge into deep learning for automated threat defense (International Journal of Information Security).",
  },
  {
    match: (t) =>
      t.toLowerCase().includes("exploratory study") &&
      t.toLowerCase().includes("domain knowledge infusion") &&
      !t.toLowerCase().startsWith("correction"),
    doi: "10.1007/s10207-025-00987-4",
    venueFull: "International Journal of Information Security, Vol. 24, No. 1, pp. 71 (2025)",
    category: "Cybersecurity & Machine Learning",
    link: "https://link.springer.com/article/10.1007/s10207-025-00987-4",
    abstract:
      "Studies how cybersecurity domain knowledge can be infused into deep learning and reinforcement learning for automated threat defense—definitions, benefits, challenges, a roadmap for red/blue teaming, explainability, and open problems for next-generation security systems.",
  },
  {
    match: (t) => t.toLowerCase().includes("gansemble"),
    doi: "",
    venueFull:
      "Canadian Artificial Intelligence Association (CANAI) / Canadian AI Conference, 2024",
    category: "Machine Learning",
    link: "https://assets.pubpub.org/gokuyo6b/PLATNICK-51716777406141.pdf",
    abstract:
      "GANsemble connects data augmentation with conditional GANs for class-conditioned synthetic data on small, imbalanced microplastics datasets—introducing MPcGAN, SYMP baselines (FID/IS), SYMP-Filter, and oversampling guidance for class imbalance.",
  },
  {
    match: (t) => t.toLowerCase().includes("solosphere"),
    doi: "10.1109/SANER-C62648.2024.00010",
    category: "Blockchain Development",
    link: "https://ieeexplore.ieee.org/abstract/document/10621683",
    abstract:
      "SolOSphere unifies tooling for analyzing, deploying, verifying, and optimizing gas for Solidity contracts (SolO, SMARTS, SolOLab)—including GitHub ingestion and SMARTS-GPT integration—toward a full smart-contract development lifecycle.",
  },
  {
    match: (t) =>
      t.toLowerCase().includes("opti") &&
      t.toLowerCase().includes("code refactoring"),
    doi: "10.48550/arXiv.2305.07594",
    category: "Software Engineering",
    link: "https://arxiv.org/abs/2305.07594",
    abstract:
      "Evaluates best-first search for code refactoring toward high cohesion and low coupling using heuristic search on an approximate refactoring state space, with examples on random problems and a Java implementation tool.",
  },
  {
    match: (t) =>
      t.toLowerCase().includes("breadth-first search") &&
      t.toLowerCase().includes("restarting random walks"),
    doi: "10.1609/aaai.v40i43.41044",
    venueFull:
      "Proceedings of the AAAI Conference on Artificial Intelligence (AAAI), Vol. 40, No. 43, pp. 37143–37151, 2026",
    category: "Automated Planning & Heuristic Search",
    link: "https://ojs.aaai.org/index.php/AAAI/article/view/41044",
    abstract:
      "Compares breadth-first search vs. restarting random walks for escaping uninformed heuristic regions in greedy search; derives expected runtimes, conditions when RRW beats BrFS, EHC-RRW variants with theory and PDDL benchmark experiments.",
  },
  {
    match: (t) =>
      t.toLowerCase().includes("integrating auxiliary knowledge") &&
      t.toLowerCase().includes("cyberattacks"),
    doi: "10.1109/ISNCC61477.2025.11250444",
    venueFull:
      "2025 International Symposium on Networks, Computers and Communications (ISNCC), IEEE, pp. 1–4",
    category: "Cybersecurity & Machine Learning",
    link: "https://ieeexplore.ieee.org/abstract/document/11250444/",
    abstract:
      "Explores auxiliary knowledge for feature engineering so ML models better separate legitimate vs. malicious traffic—framing Knowledge-Infused Learning for cyberattack detection and evaluating benefits for operational deployment (interpretability and false positives).",
  },
];

function findEnrichment(title: string): Enrichment | undefined {
  return ENRICHMENTS.find((e) => e.match(title));
}

function isScholarCitationPage(url: string): boolean {
  return url.includes("view_op=view_citation");
}

export function mergeScrapedPublication(row: ScrapedPublication): Publication {
  const e = findEnrichment(row.title);
  const primaryLink = e?.link ?? row.scholarCitationUrl;
  return {
    title: row.title,
    authors: row.authors,
    venue: e?.venueFull ?? row.venue,
    year: row.year,
    doi: e?.doi ?? "",
    abstract:
      e?.abstract ??
      "Abstract not available from the Scholar listing; open the link for full publication details.",
    citations: row.citations,
    category: e?.category ?? "Research",
    link: primaryLink,
    scholarCitationUrl: isScholarCitationPage(row.scholarCitationUrl)
      ? row.scholarCitationUrl
      : undefined,
  };
}
