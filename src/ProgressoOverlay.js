// src/ProgressoOverlay.js — overlay de progresso durante downloads em lote.

import { ActivityIndicator, Modal, StyleSheet, Text, View } from "react-native";
import { cores } from "./theme";

export default function ProgressoOverlay({ visivel, rotulo, fracao }) {
  const pct = Math.round((fracao || 0) * 100);
  return (
    <Modal visible={visivel} transparent animationType="fade">
      <View style={styles.fundo}>
        <View style={styles.caixa}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.rotulo}>{rotulo}</Text>
          <View style={styles.barraFundo}>
            <View style={[styles.barra, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pct}>{pct}%</Text>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  fundo: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.7)",
    alignItems: "center",
    justifyContent: "center",
  },
  caixa: {
    backgroundColor: cores.cartao,
    borderRadius: 16,
    padding: 24,
    width: "80%",
    alignItems: "center",
    gap: 14,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  rotulo: { color: cores.texto, fontSize: 16, fontWeight: "600" },
  barraFundo: {
    width: "100%",
    height: 8,
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 4,
    overflow: "hidden",
  },
  barra: { height: "100%", backgroundColor: cores.primaria },
  pct: { color: cores.textoFraco, fontSize: 13 },
});
