export default function Contact() {
  return (
    <section className="contact section" id="contact" data-formation="galaxy" data-chapter="contact">
      <p className="label"><span>08</span>Contact</p>
      <h2 className="contact__title" data-split="words">Let’s build systems people can <em>trust</em>.</h2>
      <p className="contact__lede" data-reveal="">Working on distributed infrastructure, cybersecurity, blockchain or collaborative AI? Let’s talk.</p>
      <div className="contact__email-wrap" data-reveal="">
        <a className="contact__email" href="mailto:sourena.khanzadeh@gmail.com" data-copy="sourena.khanzadeh@gmail.com" data-magnetic="">
          <span className="contact__email-text">sourena.khanzadeh@gmail.com</span>
          <span className="contact__email-hint" data-copy-hint="">Click to copy</span>
        </a>
        <a className="contact__mailto" href="mailto:sourena.khanzadeh@gmail.com">or open it in your mail app ↗</a>
      </div>
      <ul className="contact__links" data-reveal="">
        <li><a href="https://www.linkedin.com/in/sourenak" target="_blank" rel="noopener">LinkedIn <span aria-hidden="true">↗</span></a></li>
        <li><a href="https://github.com/skhanzad" target="_blank" rel="noopener">GitHub <span aria-hidden="true">↗</span></a></li>
        <li><a href="https://scholar.google.ca/citations?user=rMUfQ20AAAAJ&amp;hl=en" target="_blank" rel="noopener">Google Scholar <span aria-hidden="true">↗</span></a></li>
        <li><a href="resume.pdf" download="Sourena-Khanzadeh-Resume.pdf">Résumé (PDF) <span aria-hidden="true">↓</span></a></li>
      </ul>
    </section>
  );
}
