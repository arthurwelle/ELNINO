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

# anomalia media de rendimento em safras EN
pam <- setDT(read_parquet(file.path(DIR_DERIVED, "pam_anual.parquet")))
pam[, uf2 := substr(geocod, 1, 2)]

# soja: direto
soja <- pam[fase == "EN" & cultura == "soja" & !is.na(anom_rend_pct),
            .(anom_rend_en_soja = if (.N >= 2L) round(mean(anom_rend_pct), 1) else NA_real_),
            by = geocod]

# milho no mapa: safra dominante da UF (milho_safra_uf.csv); fallback milho total
milho_uf_path <- file.path(DIR_SITE_DATA, "milho_safra_uf.csv")
if (file.exists(milho_uf_path)) {
  dom <- fread(milho_uf_path)  # uf (sigla), safra_dominante
  uf_cod <- c("11"="RO","12"="AC","13"="AM","14"="RR","15"="PA","16"="AP","17"="TO",
              "21"="MA","22"="PI","23"="CE","24"="RN","25"="PB","26"="PE","27"="AL",
              "28"="SE","29"="BA","31"="MG","32"="ES","33"="RJ","35"="SP","41"="PR",
              "42"="SC","43"="RS","50"="MS","51"="MT","52"="GO","53"="DF")
  pam[, uf := uf_cod[uf2]]
  pam <- merge(pam, dom, by = "uf", all.x = TRUE)
  pam[, cult_mapa := fifelse(safra_dominante == 2L, "milho2", "milho1")]
  milho <- pam[fase == "EN" & cultura == cult_mapa & !is.na(anom_rend_pct),
               .(anom_rend_en_milho = if (.N >= 2L) round(mean(anom_rend_pct), 1) else NA_real_),
               by = geocod]
} else {
  milho <- pam[fase == "EN" & cultura == "milho" & !is.na(anom_rend_pct),
               .(anom_rend_en_milho = if (.N >= 2L) round(mean(anom_rend_pct), 1) else NA_real_),
               by = geocod]
}
res_pam <- merge(soja, milho, by = "geocod", all = TRUE)

resumo <- merge(props, res_clima, by = "geocod", all.y = TRUE)
resumo <- merge(resumo, res_pam, by = "geocod", all.x = TRUE)
setnames(resumo, "geocod", "code_muni")
setorder(resumo, code_muni)

fwrite_site(resumo, file.path(DIR_SITE_DATA, "resumo.csv"))
message("resumo.csv: ", nrow(resumo), " municipios | sem nome (join geojson falhou): ",
        resumo[is.na(nome), .N])
