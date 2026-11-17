import { cardsSetAside, fullscreen } from '../store';

export function bindKeys() {
  const off = new AbortController();
  addEventListener('keydown', (e) => {
    const top = [...document.querySelectorAll<HTMLElement>('.modal')].filter((m) => !m.closest('[hidden]')).pop();
    if (e.key === 'Escape') return cardsSetAside.get() ? cardsSetAside.set(false) : top?.querySelector<HTMLElement>(`.btn[data-id="${top.dataset.dismiss ?? 'peek'}"]`)?.click();
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !(e.target as HTMLElement).matches('input, textarea, select')) return void fullscreen.set(!fullscreen.get());
    if ((e.key !== ' ' && e.key !== 'Enter') || (e.target as HTMLElement).matches('input, textarea, select')) return;
    const btn = (top ?? document.getElementById('actions'))?.querySelector<HTMLElement>('.btn.primary:not([disabled], .spend)');
    if (btn) { e.preventDefault(); btn.click(); }
  }, { signal: off.signal });
  return () => off.abort();
}
