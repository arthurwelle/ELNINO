// Sidebar esquerda: métricas principais (resumo.csv) + explorador indicador×mês×fase.

import { METRICAS, INDICADORES, FASES, FASE, MESES_LONGOS } from './config.js';
import { resumo } from './data.js';
import { updateChoropleth } from './map.js';

const cacheMapa = new Map(); // "<ind>_<mes>" -> Map<code, {en,ln,n,med}>

async function loadMapa(ind, mes) {
  const k = `${ind}_${mes}`;
  if (cacheMapa.has(k)) return cacheMapa.get(k);
  const rows = await d3.csv(`./data/mapa/${k}.csv`);
  const m = new Map();
  for (const r of rows) {
    m.set(String(r.code_muni), {
      en: r.en === '' ? null : +r.en,
      ln: r.ln === '' ? null : +r.ln,
      n: r.n === '' ? null : +r.n,
      med: r.med === '' ? null : +r.med,
    });
  }
  cacheMapa.set(k, m);
  return m;
}

function infoIcon(desc) {
  return `<span class="info-i" tabindex="0">i<span class="info-tip">${desc}</span></span>`;
}

// --- aplicar métrica principal ---------------------------------------------
function aplicarMetrica(met) {
  const values = new Map();
  for (const [code, r] of resumo) values.set(code, r[met.col]);
  updateChoropleth({ values, label: met.label, unidade: met.unidade, dir: met.dir });
}

// --- aplicar seleção do explorador -----------------------------------------
async function aplicarExplorador() {
  const ind = INDICADORES.find((i) => i.id === document.getElementById('exp-ind').value);
  const mes = +document.getElementById('exp-mes').value;
  const fase = document.getElementById('exp-fase').value;
  const dados = await loadMapa(ind.id, mes);

  const faseKey = fase.toLowerCase(); // en/ln/n
  const values = new Map();
  for (const [code, d] of dados) {
    const v = d[faseKey];
    let out = null;
    if (v != null && d.med != null) {
      if (ind.modo === 'pct') out = d.med !== 0 ? 100 * (v / d.med - 1) : null;
      else if (ind.modo === 'dif') out = v - d.med;
      else out = v; // abs
    }
    values.set(code, out == null ? null : Math.round(out * 100) / 100);
  }
  const sufixo = ind.modo === 'pct' ? ' (% vs média)' : ind.modo === 'dif' ? ' (vs média)' : '';
  updateChoropleth({
    values,
    label: `${ind.label} · ${MESES_LONGOS[mes - 1]} · anos ${FASE[fase].label}${sufixo}`,
    unidade: ind.modo === 'pct' ? '%' : ind.unidade,
    dir: ind.dir,
  });
  // desmarca rádios das métricas principais
  document.querySelectorAll('#sb-metricas input[type=radio]').forEach((r) => { r.checked = false; });
}

// --- montar sidebar ---------------------------------------------------------
export function initSidebar() {
  const sb = document.getElementById('sidebar');

  // Seção A: métricas principais
  const secA = sb.querySelector('#sb-metricas');
  for (const met of METRICAS) {
    const row = document.createElement('label');
    row.className = 'sb-row';
    row.innerHTML = `<input type="radio" name="metrica" value="${met.col}" ${met.default ? 'checked' : ''}>
      <span class="sb-label">${met.label}</span>${infoIcon(met.desc)}`;
    row.querySelector('input').addEventListener('change', () => aplicarMetrica(met));
    secA.appendChild(row);
  }

  // Seção B: explorador
  const selInd = document.getElementById('exp-ind');
  for (const i of INDICADORES) {
    const o = document.createElement('option');
    o.value = i.id; o.textContent = i.label;
    selInd.appendChild(o);
  }
  const selMes = document.getElementById('exp-mes');
  MESES_LONGOS.forEach((m, idx) => {
    const o = document.createElement('option');
    o.value = idx + 1; o.textContent = m;
    if (idx === 11) o.selected = true; // dezembro: meio do plantio
    selMes.appendChild(o);
  });
  const selFase = document.getElementById('exp-fase');
  for (const f of FASES) {
    const o = document.createElement('option');
    o.value = f; o.textContent = FASE[f].label;
    if (f === 'EN') o.selected = true;
    selFase.appendChild(o);
  }
  const descInd = document.getElementById('exp-desc');
  const atualizaDesc = () => {
    descInd.textContent = INDICADORES.find((i) => i.id === selInd.value).desc;
  };
  atualizaDesc();
  selInd.addEventListener('change', atualizaDesc);
  document.getElementById('exp-aplicar').addEventListener('click', aplicarExplorador);

  // colapsar/expandir
  const btn = document.getElementById('sb-toggle');
  btn.addEventListener('click', () => {
    const fechado = sb.classList.toggle('collapsed');
    btn.textContent = fechado ? '»' : '«';
    btn.title = fechado ? 'Abrir painel' : 'Recolher painel';
  });

  // choropleth inicial
  aplicarMetrica(METRICAS.find((m) => m.default));
}
