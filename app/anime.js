// app/anime.js — busca e seleção de site + resultados de anime.

import { useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Modal,
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
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState([]);
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);

  const siteAtual = SITES.find((s) => s.id === site) || SITES[0];

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
      <Pressable
        style={styles.seletorSite}
        onPress={() => setSeletorAberto(true)}
      >
        <Text style={styles.seletorRotulo}>Site</Text>
        <Text style={styles.seletorValor}>{siteAtual.nome}</Text>
        <Text style={styles.seletorSeta}>▾</Text>
      </Pressable>

      <Modal
        visible={seletorAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setSeletorAberto(false)}
      >
        <Pressable
          style={styles.modalFundo}
          onPress={() => setSeletorAberto(false)}
        >
          <View style={styles.modalCaixa}>
            <Text style={styles.modalTitulo}>Escolha o site</Text>
            {SITES.map((s) => (
              <Pressable
                key={s.id}
                onPress={() => {
                  setSite(s.id);
                  setSeletorAberto(false);
                }}
                style={[
                  styles.modalItem,
                  site === s.id && styles.modalItemAtivo,
                ]}
              >
                <Text
                  style={[
                    styles.modalItemTexto,
                    site === s.id && styles.modalItemTextoAtivo,
                  ]}
                >
                  {s.nome}
                </Text>
                {site === s.id && <Text style={styles.modalCheck}>✓</Text>}
              </Pressable>
            ))}
          </View>
        </Pressable>
      </Modal>

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
  seletorSite: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
    marginBottom: 12,
  },
  seletorRotulo: { color: cores.textoFraco, fontWeight: "600" },
  seletorValor: { color: cores.texto, fontWeight: "700", flex: 1 },
  seletorSeta: { color: cores.textoFraco, fontSize: 16 },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 32,
  },
  modalCaixa: {
    backgroundColor: cores.cartao,
    borderRadius: 14,
    padding: 8,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  modalTitulo: {
    color: cores.texto,
    fontWeight: "700",
    fontSize: 16,
    paddingHorizontal: 12,
    paddingTop: 10,
    paddingBottom: 6,
  },
  modalItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  modalItemAtivo: { backgroundColor: cores.cartaoAtivo },
  modalItemTexto: { color: cores.texto, fontWeight: "600", flex: 1 },
  modalItemTextoAtivo: { color: cores.primaria },
  modalCheck: { color: cores.primaria, fontWeight: "700", fontSize: 16 },
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
