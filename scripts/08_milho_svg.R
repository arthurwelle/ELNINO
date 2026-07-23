# 08_milho_svg.R — mini-mapa SVG estatico das UFs coloridas pela safra de milho
# dominante (1a verde, 2a laranja). Saida: site/geo/uf_milho.svg
# SVG nao depende de WebGL — renderiza em qualquer navegador e no headless.

source("scripts/00_config.R")
suppressPackageStartupMessages({
  library(sf)
  library(svglite)
})

uf <- st_read(file.path(DIR_GEO, "ufs.gpkg"), quiet = TRUE)
uf <- st_simplify(uf, dTolerance = 5000)  # simplifica p/ SVG leve

dom <- fread(file.path(DIR_SITE_DATA, "milho_safra_uf.csv"))
uf <- merge(uf, dom, by.x = "abbrev_state", by.y = "uf", all.x = TRUE)

COR1 <- "#1baf7a"; COR2 <- "#eb6834"; CINZA <- "#888888"
uf$cor <- fifelse(uf$safra_dominante == 2L, COR2,
                  fifelse(uf$safra_dominante == 1L, COR1, CINZA))

out_svg <- file.path(DIR_ROOT, "site", "geo", "uf_milho.svg")
svglite(out_svg, width = 6, height = 6, bg = "transparent")
par(mar = c(0, 0, 0, 0))
plot(st_geometry(uf), col = uf$cor, border = "#0d1117", lwd = 0.6)
invisible(dev.off())

message("uf_milho.svg gerado (", sum(!is.na(uf$safra_dominante)), " UFs coloridas).")
