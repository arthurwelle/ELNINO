// Orquestração: boot, seleção de município, seletores, download.

import { CULTURAS, debounce } from './config.js';
import { loadBoot, loadMunicipio, loadEstado } from './data.js';
import { map, initInteracao } from './map.js';
import { initSidebar } from './sidebar.js';
import { chartClimatologia, chartAcumulados, chartAnomalia, chartRendimento } from './charts.js';

const $ = (id) => document.getElementById(id);

let atual = null; // { geocod, nome, uf, mensal, anual }

const selCultura = $('sel-cultura');
for (const c of CULTURAS) {
  const o = document.createElement('option');
  o.value = c.id; o.textContent = c.label;
  selCultura.appendChild(o);
}
selCultura.addEventListener('change', renderPam);

function culturaDefault(anual) {
  // maior área plantada recente entre as disponíveis
  const disp = new Set(anual.map((r) => r.cultura));
  for (const c of ['soja', 'milho', 'cana', 'arroz', 'feijao', 'trigo']) {
    if (disp.has(c)) return c;
  }
  return 'soja';
}

async function onSelect(geocod, nome, uf) {
  $('hover-label').textContent = `${nome} · ${uf}`;
  $('hover-label').classList.add('active');
  $('muni-title').textContent = `${nome} · ${uf}`;
  $('placeholder-panel').hidden = true;
  $('charts').hidden = false;

  let dados;
  try {
    dados = await loadMunicipio(geocod);
  } catch {
    $('muni-title').textContent = `${nome} · ${uf} — sem dados climáticos`;
    $('charts').hidden = true;
    return;
  }
  const estado = await loadEstado(uf);
  atual = { geocod, nome, uf, estado, ...dados };

  $('muni-actions').hidden = false;
  $('dl-mensal').href = `./data/mensal/${geocod}.csv`;
  $('dl-mensal').download = `clima_mensal_${geocod}.csv`;
  const temPam = !!dados.anual;
  $('dl-anual').hidden = !temPam;
  if (temPam) {
    $('dl-anual').href = `./data/anual/${geocod}.csv`;
    $('dl-anual').download = `pam_anual_${geocod}.csv`;
  }

  chartClimatologia('#chart-clim', dados.mensal);
  chartAcumulados('#chart-acum', dados.mensal);

  $('pam-aviso').hidden = temPam;
  $('pam-controls').style.display = temPam ? '' : 'none';
  $('chart-anom').style.display = temPam ? '' : 'none';
  $('chart-rend').style.display = temPam ? '' : 'none';
  if (temPam) {
    // mantém a cultura escolhida se existir neste município; senão, default
    const disp = new Set(dados.anual.map((r) => r.cultura));
    if (!disp.has(selCultura.value)) selCultura.value = culturaDefault(dados.anual);
    renderPam();
  }
}

function renderPam() {
  if (!atual?.anual) return;
  chartAnomalia('#chart-anom', atual.anual, selCultura.value, atual.estado);
  chartRendimento('#chart-rend', atual.anual, selCultura.value, atual.estado);
}

function onDeselect() {
  atual = null;
  $('hover-label').textContent = 'Passe o mouse sobre um município; clique para fixar e ver os gráficos';
  $('hover-label').classList.remove('active');
  $('muni-title').textContent = 'Nenhum município selecionado';
  $('muni-actions').hidden = true;
  $('charts').hidden = true;
  $('placeholder-panel').hidden = false;
}

function rerenderCharts() {
  if (!atual) return;
  chartClimatologia('#chart-clim', atual.mensal);
  chartAcumulados('#chart-acum', atual.mensal);
  renderPam();
}
window.addEventListener('resize', debounce(rerenderCharts, 200));

// boot
(async () => {
  await loadBoot();
  initSidebar();  // monta a UI da sidebar já; o choropleth pinta no load do mapa
  initInteracao(onSelect, onDeselect);

  // deep-link: ?muni=<geocod> abre o município direto (link compartilhável)
  const { resumo } = await import('./data.js');
  const geocod = new URLSearchParams(location.search).get('muni');
  const r = geocod && resumo.get(geocod);
  if (r) onSelect(geocod, r.nome, r.uf);
})();
