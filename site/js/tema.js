// Alternância claro/escuro. O tema é aplicado no <html data-theme> — o CSS tem
// os dois conjuntos de variáveis, e os gráficos leem as cores de lá em tempo de
// render (themeVar em config.js), então basta re-renderizar no evento.

import { applyMapTheme } from './map.js';

const PADRAO = 'escuro';

// ícones em SVG (não dependem de glifo de fonte, ao contrário de ☀/☾)
const SVG_SOL = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round"><circle cx="12" cy="12" r="4.5"/>
  <path d="M12 1.5v2M12 20.5v2M3.4 3.4l1.4 1.4M19.2 19.2l1.4 1.4M1.5 12h2M20.5 12h2M3.4 20.6l1.4-1.4M19.2 4.8l1.4-1.4"/></svg>`;
const SVG_LUA = `<svg viewBox="0 0 24 24" width="14" height="14" fill="none"
  stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
  <path d="M20 14.5A8.5 8.5 0 1 1 9.5 4a6.6 6.6 0 0 0 10.5 10.5z"/></svg>`;

export function temaAtual() {
  return document.documentElement.dataset.theme || PADRAO;
}

function aplicar(tema, btn) {
  if (tema === PADRAO) delete document.documentElement.dataset.theme;
  else document.documentElement.dataset.theme = tema;
  try { localStorage.setItem('tema', tema); } catch { /* modo privado */ }
  btn.innerHTML = tema === 'claro' ? SVG_LUA : SVG_SOL;
  btn.title = tema === 'claro' ? 'Mudar para tema escuro' : 'Mudar para tema claro';
  btn.setAttribute('aria-label', btn.title);
  applyMapTheme(tema);
  window.dispatchEvent(new CustomEvent('themechange', { detail: tema }));
}

export function initTema() {
  const btn = document.getElementById('btn-tema');
  if (!btn) return;
  aplicar(temaAtual(), btn);
  btn.addEventListener('click', () => {
    aplicar(temaAtual() === 'claro' ? PADRAO : 'claro', btn);
  });
}
