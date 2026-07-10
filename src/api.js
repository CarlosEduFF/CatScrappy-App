// src/api.js — cliente do backend CatScrappy (Render).
//
// Exceção: alguns sites são escrapeados direto no celular, porque o
// Cloudflare deles devolve 403 para o IP de datacenter do Render mas aceita
// IPs residenciais/móveis. Hoje: Mugiwaras (mangá), AnimeFire e SushiAnimes.

import Constants from "expo-constants";
import * as mugiwaras from "./mugiwaras";
import * as animefire from "./animefire";
import * as sushianimes from "./sushianimes";

const BASE_URL =
  Constants.expoConfig?.extra?.apiBaseUrl || "https://catscrappy.onrender.com";

// Sites de anime. Alguns têm um comportamento especial:
// - navegador: o Cloudflare exige um JS challenge que nem o celular resolve
//   via fetch, então o app abre a busca no navegador externo (buscaUrl).
export const SITES = [
  { id: "animefire", nome: "AnimeFire", url: "https://animefire.io" },
  { id: "animesonline", nome: "AnimesOnline", url: "https://animesonline.cloud" },
  { id: "sushianimes", nome: "SushiAnimes", url: "https://sushianimes.com.br" },
  { id: "topanimes", nome: "TopAnimes", url: "https://topanimes.net" },
  { id: "animesdrive", nome: "AnimesDrive (abre no navegador)", url: "https://animesdrive.online",
    navegador: true,
    buscaUrl: (termo) =>
      `https://animesdrive.online/?s=${encodeURIComponent(termo)}`,
  },
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

export function buscarAnime(site, nome, genero) {
  if (site === "animefire") return animefire.buscarAnime(nome, genero);
  if (site === "sushianimes") return sushianimes.buscarAnime(nome);
  return getJSON("/buscar", { site, nome }).then((d) => d.resultados);
}

// Gêneros disponíveis para o site de anime (vazio = sem filtro por gênero).
export function generosAnime(site) {
  if (site === "animefire") return animefire.listarGeneros();
  return [];
}

export function listarEpisodios(site, url) {
  if (site === "animefire") return animefire.listarEpisodios(url);
  if (site === "sushianimes") return sushianimes.listarEpisodios(url);
  return getJSON("/episodios", { site, url }).then((d) => d.episodios);
}

export function extrairVideo(site, url) {
  // Retorna { url_video, url_player, is_hls }.
  // url_player já é a URL pronta para tocar (proxy quando for MP4).
  if (site === "animefire") return animefire.extrairVideo(url);
  if (site === "sushianimes") return sushianimes.extrairVideo(url);
  return getJSON("/extrair-video", { site, url });
}

// ------------------------------------------------------------------
// Mangá — MangaDex e Mugiwaras (One Piece e outros, pt-br)
// ------------------------------------------------------------------
export const SITES_MANGA = [
  { id: "mangadex", nome: "MangaDex", url: "https://mangadex.org" },
  { id: "mugiwaras", nome: "Mugiwaras", url: "https://mugiwarasoficial.com" },
  { id: "mangalivre", nome: "MangaLivre", url: "https://mangalivre.blog" },
];

export function buscarManga(site, nome, genero) {
  if (site === "mugiwaras") return mugiwaras.buscarManga(nome);
  const params = { site, nome };
  if (genero) params.genero = genero;
  return getJSON("/manga/buscar", params).then((d) => d.resultados);
}

// Só o MangaDex expõe gêneros por enquanto (lista fixa, sem ir ao servidor).
const GENEROS_MANGADEX = [
  "Ação", "Aventura", "Comédia", "Drama", "Fantasia", "Terror",
  "Histórico", "Isekai", "Mecha", "Mistério", "Psicológico", "Romance",
  "Sci-Fi", "Slice of Life", "Esportes", "Suspense", "Tragédia",
];

export function generosManga(site) {
  if (site === "mangadex") return GENEROS_MANGADEX;
  return [];
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

export function criarConta(email, senha, nome) {
  return requestJSON("/auth/signup", {
    metodo: "POST",
    corpo: { email, senha, nome },
  });
}

export function entrar(email, senha) {
  return requestJSON("/auth/login", { metodo: "POST", corpo: { email, senha } });
}

// Atualiza o nome de exibição no perfil.
export function atualizarPerfil(token, { nome }) {
  return requestJSON("/perfil", {
    metodo: "PUT",
    corpo: { nome },
    token,
  }).then((d) => d.usuario);
}

// Envia a foto de perfil (multipart) e devolve { avatar_url, usuario }.
export async function enviarAvatar(token, foto) {
  // foto: { uri, mimeType? } vindo do expo-image-picker.
  // Envia os BYTES da imagem como corpo binário puro (Content-Type = o tipo
  // da imagem), não multipart — assim a API não depende de python-multipart.
  const tipo = foto.mimeType || "image/jpeg";
  const resposta = await fetch(foto.uri); // lê o arquivo local
  const blob = await resposta.blob();

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 90000);
  try {
    const resp = await fetch(`${BASE_URL}/perfil/avatar`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": tipo,
      },
      body: blob,
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
      throw new Error("O envio demorou demais. Tente de novo.");
    }
    throw e;
  } finally {
    clearTimeout(timer);
  }
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

// ------------------------------------------------------------------
// Histórico — episódios/capítulos já vistos, por série.
// ------------------------------------------------------------------
export function listarHistorico(token, { tipo, site, item_id }) {
  return requestJSON("/historico", {
    params: { tipo, site, item_id },
    token,
  }).then((d) => d.historico);
}

export function marcarVisto(token, item) {
  return requestJSON("/historico", { metodo: "POST", corpo: item, token });
}

export function desmarcarVisto(token, { tipo, site, item_id, episodio_id }) {
  return requestJSON("/historico", {
    metodo: "DELETE",
    params: { tipo, site, item_id, episodio_id },
    token,
  });
}
