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
cols_novas <- c("soma_termica", "srad_mj")
for (f in amostra) {
  dt <- fread(f)
  if (nrow(dt) != 552L) falha(basename(f), ": ", nrow(dt), " linhas (esperado 552)")
  if (any(vapply(dt, function(c) any(is.infinite(c)), logical(1)))) falha(basename(f), ": Inf presente")
  if (!all(cols_novas %in% names(dt))) falha(basename(f), ": faltam colunas soma_termica/srad_mj")
}
message("amostra de ", length(amostra), " mensais: linhas, Inf e colunas ok")

# estado/ (uma UF por arquivo)
est <- list.files(file.path(DIR_SITE_DATA, "estado"), pattern = "\\.csv$")
message("estado/: ", length(est), " UFs")
if (length(est) < 20L) falha("estado/ com menos de 20 UFs")

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
sem_coord <- resumo[is.na(lon) | is.na(lat), .N]
message("resumo sem lon/lat: ", sem_coord)
if (sem_coord > nrow(resumo) * 0.01) falha("mais de 1% dos municipios sem centroide")

# regiao intermediaria (RGI): series por regiao, bordas e cobertura do de-para
rgi_files <- list.files(file.path(DIR_SITE_DATA, "rgi"), pattern = "\\.csv$")
message("rgi/: ", length(rgi_files), " regioes")
if (length(rgi_files) < 130L) falha("rgi/ com menos de 130 regioes")
geo_rgi <- file.path(DIR_ROOT, "site", "geo", "rgi.geojson")
if (!file.exists(geo_rgi)) falha("site/geo/rgi.geojson ausente")

# concentracao da producao: ranking por cultura (filtro do mapa)
conc <- list.files(file.path(DIR_SITE_DATA, "concentracao"), pattern = "\\.csv$",
                   full.names = TRUE)
message("concentracao/: ", length(conc), " culturas")
if (length(conc) < 6L) falha("concentracao/ com menos de 6 culturas")
for (f in conc) {
  d <- fread(f)
  if (is.unsorted(d[["pct_acum"]])) falha(basename(f), ": pct_acum nao monotonico")
  if (abs(tail(d[["pct_acum"]], 1) - 100) > 0.5) {
    falha(basename(f), ": pct_acum termina em ", tail(d[["pct_acum"]], 1))
  }
}
if ("cod_rgi" %in% names(resumo)) {
  sem_rgi <- resumo[is.na(cod_rgi), .N]
  message("resumo sem cod_rgi: ", sem_rgi)
  if (sem_rgi > nrow(resumo) * 0.01) falha("mais de 1% dos municipios sem regiao")
} else {
  falha("resumo.csv sem coluna cod_rgi")
}

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
message("mapa/: ", length(mapa), " arquivos (esperado 120)")
if (length(mapa) != 120L) falha("contagem mapa/ difere de 10 indicadores x 12 meses")

# 5. tamanho total do site/data
tam <- sum(file.info(list.files(DIR_SITE_DATA, recursive = TRUE, full.names = TRUE))$size)
message("site/data total: ", round(tam / 1024^2), " MB")

if (nfail == 0L) message(">>> VALIDACAO OK") else stop(nfail, " falhas de validacao")
