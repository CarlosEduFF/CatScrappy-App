// app/capitulos.js — capítulos de um mangá: ler, baixar todos ou intervalo.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { listarCapitulos } from "../src/api";
import { baixarCapitulos } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import { pedirIntervalo } from "../src/intervalo";
import { cores } from "../src/theme";

export default function CapitulosScreen() {
  const { mangaId, titulo } = useLocalSearchParams();
  const router = useRouter();
  const [capitulos, setCapitulos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const dl = useDownload();

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const caps = await listarCapitulos(mangaId);
        if (ativo) setCapitulos(caps);
        if (ativo && caps.length === 0) setErro("Sem capítulos em pt-br.");
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [mangaId]);

  function rotuloCap(c) {
    const base = `Capítulo ${c.numero}`;
    return c.titulo ? `${base} - ${c.titulo}` : base;
  }

  function baixarTodos() {
    dl.rodar(
      (onItem, onProgress) =>
        baixarCapitulos(capitulos, onItem, onProgress, titulo),
      "Capítulo"
    );
  }

  async function baixarIntervalo() {
    const selecionados = await pedirIntervalo(capitulos, "capítulo");
    if (selecionados && selecionados.length) {
      dl.rodar(
        (onItem, onProgress) =>
          baixarCapitulos(selecionados, onItem, onProgress, titulo),
        "Capítulo"
      );
    }
  }

  function ler(cap) {
    router.push({
      pathname: "/leitor",
      // "numero" nomeia o PDF e "manga" a subpasta, se baixar pelo leitor.
      params: {
        capituloId: cap.id,
        titulo: rotuloCap(cap),
        numero: cap.numero,
        manga: titulo,
      },
    });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: titulo || "Capítulos" }} />

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>Carregando capítulos...</Text>
        </View>
      )}

      {erro && <Text style={styles.erro}>{erro}</Text>}

      {!carregando && !erro && (
        <View style={styles.acoes}>
          <Pressable style={styles.acao} onPress={baixarTodos}>
            <Text style={styles.acaoTexto}>⬇️ Baixar todos</Text>
          </Pressable>
          <Pressable style={styles.acao} onPress={baixarIntervalo}>
            <Text style={styles.acaoTexto}>⬇️ Baixar intervalo</Text>
          </Pressable>
        </View>
      )}

      <FlatList
        data={capitulos}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.cartao} onPress={() => ler(item)}>
            <Text style={styles.cartaoTitulo}>{rotuloCap(item)}</Text>
            <Text style={styles.paginas}>{item.paginas} pág.</Text>
          </Pressable>
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
    justifyContent: "space-between",
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaoTitulo: { color: cores.texto, fontSize: 15, flex: 1 },
  paginas: { color: cores.textoFraco, fontSize: 13, marginLeft: 12 },
});
