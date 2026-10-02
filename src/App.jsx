import SiteChrome from './components/SiteChrome.jsx';
import Hero from './components/Hero.jsx';
import Thread from './components/Thread.jsx';
import Architect from './components/Architect.jsx';
import AffiliationsMarquee from './components/AffiliationsMarquee.jsx';
import CareerPath from './components/CareerPath.jsx';
import Research from './components/Research.jsx';
import Lab from './components/Lab.jsx';
import Toolkit from './components/Toolkit.jsx';
import Contact from './components/Contact.jsx';
import SiteFooter from './components/SiteFooter.jsx';
import { usePortfolioEffects } from './hooks/usePortfolioEffects.js';

export default function App() {
  usePortfolioEffects();

  return (
    <>
      <SiteChrome />
      <main>
        <Hero />
        <Thread />
        <Architect />
        <AffiliationsMarquee />
        <CareerPath />
        <Research />
        <Lab />
        <Toolkit />
        <Contact />
      </main>
      <SiteFooter />
    </>
  );
}
