// app/configuracoes.js — preferências do app: aparência e player.
//
// O tema mora aqui (e não mais no ícone do header): trocar de tema é algo
// que se faz uma vez, e no player/leitor o ícone disputava espaço com o
// título do episódio. Aqui também cabe o "Automático", que o botão do
// header não alcançava — uma vez tocado, a preferência ficava fixa para
// sempre, sem caminho de volta para seguir o sistema.
//
// No player, as opções de salto cobrem as durações usuais de abertura; o
// campo livre existe porque algumas séries fogem do padrão (recaps longos,
// aberturas curtas em episódios especiais).

import { useMemo, useState } from "react";
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { SALTOS, VELOCIDADES, usePreferencias } from "../src/preferencias";
import { useCores, useTema } from "../src/theme";

// Rótulo + o que cada modo faz, para "Automático" não ficar ambíguo.
const TEMAS = [
  { id: "light", nome: "☀️ Claro" },
  { id: "dark", nome: "🌙 Escuro" },
  { id: "auto", nome: "⚙️ Automático" },
];

export default function ConfiguracoesScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const { preferencia, setPreferencia, esquemaEfetivo } = useTema();
  const { saltoAbertura, setSaltoAbertura, velocidade, setVelocidade } =
    usePreferencias();
  const [personalizado, setPersonalizado] = useState("");

  function aplicarPersonalizado() {
    const n = parseInt(personalizado, 10);
    if (Number.isFinite(n) && n > 0) {
      setSaltoAbertura(n);
      setPersonalizado("");
    }
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.conteudo}>
      <Text style={styles.secao}>Aparência</Text>

      <View style={styles.cartao}>
        <Text style={styles.rotulo}>Tema</Text>
        <Text style={styles.ajuda}>
          No modo automático o app segue o tema do sistema (claro de dia,
          escuro à noite, se o aparelho estiver configurado assim).
        </Text>

        <View style={styles.opcoes}>
          {TEMAS.map((t) => {
            const ativo = t.id === preferencia;
            return (
              <Pressable
                key={t.id}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setPreferencia(t.id)}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                  {t.nome}
                </Text>
              </Pressable>
            );
          })}
        </View>

        {/* Em "auto" o rótulo sozinho não diz qual tema está valendo. */}
        <Text style={styles.atual}>
          {preferencia === "auto"
            ? `Atual: automático (${esquemaEfetivo === "dark" ? "escuro" : "claro"} agora)`
            : `Atual: ${preferencia === "dark" ? "escuro" : "claro"}`}
        </Text>
      </View>

      <Text style={styles.secao}>Player</Text>

      <View style={styles.cartao}>
        <Text style={styles.rotulo}>Pular abertura</Text>
        <Text style={styles.ajuda}>
          Quanto o botão “Pular abertura” avança no episódio. A abertura padrão
          de anime tem cerca de 90 segundos.
        </Text>

        <View style={styles.opcoes}>
          {SALTOS.map((s) => {
            const ativo = s === saltoAbertura;
            return (
              <Pressable
                key={s}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setSaltoAbertura(s)}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                  {s}s
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.ajuda}>Ou defina um valor próprio (segundos):</Text>
        <View style={styles.linhaPersonalizado}>
          <TextInput
            style={styles.input}
            value={personalizado}
            onChangeText={setPersonalizado}
            keyboardType="numeric"
            placeholder={String(saltoAbertura)}
            placeholderTextColor={cores.textoFraco}
            onSubmitEditing={aplicarPersonalizado}
          />
          <Pressable style={styles.aplicar} onPress={aplicarPersonalizado}>
            <Text style={styles.aplicarTexto}>Aplicar</Text>
          </Pressable>
        </View>

        <Text style={styles.atual}>Atual: {saltoAbertura}s</Text>
      </View>

      <View style={styles.cartao}>
        <Text style={styles.rotulo}>Velocidade de reprodução</Text>
        <Text style={styles.ajuda}>
          Velocidade com que os episódios começam. Dá para mudar durante a
          reprodução, no próprio player — a última escolha fica salva aqui.
        </Text>

        <View style={styles.opcoes}>
          {VELOCIDADES.map((v) => {
            const ativo = v === velocidade;
            return (
              <Pressable
                key={v}
                style={[styles.chip, ativo && styles.chipAtivo]}
                onPress={() => setVelocidade(v)}
              >
                <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                  {v}x
                </Text>
              </Pressable>
            );
          })}
        </View>

        <Text style={styles.atual}>Atual: {velocidade}x</Text>
      </View>
    </ScrollView>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
    container: { flex: 1 },
    conteudo: { padding: 16, gap: 12 },
    secao: {
      color: cores.textoFraco,
      fontSize: 13,
      fontWeight: "700",
      textTransform: "uppercase",
      marginBottom: 8,
      marginLeft: 4,
      // Respiro entre seções (o gap do conteúdo já separa os cartões).
      marginTop: 6,
    },
    cartao: {
      backgroundColor: cores.cartao,
      borderRadius: 12,
      padding: 16,
      borderWidth: 1,
      borderColor: cores.borda,
      gap: 10,
    },
    rotulo: { color: cores.texto, fontSize: 16, fontWeight: "700" },
    ajuda: { color: cores.textoFraco, fontSize: 13, lineHeight: 18 },
    opcoes: { flexDirection: "row", flexWrap: "wrap", gap: 8 },
    chip: {
      paddingVertical: 8,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: cores.cartaoAtivo,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    chipAtivo: { backgroundColor: cores.primaria, borderColor: cores.primaria },
    chipTexto: { color: cores.texto, fontSize: 14, fontWeight: "600" },
    chipTextoAtivo: { color: cores.sobrePrimaria, fontWeight: "700" },
    linhaPersonalizado: { flexDirection: "row", gap: 8 },
    input: {
      flex: 1,
      backgroundColor: cores.cartaoAtivo,
      borderRadius: 8,
      paddingHorizontal: 12,
      paddingVertical: 8,
      color: cores.texto,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    aplicar: {
      backgroundColor: cores.cartaoAtivo,
      borderRadius: 8,
      paddingHorizontal: 16,
      justifyContent: "center",
      borderWidth: 1,
      borderColor: cores.borda,
    },
    aplicarTexto: { color: cores.texto, fontWeight: "700" },
    atual: { color: cores.primaria, fontSize: 13, fontWeight: "700" },
  });
