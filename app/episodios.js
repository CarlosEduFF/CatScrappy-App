// app/episodios.js — lista de episódios de um anime.

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
import { cores } from "../src/theme";

export default function EpisodiosScreen() {
  const { site, url, titulo } = useLocalSearchParams();
  const router = useRouter();
  const [episodios, setEpisodios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

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

      <FlatList
        data={episodios}
        keyExtractor={(item, i) => item.url_pagina + i}
        renderItem={({ item }) => (
          <Pressable style={styles.cartao} onPress={() => assistir(item)}>
            <Text style={styles.cartaoTitulo}>{item.titulo}</Text>
            <Text style={styles.play}>▶</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  centro: { alignItems: "center", padding: 24, gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", marginVertical: 12 },
  cartao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaoTitulo: { color: cores.texto, fontSize: 15, flex: 1 },
  play: { color: cores.primaria, fontSize: 18, marginLeft: 12 },
});
