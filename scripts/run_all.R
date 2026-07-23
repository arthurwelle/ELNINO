# run_all.R — pipeline completo (rodar da raiz do projeto).
# Rscript scripts/run_all.R

for (s in c("scripts/01_oni.R", "scripts/02_mensal.R", "scripts/03_pam.R",
            "scripts/07_estado.R", "scripts/04_resumo.R", "scripts/06_mapa_mensal.R",
            "scripts/08_milho_svg.R", "scripts/05_validate.R")) {
  message("\n========== ", s, " ==========")
  status <- system2(file.path(R.home("bin"), "Rscript"), s)
  if (status != 0) stop("Falha em ", s)
}
message("\nPipeline completo.")
