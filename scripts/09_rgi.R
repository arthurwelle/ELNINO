# 09_rgi.R — agregados por Regiao Geografica Intermediaria (IBGE 2017, 133 regioes).
#   site/data/rgi/<cod_rgi>.csv   (cultura, ano, rend, anomalia, fase, roni)
#   site/geo/rgi.geojson          (bordas, dissolve dos municipios por regiao)
#   DATA/derived/rgi_muni.parquet, rgi_resumo.parquet (consumidos pelo 04_resumo.R)
#
# Fonte do de-para: GEO/meso.csv (nome do arquivo diz "meso", mas o conteudo e a
# divisao de Regioes Intermediarias de 2017 — 133 regioes com nomes de cidade-polo;
# as mesorregioes classicas de GEO/meso.gpkg sao outra divisao, com 137 regioes).
# Rendimento da regiao = Sum(producao) / Sum(area colhida), igual ao criterio da UF.

source("scripts/00_config.R")
suppressPackageStartupMessages({
  library(arrow)
  library(sf)
})

DIR_RGI <- file.path(DIR_SITE_DATA, "rgi")
if (!dir.exists(DIR_RGI)) dir.create(DIR_RGI)

# --- de-para municipio -> regiao intermediaria ------------------------------
depara <- fread(file.path(DIR_GEO, "meso.csv"), sep = ";", encoding = "Latin-1",
                colClasses = "character")
setnames(depara, c("cod_mun", "meso", "nome_meso"),
         c("geocod", "cod_rgi", "nome_rgi"), skip_absent = TRUE)
depara <- unique(depara[, .(geocod, cod_rgi, nome_rgi)])
write_parquet(depara, file.path(DIR_DERIVED, "rgi_muni.parquet"))
message("de-para: ", nrow(depara), " municipios em ", uniqueN(depara$cod_rgi), " regioes")

# --- bordas: dissolve dos municipios por regiao -----------------------------
mun <- st_read(file.path(DIR_GEO, "municipios.geojson"), quiet = TRUE)
mun$geocod <- as.character(mun$code_muni)
mun <- merge(mun[, "geocod"], depara, by = "geocod")
mun <- mun[!is.na(mun$cod_rgi), ]

rgi_sf <- NULL
if (requireNamespace("rmapshaper", quietly = TRUE)) {
  rgi_sf <- tryCatch({
    d <- rmapshaper::ms_dissolve(mun, field = "cod_rgi")
    # so bordas de referencia no mapa: simplifica forte (arquivo leve)
    rmapshaper::ms_simplify(d, keep = 0.015, keep_shapes = TRUE)
  }, error = function(e) { message("rmapshaper falhou: ", conditionMessage(e)); NULL })
}
if (is.null(rgi_sf)) {  # fallback sem rmapshaper
  mun2 <- st_make_valid(st_simplify(mun, dTolerance = 500))
  rgi_sf <- aggregate(mun2[, "geocod"], by = list(cod_rgi = mun2$cod_rgi), FUN = length)
  rgi_sf$geocod <- NULL
}
nomes <- unique(depara[, .(cod_rgi, nome_rgi)])
rgi_sf <- merge(rgi_sf, nomes, by = "cod_rgi")
out_geo <- file.path(DIR_ROOT, "site", "geo", "rgi.geojson")
if (file.exists(out_geo)) file.remove(out_geo)
st_write(rgi_sf[, c("cod_rgi", "nome_rgi")], out_geo, quiet = TRUE,
         layer_options = "COORDINATE_PRECISION=4")  # ~11 m, suficiente p/ bordas
message("rgi.geojson: ", nrow(rgi_sf), " regioes, ",
        round(file.size(out_geo) / 1024), " KB")

# --- agregados de rendimento por regiao -------------------------------------
pam <- setDT(read_parquet(file.path(DIR_DERIVED, "pam_anual.parquet")))
pam <- merge(pam, depara, by = "geocod", all.x = TRUE)
pam <- pam[!is.na(cod_rgi)]

agg <- pam[!is.na(producao_t) & !is.na(area_colhida_ha) & area_colhida_ha > 0,
           .(rend_kg_ha = round(1000 * sum(producao_t) / sum(area_colhida_ha))),
           by = .(cod_rgi, cultura, ano)]
setorder(agg, cod_rgi, cultura, ano)
agg[, c("anom_rend_pct", "delta_rend_pct") :=
      calc_metrica_rendimento(ano, rend_kg_ha), by = .(cod_rgi, cultura)]

# fase ENSO pela janela da UF-mae (regiao intermediaria nao cruza UF)
janelas <- fread(file.path(DIR_SITE_DATA, "janela_cultura_uf.csv"))
oni <- fread(file.path(DIR_SITE_DATA, "oni.csv"))
agg[, uf := UF_COD[substr(cod_rgi, 1, 2)]]
agg <- merge(agg, janelas[, .(uf, cultura, mes_centro, ano_offset)],
             by = c("uf", "cultura"), all.x = TRUE)
agg[, ano_oni := ano + ano_offset]
agg <- merge(agg, oni[, .(ano, mes, roni, fase)],
             by.x = c("ano_oni", "mes_centro"), by.y = c("ano", "mes"), all.x = TRUE)
agg[, `:=`(roni_pico = round(roni, 2),
           forte = as.integer(abs(roni) >= ONI_FORTE))]

agg <- agg[, .(cod_rgi, cultura, ano, rend_kg_ha, anom_rend_pct, delta_rend_pct,
               fase, forte, roni_pico)]
setorder(agg, cod_rgi, cultura, ano)

n <- 0L
for (r in sort(unique(agg$cod_rgi))) {
  fwrite_site(agg[cod_rgi == r, !"cod_rgi"], file.path(DIR_RGI, paste0(r, ".csv")))
  n <- n + 1L
}

# resumo por regiao para o choropleth (media da anomalia em safras EN)
res <- dcast(
  agg[fase == "EN" & cultura %in% c("soja", "milho1", "milho2", "milho") &
        !is.na(anom_rend_pct),
      .(v = if (.N >= 2L) round(mean(anom_rend_pct), 1) else NA_real_),
      by = .(cod_rgi, cultura)],
  cod_rgi ~ cultura, value.var = "v")
write_parquet(res, file.path(DIR_DERIVED, "rgi_resumo.parquet"))

message("rgi/: ", n, " regioes | linhas: ", nrow(agg))
