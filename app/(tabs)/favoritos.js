// app/(tabs)/favoritos.js — lista os favoritos salvos na conta.
// Sem login, convida a entrar. Cada item abre a tela de episódios/capítulos.

import { useCallback, useMemo, useState } from "react";
import {
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter, useFocusEffect } from "expo-router";
import { useSessao } from "../../src/sessao";
import { useCores } from "../../src/theme";

const FILTROS = [
  { id: "todos", nome: "Todos" },
  { id: "anime", nome: "📺 Animes" },
  { id: "manga", nome: "📖 Mangás" },
];

export default function FavoritosScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { logado, favoritos, recarregarFavoritos } = useSessao();
  const [filtro, setFiltro] = useState("todos");

  // Recarrega ao focar a aba (favoritos podem ter mudado em outra tela).
  useFocusEffect(
    useCallback(() => {
      if (logado) recarregarFavoritos();
    }, [logado, recarregarFavoritos])
  );

  const visiveis = useMemo(
    () =>
      filtro === "todos"
        ? favoritos
        : favoritos.filter((f) => f.tipo === filtro),
    [favoritos, filtro]
  );

  function abrir(item) {
    if (item.tipo === "anime") {
      router.push({
        pathname: "/episodios",
        params: {
          site: item.site,
          url: item.item_id,
          titulo: item.titulo,
          imagem: item.imagem || "",
        },
      });
    } else {
      router.push({
        pathname: "/capitulos",
        params: {
          site: item.site,
          mangaId: item.item_id,
          titulo: item.titulo,
          imagem: item.imagem || "",
        },
      });
    }
  }

  if (!logado) {
    return (
      <View style={styles.centro}>
        <Text style={styles.emoji}>⭐</Text>
        <Text style={styles.aviso}>
          Entre na sua conta para salvar e ver seus favoritos.
        </Text>
        <Pressable style={styles.botao} onPress={() => router.push("/login")}>
          <Text style={styles.botaoTexto}>Entrar</Text>
        </Pressable>
      </View>
    );
  }

  if (favoritos.length === 0) {
    return (
      <View style={styles.centro}>
        <Text style={styles.emoji}>⭐</Text>
        <Text style={styles.aviso}>
          Você ainda não favoritou nada. Toque na estrela num anime ou mangá.
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.filtros}>
        {FILTROS.map((f) => {
          const ativo = filtro === f.id;
          return (
            <Pressable
              key={f.id}
              onPress={() => setFiltro(f.id)}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                {f.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {visiveis.length === 0 ? (
        <View style={styles.centro}>
          <Text style={styles.emoji}>⭐</Text>
          <Text style={styles.aviso}>
            {filtro === "anime"
              ? "Nenhum anime favoritado."
              : "Nenhum mangá favoritado."}
          </Text>
        </View>
      ) : (
        <FlatList
          style={styles.lista}
          data={visiveis}
          keyExtractor={(item) => `${item.tipo}|${item.site}|${item.item_id}`}
          renderItem={({ item }) => (
            <Pressable
              style={({ focused }) => [
                styles.cartao,
                focused && styles.cartaoFocado,
              ]}
              onPress={() => abrir(item)}
            >
              {!!item.imagem && (
                <Image source={{ uri: item.imagem }} style={styles.capa} />
              )}
              <View style={styles.textos}>
                <Text style={styles.titulo} numberOfLines={2}>
                  {item.titulo}
                </Text>
                <Text style={styles.meta}>
                  {item.tipo === "anime" ? "📺 Anime" : "📖 Mangá"} · {item.site}
                </Text>
              </View>
            </Pressable>
          )}
        />
      )}
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
  container: { flex: 1, padding: 16, backgroundColor: cores.fundo },
  lista: { flex: 1 },
  filtros: { flexDirection: "row", gap: 8, marginBottom: 14 },
  chip: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 20,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { color: cores.textoFraco, fontWeight: "600", fontSize: 13 },
  chipTextoAtivo: { color: cores.sobrePrimaria },
  centro: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 32,
    gap: 16,
  },
  emoji: { fontSize: 48 },
  aviso: { color: cores.textoFraco, textAlign: "center", fontSize: 16 },
  botao: {
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  botaoTexto: { color: cores.sobrePrimaria, fontWeight: "700" },
  cartao: {
    flexDirection: "row",
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 12,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: cores.borda,
    gap: 12,
  },
  // Destaque de foco (navegação por D-pad/teclado em TV/projetor).
  cartaoFocado: {
    backgroundColor: cores.cartaoAtivo,
    borderColor: cores.primaria,
  },
  capa: {
    width: 56,
    height: 80,
    borderRadius: 8,
    backgroundColor: cores.cartaoAtivo,
  },
  textos: { flex: 1, justifyContent: "center" },
  titulo: { color: cores.texto, fontSize: 16, fontWeight: "600" },
  meta: { color: cores.textoFraco, marginTop: 4, fontSize: 12 },
  });
