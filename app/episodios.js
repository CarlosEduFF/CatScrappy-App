// app/episodios.js — episódios de um anime: capa/sinopse, assistir e baixar
// (único no player; temporada/intervalo aqui). Em listas longas (One Piece
// tem 1000+), a navegação é por páginas de 50 + busca por número/título.

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Image,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useLocalSearchParams, useRouter, Stack } from "expo-router";
import { listarEpisodios } from "../src/api";
import { baixarEpisodios } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import { pedirIntervalo } from "../src/intervalo";
import ProgressoOverlay from "../src/ProgressoOverlay";
import BotaoFavorito from "../src/BotaoFavorito";
import { useHistorico } from "../src/useHistorico";
import { useCores } from "../src/theme";

export default function EpisodiosScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, url, titulo, imagem, sinopse } = useLocalSearchParams();
  const router = useRouter();
  const historico = useHistorico({ tipo: "anime", site, itemId: url });
  const [episodios, setEpisodios] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [sinopseAberta, setSinopseAberta] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(0);
  const dl = useDownload();

  const TAM_PAGINA = 50;
  const totalPaginas = Math.ceil(episodios.length / TAM_PAGINA);

  // Com filtro, busca na lista inteira; sem filtro, mostra a página atual.
  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (termo) {
      return episodios.filter(
        (ep) =>
          ep.titulo.toLowerCase().includes(termo) ||
          String(ep.numero).includes(termo)
      );
    }
    return episodios.slice(pagina * TAM_PAGINA, (pagina + 1) * TAM_PAGINA);
  }, [episodios, filtro, pagina]);

  useEffect(() => {
    let ativo = true;
    (async () => {
      try {
        const eps = await listarEpisodios(site, url);
        if (ativo) setEpisodios(eps);
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

  function assistir(ep) {
    // Marca como visto ao abrir (idempotente; sem login, apenas ignora).
    historico.marcar({
      episodio_id: ep.url_pagina,
      numero: ep.numero || "",
      titulo: ep.titulo || "",
    });
    router.push({
      pathname: "/player",
      // "anime" vai junto para o player nomear a subpasta de download.
      params: { site, url: ep.url_pagina, titulo: ep.titulo, anime: titulo },
    });
  }

  function baixarTemporada() {
    dl.rodar(
      (onItem, onProgress, token) =>
        baixarEpisodios(site, episodios, onItem, onProgress, titulo, token),
      "Episódio"
    );
  }

  async function baixarIntervalo() {
    const selecionados = await pedirIntervalo(episodios, "episódio");
    if (selecionados && selecionados.length) {
      dl.rodar(
        (onItem, onProgress, token) =>
          baixarEpisodios(site, selecionados, onItem, onProgress, titulo, token),
        "Episódio"
      );
    }
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: titulo || "Episódios",
          headerRight: () => (
            <BotaoFavorito
              item={{
                tipo: "anime",
                site,
                item_id: url,
                titulo: titulo || "",
                imagem: imagem || "",
              }}
            />
          ),
        }}
      />

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>Carregando episódios...</Text>
        </View>
      )}

      {erro && <Text style={styles.erro}>{erro}</Text>}

      {!carregando && !erro && (!!imagem || !!sinopse) && (
        <View style={styles.ficha}>
          {!!imagem && <Image source={{ uri: imagem }} style={styles.capa} />}
          <View style={styles.fichaTextos}>
            <Text style={styles.contagem}>
              {episodios.length} episódio{episodios.length === 1 ? "" : "s"}
            </Text>
            {!!sinopse && (
              <Pressable onPress={() => setSinopseAberta((v) => !v)}>
                <Text
                  style={styles.sinopse}
                  numberOfLines={sinopseAberta ? undefined : 3}
                >
                  {sinopse}
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {!carregando && !erro && episodios.length > 0 && (
        <View style={styles.acoes}>
          <Pressable style={styles.acao} onPress={baixarTemporada}>
            <Text style={styles.acaoTexto}>⬇️ Temporada</Text>
          </Pressable>
          <Pressable style={styles.acao} onPress={baixarIntervalo}>
            <Text style={styles.acaoTexto}>⬇️ Intervalo</Text>
          </Pressable>
        </View>
      )}

      {/* Progresso de episódios vistos (só com login e algum visto). */}
      {historico.logado && !carregando && !erro && episodios.length > 0 && (
        <View style={styles.progresso}>
          <View style={styles.progressoFundo}>
            <View
              style={[
                styles.progressoBarra,
                {
                  width: `${Math.min(
                    100,
                    (historico.total / episodios.length) * 100
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressoTexto}>
            {historico.total}/{episodios.length} vistos
          </Text>
        </View>
      )}

      {!carregando && !erro && episodios.length > TAM_PAGINA && (
        <>
          <TextInput
            style={styles.busca}
            placeholder="Buscar episódio (nº ou título)..."
            placeholderTextColor={cores.textoFraco}
            value={filtro}
            onChangeText={setFiltro}
            autoCorrect={false}
          />
          {!filtro.trim() && (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.paginas}
              contentContainerStyle={styles.paginasConteudo}
            >
              {Array.from({ length: totalPaginas }, (_, i) => (
                <Pressable
                  key={i}
                  onPress={() => setPagina(i)}
                  style={[styles.pagChip, pagina === i && styles.pagChipAtivo]}
                >
                  <Text
                    style={[
                      styles.pagChipTexto,
                      pagina === i && styles.pagChipTextoAtivo,
                    ]}
                  >
                    {i * TAM_PAGINA + 1}–
                    {Math.min((i + 1) * TAM_PAGINA, episodios.length)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {!!filtro.trim() && (
            <Text style={styles.resultadoBusca}>
              {visiveis.length} episódio{visiveis.length === 1 ? "" : "s"}{" "}
              encontrado{visiveis.length === 1 ? "" : "s"}
            </Text>
          )}
        </>
      )}

      <FlatList
        data={visiveis}
        keyExtractor={(item, i) => item.url_pagina + i}
        renderItem={({ item }) => {
          const visto = historico.estaVisto(item.url_pagina);
          return (
            <Pressable
              style={({ focused }) => [
                styles.cartao,
                focused && styles.cartaoFocado,
              ]}
              onPress={() => assistir(item)}
            >
              {({ focused }) => (
                <>
                  <Text
                    style={[
                      styles.cartaoTitulo,
                      focused && styles.cartaoTituloFocado,
                      visto && styles.cartaoTituloVisto,
                    ]}
                  >
                    {item.titulo}
                  </Text>
                  {/* Botão de marcar/desmarcar visto (só logado). */}
                  {historico.logado ? (
                    <Pressable
                      hitSlop={10}
                      onPress={() =>
                        historico
                          .alternar({
                            episodio_id: item.url_pagina,
                            numero: item.numero || "",
                            titulo: item.titulo || "",
                          })
                          .catch(() => {})
                      }
                    >
                      <Text style={visto ? styles.visto : styles.naoVisto}>
                        {visto ? "✓" : "○"}
                      </Text>
                    </Pressable>
                  ) : (
                    <Text style={styles.play}>▶</Text>
                  )}
                </>
              )}
            </Pressable>
          );
        }}
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
  container: { flex: 1, padding: 16 },
  centro: { alignItems: "center", padding: 24, gap: 12 },
  aviso: { color: cores.textoFraco },
  erro: { color: cores.erro, textAlign: "center", marginVertical: 12 },
  ficha: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 14,
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 12,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  capa: {
    width: 84,
    height: 118,
    borderRadius: 8,
    backgroundColor: cores.cartaoAtivo,
  },
  fichaTextos: { flex: 1 },
  contagem: { color: cores.primaria, fontWeight: "700", marginBottom: 6 },
  sinopse: { color: cores.textoFraco, fontSize: 13, lineHeight: 18 },
  busca: {
    backgroundColor: cores.cartao,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 8,
    color: cores.texto,
    borderWidth: 1,
    borderColor: cores.borda,
    marginBottom: 10,
  },
  // Altura fixa + flexShrink 0: sem isso a FlatList irmã comprime o
  // ScrollView horizontal e os chips somem.
  paginas: { flexGrow: 0, flexShrink: 0, height: 38, marginBottom: 12 },
  paginasConteudo: { gap: 8, alignItems: "center" },
  pagChip: {
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  pagChipAtivo: {
    backgroundColor: cores.primaria,
    borderColor: cores.primaria,
  },
  pagChipTexto: { color: cores.textoFraco, fontSize: 13, fontWeight: "600" },
  pagChipTextoAtivo: { color: cores.sobrePrimaria },
  resultadoBusca: { color: cores.textoFraco, marginBottom: 10, fontSize: 13 },
  acoes: { flexDirection: "row", gap: 10, marginBottom: 14 },
  acao: {
    flex: 1,
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 10,
    padding: 12,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  acaoTexto: { color: cores.texto, fontWeight: "600", fontSize: 13 },
  progresso: { flexDirection: "row", alignItems: "center", gap: 10, marginBottom: 14 },
  progressoFundo: {
    flex: 1,
    height: 6,
    borderRadius: 3,
    backgroundColor: cores.cartaoAtivo,
    overflow: "hidden",
  },
  progressoBarra: { height: "100%", backgroundColor: cores.primaria },
  progressoTexto: { color: cores.textoFraco, fontSize: 12, fontWeight: "600" },
  cartao: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    backgroundColor: cores.cartao,
    borderRadius: 12,
    padding: 16,
    marginBottom: 10,
    borderWidth: 2,
    borderColor: cores.borda,
  },
  // Destaque de foco (navegação por D-pad/teclado em TV/projetor): borda
  // laranja e fundo mais claro deixam claro qual episódio está selecionado.
  cartaoFocado: {
    backgroundColor: cores.cartaoAtivo,
    borderColor: cores.primaria,
  },
  cartaoTitulo: { color: cores.texto, fontSize: 15, flex: 1 },
  cartaoTituloFocado: { color: cores.primaria, fontWeight: "700" },
  // Episódio já visto: texto esmaecido.
  cartaoTituloVisto: { color: cores.textoFraco },
  play: { color: cores.primaria, fontSize: 18, marginLeft: 12 },
  visto: { color: cores.primaria, fontSize: 20, marginLeft: 12, fontWeight: "700" },
  naoVisto: { color: cores.textoFraco, fontSize: 20, marginLeft: 12 },
  });
