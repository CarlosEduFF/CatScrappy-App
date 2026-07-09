// app/_layout.js — navegação raiz (stack).

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { cores } from "../src/theme";
import { intervaloRef } from "../src/intervalo";
import IntervaloModal from "../src/IntervaloModal";
import { SessaoProvider } from "../src/sessao";

export default function RootLayout() {
  return (
    // Raiz de gestos: exigido pelo react-native-gesture-handler para o
    // pinch-to-zoom do leitor de mangá funcionar.
    <GestureHandlerRootView style={{ flex: 1 }}>
      {/* Sessão do usuário (login opcional + favoritos) disponível em todo o app. */}
      <SessaoProvider>
        <StatusBar style="light" />
        <Stack
          screenOptions={{
            headerStyle: { backgroundColor: cores.fundo },
            headerTintColor: cores.texto,
            contentStyle: { backgroundColor: cores.fundo },
            headerShadowVisible: false,
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
        </Stack>
        {/* Modal de intervalo compartilhado, acionado via pedirIntervalo() */}
        <IntervaloModal ref={intervaloRef} />
      </SessaoProvider>
    </GestureHandlerRootView>
  );
}
