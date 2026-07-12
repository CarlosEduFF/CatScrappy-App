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
// Mangá: as páginas são baixadas para o cache, comprimidas para JPEG e
// viram um único PDF por capítulo montado em JS puro (src/pdf.js), copiado
// para a subpasta do mangá. Não usa expo-print: o WebView dele não carrega
// um HTML com o capítulo inteiro em base64 (~10 MB+) e imprime um documento
// vazio — uma página em branco.

import * as FileSystem from "expo-file-system/legacy";
import * as ImageManipulator from "expo-image-manipulator";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { copyToSaf } from "../modules/saf-copy";
import { base64ParaBytes, gerarPdfDeJpegs } from "./pdf";
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
// headers (opcional): enviados no request (ex.: Referer que o CDN exige).
async function baixarPara(pastaUri, url, nomeArquivo, mime, onProgress, token, headers) {
  if (token?.cancelado) throw new Error(CANCELADO);
  const temp = FileSystem.cacheDirectory + nomeArquivo;

  const opcoes = headers ? { headers } : {};
  const dl = FileSystem.createDownloadResumable(url, temp, opcoes, (p) => {
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

  const { url_player, headers } = await extrairVideo(site, ep.url_pagina);
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
    token,
    headers
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

  // O cap.id pode ser uma URL (Mugiwaras usa a própria URL como id); as
  // barras dela criariam subpastas inexistentes no nome do arquivo de cache
  // e o downloadAsync falha (não cria pastas pai). Achata para um id seguro.
  const idArquivo = String(cap.id).replace(/[^a-zA-Z0-9]/g, "_");

  const temps = [];
  let pdfUri = null;
  try {
    // 1) Baixa cada página e converte para JPEG (0 → 0.8). Converter é
    // obrigatório: o PDF embute JPEG nativamente (/DCTDecode), mas não WebP
    // — e o Mugiwaras serve as páginas em .webp. Redimensionar (1080px) +
    // q=0.7 reduz ~10x o tamanho do arquivo final. Pedir o base64 direto do
    // manipulator evita reler o arquivo (cujo URI nem sempre é legível pelo
    // file-system).
    const paginasJpeg = [];
    for (let i = 0; i < paginas.length; i++) {
      if (token?.cancelado) throw new Error(CANCELADO);
      const url = paginas[i];
      const ext = (url.split("?")[0].split(".").pop() || "jpg").toLowerCase();
      const bruto = `${FileSystem.cacheDirectory}cap_${idArquivo}_${i}_bruto.${ext}`;
      temps.push({ uri: bruto });

      // Uma página quebrada no servidor (404 que o downloadAsync salva como
      // arquivo, imagem que não decodifica) não derruba o capítulo: pula a
      // página, como o próprio site faz.
      try {
        const resp = await FileSystem.downloadAsync(url, bruto);
        if (resp.status < 200 || resp.status >= 300) {
          throw new Error(`HTTP ${resp.status}`);
        }
        const out = await ImageManipulator.manipulateAsync(
          bruto,
          [{ resize: { width: 1080 } }],
          {
            compress: 0.7,
            format: ImageManipulator.SaveFormat.JPEG,
            base64: true,
          }
        );
        if (out.uri) temps.push({ uri: out.uri });
        if (!out.base64) {
          throw new Error("Falha ao processar uma página do capítulo.");
        }
        paginasJpeg.push({
          bytes: base64ParaBytes(out.base64),
          width: out.width,
          height: out.height,
        });
      } catch (e) {
        if (token?.cancelado) throw new Error(CANCELADO);
      }
      onProgress?.(((i + 1) / paginas.length) * 0.8);
    }
    if (!paginasJpeg.length) {
      throw new Error("Nenhuma página do capítulo pôde ser baixada.");
    }

    // 2) Monta o PDF diretamente dos JPEGs e grava no cache.
    const pdfBase64 = gerarPdfDeJpegs(paginasJpeg);
    pdfUri = `${FileSystem.cacheDirectory}cap_${idArquivo}.pdf`;
    await FileSystem.writeAsStringAsync(pdfUri, pdfBase64, {
      encoding: FileSystem.EncodingType.Base64,
    });
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
