// src/downloads.js — download de vídeos e mangás para uma pasta escolhida.
//
// Usa o Storage Access Framework (SAF) do Android: na primeira vez o usuário
// escolhe a pasta de destino (ex.: Download), e a permissão fica guardada em
// AsyncStorage para os próximos downloads. Dentro dela, cada anime/mangá
// ganha uma subpasta com o próprio nome. Requer build nativo (APK): o
// expo-file-system não roda no Expo Go.
//
// Anime: o episódio vai para o cache (API legada, a única com progresso) e
// depois é copiado para a pasta SAF pelo módulo nativo local
// modules/saf-copy. O módulo existe porque o expo-file-system 19 não tem
// nenhum método com memória constante que escreva num destino content://:
// read/writeAsString em base64 estouram o heap em vídeos grandes
// (OutOfMemoryError), e copyAsync/File.copy/FileHandle rejeitam content URIs.
// Episódios em HLS são baixados segmento a segmento e concatenados no
// destino via append nativo (ver baixarHls e src/hls.js).
//
// Mangá: as páginas são baixadas para o cache e viram um único PDF por
// capítulo (expo-print), copiado para a subpasta do mangá. As imagens são
// embutidas como base64 no HTML porque o WebView do expo-print não carrega
// file:// (loadDataWithBaseURL sem allowFileAccess); capítulos são pequenos
// o bastante para isso não estourar a memória.

import * as FileSystem from "expo-file-system/legacy";
import * as Print from "expo-print";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { copyToSaf } from "../modules/saf-copy";
import { extrairVideo, obterPaginas } from "./api";
import { obterSegmentos, resolverUrl } from "./hls";

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

// Garante uma subpasta com o nome do título dentro da pasta escolhida.
// Procura uma existente antes de criar: makeDirectoryAsync com nome repetido
// criaria "Nome (1)" em vez de reusar.
async function garantirSubpasta(pastaUri, titulo) {
  const nome = nomeSeguro(titulo);
  if (!nome) return pastaUri;

  const filhos = await SAF.readDirectoryAsync(pastaUri).catch(() => []);
  const existente = filhos.find((uri) =>
    decodeURIComponent(uri).endsWith("/" + nome)
  );
  if (existente) return existente;
  return SAF.makeDirectoryAsync(pastaUri, nome);
}

const CANCELADO = "Download cancelado.";

// Baixa uma URL para o cache (com progresso) e copia para a pasta SAF.
// O token (opcional) permite abortar o arquivo em andamento via cancelAsync.
async function baixarPara(pastaUri, url, nomeArquivo, mime, onProgress, token) {
  if (token?.cancelado) throw new Error(CANCELADO);
  const temp = FileSystem.cacheDirectory + nomeArquivo;

  const dl = FileSystem.createDownloadResumable(url, temp, {}, (p) => {
    if (onProgress && p.totalBytesExpectedToWrite > 0) {
      onProgress(p.totalBytesWritten / p.totalBytesExpectedToWrite);
    }
  });
  if (token) token.abortar = () => dl.cancelAsync().catch(() => {});

  let resultado;
  try {
    resultado = await dl.downloadAsync();
  } finally {
    if (token) token.abortar = null;
  }
  if (!resultado || token?.cancelado) {
    await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => {});
    throw new Error(CANCELADO);
  }
  const { uri: tempUri } = resultado;

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

// Baixa um episódio HLS: concatena os segmentos da playlist num arquivo
// único, anexando cada um ao destino SAF (streaming nativo, memória
// constante). MPEG-TS concatenado é um .ts reproduzível; com #EXT-X-MAP
// (fMP4), init + segmentos formam um .mp4 fragmentado válido.
async function baixarHls(pastaUri, urlM3u8, nomeBase, onProgress, token) {
  const { urlBase, segmentos, init } = await obterSegmentos(urlM3u8);

  const fmp4 = !!init;
  const nome = nomeBase + (fmp4 ? ".mp4" : ".ts");
  const mime = fmp4 ? "video/mp4" : "video/mp2t";
  const lista = fmp4 ? [init, ...segmentos] : segmentos;

  const destUri = await SAF.createFileAsync(pastaUri, nome, mime);
  const temp = FileSystem.cacheDirectory + "segmento.bin";
  try {
    for (let i = 0; i < lista.length; i++) {
      if (token?.cancelado) throw new Error(CANCELADO);
      const segUrl = resolverUrl(urlBase, lista[i]);
      await FileSystem.downloadAsync(segUrl, temp);
      await copyToSaf(temp, destUri, i > 0); // anexa a partir do segundo
      onProgress?.((i + 1) / lista.length);
    }
  } catch (e) {
    // Não deixa um arquivo parcial na pasta do usuário.
    await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
    throw e;
  } finally {
    await FileSystem.deleteAsync(temp, { idempotent: true }).catch(() => {});
  }
}

// -------------------------------------------------------------------
// Anime: um episódio (MP4 direto ou stream HLS).
// -------------------------------------------------------------------
export async function baixarEpisodio(site, ep, onProgress, pastaUri, token) {
  const pasta = pastaUri || (await garantirPasta());

  const { url_player } = await extrairVideo(site, ep.url_pagina);
  const nomeBase = nomeSeguro(ep.titulo || "episodio");

  if (url_player.split("?")[0].endsWith(".m3u8")) {
    await baixarHls(pasta, url_player, nomeBase, onProgress, token);
    return;
  }
  await baixarPara(
    pasta,
    url_player,
    nomeBase + ".mp4",
    "video/mp4",
    onProgress,
    token
  );
}

// -------------------------------------------------------------------
// Anime: vários episódios (temporada/intervalo), em sequência, numa
// subpasta com o nome do anime. Retorna { sucesso, falhas: [{titulo, erro}] }.
// -------------------------------------------------------------------
export async function baixarEpisodios(site, episodios, onItem, onProgress, tituloAnime, token) {
  const raiz = await garantirPasta();
  const pasta = tituloAnime ? await garantirSubpasta(raiz, tituloAnime) : raiz;
  let sucesso = 0;
  const falhas = [];

  for (let i = 0; i < episodios.length; i++) {
    if (token?.cancelado) break;
    const ep = episodios[i];
    onItem?.(i + 1, episodios.length, ep);
    try {
      await baixarEpisodio(site, ep, onProgress, pasta, token);
      sucesso++;
    } catch (e) {
      if (token?.cancelado) break;
      falhas.push({ titulo: ep.titulo, erro: e.message });
    }
  }
  return { sucesso, falhas, cancelado: !!token?.cancelado };
}

// -------------------------------------------------------------------
// Mangá: um capítulo vira um único PDF com todas as páginas.
// -------------------------------------------------------------------
const MIME_IMG = { png: "image/png", webp: "image/webp" };

export async function baixarCapitulo(siteManga, cap, onProgress, pastaUri, token) {
  const pasta = pastaUri || (await garantirPasta());

  const paginas = await obterPaginas(siteManga, cap.id);
  if (!paginas.length) {
    throw new Error("Capítulo sem páginas.");
  }

  const temps = [];
  let pdfUri = null;
  try {
    // 1) Baixa as páginas para o cache (0 → 0.7 do progresso).
    for (let i = 0; i < paginas.length; i++) {
      if (token?.cancelado) throw new Error(CANCELADO);
      const url = paginas[i];
      const ext = (url.split("?")[0].split(".").pop() || "jpg").toLowerCase();
      const mime = MIME_IMG[ext] || "image/jpeg";
      const temp = `${FileSystem.cacheDirectory}cap_${cap.id}_${i}.${ext}`;
      await FileSystem.downloadAsync(url, temp);
      temps.push({ uri: temp, mime });
      onProgress?.(((i + 1) / paginas.length) * 0.7);
    }

    // 2) Monta o HTML (imagens em base64) e gera o PDF (0.7 → 0.95).
    let corpo = "";
    for (const pagina of temps) {
      const b64 = await FileSystem.readAsStringAsync(pagina.uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      corpo += `<img src="data:${pagina.mime};base64,${b64}" />`;
    }
    const html =
      "<html><head><meta charset=\"utf-8\"><style>" +
      "body{margin:0;padding:0}" +
      "img{width:100%;display:block;page-break-after:always}" +
      "</style></head><body>" +
      corpo +
      "</body></html>";
    onProgress?.(0.8);

    const resultado = await Print.printToFileAsync({ html });
    pdfUri = resultado.uri;
    onProgress?.(0.95);

    // 3) Copia o PDF para a pasta SAF em streaming nativo.
    const nome = `${nomeSeguro("Cap " + cap.numero)}.pdf`;
    const destUri = await SAF.createFileAsync(pasta, nome, "application/pdf");
    try {
      await copyToSaf(pdfUri, destUri);
    } catch (e) {
      await FileSystem.deleteAsync(destUri, { idempotent: true }).catch(() => {});
      throw e;
    }
    onProgress?.(1);
  } finally {
    // Limpa páginas e PDF temporários mesmo em caso de erro.
    for (const pagina of temps) {
      await FileSystem.deleteAsync(pagina.uri, { idempotent: true }).catch(() => {});
    }
    if (pdfUri) {
      await FileSystem.deleteAsync(pdfUri, { idempotent: true }).catch(() => {});
    }
  }
}

// -------------------------------------------------------------------
// Mangá: vários capítulos, em sequência, numa subpasta com o nome do mangá.
// -------------------------------------------------------------------
export async function baixarCapitulos(siteManga, capitulos, onItem, onProgress, tituloManga, token) {
  const raiz = await garantirPasta();
  const pasta = tituloManga ? await garantirSubpasta(raiz, tituloManga) : raiz;
  let sucesso = 0;
  const falhas = [];

  for (let i = 0; i < capitulos.length; i++) {
    if (token?.cancelado) break;
    const cap = capitulos[i];
    onItem?.(i + 1, capitulos.length, cap);
    try {
      await baixarCapitulo(siteManga, cap, onProgress, pasta, token);
      sucesso++;
    } catch (e) {
      if (token?.cancelado) break;
      falhas.push({ titulo: `Cap ${cap.numero}`, erro: e.message });
    }
  }
  return { sucesso, falhas, cancelado: !!token?.cancelado };
}
