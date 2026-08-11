// Sidebar esquerda: métricas principais (resumo.csv) + explorador indicador×mês×fase.

import { METRICAS, INDICADORES, FASES, FASE, MESES_LONGOS, CULTURAS } from './config.js';
import { resumo, loadConcentracao } from './data.js';
import { map, updateChoropleth, setBordasRgi, setFiltroMunicipios, setNotaFiltro } from './map.js';

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

// escopo do choropleth por métrica que tem versão regional: 'mun' | 'rgi'
const escopoMetrica = new Map();

// --- aplicar métrica principal ---------------------------------------------
function aplicarMetrica(met) {
  const porRegiao = met.colRgi && escopoMetrica.get(met.col) === 'rgi';
  const coluna = porRegiao ? met.colRgi : met.col;
  const values = new Map();
  for (const [code, r] of resumo) values.set(code, r[coluna]);
  updateChoropleth({
    values,
    label: met.label + (porRegiao ? ' · por região intermediária' : ''),
    unidade: met.unidade,
    dir: met.dir,
  });
  if (met.colRgi) setBordasRgi(porRegiao);
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

// --- filtro de concentração da produção -------------------------------------
async function aplicarConcentracao() {
  const cultura = document.getElementById('conc-cultura').value;
  const pct = document.getElementById('conc-pct').value;
  const info = document.getElementById('conc-info');
  const rotulo = CULTURAS.find((c) => c.id === cultura)?.label ?? cultura;

  if (!pct) {                       // "Todos": remove o filtro
    setFiltroMunicipios(null);
    setNotaFiltro('');
    info.textContent = '';
    return;
  }
  const rank = await loadConcentracao(cultura);
  if (!rank) {
    info.textContent = 'Sem dados de produção para esta cultura.';
    setFiltroMunicipios(null);
    setNotaFiltro('');
    return;
  }
  const lim = +pct;
  const sel = rank.filter((r) => r.pct_acum <= lim).map((r) => r.code_muni);
  setFiltroMunicipios(sel);
  setNotaFiltro(`mostrando ${lim}% da produção de ${rotulo.toLowerCase()}`);
  info.textContent = `${sel.length.toLocaleString('pt-BR')} de ` +
    `${rank.length.toLocaleString('pt-BR')} municípios produtores`;
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
    const radio = row.querySelector('input');
    radio.addEventListener('change', () => aplicarMetrica(met));
    secA.appendChild(row);

    // métricas com versão regional ganham um toggle Mun|Região logo abaixo
    if (met.colRgi) {
      escopoMetrica.set(met.col, 'mun');
      const tg = document.createElement('div');
      tg.className = 'escopo-toggle';
      tg.innerHTML = `<button type="button" data-e="mun" class="ativo">Município</button>` +
                     `<button type="button" data-e="rgi">Região</button>`;
      tg.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b) return;
        e.preventDefault();
        escopoMetrica.set(met.col, b.dataset.e);
        tg.querySelectorAll('button').forEach((x) => x.classList.toggle('ativo', x === b));
        // clicar no escopo também seleciona este indicador: se o mapa estava em
        // outro indicador, o usuário espera ver este aqui, no nível que escolheu
        radio.checked = true;
        aplicarMetrica(met);
      });
      secA.appendChild(tg);
    }
  }

  // Seção B: concentração da produção (filtra quais municípios aparecem no mapa)
  const selConcCult = document.getElementById('conc-cultura');
  for (const c of CULTURAS) {
    const o = document.createElement('option');
    o.value = c.id; o.textContent = c.label;
    if (c.id === 'soja') o.selected = true;
    selConcCult.appendChild(o);
  }
  selConcCult.addEventListener('change', aplicarConcentracao);
  document.getElementById('conc-pct').addEventListener('change', aplicarConcentracao);

  // Seção C: explorador
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

  // tooltips "i": position fixed calculada no hover/toque (escapa do overflow da sidebar)
  document.querySelectorAll('.info-i').forEach((icone) => {
    const tip = icone.querySelector('.info-tip');
    if (!tip) return;
    const posiciona = () => {
      const r = icone.getBoundingClientRect();
      tip.style.left = `${Math.min(r.right + 8, window.innerWidth - 246)}px`;
      tip.style.top = `${r.top - 6}px`;
      requestAnimationFrame(() => {
        const tr = tip.getBoundingClientRect();
        if (tr.bottom > window.innerHeight - 8) {
          tip.style.top = `${Math.max(8, window.innerHeight - tr.height - 8)}px`;
        }
      });
    };
    icone.addEventListener('mouseenter', posiciona);
    icone.addEventListener('focus', posiciona);
    // touch/click: :hover não é confiável no toque — alterna explicitamente.
    // preventDefault evita que o navegador encaminhe o clique pro <input> do
    // <label> pai (.sb-row) — sem isso, tocar o "i" também trocava o rádio.
    icone.addEventListener('click', (e) => {
      e.preventDefault();
      e.stopPropagation();
      const jaAberto = icone.classList.contains('aberto');
      document.querySelectorAll('.info-i.aberto').forEach((el) => el.classList.remove('aberto'));
      if (!jaAberto) { icone.classList.add('aberto'); posiciona(); }
    });
  });
  document.addEventListener('click', () => {
    document.querySelectorAll('.info-i.aberto').forEach((el) => el.classList.remove('aberto'));
  });

  // colapsar/expandir
  const btn = document.getElementById('sb-toggle');
  btn.addEventListener('click', () => {
    const fechado = sb.classList.toggle('collapsed');
    btn.textContent = fechado ? '»' : '«';
    btn.title = fechado ? 'Abrir painel' : 'Recolher painel';
  });

  // mobile: sidebar comeca recolhida (mapa visivel primeiro; usuario abre por opcao)
  if (window.innerWidth <= 800) {
    sb.classList.add('collapsed');
    btn.textContent = '»';
    btn.title = 'Abrir painel';
  }

  // choropleth inicial: pinta quando o mapa estiver pronto (UI já montada acima)
  const pintaInicial = () => aplicarMetrica(METRICAS.find((m) => m.default));
  if (map.isStyleLoaded()) pintaInicial();
  else map.on('load', pintaInicial);
}
