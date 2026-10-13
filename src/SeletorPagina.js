// src/SeletorPagina.js — navegação por faixas ("1–50", "51–100", ...) em
// listas longas de episódios/capítulos.
//
// Antes as faixas eram chips numa fita horizontal: com One Piece (1190
// capítulos) são 24 chips, e chegar nos últimos exigia arrastar bastante,
// sem enxergar quantos faltavam. Aqui um único botão mostra a faixa atual e
// abre um modal com todas na vertical, numa lista rolável — o alvo desejado
// aparece direto, e a faixa ativa já vem centralizada na abertura.

import { useMemo, useState } from "react";
import {
  FlatList,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCores } from "./theme";

// Rótulo de uma faixa: "1–50", e no último bloco o total real ("1151–1190").
// Em ordem decrescente (mais recente primeiro) a primeira faixa é a do fim:
// "1190–1141".
function rotuloFaixa(indice, tamanho, total, decrescente) {
  if (decrescente) {
    return `${total - indice * tamanho}–${Math.max(total - (indice + 1) * tamanho + 1, 1)}`;
  }
  return `${indice * tamanho + 1}–${Math.min((indice + 1) * tamanho, total)}`;
}

export default function SeletorPagina({
  pagina,
  totalPaginas,
  tamanhoPagina,
  total,
  unidade = "item",
  decrescente = false,
  onSelecionar,
}) {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const [aberto, setAberto] = useState(false);

  // Uma faixa só não é navegação: nada a mostrar.
  if (totalPaginas <= 1) return null;

  const faixas = Array.from({ length: totalPaginas }, (_, i) => ({
    indice: i,
    rotulo: rotuloFaixa(i, tamanhoPagina, total, decrescente),
  }));

  function escolher(indice) {
    setAberto(false);
    onSelecionar(indice);
  }

  return (
    <>
      <Pressable style={styles.gatilho} onPress={() => setAberto(true)}>
        <Text style={styles.gatilhoRotulo}>
          {unidade} {rotuloFaixa(pagina, tamanhoPagina, total, decrescente)}
        </Text>
        <Text style={styles.gatilhoDica}>
          {pagina + 1}/{totalPaginas} ▾
        </Text>
      </Pressable>

      <Modal
        visible={aberto}
        transparent
        animationType="fade"
        // Sem isso o botão físico "voltar" do Android fecharia a tela toda
        // em vez do modal.
        onRequestClose={() => setAberto(false)}
      >
        {/* Tocar fora fecha; o toque dentro da caixa não deve vazar para cá. */}
        <Pressable style={styles.fundo} onPress={() => setAberto(false)}>
          <Pressable style={styles.caixa} onPress={() => {}}>
            <Text style={styles.titulo}>Ir para</Text>

            <FlatList
              data={faixas}
              keyExtractor={(f) => String(f.indice)}
              // A lista pode ter dezenas de faixas: abre já mostrando a atual
              // em vez de forçar a rolagem desde o começo. getItemLayout é o
              // que permite o salto direto (altura fixa por linha).
              initialScrollIndex={pagina}
              getItemLayout={(_, i) => ({
                length: ALTURA_LINHA,
                offset: ALTURA_LINHA * i,
                index: i,
              })}
              renderItem={({ item }) => {
                const ativa = item.indice === pagina;
                return (
                  <Pressable
                    style={[styles.linha, ativa && styles.linhaAtiva]}
                    onPress={() => escolher(item.indice)}
                  >
                    <Text
                      style={[styles.linhaTexto, ativa && styles.linhaTextoAtiva]}
                    >
                      {item.rotulo}
                    </Text>
                    {ativa && <Text style={styles.marca}>✓</Text>}
                  </Pressable>
                );
              }}
            />

            <Pressable style={styles.fechar} onPress={() => setAberto(false)}>
              <Text style={styles.fecharTexto}>Fechar</Text>
            </Pressable>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}

// Altura de cada linha; precisa bater com o estilo para o getItemLayout
// acertar o salto até a faixa ativa.
const ALTURA_LINHA = 48;

const criarEstilos = (cores) =>
  StyleSheet.create({
    gatilho: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      backgroundColor: cores.cartao,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 10,
      borderWidth: 1,
      borderColor: cores.borda,
      marginBottom: 12,
    },
    gatilhoRotulo: { color: cores.texto, fontWeight: "700", fontSize: 14 },
    gatilhoDica: { color: cores.textoFraco, fontSize: 13, fontWeight: "600" },
    fundo: {
      flex: 1,
      backgroundColor: "rgba(0,0,0,0.7)",
      alignItems: "center",
      justifyContent: "center",
    },
    caixa: {
      backgroundColor: cores.cartao,
      borderRadius: 16,
      padding: 18,
      width: "82%",
      // Teto para a lista não encostar nas bordas da tela em listas longas.
      maxHeight: "70%",
      borderWidth: 1,
      borderColor: cores.borda,
    },
    titulo: {
      color: cores.texto,
      fontSize: 18,
      fontWeight: "700",
      marginBottom: 10,
    },
    linha: {
      height: ALTURA_LINHA,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 14,
      borderRadius: 10,
      backgroundColor: cores.cartaoAtivo,
      marginBottom: 8,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    linhaAtiva: {
      backgroundColor: cores.primaria,
      borderColor: cores.primaria,
    },
    linhaTexto: { color: cores.texto, fontSize: 15, fontWeight: "600" },
    linhaTextoAtiva: { color: cores.sobrePrimaria, fontWeight: "700" },
    marca: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 15 },
    fechar: {
      marginTop: 6,
      borderRadius: 8,
      padding: 12,
      alignItems: "center",
      backgroundColor: cores.cartaoAtivo,
    },
    fecharTexto: { color: cores.texto, fontWeight: "700" },
  });
