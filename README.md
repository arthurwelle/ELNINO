# El Niño e a Agricultura Brasileira

Site estático com mapa do Brasil por município mostrando como eventos passados de
El Niño / La Niña afetaram o clima local e a produtividade agrícola (PAM/IBGE),
para embasar o entendimento do próximo El Niño.

Glossário de domínio: [CONTEXT.md](CONTEXT.md).

## Estrutura

- `scripts/` — pipeline R que transforma os dados brutos (`DATA/`, não versionado)
  nos arquivos estáticos do site (`site/data/`).
- `site/` — o site completo (HTML + ES modules + D3 + MapLibre/PMTiles), servível
  por qualquer servidor estático com suporte a HTTP Range.
- `Legacy/` — protótipo original do qual o mapa e a interação foram adaptados.

## Pipeline (R ≥ 4.4: data.table, arrow, future.apply, R.utils, jsonlite, sf)

```
Rscript scripts/run_all.R
```

| Script | Saída |
|---|---|
| `01_oni.R` | `site/data/oni.csv`, `site/data/oni_safras.csv` (fase ENSO por ano-safra) |
| `02_mensal.R` | `site/data/mensal/<geocod>.csv` (552 meses) + `DATA/derived/safra_clima.parquet` |
| `03_pam.R` | `site/data/anual/<geocod>.csv` (PAM×cultura, anomalia loess / Δ%) |
| `04_resumo.R` | `site/data/resumo.csv` (1 linha/município — choropleth) |
| `05_validate.R` | checks de sanidade |

Entradas esperadas em `DATA/`: `xavier/` e `indices/` (CSV.gz por geocódigo IBGE,
Xavier v3.2.4 1980–2025) e `pam/PAM_1974_2024_Mun_Cultura.csv`.

Notas de método: anomalia de rendimento = desvio % vs tendência loess (span 0,5,
mínimo 15 anos válidos; senão Δ% ano-a-ano com cap ±200%). Δ% herda ruído do ano
anterior; a tendência loess é a métrica preferida. Fase ENSO da safra t = fase ONI
predominante out(t−1)–mar(t); evento forte = |ONI pico| ≥ 1,5.

## Rodar localmente

```
npx serve site          # se os tiles do mapa não carregarem (Range), use:
npx http-server site -p 8000
```

`python -m http.server` NÃO funciona (sem suporte a Range → PMTiles quebra).

## Deploy

GitHub Pages via Actions (`.github/workflows/pages.yml`), artifact = `site/`.
Habilitar Pages em Settings → Pages → Source: GitHub Actions.
