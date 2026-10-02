export default function SiteFooter() {
  return (
    <>
      <footer className="footer">
        <p>© 2026 Sourena Khanzadeh</p>
        <p>Toronto · <time data-clock="">--:--</time></p>
        <p className="footer__built">three.js · <span data-particle-count="">65,536</span> particles · one thread</p>
        <a href="#top">Back to the entrance ↑</a>
      </footer>

      <div className="toast" data-toast="" role="status" aria-live="polite"></div>
    </>
  );
}
