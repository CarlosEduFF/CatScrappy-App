// src/IntervaloModal.js — modal de seleção de intervalo (montado no layout raiz).

import { useImperativeHandle, forwardRef, useState } from "react";
import {
  Modal,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { filtrarIntervalo } from "./intervalo";
import { cores } from "./theme";

function IntervaloModal(props, ref) {
  const [visivel, setVisivel] = useState(false);
  const [itens, setItens] = useState([]);
  const [unidade, setUnidade] = useState("item");
  const [ini, setIni] = useState("");
  const [fim, setFim] = useState("");
  const [resolver, setResolver] = useState(null);

  useImperativeHandle(ref, () => ({
    abrir(lista, un, resolve) {
      setItens(lista);
      setUnidade(un);
      setIni(lista[0]?.numero ?? "");
      setFim(lista[lista.length - 1]?.numero ?? "");
      setResolver(() => resolve);
      setVisivel(true);
    },
  }));

  function confirmar() {
    const a = parseFloat(String(ini).replace(",", "."));
    const b = parseFloat(String(fim).replace(",", "."));
    setVisivel(false);
    if (isNaN(a) || isNaN(b)) {
      resolver?.(null);
      return;
    }
    resolver?.(filtrarIntervalo(itens, a, b));
  }

  function cancelar() {
    setVisivel(false);
    resolver?.(null);
  }

  return (
    <Modal visible={visivel} transparent animationType="fade">
      <View style={styles.fundo}>
        <View style={styles.caixa}>
          <Text style={styles.titulo}>Baixar intervalo</Text>
          <Text style={styles.label}>Do {unidade} nº</Text>
          <TextInput
            style={styles.input}
            value={String(ini)}
            onChangeText={setIni}
            keyboardType="numeric"
            placeholderTextColor={cores.textoFraco}
          />
          <Text style={styles.label}>Até o {unidade} nº</Text>
          <TextInput
            style={styles.input}
            value={String(fim)}
            onChangeText={setFim}
            keyboardType="numeric"
            placeholderTextColor={cores.textoFraco}
          />
          <View style={styles.botoes}>
            <Pressable style={[styles.botao, styles.cancelar]} onPress={cancelar}>
              <Text style={styles.botaoTexto}>Cancelar</Text>
            </Pressable>
            <Pressable style={[styles.botao, styles.ok]} onPress={confirmar}>
              <Text style={styles.okTexto}>Baixar</Text>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

export default forwardRef(IntervaloModal);

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
    padding: 22,
    width: "82%",
    gap: 8,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  titulo: {
    color: cores.texto,
    fontSize: 18,
    fontWeight: "700",
    marginBottom: 6,
  },
  label: { color: cores.textoFraco, fontSize: 13 },
  input: {
    backgroundColor: cores.cartaoAtivo,
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    color: cores.texto,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botoes: { flexDirection: "row", gap: 10, marginTop: 14 },
  botao: { flex: 1, borderRadius: 8, padding: 12, alignItems: "center" },
  cancelar: { backgroundColor: cores.cartaoAtivo },
  ok: { backgroundColor: cores.primaria },
  botaoTexto: { color: cores.texto, fontWeight: "700" },
  okTexto: { color: cores.sobrePrimaria, fontWeight: "700" },
});
