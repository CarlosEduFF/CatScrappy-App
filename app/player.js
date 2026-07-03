// app/player.js — extrai o link e toca no player interno; permite abrir no VLC.

import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, Stack } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { extrairVideo } from "../src/api";
import { cores } from "../src/theme";

export default function PlayerScreen() {
  const { site, url, titulo } = useLocalSearchParams();
  const [fonte, setFonte] = useState(null); // { url_player, url_video, is_hls }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const dados = await extrairVideo(site, url);
        if (ativo) setFonte(dados);
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [site, url]);

  // O player só recebe uma URL quando ela existir; enquanto isso fica nulo.
  const player = useVideoPlayer(fonte?.url_player ?? null, (p) => {
    p.play();
  });

  async function abrirNoVLC() {
    // O VLC do Android abre URLs de vídeo por intent padrão. Tentamos o
    // esquema vlc:// e caímos para a URL direta se o VLC não estiver instalado.
    const alvo = fonte.url_player;
    const vlcUrl = `vlc://${alvo}`;
    try {
      const suportado = await Linking.canOpenURL(vlcUrl);
      await Linking.openURL(suportado ? vlcUrl : alvo);
    } catch {
      Alert.alert(
        "VLC não encontrado",
        "Instale o VLC para abrir o vídeo fora do app."
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: titulo || "Assistir" }} />

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>Extraindo vídeo...</Text>
        </View>
      )}

      {erro && (
        <View style={styles.centro}>
          <Text style={styles.erro}>{erro}</Text>
        </View>
      )}

      {fonte && !erro && (
        <>
          <VideoView
            style={styles.video}
            player={player}
            allowsFullscreen
            allowsPictureInPicture
            nativeControls
          />

          <View style={styles.info}>
            <Text style={styles.tipo}>
              {fonte.is_hls ? "Stream HLS" : "Vídeo MP4 (via proxy)"}
            </Text>
          </View>

          <Pressable style={styles.botaoVLC} onPress={abrirNoVLC}>
            <Text style={styles.botaoVLCTexto}>🎬 Abrir no VLC</Text>
          </Pressable>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", paddingHorizontal: 24 },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  info: { padding: 16 },
  tipo: { color: cores.textoFraco, fontSize: 13 },
  botaoVLC: {
    marginHorizontal: 16,
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoVLCTexto: { color: cores.texto, fontWeight: "700", fontSize: 15 },
});
