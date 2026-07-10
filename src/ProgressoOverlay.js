// src/ProgressoOverlay.js — overlay de progresso durante downloads em lote.
// "Ocultar" fecha o overlay sem parar o download (o progresso continua na
// barra de notificação); "Cancelar" interrompe o lote.

import { useMemo } from "react";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useCores } from "./theme";

export default function ProgressoOverlay({
  visivel,
  rotulo,
  fracao,
  onOcultar,
  onCancelar,
}) {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const pct = Math.round((fracao || 0) * 100);
  return (
    <Modal
      visible={visivel}
      transparent
      animationType="fade"
      onRequestClose={onOcultar}
    >
      <View style={styles.fundo}>
        <View style={styles.caixa}>
          <ActivityIndicator color={cores.primaria} size="large" />
          <Text style={styles.rotulo}>{rotulo}</Text>
          <View style={styles.barraFundo}>
            <View style={[styles.barra, { width: `${pct}%` }]} />
          </View>
          <Text style={styles.pct}>{pct}%</Text>

          <View style={styles.botoes}>
            {!!onOcultar && (
              <Pressable style={styles.botao} onPress={onOcultar}>
                <Text style={styles.botaoTexto}>Ocultar</Text>
              </Pressable>
            )}
            {!!onCancelar && (
              <Pressable
                style={[styles.botao, styles.cancelar]}
                onPress={onCancelar}
              >
                <Text style={styles.cancelarTexto}>Cancelar</Text>
              </Pressable>
            )}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
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
  botoes: { flexDirection: "row", gap: 10, marginTop: 4 },
  botao: {
    flex: 1,
    borderRadius: 8,
    padding: 12,
    alignItems: "center",
    backgroundColor: cores.cartaoAtivo,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  cancelar: { backgroundColor: "transparent", borderColor: cores.erro },
  botaoTexto: { color: cores.texto, fontWeight: "700" },
  cancelarTexto: { color: cores.erro, fontWeight: "700" },
  });
