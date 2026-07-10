// src/SeletorTema.js — escolha de tema: Claro / Escuro.
// Quem nunca escolheu segue o sistema (preferência "auto" no TemaProvider);
// ao tocar Claro ou Escuro, a escolha fica fixa. Não há botão "Automático".

import { useMemo } from "react";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useTema } from "./theme";

const OPCOES = [
  { id: "light", nome: "Claro" },
  { id: "dark", nome: "Escuro" },
];

export default function SeletorTema() {
  const { cores, esquemaEfetivo, setPreferencia } = useTema();
  const styles = useMemo(() => criarEstilos(cores), [cores]);

  return (
    <View style={styles.bloco}>
      <Text style={styles.rotulo}>Tema</Text>
      <View style={styles.opcoes}>
        {OPCOES.map((o) => {
          // Destaca o botão do tema ATUAL (mesmo quando a preferência é
          // "auto", segue o sistema e o botão correspondente fica ativo).
          const ativo = esquemaEfetivo === o.id;
          return (
            <Pressable
              key={o.id}
              onPress={() => setPreferencia(o.id)}
              style={[styles.chip, ativo && styles.chipAtivo]}
            >
              <Text style={[styles.chipTexto, ativo && styles.chipTextoAtivo]}>
                {o.nome}
              </Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
    bloco: { gap: 8, marginTop: 24 },
    rotulo: { color: cores.textoFraco, fontWeight: "600", fontSize: 13 },
    opcoes: { flexDirection: "row", gap: 8 },
    chip: {
      flex: 1,
      paddingVertical: 10,
      borderRadius: 10,
      alignItems: "center",
      backgroundColor: cores.cartao,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    chipAtivo: {
      backgroundColor: cores.primaria,
      borderColor: cores.primaria,
    },
    chipTexto: { color: cores.textoFraco, fontWeight: "600" },
    chipTextoAtivo: { color: cores.sobrePrimaria, fontWeight: "700" },
  });
