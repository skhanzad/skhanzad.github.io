import { ORBIT } from '../world/formations.js';

// The expertise chart is React's; the particles are the world's. The chart marks the
// selected domain on its root (data-active) and the orbit lights the matching cluster.
export function initExpertise({ world, scope }) {
  const explorer = document.querySelector('.expertise-explorer[data-active]');
  if (!explorer || !world) return;
  const light = () => world.spotlight('orbit', ORBIT.cluster(Number(explorer.dataset.active) || 0));
  const observer = new MutationObserver(light);
  observer.observe(explorer, { attributes: true, attributeFilter: ['data-active'] });
  scope.add(() => observer.disconnect());
  light();
}
