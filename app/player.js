// app/player.js — extrai o link e toca no player interno; permite abrir no

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { useVideoPlayer, VideoView } from "expo-video";
import { extrairVideo } from "../src/api";
import { baixarEpisodios } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import { vizinhos } from "../src/playlist";
import { useHistorico } from "../src/useHistorico";
import { useCores } from "../src/theme";

export default function PlayerScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, url, titulo, anime, animeUrl } = useLocalSearchParams();
  const router = useRouter();
  const historico = useHistorico({ tipo: "anime", site, itemId: animeUrl });
  const [fonte, setFonte] = useState(null); // { url_player, url_video, is_hls }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const dl = useDownload();

  useEffect(() => {
    let ativo = true;
    // Trocar de episódio reusa esta tela (router.replace): sem limpar, o
    // vídeo anterior continuaria visível enquanto o novo é extraído.
    setFonte(null);
    setErro(null);
    setCarregando(true);
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

  // Episódio anterior/próximo, vindos da lista publicada pela tela de
  // episódios. Se a lista não estiver em memória (app restaurado direto
  // aqui, ou aberto pelo histórico), vem tudo nulo e os botões não aparecem.
  const irmaos = useMemo(() => vizinhos("anime", site, url), [site, url]);

  // Troca de episódio com replace: empilhar deixaria o "voltar" percorrendo
  // todos os episódios já assistidos em vez de retornar à lista.
  const irPara = useCallback(
    (ep) => {
      if (!ep) return;
      // Marca o episódio de destino como visto, igual a abrir pela lista
      // (idempotente; sem login apenas ignora).
      historico.marcar({
        episodio_id: ep.url_pagina,
        numero: ep.numero || "",
        titulo: ep.titulo || "",
      });
      router.replace({
        pathname: "/player",
        params: {
          site,
          url: ep.url_pagina,
          titulo: ep.titulo,
          anime,
          animeUrl,
        },
      });
    },
    [router, site, anime, animeUrl, historico]
  );

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

      {/* Navegação entre episódios. Fica fora do bloco do vídeo de propósito:
          quando a extração falha, pular para o próximo é justamente o que
          resolve. Escondida em PiP e quando a lista não está em memória. */}
      {!emPip && irmaos.total > 0 && (
        <View style={styles.navegacao}>
          <Pressable
            style={[styles.navBotao, !irmaos.anterior && styles.navBotaoInativo]}
            disabled={!irmaos.anterior}
            onPress={() => irPara(irmaos.anterior)}
          >
            <Text
              style={[
                styles.navTexto,
                !irmaos.anterior && styles.navTextoInativo,
              ]}
              numberOfLines={1}
            >
              ⏮ Anterior
            </Text>
          </Pressable>

          <Text style={styles.navContador}>
            {irmaos.indice + 1}/{irmaos.total}
          </Text>

          <Pressable
            style={[styles.navBotao, !irmaos.proximo && styles.navBotaoInativo]}
            disabled={!irmaos.proximo}
            onPress={() => irPara(irmaos.proximo)}
          >
            <Text
              style={[
                styles.navTexto,
                !irmaos.proximo && styles.navTextoInativo,
              ]}
              numberOfLines={1}
            >
              Próximo ⏭
            </Text>
          </Pressable>
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
  navegacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 12,
  },
  navBotao: {
    flex: 1,
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 8,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  // Ponta da lista: o botão continua ocupando o lugar (para o contador não
  // dançar entre os episódios) mas fica apagado e sem toque.
  navBotaoInativo: { opacity: 0.4 },
  navTexto: { color: cores.texto, fontWeight: "700", fontSize: 14 },
  navTextoInativo: { color: cores.textoFraco },
  navContador: { color: cores.textoFraco, fontSize: 13, fontWeight: "600" },
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
