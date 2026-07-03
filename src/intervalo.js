// src/intervalo.js — seleção de intervalo (início/fim) por número.
//
// Alert.prompt só existe no iOS, então usamos um mini-modal próprio, exposto
// como uma função async que resolve com a lista filtrada (ou null se cancelar).
// O componente <IntervaloModal /> precisa estar montado uma vez na árvore.

import { createRef } from "react";

// Ref para o modal montado no layout raiz.
export const intervaloRef = createRef();

// Filtra itens (com .numero) cujo número cai em [inicio, fim].
export function filtrarIntervalo(itens, inicio, fim) {
  if (inicio > fim) [inicio, fim] = [fim, inicio];
  return itens.filter((it) => {
    const n = parseFloat(it.numero);
    return !isNaN(n) && n >= inicio && n <= fim;
  });
}

// Abre o modal e resolve com a fatia selecionada (ou null).
export function pedirIntervalo(itens, unidade) {
  return new Promise((resolve) => {
    if (!intervaloRef.current) {
      resolve(null);
      return;
    }
    intervaloRef.current.abrir(itens, unidade, resolve);
  });
}
