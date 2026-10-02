export default function Toolkit() {
  return (
    <section className="toolkit section" id="toolkit" data-formation="armillary" data-chapter="toolkit">
      <header className="section__head">
        <p className="label"><span>06</span>Toolkit</p>
        <h2 className="display" data-split="words">The instruments behind the <em>instruments</em>.</h2>
      </header>
      <div className="kits">
        <div className="kit" data-reveal="">
          <h3 className="kit__title"><span>i.</span>AI &amp; evaluation</h3>
          <ul className="chips">
            <li>LLM agents</li><li>RAG</li><li>Tool calling</li><li>Multi-agent orchestration</li><li>Context &amp; memory</li><li>Counterfactual evaluation</li><li>Guardrails</li><li>Failure analysis</li><li>Heuristic search</li><li>Reinforcement learning</li>
          </ul>
        </div>
        <div className="kit" data-reveal="">
          <h3 className="kit__title"><span>ii.</span>Languages &amp; ML</h3>
          <ul className="chips">
            <li>Python</li><li>C/C++</li><li>TypeScript</li><li>Java</li><li>PyTorch</li><li>Hugging Face</li><li>scikit-learn</li><li>XGBoost</li><li>Fine-tuning</li><li>GANs</li><li>Synthetic data</li>
          </ul>
        </div>
        <div className="kit" data-reveal="">
          <h3 className="kit__title"><span>iii.</span>Engineering</h3>
          <ul className="chips">
            <li>Docker</li><li>Kubernetes</li><li>AWS</li><li>PostgreSQL</li><li>Redis</li><li>Git</li><li>GitHub Actions</li><li>APIs</li><li>CI/CD</li><li>Reproducible experimentation</li>
          </ul>
        </div>
      </div>
    </section>
  );
}
