// src/api.js — cliente do backend CatScrappy (Render).
//
// Exceção: o site Mugiwaras é escrapeado direto no celular (src/mugiwaras),
// porque o Cloudflare dele devolve 403 para o IP de datacenter do Render.

import Constants from "expo-constants";
import * as mugiwaras from "./mugiwaras";

const BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || "https://catscrappy.onrender.com";

// Sites com download/streaming (o backend só expõe estes dois hoje).
export const SITES = [
  { id: "animefire", nome: "AnimeFire" },
  { id: "animesonline", nome: "AnimesOnline" },
  { id: "sushianimes", nome: "SushiAnimes" },
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
// Mangá — MangaDex e Mugiwaras (One Piece e outros, pt-br)
// ------------------------------------------------------------------
export const SITES_MANGA = [
  { id: "mangadex", nome: "MangaDex" },
  { id: "mugiwaras", nome: "Mugiwaras" },
  { id: "mangalivre", nome: "MangaLivre" },
];

export function buscarManga(site, nome) {
  if (site === "mugiwaras") return mugiwaras.buscarManga(nome);
  return getJSON("/manga/buscar", { site, nome }).then((d) => d.resultados);
}

export function listarCapitulos(site, mangaId, idioma = "pt-br") {
  if (site === "mugiwaras") return mugiwaras.listarCapitulos(mangaId);
  // idioma (só MangaDex): pt-br | en | es-la | ... | "todos"
  return getJSON("/manga/capitulos", { site, manga_id: mangaId, idioma }).then(
    (d) => d.capitulos
  );
}

export function obterPaginas(site, capituloId) {
  if (site === "mugiwaras") return mugiwaras.obterPaginas(capituloId);
  return getJSON("/manga/paginas", { site, capitulo_id: capituloId }).then(
    (d) => d.paginas
  );
}

// ------------------------------------------------------------------
// Contas e favoritos — falam com a API, que fala com o Supabase.
// O token do usuário vai no header Authorization.
// ------------------------------------------------------------------
async function requestJSON(caminho, { metodo = "GET", corpo, token, params } = {}) {
  const qs = params ? `?${new URLSearchParams(params).toString()}` : "";
  const headers = {};
  if (corpo) headers["Content-Type"] = "application/json";
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const resp = await fetch(`${BASE_URL}${caminho}${qs}`, {
      method: metodo,
      headers,
      body: corpo ? JSON.stringify(corpo) : undefined,
      signal: controller.signal,
    });
    if (!resp.ok) {
      const c = await resp.json().catch(() => ({}));
      const err = new Error(c.detail || `Erro ${resp.status}`);
      err.status = resp.status;
      throw err;
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

export function criarConta(email, senha) {
  return requestJSON("/auth/signup", { metodo: "POST", corpo: { email, senha } });
}

export function entrar(email, senha) {
  return requestJSON("/auth/login", { metodo: "POST", corpo: { email, senha } });
}

export function listarFavoritos(token) {
  return requestJSON("/favoritos", { token }).then((d) => d.favoritos);
}

export function adicionarFavorito(token, favorito) {
  return requestJSON("/favoritos", { metodo: "POST", corpo: favorito, token });
}

export function removerFavorito(token, { tipo, site, item_id }) {
  return requestJSON("/favoritos", {
    metodo: "DELETE",
    params: { tipo, site, item_id },
    token,
  });
}
