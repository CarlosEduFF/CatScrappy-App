// src/useDownload.js — hook de estado de download em lote (progresso + resumo).

import { useState } from "react";
import { Alert } from "react-native";

export function useDownload() {
  const [ativo, setAtivo] = useState(false);
  const [rotulo, setRotulo] = useState(""); // ex.: "Episódio 3/12"
  const [fracao, setFracao] = useState(0); // 0..1 do item atual

  // executor(onItem, onProgress) deve retornar { sucesso, falhas }.
  async function rodar(executor, nomeUnidade = "item") {
    setAtivo(true);
    setFracao(0);
    setRotulo("Preparando...");
    try {
      const onItem = (i, total, item) => {
        setRotulo(`${nomeUnidade} ${i}/${total}`);
        setFracao(0);
      };
      const { sucesso, falhas } = await executor(onItem, setFracao);
      const total = sucesso + falhas.length;
      let msg = `${sucesso}/${total} baixado(s) com sucesso.`;
      if (falhas.length) {
        msg +=
          `\n\nNão baixados:\n` +
          falhas
            .map((f) => `• ${f.titulo}${f.erro ? `\n   (${f.erro})` : ""}`)
            .join("\n");
      }
      Alert.alert("Download concluído", msg);
    } catch (e) {
      Alert.alert("Erro no download", e.message);
    } finally {
      setAtivo(false);
    }
  }

  return { ativo, rotulo, fracao, rodar };
}
