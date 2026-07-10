// app/(tabs)/conta.js — entrar / criar conta, ou ver a conta e sair.
// Login é opcional: só é preciso para salvar favoritos.

import { useMemo, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import {
  useSessao,
  nomeExibicao,
  avatarUrl,
} from "../../src/sessao";
import { useCores } from "../../src/theme";
import SeletorTema from "../../src/SeletorTema";

export default function ContaScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { logado, usuario, entrar, criarConta, sair } = useSessao();
  const [modo, setModo] = useState("entrar"); // "entrar" | "criar"
  const [nome, setNome] = useState("");
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

  if (logado) {
    const foto = avatarUrl(usuario);
    const nomeUsuario = nomeExibicao(usuario);
    return (
      <View style={styles.container}>
        <View style={styles.perfil}>
          {foto ? (
            <Image source={{ uri: foto }} style={styles.avatarFoto} />
          ) : (
            <View style={styles.avatarInicial}>
              <Text style={styles.avatarInicialTexto}>
                {nomeUsuario.charAt(0).toUpperCase()}
              </Text>
            </View>
          )}
          <Text style={styles.nome}>{nomeUsuario}</Text>
          <Text style={styles.email}>{usuario?.email || ""}</Text>
        </View>

        <Pressable
          style={styles.botaoEditar}
          onPress={() => router.push("/perfil")}
        >
          <Text style={styles.botaoEditarTexto}>Editar perfil</Text>
        </Pressable>

        <Pressable style={styles.botaoSair} onPress={sair}>
          <Text style={styles.botaoSairTexto}>Sair da conta</Text>
        </Pressable>

        <SeletorTema />
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

      <SeletorTema />
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
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
  perfil: { alignItems: "center", gap: 6, marginBottom: 24 },
  avatarFoto: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 6,
    backgroundColor: cores.cartaoAtivo,
  },
  avatarInicial: {
    width: 96,
    height: 96,
    borderRadius: 48,
    marginBottom: 6,
    backgroundColor: cores.primaria,
    alignItems: "center",
    justifyContent: "center",
  },
  avatarInicialTexto: {
    color: cores.sobrePrimaria,
    fontSize: 44,
    fontWeight: "700",
  },
  nome: { color: cores.texto, fontSize: 22, fontWeight: "700" },
  email: { color: cores.textoFraco, fontSize: 14 },
  botaoEditar: {
    backgroundColor: cores.primaria,
    borderRadius: 10,
    paddingVertical: 14,
    alignItems: "center",
  },
  botaoEditarTexto: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 16 },
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
