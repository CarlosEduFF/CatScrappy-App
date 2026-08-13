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
  Modal,
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
import { usePreferencias, VELOCIDADES } from "../src/preferencias";
import { useCores } from "../src/theme";

export default function PlayerScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, url, titulo, anime, animeUrl } = useLocalSearchParams();
  const router = useRouter();
  const historico = useHistorico({ tipo: "anime", site, itemId: animeUrl });
  const { saltoAbertura, velocidade, setVelocidade } = usePreferencias();
  const [fonte, setFonte] = useState(null); // { url_player, url_video, is_hls }
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [emPip, setEmPip] = useState(false);
  const [velocidadeAberta, setVelocidadeAberta] = useState(false);
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
    // preservesPitch (padrão do expo-video) corrige o tom da voz em
    // velocidades diferentes de 1x — sem ele a fala fica aguda demais.
    p.preservesPitch = true;
    p.play();
  });

  // A velocidade vem do AsyncStorage (assíncrono) e o player é recriado a
  // cada troca de fonte/episódio: o setup acima roda antes da preferência
  // chegar e o playbackRate voltaria a 1x. Reaplica sempre que qualquer um
  // dos dois mudar.
  useEffect(() => {
    if (!player) return;
    const v = Number(velocidade);
    if (Number.isFinite(v) && v > 0) player.playbackRate = v;
  }, [player, velocidade, fontePlayer]);

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

  // Avança o salto configurado (padrão 90s, o tamanho usual de uma abertura).
  // Não usa seekBy direto: perto do fim do episódio ele passaria do final e
  // encerraria a reprodução, então o alvo é limitado à duração conhecida.
  // duration vem 0 enquanto os metadados não carregaram — nesse caso só
  // avança e deixa o player resolver.
  function pularAbertura() {
    const salto = Number(saltoAbertura) || 90;
    const fim = Number(player?.duration) || 0;
    if (fim > 0) {
      // Uma folga de 1s evita parar exatamente no último frame.
      player.currentTime = Math.min(player.currentTime + salto, fim - 1);
    } else {
      player.seekBy(salto);
    }
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

  // Navegação entre episódios: fica logo abaixo do vídeo, ao alcance do
  // polegar, e some quando a lista não está em memória (aberto pelo
  // histórico) ou durante o PiP.
  function Navegacao() {
    if (irmaos.total === 0) return null;
    return (
      <View style={styles.navegacao}>
        <Pressable
          style={[styles.navBotao, !irmaos.anterior && styles.navBotaoInativo]}
          disabled={!irmaos.anterior}
          onPress={() => irPara(irmaos.anterior)}
        >
          <Text
            style={[styles.navTexto, !irmaos.anterior && styles.navTextoInativo]}
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
            style={[styles.navTexto, !irmaos.proximo && styles.navTextoInativo]}
            numberOfLines={1}
          >
            Próximo ⏭
          </Text>
        </Pressable>
      </View>
    );
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

      {/* Sem vídeo na tela (extração falhou), a navegação aparece aqui:
          pular para o próximo episódio é justamente o que resolve. Com
          vídeo, ela vai logo abaixo dele — ver <Navegacao /> adiante. */}
      {erro && !emPip && <Navegacao />}

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
              {/* Trocar de episódio é o controle mais usado: fica colado no
                  vídeo, antes das ações secundárias. */}
              <Navegacao />

              {/* Pular abertura e velocidade dividem a linha: a faixa de 8
                  chips ocupava espaço demais e exigia arrastar para alcançar
                  as velocidades maiores. */}
              <View style={styles.linhaReproducao}>
                <Pressable style={styles.pular} onPress={pularAbertura}>
                  <Text style={styles.pularTexto} numberOfLines={1}>
                    ⏩ Pular {saltoAbertura}s
                  </Text>
                </Pressable>
                <Pressable
                  style={[
                    styles.velBotao,
                    velocidade !== 1 && styles.velBotaoAtivo,
                  ]}
                  onPress={() => setVelocidadeAberta(true)}
                >
                  <Text
                    style={[
                      styles.velBotaoTexto,
                      velocidade !== 1 && styles.velBotaoTextoAtivo,
                    ]}
                  >
                    {velocidade}x ▾
                  </Text>
                </Pressable>
              </View>

              <View style={styles.acoes}>
                <Pressable style={styles.botao} onPress={baixar}>
                  <Text style={styles.botaoTexto}>⬇️ Baixar</Text>
                </Pressable>
                <Pressable style={styles.botao} onPress={entrarEmPip}>
                  <Text style={styles.botaoTexto}>📱 Miniatura</Text>
                </Pressable>
                <Pressable style={styles.botao} onPress={abrirNoVLC}>
                  <Text style={styles.botaoTexto}>🎬 VLC</Text>
                </Pressable>
              </View>

              <View style={styles.info}>
                <Text style={styles.tipo}>
                  {fonte.is_hls ? "Stream HLS" : "Vídeo MP4"}
                </Text>
              </View>
            </>
          )}
        </>
      )}

      {/* Seletor de velocidade: lista vertical, como o seletor de faixas —
          todas as opções visíveis de uma vez, sem arrastar. */}
      <Modal
        visible={velocidadeAberta}
        transparent
        animationType="fade"
        onRequestClose={() => setVelocidadeAberta(false)}
      >
        <Pressable
          style={styles.velFundo}
          onPress={() => setVelocidadeAberta(false)}
        >
          <Pressable style={styles.velCaixa} onPress={() => {}}>
            <Text style={styles.velTitulo}>Velocidade</Text>
            {VELOCIDADES.map((v) => {
              const ativo = v === velocidade;
              return (
                <Pressable
                  key={v}
                  style={[styles.velLinha, ativo && styles.velLinhaAtiva]}
                  onPress={() => {
                    setVelocidade(v);
                    setVelocidadeAberta(false);
                  }}
                >
                  <Text
                    style={[
                      styles.velLinhaTexto,
                      ativo && styles.velLinhaTextoAtiva,
                    ]}
                  >
                    {v}x{v === 1 ? "  (normal)" : ""}
                  </Text>
                  {ativo && <Text style={styles.velMarca}>✓</Text>}
                </Pressable>
              );
            })}
          </Pressable>
        </Pressable>
      </Modal>

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
  // "Pular abertura" e velocidade dividem uma linha só.
  linhaReproducao: {
    flexDirection: "row",
    gap: 10,
    marginHorizontal: 16,
    marginBottom: 10,
  },
  pular: {
    flex: 1,
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  pularTexto: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 15 },
  // Largura fixa: o rótulo varia ("1x" a "1.75x") e sem isso o botão de
  // pular mudaria de tamanho a cada troca de velocidade.
  velBotao: {
    width: 78,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: cores.cartaoAtivo,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  // Destaca quando não está em 1x, para não passar despercebido que o
  // episódio está acelerado.
  velBotaoAtivo: { borderColor: cores.primaria },
  velBotaoTexto: { color: cores.texto, fontWeight: "700", fontSize: 14 },
  velBotaoTextoAtivo: { color: cores.primaria },
  velFundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  velCaixa: {
    backgroundColor: cores.cartao,
    borderRadius: 16,
    padding: 18,
    width: "70%",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  velTitulo: {
    color: cores.texto,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 10,
  },
  velLinha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 12,
    paddingHorizontal: 14,
    borderRadius: 10,
    backgroundColor: cores.cartaoAtivo,
    marginBottom: 8,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  velLinhaAtiva: {
    backgroundColor: cores.primaria,
    borderColor: cores.primaria,
  },
  velLinhaTexto: { color: cores.texto, fontSize: 15, fontWeight: "600" },
  velLinhaTextoAtiva: { color: cores.sobrePrimaria, fontWeight: "700" },
  velMarca: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 15 },
  navegacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginHorizontal: 16,
    // Respiro entre o vídeo e a barra; abaixo dela vem a linha de
    // reprodução, que já traz a própria margem.
    marginTop: 12,
    marginBottom: 10,
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
