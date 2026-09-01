# 03_pam.R — PAM 1974-2024 -> site/data/anual/<geocod>.csv (1 linha por ano x cultura)
# Metrica principal: anomalia % vs tendencia loess (>= LOESS_MIN_ANOS anos validos);
# fallback: delta % ano-a-ano (cap +-DELTA_CAP).

source("scripts/00_config.R")
suppressPackageStartupMessages(library(arrow))

pam <- fread(DIR_PAM, encoding = "UTF-8", colClasses = list(character = "id_municipio"))

# normaliza culturas e filtra as da v1 (exclui Abacaxi: mil frutos; Outras: mix)
mapa_cultura <- c(soja = "soja", milho = "milho", arroz = "arroz",
                  "feijão" = "feijao", trigo = "trigo", cana = "cana")
pam[, cultura := mapa_cultura[grupo_produto]]
pam <- pam[!is.na(cultura)]

# --- milho 1a/2a safra (SIDRA tabela 839, formato longo) -------------------
DIR_MILHO <- file.path(DIR_DATA, "pam", "milho.csv")
if (file.exists(DIR_MILHO)) {
  m <- fread(DIR_MILHO, skip = 1, encoding = "UTF-8",
             colClasses = "character", na.strings = c("-", "", "..", "..."))
  setnames(m, 1:5, c("id_municipio", "ano", "variavel", "produto", "valor"))
  m[, cultura := fifelse(grepl("1", produto), "milho1",
                  fifelse(grepl("2", produto), "milho2", NA_character_))]
  m <- m[!is.na(cultura) & !is.na(valor)]
  m[, `:=`(ano = as.integer(ano), valor = as.numeric(valor))]
  m[, campo := fcase(
    grepl("plantada", variavel), "area_plantada",
    grepl("colhida",  variavel), "area_colhida",
    grepl("produzida", variavel), "quantidade_produzida")]
  m <- m[!is.na(campo)]
  milho <- dcast(m, id_municipio + ano + cultura ~ campo, value.var = "valor")
  milho[, valor_producao := NA_real_]
  pam <- rbind(pam[, .(id_municipio, ano, cultura, area_plantada, area_colhida,
                       quantidade_produzida, valor_producao)],
               milho[, .(id_municipio, ano, cultura, area_plantada, area_colhida,
                         quantidade_produzida, valor_producao)])
  message("milho 1a/2a safra integrado: ", nrow(milho), " linhas")
}

pam[, rend_kg_ha := fifelse(!is.na(area_colhida) & area_colhida > 0,
                            1000 * quantidade_produzida / area_colhida, NA_real_)]

setorder(pam, id_municipio, cultura, ano)

# calc_metrica_rendimento agora vem de 00_config.R (compartilhado com 07_estado.R)
pam[, c("anom_rend_pct", "delta_rend_pct") :=
      calc_metrica_rendimento(ano, rend_kg_ha), by = .(id_municipio, cultura)]

# segunda tendencia, so para exibicao comparativa no grafico de rendimento
pam[, tend_gam_log := calc_tend_gam_log(ano, rend_kg_ha), by = .(id_municipio, cultura)]

# --- safra de milho dominante por UF (gerado aqui; usado por 07 e 08) -------
pam[, uf := UF_COD[substr(id_municipio, 1, 2)]]
if (any(c("milho1", "milho2") %in% pam$cultura)) {
  dom <- pam[cultura %in% c("milho1", "milho2") & ano >= 2003,
             .(q = sum(quantidade_produzida, na.rm = TRUE)), by = .(uf, cultura)]
  dom <- dcast(dom, uf ~ cultura, value.var = "q", fill = 0)
  dom[, safra_dominante := fifelse(get("milho2") > get("milho1"), 2L, 1L)]
  fwrite_site(dom[, .(uf, safra_dominante)],
              file.path(DIR_SITE_DATA, "milho_safra_uf.csv"))
  pam <- merge(pam, dom[, .(uf, safra_dominante)], by = "uf", all.x = TRUE)
} else {
  pam[, safra_dominante := NA_integer_]
}

# --- tabela de janelas ENSO por (uf, cultura) a partir do calendario CONAB --
conab <- fread(file.path(DIR_DATA, "CONAB", "calendario_plantio_conab.csv"),
               sep = ";", encoding = "UTF-8", na.strings = "")
conab[, cultura_site := fcase(
  cultura == "Soja", "soja",
  cultura == "Milho 1ª Safra", "milho1",
  cultura == "Milho 2ª Safra", "milho2",
  cultura == "Arroz", "arroz",
  cultura == "Feijão 1ª Safra", "feijao",
  cultura == "Trigo", "trigo")]
conab <- conab[!is.na(cultura_site) & !is.na(mes_inicio_plantio)]
conab[, P := MESES_PT[tolower(mes_inicio_plantio)]]

# moda nacional do mes de plantio por cultura (fallback UF sem dado)
moda <- function(x) { u <- unique(x); u[which.max(tabulate(match(x, u)))] }
moda_cult <- conab[, .(P_moda = moda(P)), by = cultura_site]

ufs <- unname(UF_COD)
culturas_janela <- c("soja", "milho1", "milho2", "arroz", "feijao", "trigo")
grade <- CJ(uf = ufs, cultura = culturas_janela, unique = TRUE)
grade <- merge(grade, conab[, .(uf, cultura = cultura_site, P)],
               by = c("uf", "cultura"), all.x = TRUE)
grade <- merge(grade, moda_cult, by.x = "cultura", by.y = "cultura_site", all.x = TRUE)
grade[, origem := fifelse(is.na(P), "moda", "conab")]  # antes do fallback
grade[is.na(P), P := P_moda]
grade[, mes_plantio := MESES_LAB[P]]
grade[, c("mes_centro", "ano_offset", "janela_label") := janela_from_plantio(P)]

# milho total: segue a safra dominante da UF (usa a janela de milho1 ou milho2)
milho_tot <- merge(unique(pam[, .(uf, safra_dominante)]),
                   grade[cultura %in% c("milho1", "milho2")],
                   by.x = "uf", by.y = "uf", allow.cartesian = TRUE)
milho_tot <- milho_tot[(safra_dominante == 2L & cultura == "milho2") |
                       ((is.na(safra_dominante) | safra_dominante == 1L) &
                          cultura == "milho1")]
milho_tot[, cultura := "milho"]
milho_tot <- milho_tot[, .(uf, cultura, P, mes_plantio, mes_centro, ano_offset,
                           janela_label, origem)]

# cana: sem CONAB -> janela fixa DJF (dez-jan-fev)
cana <- data.table(uf = ufs, cultura = "cana", P = NA_integer_, mes_plantio = NA_character_,
                   mes_centro = 1L, ano_offset = 0L,
                   janela_label = "dez–jan–fev", origem = "padrao")

janelas <- rbind(grade, milho_tot, cana, fill = TRUE)
fwrite_site(janelas[, .(uf, cultura, mes_plantio, mes_centro, ano_offset,
                        janela_label, origem)],
            file.path(DIR_SITE_DATA, "janela_cultura_uf.csv"))

# --- fase ENSO por janela (uf, cultura), no ano-safra + ano_offset ----------
oni <- fread(file.path(DIR_SITE_DATA, "oni.csv"))  # ano, mes, roni, oni, fase
pam <- merge(pam, janelas[, .(uf, cultura, mes_centro, ano_offset)],
             by = c("uf", "cultura"), all.x = TRUE)
pam[, ano_oni := ano + ano_offset]
pam <- merge(pam, oni[, .(ano, mes, roni, fase)],
             by.x = c("ano_oni", "mes_centro"), by.y = c("ano", "mes"), all.x = TRUE)
pam[, `:=`(roni_pico = round(roni, 2),
           forte = as.integer(abs(roni) >= ONI_FORTE))]

# clima da safra (out-mar) — janela climatica geral, independe da cultura
clima <- setDT(read_parquet(file.path(DIR_DERIVED, "safra_clima.parquet")))
out <- merge(pam, clima, by.x = c("id_municipio", "ano"),
             by.y = c("geocod", "ano_safra"), all.x = TRUE)

out <- out[, .(
  geocod = id_municipio, ano, cultura,
  area_plantada_ha = area_plantada, area_colhida_ha = area_colhida,
  producao_t = quantidade_produzida, valor_mil_reais = valor_producao,
  rend_kg_ha = round(rend_kg_ha), anom_rend_pct, delta_rend_pct, tend_gam_log,
  fase, forte, roni_pico,
  chuva_out_mar_mm, veranico_max_out_mar, dias_tmax34_out_mar
)]
setorder(out, geocod, cultura, ano)

# 1 CSV por municipio (so anos com alguma cultura reportada)
out <- out[!is.na(rend_kg_ha) | !is.na(area_plantada_ha)]
n <- 0L
for (g in unique(out$geocod)) {
  fwrite_site(out[geocod == g, !"geocod"], file.path(DIR_SITE_ANUAL, paste0(g, ".csv")))
  n <- n + 1L
}

# agregado para o 04_resumo (media da anomalia em safras EN por cultura)
write_parquet(out, file.path(DIR_DERIVED, "pam_anual.parquet"))
message("anual/: ", n, " municipios | linhas totais: ", nrow(out),
        " | com loess: ", out[!is.na(anom_rend_pct), .N])
message("Mediana rend soja (kg/ha): ",
        out[cultura == "soja" & ano >= 2015, round(median(rend_kg_ha, na.rm = TRUE))])
