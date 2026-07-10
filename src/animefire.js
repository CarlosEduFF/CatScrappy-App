// src/animefire.js — scraper do animefire.io rodando NO CELULAR.
//
// O site fica atrás do Cloudflare, que devolve 403 para IPs de datacenter
// (o Render, onde a API vive) mas aceita IPs residenciais/móveis. Então o
// app escrapeia a busca, a lista de episódios e a URL do vídeo direto no
// celular. O arquivo .mp4 em si vem do CDN lightspeedst.net (que NÃO é
// bloqueado) e exige o header Referer — por isso a reprodução continua
// passando pelo /proxy da API, que reenvia o Referer ao CDN.

import Constants from "expo-constants";

const BASE = "https://animefire.io";
const REFERER = "https://animefire.io/";
const UA =
  "Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) " +
  "Chrome/126.0 Mobile Safari/537.36";

const API_BASE =
  Constants.expoConfig?.extra?.apiBaseUrl || "https://catscrappy.onrender.com";

function decodeHtml(s) {
  return s
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#039;|&apos;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

// Códigos transitórios da Cloudflare/origem (timeout, origem indisponível):
// costumam passar numa segunda tentativa.
const STATUS_TRANSITORIO = new Set([502, 503, 504, 520, 521, 522, 523, 524]);

async function texto(url, opcoes = {}) {
  let ultimoStatus = 0;
  // Tenta até 3 vezes com uma pausa crescente quando o erro é transitório.
  for (let tentativa = 0; tentativa < 3; tentativa++) {
    if (tentativa > 0) {
      await new Promise((r) => setTimeout(r, 800 * tentativa));
    }
    let resp;
    try {
      resp = await fetch(url, { headers: { "User-Agent": UA }, ...opcoes });
    } catch (e) {
      ultimoStatus = 0; // falha de rede; tenta de novo
      continue;
    }
    if (resp.ok) return resp.text();
    ultimoStatus = resp.status;
    if (!STATUS_TRANSITORIO.has(resp.status)) break; // erro definitivo: não insiste
  }
  if (ultimoStatus === 522 || STATUS_TRANSITORIO.has(ultimoStatus)) {
    throw new Error(
      "O AnimeFire está fora do ar no momento (erro " +
        (ultimoStatus || "de conexão") +
        "). Tente novamente em alguns minutos."
    );
  }
  throw new Error(`AnimeFire: erro ${ultimoStatus || "de conexão"}`);
}

// Gêneros (nome exibido -> slug da URL /genero/<slug>).
const GENEROS = {
  Ação: "acao",
  Aventura: "aventura",
  Comédia: "comedia",
  Drama: "drama",
  Ecchi: "ecchi",
  Fantasia: "fantasia",
  Harém: "harem",
  Horror: "horror",
  Magia: "magia",
  Mecha: "mecha",
  Mistério: "misterio",
  Psicológico: "psicologico",
  Romance: "romance",
  Seinen: "seinen",
  Shounen: "shounen",
  "Slice of Life": "slice-of-life",
  Sobrenatural: "sobrenatural",
  Suspense: "suspense",
};

export function listarGeneros() {
  return Object.keys(GENEROS);
}

// Extrai os cards de anime (mesma estrutura na busca e na página de gênero).
function parseCards(html) {
  const resultados = [];
  const re =
    /divCardUltimosEps" title="([^"]*)">[\s\S]*?<a href="([^"]+)">[\s\S]*?data-src="([^"]+)"/g;
  let m;
  while ((m = re.exec(html))) {
    const bruto = decodeHtml(m[1]);
    const audioM = bruto.match(/\((Dublado|Legendado)\)/);
    const audio = audioM ? audioM[1] : "";
    const titulo = bruto
      .replace(/\s*\((?:Dublado|Legendado)\)/, "")
      .split(" - ")[0]
      .trim();
    resultados.push({
      titulo,
      url_detalhes: m[2],
      audio,
      imagem: m[3],
      ano: "",
      sinopse: "",
    });
  }
  return resultados;
}

// Busca por nome e/ou gênero. Sem termo, com gênero, lista o catálogo do
// gênero (/genero/<slug>). O /pesquisar/ espera espaços como hífen.
// Monta o slug de busca do AnimeFire: minúsculas, sem acento, espaços viram
// hífen. O site é sensível a maiúsculas ("One-piece" dá 404, "one-piece" ok)
// e não aceita acentos na URL.
function slugBusca(nome) {
  return nome
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "") // remove acentos
    .replace(/\s+/g, "-");
}

export async function buscarAnime(nome, genero) {
  const slug = genero && GENEROS[genero];
  if (slug && !nome.trim()) {
    const html = await texto(`${BASE}/genero/${slug}`);
    return parseCards(html);
  }
  const termo = slugBusca(nome);
  const html = await texto(`${BASE}/pesquisar/${encodeURIComponent(termo)}`);
  const resultados = parseCards(html);
  // Com termo E gênero, filtra o resultado da busca pelos que também
  // aparecem no gênero (o animefire não combina os dois numa URL só).
  return resultados;
}

// Episódios: lista no HTML da página do anime (a.lEp). O número é o último
// segmento da URL (.../<slug>/<n>).
export async function listarEpisodios(urlAnime) {
  const html = await texto(urlAnime);

  const episodios = [];
  const re = /<a class="lEp[^"]*" href="([^"]+)">([^<]+)<\/a>/g;
  let m;
  while ((m = re.exec(html))) {
    const link = m[1];
    const numM = link.match(/\/(\d+)\/?$/);
    const numero = numM ? numM[1] : "";
    episodios.push({
      titulo: decodeHtml(m[2]).trim() || `Episódio ${numero}`,
      url_pagina: link,
      numero,
    });
  }

  if (episodios.length === 0) {
    // Filmes não têm lista: a própria página é o "episódio".
    episodios.push({ titulo: "Filme completo", url_pagina: urlAnime, numero: "1" });
  }

  episodios.sort(
    (a, b) =>
      (parseFloat(a.numero) || Infinity) - (parseFloat(b.numero) || Infinity)
  );
  return episodios;
}

function pesoQualidade(label) {
  const m = String(label).match(/(\d+)/);
  return m ? Number(m[1]) : 0;
}

// Vídeo: data-video-src aponta pra /video/<slug>/<n>, que devolve JSON com
// os .mp4 por qualidade. Retorna o mesmo formato do /extrair-video da API:
// { url_video, url_player, is_hls }. O mp4 exige Referer, então o url_player
// aponta para o /proxy da API (que reenvia o Referer ao CDN).
export async function extrairVideo(urlEpisodio) {
  const html = await texto(urlEpisodio);

  const apiM = html.match(/data-video-src="([^"]+)"/);
  if (!apiM) throw new Error("Nenhum vídeo disponível para este episódio.");

  let apiUrl = decodeHtml(apiM[1]);
  if (apiUrl.startsWith("/")) apiUrl = BASE + apiUrl;

  // A API interna oscila; insiste algumas vezes.
  let dados = null;
  for (let i = 0; i < 3; i++) {
    try {
      const resp = await fetch(apiUrl, {
        headers: { "User-Agent": UA, Referer: urlEpisodio },
      });
      if (resp.ok) {
        dados = await resp.json();
        break;
      }
    } catch {
      // tenta de novo
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
  if (!dados) throw new Error("A API de vídeo não respondeu.");

  const fontes = (dados.data || []).filter(
    (f) => typeof f.src === "string" && f.src.startsWith("http")
  );
  if (fontes.length === 0) {
    throw new Error("Nenhum vídeo disponível para este episódio.");
  }

  fontes.sort((a, b) => pesoQualidade(a.label) - pesoQualidade(b.label));
  const melhor = fontes[fontes.length - 1];
  const urlVideo = melhor.src;

  // O CDN exige Referer; passa pelo /proxy da API (mesma lógica do backend).
  const urlPlayer =
    `${API_BASE}/proxy?url=${encodeURIComponent(urlVideo)}` +
    `&referer=${encodeURIComponent(REFERER)}`;

  return { url_video: urlVideo, url_player: urlPlayer, is_hls: false };
}
