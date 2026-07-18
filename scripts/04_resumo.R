# 04_resumo.R — resumo nacional (1 linha por municipio) para choropleth + hover.
#   site/data/resumo.csv

source("scripts/00_config.R")
suppressPackageStartupMessages({
  library(arrow)
  library(jsonlite)
})

clima  <- setDT(read_parquet(file.path(DIR_DERIVED, "safra_clima.parquet")))
safras <- fread(file.path(DIR_SITE_DATA, "oni_safras.csv"))

# SPEI-6 de marco (cobre exatamente out-mar) direto dos mensais ja gerados
spei6_safra <- rbindlist(lapply(
  list.files(DIR_SITE_MENSAL, pattern = "\\.csv$", full.names = TRUE),
  function(f) {
    dt <- fread(f, select = c("data", "spei6"))
    dt <- dt[endsWith(data, "-03") & !is.na(spei6)]
    data.table(geocod = sub("\\.csv$", "", basename(f)),
               ano_safra = as.integer(substr(dt$data, 1, 4)),
               spei6_mar = dt$spei6)
  }))
clima <- merge(clima, spei6_safra, by = c("geocod", "ano_safra"), all.x = TRUE)
clima <- merge(clima, safras, by.x = "ano_safra", by.y = "ano_safra")

res_clima <- clima[, {
  base_chuva   <- mean(chuva_out_mar_mm, na.rm = TRUE)
  base_ver     <- mean(veranico_max_out_mar, na.rm = TRUE)
  base_tmax    <- mean(dias_tmax34_out_mar, na.rm = TRUE)
  base_onset   <- mean(onset_dias, na.rm = TRUE)
  en <- .SD[fase == "EN"]; ln <- .SD[fase == "LN"]
  .(
    anom_chuva_en_pct  = round(100 * (mean(en$chuva_out_mar_mm, na.rm = TRUE) / base_chuva - 1), 1),
    anom_chuva_ln_pct  = round(100 * (mean(ln$chuva_out_mar_mm, na.rm = TRUE) / base_chuva - 1), 1),
    spei3_med_en       = round(mean(en$spei3_mar, na.rm = TRUE), 2),
    spei3_med_ln       = round(mean(ln$spei3_mar, na.rm = TRUE), 2),
    spei6_med_en       = round(mean(en$spei6_mar, na.rm = TRUE), 2),
    spei6_med_ln       = round(mean(ln$spei6_mar, na.rm = TRUE), 2),
    dif_veranico_en    = round(mean(en$veranico_max_out_mar, na.rm = TRUE) - base_ver, 1),
    dif_dias_tmax34_en = round(mean(en$dias_tmax34_out_mar, na.rm = TRUE) - base_tmax, 1),
    dif_onset_en_dias  = round(mean(en$onset_dias, na.rm = TRUE) - base_onset, 1)
  )
}, by = geocod]

# nomes/UF a partir do geojson de municipios (so properties)
gj <- fromJSON(file.path(DIR_GEO, "municipios.geojson"), simplifyVector = TRUE)
props <- setDT(gj$features$properties)
props <- props[, .(geocod = as.character(code_muni), nome = name_muni, uf = abbrev_state)]

# anomalia media de rendimento em safras EN (soja e milho)
pam <- setDT(read_parquet(file.path(DIR_DERIVED, "pam_anual.parquet")))
res_pam <- dcast(
  pam[fase == "EN" & cultura %in% c("soja", "milho") & !is.na(anom_rend_pct),
      .(v = if (.N >= 2L) round(mean(anom_rend_pct), 1) else NA_real_),
      by = .(geocod, cultura)],
  geocod ~ cultura, value.var = "v")
setnames(res_pam, old = c("soja", "milho"),
         new = c("anom_rend_en_soja", "anom_rend_en_milho"), skip_absent = TRUE)

resumo <- merge(props, res_clima, by = "geocod", all.y = TRUE)
resumo <- merge(resumo, res_pam, by = "geocod", all.x = TRUE)
setnames(resumo, "geocod", "code_muni")
setorder(resumo, code_muni)

fwrite_site(resumo, file.path(DIR_SITE_DATA, "resumo.csv"))
message("resumo.csv: ", nrow(resumo), " municipios | sem nome (join geojson falhou): ",
        resumo[is.na(nome), .N])
