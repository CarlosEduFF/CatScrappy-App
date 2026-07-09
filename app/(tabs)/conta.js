// app/(tabs)/conta.js — entrar / criar conta, ou ver a conta e sair.
// Login é opcional: só é preciso para salvar favoritos.

import { useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useSessao } from "../../src/sessao";
import { cores } from "../../src/theme";

export default function ContaScreen() {
  const { logado, usuario, entrar, criarConta, sair } = useSessao();
  const [modo, setModo] = useState("entrar"); // "entrar" | "criar"
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  async function enviar() {
    setErro(null);
    setAviso(null);
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        await entrar(email.trim(), senha);
      } else {
        const r = await criarConta(email.trim(), senha);
        if (r.precisaConfirmar) {
          setAviso(
            `Conta criada! Enviamos um link de confirmação para ${email.trim()}. ` +
              "Confirme pela caixa de entrada (veja também o spam) e depois entre."
          );
          setModo("entrar");
        }
      }
      setSenha("");
    } catch (e) {
      setErro(e.message);
    } finally {
      setCarregando(false);
    }
  }

  if (logado) {
    return (
      <View style={styles.container}>
        <View style={styles.perfil}>
          <Text style={styles.avatar}>👤</Text>
          <Text style={styles.email}>{usuario?.email || "Conectado"}</Text>
        </View>
        <Pressable style={styles.botaoSair} onPress={sair}>
          <Text style={styles.botaoSairTexto}>Sair da conta</Text>
        </Pressable>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.titulo}>
        {modo === "entrar" ? "Entrar" : "Criar conta"}
      </Text>
      <Text style={styles.sub}>
        Salve seus animes e mangás favoritos e acesse de qualquer lugar.
      </Text>

      <TextInput
        style={styles.input}
        placeholder="E-mail"
        placeholderTextColor={cores.textoFraco}
        value={email}
        onChangeText={setEmail}
        autoCapitalize="none"
        keyboardType="email-address"
        autoCorrect={false}
      />
      <TextInput
        style={styles.input}
        placeholder="Senha"
        placeholderTextColor={cores.textoFraco}
        value={senha}
        onChangeText={setSenha}
        secureTextEntry
      />

      {erro && <Text style={styles.erro}>{erro}</Text>}
      {aviso && <Text style={styles.aviso}>{aviso}</Text>}

      <Pressable style={styles.botao} onPress={enviar} disabled={carregando}>
        {carregando ? (
          <ActivityIndicator color={cores.sobrePrimaria} />
        ) : (
          <Text style={styles.botaoTexto}>
            {modo === "entrar" ? "Entrar" : "Criar conta"}
          </Text>
        )}
      </Pressable>

      <Pressable
        onPress={() => {
          setModo(modo === "entrar" ? "criar" : "entrar");
          setErro(null);
          setAviso(null);
        }}
      >
        <Text style={styles.alternar}>
          {modo === "entrar"
            ? "Não tem conta? Criar uma"
            : "Já tem conta? Entrar"}
        </Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, justifyContent: "center", gap: 12 },
  titulo: { color: cores.texto, fontSize: 24, fontWeight: "700" },
  sub: { color: cores.textoFraco, marginBottom: 8 },
  input: {
    backgroundColor: cores.cartao,
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 12,
    color: cores.texto,
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botao: {
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    marginTop: 4,
  },
  botaoTexto: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 16 },
  alternar: { color: cores.primaria, textAlign: "center", marginTop: 8 },
  erro: { color: cores.erro, textAlign: "center" },
  aviso: { color: cores.textoFraco, textAlign: "center" },
  perfil: { alignItems: "center", gap: 12, marginBottom: 24 },
  avatar: { fontSize: 56 },
  email: { color: cores.texto, fontSize: 18, fontWeight: "600" },
  botaoSair: {
    backgroundColor: cores.cartao,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
    borderWidth: 1,
    borderColor: cores.borda,
  },
  botaoSairTexto: { color: cores.erro, fontWeight: "700", fontSize: 16 },
});
