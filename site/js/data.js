// Carregamento de dados: resumo nacional no boot, 2 CSVs por município no clique.

const cacheMuni = new Map();
const cacheEstado = new Map();

export let resumo = new Map();      // code_muni -> linha do resumo.csv
export let oniSafras = new Map();   // ano_safra -> {fase, roni_pico, oni_pico, forte}
export let milhoSafraUf = new Map();// uf -> safra_dominante (1|2)
export let janelaUf = new Map();    // `${uf}|${cultura}` -> janela_label

export async function loadBoot() {
  const [res, oni, milho, jan] = await Promise.all([
    d3.csv('./data/resumo.csv'),
    d3.csv('./data/oni_safras.csv'),
    d3.csv('./data/milho_safra_uf.csv').catch(() => []),
    d3.csv('./data/janela_cultura_uf.csv').catch(() => []),
  ]);
  for (const r of milho) milhoSafraUf.set(r.uf, +r.safra_dominante);
  for (const r of jan) janelaUf.set(`${r.uf}|${r.cultura}`, r.janela_label);
  const TEXTO = new Set(['code_muni', 'nome', 'uf', 'cod_rgi', 'nome_rgi']);
  for (const r of res) {
    for (const k of Object.keys(r)) {
      if (!TEXTO.has(k)) r[k] = r[k] === '' ? null : +r[k];
    }
    resumo.set(String(r.code_muni), r);
  }
  for (const r of oni) {
    oniSafras.set(+r.ano_safra, {
      fase: r.fase,
      roni_pico: r.roni_pico === '' ? null : +r.roni_pico,
      oni_pico: r.oni_pico === '' ? null : +r.oni_pico,
      forte: +r.forte === 1,
    });
  }
}

// Ranking de municípios por produção (filtro de concentração no mapa).
// Ordenado do maior produtor para o menor; pct_acum é o % acumulado da produção.
const cacheConc = new Map();
export async function loadConcentracao(cultura) {
  if (cacheConc.has(cultura)) return cacheConc.get(cultura);
  const rows = await d3.csv(`./data/concentracao/${cultura}.csv`, (d) => ({
    code_muni: d.code_muni,
    pct_acum: +d.pct_acum,
  })).catch(() => null);
  cacheConc.set(cultura, rows);
  return rows;
}

// Séries agregadas por região intermediária (mesmo formato das da UF).
const cacheRgi = new Map();
export async function loadRgi(codRgi) {
  if (!codRgi) return null;
  if (cacheRgi.has(codRgi)) return cacheRgi.get(codRgi);
  const rows = await d3.csv(`./data/rgi/${codRgi}.csv`, (d) => ({
    cultura: d.cultura,
    ano: +d.ano,
    rend_kg_ha: d.rend_kg_ha === '' ? null : +d.rend_kg_ha,
    anom_rend_pct: d.anom_rend_pct === '' ? null : +d.anom_rend_pct,
    delta_rend_pct: d.delta_rend_pct === '' ? null : +d.delta_rend_pct,
    tend_gam_log: d.tend_gam_log === '' || d.tend_gam_log === undefined ? null : +d.tend_gam_log,
    fase: d.fase,
    forte: +d.forte === 1,
    roni_pico: d.roni_pico === '' ? null : +d.roni_pico,
  })).catch(() => null);
  cacheRgi.set(codRgi, rows);
  return rows;
}

// Séries agregadas por UF (para comparar município com estado). null se não existir.
export async function loadEstado(uf) {
  if (cacheEstado.has(uf)) return cacheEstado.get(uf);
  const rows = await d3.csv(`./data/estado/${uf}.csv`, (d) => ({
    cultura: d.cultura,
    ano: +d.ano,
    rend_kg_ha: d.rend_kg_ha === '' ? null : +d.rend_kg_ha,
    anom_rend_pct: d.anom_rend_pct === '' ? null : +d.anom_rend_pct,
    delta_rend_pct: d.delta_rend_pct === '' ? null : +d.delta_rend_pct,
    tend_gam_log: d.tend_gam_log === '' || d.tend_gam_log === undefined ? null : +d.tend_gam_log,
    fase: d.fase,
    forte: +d.forte === 1,
    roni_pico: d.roni_pico === '' ? null : +d.roni_pico,
  })).catch(() => null);
  cacheEstado.set(uf, rows);
  return rows;
}

// Retorna {mensal, anual} — anual = null quando município não tem PAM (404).
export async function loadMunicipio(geocod) {
  if (cacheMuni.has(geocod)) return cacheMuni.get(geocod);

  const num = (v) => (v === '' || v === undefined ? null : +v);
  const mensalP = d3.csv(`./data/mensal/${geocod}.csv`, (d) => ({
    ano: +d.data.slice(0, 4),
    mes: +d.data.slice(5, 7),
    rain_mm: num(d.rain_mm),
    spi1: num(d.spi1), spei1: num(d.spei1),
    spi3: num(d.spi3), spei3: num(d.spei3),
    spi6: num(d.spi6), spei6: num(d.spei6),
    spi12: num(d.spi12), spei12: num(d.spei12),
    tmax_med: num(d.tmax_med),
    veranico_max: num(d.veranico_max),
    soma_termica: num(d.soma_termica),
    srad_mj: num(d.srad_mj),
  }));
  const anualP = d3.csv(`./data/anual/${geocod}.csv`, (d) => ({
    ano: +d.ano,
    cultura: d.cultura,
    rend_kg_ha: d.rend_kg_ha === '' ? null : +d.rend_kg_ha,
    anom_rend_pct: d.anom_rend_pct === '' ? null : +d.anom_rend_pct,
    delta_rend_pct: d.delta_rend_pct === '' ? null : +d.delta_rend_pct,
    tend_gam_log: d.tend_gam_log === '' || d.tend_gam_log === undefined ? null : +d.tend_gam_log,
    fase: d.fase,
    forte: +d.forte === 1,
    roni_pico: d.roni_pico === '' ? null : +d.roni_pico,
  })).catch(() => null);

  const [mensal, anual] = await Promise.all([mensalP, anualP]);
  const out = { mensal, anual };
  cacheMuni.set(geocod, out);
  return out;
}
