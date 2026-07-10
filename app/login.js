// app/login.js — tela de login / criação de conta (separada da aba Conta).
// Ao entrar com sucesso, volta para a tela anterior (a Conta mostra o perfil).

import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter, Stack } from "expo-router";
import { useSessao } from "../src/sessao";
import { useCores } from "../src/theme";

export default function LoginScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { logado, entrar, criarConta } = useSessao();
  const [modo, setModo] = useState("entrar"); // "entrar" | "criar"
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);
  const [erro, setErro] = useState(null);
  const [aviso, setAviso] = useState(null);

  // Assim que logar, fecha esta tela (volta para a Conta com o perfil).
  useEffect(() => {
    if (logado) router.back();
  }, [logado]);

  async function enviar() {
    setErro(null);
    setAviso(null);
    if (!email.trim() || !senha) {
      setErro("Preencha e-mail e senha.");
      return;
    }
    if (modo === "criar" && !nome.trim()) {
      setErro("Escolha um nome de exibição.");
      return;
    }
    setCarregando(true);
    try {
      if (modo === "entrar") {
        await entrar(email.trim(), senha);
      } else {
        const r = await criarConta(email.trim(), senha, nome.trim());
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

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{ title: modo === "entrar" ? "Entrar" : "Criar conta" }}
      />

      {/* Área das opções destacada (fundo cinza no modo escuro). */}
      <View style={styles.cartaoOpcoes}>
        <Text style={styles.sub}>
          Salve seus animes e mangás favoritos e acesse de qualquer lugar.
        </Text>

        {modo === "criar" && (
          <TextInput
            style={styles.input}
            placeholder="Nome de exibição"
            placeholderTextColor={cores.textoFraco}
            value={nome}
            onChangeText={setNome}
            autoCapitalize="words"
          />
        )}

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
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
    container: { flex: 1, padding: 20, justifyContent: "center" },
    // Container central das opções, em cinza (destaca do fundo no dark mode).
    cartaoOpcoes: {
      backgroundColor: cores.cartao,
      borderRadius: 16,
      padding: 20,
      gap: 12,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    sub: { color: cores.textoFraco, marginBottom: 4 },
    input: {
      backgroundColor: cores.cartaoAtivo,
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
  });
