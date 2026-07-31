// Busca de município por nome no cabeçalho — autocomplete simples sobre o
// resumo nacional já carregado no boot (nome, uf, code_muni).

import { resumo } from './data.js';

function normaliza(s) {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}

export function initBusca(onSelecionar) {
  const input = document.getElementById('busca-input');
  const lista = document.getElementById('busca-resultados');
  if (!input || !lista) return;

  const indice = [...resumo.values()].map((r) => ({
    code: String(r.code_muni), nome: r.nome, uf: r.uf,
    chave: normaliza(`${r.nome} ${r.uf}`),
  }));

  let ativos = [];
  let foco = -1;

  function marcaFoco() {
    [...lista.children].forEach((li, i) => li.classList.toggle('ativo', i === foco));
  }

  function escolhe(it) {
    input.value = `${it.nome} · ${it.uf}`;
    lista.hidden = true;
    onSelecionar(it.code, it.nome, it.uf);
  }

  function renderiza(itens) {
    lista.innerHTML = '';
    ativos = itens;
    foco = -1;
    if (!itens.length) { lista.hidden = true; return; }
    for (const it of itens) {
      const li = document.createElement('li');
      li.textContent = `${it.nome} · ${it.uf}`;
      li.addEventListener('mousedown', (e) => { e.preventDefault(); escolhe(it); });
      lista.appendChild(li);
    }
    lista.hidden = false;
  }

  input.addEventListener('input', () => {
    const q = normaliza(input.value.trim());
    if (q.length < 2) { renderiza([]); return; }
    renderiza(indice.filter((it) => it.chave.includes(q)).slice(0, 8));
  });

  input.addEventListener('keydown', (e) => {
    if (lista.hidden) return;
    if (e.key === 'ArrowDown') { e.preventDefault(); foco = Math.min(foco + 1, ativos.length - 1); marcaFoco(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); foco = Math.max(foco - 1, 0); marcaFoco(); }
    else if (e.key === 'Enter') { e.preventDefault(); escolhe(ativos[foco] ?? ativos[0]); }
    else if (e.key === 'Escape') { lista.hidden = true; }
  });

  input.addEventListener('focus', () => { if (ativos.length) lista.hidden = false; });
  input.addEventListener('blur', () => { setTimeout(() => { lista.hidden = true; }, 100); });
}
