# 00_config.R — caminhos, constantes e helpers compartilhados pelo pipeline
# Rodar sempre a partir da raiz do projeto (ELNINO/).

suppressPackageStartupMessages({
  library(data.table)
})

DIR_ROOT    <- normalizePath(".", winslash = "/")
DIR_DATA    <- file.path(DIR_ROOT, "DATA")
DIR_XAVIER  <- file.path(DIR_DATA, "xavier")
DIR_INDICES <- file.path(DIR_DATA, "indices")
DIR_PAM     <- file.path(DIR_DATA, "pam", "PAM_1974_2024_Mun_Cultura.csv")
DIR_DERIVED <- file.path(DIR_DATA, "derived")
DIR_GEO     <- file.path(DIR_ROOT, "GEO")

DIR_SITE_DATA   <- file.path(DIR_ROOT, "site", "data")
DIR_SITE_MENSAL <- file.path(DIR_SITE_DATA, "mensal")
DIR_SITE_ANUAL  <- file.path(DIR_SITE_DATA, "anual")

for (d in c(DIR_DERIVED, DIR_SITE_MENSAL, DIR_SITE_ANUAL)) {
  if (!dir.exists(d)) dir.create(d, recursive = TRUE)
}

# --- constantes das metricas derivadas -------------------------------------
LIMIAR_SECO   <- 1    # mm: dia com RAIN < 1 conta como seco (veranico)
LIMIAR_TMAX   <- 34   # graus C: dia de estresse termico
LIMIAR_CHUVA10 <- 10  # mm: dia de chuva significativa

# onset das chuvas: 1o dia a partir de 1/set com >= ONSET_ACC mm acumulados em
# ONSET_JANELA dias, sem sequencia seca > ONSET_SECA_MAX dias nos ONSET_CHECK
# dias seguintes. NA se nao ocorrer ate 31/jan.
ONSET_ACC      <- 20
ONSET_JANELA   <- 3
ONSET_SECA_MAX <- 10
ONSET_CHECK    <- 20

# safra out-mar: ano_safra t cobre out(t-1) a mar(t)
SAFRA_MESES_PREV <- c(10, 11, 12)  # meses do ano t-1
SAFRA_MESES_CURR <- c(1, 2, 3)     # meses do ano t

ONI_FORTE <- 1.5   # |ONI pico| >= 1.5 -> evento forte

LOESS_SPAN    <- 0.5
LOESS_MIN_ANOS <- 15   # minimo de anos validos p/ anomalia loess
DELTA_CAP     <- 200   # cap em % para delta ano-a-ano

CULTURAS <- c("soja", "milho", "arroz", "feijao", "trigo", "cana")

# --- helpers ----------------------------------------------------------------
geocods_disponiveis <- function() {
  gx <- sub("\\.csv\\.gz$", "", list.files(DIR_XAVIER,  pattern = "\\.csv\\.gz$"))
  gi <- sub("\\.csv\\.gz$", "", list.files(DIR_INDICES, pattern = "\\.csv\\.gz$"))
  sort(intersect(gx, gi))
}

# fwrite padrao do projeto: UTF-8, sem BOM, NA como celula vazia
fwrite_site <- function(dt, path) {
  fwrite(dt, path, na = "", bom = FALSE, quote = FALSE)
}

# maior sequencia de TRUE consecutivos
max_run <- function(x) {
  x[is.na(x)] <- FALSE
  r <- rle(x)
  m <- r$lengths[r$values]
  if (length(m) == 0L) 0L else max(m)
}
