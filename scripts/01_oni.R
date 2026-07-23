# 01_oni.R — indices ENSO. RONI e a fonte de fase do site; ONI fica secundario.
#   site/data/oni.csv        (ano, mes, roni, oni, fase)   — mes = mes central da trimestral
#   site/data/oni_safras.csv (ano_safra, fase, roni_pico, oni_pico, forte)
# Fase e "forte" vem do RONI (Relative ONI, NOAA CPC 2026). ONI mantido p/ comparacao.

source("scripts/00_config.R")

mes_central <- c(DJF = 1, JFM = 2, FMA = 3, MAM = 4, AMJ = 5, MJJ = 6,
                 JJA = 7, JAS = 8, ASO = 9, SON = 10, OND = 11, NDJ = 12)

# --- RONI: tabela wide local (extraida da CPC; sem .txt oficial) -----------
roni_wide <- fread("scripts/raw/roni_wide.txt", skip = "ano")
roni <- melt(roni_wide, id.vars = "ano", variable.name = "seas",
             value.name = "roni", variable.factor = FALSE)
roni[, mes := mes_central[seas]]
roni <- roni[!is.na(roni), .(ano, mes, roni)]

# --- ONI: baixa do NOAA CPC (fallback local), so p/ coluna secundaria ------
ONI_URL   <- "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
ONI_LOCAL <- "scripts/raw/oni.ascii.txt"
ok <- tryCatch({
  download.file(ONI_URL, ONI_LOCAL, mode = "wb", quiet = TRUE); TRUE
}, error = function(e) FALSE, warning = function(w) FALSE)
if (!ok && !file.exists(ONI_LOCAL)) stop("Sem internet e sem copia local de ", ONI_LOCAL)
oni_raw <- fread(ONI_LOCAL)  # SEAS YR TOTAL ANOM
setnames(oni_raw, c("seas", "ano", "total", "oni"))
oni_raw[, mes := mes_central[seas]]
oni_m <- oni_raw[, .(ano, mes, oni)]

# --- mensal combinado: fase pelo RONI --------------------------------------
oni <- merge(roni, oni_m, by = c("ano", "mes"), all.x = TRUE)
oni[, fase := fifelse(roni >= 0.5, "EN", fifelse(roni <= -0.5, "LN", "N"))]
setorder(oni, ano, mes)
fwrite_site(oni[, .(ano, mes, roni, oni, fase)], file.path(DIR_SITE_DATA, "oni.csv"))

# --- fase por ano-safra: out(t-1) a mar(t), classificada pelo RONI ---------
anos_safra <- seq(min(oni$ano) + 1L, max(oni$ano))
safras <- rbindlist(lapply(anos_safra, function(t) {
  jan <- oni[(ano == t - 1L & mes %in% SAFRA_MESES_PREV) |
             (ano == t      & mes %in% SAFRA_MESES_CURR)]
  if (nrow(jan) < 6L || anyNA(jan$roni)) return(NULL)  # safra incompleta
  pico <- jan$roni[which.max(abs(jan$roni))]
  freq <- sort(table(jan$fase), decreasing = TRUE)
  fase <- names(freq)[1]
  if (length(freq) > 1L && freq[1] == freq[2]) {
    fase <- if (pico >= 0.5) "EN" else if (pico <= -0.5) "LN" else "N"
  }
  oni_pico <- jan$oni[which.max(abs(jan$oni))]
  data.table(ano_safra = t, fase = fase,
             roni_pico = pico,
             oni_pico = if (length(oni_pico)) oni_pico else NA_real_,
             forte = as.integer(abs(pico) >= ONI_FORTE))
}))

fwrite_site(safras, file.path(DIR_SITE_DATA, "oni_safras.csv"))
message("oni.csv: ", nrow(oni), " linhas | oni_safras.csv: ", nrow(safras),
        " safras (", min(safras$ano_safra), "-", max(safras$ano_safra), ")")
message("Safras El Nino/La Nina fortes (RONI):")
print(safras[forte == 1, .(ano_safra, fase, roni_pico, oni_pico)])
