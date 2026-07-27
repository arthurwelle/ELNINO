# 07_estado.R — series agregadas por UF (para comparar o municipio com o estado).
#   site/data/estado/<uf>.csv   (uf, cultura, ano, rend_kg_ha, anom_rend_pct, fase, forte, roni_pico)
#   site/data/milho_safra_uf.csv (uf, safra_dominante)  — 1 ou 2, maior Sum(producao) 2003-2024
# Rendimento da UF = Sum(producao_t)*1000 / Sum(area_colhida_ha) por ano (ponderado por area).

source("scripts/00_config.R")
suppressPackageStartupMessages(library(arrow))

DIR_ESTADO <- file.path(DIR_SITE_DATA, "estado")
if (!dir.exists(DIR_ESTADO)) dir.create(DIR_ESTADO)

pam <- setDT(read_parquet(file.path(DIR_DERIVED, "pam_anual.parquet")))

pam[, uf := UF_COD[substr(geocod, 1, 2)]]

# rendimento agregado por UF x cultura x ano (ponderado por area colhida)
agg <- pam[!is.na(producao_t) & !is.na(area_colhida_ha) & area_colhida_ha > 0,
           .(rend_kg_ha = round(1000 * sum(producao_t) / sum(area_colhida_ha))),
           by = .(uf, cultura, ano)]
setorder(agg, uf, cultura, ano)
agg[, c("anom_rend_pct", "delta_rend_pct") :=
      calc_metrica_rendimento(ano, rend_kg_ha), by = .(uf, cultura)]

# fase ENSO por janela especifica da cultura (milho total segue a UF dominante)
dom_path <- file.path(DIR_SITE_DATA, "milho_safra_uf.csv")  # gerado pelo 03
if (file.exists(dom_path)) {
  dom <- fread(dom_path)
  agg <- merge(agg, dom, by = "uf", all.x = TRUE)
} else {
  agg[, safra_dominante := NA_integer_]
}
oni <- fread(file.path(DIR_SITE_DATA, "oni.csv"))
agg[, mes_janela := janela_mes(cultura, safra_dominante)]
agg <- merge(agg, oni[, .(ano, mes, roni, fase)],
             by.x = c("ano", "mes_janela"), by.y = c("ano", "mes"), all.x = TRUE)
agg[, `:=`(roni_pico = round(roni, 2),
           forte = as.integer(abs(roni) >= ONI_FORTE))]

agg <- agg[, .(uf, cultura, ano, rend_kg_ha, anom_rend_pct, delta_rend_pct,
               fase, forte, roni_pico)]
setorder(agg, uf, cultura, ano)

n <- 0L
for (u in sort(unique(agg$uf))) {
  fwrite_site(agg[uf == u, !"uf"], file.path(DIR_ESTADO, paste0(u, ".csv")))
  n <- n + 1L
}

message("estado/: ", n, " UFs | linhas: ", nrow(agg))
