import '@fontsource/jersey-10';
import '@fontsource/jersey-15';
import '@fontsource/jersey-20';
import '@fontsource/jersey-25';
import './styles/style.css';
import './styles/cards.css';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import { boot } from './controller';
import { skin } from './render/art';
import { initStage } from './stage';
import { bindKeys } from './ui/keys';

async function main() {
  await Promise.all([10, 15, 20, 25].map((n) => document.fonts.load(`${n}px "Jersey ${n}"`)));
  skin(); // frames, cursors and sprites become CSS variables before the first paint
  initStage();
  bindKeys();
  createRoot(document.getElementById('root')!).render(<App />);
  boot();
}
void main();
