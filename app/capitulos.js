// app/capitulos.js — capítulos de um mangá: ler, baixar todos ou intervalo.
// Tem seletor de idioma (o MangaDex hospeda traduções por língua; títulos
// licenciados podem ter poucos capítulos legíveis em cada uma).

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
import { listarCapitulos } from "../src/api";
import { baixarCapitulos } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import { pedirIntervalo } from "../src/intervalo";
import { cores } from "../src/theme";

const IDIOMAS = [
  { id: "pt-br", nome: "PT-BR" },
  { id: "en", nome: "EN" },
  { id: "es-la", nome: "ES" },
  { id: "todos", nome: "Todos" },
];

export default function CapitulosScreen() {
  const { mangaId, titulo } = useLocalSearchParams();
  const router = useRouter();
  const [capitulos, setCapitulos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [idioma, setIdioma] = useState("pt-br");
  const dl = useDownload();

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    (async () => {
      try {
        const caps = await listarCapitulos(mangaId, idioma);
        if (ativo) setCapitulos(caps);
        if (ativo && caps.length === 0) {
          setErro(
            idioma === "todos"
              ? "Nenhum capítulo legível no MangaDex."
              : "Sem capítulos neste idioma — tente outro."
          );
        }
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [mangaId, idioma]);

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

      <View style={styles.idiomas}>
        {IDIOMAS.map((l) => (
          <Pressable
            key={l.id}
            onPress={() => setIdioma(l.id)}
            style={[styles.chip, idioma === l.id && styles.chipAtivo]}
          >
            <Text
              style={[
                styles.chipTexto,
                idioma === l.id && styles.chipTextoAtivo,
              ]}
            >
              {l.nome}
            </Text>
          </Pressable>
        ))}
      </View>

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>Carregando capítulos...</Text>
        </View>
      )}

      {erro && !carregando && <Text style={styles.erro}>{erro}</Text>}

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
            {idioma === "todos" && !!item.idioma && (
              <Text style={styles.lingua}>{item.idioma}</Text>
            )}
            <Text style={styles.paginasCap}>{item.paginas} pág.</Text>
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
  idiomas: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { color: cores.textoFraco, fontWeight: "600" },
  chipTextoAtivo: { color: cores.sobrePrimaria },
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
  lingua: {
    color: cores.primaria,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 8,
    textTransform: "uppercase",
  },
  paginasCap: { color: cores.textoFraco, fontSize: 13, marginLeft: 12 },
});
