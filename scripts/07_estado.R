# 07_estado.R — series agregadas por UF (para comparar o municipio com o estado).
#   site/data/estado/<uf>.csv   (uf, cultura, ano, rend_kg_ha, anom_rend_pct, fase, forte, roni_pico)
#   site/data/milho_safra_uf.csv (uf, safra_dominante)  — 1 ou 2, maior Sum(producao) 2003-2024
# Rendimento da UF = Sum(producao_t)*1000 / Sum(area_colhida_ha) por ano (ponderado por area).

source("scripts/00_config.R")
suppressPackageStartupMessages(library(arrow))

DIR_ESTADO <- file.path(DIR_SITE_DATA, "estado")
if (!dir.exists(DIR_ESTADO)) dir.create(DIR_ESTADO)

pam <- setDT(read_parquet(file.path(DIR_DERIVED, "pam_anual.parquet")))

# UF pelo geocodigo IBGE (2 primeiros digitos) -> sigla
uf_cod <- c("11"="RO","12"="AC","13"="AM","14"="RR","15"="PA","16"="AP","17"="TO",
            "21"="MA","22"="PI","23"="CE","24"="RN","25"="PB","26"="PE","27"="AL",
            "28"="SE","29"="BA","31"="MG","32"="ES","33"="RJ","35"="SP","41"="PR",
            "42"="SC","43"="RS","50"="MS","51"="MT","52"="GO","53"="DF")
pam[, uf := uf_cod[substr(geocod, 1, 2)]]

safras <- fread(file.path(DIR_SITE_DATA, "oni_safras.csv"))

# rendimento agregado por UF x cultura x ano (ponderado por area colhida)
agg <- pam[!is.na(producao_t) & !is.na(area_colhida_ha) & area_colhida_ha > 0,
           .(rend_kg_ha = round(1000 * sum(producao_t) / sum(area_colhida_ha))),
           by = .(uf, cultura, ano)]
setorder(agg, uf, cultura, ano)
agg[, c("anom_rend_pct", "delta_rend_pct") :=
      calc_metrica_rendimento(ano, rend_kg_ha), by = .(uf, cultura)]

agg <- merge(agg, safras[, .(ano_safra, fase, forte, roni_pico)],
             by.x = "ano", by.y = "ano_safra", all.x = TRUE)
agg <- agg[, .(uf, cultura, ano, rend_kg_ha, anom_rend_pct, delta_rend_pct,
               fase, forte, roni_pico)]
setorder(agg, uf, cultura, ano)

n <- 0L
for (u in sort(unique(agg$uf))) {
  fwrite_site(agg[uf == u, !"uf"], file.path(DIR_ESTADO, paste0(u, ".csv")))
  n <- n + 1L
}

# decisao milho 1a/2a safra dominante por UF (quando existirem milho1/milho2)
if (any(c("milho1", "milho2") %in% pam$cultura)) {
  dom <- pam[cultura %in% c("milho1", "milho2") & ano >= 2003,
             .(q = sum(producao_t, na.rm = TRUE)), by = .(uf, cultura)]
  dom <- dcast(dom, uf ~ cultura, value.var = "q", fill = 0)
  dom[, safra_dominante := fifelse(get("milho2") > get("milho1"), 2L, 1L)]
  fwrite_site(dom[, .(uf, safra_dominante)],
              file.path(DIR_SITE_DATA, "milho_safra_uf.csv"))
  message("milho_safra_uf.csv: ", nrow(dom), " UFs")
} else {
  message("milho1/milho2 ausentes — milho_safra_uf.csv nao gerado (aguarda dados).")
}

message("estado/: ", n, " UFs | linhas: ", nrow(agg))
