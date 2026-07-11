// app/_layout.js — navegação raiz (stack).

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { TemaProvider, useTema } from "../src/theme";
import { intervaloRef } from "../src/intervalo";
import IntervaloModal from "../src/IntervaloModal";
import { SessaoProvider } from "../src/sessao";
import BotaoTema from "../src/BotaoTema";

// A navegação em si consome o tema atual (cores do header/fundo e a StatusBar
// clara/escura), por isso fica num componente separado dentro do TemaProvider.
function Navegacao() {
  const { cores, esquemaEfetivo } = useTema();
  return (
    <>
      <StatusBar style={esquemaEfetivo === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          contentStyle: { backgroundColor: cores.fundo },
          headerShadowVisible: false,
          // Botão de tema (claro/escuro) presente no header de todas as telas.
          headerRight: () => <BotaoTema />,
        }}
      >
        {/* As abas (Início/Favoritos/Conta) trazem o próprio header. */}
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen name="anime" options={{ title: "Animes" }} />
        <Stack.Screen name="episodios" options={{ title: "Episódios" }} />
        <Stack.Screen name="player" options={{ title: "Assistir" }} />
        <Stack.Screen name="manga" options={{ title: "Mangás" }} />
        <Stack.Screen name="capitulos" options={{ title: "Capítulos" }} />
        <Stack.Screen name="leitor" options={{ title: "Leitura" }} />
        <Stack.Screen name="perfil" options={{ title: "Editar perfil" }} />
        <Stack.Screen name="login" options={{ title: "Entrar" }} />
      </Stack>
      {/* Modal de intervalo compartilhado, acionado via pedirIntervalo() */}
      <IntervaloModal ref={intervaloRef} />
    </>
  );
}

export default function RootLayout() {
  return (
    // Raiz de gestos: exigido pelo react-native-gesture-handler para o
    // pinch-to-zoom do leitor de mangá funcionar.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Tema (claro/escuro/auto) e sessão disponíveis em todo o app. */}
      <TemaProvider>
        <SessaoProvider>
          <Navegacao />
        </SessaoProvider>
      </TemaProvider>
    </GestureHandlerRootView>
  );
}
