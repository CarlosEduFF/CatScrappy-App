// app/leitor.js — leitor de capítulo: páginas em rolagem vertical.
// O ⬇️ no header baixa o capítulo atual como PDF na pasta do mangá.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { obterPaginas } from "../src/api";
import { baixarCapitulos } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import PaginaZoom from "../src/PaginaZoom";
import { vizinhos } from "../src/playlist";
import { useHistorico } from "../src/useHistorico";
import { useCores } from "../src/theme";

const LARGURA = Dimensions.get("window").width;

export default function LeitorScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, capituloId, titulo, numero, manga, mangaId } =
    useLocalSearchParams();
  const router = useRouter();
  const siteManga = site || "mangadex";
  const [paginas, setPaginas] = useState([]);
  const [alturas, setAlturas] = useState({});
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const listaRef = useRef(null);
  const historico = useHistorico({
    tipo: "manga",
    site: siteManga,
    itemId: mangaId,
  });
  const dl = useDownload();

  // Capítulo anterior/próximo, vindos da lista publicada pela tela de
  // capítulos. Sem ela em memória (app restaurado direto aqui), vem tudo
  // nulo e a barra não aparece.
  const irmaos = useMemo(
    () => vizinhos("manga", siteManga, capituloId),
    [siteManga, capituloId]
  );

  // Troca de capítulo com replace: empilhar deixaria o "voltar" percorrendo
  // todos os capítulos lidos em vez de retornar à lista.
  const irPara = useCallback(
    (cap) => {
      if (!cap) return;
      const rotulo = cap.titulo
        ? `Capítulo ${cap.numero} - ${cap.titulo}`
        : `Capítulo ${cap.numero}`;
      // Marca como lido ao abrir, igual a entrar pela lista.
      historico.marcar({
        episodio_id: cap.id,
        numero: cap.numero || "",
        titulo: rotulo,
      });
      router.replace({
        pathname: "/leitor",
        params: {
          site: siteManga,
          capituloId: cap.id,
          titulo: rotulo,
          numero: cap.numero,
          manga,
          mangaId,
        },
      });
    },
    [router, siteManga, manga, mangaId, historico]
  );

  function baixar() {
    dl.rodar(
      (onItem, onProgress, token) =>
        baixarCapitulos(
          siteManga,
          [{ id: capituloId, numero }],
          onItem,
          onProgress,
          manga,
          token
        ),
      "Capítulo"
    );
  }

  const opcoes = {
    title: titulo || "Leitura",
    headerRight: () => (
      <Pressable onPress={baixar} hitSlop={12}>
        <Text style={styles.baixar}>⬇️</Text>
      </Pressable>
    ),
  };

  useEffect(() => {
    let ativo = true;
    // Trocar de capítulo reusa esta tela (router.replace). Sem limpar, as
    // páginas antigas continuariam na tela durante o carregamento e as
    // alturas medidas (indexadas por posição) seriam aplicadas às imagens
    // novas, deixando cada página com a proporção errada.
    setPaginas([]);
    setAlturas({});
    setErro(null);
    setCarregando(true);
    // A lista é reusada entre capítulos: sem isso o capítulo novo abriria na
    // altura de rolagem em que o anterior parou, e não na primeira página.
    listaRef.current?.scrollToOffset({ offset: 0, animated: false });
    (async () => {
      try {
        const urls = await obterPaginas(siteManga, capituloId);
        if (ativo) setPaginas(urls);
        if (ativo && urls.length === 0) setErro("Capítulo sem páginas.");
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [siteManga, capituloId]);

  // As imagens de mangá têm proporções variadas; medimos cada uma para
  // exibir na largura da tela mantendo o aspecto.
  function medir(url, i) {
    Image.getSize(
      url,
      (w, h) => {
        setAlturas((a) => ({ ...a, [i]: (LARGURA * h) / w }));
      },
      () => {}
    );
  }

  // Barra de navegação entre capítulos. Vai no rodapé da lista (aparece ao
  // terminar a leitura, que é quando se quer avançar) e também na tela de
  // erro — quando um capítulo falha, pular para o próximo é o que resolve.
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

  if (carregando) {
    return (
      <View style={styles.centro}>
        <Stack.Screen options={opcoes} />
        <ActivityIndicator color={cores.primaria} size="large" />
        <Text style={styles.aviso}>Carregando páginas...</Text>
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centro}>
        <Stack.Screen options={opcoes} />
        <Text style={styles.erro}>{erro}</Text>
        <Navegacao />
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Stack.Screen options={opcoes} />
      <FlatList
        ref={listaRef}
        data={paginas}
        keyExtractor={(url, i) => String(i)}
        renderItem={({ item, index }) => {
          if (!alturas[index]) medir(item, index);
          return (
            <PaginaZoom
              uri={item}
              largura={LARGURA}
              altura={alturas[index] || LARGURA * 1.4}
            />
          );
        }}
        ListFooterComponent={Navegacao}
      />

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
  container: { flex: 1, backgroundColor: "#000" },
  centro: { flex: 1, alignItems: "center", justifyContent: "center", gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", paddingHorizontal: 24 },
  baixar: { fontSize: 18 },
  navegacao: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
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
  // dançar entre os capítulos) mas fica apagado e sem toque.
  navBotaoInativo: { opacity: 0.4 },
  navTexto: { color: cores.texto, fontWeight: "700", fontSize: 14 },
  navTextoInativo: { color: cores.textoFraco },
  navContador: { color: cores.textoFraco, fontSize: 13, fontWeight: "600" },
  });
