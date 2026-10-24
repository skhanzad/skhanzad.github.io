// The title, defined one sense at a time. The section pins while the particle mind
// behind it is audited and then housed in a glass box (see ui/trust.js and the
// `mind` formation).
const acts = [
  {
    word: 'Reasoning',
    pos: 'n.',
    sense: 'What an agent does between the prompt and the answer. I build agents that plan, retrieve, call tools, manage context and memory, and coordinate with other agents.',
  },
  {
    word: 'Evaluation',
    pos: 'n.',
    sense: 'Proof that the system works, not a demo that it can. I intervene on an agent’s reasoning and replay it, and run failure analysis to test whether the steps it states are the steps that decide its answer.',
    note: 'In Project Ariadne, 23 of 30 audited trajectories failed this test.',
  },
  {
    word: 'Engineering',
    pos: 'n.',
    sense: 'Turning a working prototype into a dependable system. I add guardrails, fine-tuning, quantization, decision traces and CI/CD, so the system can be inspected, tested and relied on.',
  },
];

const numerals = ['i.', 'ii.', 'iii.'];
const gauges = ['Agents', 'Evaluation', 'Production'];
// Labels pinned to the 3D mind: the reasoning trace's steps (as in the Lab), then the
// glass box's dimensions, measured in what makes reasoning trustworthy.
const steps = ['observe', 'retrieve', 'explain', 'answer'];
const measures = ['provenance', 'privacy', 'verification'];

export default function Trust() {
  return (
    <section className="trust" id="trust" data-formation="mind" data-chapter="trust" aria-labelledby="trust-title">
      <div className="trust__stage" data-trust="">
        <div className="trust__copy">
          <p className="label"><span>01</span>AI engineering</p>
          <header className="trust__entry">
            <h2 className="trust__term" id="trust-title" aria-label="AI engineer">
              <span aria-hidden="true">A·I</span> <span aria-hidden="true">en·gi·neer</span>
            </h2>
            <p className="trust__ipa"><span>/ˌeɪˈaɪ ˌen.dʒɪˈnɪə/</span> <i>noun</i></p>
            <p className="trust__def">One who builds AI systems that reason, use tools and work together, and proves they can be relied on.</p>
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
