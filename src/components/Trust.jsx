// The title, defined one word at a time. The section pins while the particle mind
// behind it is audited and then housed in a glass box (see ui/trust.js and the
// `mind` formation).
const acts = [
  {
    word: 'Cognitive',
    pos: 'adj.',
    sense: 'Of thinking, and now of machines. AI agents plan, retrieve, call tools and decide. Their reasoning is fluent, fast and almost never examined.',
  },
  {
    word: 'Trust',
    pos: 'n.',
    sense: 'Earned with evidence, not explanations. I intervene on an agent’s reasoning and replay it, testing whether the steps it states are the steps that actually decide its answer.',
    note: 'In Project Ariadne, 23 of 30 audited trajectories failed this test.',
  },
  {
    word: 'Architect',
    pos: 'n.',
    sense: 'One who designs the structure. I build what surrounds the reasoning, from decision traces and provenance to privacy controls and verification, so people can look inside and rely on what they find.',
  },
];

const numerals = ['i.', 'ii.', 'iii.'];
const gauges = ['Cognition', 'Audit', 'Structure'];
// Labels pinned to the 3D mind: the reasoning trace's steps (as in the Lab), then the
// glass box's dimensions, measured in what makes reasoning trustworthy.
const steps = ['observe', 'retrieve', 'explain', 'answer'];
const measures = ['provenance', 'privacy', 'verification'];

export default function Trust() {
  return (
    <section className="trust" id="trust" data-formation="mind" data-chapter="trust" aria-labelledby="trust-title">
      <div className="trust__stage" data-trust="">
        <div className="trust__copy">
          <p className="label"><span>01</span>Trust by design</p>
          <header className="trust__entry">
            <h2 className="trust__term" id="trust-title" aria-label="Cognitive trust architect">
              <span aria-hidden="true">cog·ni·tive</span> <span aria-hidden="true">trust</span> <span aria-hidden="true">ar·chi·tect</span>
            </h2>
            <p className="trust__ipa"><span>/ˈkɒɡ.nɪ.tɪv trʌst ˈɑː.kɪ.tekt/</span> <i>noun</i></p>
            <p className="trust__def">One who designs AI systems whose reasoning can be inspected, tested and relied on.</p>
          </header>

          <ol className="trust__acts" data-trust-acts="">
            {acts.map((act, i) => (
              <li className="trust__act" data-trust-act={i} key={act.word}>
                <p className="trust__sense-no"><span>{numerals[i]}</span>{act.pos}</p>
                <h3 className="trust__word" data-trust-word="">{act.word}</h3>
                <p className="trust__sense">{act.sense}</p>
                {act.note && <p className="trust__note">{act.note}</p>}
              </li>
            ))}
          </ol>

          <div className="trust__gauges" aria-hidden="true">
            <ol>
              {gauges.map((name, i) => (
                <li key={name} data-trust-gauge={i}>
                  <span className="trust__gauge-name"><b>{numerals[i]}</b>{name}</span>
                  <span className="trust__gauge-bar"><i></i></span>
                </li>
              ))}
            </ol>
            <p className="trust__readout" data-trust-readout="">mind · unexamined</p>
          </div>
        </div>

        <div className="trust__lens" data-cursor-text="look inside" aria-hidden="true"></div>
        <div className="trust__callouts" aria-hidden="true">
          <svg className="trust__leaders">
            {steps.map((step, i) => (
              <g data-trust-leader={i} key={step}><line /><circle r="5" /></g>
            ))}
          </svg>
          {steps.map((step, i) => (
            <span className="trust__callout" data-trust-node={i} key={step}><b>0{i + 1}</b>{step}</span>
          ))}
          {measures.map((measure, i) => (
            <span className="trust__measure" data-trust-dim={i} key={measure}><span>{measure}</span></span>
          ))}
        </div>
        <p className="trust__hint" aria-hidden="true">
          <span className="trust__hint-mouse">Point at the mind to look inside</span>
          <span className="trust__hint-touch">Touch the mind to look inside</span>
        </p>
      </div>
    </section>
  );
}
