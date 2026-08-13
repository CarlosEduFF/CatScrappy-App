// app/player.js — extrai o link e toca no player interno; permite abrir no
// VLC, baixar o episódio para a pasta do anime e assistir em janela
// flutuante (picture-in-picture).
//
// PiP: a prop allowsPictureInPicture do VideoView só tem efeito com o
// android:supportsPictureInPicture no Manifest, que vem do plugin
// expo-video configurado em app.json (supportsPictureInPicture: true) —
// sem ele o modo é silenciosamente ignorado. Requer build nativo novo.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  AppState,
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
  const [emPip, setEmPip] = useState(false);
  const videoRef = useRef(null);
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


  // Fechar a janela do PiP (X) não traz o app de volta: a tela do player
  // continua montada em background e o áudio seguiria tocando invisível.
  // Como não há reprodução em background aqui, pausa nesse caso — mas só
  // quando o app está mesmo em background, senão isso pausaria também o
  // retorno normal do PiP para a tela cheia.
  const aoSairDoPip = useCallback(() => {
    setEmPip(false);
    if (AppState.currentState !== "active") player.pause();
  }, [player]);
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


  // Entra em PiP pelo botão. startPictureInPicture() vive no ref do
  // VideoView (não no player) e lança se o aparelho não suportar — daí o
  // aviso em vez de derrubar a tela.
  async function entrarEmPip() {
    try {
      await videoRef.current?.startPictureInPicture();
    } catch {
      Alert.alert(
        "Picture-in-picture indisponível",
        "Este aparelho ou versão do Android não suporta janela flutuante."
      );
    }
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
            ref={videoRef}
            style={styles.video}
            player={player}
            fullscreenOptions={{ enable: true }}
            allowsPictureInPicture
            // Sair do app (Home/multitarefa) manda o vídeo para a janela
            // flutuante sozinho, em vez de perder a reprodução. Android 12+;
            // nas versões antigas só o botão funciona.
            startsPictureInPictureAutomatically
            onPictureInPictureStart={() => setEmPip(true)}
            onPictureInPictureStop={aoSairDoPip}
            nativeControls
          />

          {/* Em PiP a tela continua montada atrás da janela flutuante; sem
              isso os botões apareceriam ao voltar para o app por baixo dela. */}
          {!emPip && (
            <>
              <View style={styles.info}>
                <Text style={styles.tipo}>
                  {fonte.is_hls ? "Stream HLS" : "Vídeo MP4"}
                </Text>
              </View>

              <View style={styles.acoes}>
                <Pressable style={styles.botao} onPress={baixar}>
                  <Text style={styles.botaoTexto}>⬇️ Baixar</Text>
                </Pressable>
                <Pressable style={styles.botao} onPress={entrarEmPip}>
                  <Text style={styles.botaoTexto}>🗗 Janela flutuante</Text>
                </Pressable>
                <Pressable style={styles.botao} onPress={abrirNoVLC}>
                  <Text style={styles.botaoTexto}>🎬 VLC</Text>
                </Pressable>
              </View>
            </>
          )}
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
    // Menos folga lateral: são três botões na linha e os rótulos não podem
    // quebrar no meio da palavra em telas estreitas.
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoTexto: {
    color: cores.texto,
    fontWeight: "700",
    fontSize: 14,
    textAlign: "center",
  },
  });
