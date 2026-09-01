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

# Janela ENSO data-driven (calendario CONAB): janela = 3 meses a partir do mes de
# plantio + 1. O centro (plantio+2) casa com um trimestre RONI. Atribuicao ao ano-safra:
# plantio jul-dez -> ciclo do ano t-1; jan-jun -> ano t.
MESES_PT <- c(jan=1L, fev=2L, mar=3L, abr=4L, mai=5L, jun=6L,
              jul=7L, ago=8L, set=9L, out=10L, nov=11L, dez=12L)
MESES_LAB <- c("jan","fev","mar","abr","mai","jun",
               "jul","ago","set","out","nov","dez")

# dado mes de plantio P (1-12), retorna data.table(mes_centro, ano_offset, janela_label)
# ano_offset: colheita no ano seguinte (plantio out-dez) -> ciclo do ano t-1; caso
# contrario (plantio jan-set, colheita no mesmo ano) -> ano t.
janela_from_plantio <- function(P) {
  p_off <- fifelse(P >= 10L, -1L, 0L)
  cidx  <- P + 2L
  bump  <- fifelse(cidx > 12L, 1L, 0L)
  cidx  <- fifelse(cidx > 12L, cidx - 12L, cidx)
  wrap  <- function(m) ((m - 1L) %% 12L) + 1L
  lab   <- paste(MESES_LAB[wrap(P + 1L)], MESES_LAB[wrap(P + 2L)],
                 MESES_LAB[wrap(P + 3L)], sep = "–")
  data.table(mes_centro = cidx, ano_offset = p_off + bump, janela_label = lab)
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

# Tendencia alternativa por GAM na escala log, para comparacao visual nos graficos
# de rendimento. Motivo: o loess de grau 2 extrapola nas bordas da serie e chega a
# devolver tendencia proxima de zero (Salto do Jacui/RS, soja, 2024). O GAM penalizado
# escolhe a suavidade por REML em cada serie e a escala log mantem a tendencia positiva.
# Devolve o vetor de tendencia em kg/ha (NA onde nao ha ajuste). Ver o relatorio em
# Ajuste_produtividade/ para a comparacao completa dos suavizadores.
GAM_K_MAX <- 10L

calc_tend_gam_log <- function(ano, rend) {
  out <- rep(NA_real_, length(rend))
  ok  <- which(!is.na(rend) & rend > 0)
  n   <- length(ok)
  if (n < LOESS_MIN_ANOS) return(out)   # mesmo piso do loess
  k <- max(3L, min(GAM_K_MAX, floor(n / 4)))
  fit <- tryCatch(
    mgcv::gam(y ~ s(ano, bs = "tp", k = k),
              data = data.frame(ano = ano[ok], y = log(rend[ok])), method = "REML"),
    error = function(e) NULL)
  if (is.null(fit)) return(out)
  tend <- exp(as.numeric(predict(fit)))
  tend[!is.finite(tend) | tend <= 0] <- NA_real_
  out[ok] <- round(tend)
  out
}

# maior sequencia de TRUE consecutivos
max_run <- function(x) {
  x[is.na(x)] <- FALSE
  r <- rle(x)
  m <- r$lengths[r$values]
  if (length(m) == 0L) 0L else max(m)
}
