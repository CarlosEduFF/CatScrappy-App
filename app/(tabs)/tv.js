// app/(tabs)/tv.js — canais de TV abertos (lista pública do iptv-org).
// Canal ao vivo não tem episódio: escolher o canal já abre o player.

import { useEffect, useMemo, useState } from "react";
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
import { listarCanaisTV } from "../../src/api";
import { useCores } from "../../src/theme";

export default function TvScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const [categorias, setCategorias] = useState([]);
  const [categoria, setCategoria] = useState(null);
  const [termo, setTermo] = useState("");
  const [seletorAberto, setSeletorAberto] = useState(false);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const cats = await listarCanaisTV();
        if (!ativo) return;
        setCategorias(cats);
        setCategoria(cats[0]?.nome || null);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, []);

  const visiveis = useMemo(() => {
    const alvo = termo.trim().toLowerCase();
    // Com busca, procura em todos os canais; sem busca, mostra a categoria.
    const base = alvo
      ? categorias.flatMap((c) => c.canais)
      : categorias.find((c) => c.nome === categoria)?.canais || [];
    return alvo
      ? base.filter((c) => c.titulo.toLowerCase().includes(alvo))
      : base;
  }, [categorias, categoria, termo]);

  function abrir(canal) {
    router.push({
      pathname: "/player",
      params: { site: "iptv", url: canal.id, titulo: canal.titulo },
    });
  }

  if (carregando) {
    return (
      <View style={styles.centro}>
        <ActivityIndicator />
        <Text style={styles.aviso}>Carregando canais…</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centro}>
        <Text style={styles.erro}>{erro}</Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <TextInput
        style={styles.busca}
        placeholder="Buscar canal"
        placeholderTextColor={cores.textoFraco}
        value={termo}
        onChangeText={setTermo}
      />

      {/* São mais de 30 categorias: um botão com modal evita a fita
          horizontal, onde achar uma categoria exige arrastar às cegas. */}
      {!termo.trim() && (
        <Pressable
          style={styles.seletor}
          onPress={() => setSeletorAberto(true)}
        >
          <Text style={styles.seletorRotulo}>Categoria</Text>
          <Text style={styles.seletorValor} numberOfLines={1}>
            {categoria} ({categorias.find((c) => c.nome === categoria)?.canais.length || 0})
          </Text>
          <Text style={styles.seletorSeta}>▾</Text>
        </Pressable>
      )}

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
            <Text style={styles.modalTitulo}>Escolha a categoria</Text>
            <FlatList
              data={categorias}
              keyExtractor={(c) => c.nome}
              renderItem={({ item }) => (
                <Pressable
                  onPress={() => {
                    setCategoria(item.nome);
                    setSeletorAberto(false);
                  }}
                  style={[
                    styles.modalItem,
                    item.nome === categoria && styles.modalItemAtivo,
                  ]}
                >
                  <Text
                    style={[
                      styles.modalItemTexto,
                      item.nome === categoria && styles.modalItemTextoAtivo,
                    ]}
                  >
                    {item.nome} ({item.canais.length})
                  </Text>
                  {item.nome === categoria && (
                    <Text style={styles.modalCheck}>✓</Text>
                  )}
                </Pressable>
              )}
            />
          </View>
        </Pressable>
      </Modal>

      <FlatList
        data={visiveis}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => (
          <Pressable style={styles.cartao} onPress={() => abrir(item)}>
            {!!item.imagem && (
              <Image source={{ uri: item.imagem }} style={styles.logo} />
            )}
            <Text style={styles.titulo} numberOfLines={2}>
              {item.titulo}
            </Text>
          </Pressable>
        )}
        ListEmptyComponent={
          <Text style={styles.aviso}>Nenhum canal encontrado.</Text>
        }
      />
    </View>
  );
}

function criarEstilos(cores) {
  return StyleSheet.create({
    container: { flex: 1, backgroundColor: cores.fundo },
    centro: {
      flex: 1,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: cores.fundo,
    },
    busca: {
      margin: 12,
      padding: 10,
      borderRadius: 8,
      borderWidth: 1,
      borderColor: cores.borda,
      color: cores.texto,
      backgroundColor: cores.cartao,
    },
    seletor: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginHorizontal: 12,
      marginBottom: 12,
      paddingVertical: 10,
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: cores.cartao,
      borderWidth: 1,
      borderColor: cores.borda,
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
      maxHeight: "70%",
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
    cartao: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      paddingHorizontal: 14,
      paddingVertical: 10,
    },
    logo: {
      width: 56,
      height: 40,
      resizeMode: "contain",
      backgroundColor: cores.cartao,
      borderRadius: 4,
    },
    titulo: { color: cores.texto, flex: 1 },
    aviso: { color: cores.textoFraco, textAlign: "center", marginTop: 16 },
    erro: { color: cores.erro || "#f66", textAlign: "center", margin: 20 },
  });
}
