export default function CareerPath() {
  return (
    <section className="path section" id="path" data-formation="knot" data-chapter="path">
      <header className="section__head">
        <p className="label"><span>03</span>The Path</p>
        <h2 className="display" data-split="words">One thread through industry, government and <em>academia</em>.</h2>
      </header>

      <div className="timeline" data-timeline="">
        <svg className="timeline__svg" aria-hidden="true"><path className="timeline__base" d=""/><path className="timeline__thread" d=""/><circle className="timeline__needle" r="5"/></svg>

        <article className="role" data-role="">
          <p className="role__when"><span>May 2026 — Present</span><b className="role__badge">Now</b></p>
          <span className="role__knot" aria-hidden="true"></span>
          <div className="role__body">
            <h3 className="role__title">AI Engineer, Agentic Systems</h3>
            <p className="role__org">Flybits <span>Full-time · Toronto</span></p>
            <ul>
              <li>Build agents that plan and execute tasks across internal and partner APIs, with decision traces that support end-to-end audits.</li>
              <li>Ground responses in structured customer-context graphs, combining retrieval and learned models with symbolic constraints.</li>
              <li>Evaluate task completion, groundedness, faithfulness and recovery from tool failures, and use the results to tune model routing for capability, latency and cost.</li>
            </ul>
          </div>
        </article>

        <article className="role" data-role="">
          <p className="role__when"><span>May 2026 — Present</span><b className="role__badge">Now</b></p>
          <span className="role__knot" aria-hidden="true"></span>
          <div className="role__body">
            <h3 className="role__title">AI Research Engineer, sAIpien</h3>
            <p className="role__org">MIT Media Lab <span>Part-time research affiliation</span></p>
            <ul>
              <li>Prototype perspective-aware agents and private long-term memory using adaptive knowledge graphs (Chronicles), and contribute to HCI² benchmarks for transparency and human oversight.</li>
            </ul>
          </div>
        </article>

        <article className="role" data-role="">
          <p className="role__when"><span>May 2026 — Present</span><b className="role__badge">Now</b></p>
          <span className="role__knot" aria-hidden="true"></span>
          <div className="role__body">
            <h3 className="role__title">Postdoctoral Fellow / AI Research Engineer</h3>
            <p className="role__org">Toronto Metropolitan University <span>Part-time academic appointment</span></p>
            <ul>
              <li>Build Python and PyTorch evaluation systems with execution traces, counterfactual replay and automated scoring to assess agent reasoning, orchestration and reliability.</li>
            </ul>
          </div>
        </article>

        <article className="role" data-role="">
          <p className="role__when"><span>Jan 2023 — Apr 2026</span></p>
          <span className="role__knot" aria-hidden="true"></span>
          <div className="role__body">
            <h3 className="role__title">Machine Learning Engineer (Graduate Research)</h3>
            <p className="role__org">Toronto Metropolitan University <span>Toronto</span></p>
            <ul>
              <li>Developed systems for multi-agent coordination, heuristic planning, reinforcement learning and synthetic-data generation; co-authored research at AAAI 2026 and Canadian AI 2024.</li>
              <li>Built training and inference pipelines with PyTorch, Hugging Face, scikit-learn and XGBoost, using Docker and GitHub Actions to make experiments repeatable.</li>
            </ul>
          </div>
        </article>

        <article className="role" data-role="">
          <p className="role__when"><span>Jan 2024 — Jan 2025</span></p>
          <span className="role__knot" aria-hidden="true"></span>
          <div className="role__body">
            <h3 className="role__title">ML Engineer / Research Scientist Intern</h3>
            <p className="role__org">National Research Council Canada <span>Toronto</span></p>
            <ul>
              <li>Developed knowledge-informed anomaly-detection prototypes for imbalanced telemetry, using domain features to address limited labelled data.</li>
              <li>First-authored a journal study of domain knowledge in deep learning for threat defense, and co-authored research on auxiliary knowledge for cyberattack detection.</li>
            </ul>
          </div>
        </article>

        <article className="role" data-role="">
          <p className="role__when"><span>Aug — Sep 2022</span></p>
          <span className="role__knot" aria-hidden="true"></span>
          <div className="role__body">
            <h3 className="role__title">Software Engineer Intern</h3>
            <p className="role__org">NTN Company</p>
            <ul>
              <li>Delivered an internal administration portal using Angular, Node.js, Firebase and Sass.</li>
            </ul>
          </div>
        </article>
      </div>

      <div className="ledger">
        <div className="ledger__col" data-reveal="">
          <h3 className="ledger__title">Education</h3>
          <article className="ledger__item">
            <p className="ledger__when">Sep 2023 — May 2026</p>
            <h4>Ph.D., Computer Science</h4>
            <p>Toronto Metropolitan University · <strong>GPA A+</strong></p>
          </article>
          <article className="ledger__item">
            <p className="ledger__when">Sep 2018 — Dec 2022</p>
            <h4>Bachelor of Computer Science</h4>
            <p>Toronto Metropolitan University · <strong>Dean’s List, 2020–2021</strong></p>
            <p className="dim">A+ in Machine Learning, Artificial Intelligence, Reinforcement Learning and Computer Vision.</p>
          </article>
        </div>
        <div className="ledger__col" data-reveal="">
          <h3 className="ledger__title">Entrepreneurship</h3>
          <article className="ledger__item">
            <p className="ledger__when">Founder</p>
            <h4>Ariadne Growth Systems</h4>
            <p>Builds measurement, automation and customer-acquisition systems for service businesses.</p>
          </article>
        </div>
      </div>
    </section>
  );
}
