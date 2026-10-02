export default function Lab() {
  return (
    <section className="lab section" id="lab" data-formation="futures" data-chapter="lab">
      <div className="lab__grid">
        <header className="lab__head">
          <p className="label"><span>05</span>The Lab</p>
          <h2 className="display" data-split="words">Audit an agent <em>yourself</em>.</h2>
          <p data-reveal="">Two agents answer the same refund request with the same explanation. Intervene on the evidence (<code>do(x)</code>) and replay. If an explanation is faithful, changing its cause should change the answer.</p>
          <p className="lab__note" data-reveal="">A toy illustration of the intervention-and-replay idea behind Project Ariadne. Not real model output.</p>
          <button className="card__sim lab__sim" type="button" data-sim="ariadne"><i aria-hidden="true">▶</i>Run the full audit simulation</button>
        </header>

        <div className="console" data-lab="" data-no-intervene="">
          <div className="console__bar">
            <div className="console__tabs" role="tablist" aria-label="Agent under audit">
              <button role="tab" type="button" aria-selected="true" data-agent="alpha">Agent α</button>
              <button role="tab" type="button" aria-selected="false" data-agent="beta">Agent β</button>
            </div>
            <span className="console__status" data-lab-status="">trace · ready</span>
          </div>

          <ol className="trace" data-trace="">
            <li className="trace__step" data-step="observe">
              <span className="trace__k">01 · observe</span>
              <p><code>get_order(#4471)</code> → delivered <b className="var" data-var="days">41 days</b> ago · tier <b className="var" data-var="tier">basic</b></p>
            </li>
            <li className="trace__step" data-step="retrieve">
              <span className="trace__k">02 · retrieve</span>
              <p><code>policy.refunds</code> → “Refunds are allowed within 30 days of delivery.”</p>
            </li>
            <li className="trace__step" data-step="explain">
              <span className="trace__k">03 · explain</span>
              <p data-explain="">“The order was delivered 41 days ago, outside the 30-day window.”</p>
            </li>
            <li className="trace__step trace__step--answer" data-step="answer">
              <span className="trace__k">04 · answer</span>
              <p data-answer="" className="answer answer--deny">Refund denied</p>
            </li>
          </ol>

          <div className="console__controls">
            <button className="chip-btn" type="button" data-do="days" aria-pressed="false"><code>do(delivered = 12 days)</code></button>
            <button className="chip-btn" type="button" data-do="tier" aria-pressed="false"><code>do(tier = premium)</code></button>
            <button className="chip-btn chip-btn--quiet" type="button" data-lab-reset="">Reset</button>
          </div>

          <div className="verdict" data-verdict="" aria-live="polite">
            <p className="verdict__title">Awaiting intervention</p>
            <p className="verdict__body">The explanation cites the delivery date. Intervene on it and see whether the answer follows.</p>
          </div>

          <div className="log">
            <p className="log__title">Audit log</p>
            <ol className="log__rows" data-log=""><li className="log__empty">No interventions yet.</li></ol>
          </div>
        </div>
      </div>
    </section>
  );
}
