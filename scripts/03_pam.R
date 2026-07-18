# 03_pam.R — PAM 1974-2024 -> site/data/anual/<geocod>.csv (1 linha por ano x cultura)
# Metrica principal: anomalia % vs tendencia loess (>= LOESS_MIN_ANOS anos validos);
# fallback: delta % ano-a-ano (cap +-DELTA_CAP).

source("scripts/00_config.R")
suppressPackageStartupMessages(library(arrow))

pam <- fread(DIR_PAM, encoding = "UTF-8", colClasses = list(character = "id_municipio"))

# normaliza culturas e filtra as da v1 (exclui Abacaxi: mil frutos; Outras: mix)
mapa_cultura <- c(soja = "soja", milho = "milho", arroz = "arroz",
                  "feijão" = "feijao", trigo = "trigo", cana = "cana")
pam[, cultura := mapa_cultura[grupo_produto]]
pam <- pam[!is.na(cultura)]

pam[, rend_kg_ha := fifelse(!is.na(area_colhida) & area_colhida > 0,
                            1000 * quantidade_produzida / area_colhida, NA_real_)]

setorder(pam, id_municipio, cultura, ano)

calc_metrica_rendimento <- function(ano, rend) {
  # retorna list(anom_rend_pct, delta_rend_pct) alinhados a 'ano'
  delta <- 100 * (rend / shift(rend) - 1)
  delta <- pmax(pmin(delta, DELTA_CAP), -DELTA_CAP)
  ok <- which(!is.na(rend) & rend > 0)
  anom <- rep(NA_real_, length(rend))
  if (length(ok) >= LOESS_MIN_ANOS) {
    fit <- tryCatch(
      loess(rend[ok] ~ ano[ok], span = LOESS_SPAN, degree = 2,
            family = "symmetric"),
      error = function(e) NULL)
    if (!is.null(fit)) {
      tend <- predict(fit)
      tend[tend <= 0] <- NA_real_
      anom[ok] <- 100 * (rend[ok] - tend) / tend
    }
  }
  list(anom = round(anom, 1), delta = round(delta, 1))
}

pam[, c("anom_rend_pct", "delta_rend_pct") :=
      calc_metrica_rendimento(ano, rend_kg_ha), by = .(id_municipio, cultura)]

# junta fase ENSO e clima de safra
safras <- fread(file.path(DIR_SITE_DATA, "oni_safras.csv"))
clima  <- setDT(read_parquet(file.path(DIR_DERIVED, "safra_clima.parquet")))

out <- merge(pam, safras, by.x = "ano", by.y = "ano_safra", all.x = TRUE)
out <- merge(out, clima, by.x = c("id_municipio", "ano"),
             by.y = c("geocod", "ano_safra"), all.x = TRUE)

out <- out[, .(
  geocod = id_municipio, ano, cultura,
  area_plantada_ha = area_plantada, area_colhida_ha = area_colhida,
  producao_t = quantidade_produzida, valor_mil_reais = valor_producao,
  rend_kg_ha = round(rend_kg_ha), anom_rend_pct, delta_rend_pct,
  fase, forte,
  chuva_out_mar_mm, veranico_max_out_mar, dias_tmax34_out_mar
)]
setorder(out, geocod, cultura, ano)

# 1 CSV por municipio (so anos com alguma cultura reportada)
out <- out[!is.na(rend_kg_ha) | !is.na(area_plantada_ha)]
n <- 0L
for (g in unique(out$geocod)) {
  fwrite_site(out[geocod == g, !"geocod"], file.path(DIR_SITE_ANUAL, paste0(g, ".csv")))
  n <- n + 1L
}

# agregado para o 04_resumo (media da anomalia em safras EN por cultura)
write_parquet(out, file.path(DIR_DERIVED, "pam_anual.parquet"))
message("anual/: ", n, " municipios | linhas totais: ", nrow(out),
        " | com loess: ", out[!is.na(anom_rend_pct), .N])
message("Mediana rend soja (kg/ha): ",
        out[cultura == "soja" & ano >= 2015, round(median(rend_kg_ha, na.rm = TRUE))])
