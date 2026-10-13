// app/leitor.js — leitor de capítulo: páginas em rolagem vertical.
// O ⬇️ no header baixa o capítulo atual como PDF na pasta do mangá.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Linking,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { WebView } from "react-native-webview";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { obterPaginas, obterUrlWeb } from "../src/api";
import { baixarCapitulos } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import PaginaZoom from "../src/PaginaZoom";
import { useImagemMugiwaras } from "../src/ImagemMugiwaras";
import { vizinhos } from "../src/playlist";
import { useHistorico } from "../src/useHistorico";
import { useCores } from "../src/theme";

const LARGURA = Dimensions.get("window").width;

// Uma página da rolagem. As do Mugiwaras vêm do WebView como data URI (o CDN
// barra o cliente HTTP do RN); as demais usam a URL direto.
function Pagina({ uri, site, altura, aoMedir, estilos }) {
  const { pronta, erro } = useImagemMugiwaras(uri, site);
  const medirRef = useRef(aoMedir);
  medirRef.current = aoMedir;

  useEffect(() => {
    if (pronta && !altura) medirRef.current(pronta);
  }, [pronta, altura]);

  // Uma página que falhou não pode ficar girando para sempre: o capítulo
  // continua legível nas outras, então o espaço dela vira um aviso curto.
  if (erro) {
    return (
      <View style={[styles_pagina.falha, { width: LARGURA }]}>
        <Text style={estilos.aviso}>Página não carregou.</Text>
      </View>
    );
  }

  if (!pronta) {
    return (
      <View style={{ width: LARGURA, height: LARGURA * 1.4 }}>
        <ActivityIndicator style={{ marginTop: 40 }} />
      </View>
    );
  }
  return (
    <PaginaZoom
      uri={pronta}
      largura={LARGURA}
      altura={altura || LARGURA * 1.4}
    />
  );
}

const styles_pagina = StyleSheet.create({
  falha: { paddingVertical: 40, alignItems: "center", justifyContent: "center" },
});

const JS_ANTI_ADBLOCK = `
(function () {
  window.canRunAds = true;
  window.adBlockerDetected = false;
  window.google_ad_status = 1;
  window.adsbygoogle = window.adsbygoogle || [];
  window.adsbygoogle.loaded = true;

  function neutralizar() {
    var el = document.querySelectorAll("div, section, dialog, [class*='modal'], [id*='modal']");
    el.forEach(function (node) {
      var t = (node.innerText || "").toLowerCase();
      if ((t.indexOf("bloqueador") !== -1 || t.indexOf("adblock") !== -1 || t.indexOf("premium") !== -1) && t.length < 400) {
        if (!node.querySelector("img[src*='snipercache']")) {
          node.style.display = "none";
          node.style.visibility = "hidden";
        }
      }
    });
    if (document.body) {
      document.body.style.overflow = "auto";
      document.body.style.pointerEvents = "auto";
    }
  }
  neutralizar();
  setInterval(neutralizar, 400);
})();
true;
`;

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
  const [usarWebView, setUsarWebView] = useState(false);
  const listaRef = useRef(null);
  const historico = useHistorico({
    tipo: "manga",
    site: siteManga,
    itemId: mangaId,
  });
  const dl = useDownload();

  const webUrl = useMemo(
    () => obterUrlWeb(siteManga, capituloId),
    [siteManga, capituloId]
  );

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
    setPaginas([]);
    setAlturas({});
    setErro(null);
    setCarregando(true);
    setUsarWebView(false);
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

  function medir(url, i) {
    Image.getSize(
      url,
      (w, h) => {
        setAlturas((a) => ({ ...a, [i]: (LARGURA * h) / w }));
      },
      () => {}
    );
  }

  function abrirNavegadorExterno() {
    if (webUrl) {
      Linking.openURL(webUrl).catch(() => {});
    }
  }

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



  if (usarWebView && webUrl) {
    return (
      <View style={styles.container}>
        <Stack.Screen options={opcoes} />
        <WebView
          source={{ uri: webUrl }}
          sharedCookiesEnabled
          thirdPartyCookiesEnabled
          javaScriptEnabled
          domStorageEnabled
          injectedJavaScript={JS_ANTI_ADBLOCK}
          style={{ flex: 1 }}
        />

        <View style={styles.barraWeb}>
          <Pressable style={styles.botaoWebSecundario} onPress={abrirNavegadorExterno}>
            <Text style={styles.botaoWebTexto}>🌐 Abrir no Navegador</Text>
          </Pressable>
        </View>
        <Navegacao />
      </View>
    );
  }

  if (erro) {
    return (
      <View style={styles.centro}>
        <Stack.Screen options={opcoes} />
        <Text style={styles.erro}>{erro}</Text>

        {!!webUrl && (
          <View style={styles.grupoBotoesWeb}>
            <Pressable
              style={styles.botaoWebPrincipal}
              onPress={() => setUsarWebView(true)}
            >
              <Text style={styles.botaoWebTextoPrincipal}>
                📖 Ler no App (Navegador Integrado)
              </Text>
            </Pressable>

            <Pressable
              style={styles.botaoWebSecundario}
              onPress={abrirNavegadorExterno}
            >
              <Text style={styles.botaoWebTexto}>🌐 Abrir no Navegador Externo</Text>
            </Pressable>
          </View>
        )}

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
        renderItem={({ item, index }) => (
          <Pagina
            uri={item}
            site={siteManga}
            altura={alturas[index]}
            aoMedir={(url) => medir(url, index)}
            estilos={styles}
          />
        )}
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
  grupoBotoesWeb: {
    width: "100%",
    paddingHorizontal: 24,
    gap: 10,
    marginTop: 8,
    alignItems: "center",
  },
  botaoWebPrincipal: {
    width: "100%",
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingVertical: 14,
    paddingHorizontal: 16,
    alignItems: "center",
  },
  botaoWebTextoPrincipal: {
    color: cores.sobrePrimaria || "#fff",
    fontWeight: "700",
    fontSize: 15,
  },
  botaoWebSecundario: {
    width: "100%",
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 10,
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoWebTexto: {
    color: cores.texto,
    fontWeight: "600",
    fontSize: 14,
  },
  barraWeb: {
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
    backgroundColor: "#000",
  },
  });

