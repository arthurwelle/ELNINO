# 0001 — RONI substitui o ONI na classificação das fases ENSO

Data: 2026-07-22
Status: aceito

## Contexto

O site classifica cada ano-safra em El Niño / La Niña / Neutro para agrupar as métricas
climáticas e agrícolas. Até aqui usávamos o **ONI** (Oceanic Niño Index) da NOAA/CPC —
anomalia absoluta de TSM na região Niño 3.4 sobre uma base fixa de 30 anos.

Com o aquecimento global, essa base defasa: eventos recentes aparecem inflados. Exemplo
concreto do nosso próprio pipeline: a safra 2023/24 tem pico ONI +2,1 °C (muito forte),
mas RONI +1,5 °C. A NOAA/CPC adotou oficialmente o **RONI** (Relative ONI, que desconta
o aquecimento médio tropical) em 2026 como índice de monitoramento preferencial.

## Decisão

Usar o **RONI** como índice de classificação das fases e de "evento forte" em todo o
site. O ONI é mantido apenas como coluna secundária (comparação em tooltips e
metodologia), sem papel na classificação.

Como a CPC não publica o RONI em arquivo `.txt` (só tabela HTML), a série é mantida como
cópia local versionada em `scripts/raw/roni_wide.txt`, a ser conferida contra a fonte.

## Consequências

- Positivas: classificação alinhada ao índice que a própria CPC agora considera mais
  confiável; correção do viés de aquecimento nos eventos recentes.
- Negativas / trade-off: os grupos EN/LN/N mudam vs a versão anterior do site, o que
  recalcula todas as anomalias e o choropleth. A fonte depende de atualização manual do
  arquivo local (não há endpoint estável).
- Reversível na estrutura (o ONI continua no pipeline), mas re-rotular tudo tem custo.
