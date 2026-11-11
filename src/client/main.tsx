import '@fontsource/jersey-10';
import '@fontsource/jersey-15';
import '@fontsource/jersey-20';
import '@fontsource/jersey-25';
import './styles/style.css';
import './styles/cards.css';
import { createRoot, type Root } from 'react-dom/client';
import { App } from './App';
import { boot } from './controller';
import { skin } from './render/art';
import { initStage } from './stage';
import { bindKeys } from './ui/keys';

// A hot update of any module the page is made of stops here: this module runs again on the new code, and as it starts it takes down what its last run started (the
// stage, the keys, the talk with the server). Taking down and starting happen in the same run, never apart: an update may reach a module twice, or fail to load it.
// What belongs to the page itself stays: the GL context (see scene) and the React root.
const kept: { started?: Promise<void>; stops?: (() => void)[]; root?: Root } = import.meta.hot?.data ?? {};
const stops = (kept.stops ??= []);
const last = kept.started;

async function main() {
  await last?.catch(() => {}); // a run still starting finishes first (a failed one has reported itself, and took down what it had made)
  await Promise.all([10, 15, 20, 25].map((n) => document.fonts.load(`${n}px "Jersey ${n}"`)));
  stops.splice(0).reverse().forEach((stop) => stop());
  const dev = import.meta.env.DEV ? await import('./dev') : null;
  dev?.preBoot();
  skin(); // frames, cursors and sprites become CSS variables before the first paint
  stops.push(initStage(), bindKeys());
  (kept.root ??= createRoot(document.getElementById('root')!)).render(<App />);
  stops.push(boot());
  if (dev) stops.push(dev.initDev());
}
kept.started = main();

if (import.meta.hot) import.meta.hot.accept();
