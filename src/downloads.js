// src/downloads.js — download de vídeos e mangás para uma pasta escolhida.
//
// Usa o Storage Access Framework (SAF) do Android: na primeira vez o usuário
// escolhe a pasta de destino (ex.: Download), e a permissão fica guardada em
// AsyncStorage para os próximos downloads. Requer build nativo (APK): o
// expo-file-system não roda no Expo Go.
//
// O download vai para o cache (API legada, a única com progresso) e depois
// é copiado para a pasta SAF pelo módulo nativo local modules/saf-copy.
// O módulo existe porque o expo-file-system 19 não tem nenhum método com
// memória constante que escreva num destino content://: read/writeAsString
// em base64 estouram o heap em vídeos grandes (OutOfMemoryError), e
// copyAsync/File.copy/FileHandle rejeitam content URIs.

import * as FileSystem from "expo-file-system/legacy";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { copyToSaf } from "../modules/saf-copy";
import { extrairVideo, obterPaginas } from "./api";

const SAF = FileSystem.StorageAccessFramework;
const CHAVE_PASTA = "@catscrappy:pastaDownloads";

// Remove caracteres proibidos em nomes de arquivo.
function nomeSeguro(texto) {
  return String(texto)
    .replace(/[<>:"/\\|?*]/g, "")
    .trim();
}

// Garante uma pasta de destino: reusa a guardada ou pede ao usuário para
// escolher (uma vez). Retorna a URI da pasta (content://...).
async function garantirPasta() {
  const salva = await AsyncStorage.getItem(CHAVE_PASTA);
  if (salva) return salva;

  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) {
    throw new Error("Nenhuma pasta de download foi escolhida.");
  }
  await AsyncStorage.setItem(CHAVE_PASTA, perm.directoryUri);
  return perm.directoryUri;
}

// Permite trocar a pasta depois (chamado por um botão de configuração).
export async function escolherPasta() {
  const perm = await SAF.requestDirectoryPermissionsAsync();
  if (!perm.granted) return null;
  await AsyncStorage.setItem(CHAVE_PASTA, perm.directoryUri);
  return perm.directoryUri;
}

// Baixa uma URL para o cache (com progresso) e copia para a pasta SAF.
async function baixarPara(pastaUri, url, nomeArquivo, mime, onProgress) {
  const temp = FileSystem.cacheDirectory + nomeArquivo;

  const dl = FileSystem.createDownloadResumable(url, temp, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  const { uri: tempUri } = await dl.downloadAsync();

  // Cria o arquivo de destino na pasta SAF e copia em streaming nativo.
  const destUri = await SAF.createFileAsync(pastaUri, nomeArquivo, mime);
  try {
    await copyToSaf(tempUri, destUri);
  } catch (e) {
    // Não deixa um arquivo vazio/parcial na pasta do usuário.
    await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
    throw e;
  } finally {
    await FileSystem.deleteAsync(tempUri, { idempotent: true });
  }
}

// -------------------------------------------------------------------
// Anime: um episódio (arquivo de vídeo MP4).
// -------------------------------------------------------------------
export async function baixarEpisodio(site, ep, onProgress, pastaUri) {
  const pasta = pastaUri || (await garantirPasta());

  const { url_player } = await extrairVideo(site, ep.url_pagina);
  // HLS (.m3u8) é uma playlist de segmentos, não um arquivo único: o
  // expo-file-system não baixa isso como um MP4. Sinalizamos ao chamador.
  if (url_player.split("?")[0].endsWith(".m3u8")) {
    const err = new Error("Episódio em HLS — baixe pelo player (não suportado).");
    err.code = "HLS_NAO_SUPORTADO";
    throw err;
  }

  const nome = nomeSeguro(ep.titulo || "episodio") + ".mp4";
  await baixarPara(pasta, url_player, nome, "video/mp4", onProgress);
}

// -------------------------------------------------------------------
// Anime: vários episódios (temporada/intervalo), em sequência.
// Retorna { sucesso, falhas: [{titulo, erro}] }.
// -------------------------------------------------------------------
export async function baixarEpisodios(site, episodios, onItem, onProgress) {
  const pasta = await garantirPasta();
  let sucesso = 0;
  const falhas = [];

  for (let i = 0; i < episodios.length; i++) {
    const ep = episodios[i];
    onItem?.(i + 1, episodios.length, ep);
    try {
      await baixarEpisodio(site, ep, onProgress, pasta);
      sucesso++;
    } catch (e) {
      falhas.push({ titulo: ep.titulo, erro: e.message });
    }
  }
  return { sucesso, falhas };
}

// -------------------------------------------------------------------
// Mangá: um capítulo (todas as páginas como imagens).
// -------------------------------------------------------------------
export async function baixarCapitulo(cap, onProgress, pastaUri) {
  const pasta = pastaUri || (await garantirPasta());

  const paginas = await obterPaginas(cap.id);
  if (!paginas.length) {
    throw new Error("Capítulo sem páginas.");
  }

  for (let i = 0; i < paginas.length; i++) {
    const url = paginas[i];
    const ext = (url.split("?")[0].split(".").pop() || "jpg").toLowerCase();
    const mime = ext === "png" ? "image/png" : "image/jpeg";
    const nome = `${nomeSeguro("Cap " + cap.numero)}_${String(i + 1).padStart(
      3,
      "0"
    )}.${ext}`;
    await baixarPara(pasta, url, nome, mime, null);
    onProgress?.((i + 1) / paginas.length);
  }
}

// -------------------------------------------------------------------
// Mangá: vários capítulos, em sequência.
// -------------------------------------------------------------------
export async function baixarCapitulos(capitulos, onItem, onProgress) {
  const pasta = await garantirPasta();
  let sucesso = 0;
  const falhas = [];

  for (let i = 0; i < capitulos.length; i++) {
    const cap = capitulos[i];
    onItem?.(i + 1, capitulos.length, cap);
    try {
      await baixarCapitulo(cap, onProgress, pasta);
      sucesso++;
    } catch (e) {
      falhas.push({ titulo: `Cap ${cap.numero}`, erro: e.message });
    }
  }
  return { sucesso, falhas };
}
