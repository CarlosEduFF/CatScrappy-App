// app/(tabs)/index.js — menu inicial: escolher entre anime e mangá.

import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { cores } from "../../src/theme";

export default function HomeScreen() {
  const router = useRouter();
  return (
    <View style={styles.container}>
      <Text style={styles.subtitulo}>O que você quer fazer?</Text>

      <Pressable style={styles.opcao} onPress={() => router.push("/anime")}>
        <Text style={styles.emoji}>📺</Text>
        <View style={styles.textos}>
          <Text style={styles.titulo}>Animes</Text>
          <Text style={styles.desc}>Assistir e baixar episódios</Text>
        </View>
      </Pressable>

      <Pressable style={styles.opcao} onPress={() => router.push("/manga")}>
        <Text style={styles.emoji}>📖</Text>
        <View style={styles.textos}>
          <Text style={styles.titulo}>Mangás</Text>
          <Text style={styles.desc}>Ler e baixar capítulos</Text>
        </View>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 16 },
  subtitulo: {
    color: cores.textoFraco,
    fontSize: 16,
    marginBottom: 8,
    textAlign: "center",
  },
  opcao: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: cores.cartao,
    borderRadius: 16,
    padding: 20,
    borderWidth: 1,
    borderColor: cores.borda,
    gap: 16,
  },
  emoji: { fontSize: 40 },
  textos: { flex: 1 },
  titulo: { color: cores.texto, fontSize: 20, fontWeight: "700" },
  desc: { color: cores.textoFraco, marginTop: 4 },
});
