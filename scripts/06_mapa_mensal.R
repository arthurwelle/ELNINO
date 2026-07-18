# 06_mapa_mensal.R — cortes nacionais indicador x mes para o explorador do mapa.
# Le site/data/mensal/*.csv (ja gerados pelo 02) e grava, para cada indicador e mes,
# a media por fase ENSO + media geral de cada municipio:
#   site/data/mapa/<indicador>_<mes>.csv  (code_muni, en, ln, n, med)
# Fase do mes = fase da safra a que pertence (jul-dez -> safra ano+1; jan-jun -> ano).

source("scripts/00_config.R")
suppressPackageStartupMessages(library(future.apply))

INDICADORES <- c("rain_mm", "bal_mm", "spei1", "spei3", "spei6", "spei12",
                 "tmax_med", "dias_tmax34", "veranico_max")

DIR_MAPA <- file.path(DIR_SITE_DATA, "mapa")
if (!dir.exists(DIR_MAPA)) dir.create(DIR_MAPA)

safras <- fread(file.path(DIR_SITE_DATA, "oni_safras.csv"))
fase_por_safra <- setNames(safras$fase, safras$ano_safra)

arqs <- list.files(DIR_SITE_MENSAL, pattern = "\\.csv$", full.names = TRUE)
message("Lendo ", length(arqs), " mensais...")

plan(multisession, workers = max(1L, availableCores() - 2L))
partes <- future_lapply(arqs, function(f) {
  dt <- fread(f, select = c("data", INDICADORES))
  dt[, `:=`(ano = as.integer(substr(data, 1, 4)),
            mes = as.integer(substr(data, 6, 7)))]
  dt[, safra := fifelse(mes >= 7L, ano + 1L, ano)]
  dt[, fase := fase_por_safra[as.character(safra)]]
  dt <- dt[!is.na(fase)]
  long <- melt(dt, id.vars = c("mes", "fase"), measure.vars = INDICADORES,
               variable.name = "ind", value.name = "v", variable.factor = FALSE)
  long <- long[!is.na(v)]
  agg <- long[, .(med_fase = mean(v)), by = .(ind, mes, fase)]
  geral <- long[, .(med = mean(v)), by = .(ind, mes)]
  out <- dcast(agg, ind + mes ~ fase, value.var = "med_fase")
  out <- merge(out, geral, by = c("ind", "mes"))
  out[, code_muni := sub("\\.csv$", "", basename(f))]
  out
})
plan(sequential)

tudo <- rbindlist(partes, fill = TRUE)
setnames(tudo, c("EN", "LN", "N"), c("en", "ln", "n"), skip_absent = TRUE)

n_arq <- 0L
for (i in INDICADORES) {
  for (m in 1:12) {
    sub <- tudo[ind == i & mes == m,
                .(code_muni, en = round(en, 2), ln = round(ln, 2),
                  n = round(n, 2), med = round(med, 2))]
    setorder(sub, code_muni)
    fwrite_site(sub, file.path(DIR_MAPA, paste0(i, "_", m, ".csv")))
    n_arq <- n_arq + 1L
  }
}
message("mapa/: ", n_arq, " arquivos (", length(INDICADORES), " indicadores x 12 meses)")
