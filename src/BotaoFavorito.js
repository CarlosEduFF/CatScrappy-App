// src/BotaoFavorito.js — estrela de favoritar para o header das telas de
// detalhe (episódios/capítulos). Sem login, avisa que precisa entrar.

import { Alert, Pressable, Text, StyleSheet } from "react-native";
import { useRouter } from "expo-router";
import { useSessao } from "./sessao";
import { cores } from "./theme";

export default function BotaoFavorito({ item }) {
  const router = useRouter();
  const { logado, ehFavorito, alternarFavorito } = useSessao();
  const favoritado = logado && ehFavorito(item);

  async function aoTocar() {
    if (!logado) {
      Alert.alert(
        "Entre na sua conta",
        "Crie uma conta ou entre para salvar favoritos.",
        [
          { text: "Agora não", style: "cancel" },
          { text: "Ir para Conta", onPress: () => router.push("/conta") },
        ]
      );
      return;
    }
    try {
      await alternarFavorito(item);
    } catch (e) {
      Alert.alert("Ops", e.message);
    }
  }

  return (
    <Pressable onPress={aoTocar} hitSlop={12}>
      <Text style={[styles.estrela, favoritado && styles.ativa]}>
        {favoritado ? "★" : "☆"}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  estrela: { fontSize: 24, color: cores.textoFraco },
  ativa: { color: cores.primaria },
});
