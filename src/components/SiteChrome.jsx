export default function SiteChrome() {
  return (
    <>
      <a className="skip" href="#thread">Skip to content</a>

      <div className="loader" data-loader="" aria-hidden="true">
        <svg className="loader__mark" viewBox="0 0 32 32"><use href="#mark"/></svg>
        <p className="loader__label"><span>Spinning the thread</span><span className="loader__pct" data-loader-pct="">000</span></p>
        <div className="loader__line"><span data-loader-bar=""></span></div>
      </div>

      <canvas className="gl" data-gl="" aria-hidden="true"></canvas>
      <div className="veil" aria-hidden="true"></div>

      <div className="cursor" data-cursor="" aria-hidden="true">
        <div className="cursor__ring"><span className="cursor__label" data-cursor-label=""></span></div>
        <div className="cursor__dot"></div>
      </div>

      <svg width="0" height="0" className="sprite" aria-hidden="true">
        <symbol id="mark" viewBox="0 0 32 32">
          <g fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
            <path d="M16 3 A13 13 0 1 1 9.5 4.74"/>
            <path d="M23.52 18.74 A8 8 0 1 1 23.52 13.26"/>
            <path d="M14.8 19.29 A3.5 3.5 0 1 1 18.25 18.68"/>
          </g>
          <circle cx="16" cy="16" r="1.4" fill="currentColor"/>
        </symbol>
      </svg>

      <header className="nav" data-nav="">
        <a className="nav__brand" href="#top" aria-label="Sourena Khanzadeh, back to the top">
          <svg className="nav__mark" viewBox="0 0 32 32" aria-hidden="true"><use href="#mark"/></svg>
          <span className="nav__name">Sourena Khanzadeh</span>
        </a>
        <nav className="nav__links" aria-label="Sections">
          <a href="#thread">Thread</a>
          <a href="#architect">Architect</a>
          <a href="#path">Path</a>
          <a href="#research">Research</a>
          <a href="#lab">Lab</a>
          <a href="#contact">Contact</a>
        </nav>
        <a className="nav__cta" href="resume.pdf" download="Sourena-Khanzadeh-Resume.pdf" data-magnetic="">Résumé <span aria-hidden="true">↓</span></a>
        <button className="nav__menu" type="button" aria-expanded="false" aria-controls="menu" data-menu-toggle="">
          <span className="nav__menu-label">Menu</span><span className="nav__menu-icon" aria-hidden="true"></span>
        </button>
      </header>

      <div className="menu" id="menu" data-menu="" hidden>
        <nav aria-label="Menu">
          <ol>
            <li><a href="#thread"><span>01</span>The Thread</a></li>
            <li><a href="#architect"><span>02</span>The Architect</a></li>
            <li><a href="#path"><span>03</span>The Path</a></li>
            <li><a href="#research"><span>04</span>Research</a></li>
            <li><a href="#lab"><span>05</span>The Lab</a></li>
            <li><a href="#toolkit"><span>06</span>Toolkit</a></li>
            <li><a href="#contact"><span>07</span>Contact</a></li>
          </ol>
        </nav>
        <a className="menu__resume" href="resume.pdf" download="Sourena-Khanzadeh-Resume.pdf">Download résumé (PDF)</a>
      </div>

      <nav className="rail" aria-label="Chapters" data-rail="">
        <div className="rail__line"><span className="rail__fill" data-rail-fill=""></span></div>
        <ol>
          <li><a href="#top" data-rail-link="top"><b>00</b><span>Entrance</span></a></li>
          <li><a href="#thread" data-rail-link="thread"><b>01</b><span>The Thread</span></a></li>
          <li><a href="#architect" data-rail-link="architect"><b>02</b><span>The Architect</span></a></li>
          <li><a href="#path" data-rail-link="path"><b>03</b><span>The Path</span></a></li>
          <li><a href="#research" data-rail-link="research"><b>04</b><span>Research</span></a></li>
          <li><a href="#lab" data-rail-link="lab"><b>05</b><span>The Lab</span></a></li>
          <li><a href="#toolkit" data-rail-link="toolkit"><b>06</b><span>Toolkit</span></a></li>
          <li><a href="#contact" data-rail-link="contact"><b>07</b><span>Contact</span></a></li>
        </ol>
      </nav>
    </>
  );
}
