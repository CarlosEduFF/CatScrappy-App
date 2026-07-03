// app/anime.js — busca e seleção de site + resultados de anime.

import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SITES, buscarAnime } from "../src/api";
import { cores } from "../src/theme";

export default function BuscaAnimeScreen() {
  const router = useRouter();
  const [site, setSite] = useState(SITES[0].id);
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
      const animes = await buscarAnime(site, termo.trim());
      setResultados(animes);
      if (animes.length === 0) setErro("Nenhum anime encontrado.");
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  function abrirAnime(anime) {
    router.push({
      pathname: "/episodios",
      // Capa e sinopse já vêm da busca; a tela de episódios só exibe.
      params: {
        site,
        url: anime.url_detalhes,
        titulo: anime.titulo,
        imagem: anime.imagem || "",
        sinopse: anime.sinopse || "",
      },
    });
  }

  return (
    <View style={styles.container}>
      <View style={styles.sites}>
        {SITES.map((s) => (
          <Pressable
            key={s.id}
            onPress={() => setSite(s.id)}
            style={[styles.chip, site === s.id && styles.chipAtivo]}
          >
            <Text
              style={[styles.chipTexto, site === s.id && styles.chipTextoAtivo]}
            >
              {s.nome}
            </Text>
          </Pressable>
        ))}
      </View>

      <View style={styles.buscaLinha}>
        <TextInput
          style={styles.input}
          placeholder="Buscar anime..."
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
        keyExtractor={(item, i) => item.url_detalhes + i}
        renderItem={({ item }) => (
          <Pressable style={styles.cartao} onPress={() => abrirAnime(item)}>
            {!!item.imagem && (
              <Image source={{ uri: item.imagem }} style={styles.capa} />
            )}
            <View style={styles.cartaoTextos}>
              <Text style={styles.cartaoTitulo}>{item.titulo}</Text>
              {!!item.ano && <Text style={styles.cartaoAno}>{item.ano}</Text>}
              {!!item.sinopse && (
                <Text style={styles.cartaoSinopse} numberOfLines={2}>
                  {item.sinopse}
                </Text>
              )}
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 16 },
  sites: { flexDirection: "row", gap: 8, marginBottom: 12 },
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
  botaoBuscarTexto: { color: cores.sobrePrimaria, fontWeight: "700" },
  centro: { alignItems: "center", padding: 24, gap: 12 },
  aviso: { color: cores.textoFraco, textAlign: "center" },
  erro: { color: cores.erro, textAlign: "center", marginVertical: 12 },
  cartao: {
    flexDirection: "row",
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 12,
  },
  capa: {
    width: 64,
    height: 90,
    borderRadius: 8,
    backgroundColor: cores.cartaoAtivo,
  },
  cartaoTextos: { flex: 1, justifyContent: "center" },
  cartaoTitulo: { color: cores.texto, fontSize: 16, fontWeight: "600" },
  cartaoAno: { color: cores.textoFraco, marginTop: 4 },
  cartaoSinopse: { color: cores.textoFraco, fontSize: 12, marginTop: 6 },
});
