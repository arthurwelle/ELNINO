// Config central: cores de fase ENSO, métricas do choropleth, explorador, labels.

// Cores lidas do tema ativo (custom properties do CSS) em tempo de render —
// trocar o tema re-renderiza os gráficos com a paleta certa.
export function themeVar(nome, fallback) {
  const v = getComputedStyle(document.documentElement).getPropertyValue(nome).trim();
  return v || fallback;
}

// Fases ENSO — escala divergente: polos quente/frio + neutro no ponto médio.
// Identidade nunca só por cor: legenda + rótulo direto + Neutro tracejado.
export const FASE = {
  EN: { get cor() { return themeVar('--fase-en', '#d73027'); }, label: 'El Niño' },
  LN: { get cor() { return themeVar('--fase-ln', '#4575b4'); }, label: 'La Niña' },
  N:  { get cor() { return themeVar('--fase-n', '#898781'); }, label: 'Neutro' },
};
export const FASES = ['EN', 'N', 'LN'];

// Ink/chrome dos gráficos
export const INK = {
  get primary() { return themeVar('--text', '#0b0b0b'); },
  get secondary() { return themeVar('--text-2', '#52514e'); },
  get muted() { return themeVar('--muted', '#898781'); },
  get grid() { return themeVar('--grid', '#e1e0d9'); },
  get axis() { return themeVar('--axis', '#c3c2b7'); },
  get surface() { return themeVar('--surface', '#fcfcfb'); },
};

// Métricas principais (resumo.csv) — choropleth + hover.
// dir: +1 = valor alto e "úmido/bom" (BrBG normal), -1 = valor alto e "seco/ruim".
export const METRICAS = [
  { col: 'anom_chuva_en_pct', label: 'Chuva da safra em anos El Niño', unidade: '%', dir: +1, default: true,
    desc: 'Quanto choveu de outubro a março em anos de El Niño, em % acima (+) ou abaixo (−) da média histórica do município.' },
  { col: 'anom_chuva_ln_pct', label: 'Chuva da safra em anos La Niña', unidade: '%', dir: +1,
    desc: 'Quanto choveu de outubro a março em anos de La Niña, em % acima (+) ou abaixo (−) da média histórica do município.' },
  { col: 'spei6_med_en', label: 'Seca/umidade da safra em anos El Niño (SPEI-6)', unidade: '', dir: +1,
    desc: 'SPEI-6 medido em março cobre exatamente out–mar. Índice que combina chuva e evaporação: abaixo de 0 = mais seco que o normal; acima = mais úmido.' },
  { col: 'spei6_med_ln', label: 'Seca/umidade da safra em anos La Niña (SPEI-6)', unidade: '', dir: +1,
    desc: 'SPEI-6 medido em março cobre exatamente out–mar. Índice que combina chuva e evaporação: abaixo de 0 = mais seco que o normal; acima = mais úmido.' },
  { col: 'dif_veranico_en', label: 'Veranico em anos El Niño', unidade: ' dias', dir: -1,
    desc: 'Quantos dias a mais (+) ou a menos (−) dura a maior sequência sem chuva da safra em anos de El Niño, comparado ao normal.' },
  { col: 'dif_dias_tmax34_en', label: 'Calor extremo em anos El Niño', unidade: ' dias', dir: -1,
    desc: 'Dias com máxima acima de 34 °C na safra (limite de estresse para culturas como a soja): diferença entre anos de El Niño e o normal.' },
  { col: 'dif_onset_en_dias', label: 'Atraso do início das chuvas em anos El Niño', unidade: ' dias', dir: -1,
    desc: 'Em anos de El Niño, o início das chuvas (que permite o plantio) atrasa (+) ou adianta (−) quantos dias em relação ao normal.' },
  { col: 'anom_rend_en_soja', label: 'Rendimento da soja em anos El Niño', unidade: '%', dir: +1,
    desc: 'Produtividade da soja (kg/ha) em anos de El Niño, em % acima (+) ou abaixo (−) da tendência local (média de 2014–2024, dados IBGE/PAM).' },
  { col: 'anom_rend_en_milho', label: 'Rendimento do milho em anos El Niño', unidade: '%', dir: +1,
    desc: 'Produtividade do milho (kg/ha) em anos de El Niño, em % acima (+) ou abaixo (−) da tendência local (média de 2014–2024, dados IBGE/PAM).' },
];

// Explorador: indicadores mensais (arquivos data/mapa/<id>_<mes>.csv).
// modo: como exibir a fase escolhida — 'pct' = % vs média, 'dif' = diferença vs média,
//       'abs' = valor médio direto (índices já padronizados).
export const INDICADORES = [
  { id: 'rain_mm', label: 'Chuva no mês', unidade: ' mm', modo: 'pct', dir: +1,
    desc: 'Total de chuva no mês escolhido. Mostrado como % acima/abaixo da média do município nesse mês.' },
  { id: 'bal_mm', label: 'Balanço hídrico (chuva − evaporação)', unidade: ' mm', modo: 'dif', dir: +1,
    desc: 'Chuva menos a água que a atmosfera "puxa" (evapotranspiração). Diferença em mm vs o normal do mês: negativo = mês mais seco.' },
  { id: 'spei1', label: 'SPEI-1 (seca do mês)', unidade: '', modo: 'abs', dir: +1,
    desc: 'Índice de seca do próprio mês, combinando chuva e evaporação. Abaixo de 0 = mais seco que o normal; acima = mais úmido.' },
  { id: 'spei3', label: 'SPEI-3 (seca do trimestre)', unidade: '', modo: 'abs', dir: +1,
    desc: 'Índice de seca acumulado dos últimos 3 meses. Abaixo de 0 = trimestre mais seco que o normal.' },
  { id: 'spei6', label: 'SPEI-6 (seca do semestre)', unidade: '', modo: 'abs', dir: +1,
    desc: 'Índice de seca acumulado dos últimos 6 meses. Em março, cobre exatamente a safra de verão (out–mar).' },
  { id: 'spei12', label: 'SPEI-12 (seca do ano)', unidade: '', modo: 'abs', dir: +1,
    desc: 'Índice de seca acumulado dos últimos 12 meses — enxerga secas longas, de ano inteiro.' },
  { id: 'tmax_med', label: 'Temperatura máxima média', unidade: ' °C', modo: 'dif', dir: -1,
    desc: 'Média das temperaturas máximas diárias do mês. Diferença em °C vs o normal: positivo = mês mais quente.' },
  { id: 'dias_tmax34', label: 'Dias de calor extremo (>34 °C)', unidade: ' dias', modo: 'dif', dir: -1,
    desc: 'Quantos dias do mês passaram de 34 °C (estresse para as lavouras). Diferença vs o normal do mês.' },
  { id: 'veranico_max', label: 'Veranico (dias seguidos sem chuva)', unidade: ' dias', modo: 'dif', dir: -1,
    desc: 'Maior sequência de dias sem chuva dentro do mês. Diferença vs o normal: positivo = estiagens mais longas.' },
];

export const CULTURAS = [
  { id: 'soja',   label: 'Soja' },
  { id: 'milho',  label: 'Milho' },
  { id: 'arroz',  label: 'Arroz' },
  { id: 'feijao', label: 'Feijão' },
  { id: 'trigo',  label: 'Trigo' },
  { id: 'cana',   label: 'Cana-de-açúcar' },
];

export const MESES_CURTOS = ['jan', 'fev', 'mar', 'abr', 'mai', 'jun',
                             'jul', 'ago', 'set', 'out', 'nov', 'dez'];
export const MESES_LONGOS = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
                             'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'];

// mês m do ano y pertence à safra: jul–dez -> y+1, jan–jun -> y
export function safraDoMes(ano, mes) {
  return mes >= 7 ? ano + 1 : ano;
}

export function debounce(fn, ms) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), ms); };
}
