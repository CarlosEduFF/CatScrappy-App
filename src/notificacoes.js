// src/notificacoes.js — progresso de download na barra de notificação.
//
// Uma única notificação persistente (sticky) é atualizada durante o download
// — assim dá para acompanhar de fora do app — e trocada por um resumo
// dispensável ao final. Atualizações são limitadas a 1/s para não sobrecarregar
// o sistema. Se a permissão for negada, tudo aqui vira no-op silencioso
// (o overlay dentro do app continua funcionando).

import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

const ID = "download-progresso";
const CANAL = "downloads";
let pronto = false;
let ultimoEnvio = 0;

// Sem banner/som a cada atualização: a notificação vive na bandeja.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: false,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

// Pede permissão (uma vez) e cria o canal Android de importância baixa
// (sem som/vibração nas atualizações).
export async function iniciar() {
  if (pronto) return;
  try {
    if (Platform.OS === "android") {
      await Notifications.setNotificationChannelAsync(CANAL, {
        name: "Downloads",
        importance: Notifications.AndroidImportance.LOW,
      });
    }
    const perm = await Notifications.requestPermissionsAsync();
    pronto = perm.granted || perm.status === "granted";
  } catch {
    pronto = false;
  }
}

const gatilho = Platform.OS === "android" ? { channelId: CANAL } : null;

export async function progresso(rotulo, fracao) {
  if (!pronto) return;
  const agora = Date.now();
  if (agora - ultimoEnvio < 1000) return;
  ultimoEnvio = agora;

  const pct = Math.round((fracao || 0) * 100);
  try {
    await Notifications.scheduleNotificationAsync({
      identifier: ID,
      content: {
        title: "CatScrappy — baixando",
        body: `${rotulo} — ${pct}%`,
        sticky: true, // não dá para dispensar enquanto baixa
        autoDismiss: false,
      },
      trigger: gatilho,
    });
  } catch {}
}

export async function concluir(titulo, corpo) {
  if (!pronto) return;
  try {
    await Notifications.dismissNotificationAsync(ID);
    await Notifications.scheduleNotificationAsync({
      content: { title: titulo, body: corpo },
      trigger: gatilho,
    });
  } catch {}
}
