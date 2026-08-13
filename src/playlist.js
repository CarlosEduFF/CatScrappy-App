// src/playlist.js — lista aberta no momento (episódios de um anime ou
// capítulos de um mangá), para o player/leitor saber quem vem antes e depois.
//
// Os params de navegação não servem para isso: a lista pode ter 1000+ itens
// (One Piece) e serializá-la na URL a cada troca de episódio seria caro e
// esbarraria no limite de tamanho. Como só existe uma lista aberta por vez,
// um módulo em memória resolve — a tela de listagem publica, o player lê.
//
// Não é persistido de propósito: se o app for morto e restaurado direto no
// player, os botões somem (vizinhos desconhecidos) em vez de apontarem para
// uma lista velha de outro anime.

let atual = { tipo: null, site: null, itemId: null, itens: [] };

// Chamado pela tela de lista ao carregar. `itens` são os objetos crus da
// lista, e `chave` extrai o id que identifica cada um (url_pagina para
// episódios, id para capítulos).
export function definirPlaylist({ tipo, site, itemId, itens, chave }) {
  atual = {
    tipo,
    site,
    itemId,
    itens: (itens || []).map((it) => ({ id: chave(it), item: it })),
  };
}

// Vizinhos do item atual: { anterior, proximo, indice, total }.
// Cada vizinho é o objeto cru da lista (ou null nas pontas).
export function vizinhos(tipo, site, id) {
  // Playlist de outra tela/aba não vale para este item.
  if (atual.tipo !== tipo || atual.site !== site) return VAZIO;

  const i = atual.itens.findIndex((e) => e.id === id);
  if (i < 0) return VAZIO;

  return {
    anterior: i > 0 ? atual.itens[i - 1].item : null,
    proximo: i < atual.itens.length - 1 ? atual.itens[i + 1].item : null,
    indice: i,
    total: atual.itens.length,
  };
}

const VAZIO = { anterior: null, proximo: null, indice: -1, total: 0 };
