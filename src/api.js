// src/api.js — cliente do backend CatScrappy (Render).

import Constants from "expo-constants";

const BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || "https://catscrappy.onrender.com";

// Sites com download/streaming (o backend só expõe estes dois hoje).
export const SITES = [
  { id: "topanimes", nome: "TopAnimes" },
  { id: "animesdrive", nome: "AnimesDrive" },
];

async function getJSON(caminho, params) {
  const qs = new URLSearchParams(params).toString();
  const url = `${BASE_URL}${caminho}?${qs}`;

  // O free tier do Render hiberna: a primeira chamada pode levar ~30-50s.
  // Damos um timeout generoso para não falhar enquanto o serviço acorda.
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const resp = await fetch(url, { signal: controller.signal });
    if (!resp.ok) {
      const corpo = await resp.json().catch(() => ({}));
      throw new Error(corpo.detail || `Erro ${resp.status}`);
    }
    return await resp.json();
  } catch (e) {
    if (e.name === "AbortError") {
      throw new Error("O servidor demorou a responder. Tente de novo.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
}

export function buscarAnime(site, nome) {
  return getJSON("/buscar", { site, nome }).then((d) => d.resultados);
}

export function listarEpisodios(site, url) {
  return getJSON("/episodios", { site, url }).then((d) => d.episodios);
}

export function extrairVideo(site, url) {
  // Retorna { url_video, url_player, is_hls }.
  // url_player já é a URL pronta para tocar (proxy quando for MP4).
  return getJSON("/extrair-video", { site, url });
}

// ------------------------------------------------------------------
// Mangá (MangaDex)
// ------------------------------------------------------------------
export function buscarManga(nome) {
  return getJSON("/manga/buscar", { nome }).then((d) => d.resultados);
}

export function listarCapitulos(mangaId, idioma = "pt-br") {
  // idioma: pt-br | en | es-la | ... | "todos" (melhor tradução por capítulo)
  return getJSON("/manga/capitulos", { manga_id: mangaId, idioma }).then(
    (d) => d.capitulos
  );
}

export function obterPaginas(capituloId) {
  return getJSON("/manga/paginas", { capitulo_id: capituloId }).then(
    (d) => d.paginas
  );
}
