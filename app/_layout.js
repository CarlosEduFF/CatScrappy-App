// app/_layout.js — navegação raiz (stack).

import { Stack } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { cores } from "../src/theme";

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
        <Stack.Screen name="episodios" options={{ title: "Episódios" }} />
        <Stack.Screen name="player" options={{ title: "Assistir" }} />
      </Stack>
    </>
  );
}
