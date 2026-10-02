const domains = [
  {
    name: 'Distributed systems',
    description: 'Connect services, APIs and data stores into reproducible workflows, with attention to orchestration and recovery from failure.',
    skills: ['API integration', 'Docker & Kubernetes', 'PostgreSQL & Redis'],
  },
  {
    name: 'Cybersecurity',
    description: 'Apply domain knowledge and machine learning to anomaly detection, imbalanced telemetry and cyberattack detection.',
    skills: ['Anomaly detection', 'Threat modeling', 'Privacy controls'],
  },
  {
    name: 'Blockchain',
    description: 'Improve smart-contract efficiency with static analysis, LLM-assisted rewrites and differential fuzzing to check behavior.',
    skills: ['Smart contracts', 'Gas optimization', 'Differential fuzzing'],
  },
  {
    name: 'AI reasoning',
    description: 'Build and evaluate agents that combine retrieval, heuristic planning and symbolic constraints, using execution traces and counterfactual replay.',
    skills: ['Causal evaluation', 'Planning & search', 'Grounded retrieval'],
  },
  {
    name: 'Multi-agent coordination',
    description: 'Coordinate planning, coding, debugging and review across agents, with tool orchestration and feedback from execution.',
    skills: ['Role coordination', 'Tool orchestration', 'Execution feedback'],
  },
];

export default function Thread() {
  return (
    <section className="expertise section" id="thread" data-formation="graph" data-chapter="thread" aria-labelledby="expertise-title">
      <div className="expertise__inner">
        <p className="label"><span>01</span>Expertise</p>
        <header className="expertise__head">
          <h2 className="display" id="expertise-title" data-split="words">Engineering across systems, security and <em>AI</em>.</h2>
          <p className="expertise__intro" data-reveal="">My work connects software infrastructure, security research and intelligent agents. These are the skills I bring from research into engineering.</p>
        </header>

        <div className="expertise__grid">
          {domains.map(({ name, description, skills }, index) => (
            <article className="expertise__domain" key={name} data-reveal="">
              <p className="expertise__index" aria-hidden="true">{String(index + 1).padStart(2, '0')}</p>
              <h3 className="expertise__title">{name}</h3>
              <p className="expertise__description">{description}</p>
              <ul className="expertise__skills" aria-label={`${name} skills`}>
                {skills.map((skill) => <li key={skill}>{skill}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
