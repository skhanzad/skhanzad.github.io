export default function Research() {
  return (
    <section className="research" id="research" data-formation="graph" data-chapter="research">
      <div className="research__pin" data-research-pin="">
        <div className="research__track" data-research-track="">
          <header className="research__intro">
            <p className="label"><span>04</span>Research</p>
            <h2 className="display" data-split="words">Instruments for machine <em>accountability</em>.</h2>
            <p className="research__lede">7 peer-reviewed papers and 6 preprints across agents, causality, search and security. Each project below has a live simulation of its method: open one and turn the dials.</p>
            <p className="research__drag" aria-hidden="true"><span>Scroll to explore</span><i></i></p>
          </header>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="ariadne" aria-hidden="true"></div>
            <p className="card__meta"><span>01</span>Sole author · Preprint · 2026</p>
            <h3 className="card__title">Project Ariadne</h3>
            <p className="card__sub">Causal auditing of LLM agents</p>
            <p className="card__metric"><span data-count="76.7" data-decimals="1">76.7</span>%</p>
            <p className="card__metric-label">of audited trajectories showed faithfulness violations (23 of 30)</p>
            <p className="card__desc">Designed and built an intervention-and-replay harness that tests whether an agent’s stated reasoning actually affects its answer.</p>
            <button className="card__sim" type="button" data-sim="ariadne" aria-label="Run the Project Ariadne simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://arxiv.org/abs/2601.02314" target="_blank" rel="noopener">arXiv ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="gaszero" aria-hidden="true"></div>
            <p className="card__meta"><span>02</span>First author · IEEE COMPSAC · 2026</p>
            <h3 className="card__title">GasZero</h3>
            <p className="card__sub">Fuzz-tested smart-contract optimization</p>
            <p className="card__metric"><span data-count="56.6" data-decimals="1">56.6</span>M</p>
            <p className="card__metric-label">gas in cumulative savings across 59 contracts and 527 functions</p>
            <p className="card__desc">Combines static analysis, LLM rewrites and differential fuzzing, with 3.99% average execution savings.</p>
            <button className="card__sim" type="button" data-sim="gaszero" aria-label="Run the GasZero simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://doi.org/10.1109/COMPSAC69091.2026.00126" target="_blank" rel="noopener">IEEE ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="search" aria-hidden="true"></div>
            <p className="card__meta"><span>03</span>AAAI · 2026 · Preprint · 2023</p>
            <h3 className="card__title">Heuristic Search</h3>
            <p className="card__sub">Planning and automated refactoring</p>
            <p className="card__metric"><span data-count="70.3" data-decimals="1">70.3</span>%</p>
            <p className="card__metric-label">of agile-track tasks with unbounded heuristic regions: faster or uniquely solved vs. enforced hill-climbing</p>
            <p className="card__desc">Co-developed a restarting-random-walk planner. In Opti Code Pro, cut node expansions by 82% and runtime by 74% vs. uninformed A* at full refactoring aggression.</p>
            <button className="card__sim" type="button" data-sim="search" aria-label="Run the Heuristic Search simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://doi.org/10.1609/aaai.v40i43.41044" target="_blank" rel="noopener">AAAI ↗</a><a href="https://arxiv.org/abs/2305.07594" target="_blank" rel="noopener">Opti Code Pro ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="gansemble" aria-hidden="true"></div>
            <p className="card__meta"><span>04</span>Co-author · Canadian AI · 2024</p>
            <h3 className="card__title">GANsemble</h3>
            <p className="card__sub">Learning from small, imbalanced datasets</p>
            <p className="card__metric"><span data-count="91.5" data-decimals="1">91.5</span>%</p>
            <p className="card__metric-label">mean classifier accuracy over 10 runs on a 210-image microplastics dataset</p>
            <p className="card__desc">Co-developed augmentation search and a conditional-GAN pipeline: +4 points vs. duplication and +5.5 vs. no oversampling.</p>
            <button className="card__sim" type="button" data-sim="gansemble" aria-label="Run the GANsemble simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://arxiv.org/abs/2404.07356" target="_blank" rel="noopener">arXiv ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="iss" aria-hidden="true"></div>
            <p className="card__meta"><span>05</span>First author · Preprint · 2026</p>
            <h3 className="card__title">Interventional Separation Selection</h3>
            <p className="card__sub">Causal certification</p>
            <p className="card__metric"><span data-count="13.6" data-decimals="1">13.6</span></p>
            <p className="card__metric-label">interventions per image on average, on a colored-MNIST causal-abstraction task</p>
            <p className="card__desc">A method for certifying agreement across candidate causal models under bounded interventions, with guarantees conditional on the true abstraction being in the candidate set.</p>
            <button className="card__sim" type="button" data-sim="iss" aria-label="Run the Interventional Separation Selection simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://arxiv.org/abs/2609.32247" target="_blank" rel="noopener">arXiv ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="chronicles" aria-hidden="true"></div>
            <p className="card__meta"><span>06</span>First author · Preprint · 2026</p>
            <h3 className="card__title">Provenance Preserving Chronicles</h3>
            <p className="card__sub">Private AI context</p>
            <p className="card__metric card__metric--word">Holder-approved</p>
            <p className="card__metric-label">raw artifacts are released only with the holder’s approval</p>
            <p className="card__desc">A federated disclosure protocol that limits shared context to authorized evidence and preserves provenance; specified the architecture and threat model.</p>
            <button className="card__sim" type="button" data-sim="chronicles" aria-label="Run the Provenance Preserving Chronicles simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://arxiv.org/abs/2607.22953" target="_blank" rel="noopener">arXiv ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="mesh" aria-hidden="true"></div>
            <p className="card__meta"><span>07</span>Independent projects · 2025–2026</p>
            <h3 className="card__title">AgentMesh &amp; Folio</h3>
            <p className="card__sub">Agent orchestration and evaluation</p>
            <p className="card__metric"><span data-count="4">4</span></p>
            <p className="card__metric-label">coordinated roles: planning, coding, debugging and review, with execution-driven repair</p>
            <p className="card__desc">AgentMesh is a Python prototype for multi-agent software work. Folio is an experimental paper-review app with PDF ingestion, live rescoring and a reproducible classifier-evaluation workflow.</p>
            <button className="card__sim" type="button" data-sim="mesh" aria-label="Run the AgentMesh &amp; Folio simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://arxiv.org/abs/2507.19902" target="_blank" rel="noopener">AgentMesh ↗</a><a href="https://github.com/skhanzad/Folio" target="_blank" rel="noopener">Folio ↗</a></p>
          </article>

          <article className="card" data-card="">
            <div className="card__glyph" data-glyph="pllm" aria-hidden="true"></div>
            <p className="card__meta"><span>08</span>Co-author · Preprint · 2026</p>
            <h3 className="card__title">PLLM+</h3>
            <p className="card__sub">Reproducible Python dependency repair</p>
            <p className="card__metric"><span data-count="1500" data-separator=",">1,500</span><span className="card__metric-of">/2,891</span></p>
            <p className="card__metric-label">benchmark snippets resolved, vs. 1,169 for the baseline</p>
            <p className="card__desc">A replay-and-repair pipeline that cut average runtime from 368.7 to 71.8 seconds. Historical configuration replay supplied 1,495 fixes; LLM fallback supplied five.</p>
            <button className="card__sim" type="button" data-sim="pllm" aria-label="Run the PLLM+ simulation"><i aria-hidden="true">▶</i>Run the simulation</button>
            <p className="card__links"><a href="https://arxiv.org/abs/2609.26952" target="_blank" rel="noopener">arXiv ↗</a></p>
          </article>

          <aside className="research__outro">
            <p>More on</p>
            <a href="https://scholar.google.ca/citations?user=rMUfQ20AAAAJ&amp;hl=en" target="_blank" rel="noopener">Google Scholar ↗</a>
          </aside>
        </div>
        <div className="research__progress" aria-hidden="true"><span data-research-progress=""></span></div>
      </div>
    </section>
  );
}
