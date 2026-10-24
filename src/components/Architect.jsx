export default function Architect() {
  return (
    <section className="about section" id="architect" data-formation="portrait" data-chapter="architect">
      <p className="label about__label"><span>03</span>The Engineer</p>
      <div className="about__grid">
        <div className="about__copy">
          <h2 className="display" data-split="words">Building agents that <em>reason</em> and hold up.</h2>
          <p className="lede" data-reveal="">I’m an AI engineer with a Ph.D. in Computer Science. I build agentic systems with retrieval-augmented generation, tool calling, multi-agent orchestration and memory, and I evaluate them so they can be relied on.</p>
          <p data-reveal="">I turn research into working prototypes: agentic systems at Flybits, perspective-aware agents with privacy-preserving memory at MIT Media Lab’s sAIpien, agent evaluation at Toronto Metropolitan University, and machine learning for intrusion detection at the National Research Council Canada.</p>

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
