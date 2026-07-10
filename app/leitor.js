// app/leitor.js — leitor de capítulo: páginas em rolagem vertical.
// O ⬇️ no header baixa o capítulo atual como PDF na pasta do mangá.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { obterPaginas } from "../src/api";
import { baixarCapitulos } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import PaginaZoom from "../src/PaginaZoom";
import { useCores } from "../src/theme";

const LARGURA = Dimensions.get("window").width;

export default function LeitorScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, capituloId, titulo, numero, manga } = useLocalSearchParams();
  const siteManga = site || "mangadex";
  const [paginas, setPaginas] = useState([]);
  const [alturas, setAlturas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const dl = useDownload();

  function baixar() {
    dl.rodar(
      (onItem, onProgress, token) =>
        baixarCapitulos(
          siteManga,
          [{ id: capituloId, numero }],
          onItem,
          onProgress,
          manga,
          token
        ),
      "Capítulo"
    );
  }

  const opcoes = {
    title: titulo || "Leitura",
    headerRight: () => (
      <Pressable onPress={baixar} hitSlop={12}>
        <Text style={styles.baixar}>⬇️</Text>
      </Pressable>
    ),
  };

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const urls = await obterPaginas(siteManga, capituloId);
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
        <Stack.Screen options={opcoes} />
        <ActivityIndicator color={cores.primaria} size="large" />
        <Text style={styles.aviso}>Carregando páginas...</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centro}>
        <Stack.Screen options={opcoes} />
        <Text style={styles.erro}>{erro}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={opcoes} />
      <FlatList
        data={paginas}
        keyExtractor={(url, i) => String(i)}
        renderItem={({ item, index }) => {
          if (!alturas[index]) medir(item, index);
          return (
            <PaginaZoom
              uri={item}
              largura={LARGURA}
              altura={alturas[index] || LARGURA * 1.4}
            />
          );
        }}
      />

      <ProgressoOverlay
        visivel={dl.ativo}
        rotulo={dl.rotulo}
        fracao={dl.fracao}
        onOcultar={dl.ocultar}
        onCancelar={dl.cancelar}
      />
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", paddingHorizontal: 24 },
  baixar: { fontSize: 18 },
  });
