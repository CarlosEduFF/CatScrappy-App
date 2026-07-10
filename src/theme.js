// src/theme.js — tema claro/escuro com persistência.
//
// A paleta escura vem da logo (garras pretas sobre laranja vibrante): fundo
// preto quente e laranja como cor primária. A clara mantém o laranja como
// destaque sobre superfícies claras. O laranja (primária) é o mesmo nos dois.
//
// O usuário escolhe Claro / Escuro / Automático (segue o sistema) na tela
// Conta; a preferência é salva no AsyncStorage. Componentes leem as cores via
// useTema()/useCores() e recriam seus estilos com uma função criarEstilos(cores).

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const PALETA_ESCURA = {
  esquema: "dark",
  fundo: "#0e0d0b",
  // Superfícies (cards, área das opções) em cinza neutro, destacando do
  // fundo quase-preto. O laranja continua como cor de destaque.
  cartao: "#2b2b2e",
  cartaoAtivo: "#3a3a3e",
  texto: "#f7f3ee",
  textoFraco: "#b0aeb0",
  primaria: "#f5820d",
  primariaEscura: "#c4670a",
  sobrePrimaria: "#140d06",
  borda: "#45454a",
  erro: "#ff5d5d",
};

const PALETA_CLARA = {
  esquema: "light",
  fundo: "#faf7f2",
  cartao: "#ffffff",
  cartaoAtivo: "#fbeede",
  texto: "#1c1a17",
  textoFraco: "#6d6459",
  primaria: "#e5760a",
  primariaEscura: "#c4670a",
  sobrePrimaria: "#fff8f0",
  borda: "#e6ddd1",
  erro: "#d83a3a",
};

export const PALETAS = { dark: PALETA_ESCURA, light: PALETA_CLARA };

// Fallback para código que ainda importe `cores` diretamente (não reage à
// troca de tema; prefira useCores() em componentes).
export const cores = PALETA_ESCURA;

// Preferência do usuário: "dark" | "light" | "auto".
const CHAVE = "@catscrappy:tema";

const TemaContext = createContext(null);

export function TemaProvider({ children }) {
  const esquemaSistema = useColorScheme(); // "dark" | "light" | null
  const [preferencia, setPreferenciaState] = useState("auto");
  const [carregado, setCarregado] = useState(false);

  // Restaura a preferência salva ao abrir o app.
  useEffect(() => {
    (async () => {
      try {
        const salva = await AsyncStorage.getItem(CHAVE);
        if (salva === "dark" || salva === "light" || salva === "auto") {
          setPreferenciaState(salva);
        }
      } catch (e) {
        // Sem preferência salva: mantém "auto".
      } finally {
        setCarregado(true);
      }
    })();
  }, []);

  async function setPreferencia(valor) {
    setPreferenciaState(valor);
    try {
      await AsyncStorage.setItem(CHAVE, valor);
    } catch (e) {
      // Falha ao salvar não deve travar a troca de tema.
    }
  }

  // "auto" segue o sistema; se o sistema não informar, cai no escuro.
  const esquemaEfetivo =
    preferencia === "auto" ? esquemaSistema || "dark" : preferencia;
  const coresAtuais = PALETAS[esquemaEfetivo] || PALETA_ESCURA;

  const valor = useMemo(
    () => ({
      cores: coresAtuais,
      preferencia,
      setPreferencia,
      esquemaEfetivo,
      carregado,
    }),
    [coresAtuais, preferencia, esquemaEfetivo, carregado]
  );

  return <TemaContext.Provider value={valor}>{children}</TemaContext.Provider>;
}

export function useTema() {
  const ctx = useContext(TemaContext);
  if (!ctx) throw new Error("useTema precisa estar dentro de <TemaProvider>.");
  return ctx;
}

// Atalho: componentes que só precisam das cores.
export function useCores() {
  return useTema().cores;
}
