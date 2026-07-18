// Mapa MapLibre + PMTiles, choropleth genérico, hover/click.
// Adaptado do protótipo Legacy (seções 7-8 do script.js).

const protocol = new pmtiles.Protocol();
maplibregl.addProtocol('pmtiles', protocol.tile.bind(protocol));

export const map = new maplibregl.Map({
  container: 'map-panel',
  style: {
    version: 8,
    sources: {
      'carto-dark': {
        type: 'raster',
        tiles: [
          'https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
          'https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png',
        ],
        tileSize: 256,
        attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> © <a href="https://carto.com/">CARTO</a>',
      },
      municipios: {
        type: 'vector',
        url: 'pmtiles://./geo/municipios.pmtiles',
        promoteId: 'code_muni',
      },
      estados: {
        type: 'vector',
        url: 'pmtiles://./geo/ufs.pmtiles',
      },
    },
    layers: [
      { id: 'background', type: 'background', paint: { 'background-color': '#0d1117' } },
      { id: 'carto-dark', type: 'raster', source: 'carto-dark' },
      {
        id: 'municipios-fill', type: 'fill', source: 'municipios', 'source-layer': 'mun',
        paint: { 'fill-color': '#cccccc', 'fill-opacity': 0.85 },
      },
      // bordas municipais somem no zoom Brasil-inteiro para nao engolir a cor
      {
        id: 'municipios-outline', type: 'line', source: 'municipios', 'source-layer': 'mun',
        paint: {
          'line-color': 'rgba(0,0,0,0.5)',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0, 5, 0.15, 7, 0.5, 10, 1],
        },
      },
      {
        id: 'municipios-selected-fill', type: 'fill', source: 'municipios', 'source-layer': 'mun',
        paint: {
          'fill-color': '#ffe600',
          'fill-opacity': ['case', ['boolean', ['feature-state', 'selected'], false], 0.55, 0],
        },
      },
      {
        id: 'municipios-selected-stroke', type: 'line', source: 'municipios', 'source-layer': 'mun',
        paint: {
          'line-color': '#8a7a00',
          'line-width': ['case', ['boolean', ['feature-state', 'selected'], false], 2.5, 0],
        },
      },
      {
        id: 'estados-outline', type: 'line', source: 'estados', 'source-layer': 'ufs',
        paint: {
          'line-color': '#8b98a8',
          'line-width': ['interpolate', ['linear'], ['zoom'], 3, 0.6, 8, 1.5],
        },
      },
    ],
  },
  bounds: [[-74, -34], [-28, 6]],
  fitBoundsOptions: { padding: 15 },
  attributionControl: false,
});

map.addControl(new maplibregl.NavigationControl({ showCompass: false }), 'top-right');
map.addControl(new maplibregl.AttributionControl({ compact: true }));

// atribuição começa fechada (só o "i"; expande no clique)
map.on('load', () => {
  const attrib = document.querySelector('.maplibregl-ctrl-attrib');
  if (attrib) {
    attrib.classList.remove('maplibregl-compact-show');
    attrib.removeAttribute('open');
  }
});

const popup = new maplibregl.Popup({ closeButton: false, closeOnClick: false, offset: 12 });

let hoveredId = null;
let selectedId = null;

// fonte ativa do choropleth: { values: Map<code,val>, label, unidade, dir }
let fonteAtiva = null;

function fmtValor(v, unidade) {
  if (v == null || Number.isNaN(v)) return 'sem dados';
  const sinal = v > 0 ? '+' : '';
  return `${sinal}${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}${unidade}`;
}

// ---------------------------------------------------------------- choropleth
// fonte = { values: Map<string codigo, number|null>, label, unidade, dir }
export function updateChoropleth(fonte) {
  fonteAtiva = fonte;
  const vals = [...fonte.values.values()].filter((v) => v != null && !Number.isNaN(v));
  if (!vals.length) return;

  // domínio simétrico robusto (percentil 95 do |valor|) — divergente centrado em 0
  const absSorted = vals.map(Math.abs).sort(d3.ascending);
  const lim = d3.quantileSorted(absSorted, 0.95) || 1;
  // BrBG: marrom = seco/pior, verde-azul = úmido/melhor; dir -1 inverte
  const escala = d3.scaleSequential(d3.interpolateBrBG).domain(
    fonte.dir === -1 ? [lim, -lim] : [-lim, lim]);

  const matchExpr = ['match', ['get', 'code_muni']];
  for (const [code, v] of fonte.values) {
    if (v == null || Number.isNaN(v)) continue;
    matchExpr.push(Number(code), escala(v));
  }
  matchExpr.push('#dddddd');
  map.setPaintProperty('municipios-fill', 'fill-color', matchExpr);
  renderLegenda(escala, lim, fonte);
}

function renderLegenda(escala, lim, fonte) {
  const el = d3.select('#choro-legend').html('');
  el.append('div').attr('class', 'legend-title').text(fonte.label);
  const w = 220, h = 12;
  const svg = el.append('svg').attr('width', w).attr('height', h + 18);
  const n = 60;
  for (let i = 0; i < n; i++) {
    svg.append('rect')
      .attr('x', (i * w) / n).attr('width', w / n + 1).attr('height', h)
      .attr('fill', escala(-lim + ((2 * lim) / (n - 1)) * i));
  }
  const x = d3.scaleLinear().domain([-lim, lim]).range([0, w]);
  for (const t of [-lim, 0, lim]) {
    svg.append('text')
      .attr('x', x(t)).attr('y', h + 14)
      .attr('text-anchor', t === -lim ? 'start' : t === lim ? 'end' : 'middle')
      .attr('class', 'legend-tick')
      .text(`${t > 0 ? '+' : ''}${Math.round(t * 10) / 10}${fonte.unidade}`);
  }
}

// ------------------------------------------------------------ hover / click
export function initInteracao(onSelect, onDeselect) {
  map.on('mousemove', 'municipios-fill', (e) => {
    if (!e.features.length) return;
    if (hoveredId !== null) {
      map.setFeatureState({ source: 'municipios', sourceLayer: 'mun', id: hoveredId }, { hover: false });
    }
    hoveredId = e.features[0].id;
    map.setFeatureState({ source: 'municipios', sourceLayer: 'mun', id: hoveredId }, { hover: true });
    map.getCanvas().style.cursor = 'pointer';

    const { name_muni, abbrev_state, code_muni } = e.features[0].properties;
    const val = fonteAtiva ? fonteAtiva.values.get(String(code_muni)) : null;
    const linha = fonteAtiva
      ? `<span>${fonteAtiva.label}:</span> <b>${fmtValor(val, fonteAtiva.unidade)}</b>`
      : '';
    popup.setLngLat(e.lngLat)
      .setHTML(`<strong>${name_muni} · ${abbrev_state}</strong><br>${linha}`)
      .addTo(map);
  });

  map.on('mouseleave', 'municipios-fill', () => {
    if (hoveredId !== null) {
      map.setFeatureState({ source: 'municipios', sourceLayer: 'mun', id: hoveredId }, { hover: false });
    }
    hoveredId = null;
    map.getCanvas().style.cursor = '';
    popup.remove();
  });

  map.on('click', 'municipios-fill', (e) => {
    if (!e.features.length) return;
    const feat = e.features[0];
    if (selectedId === feat.id) {
      clearSelection();
      onDeselect();
      return;
    }
    clearSelection();
    selectedId = feat.id;
    map.setFeatureState({ source: 'municipios', sourceLayer: 'mun', id: selectedId }, { selected: true });
    const { name_muni, abbrev_state, code_muni } = feat.properties;
    onSelect(String(code_muni), name_muni, abbrev_state);
  });

  map.on('click', (e) => {
    const feats = map.queryRenderedFeatures(e.point, { layers: ['municipios-fill'] });
    if (!feats.length) {
      clearSelection();
      onDeselect();
    }
  });
}

export function clearSelection() {
  if (selectedId !== null) {
    map.setFeatureState({ source: 'municipios', sourceLayer: 'mun', id: selectedId }, { selected: false });
    selectedId = null;
  }
}
