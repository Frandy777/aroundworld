// Escape takes down the top card (if it says how); Space or Enter presses the default button: the top card's, else the action bar's.
export function bindKeys() {
  addEventListener('keydown', (e) => {
    const top = [...document.querySelectorAll<HTMLElement>('.modal')].pop();
    if (e.key === 'Escape' && top?.dataset.dismiss) return top.querySelector<HTMLElement>(`.btn[data-id="${top.dataset.dismiss}"]`)?.click();
    if ((e.key !== ' ' && e.key !== 'Enter') || (e.target as HTMLElement).matches('input, textarea, select')) return; // typing is not pressing
    const btn = (top ?? document.getElementById('actions'))?.querySelector<HTMLElement>('.btn.primary:not([disabled], .spend)');
    if (btn) { e.preventDefault(); btn.click(); }
  });
}
