// Carregamento de dados: resumo nacional no boot, 2 CSVs por município no clique.

const cacheMuni = new Map();

export let resumo = new Map();      // code_muni -> linha do resumo.csv
export let oniSafras = new Map();   // ano_safra -> {fase, oni_pico, forte}

export async function loadBoot() {
  const [res, oni] = await Promise.all([
    d3.csv('./data/resumo.csv'),
    d3.csv('./data/oni_safras.csv'),
  ]);
  for (const r of res) {
    for (const k of Object.keys(r)) {
      if (k !== 'code_muni' && k !== 'nome' && k !== 'uf') {
        r[k] = r[k] === '' ? null : +r[k];
      }
    }
    resumo.set(String(r.code_muni), r);
  }
  for (const r of oni) {
    oniSafras.set(+r.ano_safra, { fase: r.fase, oni_pico: +r.oni_pico, forte: +r.forte === 1 });
  }
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
  }));
  const anualP = d3.csv(`./data/anual/${geocod}.csv`, (d) => ({
    ano: +d.ano,
    cultura: d.cultura,
    rend_kg_ha: d.rend_kg_ha === '' ? null : +d.rend_kg_ha,
    anom_rend_pct: d.anom_rend_pct === '' ? null : +d.anom_rend_pct,
    delta_rend_pct: d.delta_rend_pct === '' ? null : +d.delta_rend_pct,
    fase: d.fase,
    forte: +d.forte === 1,
  })).catch(() => null);

  const [mensal, anual] = await Promise.all([mensalP, anualP]);
  const out = { mensal, anual };
  cacheMuni.set(geocod, out);
  return out;
}
