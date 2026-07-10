// app/capitulos.js — capítulos de um mangá: ler, baixar todos ou intervalo.
// Tem seletor de idioma (o MangaDex hospeda traduções por língua; títulos
// licenciados podem ter poucos capítulos legíveis em cada uma) e, em listas
// longas, navegação por páginas de 50 + busca por número/título.

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
import { listarCapitulos } from "../src/api";
import { baixarCapitulos } from "../src/downloads";
import { useDownload } from "../src/useDownload";
import ProgressoOverlay from "../src/ProgressoOverlay";
import { pedirIntervalo } from "../src/intervalo";
import BotaoFavorito from "../src/BotaoFavorito";
import { useHistorico } from "../src/useHistorico";
import { useCores } from "../src/theme";

const IDIOMAS = [
  { id: "pt-br", nome: "PT-BR" },
  { id: "en", nome: "EN" },
  { id: "es-la", nome: "ES" },
  { id: "todos", nome: "Todos" },
];

export default function CapitulosScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { site, mangaId, titulo, imagem, sinopse } = useLocalSearchParams();
  const router = useRouter();
  const siteManga = site || "mangadex";
  const historico = useHistorico({ tipo: "manga", site: siteManga, itemId: mangaId });
  const [capitulos, setCapitulos] = useState([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState(null);
  const [idioma, setIdioma] = useState("pt-br");
  const [sinopseAberta, setSinopseAberta] = useState(false);
  const [filtro, setFiltro] = useState("");
  const [pagina, setPagina] = useState(0);
  const dl = useDownload();

  const TAM_PAGINA = 50;
  const totalPaginas = Math.ceil(capitulos.length / TAM_PAGINA);

  useEffect(() => {
    let ativo = true;
    setCarregando(true);
    setErro(null);
    setPagina(0);
    setFiltro("");
    (async () => {
      try {
        const caps = await listarCapitulos(siteManga, mangaId, idioma);
        if (ativo) setCapitulos(caps);
        if (ativo && caps.length === 0) {
          setErro(
            idioma === "todos"
              ? "Nenhum capítulo legível no MangaDex."
              : "Sem capítulos neste idioma — tente outro."
          );
        }
      } catch (e) {
        if (ativo) setErro(e.message);
      } finally {
        if (ativo) setCarregando(false);
      }
    })();
    return () => {
      ativo = false;
    };
  }, [siteManga, mangaId, idioma]);

  // Com filtro, busca na lista inteira; sem filtro, mostra a página atual.
  const visiveis = useMemo(() => {
    const termo = filtro.trim().toLowerCase();
    if (termo) {
      return capitulos.filter(
        (c) =>
          String(c.numero).includes(termo) ||
          (c.titulo || "").toLowerCase().includes(termo)
      );
    }
    return capitulos.slice(pagina * TAM_PAGINA, (pagina + 1) * TAM_PAGINA);
  }, [capitulos, filtro, pagina]);

  function rotuloCap(c) {
    const base = `Capítulo ${c.numero}`;
    return c.titulo ? `${base} - ${c.titulo}` : base;
  }

  function baixarTodos() {
    dl.rodar(
      (onItem, onProgress, token) =>
        baixarCapitulos(siteManga, capitulos, onItem, onProgress, titulo, token),
      "Capítulo"
    );
  }

  async function baixarIntervalo() {
    const selecionados = await pedirIntervalo(capitulos, "capítulo");
    if (selecionados && selecionados.length) {
      dl.rodar(
        (onItem, onProgress, token) =>
          baixarCapitulos(siteManga, selecionados, onItem, onProgress, titulo, token),
        "Capítulo"
      );
    }
  }

  function ler(cap) {
    // Marca como lido ao abrir (idempotente; sem login, apenas ignora).
    historico.marcar({
      episodio_id: cap.id,
      numero: cap.numero || "",
      titulo: rotuloCap(cap),
    });
    router.push({
      pathname: "/leitor",
      // "numero" nomeia o PDF e "manga" a subpasta, se baixar pelo leitor.
      params: {
        site: siteManga,
        capituloId: cap.id,
        titulo: rotuloCap(cap),
        numero: cap.numero,
        manga: titulo,
      },
    });
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: titulo || "Capítulos",
          headerRight: () => (
            <BotaoFavorito
              item={{
                tipo: "manga",
                site,
                item_id: mangaId,
                titulo: titulo || "",
                imagem: imagem || "",
              }}
            />
          ),
        }}
      />

      {siteManga === "mangadex" && (
        <View style={styles.idiomas}>
          {IDIOMAS.map((l) => (
            <Pressable
              key={l.id}
              onPress={() => setIdioma(l.id)}
              style={[styles.chip, idioma === l.id && styles.chipAtivo]}
            >
              <Text
                style={[
                  styles.chipTexto,
                  idioma === l.id && styles.chipTextoAtivo,
                ]}
              >
                {l.nome}
              </Text>
            </Pressable>
          ))}
        </View>
      )}

      {!carregando && !erro && (!!imagem || !!sinopse) && (
        <View style={styles.ficha}>
          {!!imagem && <Image source={{ uri: imagem }} style={styles.capa} />}
          <View style={styles.fichaTextos}>
            <Text style={styles.contagem}>
              {capitulos.length} capítulo{capitulos.length === 1 ? "" : "s"}
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

      {carregando && (
        <View style={styles.centro}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.aviso}>Carregando capítulos...</Text>
        </View>
      )}

      {erro && !carregando && <Text style={styles.erro}>{erro}</Text>}

      {!carregando && !erro && (
        <View style={styles.acoes}>
          <Pressable style={styles.acao} onPress={baixarTodos}>
            <Text style={styles.acaoTexto}>⬇️ Baixar todos</Text>
          </Pressable>
          <Pressable style={styles.acao} onPress={baixarIntervalo}>
            <Text style={styles.acaoTexto}>⬇️ Baixar intervalo</Text>
          </Pressable>
        </View>
      )}

      {/* Progresso de capítulos lidos (só com login e algum lido). */}
      {historico.logado && !carregando && !erro && capitulos.length > 0 && (
        <View style={styles.progresso}>
          <View style={styles.progressoFundo}>
            <View
              style={[
                styles.progressoBarra,
                {
                  width: `${Math.min(
                    100,
                    (historico.total / capitulos.length) * 100
                  )}%`,
                },
              ]}
            />
          </View>
          <Text style={styles.progressoTexto}>
            {historico.total}/{capitulos.length} lidos
          </Text>
        </View>
      )}

      {!carregando && !erro && capitulos.length > TAM_PAGINA && (
        <>
          <TextInput
            style={styles.busca}
            placeholder="Buscar capítulo (nº ou título)..."
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
                    {Math.min((i + 1) * TAM_PAGINA, capitulos.length)}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>
          )}
          {!!filtro.trim() && (
            <Text style={styles.resultadoBusca}>
              {visiveis.length} capítulo{visiveis.length === 1 ? "" : "s"}{" "}
              encontrado{visiveis.length === 1 ? "" : "s"}
            </Text>
          )}
        </>
      )}

      <FlatList
        data={visiveis}
        keyExtractor={(item) => item.id}
        renderItem={({ item }) => {
          const lido = historico.estaVisto(item.id);
          return (
            <Pressable
              style={({ focused }) => [
                styles.cartao,
                focused && styles.cartaoFocado,
              ]}
              onPress={() => ler(item)}
            >
              {({ focused }) => (
                <>
                  <Text
                    style={[
                      styles.cartaoTitulo,
                      focused && styles.cartaoTituloFocado,
                      lido && styles.cartaoTituloVisto,
                    ]}
                  >
                    {rotuloCap(item)}
                  </Text>
                  {idioma === "todos" && !!item.idioma && (
                    <Text style={styles.lingua}>{item.idioma}</Text>
                  )}
                  {!!item.paginas && (
                    <Text style={styles.paginasCap}>{item.paginas} pág.</Text>
                  )}
                  {/* Botão de marcar/desmarcar lido (só logado). */}
                  {historico.logado && (
                    <Pressable
                      hitSlop={10}
                      onPress={() =>
                        historico
                          .alternar({
                            episodio_id: item.id,
                            numero: item.numero || "",
                            titulo: rotuloCap(item),
                          })
                          .catch(() => {})
                      }
                    >
                      <Text style={lido ? styles.visto : styles.naoVisto}>
                        {lido ? "✓" : "○"}
                      </Text>
                    </Pressable>
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
  idiomas: { flexDirection: "row", gap: 8, marginBottom: 12 },
  chip: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    backgroundColor: cores.cartao,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
  chipTexto: { color: cores.textoFraco, fontWeight: "600" },
  chipTextoAtivo: { color: cores.sobrePrimaria },
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
  // Destaque de foco (navegação por D-pad/teclado em TV/projetor).
  cartaoFocado: {
    backgroundColor: cores.cartaoAtivo,
    borderColor: cores.primaria,
  },
  cartaoTitulo: { color: cores.texto, fontSize: 15, flex: 1 },
  cartaoTituloFocado: { color: cores.primaria, fontWeight: "700" },
  // Capítulo já lido: texto esmaecido.
  cartaoTituloVisto: { color: cores.textoFraco },
  lingua: {
    color: cores.primaria,
    fontSize: 11,
    fontWeight: "700",
    marginLeft: 8,
    textTransform: "uppercase",
  },
  paginasCap: { color: cores.textoFraco, fontSize: 13, marginLeft: 12 },
  visto: { color: cores.primaria, fontSize: 20, marginLeft: 12, fontWeight: "700" },
  naoVisto: { color: cores.textoFraco, fontSize: 20, marginLeft: 12 },
  });
