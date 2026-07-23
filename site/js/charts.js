// 4 gráficos D3 do painel do município.
// (a) climatologia mensal de chuva por fase  (b) série SPEI-3 com fundo ENSO
// (c) anomalia de rendimento por fase        (d) rendimento + tendência

import { FASE, FASES, INK, MESES_CURTOS, safraDoMes } from './config.js';
import { oniSafras } from './data.js';

const MARGIN = { top: 30, right: 70, bottom: 28, left: 44 };
const ALTURA = 210;

function baseSvg(sel, titulo) {
  const el = d3.select(sel).html('');
  el.append('h3').text(titulo);
  const w = el.node().clientWidth || 480;
  const svg = el.append('svg').attr('width', w).attr('height', ALTURA);
  return {
    el, svg, w,
    iw: w - MARGIN.left - MARGIN.right,
    ih: ALTURA - MARGIN.top - MARGIN.bottom,
    g: svg.append('g').attr('transform', `translate(${MARGIN.left},${MARGIN.top})`),
  };
}

function eixos(c, x, y, { xFmt, yFmt } = {}) {
  c.g.append('g').attr('class', 'axis')
    .attr('transform', `translate(0,${c.ih})`)
    .call(d3.axisBottom(x).ticks(6).tickFormat(xFmt ?? null).tickSizeOuter(0));
  c.g.append('g').attr('class', 'axis')
    .call(d3.axisLeft(y).ticks(5).tickFormat(yFmt ?? null).tickSizeOuter(0))
    .call((g) => g.selectAll('.tick line').clone()
      .attr('x2', c.iw).attr('class', 'grid'));
}

function legendaFases(c, fases = FASES) {
  const lg = c.el.append('div').attr('class', 'chart-legend');
  for (const f of fases) {
    const item = lg.append('span').attr('class', 'legend-item');
    item.append('span').attr('class', 'legend-swatch')
      .style('background', FASE[f].cor);
    item.append('span').text(FASE[f].label);
  }
  return lg;
}

function tooltip(el) {
  return el.append('div').attr('class', 'chart-tooltip').style('opacity', 0);
}

const fmtBR = (n, dig = 0) =>
  n == null ? '–' : n.toLocaleString('pt-BR', { maximumFractionDigits: dig });

// ---------------------------------------------------------------- (a)
export function chartClimatologia(sel, mensal) {
  const c = baseSvg(sel, 'Chuva mensal média por fase ENSO (safra jul–jun)');
  const ordem = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

  const acc = new Map(); // `${fase}-${mes}` -> [valores]
  for (const r of mensal) {
    if (r.rain_mm == null) continue;
    const s = oniSafras.get(safraDoMes(r.ano, r.mes));
    if (!s) continue;
    const k = `${s.fase}-${r.mes}`;
    if (!acc.has(k)) acc.set(k, []);
    acc.get(k).push(r.rain_mm);
  }
  const series = FASES.map((f) => ({
    fase: f,
    pts: ordem.map((m, i) => {
      const v = acc.get(`${f}-${m}`);
      return { i, mes: m, val: v ? d3.mean(v) : null };
    }).filter((p) => p.val != null),
  }));

  const x = d3.scalePoint().domain(d3.range(12)).range([0, c.iw]);
  const yMax = d3.max(series, (s) => d3.max(s.pts, (p) => p.val)) || 1;
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([c.ih, 0]);
  eixos(c, x, y, { xFmt: (i) => MESES_CURTOS[ordem[i] - 1] });

  const linha = d3.line().x((p) => x(p.i)).y((p) => y(p.val));
  for (const s of series) {
    c.g.append('path').datum(s.pts)
      .attr('fill', 'none').attr('stroke', FASE[s.fase].cor)
      .attr('stroke-width', 2)
      .attr('stroke-dasharray', s.fase === 'N' ? '5 4' : null)
      .attr('d', linha);
    const ult = s.pts[s.pts.length - 1];
    if (ult) {
      c.g.append('text').attr('class', 'direct-label')
        .attr('x', x(ult.i) + 5).attr('y', y(ult.val) + 4)
        .attr('fill', FASE[s.fase].cor)
        .text(FASE[s.fase].label);
    }
  }
  legendaFases(c);

  // crosshair + tooltip
  const tt = tooltip(c.el);
  const hair = c.g.append('line').attr('class', 'hairline')
    .attr('y1', 0).attr('y2', c.ih).style('opacity', 0);
  c.svg.append('rect')
    .attr('x', MARGIN.left).attr('y', MARGIN.top)
    .attr('width', c.iw).attr('height', c.ih)
    .attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const [mx] = d3.pointer(ev, c.g.node());
      const i = Math.max(0, Math.min(11, Math.round((mx / c.iw) * 11)));
      hair.attr('x1', x(i)).attr('x2', x(i)).style('opacity', 1);
      const linhas = series.map((s) => {
        const p = s.pts.find((q) => q.i === i);
        return `<span style="color:${FASE[s.fase].cor}">●</span> ${FASE[s.fase].label}: <b>${fmtBR(p?.val)} mm</b>`;
      }).join('<br>');
      tt.style('opacity', 1)
        .style('left', `${x(i) + MARGIN.left + 10}px`).style('top', '30px')
        .html(`<b>${MESES_CURTOS[ordem[i] - 1]}</b><br>${linhas}`);
    })
    .on('mouseleave', () => { hair.style('opacity', 0); tt.style('opacity', 0); });
}

// ---------------------------------------------------------------- (b)
// Linha extra dos tooltips: RONI de pico da safra.
function linhaRoni(s) {
  if (!s || s.roni_pico == null) return '';
  return `<br><span class="tt-roni">RONI safra: ${s.roni_pico > 0 ? '+' : ''}${fmtBR(s.roni_pico, 1)}</span>`;
}

const VARS_ACUM = [
  { key: 'rain_mm', label: 'Chuva acumulada', unidade: 'mm', dig: 0 },
  { key: 'soma_termica', label: 'Soma térmica (base 10 °C)', unidade: '°C·dia', dig: 0 },
  { key: 'srad_mj', label: 'Radiação acumulada', unidade: 'MJ/m²', dig: 0 },
];
const MESES_INI = [7, 8, 9, 10, 11, 12, 1, 2, 3, 4, 5, 6];

// Curva acumulada média ao longo de 4 meses (a partir do mês escolhido),
// uma linha por fase ENSO. Facets lado a lado, um por variável.
export function chartAcumulados(sel, mensal, mesInicial = 10) {
  const el = d3.select(sel).html('');
  const head = el.append('div').attr('class', 'acum-head');
  head.append('h3').text('Acumulado médio ao longo de 4 meses, por fase ENSO');
  const ctl = head.append('label').attr('class', 'acum-ctl');
  ctl.append('span').text('a partir de ');
  const selMes = ctl.append('select')
    .on('change', function () { chartAcumulados(sel, mensal, +this.value); });
  selMes.selectAll('option').data(MESES_INI).join('option')
    .attr('value', (m) => m).property('selected', (m) => m === mesInicial)
    .text((m) => MESES_CURTOS[m - 1]);

  // rótulos dos 4 meses da janela
  const meses4 = [0, 1, 2, 3].map((k) => ((mesInicial - 1 + k) % 12) + 1);
  const rotulos = meses4.map((m) => MESES_CURTOS[m - 1]);

  const mval = new Map();
  for (const r of mensal) mval.set(`${r.ano}-${r.mes}`, r);
  const anos = d3.extent(mensal, (r) => r.ano);

  // por ano: acumulado progressivo (4 passos) de cada variável + fase da safra
  const registros = { EN: [], LN: [], N: [] };
  const nFase = { EN: 0, LN: 0, N: 0 };
  for (let y0 = anos[0]; y0 <= anos[1]; y0++) {
    const cum = { rain_mm: [], soma_termica: [], srad_mj: [] };
    const acu = { rain_mm: 0, soma_termica: 0, srad_mj: 0 };
    let completo = true;
    for (let k = 0; k < 4; k++) {
      const mes = ((mesInicial - 1 + k) % 12) + 1;
      const ano = y0 + Math.floor((mesInicial - 1 + k) / 12);
      const r = mval.get(`${ano}-${mes}`);
      if (!r) { completo = false; break; }
      for (const v of VARS_ACUM) { acu[v.key] += r[v.key] ?? 0; cum[v.key].push(acu[v.key]); }
    }
    if (!completo) continue;
    const s = oniSafras.get(safraDoMes(y0, mesInicial));
    if (!s) continue;
    registros[s.fase].push(cum);
    nFase[s.fase]++;
  }

  // média por fase e passo, para cada variável
  const media = {}; // media[key][fase] = [m0,m1,m2,m3]
  for (const v of VARS_ACUM) {
    media[v.key] = {};
    for (const f of FASES) {
      const regs = registros[f];
      media[v.key][f] = regs.length
        ? [0, 1, 2, 3].map((k) => d3.mean(regs, (c) => c[v.key][k]))
        : null;
    }
  }

  const tt = tooltip(el);
  const painel = el.append('div').attr('class', 'acum-facets');
  const M = { top: 8, right: 8, bottom: 20, left: 40 };

  // largura uniforme dos facets, medida uma vez (evita reflow do flex no loop)
  const GAP = 6;
  const painelW = painel.node().clientWidth || 480;
  const w = Math.max(92, Math.floor((painelW - (VARS_ACUM.length - 1) * GAP) / VARS_ACUM.length));
  const H = Math.max(150, w + 20); // quase quadrado

  for (const v of VARS_ACUM) {
    const box = painel.append('div').attr('class', 'acum-facet')
      .style('flex', `0 0 ${w}px`);
    box.append('div').attr('class', 'acum-facet-title')
      .html(`${v.label}<br><span class="acum-unit">(${v.unidade})</span>`);
    const iw = w - M.left - M.right, ih = H - M.top - M.bottom;
    const svg = box.append('svg').attr('width', w).attr('height', H);
    const g = svg.append('g').attr('transform', `translate(${M.left},${M.top})`);

    const x = d3.scalePoint().domain([0, 1, 2, 3]).range([0, iw]);
    const yMax = d3.max(FASES, (f) => media[v.key][f] ? d3.max(media[v.key][f]) : 0) || 1;
    const y = d3.scaleLinear().domain([0, yMax]).nice().range([ih, 0]);
    g.append('g').attr('class', 'axis').attr('transform', `translate(0,${ih})`)
      .call(d3.axisBottom(x).tickFormat((i) => rotulos[i]).tickSizeOuter(0));
    g.append('g').attr('class', 'axis')
      .call(d3.axisLeft(y).ticks(4).tickFormat((n) => fmtBR(n)).tickSizeOuter(0))
      .call((gg) => gg.selectAll('.tick line').clone().attr('x2', iw).attr('class', 'grid'));

    const linha = d3.line().x((_, i) => x(i)).y((d) => y(d));
    for (const f of FASES) {
      const curva = media[v.key][f];
      if (!curva) continue;
      g.append('path').datum(curva)
        .attr('fill', 'none').attr('stroke', FASE[f].cor).attr('stroke-width', 2)
        .attr('stroke-dasharray', f === 'N' ? '5 4' : null)
        .attr('d', linha);
      curva.forEach((val, i) => {
        g.append('circle').attr('cx', x(i)).attr('cy', y(val)).attr('r', 3)
          .attr('fill', FASE[f].cor)
          .on('mousemove', (ev) => {
            const [mx, my] = d3.pointer(ev, el.node());
            tt.style('opacity', 1)
              .style('left', `${Math.min(mx + 12, el.node().clientWidth - 170)}px`)
              .style('top', `${my - 10}px`)
              .html(`<b>${rotulos[i]}</b> · ${FASE[f].label} (n=${nFase[f]})<br>` +
                    `${v.label}: <b>${fmtBR(val, v.dig)} ${v.unidade}</b>`);
          })
          .on('mouseleave', () => tt.style('opacity', 0));
      });
    }
  }
  legendaFases({ el }).append('span').attr('class', 'legend-note')
    .text('média acumulada; a diferença entre as fases é o que importa');
}

// ---------------------------------------------------------------- (c)
export function chartAnomalia(sel, anual, cultura, estado = null) {
  const c = baseSvg(sel, 'Anomalia de rendimento por fase ENSO (% vs tendência)');
  const dados = anual
    .filter((r) => r.cultura === cultura)
    .map((r) => ({ ...r, val: r.anom_rend_pct ?? r.delta_rend_pct }))
    .filter((r) => r.val != null && r.fase);

  if (!dados.length) {
    c.g.append('text').attr('class', 'placeholder-msg')
      .attr('x', c.iw / 2).attr('y', c.ih / 2)
      .text('Sem série suficiente para esta cultura');
    return;
  }
  const usaLoess = dados.some((r) => r.anom_rend_pct != null);
  if (!usaLoess) {
    c.el.select('h3').text('Variação anual do rendimento por fase ENSO (Δ% a-a, série curta)');
  }

  const grupos = FASES.map((f) => ({ fase: f, vals: dados.filter((r) => r.fase === f) }));
  const x = d3.scalePoint().domain(FASES).range([0, c.iw]).padding(0.5);
  const lim = Math.max(10, d3.max(dados, (r) => Math.abs(r.val)));
  const y = d3.scaleLinear().domain([-lim, lim]).nice().range([c.ih, 0]);
  eixos(c, x, y, { xFmt: (f) => `${FASE[f].label} (n=${grupos.find((g) => g.fase === f).vals.length})`, yFmt: (v) => `${v > 0 ? '+' : ''}${v}%` });
  c.g.append('line').attr('class', 'zeroline')
    .attr('x1', 0).attr('x2', c.iw).attr('y1', y(0)).attr('y2', y(0));

  const tt = tooltip(c.el);
  for (const gr of grupos) {
    const cx = x(gr.fase);
    // boxplot quando amostra sustenta (série loess e n>=8)
    if (usaLoess && gr.vals.length >= 8) {
      const v = gr.vals.map((r) => r.val).sort(d3.ascending);
      const [q1, q2, q3] = [0.25, 0.5, 0.75].map((q) => d3.quantileSorted(v, q));
      const bw = 46;
      c.g.append('rect')
        .attr('x', cx - bw / 2).attr('width', bw)
        .attr('y', y(q3)).attr('height', Math.max(1, y(q1) - y(q3)))
        .attr('rx', 3)
        .attr('fill', FASE[gr.fase].cor).attr('opacity', 0.18)
        .attr('stroke', FASE[gr.fase].cor).attr('stroke-width', 1);
      c.g.append('line')
        .attr('x1', cx - bw / 2).attr('x2', cx + bw / 2)
        .attr('y1', y(q2)).attr('y2', y(q2))
        .attr('stroke', FASE[gr.fase].cor).attr('stroke-width', 2.5);
    }
    // pontos com jitter determinístico
    gr.vals.forEach((r, i) => {
      const jit = ((i * 37) % 21 - 10) * 1.6;
      c.g.append('circle')
        .attr('cx', cx + jit).attr('cy', y(r.val)).attr('r', r.forte ? 5 : 3.5)
        .attr('fill', FASE[gr.fase].cor)
        .attr('fill-opacity', 0.75)
        .attr('stroke', r.forte ? INK.primary : INK.surface)
        .attr('stroke-width', r.forte ? 1.6 : 0.8)
        .on('mousemove', (ev) => {
          const [mx, my] = d3.pointer(ev, c.el.node());
          tt.style('opacity', 1)
            .style('left', `${Math.min(mx + 12, c.w - 160)}px`).style('top', `${my - 10}px`)
            .html(`<b>${r.ano}</b> · ${FASE[gr.fase].label}${r.forte ? ' <b>(forte)</b>' : ''}<br>` +
                  `Anomalia: <b>${r.val > 0 ? '+' : ''}${fmtBR(r.val, 1)}%</b><br>` +
                  `Rendimento: ${fmtBR(r.rend_kg_ha)} kg/ha${linhaRoni(oniSafras.get(r.ano))}`);
        })
        .on('mouseleave', () => tt.style('opacity', 0));
    });
  }

  // losango vazado por fase = anomalia média do estado (UF) naquela fase
  const estUf = estado?.filter((r) => r.cultura === cultura && r.anom_rend_pct != null && r.fase);
  if (estUf?.length) {
    for (const gr of grupos) {
      const vs = estUf.filter((r) => r.fase === gr.fase).map((r) => r.anom_rend_pct);
      if (!vs.length) continue;
      const cx = x(gr.fase), cy = y(d3.mean(vs)), s = 5;
      c.g.append('path')
        .attr('d', `M${cx},${cy - s} L${cx + s},${cy} L${cx},${cy + s} L${cx - s},${cy} Z`)
        .attr('fill', 'none').attr('stroke', FASE[gr.fase].cor).attr('stroke-width', 2);
    }
  }

  const lg = legendaFases(c);
  lg.append('span').attr('class', 'legend-note')
    .text(estUf?.length
      ? 'ponto = município · losango = estado (UF) · contorno = evento forte'
      : 'ponto maior com contorno = El Niño/La Niña forte');
}

// ---------------------------------------------------------------- (d)
export function chartRendimento(sel, anual, cultura, estado = null) {
  const c = baseSvg(sel, 'Rendimento e tendência · anos ENSO marcados');
  const dados = anual
    .filter((r) => r.cultura === cultura && r.rend_kg_ha != null)
    .sort((a, b) => a.ano - b.ano);

  if (dados.length < 2) {
    c.g.append('text').attr('class', 'placeholder-msg')
      .attr('x', c.iw / 2).attr('y', c.ih / 2)
      .text('Sem série suficiente para esta cultura');
    return;
  }

  // tendência reconstruída da anomalia loess: tend = rend / (1 + anom/100)
  const tend = dados
    .filter((r) => r.anom_rend_pct != null && r.anom_rend_pct > -100)
    .map((r) => ({ ano: r.ano, val: r.rend_kg_ha / (1 + r.anom_rend_pct / 100) }));

  const estUf = estado?.filter((r) => r.cultura === cultura && r.rend_kg_ha != null)
    .sort((a, b) => a.ano - b.ano);

  const x = d3.scaleLinear().domain(d3.extent(dados, (r) => r.ano)).range([0, c.iw]);
  const yMax = Math.max(d3.max(dados, (r) => r.rend_kg_ha),
                        estUf?.length ? d3.max(estUf, (r) => r.rend_kg_ha) : 0);
  const y = d3.scaleLinear().domain([0, yMax]).nice().range([c.ih, 0]);
  eixos(c, x, y, { xFmt: d3.format('d'), yFmt: (v) => fmtBR(v) });

  // linha do estado (UF), rendimento agregado ponderado por área
  if (estUf?.length) {
    c.g.append('path').datum(estUf)
      .attr('fill', 'none').attr('stroke', INK.muted).attr('stroke-width', 1.5)
      .attr('stroke-dasharray', '2 3')
      .attr('d', d3.line().x((r) => x(r.ano)).y((r) => y(r.rend_kg_ha)));
    const fimE = estUf[estUf.length - 1];
    c.g.append('text').attr('class', 'direct-label')
      .attr('x', x(fimE.ano) + 4).attr('y', y(fimE.rend_kg_ha) + 10)
      .attr('fill', INK.muted).text('estado');
  }

  c.g.append('path').datum(dados)
    .attr('fill', 'none').attr('stroke', INK.axis).attr('stroke-width', 1.2)
    .attr('d', d3.line().x((r) => x(r.ano)).y((r) => y(r.rend_kg_ha)));
  if (tend.length > 2) {
    c.g.append('path').datum(tend)
      .attr('fill', 'none').attr('stroke', INK.secondary)
      .attr('stroke-width', 2).attr('stroke-dasharray', '6 4')
      .attr('d', d3.line().x((p) => x(p.ano)).y((p) => y(p.val)).curve(d3.curveMonotoneX));
    const fim = tend[tend.length - 1];
    c.g.append('text').attr('class', 'direct-label')
      .attr('x', x(fim.ano) + 4).attr('y', y(fim.val))
      .attr('fill', INK.secondary).text('tendência');
  }

  const tt = tooltip(c.el);
  for (const r of dados) {
    c.g.append('circle')
      .attr('cx', x(r.ano)).attr('cy', y(r.rend_kg_ha))
      .attr('r', r.forte ? 5 : 3.5)
      .attr('fill', FASE[r.fase]?.cor ?? INK.muted)
      .attr('stroke', r.forte ? INK.primary : '#fff')
      .attr('stroke-width', r.forte ? 1.6 : 0.8)
      .on('mousemove', (ev) => {
        const [mx, my] = d3.pointer(ev, c.el.node());
        tt.style('opacity', 1)
          .style('left', `${Math.min(mx + 12, c.w - 170)}px`).style('top', `${my - 10}px`)
          .html(`<b>${r.ano}</b> · ${FASE[r.fase]?.label ?? '–'}${r.forte ? ' <b>(forte)</b>' : ''}<br>` +
                `Rendimento: <b>${fmtBR(r.rend_kg_ha)} kg/ha</b>${linhaRoni(oniSafras.get(r.ano))}`);
      })
      .on('mouseleave', () => tt.style('opacity', 0));
  }
  legendaFases(c);
}
