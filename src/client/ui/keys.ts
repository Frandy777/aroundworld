import { fullscreen, peeking } from '../store';

// Escape takes down the top card (if it says how), or else sets the cards aside to look at the board, and brings them back; Space or Enter presses the default button: the top card's, else the action bar's. F flips fullscreen. Returns what unbinds them.
export function bindKeys() {
  const off = new AbortController();
  addEventListener('keydown', (e) => {
    const top = [...document.querySelectorAll<HTMLElement>('.modal')].filter((m) => !m.closest('[hidden]')).pop(); // not a card that is set aside: it is not there to press
    if (e.key === 'Escape') return peeking.get() ? peeking.set(false) : top?.querySelector<HTMLElement>(`.btn[data-id="${top.dataset.dismiss ?? 'peek'}"]`)?.click();
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as HTMLElement).matches('input, textarea, select')) return void fullscreen.set(!fullscreen.get());
    if ((e.key !== ' ' && e.key !== 'Enter') || (e.target as HTMLElement).matches('input, textarea, select')) return; // typing is not pressing
    const btn = (top ?? document.getElementById('actions'))?.querySelector<HTMLElement>('.btn.primary:not([disabled], .spend)');
    if (btn) { e.preventDefault(); btn.click(); }
  }, { signal: off.signal });
  return () => off.abort();
}
