// app/player.js — extrai o link e toca no player interno; permite abrir no
// VLC e baixar o episódio para a pasta do anime.

import { useEffect, useMemo, useState } from "react";
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
import { baixarEpisodios } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import { useCores } from "../src/theme";

export default function PlayerScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, url, titulo, anime } = useLocalSearchParams();
  const [fonte, setFonte] = useState(null); // { url_player, url_video, is_hls }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const dl = useDownload();

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

  // Fonte do player: alguns sites (AnimeFire) exigem headers (Referer) no
  // request do vídeo — passa-os junto da URI. Sem headers, uma URL simples.
  const fontePlayer = useMemo(() => {
    if (!fonte?.url_player) return null;
    return fonte.headers
      ? { uri: fonte.url_player, headers: fonte.headers }
      : fonte.url_player;
  }, [fonte]);

  // O player só recebe uma fonte quando ela existir; enquanto isso fica nulo.
  const player = useVideoPlayer(fontePlayer, (p) => {
    p.play();
  });

  function baixar() {
    dl.rodar(
      (onItem, onProgress, token) =>
        baixarEpisodios(
          site,
          [{ url_pagina: url, titulo }],
          onItem,
          onProgress,
          anime,
          token
        ),
      "Episódio"
    );
  }

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
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            nativeControls
          />

          <View style={styles.info}>
            <Text style={styles.tipo}>
              {fonte.is_hls ? "Stream HLS" : "Vídeo MP4"}
            </Text>
          </View>

          <View style={styles.acoes}>
            <Pressable style={styles.botao} onPress={baixar}>
              <Text style={styles.botaoTexto}>⬇️ Baixar</Text>
            </Pressable>
            <Pressable style={styles.botao} onPress={abrirNoVLC}>
              <Text style={styles.botaoTexto}>🎬 Abrir no VLC</Text>
            </Pressable>
          </View>
        </>
      )}

      <ProgressoOverlay
        visivel={dl.ativo}
        rotulo={dl.rotulo}
        fracao={dl.fracao}
        onOcultar={dl.ocultar}
        onCancelar={dl.cancelar}
      />
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
  container: { flex: 1 },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", paddingHorizontal: 24 },
  video: { width: "100%", aspectRatio: 16 / 9, backgroundColor: "#000" },
  info: { padding: 16 },
  tipo: { color: cores.textoFraco, fontSize: 13 },
  acoes: { flexDirection: "row", gap: 10, marginHorizontal: 16 },
  botao: {
    flex: 1,
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoTexto: { color: cores.texto, fontWeight: "700", fontSize: 15 },
  });
