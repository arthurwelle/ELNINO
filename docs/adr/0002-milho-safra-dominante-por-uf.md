# 0002 — Milho no mapa: safra dominante por UF

Data: 2026-07-22
Status: aceito (aguarda dados de milho 1ª/2ª safra)

## Contexto

A PAM separa o milho em **1ª safra** (verão, sensível ao ENSO como as demais culturas de
verão) e **2ª safra** ("safrinha", plantada após a soja, colhida no meio do ano) a
partir de 2003. As duas têm calendário e resposta climática diferentes. O choropleth do
mapa colore um valor único por município para "rendimento do milho" — é preciso decidir
qual safra esse valor representa.

Um mapa que escolhesse a safra dominante **por município** ficaria manchado (municípios
vizinhos alternando 1ª/2ª) e não produziria um mapa-resumo legível por estado.

## Decisão

No mapa, cada UF exibe a **safra dominante do estado** — aquela com maior produção total
(Σ quantidade produzida 2003–2024) na UF; todos os municípios da UF usam essa safra.
A decisão é registrada em `site/data/milho_safra_uf.csv` e documentada na metodologia com
um mini-mapa por estado.

No painel do município, o seletor de cultura oferece as três séries independentes —
milho (total, 1974+), milho 1ª safra e milho 2ª safra (2003+) — para o usuário comparar.

## Consequências

- Positivas: mapa nacional limpo e interpretável; painel preserva o detalhe das duas
  safras; série longa de milho total mantida.
- Trade-off: no mapa, municípios cuja safra local diverge da dominante do estado são
  representados pela safra do estado (aproximação assumida e explicada).
- Reversível, mas a escolha por-UF vs por-município muda a leitura do mapa.
