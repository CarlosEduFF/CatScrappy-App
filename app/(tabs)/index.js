// app/(tabs)/index.js — menu inicial: escolher entre anime e mangá.

import { useMemo, useState } from "react";
import {
  Linking,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { SITES, SITES_MANGA } from "../../src/api";
import { useCores } from "../../src/theme";

// Observação curta sobre um site (ou "" se não houver particularidade).
function observacaoSite(s) {
  if (s.navegador) return "abre no navegador";
  return "";
}

// Nome limpo (sem o sufixo entre parênteses que alguns nomes carregam).
function nomeLimpo(s) {
  return s.nome.replace(/\s*\(.*\)\s*$/, "").trim();
}

// Domínio curto exibido embaixo do nome (ex.: "animefire.io").
function dominio(url) {
  return (url || "").replace(/^https?:\/\//, "").replace(/\/$/, "");
}

// Uma linha de site no modal: toca para abrir o link no navegador.
function renderSite(s, styles) {
  const obs = observacaoSite(s);
  return (
    <Pressable
      key={s.id}
      style={styles.linha}
      onPress={() => s.url && Linking.openURL(s.url)}
    >
      <View style={styles.linhaTextos}>
        <Text style={styles.siteNome}>{nomeLimpo(s)}</Text>
        {!!s.url && <Text style={styles.siteLink}>{dominio(s.url)}</Text>}
      </View>
      {!!obs && <Text style={styles.siteObs}>{obs}</Text>}
    </Pressable>
  );
}

export default function HomeScreen() {
  const router = useRouter();
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const [sitesAberto, setSitesAberto] = useState(false);

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

      {/* Botão singelo que abre a lista de sites usados. */}
      <Pressable style={styles.linkSites} onPress={() => setSitesAberto(true)}>
        <Text style={styles.linkSitesTexto}>Ver sites usados</Text>
      </Pressable>

      <Modal
        visible={sitesAberto}
        transparent
        animationType="fade"
        onRequestClose={() => setSitesAberto(false)}
      >
        <Pressable
          style={styles.modalFundo}
          onPress={() => setSitesAberto(false)}
        >
          <View style={styles.modalCaixa}>
            <Text style={styles.modalTitulo}>Sites usados</Text>
            <Text style={styles.modalSub}>Toque para abrir no navegador</Text>
            <ScrollView>
              <Text style={styles.grupo}>📺 Animes</Text>
              {SITES.map((s) => renderSite(s, styles))}

              <Text style={styles.grupo}>📖 Mangás</Text>
              {SITES_MANGA.map((s) => renderSite(s, styles))}
            </ScrollView>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
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
  linkSites: { alignSelf: "center", paddingVertical: 10, marginTop: 4 },
  linkSitesTexto: {
    color: cores.primaria,
    fontWeight: "600",
    fontSize: 14,
  },
  modalFundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    padding: 32,
  },
  modalCaixa: {
    backgroundColor: cores.cartao,
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: cores.borda,
    maxHeight: "70%",
  },
  modalTitulo: {
    color: cores.texto,
    fontWeight: "700",
    fontSize: 18,
  },
  modalSub: { color: cores.textoFraco, fontSize: 12, marginBottom: 6 },
  grupo: {
    color: cores.textoFraco,
    fontWeight: "700",
    fontSize: 13,
    marginTop: 12,
    marginBottom: 4,
  },
  linha: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    gap: 10,
  },
  linhaTextos: { flex: 1 },
  siteNome: { color: cores.texto, fontSize: 15, fontWeight: "600" },
  siteLink: { color: cores.primaria, fontSize: 12, marginTop: 2 },
  siteObs: { color: cores.textoFraco, fontSize: 12, fontStyle: "italic" },
  });
