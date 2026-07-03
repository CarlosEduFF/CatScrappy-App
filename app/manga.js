// app/manga.js — busca de mangás (MangaDex).

import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { buscarManga } from "../src/api";
import { cores } from "../src/theme";

export default function BuscaMangaScreen() {
  const router = useRouter();
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  async function buscar() {
    if (!termo.trim()) return;
    setCarregando(true);
    setErro(null);
    setResultados([]);
    try {
      const mangas = await buscarManga(termo.trim());
      setResultados(mangas);
      if (mangas.length === 0) setErro("Nenhum mangá encontrado.");
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  function abrir(manga) {
    router.push({
      pathname: "/capitulos",
      params: { mangaId: manga.id, titulo: manga.titulo },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.buscaLinha}>
        <TextInput
          style={styles.input}
          placeholder="Buscar mangá..."
          placeholderTextColor={cores.textoFraco}
          value={termo}
          onChangeText={setTermo}
          onSubmitEditing={buscar}
          returnKeyType="search"
          autoCorrect={false}
        />
        <Pressable style={styles.botaoBuscar} onPress={buscar}>
          <Text style={styles.botaoBuscarTexto}>Buscar</Text>
        </Pressable>
      </View>

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>
            Buscando... (o servidor pode levar até 50s para acordar)
          </Text>
        </View>
      )}

      {erro && !carregando && <Text style={styles.erro}>{erro}</Text>}

      <FlatList
        data={resultados}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.cartao} onPress={() => abrir(item)}>
            <Text style={styles.cartaoTitulo}>{item.titulo}</Text>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  buscaLinha: { flexDirection: "row", gap: 8, marginBottom: 16 },
  input: {
    flex: 1,
    backgroundColor: cores.cartao,
    borderRadius: 10,
    paddingHorizontal: 14,
    color: cores.texto,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoBuscar: {
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingHorizontal: 18,
    justifyContent: "center",
  },
  botaoBuscarTexto: { color: "#fff", fontWeight: "700" },
  centro: { alignItems: "center", padding: 24, gap: 12 },
  aviso: { color: cores.textoFraco, textAlign: "center" },
  erro: { color: cores.erro, textAlign: "center", marginVertical: 12 },
  cartao: {
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cartaoTitulo: { color: cores.texto, fontSize: 16, fontWeight: "600" },
});
