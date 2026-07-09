// app/(tabs)/favoritos.js — lista os favoritos salvos na conta.
// Sem login, convida a entrar. Cada item abre a tela de episódios/capítulos.

import { useCallback } from "react";
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
import { cores } from "../../src/theme";

export default function FavoritosScreen() {
  const router = useRouter();
  const { logado, favoritos, recarregarFavoritos } = useSessao();

  // Recarrega ao focar a aba (favoritos podem ter mudado em outra tela).
  useFocusEffect(
    useCallback(() => {
      if (logado) recarregarFavoritos();
    }, [logado, recarregarFavoritos])
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
        <Pressable style={styles.botao} onPress={() => router.push("/conta")}>
          <Text style={styles.botaoTexto}>Ir para Conta</Text>
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
    <FlatList
      style={styles.lista}
      data={favoritos}
      keyExtractor={(item) => `${item.tipo}|${item.site}|${item.item_id}`}
      renderItem={({ item }) => (
        <Pressable style={styles.cartao} onPress={() => abrir(item)}>
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
  );
}

const styles = StyleSheet.create({
  lista: { flex: 1, padding: 16 },
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
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 12,
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
