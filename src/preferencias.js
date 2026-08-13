// src/preferencias.js — preferências do app que não são tema nem sessão.
//
// Hoje guarda só o salto do botão "Pular abertura" do player. Segue o mesmo
// desenho do theme.js: provider no layout raiz, restaura do AsyncStorage ao
// abrir e grava a cada mudança.

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const CHAVE = "@catscrappy:preferencias";

// 90s cobre a maioria das aberturas (a abertura padrão de anime tem ~90s).
export const SALTO_PADRAO = 90;

// Opções oferecidas na tela de configurações.
export const SALTOS = [60, 80, 85, 90, 95, 120];

// Velocidade de reprodução. O expo-video aceita de 0 a 16x, mas acima de 2x
// a fala fica ininteligível mesmo com correção de tom — as opções param em
// 3x, e o menu nativo do Android continua disponível para outros valores.
export const VELOCIDADE_PADRAO = 1;
export const VELOCIDADES = [0.75, 1, 1.25, 1.5, 1.75, 2, 2.5, 3];
const VELOCIDADE_MIN = 0.25;
const VELOCIDADE_MAX = 16;

const PreferenciasContext = createContext(null);

export function PreferenciasProvider({ children }) {
  const [saltoAbertura, setSaltoState] = useState(SALTO_PADRAO);
  const [velocidade, setVelocidadeState] = useState(VELOCIDADE_PADRAO);

  // Restaura ao abrir o app.
  useEffect(() => {
    (async () => {
      try {
        const bruto = await AsyncStorage.getItem(CHAVE);
        const salvo = bruto ? JSON.parse(bruto) : null;
        const n = Number(salvo?.saltoAbertura);
        // Só aceita um número positivo: um valor corrompido no storage não
        // pode deixar o botão pulando 0s (ou para trás).
        if (Number.isFinite(n) && n > 0) setSaltoState(n);
        const v = Number(salvo?.velocidade);
        // Idem: um valor fora da faixa deixaria o vídeo parado (0) ou
        // impossível de acompanhar.
        if (Number.isFinite(v) && v >= VELOCIDADE_MIN && v <= VELOCIDADE_MAX) {
          setVelocidadeState(v);
        }
      } catch (e) {
        // Sem preferência salva (ou JSON inválido): mantém os padrões.
      }
    })();
  }, []);

  // Grava mesclando com o que já está salvo: escrever só o campo alterado
  // apagaria a outra preferência (é tudo um JSON só).
  async function gravar(campos) {
    try {
      const bruto = await AsyncStorage.getItem(CHAVE);
      const atual = bruto ? JSON.parse(bruto) : {};
      await AsyncStorage.setItem(
        CHAVE,
        JSON.stringify({ ...atual, ...campos })
      );
    } catch (e) {
      // Falha ao salvar não deve travar a troca.
    }
  }

  async function setSaltoAbertura(segundos) {
    const n = Number(segundos);
    if (!Number.isFinite(n) || n <= 0) return;
    setSaltoState(n);
    await gravar({ saltoAbertura: n });
  }

  async function setVelocidade(valor) {
    const n = Number(valor);
    if (!Number.isFinite(n) || n < VELOCIDADE_MIN || n > VELOCIDADE_MAX) return;
    setVelocidadeState(n);
    await gravar({ velocidade: n });
  }

  const valor = useMemo(
    () => ({ saltoAbertura, setSaltoAbertura, velocidade, setVelocidade }),
    [saltoAbertura, velocidade]
  );

  return (
    <PreferenciasContext.Provider value={valor}>
      {children}
    </PreferenciasContext.Provider>
  );
}

export function usePreferencias() {
  // Sem provider (ou antes dele montar), o padrão mantém o player funcional.
  return (
    useContext(PreferenciasContext) || {
      saltoAbertura: SALTO_PADRAO,
      setSaltoAbertura: () => {},
      velocidade: VELOCIDADE_PADRAO,
      setVelocidade: () => {},
    }
  );
}
