# 99_resumo_stub.R — resumo.csv PROVISORIO para teste do site enquanto o
# pipeline completo roda. Valores placeholder deterministicos por UF.
# Substituido pelo 04_resumo.R real. NAO usar em producao.

source("scripts/00_config.R")
suppressPackageStartupMessages(library(jsonlite))

gj <- fromJSON(file.path(DIR_GEO, "municipios.geojson"), simplifyVector = TRUE)
p <- setDT(gj$features$properties)
res <- p[, .(code_muni = as.character(code_muni), nome = name_muni, uf = abbrev_state)]

# placeholder: Sul +chuva em EN, NE/N -chuva (padrao real conhecido), + ruido do geocod
uf1 <- as.integer(substr(res$code_muni, 1, 1))
base <- fifelse(uf1 == 4, 25, fifelse(uf1 %in% c(1, 2), -20, 0))
ruido <- (as.integer(substr(res$code_muni, 3, 7)) %% 21) - 10
res[, anom_chuva_en_pct := base + ruido]
res[, anom_chuva_ln_pct := -anom_chuva_en_pct * 0.6]
res[, spei3_med_en := round(anom_chuva_en_pct / 30, 2)]
res[, spei3_med_ln := round(-anom_chuva_en_pct / 40, 2)]
res[, dif_veranico_en := round(-anom_chuva_en_pct / 8, 1)]
res[, dif_dias_tmax34_en := round(-anom_chuva_en_pct / 5, 1)]
res[, dif_onset_en_dias := round(-anom_chuva_en_pct / 6, 1)]
res[, anom_rend_en_soja := round(anom_chuva_en_pct / 3, 1)]
res[, anom_rend_en_milho := round(anom_chuva_en_pct / 4, 1)]

fwrite_site(res, file.path(DIR_SITE_DATA, "resumo.csv"))
message("STUB resumo.csv: ", nrow(res), " municipios (placeholder!)")
