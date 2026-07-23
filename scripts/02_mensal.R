# 02_mensal.R — le o diario (xavier) + indices mensais por municipio e gera:
#   site/data/mensal/<geocod>.csv          (552 linhas, mensal 1980-01..2025-12)
#   DATA/derived/safra_clima.parquet       (geocod x ano_safra, agregados out-mar)
#   DATA/derived/climatologia_mensal.parquet (media mensal 1980-2025 por geocod)
# Uso: Rscript scripts/02_mensal.R [N]   (N = piloto com N municipios; omitir = todos)

source("scripts/00_config.R")
suppressPackageStartupMessages({
  library(future.apply)
  library(arrow)
})

args   <- commandArgs(trailingOnly = TRUE)
geocods <- geocods_disponiveis()
if (length(args) >= 1L) geocods <- head(geocods, as.integer(args[1]))
message("Processando ", length(geocods), " municipios...")

SAFRAS_VALIDAS <- 1981:2025  # 1a safra completa: out/1980-mar/1981

processa_municipio <- function(g) {
  xav <- fread(file.path(DIR_XAVIER,  paste0(g, ".csv.gz")))
  ind <- fread(file.path(DIR_INDICES, paste0(g, ".csv.gz")))

  # --- derivadas mensais do diario -----------------------------------------
  xav[, seco := RAIN < LIMIAR_SECO]
  mensal_xav <- xav[, .(
    tmax_med     = round(mean(TMAX), 1),
    tmin_med     = round(mean(TMIN), 1),
    dias_tmax34  = sum(TMAX > LIMIAR_TMAX),
    dias_chuva10 = sum(RAIN >= LIMIAR_CHUVA10),
    veranico_max = max_run(seco),
    soma_termica = round(sum(pmax(0, (TMAX + TMIN) / 2 - GDD_BASE))),  # GDD base 10
    srad_mj      = round(sum(SRAD))                                    # radiacao acum. mensal
  ), by = .(year, month)]

  # --- indices mensais: -Inf/Inf -> NA, data -> YYYY-MM --------------------
  for (col in c("SPI_1","SPEI_1","SPI_3","SPEI_3","SPI_6","SPEI_6","SPI_12","SPEI_12")) {
    set(ind, i = which(!is.finite(ind[[col]])), j = col, value = NA_real_)
  }
  ind[, `:=`(year = year(data), month = month(data))]

  m <- merge(ind, mensal_xav, by = c("year", "month"), all.x = TRUE)
  setorder(m, year, month)
  out <- m[, .(
    data = sprintf("%04d-%02d", year, month),
    rain_mm = RAIN_mm, etp_mm = round(ETP_mm, 1), bal_mm = round(BAL, 1),
    spi1 = round(SPI_1, 2),  spei1 = round(SPEI_1, 2),
    spi3 = round(SPI_3, 2),  spei3 = round(SPEI_3, 2),
    spi6 = round(SPI_6, 2),  spei6 = round(SPEI_6, 2),
    spi12 = round(SPI_12, 2), spei12 = round(SPEI_12, 2),
    tmax_med, tmin_med, dias_tmax34, dias_chuva10, veranico_max,
    soma_termica, srad_mj
  )]
  fwrite_site(out, file.path(DIR_SITE_MENSAL, paste0(g, ".csv")))

  # --- agregados por safra (out-mar) sobre o diario ------------------------
  xav[, data_d := as.IDate(sprintf("%d-%02d-%02d", year, month, day))]
  safra <- rbindlist(lapply(SAFRAS_VALIDAS, function(t) {
    jan <- xav[(year == t - 1L & month %in% SAFRA_MESES_PREV) |
               (year == t      & month %in% SAFRA_MESES_CURR)]
    if (nrow(jan) < 150L) return(NULL)
    # onset: busca de 1/set(t-1) a 31/jan(t)
    w <- xav[data_d >= as.IDate(sprintf("%d-09-01", t - 1L)) &
             data_d <= as.IDate(sprintf("%d-01-31", t))]
    onset <- NA_integer_
    if (nrow(w) > ONSET_CHECK) {
      acc3 <- frollsum(w$RAIN, ONSET_JANELA, align = "left")
      for (i in seq_len(nrow(w) - ONSET_CHECK)) {
        if (!is.na(acc3[i]) && acc3[i] >= ONSET_ACC) {
          seg <- w$RAIN[(i + 1):min(i + ONSET_CHECK, nrow(w))] < LIMIAR_SECO
          if (max_run(seg) <= ONSET_SECA_MAX) { onset <- i - 1L; break }
        }
      }
    }
    spei3_mar <- ind[year == t & month == 3L, SPEI_3]
    data.table(
      geocod = g, ano_safra = t,
      chuva_out_mar_mm     = sum(jan$RAIN),
      veranico_max_out_mar = max_run(jan$RAIN < LIMIAR_SECO),
      dias_tmax34_out_mar  = sum(jan$TMAX > LIMIAR_TMAX),
      onset_dias           = onset,   # dias apos 1/set; NA = sem onset ate 31/jan
      spei3_mar            = if (length(spei3_mar)) round(spei3_mar, 2) else NA_real_
    )
  }))

  clim <- xav[, .(geocod = g, rain_med_mm = round(sum(RAIN) / uniqueN(year), 1),
                  tmax_med = round(mean(TMAX), 1)), by = month]

  list(safra = safra, clim = clim)
}

plan(multisession, workers = max(1L, availableCores() - 2L))
res <- future_lapply(geocods, function(g) {
  tryCatch(processa_municipio(g),
           error = function(e) { message(g, ": ERRO ", conditionMessage(e)); NULL })
}, future.seed = NULL)
plan(sequential)

falhas <- sum(vapply(res, is.null, logical(1)))
res <- Filter(Negate(is.null), res)
write_parquet(rbindlist(lapply(res, `[[`, "safra")),
              file.path(DIR_DERIVED, "safra_clima.parquet"))
write_parquet(rbindlist(lapply(res, `[[`, "clim")),
              file.path(DIR_DERIVED, "climatologia_mensal.parquet"))
message("Concluido: ", length(res), " municipios ok, ", falhas, " falhas.")
