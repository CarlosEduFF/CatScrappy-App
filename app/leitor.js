// app/leitor.js — leitor de capítulo: páginas em rolagem vertical.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { obterPaginas } from "../src/api";
import { cores } from "../src/theme";

const LARGURA = Dimensions.get("window").width;

export default function LeitorScreen() {
  const { capituloId, titulo } = useLocalSearchParams();
  const [paginas, setPaginas] = useState([]);
  const [alturas, setAlturas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const urls = await obterPaginas(capituloId);
        if (ativo) setPaginas(urls);
        if (ativo && urls.length === 0) setErro("Capítulo sem páginas.");
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [capituloId]);

  // As imagens de mangá têm proporções variadas; medimos cada uma para
  // exibir na largura da tela mantendo o aspecto.
  function medir(url, i) {
    Image.getSize(
      url,
      (w, h) => {
        setAlturas((a) => ({ ...a, [i]: (LARGURA * h) / w }));
      },
      () => {}
    );
  }

  if (carregando) {
    return (
      <View style={styles.centro}>
        <Stack.Screen options={{ title: titulo || "Leitura" }} />
        <ActivityIndicator color={cores.primaria} size="large" />
        <Text style={styles.aviso}>Carregando páginas...</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centro}>
        <Stack.Screen options={{ title: titulo || "Leitura" }} />
        <Text style={styles.erro}>{erro}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: titulo || "Leitura" }} />
      <FlatList
        data={paginas}
        keyExtractor={(url, i) => String(i)}
        renderItem={({ item, index }) => {
          if (!alturas[index]) medir(item, index);
          return (
            <Image
              source={{ uri: item }}
              style={{ width: LARGURA, height: alturas[index] || LARGURA * 1.4 }}
              resizeMode="contain"
            />
          );
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", paddingHorizontal: 24 },
});
