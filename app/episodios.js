// app/episodios.js — episódios de um anime: assistir, baixar (único/temporada/intervalo).

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { listarEpisodios } from "../src/api";
import { baixarEpisodios } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import { pedirIntervalo } from "../src/intervalo";
import ProgressoOverlay from "../src/ProgressoOverlay";
import { cores } from "../src/theme";

export default function EpisodiosScreen() {
  const { site, url, titulo } = useLocalSearchParams();
  const router = useRouter();
  const [episodios, setEpisodios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const dl = useDownload();

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const eps = await listarEpisodios(site, url);
        if (ativo) setEpisodios(eps);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [site, url]);

  function assistir(ep) {
    router.push({
      pathname: "/player",
      params: { site, url: ep.url_pagina, titulo: ep.titulo },
    });
  }

  function baixarUm(ep) {
    dl.rodar(
      (onItem, onProgress) =>
        baixarEpisodios(site, [ep], onItem, onProgress, titulo),
      "Episódio"
    );
  }

  function baixarTemporada() {
    dl.rodar(
      (onItem, onProgress) =>
        baixarEpisodios(site, episodios, onItem, onProgress, titulo),
      "Episódio"
    );
  }

  async function baixarIntervalo() {
    const selecionados = await pedirIntervalo(episodios, "episódio");
    if (selecionados && selecionados.length) {
      dl.rodar(
        (onItem, onProgress) =>
          baixarEpisodios(site, selecionados, onItem, onProgress, titulo),
        "Episódio"
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: titulo || "Episódios" }} />

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>Carregando episódios...</Text>
        </View>
      )}

      {erro && <Text style={styles.erro}>{erro}</Text>}

      {!carregando && !erro && episodios.length > 0 && (
        <View style={styles.acoes}>
          <Pressable style={styles.acao} onPress={baixarTemporada}>
            <Text style={styles.acaoTexto}>⬇️ Temporada</Text>
          </Pressable>
          <Pressable style={styles.acao} onPress={baixarIntervalo}>
            <Text style={styles.acaoTexto}>⬇️ Intervalo</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={episodios}
        keyExtractor={(item, i) => item.url_pagina + i}
        renderItem={({ item }) => (
          <View style={styles.cartao}>
            <Pressable style={styles.assistir} onPress={() => assistir(item)}>
              <Text style={styles.cartaoTitulo}>{item.titulo}</Text>
            </Pressable>
            <Pressable style={styles.iconeBtn} onPress={() => assistir(item)}>
              <Text style={styles.play}>▶</Text>
            </Pressable>
            <Pressable style={styles.iconeBtn} onPress={() => baixarUm(item)}>
              <Text style={styles.baixar}>⬇️</Text>
            </Pressable>
          </View>
        )}
      />

      <ProgressoOverlay
        visivel={dl.ativo}
        rotulo={dl.rotulo}
        fracao={dl.fracao}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centro: { alignItems: "center", padding: 24, gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", marginVertical: 12 },
  acoes: { flexDirection: "row", gap: 10, marginBottom: 14 },
  acao: {
    flex: 1,
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  acaoTexto: { color: cores.texto, fontWeight: "600", fontSize: 13 },
  cartao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cores.cartao,
    borderRadius: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  assistir: { flex: 1, padding: 16 },
  cartaoTitulo: { color: cores.texto, fontSize: 15 },
  iconeBtn: { paddingHorizontal: 14, paddingVertical: 16 },
  play: { color: cores.primaria, fontSize: 18 },
  baixar: { fontSize: 18 },
});
