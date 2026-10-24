import ExpertiseChart from './ExpertiseChart.jsx';

const domains = [
  {
    name: 'Agent systems',
    description: 'Build agents that plan and carry out tasks by calling tools and APIs, with prompts and decision traces designed so every step can be audited.',
    skills: ['Tool calling', 'Prompt engineering', 'Planning & search'],
  },
  {
    name: 'Retrieval & memory',
    description: 'Ground answers in the right context with retrieval-augmented generation, context management, privacy-preserving memory and adaptive knowledge graphs.',
    skills: ['RAG', 'Context & memory', 'Knowledge graphs'],
  },
  {
    name: 'Multi-agent orchestration',
    description: 'Coordinate planning, coding, debugging and review across agents, using feedback from execution and recovery from tool failures.',
    skills: ['Role coordination', 'Tool orchestration', 'Execution feedback'],
  },
  {
    name: 'Evaluation & guardrails',
    description: 'Measure task completion, groundedness and faithfulness, replay counterfactuals to find failures, and add guardrails that keep agents within bounds.',
    skills: ['Failure analysis', 'Causal evaluation', 'Guardrails'],
  },
  {
    name: 'Models & infrastructure',
    description: 'Adapt and ship models with fine-tuning, quantization and reinforcement learning, packaged with Docker and CI/CD so experiments and deployments are repeatable.',
    skills: ['Fine-tuning & quantization', 'Reinforcement learning', 'Docker & CI/CD'],
  },
];

export default function Thread() {
  return (
    <section className="expertise section" id="thread" data-formation="orbit" data-chapter="thread" aria-labelledby="expertise-title">
      <div className="expertise__inner">
        <p className="label"><span>02</span>Expertise</p>
        <header className="expertise__head">
          <h2 className="display" id="expertise-title" data-split="words">Engineering AI that reasons, retrieves and <em>acts</em>.</h2>
          <p className="expertise__intro" data-reveal="">These are the parts of an AI system I design, build and evaluate, taking each one from research to working software.</p>
        </header>

        <ExpertiseChart domains={domains} />
      </div>
    </section>
  );
}
