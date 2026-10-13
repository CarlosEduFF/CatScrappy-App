// src/ordem.js — ordem de exibição das listas de episódios/capítulos.
//
// As listas ficam em ordem crescente nos dados (playlist, download de
// temporada e intervalo dependem disso); só a tela mostra do mais recente
// para o mais antigo. Quando alguma fonte já entregar a lista decrescente
// (ex.: vinda do servidor), inverter de novo a deixaria do mais antigo para
// o mais novo — por isso a ordem é decidida pelos números, não por um
// reverse cego.

function numero(item) {
  const n = parseFloat(item?.numero);
  return Number.isFinite(n) ? n : null;
}

// Devolve uma cópia com o maior número primeiro. Sem números comparáveis
// (primeiro/último não numéricos), assume a convenção do app (crescente) e
// inverte.
export function maisRecentesPrimeiro(itens) {
  if (!itens || itens.length < 2) return itens || [];
  const primeiro = numero(itens[0]);
  const ultimo = numero(itens[itens.length - 1]);
  const jaDecrescente =
    primeiro !== null && ultimo !== null && primeiro > ultimo;
  return jaDecrescente ? [...itens] : [...itens].reverse();
}
