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

# --- milho 1a/2a safra (SIDRA tabela 839, formato longo) -------------------
DIR_MILHO <- file.path(DIR_DATA, "pam", "milho.csv")
if (file.exists(DIR_MILHO)) {
  m <- fread(DIR_MILHO, skip = 1, encoding = "UTF-8",
             colClasses = "character", na.strings = c("-", "", "..", "..."))
  setnames(m, 1:5, c("id_municipio", "ano", "variavel", "produto", "valor"))
  m[, cultura := fifelse(grepl("1", produto), "milho1",
                  fifelse(grepl("2", produto), "milho2", NA_character_))]
  m <- m[!is.na(cultura) & !is.na(valor)]
  m[, `:=`(ano = as.integer(ano), valor = as.numeric(valor))]
  m[, campo := fcase(
    grepl("plantada", variavel), "area_plantada",
    grepl("colhida",  variavel), "area_colhida",
    grepl("produzida", variavel), "quantidade_produzida")]
  m <- m[!is.na(campo)]
  milho <- dcast(m, id_municipio + ano + cultura ~ campo, value.var = "valor")
  milho[, valor_producao := NA_real_]
  pam <- rbind(pam[, .(id_municipio, ano, cultura, area_plantada, area_colhida,
                       quantidade_produzida, valor_producao)],
               milho[, .(id_municipio, ano, cultura, area_plantada, area_colhida,
                         quantidade_produzida, valor_producao)])
  message("milho 1a/2a safra integrado: ", nrow(milho), " linhas")
}

pam[, rend_kg_ha := fifelse(!is.na(area_colhida) & area_colhida > 0,
                            1000 * quantidade_produzida / area_colhida, NA_real_)]

setorder(pam, id_municipio, cultura, ano)

# calc_metrica_rendimento agora vem de 00_config.R (compartilhado com 07_estado.R)
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
