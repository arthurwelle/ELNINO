# 01_oni.R — baixa ONI (NOAA CPC) e gera:
#   site/data/oni.csv        (ano, mes, oni, fase)          — mes = mes central da trimestral
#   site/data/oni_safras.csv (ano_safra, fase, oni_pico, forte)
# Fonte unica de fase ENSO para pipeline e site.

source("scripts/00_config.R")

ONI_URL   <- "https://www.cpc.ncep.noaa.gov/data/indices/oni.ascii.txt"
ONI_LOCAL <- "scripts/raw/oni.ascii.txt"

ok <- tryCatch({
  download.file(ONI_URL, ONI_LOCAL, mode = "wb", quiet = TRUE)
  TRUE
}, error = function(e) FALSE, warning = function(w) FALSE)
if (!ok && !file.exists(ONI_LOCAL)) stop("Sem internet e sem copia local de ", ONI_LOCAL)
message(if (ok) "ONI baixado do NOAA CPC." else "Usando copia local do ONI.")

oni_raw <- fread(ONI_LOCAL)  # SEAS YR TOTAL ANOM
setnames(oni_raw, c("seas", "ano", "total", "oni"))

mes_central <- c(DJF = 1, JFM = 2, FMA = 3, MAM = 4, AMJ = 5, MJJ = 6,
                 JJA = 7, JAS = 8, ASO = 9, SON = 10, OND = 11, NDJ = 12)
oni_raw[, mes := mes_central[seas]]
stopifnot(!anyNA(oni_raw$mes))

oni <- oni_raw[, .(ano, mes, oni,
                   fase = fifelse(oni >= 0.5, "EN", fifelse(oni <= -0.5, "LN", "N")))]
setorder(oni, ano, mes)
fwrite_site(oni, file.path(DIR_SITE_DATA, "oni.csv"))

# --- fase por ano-safra: out(t-1) a mar(t) ---------------------------------
anos_safra <- seq(min(oni$ano) + 1L, max(oni$ano))
safras <- rbindlist(lapply(anos_safra, function(t) {
  jan <- oni[(ano == t - 1L & mes %in% SAFRA_MESES_PREV) |
             (ano == t      & mes %in% SAFRA_MESES_CURR)]
  if (nrow(jan) < 6L) return(NULL)  # safra incompleta (pontas da serie)
  pico  <- jan$oni[which.max(abs(jan$oni))]
  freq  <- sort(table(jan$fase), decreasing = TRUE)
  fase  <- names(freq)[1]
  if (length(freq) > 1L && freq[1] == freq[2]) {   # empate -> sinal do pico
    fase <- if (pico >= 0.5) "EN" else if (pico <= -0.5) "LN" else "N"
  }
  data.table(ano_safra = t, fase = fase, oni_pico = pico,
             forte = as.integer(abs(pico) >= ONI_FORTE))
}))

fwrite_site(safras, file.path(DIR_SITE_DATA, "oni_safras.csv"))
message("oni.csv: ", nrow(oni), " linhas | oni_safras.csv: ", nrow(safras),
        " safras (", min(safras$ano_safra), "-", max(safras$ano_safra), ")")
print(safras[forte == 1])
