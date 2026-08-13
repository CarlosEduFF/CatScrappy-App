// src/useHistorico.js — histórico de vistos de UMA série/mangá.
//
// Diferente dos favoritos (lista global pequena), o histórico é grande e por
// série (One Piece tem 1000+). Então carrega sob demanda os vistos daquela
// série específica e mantém só esses em memória. Requer login.
//
// A conta é compartilhada entre builds, mas aqui não há o risco que existe
// nos favoritos: a consulta é sempre por (tipo, site, item_id) de uma tela
// já aberta neste app, e o servidor filtra por esses campos — registros de
// fontes que este app não tem nunca entram no resultado.

import { useCallback, useEffect, useState } from "react";
import { useSessao } from "./sessao";
import { listarHistorico, marcarVisto, desmarcarVisto } from "./api";

// Identidade estável de um episódio/capítulo dentro da série.
function chave(episodioId) {
  return String(episodioId);
}

export function useHistorico({ tipo, site, itemId }) {
  const { token, logado, renovar } = useSessao();
  // Set de episodio_id vistos (busca O(1) para pintar a lista).
  const [vistos, setVistos] = useState(() => new Set());
  const [carregado, setCarregado] = useState(false);

  const alvo = { tipo, site, item_id: itemId };

  const recarregar = useCallback(async () => {
    if (!token || !itemId) {
      setVistos(new Set());
      setCarregado(true);
      return;
    }
    try {
      const lista = await listarHistorico(token, alvo);
      setVistos(new Set(lista.map((h) => chave(h.episodio_id))));
    } catch (e) {
      // Access token expirado: renova e tenta de novo antes de desistir,
      // senão o histórico apareceria vazio (nada marcado como visto).
      let ok = false;
      if (e.status === 401) {
        try {
          const novo = await renovar?.();
          if (novo) {
            const lista = await listarHistorico(novo, alvo);
            setVistos(new Set(lista.map((h) => chave(h.episodio_id))));
            ok = true;
          }
        } catch (e2) {
          // Continua para o fallback abaixo.
        }
      }
      // Sem histórico visível não deve travar a tela.
      if (!ok) setVistos(new Set());
    } finally {
      setCarregado(true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token, tipo, site, itemId]);

  useEffect(() => {
    recarregar();
  }, [recarregar]);

  function estaVisto(episodioId) {
    return vistos.has(chave(episodioId));
  }

  // Marca como visto (idempotente); usado ao abrir o episódio/capítulo.
  async function marcar(item) {
    if (!token) return; // sem login, apenas ignora (recurso é logado)
    const k = chave(item.episodio_id);
    if (vistos.has(k)) return;
    setVistos((atual) => new Set(atual).add(k));
    try {
      await marcarVisto(token, { ...alvo, ...item });
    } catch (e) {
      recarregar(); // desfaz o otimismo se falhar
    }
  }

  // Alterna visto/não-visto (botão manual).
  async function alternar(item) {
    if (!token) throw new Error("Entre na sua conta para salvar o histórico.");
    const k = chave(item.episodio_id);
    const jaVisto = vistos.has(k);
    setVistos((atual) => {
      const novo = new Set(atual);
      if (jaVisto) novo.delete(k);
      else novo.add(k);
      return novo;
    });
    try {
      if (jaVisto) {
        await desmarcarVisto(token, { ...alvo, episodio_id: item.episodio_id });
      } else {
        await marcarVisto(token, { ...alvo, ...item });
      }
    } catch (e) {
      recarregar();
      throw e;
    }
  }

  return {
    logado,
    carregado,
    total: vistos.size,
    estaVisto,
    marcar,
    alternar,
    recarregar,
  };
}
