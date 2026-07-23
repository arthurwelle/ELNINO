# CONTEXT.md — Glossário do domínio

Termos canônicos do projeto. Somente linguagem de domínio; nada de implementação.

## ENSO

- **Fase ENSO**: classificação de um período em **El Niño (EN)**, **La Niña (LN)** ou
  **Neutro (N)** segundo o **RONI** (Relative Oceanic Niño Index, NOAA/CPC): anomalia de
  TSM na região Niño 3.4 relativa ao aquecimento médio tropical, média móvel trimestral.
  EN quando RONI ≥ +0,5 °C; LN quando ≤ −0,5 °C. O **ONI** (índice absoluto anterior) é
  mantido só como coluna de comparação — não classifica mais as fases.
- **RONI**: variante do ONI que desconta o aquecimento médio do cinturão tropical,
  removendo a dependência da base climatológica. Índice de classificação do site.
- **Ano-safra**: o ano `t` da safra de verão plantada em set–dez de `t−1` e colhida em `t`.
  É a unidade de atribuição de fase: a safra `t` recebe a fase ONI **predominante entre
  out(t−1) e mar(t)**. O ano da PAM é interpretado como ano-safra.
- **Evento forte**: safra cujo |ONI de pico| ≥ 1,5 °C (ex.: 1983, 1998, 2016, 2024 EN;
  1989, 2000, 2008, 2011 LN).

## Agricultura (PAM/IBGE)

- **Rendimento**: produtividade em kg/ha = produção (t) × 1000 ÷ área colhida (ha).
- **Anomalia de rendimento**: desvio percentual do rendimento vs a **tendência** local
  (curva suave que captura tecnologia/expansão). Métrica principal de impacto ENSO.
- **Δ% ano-a-ano**: variação percentual do rendimento vs ano anterior. Métrica
  substituta quando a série do município×cultura é curta demais para tendência.
- **Culturas do projeto**: soja, milho, arroz, feijão, trigo, cana. Abacaxi é excluído
  (PAM reporta em mil frutos, não toneladas); "Outras" é excluída (agregado heterogêneo).

## Clima

- **Veranico**: sequência máxima de dias consecutivos com chuva < 1 mm dentro de um
  período (mês ou janela out–mar).
- **Onset das chuvas**: primeiro dia, a partir de 1/set, com ≥ 20 mm acumulados em 3 dias
  e sem estiagem > 10 dias nos 20 dias seguintes; expresso em dias após 1/set. Sem onset
  até 31/jan = ausente.
- **SPI / SPEI**: índices padronizados de seca (precipitação; precipitação−ETP) nas
  escalas 1/3/6/12 meses. **SPEI-3 de março** resume a umidade da janela out–mar da safra.
- **Soma térmica** (graus-dia, GDD base 10): Σ(temperatura média diária − 10 °C), com
  clip em 0 nos dias frios. Acúmulo de calor disponível às culturas.
- **Radiação acumulada**: soma da radiação solar global (MJ/m²) no período.
- **Valor do estado (UF)**: agregado da unidade federativa usado como referência nos
  gráficos de produtividade — rendimento = Σprodução ÷ Σárea colhida (ponderado por
  área), e sua anomalia média por fase. Aplica-se só à PAM (não ao clima).
- **Milho 1ª/2ª safra**: a PAM separa o milho em primeira e segunda safra a partir de
  2003; antes disso só há "milho" total. No mapa, cada UF exibe a safra de maior
  produção no estado (safra dominante).
- **Janela out–mar**: período crítico da safra de verão (plantio + desenvolvimento);
  janela sobre a qual se calculam os agregados climáticos de safra.
- **Climatologia**: média 1980–2025 de uma variável (base de comparação das anomalias).

## Site

- **Resumo nacional**: uma linha por município com as métricas que colorem o mapa
  (choropleth) e alimentam o popup de hover.
- **Município selecionado (pinado)**: município clicado; seus dados alimentam os
  gráficos do painel até nova seleção.
