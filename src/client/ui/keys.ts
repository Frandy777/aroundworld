import { playVolumePreview } from '../audio';
import { cardsSetAside, fullscreen, soundMuted, toggleSoundMute } from '../store';

export function bindKeys() {
  const off = new AbortController();
  addEventListener('keydown', (e) => {
    const top = [...document.querySelectorAll<HTMLElement>('.modal')].filter((m) => !m.closest('[hidden]')).pop();
    if (e.key === 'Escape') return cardsSetAside.get() ? cardsSetAside.set(false) : top?.querySelector<HTMLElement>(`.btn[data-id="${top.dataset.dismiss ?? 'peek'}"]`)?.click();
    const typing = (e.target as HTMLElement).matches('input, textarea, select');
    if ((e.key === 'f' || e.key === 'F') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) return void fullscreen.set(!fullscreen.get());
    if ((e.key === 'm' || e.key === 'M') && !e.metaKey && !e.ctrlKey && !e.altKey && !typing) {
      toggleSoundMute();
      if (!soundMuted.get()) playVolumePreview();
      return;
    }
    if ((e.key !== ' ' && e.key !== 'Enter') || typing) return;
    const btn = (top ?? document.getElementById('actions'))?.querySelector<HTMLElement>('.btn.primary:not([disabled], .spend)');
    if (btn) { e.preventDefault(); btn.click(); }
  }, { signal: off.signal });
  return () => off.abort();
}
