// src/BotaoTema.js — ícone no header que alterna entre claro e escuro.
//
// Substitui o antigo SeletorTema da tela Conta: um toque troca o tema. Mostra
// o ícone do tema que a pessoa vai ATIVAR (lua no claro, sol no escuro), a
// convenção usual desse tipo de botão. Fixa a preferência (não fica em "auto").

import { Pressable } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTema } from "./theme";

export default function BotaoTema() {
  const { cores, esquemaEfetivo, setPreferencia } = useTema();
  const escuro = esquemaEfetivo === "dark";

  return (
    <Pressable
      onPress={() => setPreferencia(escuro ? "light" : "dark")}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={escuro ? "Ativar tema claro" : "Ativar tema escuro"}
      style={{ paddingHorizontal: 4 }}
    >
      <Ionicons
        name={escuro ? "sunny-outline" : "moon-outline"}
        size={24}
        color={cores.texto}
      />
    </Pressable>
  );
}
