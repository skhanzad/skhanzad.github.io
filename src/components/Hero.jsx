export default function Hero() {
  return (
    <section className="hero" id="top" data-formation="labyrinth" data-chapter="top">
      <div className="hero__meta" data-hero-fade="">
        <p>Portfolio · MMXXVI</p>
        <p>Toronto, Canada <span className="dim">43.65° N, 79.38° W</span></p>
      </div>

      <div className="hero__main">
        <h1 className="hero__name" data-split="chars" aria-label="Sourena Khanzadeh">
          <span className="line">Sourena</span>
          <span className="line line--indent">Khanzadeh</span>
        </h1>
        <p className="hero__role" data-hero-fade=""><span className="rule" aria-hidden="true"></span><span data-scramble="">AI Engineer</span></p>
        <p className="hero__tagline" data-hero-fade="">I build AI agents that <em>reason</em>, <em>use tools</em> and <em>work together</em>, and the evaluations that show they can be trusted.</p>
        <ul className="hero__pillars" data-hero-fade="" aria-label="Focus areas">
          <li>Agentic Systems</li>
          <li>RAG &amp; Tool Calling</li>
          <li>Multi-Agent Orchestration</li>
          <li>Fine-tuning</li>
          <li>Evaluation &amp; Guardrails</li>
        </ul>
      </div>

      <div className="hero__foot" data-hero-fade="">
        <p className="hero__now"><span className="pulse" aria-hidden="true"></span>Now — Agentic Systems at Flybits · sAIpien at MIT Media Lab · Postdoctoral Fellow at TMU</p>
        <p className="hero__hint" aria-hidden="true"><span data-hint="">Move to probe · Hold to intervene</span> <code>do(x)</code></p>
        <a className="hero__scroll" href="#trust"><span>What I do</span><i aria-hidden="true"></i></a>
      </div>
    </section>
  );
}
