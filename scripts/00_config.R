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
GDD_BASE      <- 10   # graus C: base da soma termica (GDD), clip em 0

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

# codigo IBGE (2 primeiros digitos do geocodigo) -> sigla da UF
UF_COD <- c("11"="RO","12"="AC","13"="AM","14"="RR","15"="PA","16"="AP","17"="TO",
            "21"="MA","22"="PI","23"="CE","24"="RN","25"="PB","26"="PE","27"="AL",
            "28"="SE","29"="BA","31"="MG","32"="ES","33"="RJ","35"="SP","41"="PR",
            "42"="SC","43"="RS","50"="MS","51"="MT","52"="GO","53"="DF")

# Janela ENSO por cultura (mes central do trimestre RONI, no ano da colheita):
# DJF=1 (1a safra de verao), SON=10 (trigo, inverno), MAM=4 (milho 2a safra/safrinha).
# milho total segue a safra dominante da UF (1->DJF, 2->MAM).
janela_mes <- function(cultura, safra_dominante_uf = NA_integer_) {
  fifelse(cultura == "trigo", 10L,
   fifelse(cultura == "milho2", 4L,
    fifelse(cultura == "milho1", 1L,
     fifelse(cultura == "milho",
             fifelse(!is.na(safra_dominante_uf) & safra_dominante_uf == 2L, 4L, 1L),
             1L))))  # soja, arroz, feijao, cana -> DJF
}

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

# anomalia % de rendimento vs tendencia loess (>= LOESS_MIN_ANOS anos validos);
# fallback: delta % ano-a-ano (cap +-DELTA_CAP). Usado por 03_pam.R e 07_estado.R.
calc_metrica_rendimento <- function(ano, rend) {
  delta <- 100 * (rend / shift(rend) - 1)
  delta <- pmax(pmin(delta, DELTA_CAP), -DELTA_CAP)
  ok <- which(!is.na(rend) & rend > 0)
  anom <- rep(NA_real_, length(rend))
  if (length(ok) >= LOESS_MIN_ANOS) {
    fit <- tryCatch(
      loess(rend[ok] ~ ano[ok], span = LOESS_SPAN, degree = 2, family = "symmetric"),
      error = function(e) NULL)
    if (!is.null(fit)) {
      tend <- predict(fit)
      tend[tend <= 0] <- NA_real_
      anom[ok] <- 100 * (rend[ok] - tend) / tend
    }
  }
  list(anom = round(anom, 1), delta = round(delta, 1))
}

# maior sequencia de TRUE consecutivos
max_run <- function(x) {
  x[is.na(x)] <- FALSE
  r <- rle(x)
  m <- r$lengths[r$values]
  if (length(m) == 0L) 0L else max(m)
}
