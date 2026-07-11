// app/(tabs)/conta.js — mostra o perfil (logado) ou um convite para entrar.
// O login/cadastro em si fica na tela separada app/login.js.

import { useMemo } from "react";
import { Image, Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSessao, nomeExibicao, avatarUrl } from "../../src/sessao";
import { useCores } from "../../src/theme";

export default function ContaScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { logado, usuario, sair } = useSessao();

  if (logado) {
    const foto = avatarUrl(usuario);
    const nomeUsuario = nomeExibicao(usuario);
    return (
      <View style={styles.container}>
        {/* Área das opções destacada (fundo cinza no modo escuro). */}
        <View style={styles.cartaoOpcoes}>
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
        </View>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <View style={styles.cartaoOpcoes}>
        <Text style={styles.emoji}>👤</Text>
        <Text style={styles.titulo}>Sua conta</Text>
        <Text style={styles.sub}>
          Entre para salvar seus animes e mangás favoritos e acessar de
          qualquer lugar.
        </Text>

        <Pressable style={styles.botao} onPress={() => router.push("/login")}>
          <Text style={styles.botaoTexto}>Entrar ou criar conta</Text>
        </Pressable>
      </View>
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
    container: {
      flex: 1,
      padding: 20,
      justifyContent: "center",
      backgroundColor: cores.fundo,
    },
    // Container central das opções, em cinza (destaca do fundo no dark mode).
    cartaoOpcoes: {
      backgroundColor: cores.cartao,
      borderRadius: 16,
      padding: 20,
      gap: 12,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    emoji: { fontSize: 48, textAlign: "center" },
    titulo: {
      color: cores.texto,
      fontSize: 22,
      fontWeight: "700",
      textAlign: "center",
    },
    sub: { color: cores.textoFraco, textAlign: "center", marginBottom: 4 },
    botao: {
      backgroundColor: cores.primaria,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
    },
    botaoTexto: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 16 },
    perfil: { alignItems: "center", gap: 6, marginBottom: 12 },
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
    botaoEditarTexto: {
      color: cores.sobrePrimaria,
      fontWeight: "700",
      fontSize: 16,
    },
    botaoSair: {
      backgroundColor: cores.cartaoAtivo,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      borderWidth: 1,
      borderColor: cores.borda,
    },
    botaoSairTexto: { color: cores.erro, fontWeight: "700", fontSize: 16 },
  });
