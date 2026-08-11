# 10_concentracao.R — ranking de municipios por producao, para o filtro do mapa.
#   site/data/concentracao/<cultura>.csv  (code_muni, pct_acum)
#
# pct_acum = % acumulado da producao nacional da cultura, com os municipios
# ordenados do maior para o menor produtor. Filtrar pct_acum <= X no site devolve
# exatamente o MENOR conjunto de municipios que soma X% da producao.
# Base: media de producao dos ultimos ANOS_CONC anos (geografia atual da producao).

source("scripts/00_config.R")
suppressPackageStartupMessages(library(arrow))

ANOS_CONC <- 5

DIR_CONC <- file.path(DIR_SITE_DATA, "concentracao")
if (!dir.exists(DIR_CONC)) dir.create(DIR_CONC)

pam <- setDT(read_parquet(file.path(DIR_DERIVED, "pam_anual.parquet")))
ano_max <- max(pam$ano, na.rm = TRUE)
rec <- pam[ano >= ano_max - (ANOS_CONC - 1L) & !is.na(producao_t) & producao_t > 0]
message("base: ", ano_max - ANOS_CONC + 1L, "-", ano_max)

n <- 0L
for (cult in sort(unique(rec$cultura))) {
  d <- rec[cultura == cult, .(prod = mean(producao_t)), by = geocod]
  d <- d[prod > 0]
  if (!nrow(d)) next
  setorder(d, -prod)
  d[, pct_acum := round(100 * cumsum(prod) / sum(prod), 2)]
  fwrite_site(d[, .(code_muni = geocod, pct_acum)],
              file.path(DIR_CONC, paste0(cult, ".csv")))
  n50 <- d[pct_acum <= 50, .N]
  message(sprintf("%-8s %5d municipios produtores | 50%% da producao em %d (%.1f%%)",
                  cult, nrow(d), n50, 100 * n50 / nrow(d)))
  n <- n + 1L
}
message("concentracao/: ", n, " culturas")
