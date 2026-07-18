// ============================================================
// SECTION 1: DuckDB WASM SETUP
// ============================================================

import * as duckdb from 'https://cdn.jsdelivr.net/npm/@duckdb/duckdb-wasm/+esm';

let conn = null;

async function initDuckDB() {
  const BUNDLES = duckdb.getJsDelivrBundles();
  const bundle = await duckdb.selectBundle(BUNDLES);
  const workerUrl = URL.createObjectURL(
    new Blob([`importScripts("${bundle.mainWorker}");`], { type: 'text/javascript' })
  );
  const worker = new Worker(workerUrl);
  const logger = new duckdb.ConsoleLogger(duckdb.LogLevel.WARNING);
  const db = new duckdb.AsyncDuckDB(logger, worker);
  await db.instantiate(bundle.mainModule, bundle.pthreadWorker);
  URL.revokeObjectURL(workerUrl);
  conn = await db.connect();
  // Fetch and register parquet
  const buf = await (await fetch('./DATA/culturas.parquet')).arrayBuffer();
  await db.registerFileBuffer('culturas.parquet', new Uint8Array(buf));
  await conn.query("CREATE VIEW culturas AS SELECT * FROM parquet_scan('culturas.parquet')");
}

// ============================================================
// SECTION 2: RISK PATTERNS & DETERMINISTIC MUNICIPALITY ASSIGNMENT
// ============================================================

const meses = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];

const padraoSD = [
  "Low","Low","Low","Low","Low","Low","Medium","Medium","High",
  "Unsuitable","Unsuitable","Unsuitable","Unsuitable","Unsuitable","Unsuitable",
  "Unsuitable","Unsuitable","Unsuitable","Unsuitable","Unsuitable","Unsuitable",
  "Unsuitable","Unsuitable","Unsuitable","High","Medium","Medium",
  "Low","Low","Low","Medium","Medium","Medium","Medium","Medium","Low"
];

const padraoOutro = [
  "Medium","Medium","High","Unsuitable","Unsuitable","Unsuitable",
  "Unsuitable","Unsuitable","Unsuitable","Low","Low","Low","Low","Low","Low",
  "Medium","Medium","High","High","Medium","Medium","Low","Low","Low",
  "Low","Low","Low","Unsuitable","Unsuitable","Unsuitable",
  "Unsuitable","Unsuitable","Unsuitable","High","Medium","Medium"
];

const padroes = [padraoSD, padraoOutro];

// djb2 hash: deterministic, consistent across all browsers and page loads
function hashMunicipio(name) {
  let hash = 5381;
  for (let i = 0; i < name.length; i++) {
    hash = ((hash << 5) + hash) + name.charCodeAt(i);
    hash = hash & hash; // force 32-bit signed integer
  }
  return Math.abs(hash) % padroes.length;
}

function getPadrao(name) {
  return padroes[hashMunicipio(name)];
}

function gerarDados(municipio, padraoRisco) {
  return d3.range(1, 37).map(i => ({
    municipio,
    decendio: i,
    mes: meses[Math.floor((i - 1) / 3)],
    risco: padraoRisco[i - 1]
  }));
}

// ============================================================
// SECTION 3: SHARED D3 UTILITIES
// ============================================================

const color = d3.scaleOrdinal()
  .domain(["Low", "Medium", "High", "Unsuitable"])
  .range(["#044279", "#009933", "#c47100", "#f7f7f7"]);

const pie = d3.pie().value(1).sort(null);
const pieDataRaw = pie(Array(36).fill(1)); // fixed angular positions, never changes

// ============================================================
// SECTION 4: CALENDAR SVG — BUILT ONCE, UPDATED ON HOVER
// ============================================================

const CAL_W = 520;
const CAL_H = 520;
const CAL_MARGIN = 65;
const radius = Math.min(CAL_W, CAL_H) / 2 - CAL_MARGIN;

const calendarSvg = d3.select("#calendar-panel")
  .append("svg")
  .attr("viewBox", `0 0 ${CAL_W} ${CAL_H}`)
  .attr("preserveAspectRatio", "xMidYMid meet");

// Main group centered in the SVG
const svg = calendarSvg.append("g")
  .attr("transform", `translate(${CAL_W / 2}, ${CAL_H / 2})`);

// Arc generators
const arc = d3.arc()
  .innerRadius(radius * 0.5)
  .outerRadius(radius * 0.8);

const labelArc = d3.arc()
  .innerRadius(radius * 0.83)
  .outerRadius(radius * 0.83);

// --- Fixed elements: month dividers ---
const monthBoundaries = pieDataRaw.filter((_d, i) => i % 3 === 0);

svg.selectAll(".month-divider")
  .data(monthBoundaries)
  .enter().append("line")
  .attr("class", "month-divider")
  .attr("x1", d => Math.sin(d.startAngle) * (radius * 0.5))
  .attr("y1", d => -Math.cos(d.startAngle) * (radius * 0.5))
  .attr("x2", d => Math.sin(d.startAngle) * (radius * 0.9))
  .attr("y2", d => -Math.cos(d.startAngle) * (radius * 0.9));

// --- Fixed elements: month label arc paths in <defs> ---
const r = radius * 0.9;
const defs = svg.append("defs");

defs.selectAll("path")
  .data(d3.range(12))
  .enter().append("path")
  .attr("id", i => `monthPath_${i}`)
  .attr("d", i => {
    const startAngle = pieDataRaw[i * 3].startAngle;
    const endAngle   = pieDataRaw[i * 3 + 2].endAngle;
    const midAngle   = (startAngle + endAngle) / 2;
    const x1 = Math.sin(startAngle) * r, y1 = -Math.cos(startAngle) * r;
    const x2 = Math.sin(endAngle) * r,   y2 = -Math.cos(endAngle) * r;
    const isBottomHalf = midAngle > Math.PI / 2 && midAngle < 3 * Math.PI / 2;
    return isBottomHalf
      ? `M ${x2},${y2} A ${r},${r},0,0,0,${x1},${y1}`
      : `M ${x1},${y1} A ${r},${r},0,0,1,${x2},${y2}`;
  });

svg.selectAll(".month-label")
  .data(d3.range(12))
  .enter().append("text")
  .attr("class", "month-label")
  .append("textPath")
  .attr("xlink:href", i => `#monthPath_${i}`)
  .attr("startOffset", "50%")
  .style("text-anchor", "middle")
  .text(i => meses[i]);

// --- Legend (horizontal, below the circle) ---
const legendItems = ["Low", "Medium", "High", "Unsuitable"];
const legendItemW = 95; // width per item (square + text)
const legendX = -(legendItems.length * legendItemW) / 2;
const legendY = radius * 1.05;

const legend = svg.append("g")
  .attr("transform", `translate(${legendX}, ${legendY})`);

legendItems.forEach((item, i) => {
  const col = legend.append("g").attr("transform", `translate(${i * legendItemW}, 0)`);
  col.append("rect")
    .attr("width", 14).attr("height", 14)
    .attr("fill", color(item))
    .attr("stroke", "#ccc");
  col.append("text")
    .attr("x", 20).attr("y", 12)
    .attr("class", "legend-text")
    .text(item);
});

// --- Center text (municipality name, updated on hover) ---
const centerText = svg.append("text")
  .attr("class", "center-text")
  .attr("y", -10);

const centerTextState = svg.append("text")
  .attr("class", "center-text")
  .attr("y", 12);

// Placeholder shown before any hover
const centerPlaceholder = svg.append("text")
  .attr("class", "center-placeholder")
  .attr("y", 5)
  .text("← hover a municipality");

// --- Initial arc paths (gray placeholder fill) ---
// Created once here; updateChart() only transitions fills, never re-enters
const initialPieData = pie(d3.range(36).map(i => ({
  decendio: i + 1,
  mes: meses[Math.floor(i / 3)],
  risco: "placeholder"
})));

svg.selectAll(".arc-path")
  .data(initialPieData, d => d.data.decendio)
  .enter().append("path")
  .attr("class", "arc-path")
  .attr("d", arc)
  .attr("fill", "#d0dde8")
  .each(function(d) { this._current = d; });

// --- Decendio number labels (created once, not inside updateChart) ---
svg.selectAll(".decendio-label")
  .data(initialPieData)
  .enter().append("text")
  .attr("class", "decendio-label")
  .attr("transform", d => {
    const pos = labelArc.centroid(d);
    const angle = (d.startAngle + d.endAngle) / 2 * 180 / Math.PI - 90;
    const rotate = (angle > 90 && angle < 270) ? angle + 180 : angle;
    return `translate(${pos}) rotate(${rotate})`;
  })
  .text(d => d.data.decendio);

// ============================================================
// SECTION 5: CALENDAR UPDATE FUNCTION
// ============================================================

function updateChart(municipioName, stateName) {
  const padrao  = getPadrao(municipioName);
  const data    = gerarDados(municipioName, padrao);
  const pieData = pie(data);

  // Hide placeholder text on first hover
  centerPlaceholder.style("display", "none");

  // Transition arc fill colors only — geometry never changes
  svg.selectAll(".arc-path")
    .data(pieData, d => d.data.decendio)
    .transition()
    .duration(400)
    .ease(d3.easeCubicOut)
    .attr("fill", d => color(d.data.risco));

  // Update center text
  centerText.text(municipioName);
  centerTextState.text(stateName ? `— ${stateName}` : "");

  // Update header label
  d3.select("#hover-label")
    .text(`${municipioName}${stateName ? " — " + stateName : ""}`)
    .classed("active", true);
}

// ============================================================
// SECTION 6: LINE CHART
// ============================================================

const LC_W = 420;
const LC_H = 168;
const LC_M = { top: 18, right: 8, bottom: 38, left: 58 };
const lcInnerW = LC_W - LC_M.left - LC_M.right;
const lcInnerH = LC_H - LC_M.top - LC_M.bottom;

const lineColors = { p50: '#1f77b4', p60: '#2ca02c', p70: '#ff7f0e', p80: '#d62728' };
const lineKeys = ['p50', 'p60', 'p70', 'p80'];

// Wrap: SVG on top, HTML legend on bottom (one row)
const lcWrapper = d3.select("#linechart-panel")
  .style("display", "flex")
  .style("flex-direction", "column")
  .style("align-items", "stretch")
  .style("width", "100%")
  .style("padding", "10px 10px 6px 0");

const lcSvg = lcWrapper
  .append("svg")
  .attr("viewBox", `0 0 ${LC_W} ${LC_H}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("display", "block");

const lcLegendDiv = lcWrapper
  .append("div")
  .style("flex-shrink", "0")
  .style("display", "flex")
  .style("flex-direction", "row")
  .style("justify-content", "center")
  .style("align-items", "center")
  .style("gap", "24px")
  .style("padding", "5px 0 2px")
  .style("font-size", "13px")
  .style("font-family", "Arial, sans-serif");

lineKeys.forEach(key => {
  const item = lcLegendDiv.append("div")
    .style("display", "flex")
    .style("align-items", "center")
    .style("gap", "7px");
  item.append("div")
    .style("width", "22px").style("height", "3px")
    .style("background", lineColors[key])
    .style("flex-shrink", "0");
  item.append("span")
    .style("color", "#333")
    .text(key);
});

lcSvg.append("text")
  .attr("x", LC_W / 2).attr("y", 9)
  .attr("text-anchor", "middle")
  .attr("font-size", 11).attr("font-weight", "bold").attr("fill", "#444")
  .text("Distribuição de probabilidade por decêndio");

const lcG = lcSvg.append("g")
  .attr("transform", `translate(${LC_M.left},${LC_M.top})`);

// Placeholder text
const lcPlaceholder = lcSvg.append("text")
  .attr("x", LC_W / 2)
  .attr("y", LC_H / 2)
  .attr("text-anchor", "middle")
  .attr("dominant-baseline", "middle")
  .attr("font-size", 11)
  .attr("fill", "#aaa")
  .attr("font-style", "italic")
  .text("\u2190 passe o mouse sobre um município");

// X scale: decendio index 1..36
const lcXScale = d3.scaleLinear()
  .domain([1, 36])
  .range([0, lcInnerW]);

// X axis with month labels at decendio starts
const monthTickValues = [1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34];
const lcXAxisG = lcG.append("g")
  .attr("transform", `translate(0,${lcInnerH})`);

lcXAxisG.call(
  d3.axisBottom(lcXScale)
    .tickValues(monthTickValues)
    .tickFormat(d => meses[Math.floor((d - 1) / 3)].substring(0, 3))
);

// Y scale (domain set dynamically)
const lcYScale = d3.scaleLinear()
  .range([lcInnerH, 0]);

const lcGridG = lcG.append("g").attr("class", "lc-grid");
const lcYAxisG = lcG.append("g");

lcYAxisG.call(
  d3.axisLeft(lcYScale)
    .ticks(4)
    .tickFormat(d3.format(".3~s"))
);

// Y axis label
lcG.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -lcInnerH / 2)
  .attr("y", -46)
  .attr("text-anchor", "middle")
  .attr("font-size", 11)
  .attr("fill", "#555")
  .text("kg/ha");

// Line paths (one per key)
const lcLineFns = {};
const lcPaths = {};

lineKeys.forEach(key => {
  lcLineFns[key] = d3.line()
    .x(d => lcXScale(d.decendio))
    .y(d => lcYScale(d[key]))
    .defined(d => d[key] != null && !isNaN(d[key]));

  lcPaths[key] = lcG.append("path")
    .attr("fill", "none")
    .attr("stroke", lineColors[key])
    .attr("stroke-width", 2);
});


let lcData = null;

function renderLineChart(rows) {
  // Map rows to {decendio, p50, p60, p70, p80} using array index
  const data = rows.map((row, i) => ({
    decendio: i + 1,
    p50: Number(row.p50),
    p60: Number(row.p60),
    p70: Number(row.p70),
    p80: Number(row.p80)
  }));

  // Update y domain from all values
  const allVals = data.flatMap(d => lineKeys.map(k => d[k])).filter(v => !isNaN(v));
  const [, yMax] = d3.extent(allVals);
  lcYScale.domain([0, yMax * 1.05]);

  lcGridG.call(
    d3.axisLeft(lcYScale)
      .ticks(4)
      .tickSize(-lcInnerW)
      .tickFormat("")
  ).call(g => {
    g.select(".domain").remove();
    g.selectAll(".tick line")
      .attr("stroke", "#ffffff")
      .attr("stroke-width", 0.7)
      .attr("stroke-opacity", 0.8);
  });

  lcYAxisG.transition().duration(300).call(
    d3.axisLeft(lcYScale)
      .ticks(4)
      .tickFormat(d3.format(".3~s"))
  );

  // Update paths
  lineKeys.forEach(key => {
    lcPaths[key]
      .datum(data)
      .transition()
      .duration(300)
      .attr("d", lcLineFns[key]);
  });

  lcData = data;
  lcPlaceholder.style("display", "none");
}

// Debounce helper
function debounce(fn, ms) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn.apply(this, args), ms);
  };
}

const updateLineChart = debounce(async function(geocodigo) {
  if (!conn) return;
  const cultura = document.getElementById('sel-cultura').value;
  const cenario = document.getElementById('sel-cenario').value;
  try {
    const result = await conn.query(`
      SELECT p50, p60, p70, p80
      FROM culturas
      WHERE cultura = '${cultura}' AND cenario = '${cenario}' AND geocodigo = '${geocodigo}'
      ORDER BY SowingDay
    `);
    const rows = result.toArray();
    if (rows.length > 0) {
      renderLineChart(rows);
    } else {
      resetLineChart();
    }
  } catch (e) {
    console.warn('Line chart query error:', e);
  }
}, 80);

function resetLineChart() {
  lcData = null;
  lcPlaceholder.style("display", null);
  lineKeys.forEach(key => {
    lcPaths[key].attr("d", null);
  });
}

// Linechart tooltip
const lcTooltip = d3.select("body").append("div")
  .style("position", "fixed").style("pointer-events", "none")
  .style("background", "rgba(255,255,255,0.95)").style("border", "1px solid #cce0f0")
  .style("border-radius", "4px").style("padding", "5px 9px")
  .style("font-size", "12px").style("font-family", "Arial, sans-serif")
  .style("color", "#1a3a5c").style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
  .style("display", "none").style("line-height", "1.6");

const lcHairline = lcG.append("line")
  .attr("y1", 0).attr("y2", lcInnerH)
  .attr("stroke", "#888").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
  .style("display", "none");

const lcDots = {};
lineKeys.forEach(key => {
  lcDots[key] = lcG.append("circle")
    .attr("r", 4).attr("fill", lineColors[key]).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .style("display", "none");
});

lcG.append("rect")
  .attr("width", lcInnerW).attr("height", lcInnerH)
  .attr("fill", "none").attr("pointer-events", "all")
  .on("mousemove", function(event) {
    if (!lcData) return;
    const [mx] = d3.pointer(event);
    const dec = Math.round(lcXScale.invert(mx));
    const clamped = Math.max(1, Math.min(36, dec));
    const d = lcData[clamped - 1];
    if (!d) return;

    const cx = lcXScale(d.decendio);
    lcHairline.attr("x1", cx).attr("x2", cx).style("display", null);
    lineKeys.forEach(key => {
      if (d[key] != null && !isNaN(d[key])) {
        lcDots[key].attr("cx", cx).attr("cy", lcYScale(d[key])).style("display", null);
      }
    });

    const fmt = d3.format(".3~s");
    lcTooltip
      .style("display", "block")
      .style("left", (event.clientX + 14) + "px")
      .style("top",  (event.clientY - 36) + "px")
      .html(`<strong>Decêndio ${d.decendio}</strong><br>` +
        lineKeys.map(k => `<span style="color:${lineColors[k]}">■</span> ${k}: ${fmt(d[k])}`).join("<br>"));
  })
  .on("mouseleave", () => {
    lcHairline.style("display", "none");
    lineKeys.forEach(key => lcDots[key].style("display", "none"));
    lcTooltip.style("display", "none");
  });

// ============================================================
// SECTION 6b: CENARIO COMPARISON CHART (p80 only)
// ============================================================

const CC_W = 420, CC_H = 168;
const CC_M = { top: 18, right: 8, bottom: 38, left: 58 };
const ccInnerW = CC_W - CC_M.left - CC_M.right;
const ccInnerH = CC_H - CC_M.top - CC_M.bottom;

const ccColors = { historical: '#2166ac', ssp585_gwl_3: '#d73027' };
const ccLabels = { historical: 'Histórico', ssp585_gwl_3: 'SSP5-8.5 GWL3' };
const ccKeys   = ['historical', 'ssp585_gwl_3'];

const ccWrapper = d3.select("#comparechart-panel")
  .style("display", "flex")
  .style("flex-direction", "column")
  .style("align-items", "stretch")
  .style("width", "100%")
  .style("padding", "10px 10px 6px 0");

const ccSvg = ccWrapper
  .append("svg")
  .attr("viewBox", `0 0 ${CC_W} ${CC_H}`)
  .attr("preserveAspectRatio", "xMidYMid meet")
  .style("width", "100%")
  .style("display", "block");

const ccLegendDiv = ccWrapper
  .append("div")
  .style("flex-shrink", "0")
  .style("display", "flex")
  .style("flex-direction", "row")
  .style("justify-content", "center")
  .style("align-items", "center")
  .style("gap", "24px")
  .style("padding", "5px 0 2px")
  .style("font-size", "13px")
  .style("font-family", "Arial, sans-serif");

ccKeys.forEach(key => {
  const item = ccLegendDiv.append("div")
    .style("display", "flex").style("align-items", "center").style("gap", "7px");
  item.append("div")
    .style("width", "22px").style("height", "3px")
    .style("background", ccColors[key]).style("flex-shrink", "0");
  item.append("span").style("color", "#333").text(ccLabels[key]);
});

ccSvg.append("text")
  .attr("x", CC_W / 2).attr("y", 9)
  .attr("text-anchor", "middle")
  .attr("font-size", 11).attr("font-weight", "bold").attr("fill", "#444")
  .text("Comparação de cenários · p80 por decêndio");

const ccG = ccSvg.append("g").attr("transform", `translate(${CC_M.left},${CC_M.top})`);

const ccPlaceholder = ccSvg.append("text")
  .attr("x", CC_W / 2).attr("y", CC_H / 2)
  .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
  .attr("font-size", 11).attr("fill", "#aaa").attr("font-style", "italic")
  .text("\u2190 passe o mouse sobre um município");

const ccXScale = d3.scaleLinear().domain([1, 36]).range([0, ccInnerW]);

ccG.append("g")
  .attr("transform", `translate(0,${ccInnerH})`)
  .call(
    d3.axisBottom(ccXScale)
      .tickValues([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34])
      .tickFormat(d => meses[Math.floor((d - 1) / 3)].substring(0, 3))
  );

const ccYScale = d3.scaleLinear().range([ccInnerH, 0]);
const ccGridG  = ccG.append("g");
const ccYAxisG = ccG.append("g");

ccYAxisG.call(d3.axisLeft(ccYScale).ticks(4).tickFormat(d3.format(".3~s")));

ccG.append("text")
  .attr("transform", "rotate(-90)")
  .attr("x", -ccInnerH / 2).attr("y", -46)
  .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555")
  .text("p80 (kg/ha)");

const ccLineFns = {}, ccPaths = {};
ccKeys.forEach(key => {
  ccLineFns[key] = d3.line()
    .x(d => ccXScale(d.decendio))
    .y(d => ccYScale(d.p80))
    .defined(d => d.p80 != null && !isNaN(d.p80));
  ccPaths[key] = ccG.append("path")
    .attr("fill", "none")
    .attr("stroke", ccColors[key])
    .attr("stroke-width", 2);
});

function renderCompareChart(rows) {
  // Pivot: group rows by cenario, index by order (decendio = index+1)
  const byKey = {};
  ccKeys.forEach(k => { byKey[k] = []; });
  ccKeys.forEach(key => {
    rows.filter(r => r.cenario === key)
        .forEach((r, i) => byKey[key].push({ decendio: i + 1, p80: Number(r.p80) }));
  });

  const allVals = Object.values(byKey).flat().map(d => d.p80).filter(v => !isNaN(v));
  const [, yMax] = d3.extent(allVals);
  ccYScale.domain([0, yMax * 1.05]);

  ccGridG.call(
    d3.axisLeft(ccYScale).ticks(4).tickSize(-ccInnerW).tickFormat("")
  ).call(g => {
    g.select(".domain").remove();
    g.selectAll(".tick line")
      .attr("stroke", "#ffffff").attr("stroke-width", 0.7).attr("stroke-opacity", 0.8);
  });

  ccYAxisG.transition().duration(300)
    .call(d3.axisLeft(ccYScale).ticks(4).tickFormat(d3.format(".3~s")));

  ccKeys.forEach(key => {
    ccPaths[key].datum(byKey[key]).transition().duration(300).attr("d", ccLineFns[key]);
  });

  ccData = byKey;
  ccPlaceholder.style("display", "none");
}

let ccData = null;

function resetCompareChart() {
  ccData = null;
  ccPlaceholder.style("display", null);
  ccKeys.forEach(key => ccPaths[key].attr("d", null));
}

// Comparechart tooltip
const ccTooltip = d3.select("body").append("div")
  .style("position", "fixed").style("pointer-events", "none")
  .style("background", "rgba(255,255,255,0.95)").style("border", "1px solid #cce0f0")
  .style("border-radius", "4px").style("padding", "5px 9px")
  .style("font-size", "12px").style("font-family", "Arial, sans-serif")
  .style("color", "#1a3a5c").style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
  .style("display", "none").style("line-height", "1.6");

const ccHairline = ccG.append("line")
  .attr("y1", 0).attr("y2", ccInnerH)
  .attr("stroke", "#888").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
  .style("display", "none");

const ccDots = {};
ccKeys.forEach(key => {
  ccDots[key] = ccG.append("circle")
    .attr("r", 4).attr("fill", ccColors[key]).attr("stroke", "#fff").attr("stroke-width", 1.5)
    .style("display", "none");
});

ccG.append("rect")
  .attr("width", ccInnerW).attr("height", ccInnerH)
  .attr("fill", "none").attr("pointer-events", "all")
  .on("mousemove", function(event) {
    if (!ccData) return;
    const [mx] = d3.pointer(event);
    const dec = Math.round(ccXScale.invert(mx));
    const clamped = Math.max(1, Math.min(36, dec));
    const cx = ccXScale(clamped);
    ccHairline.attr("x1", cx).attr("x2", cx).style("display", null);

    const fmt = d3.format(".3~s");
    const lines = ccKeys.map(key => {
      const d = ccData[key][clamped - 1];
      if (d && !isNaN(d.p80)) {
        ccDots[key].attr("cx", cx).attr("cy", ccYScale(d.p80)).style("display", null);
        return `<span style="color:${ccColors[key]}">■</span> ${ccLabels[key]}: ${fmt(d.p80)}`;
      }
      return null;
    }).filter(Boolean);

    ccTooltip
      .style("display", "block")
      .style("left", (event.clientX + 14) + "px")
      .style("top",  (event.clientY - 36) + "px")
      .html(`<strong>Decêndio ${clamped}</strong><br>` + lines.join("<br>"));
  })
  .on("mouseleave", () => {
    ccHairline.style("display", "none");
    ccKeys.forEach(key => ccDots[key].style("display", "none"));
    ccTooltip.style("display", "none");
  });

const updateCompareChart = debounce(async function(geocodigo) {
  if (!conn) return;
  const cultura = document.getElementById('sel-cultura').value;
  try {
    const result = await conn.query(`
      SELECT SowingDay, cenario, p80
      FROM culturas
      WHERE cultura = '${cultura}' AND geocodigo = '${geocodigo}'
      ORDER BY cenario, SowingDay
    `);
    const rows = result.toArray();
    rows.length > 0 ? renderCompareChart(rows) : resetCompareChart();
  } catch (e) {
    console.warn('Compare chart query error:', e);
  }
}, 80);

// ============================================================
// SECTION 6c: MEDIA VARIABLE COMPARISON CHARTS (factory)
// ============================================================

const mediaChartConfigs = [
  { panelId: 'mediabio-panel',  column: 'media_Biomass', title: 'Biomassa média por decêndio',      yLabel: 'kg/ha' },
  { panelId: 'mediarain-panel', column: 'media_RAINc',   title: 'Precipitação média por decêndio',  yLabel: 'mm'    },
  { panelId: 'mediatmax-panel', column: 'media_TMAXm',   title: 'Temp. máxima média por decêndio',  yLabel: '°C'    },
  { panelId: 'mediatmin-panel', column: 'media_TMINm',   title: 'Temp. mínima média por decêndio',  yLabel: '°C'    },
  { panelId: 'mediaisna-panel', column: 'media_ISNAm',   title: 'ISNA médio por decêndio',          yLabel: 'ISNA'  },
];

// Shared tooltip for all media charts
const mediaTooltip = d3.select("body").append("div")
  .style("position", "fixed").style("pointer-events", "none")
  .style("background", "rgba(255,255,255,0.95)").style("border", "1px solid #cce0f0")
  .style("border-radius", "4px").style("padding", "5px 9px")
  .style("font-size", "12px").style("font-family", "Arial, sans-serif")
  .style("color", "#1a3a5c").style("box-shadow", "0 2px 6px rgba(0,0,0,0.15)")
  .style("display", "none").style("line-height", "1.6");

function makeMediaChart(cfg) {
  const wrapper = d3.select(`#${cfg.panelId}`)
    .style("display", "flex")
    .style("flex-direction", "column")
    .style("align-items", "stretch")
    .style("width", "100%")
    .style("padding", "10px 10px 6px 0");

  const svg = wrapper
    .append("svg")
    .attr("viewBox", `0 0 ${CC_W} ${CC_H}`)
    .attr("preserveAspectRatio", "xMidYMid meet")
    .style("width", "100%")
    .style("display", "block");

  const legendDiv = wrapper
    .append("div")
    .style("flex-shrink", "0")
    .style("display", "flex")
    .style("flex-direction", "row")
    .style("justify-content", "center")
    .style("align-items", "center")
    .style("gap", "24px")
    .style("padding", "5px 0 2px")
    .style("font-size", "13px")
    .style("font-family", "Arial, sans-serif");

  ccKeys.forEach(key => {
    const item = legendDiv.append("div")
      .style("display", "flex").style("align-items", "center").style("gap", "7px");
    item.append("div")
      .style("width", "22px").style("height", "3px")
      .style("background", ccColors[key]).style("flex-shrink", "0");
    item.append("span").style("color", "#333").text(ccLabels[key]);
  });

  svg.append("text")
    .attr("x", CC_W / 2).attr("y", 9)
    .attr("text-anchor", "middle")
    .attr("font-size", 11).attr("font-weight", "bold").attr("fill", "#444")
    .text(cfg.title);

  const g = svg.append("g").attr("transform", `translate(${CC_M.left},${CC_M.top})`);

  const placeholder = svg.append("text")
    .attr("x", CC_W / 2).attr("y", CC_H / 2)
    .attr("text-anchor", "middle").attr("dominant-baseline", "middle")
    .attr("font-size", 11).attr("fill", "#aaa").attr("font-style", "italic")
    .text("\u2190 passe o mouse sobre um município");

  const xScale = d3.scaleLinear().domain([1, 36]).range([0, ccInnerW]);
  g.append("g")
    .attr("transform", `translate(0,${ccInnerH})`)
    .call(
      d3.axisBottom(xScale)
        .tickValues([1, 4, 7, 10, 13, 16, 19, 22, 25, 28, 31, 34])
        .tickFormat(d => meses[Math.floor((d - 1) / 3)].substring(0, 3))
    );

  const yScale = d3.scaleLinear().range([ccInnerH, 0]);
  const gridG  = g.append("g");
  const yAxisG = g.append("g");
  yAxisG.call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format(".3~s")));

  g.append("text")
    .attr("transform", "rotate(-90)")
    .attr("x", -ccInnerH / 2).attr("y", -46)
    .attr("text-anchor", "middle").attr("font-size", 11).attr("fill", "#555")
    .text(cfg.yLabel);

  const lineFns = {}, paths = {};
  ccKeys.forEach(key => {
    lineFns[key] = d3.line()
      .x(d => xScale(d.decendio))
      .y(d => yScale(d.val))
      .defined(d => d.val != null && !isNaN(d.val));
    paths[key] = g.append("path")
      .attr("fill", "none")
      .attr("stroke", ccColors[key])
      .attr("stroke-width", 2);
  });

  // Tooltip elements
  const hairline = g.append("line")
    .attr("y1", 0).attr("y2", ccInnerH)
    .attr("stroke", "#888").attr("stroke-width", 1).attr("stroke-dasharray", "3,2")
    .style("display", "none");
  const dots = {};
  ccKeys.forEach(key => {
    dots[key] = g.append("circle")
      .attr("r", 4).attr("fill", ccColors[key]).attr("stroke", "#fff").attr("stroke-width", 1.5)
      .style("display", "none");
  });

  let chartData = null;

  g.append("rect")
    .attr("width", ccInnerW).attr("height", ccInnerH)
    .attr("fill", "none").attr("pointer-events", "all")
    .on("mousemove", function(event) {
      if (!chartData) return;
      const [mx] = d3.pointer(event);
      const dec = Math.round(xScale.invert(mx));
      const clamped = Math.max(1, Math.min(36, dec));
      const cx = xScale(clamped);
      hairline.attr("x1", cx).attr("x2", cx).style("display", null);

      const fmt = d3.format(".3~s");
      const lines = ccKeys.map(key => {
        const d = chartData[key][clamped - 1];
        if (d && !isNaN(d.val)) {
          dots[key].attr("cx", cx).attr("cy", yScale(d.val)).style("display", null);
          return `<span style="color:${ccColors[key]}">■</span> ${ccLabels[key]}: ${fmt(d.val)}`;
        }
        return null;
      }).filter(Boolean);

      mediaTooltip
        .style("display", "block")
        .style("left", (event.clientX + 14) + "px")
        .style("top",  (event.clientY - 36) + "px")
        .html(`<strong>Decêndio ${clamped}</strong><br>` + lines.join("<br>"));
    })
    .on("mouseleave", () => {
      hairline.style("display", "none");
      ccKeys.forEach(key => dots[key].style("display", "none"));
      mediaTooltip.style("display", "none");
    });

  function render(rows) {
    const byKey = {};
    ccKeys.forEach(k => { byKey[k] = []; });
    ccKeys.forEach(key => {
      rows.filter(r => r.cenario === key)
          .forEach((r, i) => byKey[key].push({ decendio: i + 1, val: Number(r.val) }));
    });

    const allVals = Object.values(byKey).flat().map(d => d.val).filter(v => !isNaN(v));
    const [, yMax] = d3.extent(allVals);
    yScale.domain([0, (yMax || 1) * 1.05]);

    gridG.call(
      d3.axisLeft(yScale).ticks(4).tickSize(-ccInnerW).tickFormat("")
    ).call(gg => {
      gg.select(".domain").remove();
      gg.selectAll(".tick line")
        .attr("stroke", "#ffffff").attr("stroke-width", 0.7).attr("stroke-opacity", 0.8);
    });

    yAxisG.transition().duration(300)
      .call(d3.axisLeft(yScale).ticks(4).tickFormat(d3.format(".3~s")));

    ccKeys.forEach(key => {
      paths[key].datum(byKey[key]).transition().duration(300).attr("d", lineFns[key]);
    });

    chartData = byKey;
    placeholder.style("display", "none");
  }

  function reset() {
    chartData = null;
    placeholder.style("display", null);
    ccKeys.forEach(key => paths[key].attr("d", null));
  }

  const update = debounce(async function(geocodigo) {
    if (!conn) return;
    const cultura = document.getElementById('sel-cultura').value;
    try {
      const result = await conn.query(`
        SELECT SowingDay, cenario, "${cfg.column}" AS val
        FROM culturas
        WHERE cultura = '${cultura}' AND geocodigo = '${geocodigo}'
        ORDER BY cenario, SowingDay
      `);
      const rows = result.toArray();
      rows.length > 0 ? render(rows) : reset();
    } catch (e) {
      console.warn(`Media chart query error (${cfg.column}):`, e);
    }
  }, 80);

  return { update, reset };
}

const mediaChartInstances = mediaChartConfigs.map(makeMediaChart);

// ============================================================
// SECTION 7: MAPLIBRE GL + PMTILES MAP
// ============================================================

// Register PMTiles protocol so MapLibre understands pmtiles:// URLs
const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

const map = new maplibregl.Map({
  container: 'map-panel',
  style: {
    version: 8,
    sources: {
      'carto-light': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/light_all/{z}/{x}/{y}.png'
        ],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>'
      },
      municipios: {
        type: 'vector',
        url: 'pmtiles://./GEO/municipios.pmtiles',
        promoteId: 'code_muni'
      },
      estados: {
        type: 'vector',
        url: 'pmtiles://./GEO/ufs.pmtiles'
      }
    },
    layers: [
      // Fallback background (shows while tiles load)
      {
        id: 'background',
        type: 'background',
        paint: { 'background-color': '#d4e8f7' }
      },
      // Carto Positron basemap
      {
        id: 'carto-light',
        type: 'raster',
        source: 'carto-light'
      },
      // Municipality fill — plain color; choropleth overrides after data loads
      {
        id: 'municipios-fill',
        type: 'fill',
        source: 'municipios',
        'source-layer': 'mun',
        paint: {
          'fill-color': '#7ab8d4',
          'fill-opacity': 0.78
        }
      },
      // Municipality borders (thin white)
      {
        id: 'municipios-outline',
        type: 'line',
        source: 'municipios',
        'source-layer': 'mun',
        paint: {
          'line-color': '#ffffff',
          'line-width': 0.3
        }
      },
      // Selected municipality highlight fill (yellow)
      {
        id: 'municipios-selected-fill',
        type: 'fill',
        source: 'municipios',
        'source-layer': 'mun',
        paint: {
          'fill-color': '#ffe600',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.55, 0]
        }
      },
      // Selected municipality highlight stroke (yellow)
      {
        id: 'municipios-selected-stroke',
        type: 'line',
        source: 'municipios',
        'source-layer': 'mun',
        paint: {
          'line-color': '#ffe600',
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0]
        }
      },
      // State borders from clean ufs.gpkg
      {
        id: 'estados-outline',
        type: 'line',
        source: 'estados',
        'source-layer': 'ufs',
        paint: {
          'line-color': '#334',
          'line-width': [
            'interpolate', ['linear'], ['zoom'],
            3, 1,
            8, 2
          ]
        }
      }
    ]
  },
  bounds: [[-74, -34], [-28, 6]],
  fitBoundsOptions: { padding: 15 },
  attributionControl: false
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-left');

const popup = new maplibregl.Popup({
  closeButton: false,
  closeOnClick: false,
  offset: 12
});

// Hover + selection state
let hoveredId = null;
let selectedId = null;
let selectedGeocodigo = null;

function clearSelection() {
  if (selectedId !== null) {
    map.setFeatureState(
      { source: 'municipios', sourceLayer: 'mun', id: selectedId },
      { selected: false }
    );
    selectedId = null;
    selectedGeocodigo = null;
  }
}

map.on('mousemove', 'municipios-fill', (e) => {
  if (e.features.length === 0) return;

  if (hoveredId !== null) {
    map.setFeatureState(
      { source: 'municipios', sourceLayer: 'mun', id: hoveredId },
      { hover: false }
    );
  }

  hoveredId = e.features[0].id;

  map.setFeatureState(
    { source: 'municipios', sourceLayer: 'mun', id: hoveredId },
    { hover: true }
  );

  map.getCanvas().style.cursor = 'pointer';

  const { name_muni, abbrev_state, code_muni } = e.features[0].properties;

  popup
    .setLngLat(e.lngLat)
    .setHTML(`<strong>${name_muni}</strong><br><span>${abbrev_state}</span>`)
    .addTo(map);

  // Only drive charts from hover when nothing is pinned
  if (selectedId === null) {
    updateChart(name_muni, abbrev_state);
    updateLineChart(String(code_muni));
    updateCompareChart(String(code_muni));
    mediaChartInstances.forEach(c => c.update(String(code_muni)));
  }
});

map.on('mouseleave', 'municipios-fill', () => {
  if (hoveredId !== null) {
    map.setFeatureState(
      { source: 'municipios', sourceLayer: 'mun', id: hoveredId },
      { hover: false }
    );
  }
  hoveredId = null;
  map.getCanvas().style.cursor = '';
  popup.remove();
  // Only reset charts if nothing is pinned
  if (selectedId === null) {
    resetLineChart();
    resetCompareChart();
    mediaChartInstances.forEach(c => c.reset());
  }
});

map.on('click', 'municipios-fill', (e) => {
  if (e.features.length === 0) return;
  const feat = e.features[0];
  const clickedId = feat.id;

  if (selectedId === clickedId) {
    // clicking same municipality deselects
    clearSelection();
    resetLineChart();
    resetCompareChart();
    mediaChartInstances.forEach(c => c.reset());
  } else {
    clearSelection();
    selectedId = clickedId;
    map.setFeatureState(
      { source: 'municipios', sourceLayer: 'mun', id: selectedId },
      { selected: true }
    );
    const { name_muni, abbrev_state, code_muni } = feat.properties;
    selectedGeocodigo = String(code_muni);
    updateChart(name_muni, abbrev_state);
    updateLineChart(String(code_muni));
    updateCompareChart(String(code_muni));
    mediaChartInstances.forEach(c => c.update(String(code_muni)));
  }
});

// Click outside municipalities deselects
map.on('click', (e) => {
  const features = map.queryRenderedFeatures(e.point, { layers: ['municipios-fill'] });
  if (features.length === 0) {
    clearSelection();
    resetLineChart();
    resetCompareChart();
    mediaChartInstances.forEach(c => c.reset());
  }
});

// ============================================================
// SECTION 8: CHOROPLETH
// ============================================================

let colorScale = null;

async function updateChoropleth() {
  if (!conn) return;
  const cultura = document.getElementById('sel-cultura').value;
  const cenario = document.getElementById('sel-cenario').value;
  const result = await conn.query(`
    SELECT geocodigo, MAX(p80) AS maxP80
    FROM culturas
    WHERE cultura = '${cultura}' AND cenario = '${cenario}'
    GROUP BY geocodigo
  `);
  const rows = result.toArray();
  const values = rows.map(r => Number(r.maxP80));
  const [vMin, vMax] = d3.extent(values);
  colorScale = d3.scaleSequential(d3.interpolateRdYlGn).domain([vMin, vMax]);

  const matchExpr = ['match', ['get', 'code_muni']];
  for (const row of rows) {
    matchExpr.push(parseInt(String(row.geocodigo).trim()));
    matchExpr.push(colorScale(Number(row.maxP80)));
  }
  matchExpr.push('#aaaaaa');

  map.setPaintProperty('municipios-fill', 'fill-color', matchExpr);
  map.setPaintProperty('municipios-fill', 'fill-opacity', 0.85);
  updateChoroLegend(vMin, vMax);
}

function updateChoroLegend(vMin, vMax) {
  const container = document.getElementById('choro-legend');
  container.innerHTML = '';
  const W = 160, H = 14;
  const svg = d3.select(container).append('svg').attr('width', W + 20).attr('height', H + 34);
  const gradId = 'choro-gradient';
  const defs = svg.append('defs');
  const grad = defs.append('linearGradient').attr('id', gradId);
  for (let i = 0; i <= 10; i++) {
    grad.append('stop')
      .attr('offset', `${i * 10}%`)
      .attr('stop-color', colorScale(vMin + (vMax - vMin) * i / 10));
  }
  svg.append('rect')
    .attr('x', 10).attr('y', 0)
    .attr('width', W).attr('height', H)
    .attr('fill', `url(#${gradId})`)
    .attr('rx', 2);
  svg.append('text')
    .attr('x', 10).attr('y', H + 12)
    .attr('font-size', 10)
    .text(`${(vMin / 1000).toFixed(0)}k`);
  svg.append('text')
    .attr('x', 10 + W / 2).attr('y', H + 12)
    .attr('font-size', 10).attr('text-anchor', 'middle')
    .text('p80 máx (kg/ha)');
  svg.append('text')
    .attr('x', 10 + W).attr('y', H + 12)
    .attr('font-size', 10).attr('text-anchor', 'end')
    .text(`${(vMax / 1000).toFixed(0)}k`);
  svg.append('text')
    .attr('x', 10).attr('y', H + 24)
    .attr('font-size', 9).attr('fill', '#888')
    .text('\u2191 Menor');
  svg.append('text')
    .attr('x', 10 + W).attr('y', H + 24)
    .attr('font-size', 9).attr('fill', '#888').attr('text-anchor', 'end')
    .text('Maior \u2191');
}

// ============================================================
// SECTION 9: INITIALIZATION
// ============================================================

const cenarioLabels = {
  'historical': 'Histórico',
  'ssp585_gwl_3': 'SSP5-8.5 GWL3'
};

function populateSelect(id, values, labelFn) {
  const sel = document.getElementById(id);
  sel.innerHTML = '';
  values.forEach(v => {
    const opt = document.createElement('option');
    opt.value = v;
    opt.textContent = labelFn ? labelFn(v) : v;
    sel.appendChild(opt);
  });
}

map.on('load', async () => {
  const overlay = document.getElementById('loading-overlay');
  const loadingMsg = document.getElementById('loading-msg');
  overlay.style.display = 'flex';

  try {
    loadingMsg.textContent = 'Carregando dados (15 MB)...';
    await initDuckDB();

    // Query distinct culturas and cenarios
    const culturaResult = await conn.query("SELECT DISTINCT cultura FROM culturas ORDER BY cultura");
    const culturas = culturaResult.toArray().map(r => String(r.cultura));

    const cenarioResult = await conn.query("SELECT DISTINCT cenario FROM culturas ORDER BY cenario");
    const cenarios = cenarioResult.toArray().map(r => String(r.cenario));

    // Populate selects
    populateSelect('sel-cultura', culturas, null);
    populateSelect('sel-cenario', cenarios, v => cenarioLabels[v] || v);

    // Add change listeners
    document.getElementById('sel-cultura').addEventListener('change', updateChoropleth);
    document.getElementById('sel-cenario').addEventListener('change', updateChoropleth);

    // Initial choropleth
    loadingMsg.textContent = 'Calculando mapa...';
    await updateChoropleth();

    // Hide overlay
    overlay.style.display = 'none';
  } catch (err) {
    console.error('Initialization error:', err);
    loadingMsg.textContent = `Erro: ${err.message}`;
    // Keep overlay visible to show error
  }
});


