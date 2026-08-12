// Orquestração: boot, seleção de município, seletores, download.

import { CULTURAS, debounce } from './config.js';
import { loadBoot, loadMunicipio, loadEstado, loadRgi, janelaUf, resumo } from './data.js';
import { map, initInteracao, selecionarNoMapa, valorFonteAtiva, initModoLimpo } from './map.js';
import { initSidebar } from './sidebar.js';
import { initBusca } from './busca.js';
import { initTema } from './tema.js';
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

// escopo dos 2 gráficos regionais: 'uf' (estado) ou 'rgi' (região intermediária)
const selRegiao = $('sel-regiao');
selRegiao.addEventListener('change', renderPam);

function culturaDefault(anual) {
  // maior área plantada recente entre as disponíveis
  const disp = new Set(anual.map((r) => r.cultura));
  for (const c of ['soja', 'milho', 'cana', 'arroz', 'feijao', 'trigo']) {
    if (disp.has(c)) return c;
  }
  return 'soja';
}

async function onSelect(geocod, nome, uf, previa = null) {
  $('hover-label').textContent = `${nome} · ${uf}`;
  $('hover-label').classList.add('active');
  $('muni-title').textContent = `${nome} · ${uf}`;
  // prévia instantânea do indicador ativo (sem esperar rede) — essencial no toque,
  // que não tem hover para mostrar isso antes de tocar.
  const indEl = $('muni-indicador');
  if (previa) {
    indEl.textContent = `${previa.label}: ${previa.valorFmt}`;
    indEl.hidden = false;
  } else {
    indEl.hidden = true;
  }
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
  const info = resumo.get(geocod);
  const [estado, rgi] = await Promise.all([loadEstado(uf), loadRgi(info?.cod_rgi)]);
  atual = { geocod, nome, uf, estado, rgi, nomeRgi: info?.nome_rgi, ...dados };

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
  for (const id of ['pam-controls', 'chart-anom', 'regiao-controls', 'chart-anom-uf',
                    'chart-rend', 'chart-rend-uf']) {
    $(id).style.display = temPam ? '' : 'none';
  }
  if (temPam) {
    // mantém a cultura escolhida se existir neste município; senão, default
    const disp = new Set(dados.anual.map((r) => r.cultura));
    if (!disp.has(selCultura.value)) selCultura.value = culturaDefault(dados.anual);
    renderPam();
  }
}

function renderPam() {
  if (!atual?.anual) return;
  const cult = selCultura.value;
  // janela ENSO analisada para a cultura+UF (muda a cada seleção)
  const janela = janelaUf.get(`${atual.uf}|${cult}`);
  $('cultura-janela').textContent = janela ? `Janela ENSO: ${janela}` : '';
  chartAnomalia('#chart-anom', atual.anual, cult);
  chartRendimento('#chart-rend', atual.anual, cult);

  // gráficos regionais — mesmas funções, com a série agregada do escopo escolhido
  const porRgi = selRegiao.value === 'rgi';
  const serie = porRgi ? atual.rgi : atual.estado;
  const rot = porRgi
    ? ` — ${atual.nomeRgi ?? 'região'} (região intermediária)`
    : ` — ${atual.uf} (estado)`;
  const temSerie = serie?.some((r) => r.cultura === cult && r.rend_kg_ha != null);
  $('chart-anom-uf').style.display = temSerie ? '' : 'none';
  $('chart-rend-uf').style.display = temSerie ? '' : 'none';
  if (temSerie) {
    chartAnomalia('#chart-anom-uf', serie, cult, rot);
    chartRendimento('#chart-rend-uf', serie, cult, rot);
  }
}

function onDeselect() {
  atual = null;
  $('hover-label').textContent = 'Passe o mouse sobre um município; clique para fixar e ver os gráficos';
  $('hover-label').classList.remove('active');
  $('muni-title').textContent = 'Nenhum município selecionado';
  $('muni-indicador').hidden = true;
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
// gráficos leem as cores das variáveis CSS: ao trocar de tema, re-renderiza
window.addEventListener('themechange', rerenderCharts);

// boot
(async () => {
  initTema();
  initModoLimpo();
  await loadBoot();
  initSidebar();  // monta a UI da sidebar já; o choropleth pinta no load do mapa
  initInteracao(onSelect, onDeselect);
  initBusca((geocod, nome, uf) => {
    const r = resumo.get(geocod);
    selecionarNoMapa(geocod, r?.lon, r?.lat);
    onSelect(geocod, nome, uf, valorFonteAtiva(geocod));
  });

  // deep-link: ?muni=<geocod> abre o município direto (link compartilhável)
  const geocod = new URLSearchParams(location.search).get('muni');
  const r = geocod && resumo.get(geocod);
  if (r) onSelect(geocod, r.nome, r.uf, valorFonteAtiva(geocod));
})();
