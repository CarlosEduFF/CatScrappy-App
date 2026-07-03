// src/useDownload.js — hook de estado de download em lote (progresso, resumo,
// cancelamento e ocultação). O progresso também vai para a barra de
// notificação (src/notificacoes.js), então dá para ocultar o overlay e
// acompanhar de fora do app.

import { useRef, useState } from "react";
import { Alert } from "react-native";
import * as Notificacoes from "./notificacoes";

export function useDownload() {
  const [emAndamento, setEmAndamento] = useState(false);
  const [oculto, setOculto] = useState(false);
  const [rotulo, setRotulo] = useState(""); // ex.: "Episódio 3/12"
  const [fracao, setFracao] = useState(0); // 0..1 do item atual
  const tokenRef = useRef(null);

  // executor(onItem, onProgress, token) deve retornar
  // { sucesso, falhas, cancelado }.
  async function rodar(executor, nomeUnidade = "item") {
    const token = { cancelado: false, abortar: null };
    tokenRef.current = token;
    setEmAndamento(true);
    setOculto(false);
    setFracao(0);
    setRotulo("Preparando...");
    await Notificacoes.iniciar();

    let rotuloAtual = nomeUnidade;
    try {
      const onItem = (i, total, item) => {
        rotuloAtual = `${nomeUnidade} ${i}/${total}`;
        setRotulo(rotuloAtual);
        setFracao(0);
      };
      const onProgress = (f) => {
        setFracao(f);
        Notificacoes.progresso(rotuloAtual, f);
      };

      const { sucesso, falhas, cancelado } = await executor(
        onItem,
        onProgress,
        token
      );

      const total = sucesso + falhas.length;
      const titulo = cancelado ? "Download cancelado" : "Download concluído";
      let msg = `${sucesso}/${total} baixado(s) com sucesso.`;
      if (falhas.length) {
        msg +=
          `\n\nNão baixados:\n` +
          falhas
            .map((f) => `• ${f.titulo}${f.erro ? `\n   (${f.erro})` : ""}`)
            .join("\n");
      }
      Notificacoes.concluir(titulo, `${sucesso}/${total} baixado(s).`);
      Alert.alert(titulo, msg);
    } catch (e) {
      Notificacoes.concluir("Erro no download", e.message);
      Alert.alert("Erro no download", e.message);
    } finally {
      setEmAndamento(false);
      tokenRef.current = null;
    }
  }

  // Marca o token e aborta o arquivo em andamento (se houver como).
  function cancelar() {
    const token = tokenRef.current;
    if (!token) return;
    token.cancelado = true;
    token.abortar?.();
    setRotulo("Cancelando...");
  }

  function ocultar() {
    setOculto(true);
  }

  return {
    // Overlay visível: em andamento e não ocultado pelo usuário.
    ativo: emAndamento && !oculto,
    emAndamento,
    rotulo,
    fracao,
    rodar,
    cancelar,
    ocultar,
  };
}
