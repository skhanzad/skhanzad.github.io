export default function Thread() {
  return (
    <section className="manifesto section" id="thread" data-formation="trajectories" data-chapter="thread">
      <div className="manifesto__copy">
        <p className="label"><span>01</span>The Thread</p>
        <p className="manifesto__text" data-highlight="">Agents now plan, retrieve, call tools and remember. Asked to explain a decision, they tell a convincing story. But a story is not a cause. I build instruments that intervene on an agent’s reasoning, replay it, and measure whether the story it tells is the one that actually drove the answer.</p>
        <p className="manifesto__myth" data-reveal="">In the myth, Ariadne’s thread led the way out of the labyrinth. <em>Project Ariadne</em> follows the thread of machine reasoning to see where it really leads.</p>

        <div className="stat" data-reveal="">
          <p className="stat__num"><span data-count="76.7" data-decimals="1">76.7</span><span className="stat__unit">%</span></p>
          <div className="stat__body">
            <p className="stat__caption">of audited agent trajectories showed <strong>faithfulness violations</strong>: the agent’s stated reasoning did not actually affect its answer.</p>
            <p className="stat__meta">23 of 30 trajectories · Project Ariadne, 2026 · under the study’s counterfactual protocol</p>
            <ul className="legend">
              <li className="legend__item legend__item--ok"><i aria-hidden="true"></i>Faithful <b>7</b></li>
              <li className="legend__item legend__item--bad"><i aria-hidden="true"></i>Violation <b>23</b></li>
            </ul>
            <p className="stat__note">Each orb in the field is one audited trajectory.</p>
          </div>
        </div>
      </div>
    </section>
  );
}
