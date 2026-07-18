# 05_validate.R — checks automatizados pos-pipeline.

source("scripts/00_config.R")
suppressPackageStartupMessages(library(jsonlite))

falha <- function(...) { message("FALHA: ", ...); assign("nfail", nfail + 1L, envir = .GlobalEnv) }
nfail <- 0L

# 1. contagem e forma dos mensais
mens <- list.files(DIR_SITE_MENSAL, pattern = "\\.csv$", full.names = TRUE)
message("mensal/: ", length(mens), " arquivos (esperado ", length(geocods_disponiveis()), ")")
if (length(mens) != length(geocods_disponiveis())) falha("contagem mensal difere dos geocods")

amostra <- sample(mens, min(200L, length(mens)))
for (f in amostra) {
  dt <- fread(f)
  if (nrow(dt) != 552L) falha(basename(f), ": ", nrow(dt), " linhas (esperado 552)")
  if (any(vapply(dt, function(c) any(is.infinite(c)), logical(1)))) falha(basename(f), ": Inf presente")
}
message("amostra de ", length(amostra), " mensais: linhas e Inf ok")

# 2. cobertura do join resumo x geojson
resumo <- fread(file.path(DIR_SITE_DATA, "resumo.csv"), colClasses = list(character = "code_muni"))
gj <- fromJSON(file.path(DIR_GEO, "municipios.geojson"), simplifyVector = TRUE)
geo_codes <- as.character(gj$features$properties$code_muni)
so_resumo <- setdiff(resumo$code_muni, geo_codes)
so_geo    <- setdiff(geo_codes, resumo$code_muni)
message("resumo sem poligono: ", length(so_resumo),
        if (length(so_resumo)) paste0(" [", paste(head(so_resumo, 5), collapse = ","), "]") else "")
message("poligono sem resumo: ", length(so_geo),
        if (length(so_geo)) paste0(" [", paste(head(so_geo, 5), collapse = ","), "]") else "")

# 3. sanidade PAM
anuais <- list.files(DIR_SITE_ANUAL, pattern = "\\.csv$", full.names = TRUE)
message("anual/: ", length(anuais), " arquivos")
am <- rbindlist(lapply(sample(anuais, min(300L, length(anuais))), fread), fill = TRUE)
med_soja <- am[cultura == "soja" & ano >= 2015, median(rend_kg_ha, na.rm = TRUE)]
message("mediana rend soja 2015+ (amostra): ", round(med_soja), " kg/ha")
if (!is.na(med_soja) && (med_soja < 2000 || med_soja > 4500)) falha("rendimento soja implausivel")
if (am[abs(delta_rend_pct) > DELTA_CAP, .N] > 0) falha("delta acima do cap")

# 4. cortes do explorador (indicador x mes)
mapa <- list.files(file.path(DIR_SITE_DATA, "mapa"), pattern = "\\.csv$")
message("mapa/: ", length(mapa), " arquivos (esperado 108)")
if (length(mapa) != 108L) falha("contagem mapa/ difere de 9 indicadores x 12 meses")

# 5. tamanho total do site/data
tam <- sum(file.info(list.files(DIR_SITE_DATA, recursive = TRUE, full.names = TRUE))$size)
message("site/data total: ", round(tam / 1024^2), " MB")

if (nfail == 0L) message(">>> VALIDACAO OK") else stop(nfail, " falhas de validacao")
