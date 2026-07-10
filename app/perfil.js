// app/perfil.js — edição do perfil: nome de exibição e foto.

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
import * as ImagePicker from "expo-image-picker";
import { useRouter, Stack } from "expo-router";
import {
  useSessao,
  nomeExibicao,
  avatarUrl,
} from "../src/sessao";
import { useCores } from "../src/theme";

export default function PerfilScreen() {
  const cores = useCores();
  const styles = useMemo(() => criarEstilos(cores), [cores]);
  const router = useRouter();
  const { usuario, atualizarNome, atualizarAvatar } = useSessao();

  const [nome, setNome] = useState(nomeExibicao(usuario));
  const foto = avatarUrl(usuario);
  const [salvando, setSalvando] = useState(false);
  const [enviandoFoto, setEnviandoFoto] = useState(false);
  const [erro, setErro] = useState(null);

  async function escolherFoto() {
    setErro(null);
    // Pede permissão à galeria (o plugin já declara a mensagem no app.json).
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      setErro("Permita o acesso às fotos para trocar o avatar.");
      return;
    }
    const r = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.7,
    });
    if (r.canceled || !r.assets?.length) return;

    setEnviandoFoto(true);
    try {
      await atualizarAvatar(r.assets[0]);
    } catch (e) {
      setErro(e.message);
    } finally {
      setEnviandoFoto(false);
    }
  }

  async function salvarNome() {
    setErro(null);
    if (!nome.trim()) {
      setErro("O nome não pode ficar vazio.");
      return;
    }
    setSalvando(true);
    try {
      await atualizarNome(nome.trim());
      router.back();
    } catch (e) {
      setErro(e.message);
    } finally {
      setSalvando(false);
    }
  }

  const inicial = (nome || "U").charAt(0).toUpperCase();

  return (
    <View style={styles.container}>
      <Stack.Screen options={{ title: "Editar perfil" }} />

      <Pressable style={styles.fotoArea} onPress={escolherFoto}>
        {enviandoFoto ? (
          <View style={styles.avatarInicial}>
            <ActivityIndicator color={cores.sobrePrimaria} />
          </View>
        ) : foto ? (
          <Image source={{ uri: foto }} style={styles.avatarFoto} />
        ) : (
          <View style={styles.avatarInicial}>
            <Text style={styles.avatarInicialTexto}>{inicial}</Text>
          </View>
        )}
        <Text style={styles.trocarFoto}>Trocar foto</Text>
      </Pressable>

      <Text style={styles.rotulo}>Nome de exibição</Text>
      <TextInput
        style={styles.input}
        value={nome}
        onChangeText={setNome}
        placeholder="Seu nome"
        placeholderTextColor={cores.textoFraco}
        autoCapitalize="words"
      />

      {erro && <Text style={styles.erro}>{erro}</Text>}

      <Pressable style={styles.botao} onPress={salvarNome} disabled={salvando}>
        {salvando ? (
          <ActivityIndicator color={cores.sobrePrimaria} />
        ) : (
          <Text style={styles.botaoTexto}>Salvar</Text>
        )}
      </Pressable>
    </View>
  );
}

const criarEstilos = (cores) =>
  StyleSheet.create({
    container: { flex: 1, padding: 20, gap: 12 },
    fotoArea: { alignItems: "center", gap: 8, marginBottom: 12 },
    avatarFoto: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: cores.cartaoAtivo,
    },
    avatarInicial: {
      width: 120,
      height: 120,
      borderRadius: 60,
      backgroundColor: cores.primaria,
      alignItems: "center",
      justifyContent: "center",
    },
    avatarInicialTexto: {
      color: cores.sobrePrimaria,
      fontSize: 52,
      fontWeight: "700",
    },
    trocarFoto: { color: cores.primaria, fontWeight: "700", fontSize: 14 },
    rotulo: { color: cores.textoFraco, fontWeight: "600", fontSize: 13 },
    input: {
      backgroundColor: cores.cartao,
      borderRadius: 10,
      paddingHorizontal: 14,
      paddingVertical: 12,
      color: cores.texto,
      borderWidth: 1,
      borderColor: cores.borda,
    },
    erro: { color: cores.erro, textAlign: "center" },
    botao: {
      backgroundColor: cores.primaria,
      borderRadius: 10,
      paddingVertical: 14,
      alignItems: "center",
      marginTop: 4,
    },
    botaoTexto: { color: cores.sobrePrimaria, fontWeight: "700", fontSize: 16 },
  });
