export default function Architect() {
  return (
    <section className="about section" id="architect" data-formation="portrait" data-chapter="architect">
      <p className="label about__label"><span>02</span>The Architect</p>
      <div className="about__grid">
        <div className="about__copy">
          <h2 className="display" data-split="words">Trust lives in the gap between what AI <em>says</em> and what it <em>does</em>.</h2>
          <p className="lede" data-reveal="">I’m a Computer Science Ph.D. and AI research engineer building auditable agents through causal evaluation, grounded retrieval, tool orchestration and privacy controls.</p>
          <p data-reveal="">My work moves between industry, government and academia: agentic systems at Flybits, perspective-aware agents with MIT Media Lab’s sAIpien, evaluation research at Toronto Metropolitan University, and knowledge-informed anomaly detection at the National Research Council Canada.</p>

          <dl className="stats" data-reveal="">
            <div className="stats__item"><dt>Peer-reviewed papers</dt><dd data-count="7">7</dd></div>
            <div className="stats__item"><dt>Preprints</dt><dd data-count="6">6</dd></div>
            <div className="stats__item"><dt>Ph.D. GPA</dt><dd>A+</dd></div>
            <div className="stats__item"><dt>Sectors</dt><dd><span data-count="3">3</span><small>Industry · Government · Academia</small></dd></div>
          </dl>
          <p className="venues" data-reveal=""><span className="dim">Published at</span> <span>AAAI</span><span>IEEE COMPSAC</span><span>Canadian AI</span></p>
        </div>

        <figure className="portrait" data-portrait="">
          <div className="portrait__frame">
            <div className="portrait__slot" data-portrait-slot="">
              <img className="portrait__photo" src="assets/img/sourena-cut.webp" width="880" height="1100" alt="Portrait of Sourena Khanzadeh" loading="lazy" decoding="async" />
            </div>
            <span className="portrait__corner portrait__corner--tl" aria-hidden="true"></span>
            <span className="portrait__corner portrait__corner--tr" aria-hidden="true"></span>
            <span className="portrait__corner portrait__corner--bl" aria-hidden="true"></span>
            <span className="portrait__corner portrait__corner--br" aria-hidden="true"></span>
          </div>
          <figcaption className="portrait__ui">
            <div className="portrait__readout">
              <span>Representation · <b data-particle-count="">65,536</b> points</span>
              <span>Raw artifact · <b data-portrait-status="">withheld</b></span>
            </div>
            <button className="btn btn--ghost" type="button" data-portrait-toggle="" aria-pressed="false">Request raw artifact</button>
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
