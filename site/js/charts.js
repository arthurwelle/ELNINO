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
export const INDICES_SECA = [
  { id: 'spei6', label: 'SPEI-6' }, { id: 'spei3', label: 'SPEI-3' },
  { id: 'spei1', label: 'SPEI-1' }, { id: 'spei12', label: 'SPEI-12' },
  { id: 'spi6', label: 'SPI-6' }, { id: 'spi3', label: 'SPI-3' },
  { id: 'spi1', label: 'SPI-1' }, { id: 'spi12', label: 'SPI-12' },
];

export function chartSpei(sel, mensal, indice = 'spei3') {
  const lbl = INDICES_SECA.find((i) => i.id === indice).label;
  const c = baseSvg(sel, `${lbl} mensal 1980–2025 · fundo = fase da safra (out–mar)`);

  // seletor de índice dentro do painel
  const selIdx = c.el.select('h3').append('select')
    .style('margin-left', '8px')
    .on('change', function () { chartSpei(sel, mensal, this.value); });
  selIdx.selectAll('option').data(INDICES_SECA).join('option')
    .attr('value', (d) => d.id).property('selected', (d) => d.id === indice)
    .text((d) => d.label);

  const pts = mensal.filter((r) => r[indice] != null)
    .map((r) => ({ t: r.ano + (r.mes - 0.5) / 12, spei3: r[indice], ano: r.ano, mes: r.mes }));

  const x = d3.scaleLinear().domain(d3.extent(pts, (p) => p.t)).range([0, c.iw]);
  const lim = Math.max(2.5, d3.max(pts, (p) => Math.abs(p.spei3)) || 2.5);
  const y = d3.scaleLinear().domain([-lim, lim]).range([c.ih, 0]);

  // fundo por safra EN/LN (out(t-1) a mar(t)); forte = mais opaco
  for (const [t, s] of oniSafras) {
    if (s.fase === 'N') continue;
    const x0 = x(t - 1 + 9 / 12), x1 = x(t + 3 / 12);
    if (x1 < 0 || x0 > c.iw) continue;
    c.g.append('rect')
      .attr('x', Math.max(0, x0)).attr('width', Math.min(c.iw, x1) - Math.max(0, x0))
      .attr('y', 0).attr('height', c.ih)
      .attr('fill', FASE[s.fase].cor)
      .attr('opacity', s.forte ? 0.28 : 0.13);
  }

  eixos(c, x, y, { xFmt: d3.format('d') });
  c.g.append('line').attr('class', 'zeroline')
    .attr('x1', 0).attr('x2', c.iw).attr('y1', y(0)).attr('y2', y(0));

  c.g.append('path').datum(pts)
    .attr('fill', 'none').attr('stroke', INK.primary).attr('stroke-width', 1.2)
    .attr('d', d3.line().x((p) => x(p.t)).y((p) => y(p.spei3)));

  legendaFases(c, ['EN', 'LN']).append('span').attr('class', 'legend-note')
    .text('faixa mais escura = evento forte · índice < 0 = mais seco');

  const tt = tooltip(c.el);
  const hair = c.g.append('line').attr('class', 'hairline')
    .attr('y1', 0).attr('y2', c.ih).style('opacity', 0);
  const bisect = d3.bisector((p) => p.t).center;
  c.svg.append('rect')
    .attr('x', MARGIN.left).attr('y', MARGIN.top)
    .attr('width', c.iw).attr('height', c.ih).attr('fill', 'transparent')
    .on('mousemove', (ev) => {
      const [mx] = d3.pointer(ev, c.g.node());
      const p = pts[bisect(pts, x.invert(mx))];
      if (!p) return;
      hair.attr('x1', x(p.t)).attr('x2', x(p.t)).style('opacity', 1);
      const s = oniSafras.get(safraDoMes(p.ano, p.mes));
      tt.style('opacity', 1)
        .style('left', `${Math.min(x(p.t) + MARGIN.left + 10, c.w - 150)}px`)
        .style('top', '30px')
        .html(`<b>${MESES_CURTOS[p.mes - 1]}/${p.ano}</b><br>${lbl}: <b>${fmtBR(p.spei3, 2)}</b><br>Safra: ${s ? FASE[s.fase].label : '–'}${s?.forte ? ' (forte)' : ''}`);
    })
    .on('mouseleave', () => { hair.style('opacity', 0); tt.style('opacity', 0); });
}

// ---------------------------------------------------------------- (c)
export function chartAnomalia(sel, anual, cultura) {
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
                  `Rendimento: ${fmtBR(r.rend_kg_ha)} kg/ha`);
        })
        .on('mouseleave', () => tt.style('opacity', 0));
    });
  }
  const lg = legendaFases(c);
  lg.append('span').attr('class', 'legend-note')
    .text('ponto maior com contorno = El Niño/La Niña forte');
}

// ---------------------------------------------------------------- (d)
export function chartRendimento(sel, anual, cultura) {
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

  const x = d3.scaleLinear().domain(d3.extent(dados, (r) => r.ano)).range([0, c.iw]);
  const y = d3.scaleLinear()
    .domain([0, d3.max(dados, (r) => r.rend_kg_ha)]).nice().range([c.ih, 0]);
  eixos(c, x, y, { xFmt: d3.format('d'), yFmt: (v) => fmtBR(v) });

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
                `Rendimento: <b>${fmtBR(r.rend_kg_ha)} kg/ha</b>`);
      })
      .on('mouseleave', () => tt.style('opacity', 0));
  }
  legendaFases(c);
}
