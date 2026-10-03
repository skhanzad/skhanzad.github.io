import { useId, useState } from 'react';
import '../../assets/css/expertise-chart.css';

const colors = ['#f4442e', '#fc9e4f', '#edd382', '#f2f3ae', '#b89174'];
const center = 280;

function point(radius, angle) {
  const radians = (angle * Math.PI) / 180;
  return [center + radius * Math.cos(radians), center + radius * Math.sin(radians)];
}

function segment(start, end) {
  return [
    `M ${point(246, start).join(' ')}`,
    `A 246 246 0 0 1 ${point(246, end).join(' ')}`,
    `L ${point(154, end).join(' ')}`,
    `A 154 154 0 0 0 ${point(154, start).join(' ')}`,
    'Z',
  ].join(' ');
}

export default function ExpertiseChart({ domains }) {
  const [active, setActive] = useState(0);
  const id = useId();
  const angle = 360 / domains.length;

  return (
    <div className="expertise-explorer" data-reveal="" data-no-intervene="" data-active={active}>
      <div className="expertise-explorer__visual">
        <figure className="expertise-chart" data-formation-slot="">
          <svg className="expertise-chart__svg" viewBox="0 0 560 560" role="group" aria-labelledby={`${id}-title`} aria-describedby={`${id}-description`}>
            <title id={`${id}-title`}>Areas of expertise</title>
            <desc id={`${id}-description`}>Five equally sized segments for distributed systems, cybersecurity, blockchain, AI reasoning and multi-agent coordination. Select a segment to explore its skills.</desc>
            <circle className="expertise-chart__orbit" cx={center} cy={center} r="263" aria-hidden="true" />
            {domains.map(({ name }, index) => {
              const middle = -90 + index * angle;
              const [x, y] = point(200, middle);
              return (
                <g
                  className={`expertise-chart__segment${active === index ? ' is-active' : ''}`}
                  key={name}
                  style={{ '--domain-color': colors[index] }}
                  role="button"
                  tabIndex={0}
                  aria-label={name}
                  aria-pressed={active === index}
                  aria-controls={`${id}-detail-${index}`}
                  onClick={() => setActive(index)}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      setActive(index);
                    }
                  }}
                >
                  <path d={segment(middle - angle / 2 + 2, middle + angle / 2 - 2)} />
                  <text x={x} y={y} textAnchor="middle" dominantBaseline="central" aria-hidden="true">{String(index + 1).padStart(2, '0')}</text>
                </g>
              );
            })}
          </svg>
          <figcaption className="expertise-chart__center">
            <span>Cognitive </span>
            <em>Trust </em>
            <span>Architect</span>
          </figcaption>
        </figure>
        <p className="expertise-chart__hint">Select a segment to explore</p>
      </div>

      <div className="expertise-explorer__content">
        <div className="expertise-chart__legend" role="group" aria-label="Expertise areas">
          {domains.map(({ name, skills }, index) => (
            <button
              className={`expertise-chart__key${active === index ? ' is-active' : ''}`}
              id={`${id}-key-${index}`}
              key={name}
              type="button"
              style={{ '--domain-color': colors[index] }}
              aria-pressed={active === index}
              aria-controls={`${id}-detail-${index}`}
              onClick={() => setActive(index)}
            >
              <span className="expertise-chart__number" aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
              <span className="expertise-chart__key-copy">
                <span className="expertise-chart__name">{name}</span>
                <span className="expertise-chart__skills">{skills.join(' · ')}</span>
              </span>
              <span className="expertise-chart__arrow" aria-hidden="true">↗</span>
            </button>
          ))}
        </div>
        <div className="expertise-chart__details" aria-live="polite">
          {domains.map(({ description, name }, index) => (
            <div
              className={`expertise-chart__detail${active === index ? ' is-active' : ''}`}
              id={`${id}-detail-${index}`}
              key={name}
              role="region"
              aria-labelledby={`${id}-key-${index}`}
              aria-hidden={active !== index}
            >
              <p>{description}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
