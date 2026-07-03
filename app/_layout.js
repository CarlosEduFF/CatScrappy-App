// app/_layout.js — navegação raiz (stack).

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { cores } from "../src/theme";
import { intervaloRef } from "../src/intervalo";
import IntervaloModal from "../src/IntervaloModal";

export default function RootLayout() {
  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: cores.fundo },
          headerTintColor: cores.texto,
          contentStyle: { backgroundColor: cores.fundo },
          headerShadowVisible: false,
        }}
      >
        <Stack.Screen name="index" options={{ title: "CatScrappy" }} />
        <Stack.Screen name="anime" options={{ title: "Animes" }} />
        <Stack.Screen name="episodios" options={{ title: "Episódios" }} />
        <Stack.Screen name="player" options={{ title: "Assistir" }} />
        <Stack.Screen name="manga" options={{ title: "Mangás" }} />
        <Stack.Screen name="capitulos" options={{ title: "Capítulos" }} />
        <Stack.Screen name="leitor" options={{ title: "Leitura" }} />
      </Stack>
      {/* Modal de intervalo compartilhado, acionado via pedirIntervalo() */}
      <IntervaloModal ref={intervaloRef} />
    </>
  );
}
